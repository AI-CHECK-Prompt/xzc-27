import { Module } from '@nestjs/common';
import { QAController } from './qa.controller';
import { QAService } from './qa.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QALog } from './entities/qa-log.entity';
import { CommonModule } from '../../common/common.module';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';
import { EntityExtractionModule } from '../entity-extraction/entity-extraction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QALog]),
    CommonModule,
    KnowledgeGraphModule,
    EntityExtractionModule,
  ],
  controllers: [QAController],
  providers: [QAService],
  exports: [QAService],
})
export class QAModule {}