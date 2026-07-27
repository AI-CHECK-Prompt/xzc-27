import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// Modules
import { DocumentModule } from './modules/document/document.module';
import { EntityExtractionModule } from './modules/entity-extraction/entity-extraction.module';
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';
import { QAModule } from './modules/qa/qa.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './data/example_db.sqlite',
      autoLoadEntities: true,
      synchronize: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    DocumentModule,
    EntityExtractionModule,
    KnowledgeGraphModule,
    QAModule,
    AdminModule,
    AuthModule,
    CommonModule,
  ],
})
export class AppModule {}