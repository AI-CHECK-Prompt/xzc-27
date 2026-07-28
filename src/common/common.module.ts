import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { CacheModule } from './cache/cache.module';
import { Neo4jModule } from './neo4j/neo4j.module';
import { ConfidenceThresholdModule } from './confidence-threshold/confidence-threshold.module';

@Module({
  imports: [LoggerModule, CacheModule, Neo4jModule, ConfidenceThresholdModule],
  exports: [LoggerModule, CacheModule, Neo4jModule, ConfidenceThresholdModule],
})
export class CommonModule {}