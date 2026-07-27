import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../../common/neo4j/neo4j.service';
import { EntityExtractionService } from '../entity-extraction/entity-extraction.service';
import { LoggerService } from '../../common/logger/logger.service';
import { ExtractedEntity } from '../entity-extraction/entities/extracted-entity.entity';
import { ExtractedRelation } from '../entity-extraction/entities/extracted-relation.entity';

@Injectable()
export class KnowledgeGraphService {
  constructor(
    private neo4jService: Neo4jService,
    private entityExtractionService: EntityExtractionService,
    private logger: LoggerService,
  ) {}

  async buildGraph(documentIds?: string[]): Promise<{ entitiesCreated: number; relationsCreated: number }> {
    let entitiesCreated = 0;
    let relationsCreated = 0;

    // If no documentIds provided, process all completed documents
    if (!documentIds || documentIds.length === 0) {
      // Get all documents (in a real system, this would query the document service)
      documentIds = [];
    }

    for (const documentId of documentIds) {
      try {
        // Extract entities and relations if not already extracted
        const { entities, relations } = await this.entityExtractionService.extractEntitiesAndRelations(documentId);
        
        // Create entities in Neo4j
        for (const entity of entities) {
          await this.createEntityInGraph(entity);
          entitiesCreated++;
        }

        // Create relations in Neo4j
        for (const relation of relations) {
          await this.createRelationInGraph(relation);
          relationsCreated++;
        }

        this.logger.log(`Document ${documentId} synced to graph: ${entities.length} entities, ${relations.length} relations`, 'KnowledgeGraphService');
      } catch (error) {
        this.logger.error(`Failed to sync document ${documentId} to graph`, error.stack, 'KnowledgeGraphService');
      }
    }

    return { entitiesCreated, relationsCreated };
  }

  async syncDocumentToGraph(documentId: string): Promise<any> {
    const { entities, relations } = await this.entityExtractionService.extractEntitiesAndRelations(documentId);
    
    let entitiesCreated = 0;
    let relationsCreated = 0;

    for (const entity of entities) {
      await this.createEntityInGraph(entity);
      entitiesCreated++;
    }

    for (const relation of relations) {
      await this.createRelationInGraph(relation);
      relationsCreated++;
    }

    return { documentId, entitiesCreated, relationsCreated };
  }

  async createEntityInGraph(entity: ExtractedEntity): Promise<void> {
    const cypher = `
      MERGE (e:Entity {id: $id})
      ON CREATE SET e.name = $name, e.type = $type, e.properties = $properties, e.confidence = $confidence, e.documentId = $documentId, e.createdAt = datetime()
      ON MATCH SET e.name = $name, e.type = $type, e.properties = $properties, e.confidence = $confidence, e.updatedAt = datetime()
    `;
    
    await this.neo4jService.executeWrite(cypher, {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      properties: entity.properties || {},
      confidence: entity.confidence,
      documentId: entity.documentId,
    });
  }

  async createRelationInGraph(relation: ExtractedRelation): Promise<void> {
    const relationType = relation.relationType.toUpperCase();
    const cypher = `
      MATCH (source:Entity {id: $sourceId}), (target:Entity {id: $targetId})
      MERGE (source)-[r:${relationType}]->(target)
      ON CREATE SET r.confidence = $confidence, r.documentId = $documentId, r.context = $context, r.createdAt = datetime()
      ON MATCH SET r.confidence = $confidence, r.context = $context, r.updatedAt = datetime()
    `;
    
    await this.neo4jService.executeWrite(cypher, {
      sourceId: relation.sourceEntityId,
      targetId: relation.targetEntityId,
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
}