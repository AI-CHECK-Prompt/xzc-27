import { Module } from '@nestjs/common';
import { EntityExtractionController } from './entity-extraction.controller';
import { EntityExtractionService } from './entity-extraction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtractedEntity } from './entities/extracted-entity.entity';
import { ExtractedRelation } from './entities/extracted-relation.entity';
import { CommonModule } from '../../common/common.module';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExtractedEntity, ExtractedRelation]),
    CommonModule,
    DocumentModule,
  ],
  controllers: [EntityExtractionController],
  providers: [EntityExtractionService],
  exports: [EntityExtractionService],
})
export class EntityExtractionModule {}