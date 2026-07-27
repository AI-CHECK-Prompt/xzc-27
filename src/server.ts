import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as cors from 'cors';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security
  app.use(helmet());
  app.use(cors());
  
  // Validation
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  
  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('国家档案馆知识图谱智能问答平台')
    .setDescription('基于知识图谱的档案智能检索与问答系统')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  // Rate Limiting (configured in AppModule)
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  Logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs: http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();