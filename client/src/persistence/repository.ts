/**
 * RENIX vNext — Repository Abstraction
 * 
 * Canon v1.4 Compliant
 * 
 * Basic CRUD abstraction for entity persistence.
 * 
 * This repository:
 * - Stores and retrieves entities by ID
 * - Supports basic create / read / update
 * - Does NOT enforce validation rules
 * - Does NOT enforce relationships
 * - Does NOT cascade changes
 * 
 * No queries. No aggregations. No filters. No joins. No derived views.
 */

import type { BaseEntity } from '../domain/entities';

/**
 * Generic repository interface for entity storage.
 * 
 * Type parameter T must extend BaseEntity.
 */
export interface Repository<T extends BaseEntity> {
  /**
   * Create a new entity.
   * Returns the created entity.
   */
  create(entity: T): T;
  
  /**
   * Read an entity by ID.
   * Returns undefined if not found.
   */
  read(id: string): T | undefined;
  
  /**
   * Update an existing entity.
   * Returns the updated entity, or undefined if not found.
   */
  update(id: string, partial: Partial<Omit<T, 'id' | 'createdAt' | 'createdBy'>>): T | undefined;
  
  /**
   * Delete an entity by ID.
   * Returns true if deleted, false if not found.
   */
  delete(id: string): boolean;
  
  /**
   * List all entities.
   * Returns an array of all stored entities.
   */
  list(): T[];
  
  /**
   * Check if an entity exists.
   */
  exists(id: string): boolean;
  
  /**
   * Count all entities.
   */
  count(): number;
  
  /**
   * Clear all entities.
   */
  clear(): void;
}

/**
 * In-memory implementation of the Repository interface.
 */
export class InMemoryRepository<T extends BaseEntity> implements Repository<T> {
  private entities: Map<string, T> = new Map();
  
  create(entity: T): T {
    this.entities.set(entity.id, entity);
    return entity;
  }
  
  read(id: string): T | undefined {
    return this.entities.get(id);
  }
  
  update(id: string, partial: Partial<Omit<T, 'id' | 'createdAt' | 'createdBy'>>): T | undefined {
    const existing = this.entities.get(id);
    if (!existing) {
      return undefined;
    }
    
    const updated = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    } as T;
    
    this.entities.set(id, updated);
    return updated;
  }
  
  delete(id: string): boolean {
    return this.entities.delete(id);
  }
  
  list(): T[] {
    return Array.from(this.entities.values());
  }
  
  exists(id: string): boolean {
    return this.entities.has(id);
  }
  
  count(): number {
    return this.entities.size;
  }
  
  clear(): void {
    this.entities.clear();
  }
}

/**
 * Factory function to create a new in-memory repository.
 */
export function createRepository<T extends BaseEntity>(): Repository<T> {
  return new InMemoryRepository<T>();
}
