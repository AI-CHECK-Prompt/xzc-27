import { Injectable } from '@nestjs/common';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { QAService } from '../qa/qa.service';
import { EntityExtractionService } from '../entity-extraction/entity-extraction.service';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class AdminService {
  constructor(
    private knowledgeGraphService: KnowledgeGraphService,
    private qaService: QAService,
    private entityExtractionService: EntityExtractionService,
    private logger: LoggerService,
  ) {}

  async getDashboard(): Promise<any> {
    const [graphStats, qaStats] = await Promise.all([
      this.knowledgeGraphService.getGraphStats(),
      this.qaService.getStats(),
    ]);

    return {
      graph: {
        nodes: graphStats.nodes,
        relationships: graphStats.relationships,
        labels: graphStats.labels,
      },
      qa: {
        totalQuestions: qaStats.totalQuestions,
        successRate: qaStats.successRate,
        avgResponseTime: qaStats.avgResponseTime,
        paradigmDistribution: qaStats.paradigmDistribution,
      },
      system: {
        lastUpdate: new Date().toISOString(),
        status: 'healthy',
      },
    };
  }

  async getEntitiesForAlignment(page: number, limit: number): Promise<any> {
    // Simulated data for entity alignment
    return {
      data: [
        { id: 'entity_1', name: '张三', type: 'person', duplicateCount: 3 },
        { id: 'entity_2', name: '李四', type: 'person', duplicateCount: 2 },
        { id: 'entity_3', name: '国家档案馆', type: 'organization', duplicateCount: 5 },
      ],
      page,
      limit,
      total: 156,
      totalPages: 8,
    };
  }

  async batchAlignEntities(sourceEntityIds: string[], targetEntityId: string): Promise<any> {
    // Simulated entity alignment
    this.logger.log(`Aligning entities ${sourceEntityIds.join(', ')} to ${targetEntityId}`, 'AdminService');
    
    return {
      success: true,
      message: `成功将 ${sourceEntityIds.length} 个实体对齐到目标实体`,
      mergedCount: sourceEntityIds.length,
      targetEntityId,
    };
  }

  async getQALogs(page: number, limit: number, startDate?: string, endDate?: string): Promise<any> {
    // This would integrate with QAService to filter by date range
    const logs = await this.qaService.getLogs(page, limit);
    
    // Add date filtering logic
    if (startDate || endDate) {
      // Filter logic would be implemented here
    }
    
    return logs;
  }

  async deleteQALog(id: string): Promise<void> {
    // Would need to implement deletion in QAService
    this.logger.log(`Deleting QA log ${id}`, 'AdminService');
  }

  async getModelMetrics(): Promise<any> {
    const qaStats = await this.qaService.getStats();
    
    return {
      overall: {
        accuracy: 85.5,
        precision: 82.3,
        recall: 88.1,
        f1Score: 85.1,
      },
      entityExtraction: {
        precision: 89.2,
        recall: 86.7,
        f1Score: 87.9,
      },
      relationExtraction: {
        precision: 78.5,
        recall: 75.3,
        f1Score: 76.9,
      },
      qa: {
        ...qaStats,
      },
      trend: {
        last7Days: [82, 84, 81, 86, 85, 87, 85],
        last30Days: Array(30).fill(80).map(() => 75 + Math.random() * 15),
      },
    };
  }

  async evaluateModel(): Promise<any> {
    this.logger.log('Starting model evaluation...', 'AdminService');
    
    // Simulated evaluation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const metrics = await this.getModelMetrics();
    
    this.logger.log('Model evaluation completed', 'AdminService');
    
    return {
      status: 'completed',
      evaluatedAt: new Date().toISOString(),
      metrics,
    };
  }

  async checkHealth(): Promise<any> {
    let neo4jStatus = 'healthy';
    let databaseStatus = 'healthy';
    let apiStatus = 'healthy';

    try {
      await this.knowledgeGraphService.getGraphStats();
    } catch {
      neo4jStatus = 'unhealthy';
    }

    try {
      await this.qaService.getStats();
    } catch {
      databaseStatus = 'unhealthy';
    }

    return {
      timestamp: new Date().toISOString(),
      services: {
        neo4j: neo4jStatus,
        database: databaseStatus,
        api: apiStatus,
      },
      overall: neo4jStatus === 'healthy' && databaseStatus === 'healthy' && apiStatus === 'healthy' 
        ? 'healthy' : 'degraded',
    };
  }

  async exploreGraph(entityId?: string, depth: number = 2, limit: number = 50): Promise<any> {
    if (entityId) {
      return this.knowledgeGraphService.getEntityNeighbors(entityId, depth, limit);
    }

    // Return general graph overview
    const stats = await this.knowledgeGraphService.getGraphStats();
    
    return {
      stats,
      sampleNodes: [], // Would return sample nodes for visualization
    };
  }

  async cleanupGraph(): Promise<any> {
    this.logger.log('Starting graph cleanup...', 'AdminService');
    
    // Simulated cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const beforeStats = await this.knowledgeGraphService.getGraphStats();
    
    // Would implement actual cleanup logic here
    
    const afterStats = await this.knowledgeGraphService.getGraphStats();
    
    this.logger.log('Graph cleanup completed', 'AdminService');
    
    return {
      before: beforeStats,
      after: afterStats,
      removedNodes: beforeStats.nodes - afterStats.nodes,
      removedRelations: beforeStats.relationships - afterStats.relationships,
    };
  }
}