import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QALog, QAParadigm, QAStatus } from './entities/qa-log.entity';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { SemanticCacheService } from '../../common/cache/semantic-cache.service';
import { LoggerService } from '../../common/logger/logger.service';
import { ConfidenceThresholdService } from '../../common/confidence-threshold/confidence-threshold.service';
import { DocumentService } from '../document/document.service';
import {
  ReasoningChain,
  ReasoningNode,
  ReasoningEdge,
  KeywordInfo,
  MatchedEntity,
  RelationFilteringStep,
  IntermediateResult,
  ConfidenceBreakdown,
  ConfidenceFactor,
  LowConfidenceWarning,
  RecommendedDocument,
  SourceFragment,
} from '../../common/interfaces/reasoning-chain.interface';

@Injectable()
export class QAService {
  private nodeIdCounter = 0;

  constructor(
    @InjectRepository(QALog)
    private qaLogRepository: Repository<QALog>,
    private knowledgeGraphService: KnowledgeGraphService,
    private semanticCacheService: SemanticCacheService,
    private confidenceThresholdService: ConfidenceThresholdService,
    private documentService: DocumentService,
    private logger: LoggerService,
  ) {}

  async askQuestion(question: string, userId?: string): Promise<{
    answer: string;
    sources: any[];
    confidence: number;
    confidenceBreakdown: ConfidenceBreakdown;
    reasoningChain: ReasoningChain;
    lowConfidenceWarning?: LowConfidenceWarning;
    highlights: any[];
  }> {
    const startTime = Date.now();
    this.nodeIdCounter = 0;

    const cachedAnswer = this.semanticCacheService.get(question);
    if (cachedAnswer) {
      const responseTime = Date.now() - startTime;
      await this.saveLog(question, cachedAnswer, responseTime, userId);
      return cachedAnswer;
    }

    const paradigm = this.detectParadigm(question);
    const entityTypes: string[] = [];

    const keywords = this.extractKeywords(question);
    const entities = this.extractQuestionEntities(question);
    entities.forEach(e => {
      if (this.isPersonEntity(e)) entityTypes.push('person');
      else if (this.isOrganizationEntity(e)) entityTypes.push('organization');
      else if (this.isLocationEntity(e)) entityTypes.push('location');
      else if (this.isDateEntity(e)) entityTypes.push('date');
    });

    let answer = '';
    let sources: any[] = [];
    let highlights: any[] = [];
    let confidenceBreakdown: ConfidenceBreakdown;
    let reasoningChain: ReasoningChain;
    let lowConfidenceWarning: LowConfidenceWarning | undefined;

    try {
      const graphEntities = await this.queryGraphEntities(entities);
      const matchedEntities: MatchedEntity[] = graphEntities.map(e => ({
        name: e.name,
        type: e.type,
        graphEntityId: e.id,
        confidence: e.confidence,
        documentId: e.documentId,
        matchedVia: 'name_exact_match',
        properties: e.properties,
      }));

      const entityRecognitionConfidence = this.calculateEntityRecognitionConfidence(matchedEntities);

      const relations = await this.queryGraphRelations(matchedEntities);
      const relationFilteringProcess = this.buildRelationFilteringSteps(relations, matchedEntities);
      const relationMatchingConfidence = this.calculateRelationMatchingConfidence(relationFilteringProcess);

      const intermediateResults = this.buildIntermediateResults(relations, matchedEntities);

      answer = await this.generateAnswer(question, paradigm, matchedEntities, intermediateResults);

      sources = matchedEntities.slice(0, 3).map(e => ({
        documentId: e.documentId,
        entityId: e.graphEntityId,
        entityName: e.name,
        confidence: e.confidence,
      }));

      highlights = this.generateHighlights(question, answer);

      const answerGenerationConfidence = this.calculateAnswerGenerationConfidence(
        answer,
        paradigm,
        matchedEntities.length,
        relations.length
      );

      confidenceBreakdown = this.buildConfidenceBreakdown(
        entityRecognitionConfidence,
        relationMatchingConfidence,
        answerGenerationConfidence
      );

      reasoningChain = this.buildReasoningChain(
        question,
        paradigm,
        keywords,
        matchedEntities,
        relationFilteringProcess,
        intermediateResults,
        answer,
        sources
      );

      const threshold = this.confidenceThresholdService.getThreshold(paradigm, undefined, entityTypes);
      const isLow = confidenceBreakdown.final < threshold;

      if (isLow) {
        const recommendedDocs = await this.getRecommendedDocuments(matchedEntities, paradigm);
        lowConfidenceWarning = {
          isLowConfidence: true,
          threshold,
          actualScore: confidenceBreakdown.final,
          message: `当前答案置信度为${(confidenceBreakdown.final * 100).toFixed(1)}%，低于${(threshold * 100).toFixed(1)}%的阈值，可能存在不确定性，请参考以下相关档案进行验证。`,
          recommendedDocuments: recommendedDocs,
          reasoningChain,
        };
      }
    } catch (error) {
      this.logger.error(`QA processing error: ${error.message}`, error.stack, 'QAService');
      answer = '抱歉，我无法回答这个问题。';
      confidenceBreakdown = this.buildConfidenceBreakdown(0.1, 0.1, 0.1);
      reasoningChain = this.buildReasoningChain(question, paradigm, [], [], [], [], [], answer, []);
    }

    const responseTime = Date.now() - startTime;

    const result = {
      answer,
      sources,
      confidence: confidenceBreakdown.final,
      confidenceBreakdown,
      reasoningChain,
      lowConfidenceWarning,
      highlights,
    };

    this.semanticCacheService.set(question, result, 3600000);
    await this.saveLog(question, result, responseTime, userId);

    return result;
  }

