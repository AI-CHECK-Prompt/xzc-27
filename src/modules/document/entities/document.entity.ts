import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum DocumentType {
  PDF = 'pdf',
  WORD = 'word',
  IMAGE = 'image',
  SCAN = 'scan',
  OTHER = 'other',
}

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PENDING })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  tables: any[];

  @Column({ type: 'json', nullable: true })
  stamps: any[];

  @Column({ type: 'json', nullable: true })
  handwritings: any[];

  @Column({ type: 'int', default: 0 })
  pageCount: number;

  @Column({ type: 'int', default: 0 })
  charCount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}