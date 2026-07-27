import { Module } from '@nestjs/common';
import { KnowledgeGraphController } from './knowledge-graph.controller';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { CommonModule } from '../../common/common.module';
import { EntityExtractionModule } from '../entity-extraction/entity-extraction.module';

@Module({
  imports: [CommonModule, EntityExtractionModule],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}