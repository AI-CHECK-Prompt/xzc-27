import { Controller, Post, Get, Put, Delete, Param, Body, UploadedFiles, UseInterceptors, Query } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentEntity, DocumentStatus } from './entities/document.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('文档管理')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: '批量上传文档' })
  @ApiResponse({ status: 201, description: '文档上传成功' })
  async uploadDocuments(@UploadedFiles() files: Express.Multer.File[]) {
    return this.documentService.processDocuments(files);
  }

  @Get()
  @ApiOperation({ summary: '获取文档列表' })
  @ApiResponse({ status: 200, description: '文档列表获取成功' })
  async getDocuments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: DocumentStatus,
    @Query('type') type?: string,
  ) {
    return this.documentService.getDocuments(page, limit, status, type);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文档详情' })
  @ApiResponse({ status: 200, description: '文档详情获取成功' })
  async getDocument(@Param('id') id: string) {
    return this.documentService.getDocument(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新文档信息' })
  @ApiResponse({ status: 200, description: '文档更新成功' })
  async updateDocument(@Param('id') id: string, @Body() body: Partial<DocumentEntity>) {
    return this.documentService.updateDocument(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文档' })
  @ApiResponse({ status: 200, description: '文档删除成功' })
  async deleteDocument(@Param('id') id: string) {
    return this.documentService.deleteDocument(id);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量处理文档' })
  @ApiResponse({ status: 200, description: '批量处理成功' })
  async batchProcess(@Body() body: { documentIds: string[] }) {
    return this.documentService.batchProcessDocuments(body.documentIds);
  }

  @Get(':id/content')
  @ApiOperation({ summary: '获取文档内容' })
  @ApiResponse({ status: 200, description: '文档内容获取成功' })
  async getDocumentContent(@Param('id') id: string) {
    return this.documentService.getDocumentContent(id);
  }
}