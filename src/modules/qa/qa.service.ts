import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QALog, QAParadigm, QAStatus } from './entities/qa-log.entity';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { SemanticCacheService } from '../../common/cache/semantic-cache.service';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class QAService {
  constructor(
    @InjectRepository(QALog)
    private qaLogRepository: Repository<QALog>,
    private knowledgeGraphService: KnowledgeGraphService,
    private semanticCacheService: SemanticCacheService,
    private logger: LoggerService,
  ) {}

  async askQuestion(question: string, userId?: string): Promise<{ answer: string; sources: any[]; confidence: number; highlights: any[] }> {
    const startTime = Date.now();

    // Check semantic cache first (supports semantic similarity matching)
    const cachedAnswer = this.semanticCacheService.get(question);
    if (cachedAnswer) {
      const responseTime = Date.now() - startTime;
      await this.saveLog(question, cachedAnswer.answer, QAParadigm.FACTUAL, cachedAnswer.sources, cachedAnswer.highlights, cachedAnswer.confidence, responseTime, userId);
      return cachedAnswer;
    }

    // Analyze question paradigm
    const paradigm = this.detectParadigm(question);
    
    // Extract entities from question
    const entities = this.extractQuestionEntities(question);
    
    // Query knowledge graph
    let answer = '';
    let sources = [];
    let highlights = [];
    let confidence = 0.7;

    try {
      // Based on paradigm, generate appropriate answer
      answer = await this.generateAnswer(question, paradigm, entities);
      
      // Get sources from graph
      sources = await this.getSources(entities);
      
      // Generate highlights
      highlights = this.generateHighlights(question, answer);
      
      confidence = 0.6 + Math.random() * 0.35;
    } catch (error) {
      this.logger.error(`QA processing error: ${error.message}`, error.stack, 'QAService');
      answer = '抱歉，我无法回答这个问题。';
      confidence = 0.1;
    }

    const responseTime = Date.now() - startTime;

    // Cache the answer for 1 hour (using semantic cache for similarity-based matching)
    this.semanticCacheService.set(question, { answer, sources, highlights, confidence }, 3600000);

    // Save log
    await this.saveLog(question, answer, paradigm, sources, highlights, confidence, responseTime, userId);

    return { answer, sources, confidence, highlights };
  }

  private detectParadigm(question: string): QAParadigm {
    // YES/NO questions
    if (/^(是不是|是否|能否|会不会|有没有|能不能|是否是|是否存在|是否有)/.test(question)) {
      return QAParadigm.YES_NO;
    }

    // Multiple choice questions
    if (/^(哪个|哪种|哪类|哪些选项|哪一个)/.test(question)) {
      return QAParadigm.MULTIPLE_CHOICE;
    }

    // List questions
    if (/^(有哪些|列举|列出|包括|包含|分别是|都有)/.test(question)) {
      return QAParadigm.LIST;
    }

    // Correction questions
    if (/^(纠正|改错|更正|是否正确|对吗|是否错误)/.test(question)) {
      return QAParadigm.CORRECTION;
    }

    // Comparison questions
    if (/^(比较|对比|区别|差异|不同|相似)/.test(question)) {
      return QAParadigm.COMPARISON;
    }

    // Causal questions
    if (/^(为什么|原因|因为|导致|引起|由于)/.test(question)) {
      return QAParadigm.CAUSAL;
    }

    // Temporal questions
    if (/^(什么时候|何时|时间|日期|开始|结束|之前|之后)/.test(question)) {
      return QAParadigm.TEMPORAL;
    }

    // Statistical questions
    if (/^(多少|数量|统计|共有|总计|比例)/.test(question)) {
      return QAParadigm.STATISTICAL;
    }

    // Explanation questions
    if (/^(解释|说明|什么是|什么意思|定义)/.test(question)) {
      return QAParadigm.EXPLANATION;
    }

    return QAParadigm.FACTUAL;
  }

  private extractQuestionEntities(question: string): string[] {
    const entities: string[] = [];
    
    // Extract person names
    const personPattern = /[\u4e00-\u9fa5]{2,4}(?:[·.][\u4e00-\u9fa5]{1,4})*/g;
    const persons = question.match(personPattern) || [];
    entities.push(...persons);

    // Extract organizations
    const orgPattern = /[\u4e00-\u9fa5]+(?:公司|集团|机构|协会|大学|学院|研究所|委员会|部|局|厅|处)/g;
    const orgs = question.match(orgPattern) || [];
    entities.push(...orgs);

    // Extract locations
    const locationPattern = /[\u4e00-\u9fa5]+(?:省|市|区|县|镇|村)/g;
    const locations = question.match(locationPattern) || [];
    entities.push(...locations);

    // Extract dates
    const datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?)|(\d{4}年)/g;
    const dates = question.match(datePattern) || [];
    entities.push(...dates);

    return [...new Set(entities)];
  }

  private async generateAnswer(question: string, paradigm: QAParadigm, entities: string[]): Promise<string> {
    // Simulated answer generation based on paradigm
    switch (paradigm) {
      case QAParadigm.YES_NO:
        return Math.random() > 0.5 ? '是的。' : '不是。';
      
      case QAParadigm.MULTIPLE_CHOICE:
        return '根据档案资料，最合适的选项是：选项A。';
      
      case QAParadigm.LIST:
        return `根据检索结果，相关的实体包括：${entities.slice(0, 3).join('、')}等。`;
      
      case QAParadigm.CORRECTION:
        return '您的表述基本正确，但有以下几点需要更正：...';
      
      case QAParadigm.COMPARISON:
        return '通过对比分析，可以得出以下结论：两者在多个方面存在差异...';
      
      case QAParadigm.CAUSAL:
        return '该事件的主要原因包括：1. ... 2. ... 3. ...';
      
      case QAParadigm.TEMPORAL:
        return '根据档案记载，该事件发生于2023年1月，并在同年12月完成。';
      
      case QAParadigm.STATISTICAL:
        return '统计数据显示，相关记录共有156条，涉及多个机构和个人。';
      
      case QAParadigm.EXPLANATION:
        return '这一概念可以解释为：...（根据相关档案资料整理）';
      
      default:
        return `根据知识图谱检索，关于"${entities[0] || question.substring(0, 10)}"的相关信息如下：...`;
    }
  }

  private async getSources(entities: string[]): Promise<any[]> {
    const sources = [];
    
    for (const entity of entities.slice(0, 3)) {
      try {
        const results = await this.knowledgeGraphService.searchEntities(entity, 3);
        sources.push(...results.map((r) => ({
          documentId: r.documentId,
          entityId: r.id,
          entityName: r.name,
          confidence: r.confidence,
        })));
      } catch {
        // Ignore errors
      }
    }

    // Add simulated sources
    if (sources.length === 0) {
      sources.push({
        documentId: 'doc_001',
        entityId: 'entity_001',
        entityName: '相关档案',
        confidence: 0.85,
      });
    }

    return sources;
  }

  private generateHighlights(question: string, answer: string): any[] {
    const highlights = [];
    
    // Find keywords in answer
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

  private async saveLog(question: string, answer: string, paradigm: QAParadigm, sources: any[], highlights: any[], confidence: number, responseTime: number, userId?: string): Promise<void> {
    const log = this.qaLogRepository.create({
      question,
      answer,
      paradigm,
      status: QAStatus.COMPLETED,
      sources,
      highlights,
      confidence,
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

    return {
      totalQuestions: total,
      completedQuestions: completed,
      failedQuestions: failed,
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
}