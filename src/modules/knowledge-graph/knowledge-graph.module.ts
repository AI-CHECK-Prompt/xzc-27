import { Module } from '@nestjs/common';
import { KnowledgeGraphController } from './knowledge-graph.controller';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { CommonModule } from '../../common/common.module';
import { EntityExtractionModule } from '../entity-extraction/entity-extraction.module';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [CommonModule, EntityExtractionModule, DocumentModule],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}