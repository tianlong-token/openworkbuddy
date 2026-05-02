/**
 * PR1 单元测试 — DynamicSessionFacade
 *
 * ⚠️ 本测试依赖完整 monorepo build（@genie/core 等）。
 * 运行前需先执行 `yarn compile` 或 `yarn build`。
 *
 * 运行方式：yarn compile && npx tsx packages/sandbox-proxy/src/test/dynamic-session-facade.spec.ts
 */

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { DynamicSessionFacade } from '../../service/multi-session/session-facade';
import { SessionStatus } from '../../types';

process.env.NODE_ENV = 'test';

const TEST_DATA_DIR = path.join(__dirname, '../../data/sessions');

function cleanupTestSessions(): void {
    try {
        if (fs.existsSync(TEST_DATA_DIR)) {
            const entries = fs.readdirSync(TEST_DATA_DIR, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('test-')) {
                    fs.rmSync(path.join(TEST_DATA_DIR, entry.name), { recursive: true, force: true });
                }
            }
        }
    } catch { /* ignore */ }
}

async function runTests() {
    console.log('=== DynamicSessionFacade Tests ===\n');
    cleanupTestSessions();

    // 测试：创建 session
    {
        const facade = new DynamicSessionFacade({ skipRestore: true });
        facade.stopCleanupTimer();

        const state = facade.ensureSession('test-create-1');
        assert.strictEqual(state.sessionId, 'test-create-1');
        assert.ok(state.createdAt > 0);

        const sessionDir = path.join(TEST_DATA_DIR, 'test-create-1');
        assert.ok(fs.existsSync(sessionDir), 'Session directory should exist');
        assert.ok(fs.existsSync(path.join(sessionDir, 'state.json')), 'state.json should exist');

        facade.stopCleanupTimer();
        console.log('✅ Session creation works');
    }

    // 测试：状态隔离
    {
        const facade = new DynamicSessionFacade({ skipRestore: true });
        facade.stopCleanupTimer();

        facade.ensureSession('test-iso-a');
        facade.ensureSession('test-iso-b');

        facade.updateStatus('test-iso-a', SessionStatus.PLANNING);
        facade.updateStatus('test-iso-b', SessionStatus.WORKING);

        assert.strictEqual(facade.getStatus('test-iso-a'), SessionStatus.PLANNING);
        assert.strictEqual(facade.getStatus('test-iso-b'), SessionStatus.WORKING);

        facade.stopCleanupTimer();
        console.log('✅ Session status isolation works');
    }

    // 测试：删除
    {
        const facade = new DynamicSessionFacade({ skipRestore: true });
        facade.stopCleanupTimer();

        facade.ensureSession('test-delete-1');
        assert.ok(facade.hasSession('test-delete-1'));

        const removed = facade.removeSession('test-delete-1');
        assert.strictEqual(removed, true);
        assert.ok(!facade.hasSession('test-delete-1'));
        assert.strictEqual(facade.removeSession('nonexistent'), false);

        facade.stopCleanupTimer();
        console.log('✅ Session removal works');
    }

    // 测试：上限
    {
        const facade = new DynamicSessionFacade({ skipRestore: true });
        facade.stopCleanupTimer();

        for (let i = 0; i < 9; i++) {
            facade.ensureSession(`test-limit-${i}`);
        }

        assert.throws(
            () => facade.ensureSession('test-limit-overflow'),
            /Maximum number of sessions reached/
        );

        facade.removeSession('test-limit-0');
        assert.doesNotThrow(() => facade.ensureSession('test-limit-new'));

        facade.stopCleanupTimer();
        console.log('✅ Session limit enforcement works');
    }

    // 测试：ArtifactsManager 隔离
    {
        const facade = new DynamicSessionFacade({ skipRestore: true });
        facade.stopCleanupTimer();

        facade.ensureSession('test-am-a');
        facade.ensureSession('test-am-b');

        const amA = facade.getArtifactsManager('test-am-a');
        const amB = facade.getArtifactsManager('test-am-b');

        assert.notStrictEqual(amA, amB, 'Different ArtifactsManager instances');

        facade.stopCleanupTimer();
        console.log('✅ ArtifactsManager isolation works');
    }

    // 测试：Checkpoint
    {
        const facade = new DynamicSessionFacade({ skipRestore: true });
        facade.stopCleanupTimer();

        facade.ensureSession('test-cp-1');

        const empty = await facade.readCheckpoint('test-cp-1');
        assert.strictEqual(empty, null);

        await facade.saveCheckpoint('test-cp-1', { hello: 'world' });
        const data = await facade.readCheckpoint('test-cp-1');
        assert.deepStrictEqual(data, { hello: 'world' });

        facade.stopCleanupTimer();
        console.log('✅ Checkpoint read/write works');
    }

    // 测试：恢复
    {
        const facade1 = new DynamicSessionFacade({ skipRestore: true });
        facade1.stopCleanupTimer();
        facade1.ensureSession('test-restore-1');
        facade1.updateStatus('test-restore-1', SessionStatus.PLANNING);
        facade1.stopCleanupTimer();

        const facade2 = new DynamicSessionFacade();
        facade2.stopCleanupTimer();

        assert.ok(facade2.hasSession('test-restore-1'), 'Should restore session');
        assert.strictEqual(facade2.getStatus('test-restore-1'), SessionStatus.PLANNING);

        facade2.stopCleanupTimer();
        console.log('✅ Directory scan restore works');
    }

    // 测试：TTL 清理
    {
        const facade = new DynamicSessionFacade({ skipRestore: true });
        facade.stopCleanupTimer();

        facade.ensureSession('test-ttl-1');
        facade.updateStatus('test-ttl-1', SessionStatus.COMPLETED);

        const state = facade.getState('test-ttl-1')!;
        state.lastActivityAt = Date.now() - (25 * 60 * 60 * 1000);

        facade.cleanupExpiredSessions();
        assert.ok(!facade.hasSession('test-ttl-1'), 'Expired session cleaned');

        facade.stopCleanupTimer();
        console.log('✅ TTL cleanup works');
    }

    cleanupTestSessions();
    console.log('\n=== All DynamicSessionFacade tests passed! ===');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
