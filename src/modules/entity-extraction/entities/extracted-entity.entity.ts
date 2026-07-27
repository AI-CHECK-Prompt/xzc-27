import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';

export enum EntityType {
  PERSON = 'person',
  LOCATION = 'location',
  ORGANIZATION = 'organization',
  DATE = 'date',
  EVENT = 'event',
  DOCUMENT = 'document',
}

@Entity('extracted_entities')
export class ExtractedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: EntityType })
  type: EntityType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  properties: Record<string, any>;

  @Column({ type: 'float', default: 0.0 })
  confidence: number;

  @Column({ type: 'varchar', length: 255 })
  documentId: string;

  @Column({ type: 'int', nullable: true })
  startOffset: number;

  @Column({ type: 'int', nullable: true })
  endOffset: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}