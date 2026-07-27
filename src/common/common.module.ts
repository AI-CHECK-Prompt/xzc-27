import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { CacheModule } from './cache/cache.module';
import { Neo4jModule } from './neo4j/neo4j.module';

@Module({
  imports: [LoggerModule, CacheModule, Neo4jModule],
  exports: [LoggerModule, CacheModule, Neo4jModule],
})
export class CommonModule {}