import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommonModule } from '../../common/common.module';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';
import { QAModule } from '../qa/qa.module';
import { EntityExtractionModule } from '../entity-extraction/entity-extraction.module';

@Module({
  imports: [CommonModule, KnowledgeGraphModule, QAModule, EntityExtractionModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}