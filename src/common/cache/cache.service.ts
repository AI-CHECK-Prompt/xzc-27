import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number; // in milliseconds
}

@Injectable()
export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      });
    }, 5 * 60 * 1000);
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set<T>(key: string, value: T, ttl: number = 3600000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  getSize(): number {
    return this.cache.size;
  }
}