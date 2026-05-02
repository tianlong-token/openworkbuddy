/**
 * 单元测试 — IdleGate
 *
 * 使用 Node.js 内置 assert 模块，无跨包依赖。
 * 运行方式：npx tsx src/test/multi-session/idle-gate-session.spec.ts
 */

import assert from 'assert';

import { IdleGate } from '../../service/idle-gate';

process.env.NODE_ENV = 'test';

async function runTests() {
    console.log('=== IdleGate Tests ===\n');

    // 测试：idle 状态直接返回
    {
        const gate = new IdleGate('test-1');
        const mockSession = { state: 'idle' };
        await gate.waitForIdle(mockSession);
        assert.strictEqual(gate.pendingCount, 0);
        console.log('✅ Idle state resolves immediately');
    }

    // 测试：非 idle 状态等待，notifyIdle 唤醒
    {
        const gate = new IdleGate('test-2');
        const mockSession = { state: 'running' };

        let resolved = false;
        const promise = gate.waitForIdle(mockSession).then(() => {
            resolved = true;
        });

        assert.strictEqual(gate.pendingCount, 1);
        assert.strictEqual(resolved, false);

        gate.notifyIdle();

        await promise;
        assert.strictEqual(resolved, true);
        assert.strictEqual(gate.pendingCount, 0);
        console.log('✅ Wait + notifyIdle works');
    }

    // 测试：多个 waiter 全部唤醒
    {
        const gate = new IdleGate('test-3');
        const mockSession = { state: 'running' };

        let count = 0;
        const p1 = gate.waitForIdle(mockSession).then(() => count++);
        const p2 = gate.waitForIdle(mockSession).then(() => count++);
        const p3 = gate.waitForIdle(mockSession).then(() => count++);

        assert.strictEqual(gate.pendingCount, 3);

        gate.notifyIdle();

        await Promise.all([p1, p2, p3]);
        assert.strictEqual(count, 3);
        assert.strictEqual(gate.pendingCount, 0);
        console.log('✅ Multiple waiters all notified');
    }

    // 测试：reset 清空所有 waiter
    {
        const gate = new IdleGate('test-4');
        const mockSession = { state: 'running' };

        let count = 0;
        const p1 = gate.waitForIdle(mockSession).then(() => count++);
        const p2 = gate.waitForIdle(mockSession).then(() => count++);

        assert.strictEqual(gate.pendingCount, 2);

        gate.reset();

        await Promise.all([p1, p2]);
        assert.strictEqual(count, 2);
        assert.strictEqual(gate.pendingCount, 0);
        console.log('✅ Reset clears all waiters');
    }

    // 测试：超时自动 resolve
    {
        const gate = new IdleGate('test-5');
        const mockSession = { state: 'running' };

        const start = Date.now();
        await gate.waitForIdle(mockSession, 100);
        const elapsed = Date.now() - start;

        assert.ok(elapsed >= 80, `Should wait at least 80ms, got ${elapsed}ms`);
        assert.strictEqual(gate.pendingCount, 0);
        console.log('✅ Timeout auto-resolves');
    }

    // 测试：不同实例相互独立
    {
        const gateA = new IdleGate('session-a');
        const gateB = new IdleGate('session-b');
        const mockSession = { state: 'running' };

        let resolvedA = false;
        let resolvedB = false;

        const pA = gateA.waitForIdle(mockSession).then(() => { resolvedA = true; });
        const pB = gateB.waitForIdle(mockSession).then(() => { resolvedB = true; });

        gateA.notifyIdle();
        await pA;

        assert.strictEqual(resolvedA, true);
        assert.strictEqual(resolvedB, false);
        assert.strictEqual(gateA.pendingCount, 0);
        assert.strictEqual(gateB.pendingCount, 1);

        gateB.notifyIdle();
        await pB;

        assert.strictEqual(resolvedB, true);
        console.log('✅ Different instances are independent');
    }

    // 测试：全局单例
    {
        const instance1 = IdleGate.getInstance();
        const instance2 = IdleGate.getInstance();
        assert.strictEqual(instance1, instance2);
        console.log('✅ getInstance returns singleton');
    }

    console.log('\n=== All IdleGate tests passed! ===');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
