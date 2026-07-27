import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { SemanticCacheService } from './semantic-cache.service';

@Module({
  providers: [CacheService, SemanticCacheService],
  exports: [CacheService, SemanticCacheService],
})
export class CacheModule {}