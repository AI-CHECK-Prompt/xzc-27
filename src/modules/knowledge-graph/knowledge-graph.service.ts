import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../../common/neo4j/neo4j.service';
import { EntityExtractionService } from '../entity-extraction/entity-extraction.service';
import { LoggerService } from '../../common/logger/logger.service';
import { ExtractedEntity } from '../entity-extraction/entities/extracted-entity.entity';
import { ExtractedRelation } from '../entity-extraction/entities/extracted-relation.entity';
import { DocumentService } from '../document/document.service';

@Injectable()
export class KnowledgeGraphService {
  constructor(
    private neo4jService: Neo4jService,
    private entityExtractionService: EntityExtractionService,
    private documentService: DocumentService,
    private logger: LoggerService,
  ) {}

  async buildGraph(documentIds?: string[]): Promise<{ entitiesCreated: number; relationsCreated: number; mergedEntities: number }> {
    let entitiesCreated = 0;
    let relationsCreated = 0;
    let mergedEntities = 0;

    // If no documentIds provided, process all completed documents
    if (!documentIds || documentIds.length === 0) {
      // Get all completed documents from document service
      documentIds = await this.documentService.getAllCompletedDocumentIds();
      this.logger.log(`No documentIds provided, processing all ${documentIds.length} completed documents`, 'KnowledgeGraphService');
    }

    // 预构建实体名称到图中节点ID的映射（用于实体消歧）
    const entityNameToGraphId = await this.buildEntityNameMapping();

    for (const documentId of documentIds) {
      try {
        // Extract entities and relations if not already extracted
        const { entities, relations } = await this.entityExtractionService.extractEntitiesAndRelations(documentId);
        
        // 创建实体映射（提取的实体ID -> 图中节点ID）
        const entityIdMapping: Record<string, string> = {};
        
        // Create entities in Neo4j with entity resolution
        for (const entity of entities) {
          const graphEntityId = await this.createEntityInGraph(entity, entityNameToGraphId);
          entityIdMapping[entity.id] = graphEntityId;
          
          if (entityNameToGraphId[`${entity.name}-${entity.type}`]) {
            mergedEntities++;
          } else {
            entitiesCreated++;
            entityNameToGraphId[`${entity.name}-${entity.type}`] = graphEntityId;
          }
        }

        // Create relations in Neo4j with resolved entity IDs
        for (const relation of relations) {
          const sourceGraphId = entityIdMapping[relation.sourceEntityId];
          const targetGraphId = entityIdMapping[relation.targetEntityId];
          
          if (sourceGraphId && targetGraphId) {
            await this.createRelationInGraph(relation, sourceGraphId, targetGraphId);
            relationsCreated++;
          }
        }

        this.logger.log(`Document ${documentId} synced to graph: ${entities.length} entities (${entitiesCreated} new, ${mergedEntities} merged), ${relations.length} relations`, 'KnowledgeGraphService');
      } catch (error) {
        this.logger.error(`Failed to sync document ${documentId} to graph`, error.stack, 'KnowledgeGraphService');
      }
    }

    return { entitiesCreated, relationsCreated, mergedEntities };
  }

  async syncDocumentToGraph(documentId: string): Promise<any> {
    const { entities, relations } = await this.entityExtractionService.extractEntitiesAndRelations(documentId);
    
    let entitiesCreated = 0;
    let relationsCreated = 0;
    let mergedEntities = 0;

    // 预构建实体名称到图中节点ID的映射（用于实体消歧）
    const entityNameToGraphId = await this.buildEntityNameMapping();
    const entityIdMapping: Record<string, string> = {};

    for (const entity of entities) {
      const graphEntityId = await this.createEntityInGraph(entity, entityNameToGraphId);
      entityIdMapping[entity.id] = graphEntityId;
      
      if (entityNameToGraphId[`${entity.name}-${entity.type}`]) {
        mergedEntities++;
      } else {
        entitiesCreated++;
        entityNameToGraphId[`${entity.name}-${entity.type}`] = graphEntityId;
      }
    }

    for (const relation of relations) {
      const sourceGraphId = entityIdMapping[relation.sourceEntityId];
      const targetGraphId = entityIdMapping[relation.targetEntityId];
      
      if (sourceGraphId && targetGraphId) {
        await this.createRelationInGraph(relation, sourceGraphId, targetGraphId);
        relationsCreated++;
      }
    }

    return { documentId, entitiesCreated, relationsCreated, mergedEntities };
  }

