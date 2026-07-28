import { QAParadigm } from '../modules/qa/entities/qa-log.entity';

export interface ReasoningNode {
  id: string;
  type: 'keyword' | 'entity' | 'relation' | 'intermediate_result' | 'final_answer';
  label: string;
  description?: string;
  confidence?: number;
  documentId?: string;
  entityId?: string;
  sourceFragment?: SourceFragment;
  metadata?: Record<string, any>;
}

export interface SourceFragment {
  text: string;
  start: number;
  end: number;
  pageNumber?: number;
}

export interface ReasoningEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence?: number;
  description?: string;
}

export interface ReasoningChain {
  question: string;
  paradigm: QAParadigm;
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  keywords: KeywordInfo[];
  matchedEntities: MatchedEntity[];
  relationFilteringProcess: RelationFilteringStep[];
  intermediateResults: IntermediateResult[];
  finalAnswer: string;
  documentId?: string;
  entityId?: string;
}

export interface KeywordInfo {
  text: string;
  position: number;
  type: 'person' | 'organization' | 'location' | 'date' | 'general';
  confidence: number;
}

export interface MatchedEntity {
  name: string;
  type: string;
  graphEntityId: string;
  confidence: number;
  documentId: string;
  matchedVia: string;
  properties?: Record<string, any>;
}

export interface RelationFilteringStep {
  step: number;
  description: string;
  candidates: string[];
  selected: string[];
  reason: string;
  confidence: number;
}

export interface IntermediateResult {
  step: number;
  description: string;
  entities: string[];
  confidence: number;
  path?: string[];
}

export interface ConfidenceBreakdown {
  entityRecognition: number;
  relationMatching: number;
  answerGeneration: number;
  final: number;
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface LowConfidenceWarning {
  isLowConfidence: boolean;
  threshold: number;
  actualScore: number;
  message: string;
  recommendedDocuments: RecommendedDocument[];
  reasoningChain?: ReasoningChain;
}

export interface RecommendedDocument {
  documentId: string;
  documentName: string;
  relevanceScore: number;
  reason: string;
  snippet?: string;
}

export interface ConfidenceThresholdConfig {
  defaultThreshold: number;
  byParadigm: Partial<Record<QAParadigm, number>>;
  byDocumentType: Partial<Record<string, number>>;
  byEntityType: Partial<Record<string, number>>;
}
