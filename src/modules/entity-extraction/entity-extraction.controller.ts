import { Controller, Post, Get, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { EntityExtractionService } from './entity-extraction.service';
import { ExtractedEntity, EntityType } from './entities/extracted-entity.entity';
import { ExtractedRelation, RelationType } from './entities/extracted-relation.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('实体关系抽取')
@Controller('entities')
export class EntityExtractionController {
  constructor(private readonly entityExtractionService: EntityExtractionService) {}

  @Post('extract')
  @ApiOperation({ summary: '从文档提取实体和关系' })
  @ApiResponse({ status: 200, description: '提取成功' })
  async extractFromDocument(@Body() body: { documentId: string }) {
    return this.entityExtractionService.extractEntitiesAndRelations(body.documentId);
  }

  @Get()
  @ApiOperation({ summary: '获取实体列表' })
  @ApiResponse({ status: 200, description: '实体列表获取成功' })
  async getEntities(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('type') type?: EntityType,
    @Query('documentId') documentId?: string,
    @Query('name') name?: string,
  ) {
    return this.entityExtractionService.getEntities(page, limit, type, documentId, name);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取实体详情' })
  @ApiResponse({ status: 200, description: '实体详情获取成功' })
  async getEntity(@Param('id') id: string) {
    return this.entityExtractionService.getEntity(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新实体' })
  @ApiResponse({ status: 200, description: '实体更新成功' })
  async updateEntity(@Param('id') id: string, @Body() body: Partial<ExtractedEntity>) {
    return this.entityExtractionService.updateEntity(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除实体' })
  @ApiResponse({ status: 200, description: '实体删除成功' })
  async deleteEntity(@Param('id') id: string) {
    return this.entityExtractionService.deleteEntity(id);
  }

  @Get('relations')
  @ApiOperation({ summary: '获取关系列表' })
  @ApiResponse({ status: 200, description: '关系列表获取成功' })
  async getRelations(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('type') type?: RelationType,
    @Query('documentId') documentId?: string,
    @Query('sourceEntityId') sourceEntityId?: string,
    @Query('targetEntityId') targetEntityId?: string,
  ) {
    return this.entityExtractionService.getRelations(page, limit, type, documentId, sourceEntityId, targetEntityId);
  }

  @Get('relations/:id')
  @ApiOperation({ summary: '获取关系详情' })
  @ApiResponse({ status: 200, description: '关系详情获取成功' })
  async getRelation(@Param('id') id: string) {
    return this.entityExtractionService.getRelation(id);
  }

  @Put('relations/:id')
  @ApiOperation({ summary: '更新关系' })
  @ApiResponse({ status: 200, description: '关系更新成功' })
  async updateRelation(@Param('id') id: string, @Body() body: Partial<ExtractedRelation>) {
    return this.entityExtractionService.updateRelation(id, body);
  }

  @Delete('relations/:id')
  @ApiOperation({ summary: '删除关系' })
  @ApiResponse({ status: 200, description: '关系删除成功' })
  async deleteRelation(@Param('id') id: string) {
    return this.entityExtractionService.deleteRelation(id);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量提取文档实体和关系' })
  @ApiResponse({ status: 200, description: '批量提取成功' })
  async batchExtract(@Body() body: { documentIds: string[] }) {
    return this.entityExtractionService.batchExtractEntitiesAndRelations(body.documentIds);
  }

  @Get('types')
  @ApiOperation({ summary: '获取实体类型列表' })
  @ApiResponse({ status: 200, description: '实体类型列表获取成功' })
  getEntityTypes() {
    return Object.values(EntityType).map((type) => ({
      value: type,
      label: this.getEntityTypeLabel(type),
    }));
  }

  @Get('relation-types')
  @ApiOperation({ summary: '获取关系类型列表' })
  @ApiResponse({ status: 200, description: '关系类型列表获取成功' })
  getRelationTypes() {
    return Object.values(RelationType).map((type) => ({
      value: type,
      label: this.getRelationTypeLabel(type),
    }));
  }

  private getEntityTypeLabel(type: EntityType): string {
    const labels: Record<EntityType, string> = {
      [EntityType.PERSON]: '人物',
      [EntityType.LOCATION]: '地点',
      [EntityType.ORGANIZATION]: '机构',
      [EntityType.DATE]: '日期',
      [EntityType.EVENT]: '事件',
      [EntityType.DOCUMENT]: '文档',
    };
    return labels[type];
  }

  private getRelationTypeLabel(type: RelationType): string {
    const labels: Record<RelationType, string> = {
      [RelationType.BELONGS_TO]: '隶属于',
      [RelationType.PART_OF]: '部分属于',
      [RelationType.MEMBER_OF]: '成员',
      [RelationType.EMPLOYED_BY]: '受雇于',
      [RelationType.AFFILIATED_WITH]: '关联',
      [RelationType.CAUSES]: '导致',
      [RelationType.RESULTS_IN]: '结果',
      [RelationType.LEADS_TO]: '导致',
      [RelationType.DUE_TO]: '由于',
      [RelationType.BECAUSE_OF]: '因为',
      [RelationType.BEFORE]: '之前',
      [RelationType.AFTER]: '之后',
      [RelationType.DURING]: '期间',
      [RelationType.AT_SAME_TIME_AS]: '同时',
      [RelationType.REFERENCES]: '引用',
      [RelationType.CITES]: '引用',
      [RelationType.QUOTES]: '引用',
      [RelationType.SOURCED_FROM]: '来源',
      [RelationType.LOCATED_AT]: '位于',
      [RelationType.INVOLVES]: '涉及',
      [RelationType.RELATED_TO]: '相关',
      [RelationType.ASSOCIATED_WITH]: '关联',
      [RelationType.DESCRIBES]: '描述',
      [RelationType.CONTAINS]: '包含',
      [RelationType.PRODUCED_BY]: '产生',
      [RelationType.AUTHored_BY]: '作者',
    };
    return labels[type];
  }
}