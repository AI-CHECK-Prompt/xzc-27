import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RelationType {
  // 隶属关系
  BELONGS_TO = 'belongs_to',
  PART_OF = 'part_of',
  MEMBER_OF = 'member_of',
  EMPLOYED_BY = 'employed_by',
  AFFILIATED_WITH = 'affiliated_with',
  
  // 因果关系
  CAUSES = 'causes',
  RESULTS_IN = 'results_in',
  LEADS_TO = 'leads_to',
  DUE_TO = 'due_to',
  BECAUSE_OF = 'because_of',
  
  // 时序关系
  BEFORE = 'before',
  AFTER = 'after',
  DURING = 'during',
  AT_SAME_TIME_AS = 'at_same_time_as',
  
  // 引用关系
  REFERENCES = 'references',
  CITES = 'cites',
  QUOTES = 'quotes',
  SOURCED_FROM = 'sourced_from',
  
  // 其他关系
  LOCATED_AT = 'located_at',
  INVOLVES = 'involves',
  RELATED_TO = 'related_to',
  ASSOCIATED_WITH = 'associated_with',
  DESCRIBES = 'describes',
  CONTAINS = 'contains',
  PRODUCED_BY = 'produced_by',
  AUTHored_BY = 'authored_by',
}

@Entity('extracted_relations')
export class ExtractedRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  sourceEntityId: string;

  @Column({ type: 'varchar', length: 36 })
  targetEntityId: string;

  @Column({ type: 'enum', enum: RelationType })
  relationType: RelationType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'float', default: 0.0 })
  confidence: number;

  @Column({ type: 'varchar', length: 255 })
  documentId: string;

  @Column({ type: 'json', nullable: true })
  context: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}