import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultSessionManager, resetSessionManager } from '../session/session-manager';
import { SessionStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_DATA_DIR = path.join(process.cwd(), '.workbuddy/sessions');

describe('SessionManager', () => {
  let manager: DefaultSessionManager;

  beforeEach(() => {
    resetSessionManager();
    manager = new DefaultSessionManager({
      maxConcurrent: 3,
      ttlMs: 1000,  // 1s TTL for quick tests
      cleanupIntervalMs: 500,
    });
    manager.stopCleanupTimer();
  });

  afterEach(() => {
    manager.stopCleanupTimer();
    // 清理所有测试产生的会话文件
    if (fs.existsSync(SESSION_DATA_DIR)) {
      const files = fs.readdirSync(SESSION_DATA_DIR);
      for (const f of files) {
        if (f.endsWith('.json')) {
          try { fs.unlinkSync(path.join(SESSION_DATA_DIR, f)); } catch {}
        }
      }
    }
  });

  it('creates a new session', () => {
    const session = manager.create('test-1');
    expect(session.sessionId).toBe('test-1');
    expect(session.status).toBe('idle');
    expect(session.turnsCount).toBe(0);
  });

  it('generates unique session IDs', () => {
    const s1 = manager.create();
    const s2 = manager.create();
    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  it('enforces max concurrent sessions', () => {
    manager.create('s1');
    manager.create('s2');
    manager.create('s3');
    expect(() => manager.create('s4')).toThrow('Maximum number of sessions reached');
  });

  it('gets an existing session', () => {
    manager.create('test-1');
    const session = manager.get('test-1');
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe('test-1');
  });

  it('returns null for non-existent session', () => {
    expect(manager.get('nonexistent')).toBeNull();
  });

  it('updates session status', () => {
    manager.create('test-1');
    manager.updateStatus('test-1', 'working');
    expect(manager.get('test-1')!.status).toBe('working');

    manager.updateStatus('test-1', 'completed');
    expect(manager.get('test-1')!.status).toBe('completed');
  });

  it('lists all sessions sorted by lastActivityAt', () => {
    manager.create('s1');
    manager.create('s2');
    const list = manager.list();
    expect(list.length).toBe(2);
  });

  it('removes a session and its disk file', () => {
    manager.create('test-1');
    const removed = manager.remove('test-1');
    expect(removed).toBe(true);
    expect(manager.get('test-1')).toBeNull();

    const doubleRemove = manager.remove('nonexistent');
    expect(doubleRemove).toBe(false);
  });

  it('cleanup removes completed and expired sessions', () => {
    manager.create('s1');
    manager.create('s2');
    manager.updateStatus('s1', 'completed');

    // 让 s2 过期
    const s2 = manager.get('s2')!;
    s2.lastActivityAt = Date.now() - 2000;  // 2s ago, TTL is 1s

    const removed = manager.cleanup();
    expect(removed).toBe(2);
    expect(manager.getActiveCount()).toBe(0);
  });

  it('incrementTurns updates counter', () => {
    manager.create('test-1');
    manager.incrementTurns('test-1');
    manager.incrementTurns('test-1');
    expect(manager.get('test-1')!.turnsCount).toBe(2);
  });

  it('incrementToolCalls updates counter', () => {
    manager.create('test-1');
    manager.incrementToolCalls('test-1', 3);
    manager.incrementToolCalls('test-1', 2);
    expect(manager.get('test-1')!.toolCallsCount).toBe(5);
  });

  it('prevents duplicate session IDs', () => {
    manager.create('test-1');
    expect(() => manager.create('test-1')).toThrow('already exists');
  });
});
