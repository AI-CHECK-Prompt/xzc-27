import { Controller, Get, Post, Put, Delete, Body, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('后台管理')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '获取仪表盘数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('entity-alignment')
  @ApiOperation({ summary: '获取需要对齐的实体列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEntitiesForAlignment(@Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.adminService.getEntitiesForAlignment(page, limit);
  }

  @Post('entity-alignment/batch')
  @ApiOperation({ summary: '批量对齐实体' })
  @ApiResponse({ status: 200, description: '对齐成功' })
  async batchAlignEntities(@Body() body: { sourceEntityIds: string[]; targetEntityId: string }) {
    return this.adminService.batchAlignEntities(body.sourceEntityIds, body.targetEntityId);
  }

  @Get('qa-logs')
  @ApiOperation({ summary: '获取问答日志' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getQALogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getQALogs(page, limit, startDate, endDate);
  }

  @Delete('qa-logs/:id')
  @ApiOperation({ summary: '删除问答日志' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteQALog(@Query('id') id: string) {
    return this.adminService.deleteQALog(id);
  }

  @Get('model-metrics')
  @ApiOperation({ summary: '获取模型评估指标' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getModelMetrics() {
    return this.adminService.getModelMetrics();
  }

  @Post('model-evaluate')
  @ApiOperation({ summary: '触发模型评估' })
  @ApiResponse({ status: 200, description: '评估成功' })
  async evaluateModel() {
    return this.adminService.evaluateModel();
  }

  @Get('system-health')
  @ApiOperation({ summary: '检查系统健康状态' })
  @ApiResponse({ status: 200, description: '检查成功' })
  async checkHealth() {
    return this.adminService.checkHealth();
  }

  @Get('graph-explore')
  @ApiOperation({ summary: '图谱探查' })
  @ApiResponse({ status: 200, description: '探查成功' })
  async exploreGraph(
    @Query('entityId') entityId?: string,
    @Query('depth') depth: number = 2,
    @Query('limit') limit: number = 50,
  ) {
    return this.adminService.exploreGraph(entityId, depth, limit);
  }

  @Post('graph/cleanup')
  @ApiOperation({ summary: '清理图谱冗余数据' })
  @ApiResponse({ status: 200, description: '清理成功' })
  async cleanupGraph() {
    return this.adminService.cleanupGraph();
  }
}