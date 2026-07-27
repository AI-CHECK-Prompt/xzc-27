import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

interface SemanticCacheEntry {
  originalQuestion: string;
  normalizedKey: string;
  value: any;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class SemanticCacheService {
  private semanticCache: Map<string, SemanticCacheEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private similarityThreshold: number = 0.8; // 相似度阈值，超过此值视为相似问题

  constructor(private readonly cacheService: CacheService) {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.semanticCache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          this.semanticCache.delete(key);
        }
      });
    }, 5 * 60 * 1000);
  }

  /**
   * 文本规范化：去除标点、空格、语气词，转为小写
   */
  normalizeText(text: string): string {
    if (!text) return '';
    
    let normalized = text.trim().toLowerCase();
    
    // 去除标点符号（保留中文、英文、数字）
    normalized = normalized.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    
    // 去除常见语气词
    const modalParticles = ['吗', '呢', '吧', '啊', '呀', '哦', '呢', '啦', '了'];
    for (const particle of modalParticles) {
      normalized = normalized.replace(new RegExp(particle + '$'), '');
    }
    
    // 去除多余空格
    normalized = normalized.replace(/\s+/g, '');
    
    return normalized;
  }

  /**
   * 计算两个字符串的Jaccard相似度
   */
  jaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1);
    const set2 = new Set(str2);
    
    if (set1.size === 0 && set2.size === 0) return 1.0;
    if (set1.size === 0 || set2.size === 0) return 0.0;
    
    const intersection = [...set1].filter(x => set2.has(x)).length;
    const union = set1.size + set2.size - intersection;
    
    return intersection / union;
  }

  /**
   * 计算两个字符串的编辑距离（Levenshtein距离）
   */
  levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[str1.length][str2.length];
  }

  /**
   * 计算两个字符串的相似度（结合Jaccard和编辑距离）
   */
  calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalizeText(str1);
    const normalized2 = this.normalizeText(str2);
    
    if (!normalized1 || !normalized2) return 0.0;
    
    // 使用Jaccard相似度
    const jaccard = this.jaccardSimilarity(normalized1, normalized2);
    
    // 使用编辑距离计算相似度
    const maxLen = Math.max(normalized1.length, normalized2.length);
    const levenshtein = maxLen > 0 ? 1 - this.levenshteinDistance(normalized1, normalized2) / maxLen : 0;
    
    // 综合两种相似度（加权平均）
    return (jaccard * 0.6 + levenshtein * 0.4);
  }

  /**
   * 获取缓存值（支持语义匹配）
   */
  get<T>(question: string): T | undefined {
    const normalizedQuestion = this.normalizeText(question);
    
    // 首先尝试精确匹配
    if (this.semanticCache.has(normalizedQuestion)) {
      const entry = this.semanticCache.get(normalizedQuestion)!;
      if (this.isExpired(entry)) {
        this.semanticCache.delete(normalizedQuestion);
        return undefined;
      }
      return entry.value;
    }
    
    // 尝试语义相似匹配
    for (const [key, entry] of this.semanticCache.entries()) {
      if (this.isExpired(entry)) {
        this.semanticCache.delete(key);
        continue;
      }
      
      const similarity = this.jaccardSimilarity(normalizedQuestion, key);
      if (similarity >= this.similarityThreshold) {
        return entry.value;
      }
    }
    
    return undefined;
  }

  /**
   * 设置缓存值
   */
  set<T>(question: string, value: T, ttl: number = 3600000): void {
    const normalizedKey = this.normalizeText(question);
    
    this.semanticCache.set(normalizedKey, {
      originalQuestion: question,
      normalizedKey,
      value,
      timestamp: Date.now(),
      ttl,
    });
    
    // 同时使用底层缓存服务存储（保持兼容性）
    this.cacheService.set(normalizedKey, value, ttl);
  }

  /**
   * 删除缓存
   */
  delete(question: string): void {
    const normalizedKey = this.normalizeText(question);
    this.semanticCache.delete(normalizedKey);
    this.cacheService.delete(normalizedKey);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.semanticCache.clear();
    this.cacheService.clear();
  }

  /**
   * 检查是否存在缓存（支持语义匹配）
   */
  has(question: string): boolean {
    return this.get(question) !== undefined;
  }

  /**
   * 获取缓存大小
   */
  getSize(): number {
    return this.semanticCache.size;
  }

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: SemanticCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * 设置相似度阈值
   */
  setSimilarityThreshold(threshold: number): void {
    if (threshold >= 0 && threshold <= 1) {
      this.similarityThreshold = threshold;
    }
  }

  /**
   * 获取相似度阈值
   */
  getSimilarityThreshold(): number {
    return this.similarityThreshold;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { totalEntries: number; avgSimilarity?: number } {
    return {
      totalEntries: this.semanticCache.size,
    };
  }
}