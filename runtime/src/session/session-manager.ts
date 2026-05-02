import { SessionState, SessionStatus, SessionConfig, SessionManager } from '../types';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const DEFAULT_CONFIG: SessionConfig = {
  maxConcurrent: 10,
  ttlMs: 24 * 60 * 60 * 1000,  // 24h
  maxTurnsPerSession: 50,
  cleanupIntervalMs: 5 * 60 * 1000,  // 5min
};

const DATA_DIR = '.workbuddy/sessions';

export class DefaultSessionManager implements SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private config: SessionConfig;
  private dataDir: string;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<SessionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataDir = join(process.cwd(), DATA_DIR);

    // 确保数据目录存在
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    // 加载已持久化的会话
    this.loadFromDisk();

    // 启动定期清理
    this.startCleanupTimer();
  }

  create(sessionId?: string, options?: { skillSlug?: string }): SessionState {
    if (this.sessions.size >= this.config.maxConcurrent) {
      throw new Error(
        `Maximum number of sessions reached (${this.config.maxConcurrent}). ` +
        `Remove a session or increase maxConcurrent.`
      );
    }

    const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (this.sessions.has(sid)) {
      throw new Error(`Session '${sid}' already exists`);
    }

    const now = Date.now();
    const state: SessionState = {
      sessionId: sid,
      status: 'idle',
      skillSlug: options?.skillSlug || null,
      createdAt: now,
      lastActivityAt: now,
      turnsCount: 0,
      toolCallsCount: 0,
    };

    this.sessions.set(sid, state);
    this.persistSession(state);

    return state;
  }

  get(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) || null;
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    state.status = status;
    state.lastActivityAt = Date.now();

    this.persistSession(state);
  }

  list(): SessionState[] {
    return [...this.sessions.values()].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  remove(sessionId: string): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return false;

    this.sessions.delete(sessionId);

    // 删除磁盘文件
    const filePath = join(this.dataDir, `${sessionId}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    return true;
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [sid, state] of this.sessions) {
      if (state.status === 'completed' || state.status === 'failed' || state.status === 'timed_out') {
        // 终态会话立即清理
        this.sessions.delete(sid);
        const filePath = join(this.dataDir, `${sid}.json`);
        if (existsSync(filePath)) unlinkSync(filePath);
        removed++;
      } else if (now - state.lastActivityAt > this.config.ttlMs) {
        // 过期会话更新状态为 timed_out 后清理
        state.status = 'timed_out';
        this.sessions.delete(sid);
        const filePath = join(this.dataDir, `${sid}.json`);
        if (existsSync(filePath)) unlinkSync(filePath);
        removed++;
      }
    }

    return removed;
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  // 增加轮次计数
  incrementTurns(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.turnsCount++;
      state.lastActivityAt = Date.now();
      this.persistSession(state);
    }
  }

  // 增加工具调用计数
  incrementToolCalls(sessionId: string, count: number): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.toolCallsCount += count;
      state.lastActivityAt = Date.now();
      this.persistSession(state);
    }
  }

  // 停止清理定时器（测试用）
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ===== 内部方法 =====

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const removed = this.cleanup();
      if (removed > 0) {
        console.log(`[SessionManager] Cleaned up ${removed} expired sessions`);
      }
    }, this.config.cleanupIntervalMs);
  }

  private persistSession(state: SessionState): void {
    try {
      const filePath = join(this.dataDir, `${state.sessionId}.json`);
      writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      // 持久化失败不阻塞
    }
  }

  private loadFromDisk(): void {
    try {
      if (!existsSync(this.dataDir)) return;

      const files = readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = join(this.dataDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const state: SessionState = JSON.parse(content);

        // 只加载未过期的会话
        if (Date.now() - state.lastActivityAt <= this.config.ttlMs) {
          this.sessions.set(state.sessionId, state);
        } else {
          // 过期文件直接删除
          unlinkSync(filePath);
        }
      }
    } catch {
      // 加载失败不阻塞
    }
  }
}

let defaultManager: DefaultSessionManager | null = null;

export function getSessionManager(config?: Partial<SessionConfig>): SessionManager {
  if (!defaultManager) {
    defaultManager = new DefaultSessionManager(config);
  }
  return defaultManager;
}

export function resetSessionManager(): void {
  if (defaultManager) {
    defaultManager.stopCleanupTimer();
    defaultManager = null;
  }
}
