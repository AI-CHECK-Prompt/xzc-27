import { Controller, Post, Get, Delete, Body, Query } from '@nestjs/common';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('知识图谱')
@Controller('graph')
export class KnowledgeGraphController {
  constructor(private readonly knowledgeGraphService: KnowledgeGraphService) {}

  @Post('build')
  @ApiOperation({ summary: '构建知识图谱' })
  @ApiResponse({ status: 200, description: '图谱构建成功' })
  async buildGraph(@Body() body: { documentIds?: string[] }) {
    return this.knowledgeGraphService.buildGraph(body.documentIds);
  }

  @Post('sync')
  @ApiOperation({ summary: '同步实体和关系到图谱' })
  @ApiResponse({ status: 200, description: '同步成功' })
  async syncToGraph(@Body() body: { documentId: string }) {
    return this.knowledgeGraphService.syncDocumentToGraph(body.documentId);
  }

  @Get('entities')
  @ApiOperation({ summary: '搜索图谱实体' })
  @ApiResponse({ status: 200, description: '搜索成功' })
  async searchEntities(@Query('query') query: string, @Query('limit') limit: number = 10) {
    return this.knowledgeGraphService.searchEntities(query, limit);
  }

  @Get('entity/:id')
  @ApiOperation({ summary: '获取实体详情及关联关系' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEntity(@Query('id') id: string) {
    return this.knowledgeGraphService.getEntityById(id);
  }

  @Get('related')
  @ApiOperation({ summary: '获取关联实体' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRelatedEntities(
    @Query('entityId') entityId: string,
    @Query('relationType') relationType?: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.knowledgeGraphService.getRelatedEntities(entityId, relationType, limit);
  }

  @Get('query')
  @ApiOperation({ summary: '执行图谱查询' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async executeQuery(@Query('cypher') cypher: string) {
    return this.knowledgeGraphService.executeCypherQuery(cypher);
  }

  @Delete('clear')
  @ApiOperation({ summary: '清空图谱' })
  @ApiResponse({ status: 200, description: '清空成功' })
  async clearGraph() {
    return this.knowledgeGraphService.clearGraph();
  }

  @Get('stats')
  @ApiOperation({ summary: '获取图谱统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStats() {
    return this.knowledgeGraphService.getGraphStats();
  }

  @Get('neighbors')
  @ApiOperation({ summary: '获取实体邻居' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getNeighbors(
    @Query('entityId') entityId: string,
    @Query('depth') depth: number = 2,
    @Query('limit') limit: number = 20,
  ) {
    return this.knowledgeGraphService.getEntityNeighbors(entityId, depth, limit);
  }

  @Get('path')
  @ApiOperation({ summary: '查找两个实体间的路径' })
  @ApiResponse({ status: 200, description: '查找成功' })
  async findPath(@Query('fromId') fromId: string, @Query('toId') toId: string, @Query('maxDepth') maxDepth: number = 4) {
    return this.knowledgeGraphService.findPathBetweenEntities(fromId, toId, maxDepth);
  }
}