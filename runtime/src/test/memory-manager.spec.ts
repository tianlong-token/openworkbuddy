import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryStore, InMemoryStore, FileMemoryStore } from '../memory/memory-manager';
import { MemoryEntry } from '../types';
import { writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';

const testDir = resolve(__dirname, '../../src/test-mem-tmp-' + Date.now());

describe('Memory Manager', () => {
  describe('InMemoryStore', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore();
    });

    it('should add and retrieve entries', async () => {
      const id = await store.add({
        type: 'fact',
        content: 'test content',
        sessionId: 's1',
        metadata: {},
      });
      expect(id).toBeTruthy();
      const results = await store.search('test');
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('test content');
    });

    it('should search by type', async () => {
      await store.add({ type: 'fact', content: 'fact data', sessionId: 's1', metadata: {} });
      await store.add({ type: 'conversation', content: 'conversation data', sessionId: 's1', metadata: {} });

      const facts = await store.search('data', { type: 'fact' });
      expect(facts.length).toBe(1);
      expect(facts[0].content).toBe('fact data');
    });

    it('should clear all entries', async () => {
      await store.add({ type: 'fact', content: 'a', sessionId: 's1', metadata: {} });
      await store.clear();
      expect(store.size()).toBe(0);
    });

    it('should clear by session', async () => {
      await store.add({ type: 'fact', content: 'a', sessionId: 's1', metadata: {} });
      await store.add({ type: 'fact', content: 'b', sessionId: 's2', metadata: {} });

      await store.clear('s1');
      const remaining = await store.search('');
      expect(remaining.length).toBe(1);
      expect(remaining[0].sessionId).toBe('s2');
    });
  });

  describe('FileMemoryStore', () => {
    let dataDir: string;

    beforeEach(() => {
      dataDir = join(testDir, 'mem-' + Date.now());
      mkdirSync(dataDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(dataDir)) {
        rmSync(dataDir, { recursive: true, force: true });
      }
    });

    it('_loadRaw should preserve original IDs when loading from disk', async () => {
      // 写入一个带固定 ID 的文件到磁盘
      const originalId = 'mem_preserved_1';
      const entryData = {
        id: originalId,
        sessionId: 'test_session',
        type: 'fact' as const,
        content: 'This entry has a fixed ID',
        metadata: {},
        createdAt: Date.now(),
      };
      writeFileSync(join(dataDir, `${originalId}.json`), JSON.stringify(entryData), 'utf-8');

      // 创建 FileMemoryStore，应该从磁盘加载该条目
      const store = createMemoryStore('file', dataDir);
      const results = await store.search('fixed ID');

      expect(results.length).toBeGreaterThanOrEqual(1);
      const loaded = results.find(e => e.id === originalId);
      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe(originalId);
      expect(loaded!.content).toBe('This entry has a fixed ID');
    });

    it('clear() should delete all disk files', async () => {
      const store = createMemoryStore('file', dataDir) as FileMemoryStore;

      // 写入一条记忆（会同步写到磁盘）
      await store.add({
        type: 'fact',
        content: 'will be cleared',
        sessionId: 's_clear_all',
        metadata: {},
      });

      // 确认磁盘上有文件
      let files = readdirSync(dataDir).filter(f => f.endsWith('.json'));
      expect(files.length).toBe(1);

      // 清除
      await store.clear();

      // 确认磁盘无文件
      files = readdirSync(dataDir).filter(f => f.endsWith('.json'));
      expect(files.length).toBe(0);
    });

    it('clear(sessionId) should selectively delete files', async () => {
      const store = createMemoryStore('file', dataDir) as FileMemoryStore;

      // 写入两条不同 session 的记忆
      await store.add({
        type: 'fact',
        content: 'session A content',
        sessionId: 'session_A',
        metadata: {},
      });
      await store.add({
        type: 'fact',
        content: 'session B content',
        sessionId: 'session_B',
        metadata: {},
      });

      // 确认有 2 个文件
      let files = readdirSync(dataDir).filter(f => f.endsWith('.json'));
      expect(files.length).toBe(2);

      // 只清除 session_A
      await store.clear('session_A');

      // 确认只有 session_B 的文件保留
      files = readdirSync(dataDir).filter(f => f.endsWith('.json'));
      expect(files.length).toBe(1);

      // 验证剩余文件的内容
      const remaining = await store.search('');
      expect(remaining.length).toBe(1);
      expect(remaining[0].sessionId).toBe('session_B');
    });
  });
});
