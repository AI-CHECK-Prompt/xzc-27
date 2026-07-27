import { Injectable, Logger as NestLogger } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LoggerService extends NestLogger {
  private logger: winston.Logger;

  constructor() {
    super();
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.File({
          filename: `${process.env.LOG_DIR || './logs'}/error.log`,
          level: 'error',
        }),
        new winston.transports.File({
          filename: `${process.env.LOG_DIR || './logs'}/combined.log`,
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
    super.log(message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
    super.error(message, trace, context);
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
    super.warn(message, context);
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
    super.debug(message, context);
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
    super.verbose(message, context);
  }
}