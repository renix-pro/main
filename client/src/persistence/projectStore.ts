/**
 * RENIX vNext — Project Store
 * 
 * Canon v1.4 Compliant
 * 
 * Holds current project entities in memory.
 * Respects read-only mode when project is closed.
 * 
 * This store:
 * - Provides typed access to entity repositories
 * - Enforces read-only mode for closed projects
 * - Does NOT implement queries, aggregations, or derived views
 */

import { createRepository, type Repository } from './repository';
import type {
  User,
  Project,
  ProjectMember,
  Vision,
  InspirationBoard,
  InspirationItem,
  Scope,
  Area,
  WorkItem,
  Vendor,
  BudgetLine,
  Quote,
  Invoice,
  InvoiceLine,
  FinancingSource,
  MediaAsset,
  Document,
  Note,
} from '../domain/entities';

/**
 * Project Store interface.
 * 
 * Provides access to all entity repositories for a project.
 */
export interface ProjectStore {
  readonly projectId: string;
  readonly isReadOnly: boolean;
  
  readonly users: Repository<User>;
  readonly projects: Repository<Project>;
  readonly projectMembers: Repository<ProjectMember>;
  readonly visions: Repository<Vision>;
  readonly inspirationBoards: Repository<InspirationBoard>;
  readonly inspirationItems: Repository<InspirationItem>;
  readonly scopes: Repository<Scope>;
  readonly areas: Repository<Area>;
  readonly workItems: Repository<WorkItem>;
  readonly vendors: Repository<Vendor>;
  readonly budgetLines: Repository<BudgetLine>;
  readonly quotes: Repository<Quote>;
  readonly invoices: Repository<Invoice>;
  readonly invoiceLines: Repository<InvoiceLine>;
  readonly financingSources: Repository<FinancingSource>;
  readonly mediaAssets: Repository<MediaAsset>;
  readonly documents: Repository<Document>;
  readonly notes: Repository<Note>;
  
  setReadOnly(isReadOnly: boolean): void;
}

/**
 * Read-only repository wrapper.
 * 
 * Wraps a repository to prevent mutations when in read-only mode.
 */
class ReadOnlyRepositoryWrapper<T extends { id: string; createdAt: number; updatedAt: number; createdBy: string }> implements Repository<T> {
  constructor(
    private inner: Repository<T>,
    private checkReadOnly: () => boolean
  ) {}
  
  create(entity: T): T {
    if (this.checkReadOnly()) {
      throw new Error('Cannot create entity: project is read-only');
    }
    return this.inner.create(entity);
  }
  
  read(id: string): T | undefined {
    return this.inner.read(id);
  }
  
  update(id: string, partial: Partial<Omit<T, 'id' | 'createdAt' | 'createdBy'>>): T | undefined {
    if (this.checkReadOnly()) {
      throw new Error('Cannot update entity: project is read-only');
    }
    return this.inner.update(id, partial);
  }
  
  delete(id: string): boolean {
    if (this.checkReadOnly()) {
      throw new Error('Cannot delete entity: project is read-only');
    }
    return this.inner.delete(id);
  }
  
  list(): T[] {
    return this.inner.list();
  }
  
  exists(id: string): boolean {
    return this.inner.exists(id);
  }
  
  count(): number {
    return this.inner.count();
  }
  
  clear(): void {
    if (this.checkReadOnly()) {
      throw new Error('Cannot clear entities: project is read-only');
    }
    this.inner.clear();
  }
}

/**
 * In-memory project store implementation.
 */
class InMemoryProjectStore implements ProjectStore {
  private _isReadOnly: boolean = false;
  
  readonly projectId: string;
  
  readonly users: Repository<User>;
  readonly projects: Repository<Project>;
  readonly projectMembers: Repository<ProjectMember>;
  readonly visions: Repository<Vision>;
  readonly inspirationBoards: Repository<InspirationBoard>;
  readonly inspirationItems: Repository<InspirationItem>;
  readonly scopes: Repository<Scope>;
  readonly areas: Repository<Area>;
  readonly workItems: Repository<WorkItem>;
  readonly vendors: Repository<Vendor>;
  readonly budgetLines: Repository<BudgetLine>;
  readonly quotes: Repository<Quote>;
  readonly invoices: Repository<Invoice>;
  readonly invoiceLines: Repository<InvoiceLine>;
  readonly financingSources: Repository<FinancingSource>;
  readonly mediaAssets: Repository<MediaAsset>;
  readonly documents: Repository<Document>;
  readonly notes: Repository<Note>;
  
  constructor(projectId: string) {
    this.projectId = projectId;
    
    const checkReadOnly = () => this._isReadOnly;
    
    this.users = new ReadOnlyRepositoryWrapper(createRepository<User>(), checkReadOnly);
    this.projects = new ReadOnlyRepositoryWrapper(createRepository<Project>(), checkReadOnly);
    this.projectMembers = new ReadOnlyRepositoryWrapper(createRepository<ProjectMember>(), checkReadOnly);
    this.visions = new ReadOnlyRepositoryWrapper(createRepository<Vision>(), checkReadOnly);
    this.inspirationBoards = new ReadOnlyRepositoryWrapper(createRepository<InspirationBoard>(), checkReadOnly);
    this.inspirationItems = new ReadOnlyRepositoryWrapper(createRepository<InspirationItem>(), checkReadOnly);
    this.scopes = new ReadOnlyRepositoryWrapper(createRepository<Scope>(), checkReadOnly);
    this.areas = new ReadOnlyRepositoryWrapper(createRepository<Area>(), checkReadOnly);
    this.workItems = new ReadOnlyRepositoryWrapper(createRepository<WorkItem>(), checkReadOnly);
    this.vendors = new ReadOnlyRepositoryWrapper(createRepository<Vendor>(), checkReadOnly);
    this.budgetLines = new ReadOnlyRepositoryWrapper(createRepository<BudgetLine>(), checkReadOnly);
    this.quotes = new ReadOnlyRepositoryWrapper(createRepository<Quote>(), checkReadOnly);
    this.invoices = new ReadOnlyRepositoryWrapper(createRepository<Invoice>(), checkReadOnly);
    this.invoiceLines = new ReadOnlyRepositoryWrapper(createRepository<InvoiceLine>(), checkReadOnly);
    this.financingSources = new ReadOnlyRepositoryWrapper(createRepository<FinancingSource>(), checkReadOnly);
    this.mediaAssets = new ReadOnlyRepositoryWrapper(createRepository<MediaAsset>(), checkReadOnly);
    this.documents = new ReadOnlyRepositoryWrapper(createRepository<Document>(), checkReadOnly);
    this.notes = new ReadOnlyRepositoryWrapper(createRepository<Note>(), checkReadOnly);
  }
  
  get isReadOnly(): boolean {
    return this._isReadOnly;
  }
  
  setReadOnly(isReadOnly: boolean): void {
    this._isReadOnly = isReadOnly;
  }
}

/**
 * Factory function to create a new project store.
 */
export function createProjectStore(projectId: string): ProjectStore {
  return new InMemoryProjectStore(projectId);
}

/**
 * Global store instance.
 * 
 * In a real application, this would be managed by a context provider.
 * For Phase 2, we expose a simple singleton.
 */
let globalStore: ProjectStore | null = null;

export function getProjectStore(): ProjectStore | null {
  return globalStore;
}

export function initializeProjectStore(projectId: string): ProjectStore {
  globalStore = createProjectStore(projectId);
  return globalStore;
}

export function clearProjectStore(): void {
  globalStore = null;
}