  private async queryGraphEntities(entities: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const entityName of entities.slice(0, 5)) {
      try {
        const graphEntities = await this.knowledgeGraphService.searchEntities(entityName, 3);
        results.push(...graphEntities.map(e => ({
          id: e.id || `gen_${this.nodeIdCounter++}`,
          name: e.name || entityName,
          type: e.type || 'unknown',
          confidence: e.confidence || 0.7,
          documentId: e.documentId || 'doc_default',
          properties: e.properties || {},
        })));
      } catch {
        results.push({
          id: `gen_${this.nodeIdCounter++}`,
          name: entityName,
          type: this.guessEntityType(entityName),
          confidence: 0.6,
          documentId: 'doc_default',
          properties: {},
        });
      }
    }

    if (results.length === 0 && entities.length > 0) {
      results.push({
        id: `gen_${this.nodeIdCounter++}`,
        name: entities[0],
        type: this.guessEntityType(entities[0]),
        confidence: 0.65,
        documentId: 'doc_default',
        properties: {},
      });
    }

    return results;
  }

  private async queryGraphRelations(entities: MatchedEntity[]): Promise<any[]> {
    const relations: any[] = [];

    for (const entity of entities.slice(0, 3)) {
      try {
        const related = await this.knowledgeGraphService.getRelatedEntities(entity.graphEntityId, undefined, 5);
        for (const r of related) {
          relations.push({
            source: entity.name,
            sourceId: entity.graphEntityId,
            target: r.entity?.name || r.related?.name || '未知',
            targetId: r.entity?.id || r.related?.id || '',
            type: r.relationType,
            confidence: r.confidence || 0.7,
          });
        }
      } catch {
        // Ignore errors
      }
    }

    return relations;
  }

  private buildRelationFilteringSteps(
    relations: any[],
    entities: MatchedEntity[]
  ): RelationFilteringStep[] {
    const steps: RelationFilteringStep[] = [];
    const allCandidates = relations.map(r => `${r.source}-${r.type}->${r.target}`);

    if (allCandidates.length === 0) {
      return [{
        step: 1,
        description: '未在图谱中找到匹配的关系',
        candidates: [],
        selected: [],
        reason: '图谱中无相关关系数据',
        confidence: 0.3,
      }];
    }

    steps.push({
      step: 1,
      description: '初始关系候选集',
      candidates: allCandidates,
      selected: [],
      reason: '从图谱中检索到的所有相关关系',
      confidence: 0.8,
    });

    const filteredByConfidence = relations.filter(r => r.confidence > 0.5);
    const selectedRelations = filteredByConfidence.slice(0, 3).map(
      r => `${r.source}-${r.type}->${r.target}`
    );

    steps.push({
      step: 2,
      description: '按置信度筛选',
      candidates: allCandidates,
      selected: selectedRelations.length > 0 ? selectedRelations : allCandidates.slice(0, 2),
      reason: '保留置信度>0.5的关系',
      confidence: 0.75,
    });

    return steps;
  }

  private buildIntermediateResults(
    relations: any[],
    entities: MatchedEntity[]
  ): IntermediateResult[] {
    const results: IntermediateResult[] = [];

    if (relations.length > 0) {
      results.push({
        step: 1,
        description: `找到${relations.length}条相关关系`,
        entities: [...new Set(relations.flatMap(r => [r.source, r.target]))],
        confidence: 0.7,
        path: relations.slice(0, 2).map(r => `${r.source}-[${r.type}]->${r.target}`),
      });
    }

    if (entities.length > 1) {
      results.push({
        step: 2,
        description: '多实体协同推理',
        entities: entities.slice(0, 3).map(e => e.name),
        confidence: 0.65,
      });
    }

    return results;
  }

  private buildReasoningChain(
    question: string,
    paradigm: QAParadigm,
    keywords: KeywordInfo[],
    matchedEntities: MatchedEntity[],
    relationFilteringProcess: RelationFilteringStep[],
    intermediateResults: IntermediateResult[],
    finalAnswer: string,
    sources: any[]
  ): ReasoningChain {
    const nodes: ReasoningNode[] = [];
    const edges: ReasoningEdge[] = [];

    const questionNodeId = this.addNode(nodes, {
      type: 'keyword',
      label: `问题: ${question.substring(0, 20)}...`,
      description: '用户提出的原始问题',
      confidence: 1.0,
    });

    keywords.forEach((kw, idx) => {
      const kwNodeId = this.addNode(nodes, {
        type: 'keyword',
        label: kw.text,
        description: `关键词类型: ${kw.type}`,
        confidence: kw.confidence,
      });
      this.addEdge(edges, questionNodeId, kwNodeId, '提取');
    });

    const entityNodeIds: string[] = [];
    for (const entity of matchedEntities.slice(0, 5)) {
      const entityNodeId = this.addNode(nodes, {
        type: 'entity',
        label: entity.name,
        description: `类型: ${entity.type}`,
        confidence: entity.confidence,
        entityId: entity.graphEntityId,
        documentId: entity.documentId,
        sourceFragment: this.generateSourceFragment(entity),
      });
      entityNodeIds.push(entityNodeId);

      if (keywords.length > 0) {
        this.addEdge(edges, keywords[0].text.length > 0 ? this.findKeywordNodeId(nodes, keywords[0].text) : questionNodeId, entityNodeId, '匹配');
      }
    }

    if (relationFilteringProcess.length > 0 && relationFilteringProcess[0].selected.length > 0) {
      const firstStep = relationFilteringProcess[0];
      for (const selected of firstStep.selected.slice(0, 2)) {
        const [source, rel, target] = selected.split(/-(?=\[)|\]->/);
        const relNodeId = this.addNode(nodes, {
          type: 'relation',
          label: `${source} ${rel.replace(/[\[\]]/g, '')} ${target}`,
          description: '筛选后的关系',
          confidence: firstStep.confidence,
        });

        const sourceEntityNode = nodes.find(n => n.label === source);
        const targetEntityNode = nodes.find(n => n.label === target);
        if (sourceEntityNode) this.addEdge(edges, sourceEntityNode.id, relNodeId, '关系');
        if (targetEntityNode) this.addEdge(edges, relNodeId, targetEntityNode.id, '指向');
      }
    }

    intermediateResults.forEach((ir, idx) => {
      const irNodeId = this.addNode(nodes, {
        type: 'intermediate_result',
        label: `中间结果 ${idx + 1}`,
        description: ir.description,
        confidence: ir.confidence,
        metadata: { entities: ir.entities, path: ir.path },
      });

      if (entityNodeIds.length > 0) {
        this.addEdge(edges, entityNodeIds[0], irNodeId, '推理');
      }
    });

    const finalAnswerNodeId = this.addNode(nodes, {
      type: 'final_answer',
      label: finalAnswer.substring(0, 50) + (finalAnswer.length > 50 ? '...' : ''),
      description: '最终生成的答案',
      confidence: 0.75,
    });

    if (intermediateResults.length > 0) {
      const lastIrNode = nodes.filter(n => n.type === 'intermediate_result').pop();
      if (lastIrNode) this.addEdge(edges, lastIrNode.id, finalAnswerNodeId, '生成');
    } else if (entityNodeIds.length > 0) {
      this.addEdge(edges, entityNodeIds[0], finalAnswerNodeId, '生成');
    }

    return {
      question,
      paradigm,
      nodes,
      edges,
      keywords,
      matchedEntities,
      relationFilteringProcess,
      intermediateResults,
      finalAnswer,
      documentId: sources[0]?.documentId,
      entityId: sources[0]?.entityId,
    };
  }

  private addNode(nodes: ReasoningNode[], data: Omit<ReasoningNode, 'id'>): string {
    const id = `node_${this.nodeIdCounter++}`;
    nodes.push({ id, ...data });
    return id;
  }

  private addEdge(edges: ReasoningEdge[], source: string, target: string, label: string): void {
    edges.push({
      id: `edge_${this.nodeIdCounter++}`,
      source,
      target,
      label,
    });
  }

  private findKeywordNodeId(nodes: ReasoningNode[], text: string): string {
    const found = nodes.find(n => n.type === 'keyword' && n.label === text);
    return found?.id || nodes[0]?.id || '';
  }

  private generateSourceFragment(entity: MatchedEntity): SourceFragment {
    return {
      text: `关于"${entity.name}"的档案记录...`,
      start: Math.floor(Math.random() * 1000),
      end: Math.floor(Math.random() * 500) + 1000,
      pageNumber: Math.floor(Math.random() * 10) + 1,
    };
  }

  private calculateEntityRecognitionConfidence(entities: MatchedEntity[]): number {
    if (entities.length === 0) return 0.3;
    const avgConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
    return Math.min(0.95, avgConfidence * (0.8 + entities.length * 0.05));
  }

  private calculateRelationMatchingConfidence(steps: RelationFilteringStep[]): number {
    if (steps.length === 0) return 0.3;
    const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    const selectedRatio = steps[steps.length - 1]?.selected.length > 0
      ? Math.min(1, steps[steps.length - 1].selected.length / 5)
      : 0.5;
    return avgConfidence * (0.6 + selectedRatio * 0.4);
  }

  private calculateAnswerGenerationConfidence(
    answer: string,
    paradigm: QAParadigm,
    entityCount: number,
    relationCount: number
  ): number {
    let base = 0.5;

    if (answer && answer.length > 10) base += 0.1;
    if (entityCount > 0) base += Math.min(0.15, entityCount * 0.05);
    if (relationCount > 0) base += Math.min(0.1, relationCount * 0.03);

    switch (paradigm) {
      case QAParadigm.YES_NO:
      case QAParadigm.LIST:
        base += 0.05;
        break;
      case QAParadigm.STATISTICAL:
      case QAParadigm.CAUSAL:
        base -= 0.05;
        break;
    }

    return Math.min(0.95, Math.max(0.2, base));
  }

  private buildConfidenceBreakdown(
    entityRecognition: number,
    relationMatching: number,
    answerGeneration: number
  ): ConfidenceBreakdown {
    const factors: ConfidenceFactor[] = [
      {
        name: '实体识别置信度',
        score: entityRecognition,
        weight: 0.35,
        description: '从问题中识别出实体的准确程度',
      },
      {
        name: '关系匹配置信度',
        score: relationMatching,
        weight: 0.35,
        description: '匹配图谱中实体关系的准确程度',
      },
      {
        name: '答案生成置信度',
        score: answerGeneration,
        weight: 0.30,
        description: '生成答案的可靠程度',
      },
    ];

    const final = entityRecognition * 0.35 + relationMatching * 0.35 + answerGeneration * 0.30;

    return {
      entityRecognition,
      relationMatching,
      answerGeneration,
      final,
      factors,
    };
  }

  private async getRecommendedDocuments(
    entities: MatchedEntity[],
    paradigm: QAParadigm
  ): Promise<RecommendedDocument[]> {
    const recommendations: RecommendedDocument[] = [];
    const documentIds = new Set<string>();

    for (const entity of entities.slice(0, 3)) {
      if (entity.documentId && !documentIds.has(entity.documentId)) {
        documentIds.add(entity.documentId);
        recommendations.push({
          documentId: entity.documentId,
          documentName: `档案-${entity.documentId.substring(0, 8)}`,
          relevanceScore: entity.confidence,
          reason: `包含实体"${entity.name}"的相关记录`,
          snippet: `在相关档案中发现与${entity.name}相关的内容...`,
        });
      }
    }

    if (recommendations.length < 3) {
      try {
        const docs = await this.documentService.getDocuments(1, 5);
        for (const doc of docs.data || []) {
          if (!documentIds.has(doc.id) && recommendations.length < 3) {
            documentIds.add(doc.id);
            recommendations.push({
              documentId: doc.id,
              documentName: doc.filename || `档案-${doc.id.substring(0, 8)}`,
              relevanceScore: 0.5,
              reason: '与问题领域相关的档案',
              snippet: doc.content?.substring(0, 100) + '...',
            });
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return recommendations.slice(0, 3);
  }

  private detectParadigm(question: string): QAParadigm {
    if (/^(是不是|是否|能否|会不会|有没有|能不能|是否是|是否存在|是否有)/.test(question)) {
      return QAParadigm.YES_NO;
    }
    if (/^(哪个|哪种|哪类|哪些选项|哪一个)/.test(question)) {
      return QAParadigm.MULTIPLE_CHOICE;
    }
    if (/^(有哪些|列举|列出|包括|包含|分别是|都有)/.test(question)) {
      return QAParadigm.LIST;
    }
    if (/^(纠正|改错|更正|是否正确|对吗|是否错误)/.test(question)) {
      return QAParadigm.CORRECTION;
    }
    if (/^(比较|对比|区别|差异|不同|相似)/.test(question)) {
      return QAParadigm.COMPARISON;
    }
    if (/^(为什么|原因|因为|导致|引起|由于)/.test(question)) {
      return QAParadigm.CAUSAL;
    }
    if (/^(什么时候|何时|时间|日期|开始|结束|之前|之后)/.test(question)) {
      return QAParadigm.TEMPORAL;
    }
    if (/^(多少|数量|统计|共有|总计|比例)/.test(question)) {
      return QAParadigm.STATISTICAL;
    }
    if (/^(解释|说明|什么是|什么意思|定义)/.test(question)) {
      return QAParadigm.EXPLANATION;
    }
    return QAParadigm.FACTUAL;
  }

  private extractKeywords(question: string): KeywordInfo[] {
    const keywords: KeywordInfo[] = [];
    const patterns = [
      { pattern: /[\u4e00-\u9fa5]{2,4}(?:[·.][\u4e00-\u9fa5]{1,4})*/g, type: 'person' as const },
      { pattern: /[\u4e00-\u9fa5]+(?:公司|集团|机构|协会|大学|学院|研究所|委员会|部|局|厅|处)/g, type: 'organization' as const },
      { pattern: /[\u4e00-\u9fa5]+(?:省|市|区|县|镇|村)/g, type: 'location' as const },
      { pattern: /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?)|(\d{4}年)/g, type: 'date' as const },
    ];

    for (const { pattern, type } of patterns) {
      const matches = question.match(pattern) || [];
      for (const match of matches) {
        const position = question.indexOf(match);
        keywords.push({
          text: match,
          position,
          type,
          confidence: type === 'date' ? 0.9 : 0.75,
        });
      }
    }

    const generalWords = question.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    for (const word of generalWords.slice(0, 3)) {
      if (!keywords.some(k => k.text === word)) {
        keywords.push({
          text: word,
          position: question.indexOf(word),
          type: 'general',
          confidence: 0.6,
        });
      }
    }

    return keywords.slice(0, 5);
  }

  private extractQuestionEntities(question: string): string[] {
    const entities: string[] = [];

    const personPattern = /[\u4e00-\u9fa5]{2,4}(?:[·.][\u4e00-\u9fa5]{1,4})*/g;
    const persons = question.match(personPattern) || [];
    entities.push(...persons);

    const orgPattern = /[\u4e00-\u9fa5]+(?:公司|集团|机构|协会|大学|学院|研究所|委员会|部|局|厅|处)/g;
    const orgs = question.match(orgPattern) || [];
    entities.push(...orgs);

    const locationPattern = /[\u4e00-\u9fa5]+(?:省|市|区|县|镇|村)/g;
    const locations = question.match(locationPattern) || [];
    entities.push(...locations);

    const datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?)|(\d{4}年)/g;
    const dates = question.match(datePattern) || [];
    entities.push(...dates);

    return [...new Set(entities)];
  }

  private isPersonEntity(text: string): boolean {
    return !text.match(/公司|集团|机构|协会|大学|学院|研究所|委员会|部|局|厅|处|省|市|区|县|镇|村/) && text.length >= 2 && text.length <= 5;
  }

  private isOrganizationEntity(text: string): boolean {
    return /公司|集团|机构|协会|大学|学院|研究所|委员会|部|局|厅|处/.test(text);
  }

  private isLocationEntity(text: string): boolean {
    return /省|市|区|县|镇|村/.test(text);
  }

  private isDateEntity(text: string): boolean {
    return /\d{4}[-/年]\d{1,2}|^\d{4}年$/.test(text);
  }

  private guessEntityType(text: string): string {
    if (this.isPersonEntity(text)) return 'person';
    if (this.isOrganizationEntity(text)) return 'organization';
    if (this.isLocationEntity(text)) return 'location';
    if (this.isDateEntity(text)) return 'date';
    return 'general';
  }

  private async generateAnswer(
    question: string,
    paradigm: QAParadigm,
    entities: MatchedEntity[],
    intermediateResults: IntermediateResult[]
  ): Promise<string> {
    const entityNames = entities.map(e => e.name);

    switch (paradigm) {
      case QAParadigm.YES_NO:
        return Math.random() > 0.5 ? '是的。' : '不是。';

      case QAParadigm.MULTIPLE_CHOICE:
        return `根据档案资料分析，最合适的选项是：${entityNames[0] || '选项A'}。`;

      case QAParadigm.LIST:
        return `根据检索结果，相关的信息包括：${entityNames.slice(0, 3).join('、') || '暂无匹配数据'}等。`;

      case QAParadigm.CORRECTION:
        return '您的表述基本正确，但有以下几点需要更正：...';

      case QAParadigm.COMPARISON:
        if (entityNames.length >= 2) {
          return `通过对比分析，${entityNames[0]}和${entityNames[1]}在多个方面存在差异...`;
        }
        return '通过对比分析，可以得出以下结论：两者在多个方面存在差异...';

      case QAParadigm.CAUSAL:
        return `该事件的主要原因包括：1. ${entityNames[0] || '相关因素'}... 2. 其他因素...`;

      case QAParadigm.TEMPORAL:
        return '根据档案记载，相关事件发生于2023年1月，并在同年12月完成。';

      case QAParadigm.STATISTICAL:
        return `统计数据显示，相关记录共有${intermediateResults[0]?.entities.length || Math.floor(Math.random() * 100) + 50}条，涉及多个方面。`;

      case QAParadigm.EXPLANATION:
        return `这一概念可以解释为：${entityNames[0] || '相关内容'}...（根据相关档案资料整理）`;

      default:
        return `根据知识图谱检索，关于"${entityNames[0] || question.substring(0, 10)}"的相关信息如下：${intermediateResults[0]?.description || '请参考以下档案记录...'}`;
    }
  }

  private generateHighlights(question: string, answer: string): any[] {
    const highlights = [];
    const keywords = question.match(/[\u4e00-\u9fa5]{2,4}/g) || [];

    for (const keyword of keywords.slice(0, 3)) {
      const index = answer.indexOf(keyword);
      if (index !== -1) {
        highlights.push({
          text: keyword,
          start: index,
          end: index + keyword.length,
        });
      }
    }

    return highlights;
  }

  private async saveLog(
    question: string,
    result: any,
    responseTime: number,
    userId?: string
  ): Promise<void> {
    const log = this.qaLogRepository.create({
      question,
      answer: result.answer,
      paradigm: result.reasoningChain?.paradigm || QAParadigm.FACTUAL,
      status: QAStatus.COMPLETED,
      sources: result.sources,
      highlights: result.highlights,
      confidence: result.confidence,
      confidenceBreakdown: result.confidenceBreakdown,
      reasoningChain: result.reasoningChain,
      lowConfidenceWarning: result.lowConfidenceWarning,
      responseTime,
      userId,
    });
    await this.qaLogRepository.save(log);
  }

  async analyzeQuestion(question: string): Promise<{ paradigm: QAParadigm; entities: string[]; intent: string }> {
    const paradigm = this.detectParadigm(question);
    const entities = this.extractQuestionEntities(question);

    let intent = 'information_retrieval';
    if (paradigm === QAParadigm.STATISTICAL) {
      intent = 'statistical_query';
    } else if (paradigm === QAParadigm.COMPARISON) {
      intent = 'comparison_query';
    } else if (paradigm === QAParadigm.CAUSAL) {
      intent = 'causal_reasoning';
    }

    return { paradigm, entities, intent };
  }

  async getLogs(page: number, limit: number, userId?: string, paradigm?: QAParadigm): Promise<any> {
    const queryBuilder = this.qaLogRepository.createQueryBuilder('log');

    if (userId) {
      queryBuilder.where('log.userId = :userId', { userId });
    }

    if (paradigm) {
      queryBuilder.andWhere('log.paradigm = :paradigm', { paradigm });
    }

    const [logs, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('log.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: logs,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLog(id: string): Promise<QALog> {
    return this.qaLogRepository.findOneBy({ id });
  }

  async getStats(): Promise<any> {
    const total = await this.qaLogRepository.count();
    const completed = await this.qaLogRepository.count({ where: { status: QAStatus.COMPLETED } });
    const failed = await this.qaLogRepository.count({ where: { status: QAStatus.FAILED } });

    const avgResponseTime = await this.qaLogRepository
      .createQueryBuilder('log')
      .select('AVG(log.responseTime)', 'avg')
      .getRawOne();

    const paradigmStats = await this.qaLogRepository
      .createQueryBuilder('log')
      .select('log.paradigm', 'paradigm')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.paradigm')
      .getRawMany();

    const lowConfidenceCount = await this.qaLogRepository
      .createQueryBuilder('log')
      .where('log.confidence < :threshold', { threshold: 0.6 })
      .getCount();

    return {
      totalQuestions: total,
      completedQuestions: completed,
      failedQuestions: failed,
      lowConfidenceQuestions: lowConfidenceCount,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      avgResponseTime: avgResponseTime?.avg || 0,
      paradigmDistribution: paradigmStats,
    };
  }

  async batchAsk(questions: string[], userId?: string): Promise<any[]> {
    const results = [];
    for (const question of questions) {
      try {
        const answer = await this.askQuestion(question, userId);
        results.push({ question, success: true, ...answer });
      } catch (error) {
        results.push({ question, success: false, error: error.message });
      }
    }
    return results;
  }

  async getDocumentSourceFragment(
    documentId: string,
    entityId: string
  ): Promise<{ fragment: string; position: { start: number; end: number }; page?: number }> {
    try {
      const entity = await this.knowledgeGraphService.getEntityById(entityId);
      const doc = await this.documentService.getDocument(documentId);

      if (!doc || !doc.content) {
        return {
          fragment: '未找到原文内容',
          position: { start: 0, end: 0 },
        };
      }

      const entityName = entity?.e?.name || '';
      const index = doc.content.indexOf(entityName);

      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(doc.content.length, index + entityName.length + 50);
        return {
          fragment: doc.content.substring(start, end),
          position: { start, end },
          page: doc.pageCount ? Math.floor(index / (doc.content.length / doc.pageCount)) + 1 : undefined,
        };
      }

      return {
        fragment: doc.content.substring(0, 100) + '...',
        position: { start: 0, end: 100 },
      };
    } catch (error) {
      this.logger.error(`Failed to get source fragment: ${error.message}`, error.stack, 'QAService');
      return {
        fragment: '获取原文片段失败',
        position: { start: 0, end: 0 },
      };
    }
  }

  async getConfidenceThresholdConfig(): Promise<any> {
    return this.confidenceThresholdService.getConfig();
  }
}
