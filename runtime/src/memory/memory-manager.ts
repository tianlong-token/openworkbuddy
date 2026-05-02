import { MemoryEntry, MemoryStore, MemorySearchOptions } from '../types';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

let idCounter = 0;

function generateId(): string {
  idCounter++;
  return `mem_${Date.now()}_${idCounter}`;
}

export class InMemoryStore implements MemoryStore {
  private entries: MemoryEntry[] = [];

  async add(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<string> {
    const memoryEntry: MemoryEntry = {
      ...entry,
      id: generateId(),
      createdAt: Date.now(),
    };
    this.entries.push(memoryEntry);
    return memoryEntry.id;
  }

  async search(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]> {
    let results = [...this.entries];

    if (options?.type) {
      results = results.filter(e => e.type === options.type);
    }

    if (options?.startDate) {
      const start = new Date(options.startDate).getTime();
      results = results.filter(e => e.createdAt >= start);
    }

    if (options?.endDate) {
      const end = new Date(options.endDate).getTime();
      results = results.filter(e => e.createdAt <= end);
    }

    const q = query.toLowerCase();
    results = results.filter(e =>
      e.content.toLowerCase().includes(q) ||
      JSON.stringify(e.metadata).toLowerCase().includes(q)
    );

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async getSessionHistory(sessionId: string): Promise<MemoryEntry[]> {
    return this.entries.filter(e => e.sessionId === sessionId);
  }

  async clear(sessionId?: string): Promise<void> {
    if (sessionId) {
      this.entries = this.entries.filter(e => e.sessionId !== sessionId);
    } else {
      this.entries = [];
    }
  }

  size(): number {
    return this.entries.length;
  }

  getAll(): MemoryEntry[] {
    return [...this.entries];
  }

  // H1: 内部方法——直接加载已有条目（保留原 ID，不生成新 ID）
  _loadRaw(entry: MemoryEntry): void {
    this.entries.push(entry);
  }
}

export class FileMemoryStore implements MemoryStore {
  private store: InMemoryStore;
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.store = new InMemoryStore();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
      return;
    }

    try {
      const files = readdirSync(this.dataDir).filter((f: string) => f.endsWith('.json'));
      for (const file of files) {
        const content = readFileSync(join(this.dataDir, file), 'utf-8');
        const entry: MemoryEntry = JSON.parse(content);
        // H1: 直接推入保留原 ID，避免 add() 生成新 ID
        this.store._loadRaw(entry);
      }
    } catch {
      console.warn('Failed to load memory from disk');
    }
  }

  private saveToDisk(entry: MemoryEntry): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    const filePath = join(this.dataDir, `${entry.id}.json`);
    writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  async add(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<string> {
    const id = await this.store.add(entry);
    const savedEntry = this.store.getAll().find(e => e.id === id);
    if (savedEntry) {
      this.saveToDisk(savedEntry);
    }
    return id;
  }

  async search(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]> {
    return this.store.search(query, options);
  }

  async getSessionHistory(sessionId: string): Promise<MemoryEntry[]> {
    return this.store.getSessionHistory(sessionId);
  }

  async clear(sessionId?: string): Promise<void> {
    // H2: 先清内存，再同步清磁盘
    await this.store.clear(sessionId);

    if (!existsSync(this.dataDir)) return;

    try {
      const files = readdirSync(this.dataDir).filter((f: string) => f.endsWith('.json'));
      for (const file of files) {
        if (sessionId) {
          // 只删除匹配 session 的文件
          const content = readFileSync(join(this.dataDir, file), 'utf-8');
          const entry: MemoryEntry = JSON.parse(content);
          if (entry.sessionId === sessionId) {
            unlinkSync(join(this.dataDir, file));
          }
        } else {
          // 删除所有
          unlinkSync(join(this.dataDir, file));
        }
      }
    } catch {
      console.warn('Failed to clean memory files from disk');
    }
  }
}

export function createMemoryStore(type: 'memory' | 'file' | 'api', dataDir?: string): MemoryStore {
  switch (type) {
    case 'file':
      return new FileMemoryStore(dataDir || '.workbuddy/memory');
    case 'memory':
    default:
      return new InMemoryStore();
  }
}
