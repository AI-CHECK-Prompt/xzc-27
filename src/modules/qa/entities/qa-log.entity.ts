import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ConfidenceBreakdown, LowConfidenceWarning, ReasoningChain } from '../../../common/interfaces/reasoning-chain.interface';

export enum QAParadigm {
  YES_NO = 'yes_no',
  MULTIPLE_CHOICE = 'multiple_choice',
  LIST = 'list',
  CORRECTION = 'correction',
  FACTUAL = 'factual',
  COMPARISON = 'comparison',
  CAUSAL = 'causal',
  TEMPORAL = 'temporal',
  STATISTICAL = 'statistical',
  EXPLANATION = 'explanation',
  OTHER = 'other',
}

export enum QAStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('qa_logs')
export class QALog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column({ type: 'enum', enum: QAParadigm, default: QAParadigm.FACTUAL })
  paradigm: QAParadigm;

  @Column({ type: 'enum', enum: QAStatus, default: QAStatus.PENDING })
  status: QAStatus;

  @Column({ type: 'json', nullable: true })
  sources: any[];

  @Column({ type: 'json', nullable: true })
  highlights: any[];

  @Column({ type: 'float', default: 0.0 })
  confidence: number;

  @Column({ type: 'json', nullable: true })
  confidenceBreakdown: ConfidenceBreakdown;

  @Column({ type: 'json', nullable: true })
  reasoningChain: ReasoningChain;

  @Column({ type: 'json', nullable: true })
  lowConfidenceWarning: LowConfidenceWarning;

  @Column({ type: 'int', default: 0 })
  responseTime: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}