  /**
   * 构建实体名称到图中节点ID的映射（用于实体消歧）
   */
  async buildEntityNameMapping(): Promise<Record<string, string>> {
    const mapping: Record<string, string> = {};
    const cypher = 'MATCH (e:Entity) RETURN e.id, e.name, e.type';
    const records = await this.neo4jService.query(cypher, {});
    
    for (const record of records) {
      const id = record.get('e.id');
      const name = record.get('e.name');
      const type = record.get('e.type');
      const key = `${name}-${type}`;
      
      // 如果已有映射，保留最早的实体ID
      if (!mapping[key]) {
        mapping[key] = id;
      }
    }
    
    return mapping;
  }

  /**
   * 创建或合并实体到图谱（支持实体消歧）
   * @param entity 提取的实体
   * @param entityNameToGraphId 实体名称到图节点ID的映射
   * @returns 图中实体的ID
   */
  async createEntityInGraph(entity: ExtractedEntity, entityNameToGraphId?: Record<string, string>): Promise<string> {
    const entityKey = `${entity.name}-${entity.type}`;
    
    // 如果已存在同名同类型实体，合并到已有的图节点
    if (entityNameToGraphId && entityNameToGraphId[entityKey]) {
      const existingGraphId = entityNameToGraphId[entityKey];
      
      // 更新已有节点的文档引用信息
      const cypher = `
        MATCH (e:Entity {id: $existingId})
        SET e.confidence = CASE WHEN $newConfidence > e.confidence THEN $newConfidence ELSE e.confidence END,
            e.updatedAt = datetime()
        RETURN e.id
      `;
      
      const result = await this.neo4jService.executeWrite(cypher, {
        existingId: existingGraphId,
        newConfidence: entity.confidence,
      });
      
      return existingGraphId;
    }
    
    // 创建新节点
    const cypher = `
      MERGE (e:Entity {id: $id})
      ON CREATE SET e.name = $name, e.type = $type, e.properties = $properties, e.confidence = $confidence, e.documentId = $documentId, e.createdAt = datetime()
      ON MATCH SET e.name = $name, e.type = $type, e.properties = $properties, e.confidence = $confidence, e.updatedAt = datetime()
      RETURN e.id
    `;
    
    const result = await this.neo4jService.executeWrite(cypher, {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      properties: entity.properties || {},
      confidence: entity.confidence,
      documentId: entity.documentId,
    });
    
    return entity.id;
  }

  /**
   * 在图谱中创建关系（支持实体消歧后的实体ID）
   * @param relation 提取的关系
   * @param sourceGraphId 源实体在图中的ID（已消歧）
   * @param targetGraphId 目标实体在图中的ID（已消歧）
   */
  async createRelationInGraph(relation: ExtractedRelation, sourceGraphId?: string, targetGraphId?: string): Promise<void> {
    const relationType = relation.relationType.toUpperCase();
    const sourceId = sourceGraphId || relation.sourceEntityId;
    const targetId = targetGraphId || relation.targetEntityId;
    
    const cypher = `
      MATCH (source:Entity {id: $sourceId}), (target:Entity {id: $targetId})
      MERGE (source)-[r:${relationType}]->(target)
      ON CREATE SET r.confidence = $confidence, r.documentId = $documentId, r.context = $context, r.createdAt = datetime()
      ON MATCH SET r.confidence = $confidence, r.context = $context, r.updatedAt = datetime()
    `;
    
    await this.neo4jService.executeWrite(cypher, {
      sourceId,
      targetId,
      confidence: relation.confidence,
      documentId: relation.documentId,
      context: relation.context || {},
    });
  }

  async searchEntities(query: string, limit: number = 10): Promise<any[]> {
    return this.neo4jService.searchEntities(query, limit);
  }

  async getEntityById(entityId: string): Promise<any> {
    return this.neo4jService.getEntityById(entityId);
  }

  async getRelatedEntities(entityId: string, relationType?: string, limit: number = 10): Promise<any[]> {
    return this.neo4jService.getRelatedEntities(entityId, relationType, limit);
  }

  async executeCypherQuery(cypher: string): Promise<any> {
    const records = await this.neo4jService.query(cypher, {});
    return records.map((record) => record.toObject());
  }

  async clearGraph(): Promise<void> {
    const cypher = 'MATCH (n) DETACH DELETE n';
    await this.neo4jService.executeWrite(cypher);
    this.logger.log('Graph cleared successfully', 'KnowledgeGraphService');
  }

  async getGraphStats(): Promise<{ nodes: number; relationships: number; labels: string[] }> {
    const nodeCountResult = await this.neo4jService.query('MATCH (n) RETURN count(n) as count');
    const relCountResult = await this.neo4jService.query('MATCH ()-[r]->() RETURN count(r) as count');
    const labelsResult = await this.neo4jService.query('CALL db.labels() YIELD label RETURN label');

    return {
      nodes: nodeCountResult[0]?.get('count') || 0,
      relationships: relCountResult[0]?.get('count') || 0,
      labels: labelsResult.map((r) => r.get('label')),
    };
  }

