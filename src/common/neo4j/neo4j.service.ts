import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import * as neo4j from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private driver: neo4j.Driver;

  constructor(private logger: LoggerService) {}

  async onModuleInit() {
    try {
      this.driver = neo4j.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'password',
        ),
        {
          maxConnectionPoolSize: 100,
          connectionTimeout: 30000,
        },
      );
      
      const serverInfo = await this.driver.getServerInfo();
      this.logger.log(`Connected to Neo4j: ${serverInfo.address}`, 'Neo4jService');
    } catch (error) {
      this.logger.error('Failed to connect to Neo4j', error.stack, 'Neo4jService');
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.driver) {
      await this.driver.close();
      this.logger.log('Disconnected from Neo4j', 'Neo4jService');
    }
  }

  async query(cypher: string, params: Record<string, any> = {}): Promise<neo4j.Record[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(cypher, params);
      return result.records;
    } catch (error) {
      this.logger.error(`Cypher query failed: ${error.message}`, error.stack, 'Neo4jService');
      throw error;
    } finally {
      await this.safeCloseSession(session);
    }
  }

  async executeWrite(cypher: string, params: Record<string, any> = {}): Promise<number> {
    const session = this.driver.session({ defaultAccessMode: neo4j.session.WRITE });
    try {
      const result = await session.run(cypher, params);
      return result.summary.counters.updates().nodesCreated +
             result.summary.counters.updates().nodesDeleted +
             result.summary.counters.updates().relationshipsCreated +
             result.summary.counters.updates().relationshipsDeleted;
    } catch (error) {
      this.logger.error(`Cypher write failed: ${error.message}`, error.stack, 'Neo4jService');
      throw error;
    } finally {
      await this.safeCloseSession(session);
    }
  }

  private async safeCloseSession(session: neo4j.Session): Promise<void> {
    if (!session) return;
    try {
      await session.close();
    } catch (error) {
      this.logger.warn(`Error closing Neo4j session: ${error.message}`, 'Neo4jService');
    }
    // Ensure session resources are released even if close() was interrupted
    try {
      await session.close();
    } catch {
      // Ignore secondary close errors
    }
  }

  async getEntityById(entityId: string): Promise<any> {
    const cypher = `
      MATCH (e:Entity {id: $entityId})
      OPTIONAL MATCH (e)-[r]->(related)
      RETURN e, collect({relation: type(r), target: related}) as relations
    `;
    const records = await this.query(cypher, { entityId });
    if (records.length === 0) return null;
    return records[0].toObject();
  }

  async createEntity(entity: any): Promise<string> {
    const cypher = `
      CREATE (e:Entity {
        id: $id,
        name: $name,
        type: $type,
        properties: $properties,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN e.id
    `;
    const records = await this.query(cypher, {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      properties: entity.properties || {},
    });
    return records[0]?.get('e.id') || entity.id;
  }

  async createRelationship(fromId: string, toId: string, relationType: string, properties?: Record<string, any>): Promise<void> {
    const cypher = `
      MATCH (from:Entity {id: $fromId}), (to:Entity {id: $toId})
      CREATE (from)-[r:${relationType.toUpperCase()} $props]->(to)
      RETURN r
    `;
    await this.executeWrite(cypher, {
      fromId,
      toId,
      props: properties ? { properties } : {},
    });
  }

  async searchEntities(query: string, limit: number = 10): Promise<any[]> {
    const cypher = `
      MATCH (e:Entity)
      WHERE e.name CONTAINS $query OR e.id CONTAINS $query
      RETURN e
      LIMIT $limit
    `;
    const records = await this.query(cypher, { query, limit });
    return records.map((record) => record.get('e').properties);
  }

  async getRelatedEntities(entityId: string, relationType?: string, limit: number = 10): Promise<any[]> {
    let cypher = `
      MATCH (e:Entity {id: $entityId})-[r]->(related)
    `;
    if (relationType) {
      cypher += `WHERE type(r) = $relationType `;
    }
    cypher += `RETURN related, type(r) as relationType LIMIT $limit`;
    
    const records = await this.query(cypher, { entityId, relationType, limit });
    return records.map((record) => ({
      entity: record.get('related').properties,
      relationType: record.get('relationType'),
    }));
  }
}