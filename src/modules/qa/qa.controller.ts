import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { QAService } from './qa.service';
import { QALog, QAParadigm } from './entities/qa-log.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('智能问答')
@Controller('qa')
export class QAController {
  constructor(private readonly qaService: QAService) {}

  @Post('ask')
  @ApiOperation({ summary: '提交问答请求' })
  @ApiResponse({ status: 200, description: '问答成功' })
  async askQuestion(@Body() body: { question: string; userId?: string }) {
    return this.qaService.askQuestion(body.question, body.userId);
  }

  @Get('logs')
  @ApiOperation({ summary: '获取问答日志列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getLogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('userId') userId?: string,
    @Query('paradigm') paradigm?: QAParadigm,
  ) {
    return this.qaService.getLogs(page, limit, userId, paradigm);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: '获取问答日志详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getLog(@Param('id') id: string) {
    return this.qaService.getLog(id);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取问答统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStats() {
    return this.qaService.getStats();
  }

  @Post('batch')
  @ApiOperation({ summary: '批量问答' })
  @ApiResponse({ status: 200, description: '批量问答成功' })
  async batchAsk(@Body() body: { questions: string[]; userId?: string }) {
    return this.qaService.batchAsk(body.questions, body.userId);
  }

  @Post('parse')
  @ApiOperation({ summary: '解析问题范式' })
  @ApiResponse({ status: 200, description: '解析成功' })
  async parseQuestion(@Body() body: { question: string }) {
    return this.qaService.analyzeQuestion(body.question);
  }
}