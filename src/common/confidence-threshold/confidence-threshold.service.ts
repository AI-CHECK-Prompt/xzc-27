import { Injectable } from '@nestjs/common';
import { QAParadigm } from '../modules/qa/entities/qa-log.entity';
import { ConfidenceThresholdConfig } from './interfaces/reasoning-chain.interface';

@Injectable()
export class ConfidenceThresholdService {
  private config: ConfidenceThresholdConfig = {
    defaultThreshold: 0.6,
    byParadigm: {
      [QAParadigm.YES_NO]: 0.55,
      [QAParadigm.MULTIPLE_CHOICE]: 0.6,
      [QAParadigm.LIST]: 0.5,
      [QAParadigm.CORRECTION]: 0.65,
      [QAParadigm.FACTUAL]: 0.55,
      [QAParadigm.COMPARISON]: 0.6,
      [QAParadigm.CAUSAL]: 0.65,
      [QAParadigm.TEMPORAL]: 0.55,
      [QAParadigm.STATISTICAL]: 0.7,
      [QAParadigm.EXPLANATION]: 0.5,
      [QAParadigm.OTHER]: 0.5,
    },
    byDocumentType: {
      'pdf': 0.55,
      'word': 0.55,
      'image': 0.65,
      'scan': 0.7,
      'other': 0.6,
    },
    byEntityType: {
      'person': 0.6,
      'organization': 0.55,
      'location': 0.55,
      'date': 0.5,
      'event': 0.6,
    },
  };

  getThreshold(paradigm?: QAParadigm, documentType?: string, entityTypes?: string[]): number {
    let threshold = this.config.defaultThreshold;

    if (paradigm && this.config.byParadigm[paradigm] !== undefined) {
      threshold = Math.max(threshold, this.config.byParadigm[paradigm]);
    }

    if (documentType && this.config.byDocumentType[documentType.toLowerCase()] !== undefined) {
      threshold = Math.max(threshold, this.config.byDocumentType[documentType.toLowerCase()]);
    }

    if (entityTypes && entityTypes.length > 0) {
      const entityThresholds = entityTypes
        .map(type => this.config.byEntityType[type.toLowerCase()])
        .filter(t => t !== undefined);
      if (entityThresholds.length > 0) {
        threshold = Math.max(threshold, Math.min(...entityThresholds));
      }
    }

    return threshold;
  }

  isLowConfidence(score: number, paradigm?: QAParadigm, documentType?: string, entityTypes?: string[]): boolean {
    const threshold = this.getThreshold(paradigm, documentType, entityTypes);
    return score < threshold;
  }

  getConfig(): ConfidenceThresholdConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ConfidenceThresholdConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      byParadigm: { ...this.config.byParadigm, ...updates.byParadigm },
      byDocumentType: { ...this.config.byDocumentType, ...updates.byDocumentType },
      byEntityType: { ...this.config.byEntityType, ...updates.byEntityType },
    };
  }
}