  async getEntityNeighbors(entityId: string, depth: number = 2, limit: number = 20): Promise<any> {
    const cypher = `
      MATCH (e:Entity {id: $entityId})-[r*1..${depth}]-(related)
      RETURN e, collect(DISTINCT related) as neighbors, collect(DISTINCT type(r)) as relationTypes
      LIMIT $limit
    `;
    const records = await this.neo4jService.query(cypher, { entityId, limit });
    return records.map((record) => record.toObject());
  }

  async findPathBetweenEntities(fromId: string, toId: string, maxDepth: number = 4): Promise<any[]> {
    const cypher = `
      MATCH path = shortestPath((from:Entity {id: $fromId})-[*1..${maxDepth}]-(to:Entity {id: $toId}))
      RETURN path, nodes(path) as nodes, relationships(path) as relations
    `;
    const records = await this.neo4jService.query(cypher, { fromId, toId });
    return records.map((record) => record.toObject());
  }

  /**
   * 建立跨文档实体关联关系
   * 当同一实体在多个文档中出现时，建立文档之间的引用关系
   */
  async establishCrossDocumentRelations(): Promise<{ crossDocumentRelationsCreated: number }> {
    let crossDocumentRelationsCreated = 0;

    // 获取所有实体及其文档信息
    const cypher = `
      MATCH (e:Entity)
      RETURN e.name, e.type, COLLECT(DISTINCT e.documentId) as documentIds
      ORDER BY SIZE(documentIds) DESC
    `;
    const records = await this.neo4jService.query(cypher, {});

    for (const record of records) {
      const name = record.get('e.name');
      const type = record.get('e.type');
      const documentIds = record.get('documentIds');

      // 只处理跨多个文档的实体
      if (documentIds.length < 2) {
        continue;
      }

      // 为同一实体出现的所有文档对建立引用关系
      for (let i = 0; i < documentIds.length; i++) {
        for (let j = i + 1; j < documentIds.length; j++) {
          const doc1 = documentIds[i];
          const doc2 = documentIds[j];

          // 在图中查找或创建文档节点并建立引用关系
          const relationCypher = `
            MERGE (d1:Document {id: $doc1})
            MERGE (d2:Document {id: $doc2})
            MERGE (d1)-[r:CROSS_REFERENCES]->(d2)
            ON CREATE SET r.entityName = $entityName, r.entityType = $entityType, r.confidence = 0.9, r.createdAt = datetime()
            ON MATCH SET r.updatedAt = datetime()
          `;

          await this.neo4jService.executeWrite(relationCypher, {
            doc1,
            doc2,
            entityName: name,
            entityType: type,
          });

          crossDocumentRelationsCreated++;
        }
      }

      this.logger.log(`Entity "${name}" (${type}) appears in ${documentIds.length} documents, created ${documentIds.length * (documentIds.length - 1) / 2} cross-document relations`, 'KnowledgeGraphService');
    }

    return { crossDocumentRelationsCreated };
  }

  /**
   * 获取跨文档关联分析结果（支持跨档案全宗关联查询）
   * @param entityName 实体名称
   * @param entityType 实体类型（可选）
   */
  async getCrossArchiveRelations(entityName: string, entityType?: string): Promise<any[]> {
    let cypher = `
      MATCH (e:Entity {name: $entityName})
      OPTIONAL MATCH (e)-[r]->(related)
      OPTIONAL MATCH (doc:Document)-[:CROSS_REFERENCES]-(relatedDoc)
      WHERE doc.id = e.documentId
      RETURN e, COLLECT(DISTINCT related) as relatedEntities, COLLECT(DISTINCT doc) as sourceDocuments, COLLECT(DISTINCT relatedDoc) as referencedDocuments
    `;

    if (entityType) {
      cypher = `
        MATCH (e:Entity {name: $entityName, type: $entityType})
        OPTIONAL MATCH (e)-[r]->(related)
        OPTIONAL MATCH (doc:Document)-[:CROSS_REFERENCES]-(relatedDoc)
        WHERE doc.id = e.documentId
        RETURN e, COLLECT(DISTINCT related) as relatedEntities, COLLECT(DISTINCT doc) as sourceDocuments, COLLECT(DISTINCT relatedDoc) as referencedDocuments
      `;
    }

    const records = await this.neo4jService.query(cypher, { entityName, entityType });
    return records.map((record) => record.toObject());
  }

  /**
   * 同步跨文档关系到图谱（在构建图谱后调用）
   */
  async syncCrossDocumentRelations(documentIds?: string[]): Promise<any> {
    // 先构建图谱
    const buildResult = await this.buildGraph(documentIds);
    
    // 然后建立跨文档关系
    const crossDocResult = await this.establishCrossDocumentRelations();

    return {
      ...buildResult,
      ...crossDocResult,
    };
  }
}