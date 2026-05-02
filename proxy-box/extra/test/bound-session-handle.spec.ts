/**
 * PR1 单元测试 — BoundSessionHandle 代理正确性
 *
 * 测试 BoundSessionHandle 是否正确将所有方法委托到 ISessionFacade。
 * 使用纯 mock，无跨包依赖。
 *
 * 运行方式：npx tsx src/test/bound-session-handle.spec.ts
 */

import assert from 'assert';

import { BoundSessionHandle, ISessionFacade } from '../../service/multi-session/session-router-protocol';
import { SessionStatus } from '../../types';

process.env.NODE_ENV = 'test';

console.log('=== BoundSessionHandle Tests ===\n');

// 创建 mock facade 记录所有调用
function createMockFacade(): { facade: ISessionFacade; calls: Array<{ method: string; args: any[] }> } {
    const calls: Array<{ method: string; args: any[] }> = [];

    const facade: ISessionFacade = {
        ensureSession(sid) { calls.push({ method: 'ensureSession', args: [sid] }); return { sessionId: sid, cwd: '/workspace', createdAt: 1, lastActivityAt: 1 }; },
        getState(sid) { calls.push({ method: 'getState', args: [sid] }); return { sessionId: sid, cwd: '/workspace', createdAt: 1, lastActivityAt: 1 }; },
        getStatus(sid) { calls.push({ method: 'getStatus', args: [sid] }); return SessionStatus.COMPLETED; },
        updateStatus(sid, status) { calls.push({ method: 'updateStatus', args: [sid, status] }); },
        getWebhookService(sid) { calls.push({ method: 'getWebhookService', args: [sid] }); return null; },
        setWebhookService(sid, service) { calls.push({ method: 'setWebhookService', args: [sid, service] }); },
        getArtifactsManager(sid) { calls.push({ method: 'getArtifactsManager', args: [sid] }); return {} as any; },
        getIdleGate(sid) { calls.push({ method: 'getIdleGate', args: [sid] }); return {} as any; },
        saveCheckpoint(sid, data) { calls.push({ method: 'saveCheckpoint', args: [sid, data] }); return Promise.resolve(); },
        readCheckpoint(sid) { calls.push({ method: 'readCheckpoint', args: [sid] }); return Promise.resolve(null); },
        removeSession(sid) { calls.push({ method: 'removeSession', args: [sid] }); return true; },
        setConfigValue(sid, configId, value) { calls.push({ method: 'setConfigValue', args: [sid, configId, value] }); },
        getPersistedConfig(sid) { calls.push({ method: 'getPersistedConfig', args: [sid] }); return {}; },
        getBroadcast(sid) { calls.push({ method: 'getBroadcast', args: [sid] }); return undefined; },
        setBroadcast(sid, fn) { calls.push({ method: 'setBroadcast', args: [sid, fn] }); },
    };

    return { facade, calls };
}

// 测试：所有方法正确委托并传入 sessionId
{
    const { facade, calls } = createMockFacade();
    const handle = new BoundSessionHandle(facade, 'test-session-42');

    assert.strictEqual(handle.sessionId, 'test-session-42');

    handle.ensureSession();
    handle.getState();
    handle.getStatus();
    handle.updateStatus(SessionStatus.PLANNING);
    handle.getWebhookService();
    handle.setWebhookService(null);
    handle.getArtifactsManager();
    handle.getIdleGate();
    handle.removeSession();
    handle.setConfigValue('language', 'English');
    handle.getPersistedConfig();

    // 测试 setBroadcast — 通过 facade 方法调用验证
    const mockBroadcastFn = async () => {};
    handle.setBroadcast(mockBroadcastFn);

    // 验证每个方法都被调用了，且 sessionId 正确传递
    const expectedMethods = [
        'ensureSession', 'getState', 'getStatus', 'updateStatus',
        'getWebhookService', 'setWebhookService', 'getArtifactsManager',
        'getIdleGate', 'removeSession', 'setConfigValue', 'getPersistedConfig', 'setBroadcast',
    ];

    assert.strictEqual(calls.length, expectedMethods.length, `Expected ${expectedMethods.length} calls, got ${calls.length}`);

    for (let i = 0; i < expectedMethods.length; i++) {
        assert.strictEqual(calls[i].method, expectedMethods[i], `Call ${i} method mismatch`);
        // sessionId 应该在 args 中（可能是第一个或最后一个参数）
        const args = calls[i].args;
        const hasSessionId = args.includes('test-session-42');
        assert.ok(hasSessionId, `Call ${i} (${calls[i].method}) should pass sessionId`);
    }

    console.log('✅ All methods correctly delegate to facade with sessionId');
}

// 测试：async 方法也正确委托
async function testAsync() {
    const { facade, calls } = createMockFacade();
    const handle = new BoundSessionHandle(facade, 'async-test');

    await handle.saveCheckpoint({ data: 1 });
    await handle.readCheckpoint();

    const checkpointCalls = calls.filter(c => c.method.includes('Checkpoint'));
    assert.strictEqual(checkpointCalls.length, 2);
    assert.ok(checkpointCalls[0].args.includes('async-test'));
    assert.ok(checkpointCalls[1].args.includes('async-test'));
    console.log('✅ Async methods delegate correctly');
}

testAsync().then(async () => {
    // 测试：updateStatus 正确传递 status 和 sessionId
    {
        const { facade, calls } = createMockFacade();
        const handle = new BoundSessionHandle(facade, 'status-test');

        handle.updateStatus(SessionStatus.WORKING);

        const call = calls.find(c => c.method === 'updateStatus');
        assert.ok(call);
        assert.deepStrictEqual(call!.args, ['status-test', SessionStatus.WORKING]);
        console.log('✅ updateStatus passes (sessionId, status) in correct order');
    }

    // 测试：broadcast getter — 未注入时返回 uninitializedBroadcast（Null Object）
    {
        const { facade } = createMockFacade();
        const handle = new BoundSessionHandle(facade, 'broadcast-test-1');

        // getBroadcast 返回 undefined → broadcast 应为 uninitializedBroadcast
        const broadcastFn = handle.broadcast;
        assert.strictEqual(typeof broadcastFn, 'function', 'broadcast should be a function even when uninitialized');

        // 调用 uninitializedBroadcast 不应抛异常（Null Object 模式）
        // 它只是打印警告并丢弃消息
        await broadcastFn('test/method', { data: 'test' });
        console.log('✅ broadcast getter returns uninitializedBroadcast (no-throw) when not injected');
    }

    // 测试：broadcast getter — 注入后返回已注册的函数
    {
        const { facade } = createMockFacade();
        const handle = new BoundSessionHandle(facade, 'broadcast-test-2');

        let broadcastCalled = false;
        const mockBroadcast: typeof handle.broadcast = async (_method, _params) => { broadcastCalled = true; };

        handle.setBroadcast(mockBroadcast);

        // 需要重新获取 broadcast（getter 每次调用 facade.getBroadcast）
        // 但由于 mock facade 的 getBroadcast 只记录调用不存储，
        // 我们用一个增强版 mock 来测试
        // 创建一个带存储的 facade 来验证完整流程
        const storedBroadcasts = new Map<string, any>();
        const storageFacade: ISessionFacade = {
            ...facade,
            setBroadcast(sid: string, fn: any) { storedBroadcasts.set(sid, fn); },
            getBroadcast(sid: string) { return storedBroadcasts.get(sid); },
        };
        const handle2 = new BoundSessionHandle(storageFacade, 'broadcast-test-3');
        handle2.setBroadcast(mockBroadcast);

        const retrievedBroadcast = handle2.broadcast;
        assert.strictEqual(retrievedBroadcast, mockBroadcast, 'broadcast getter should return the injected function');

        await retrievedBroadcast('test/method', {});
        assert.strictEqual(broadcastCalled, true, 'injected broadcast should be called');
        console.log('✅ broadcast getter returns injected function after setBroadcast');
    }

    console.log('\n=== All BoundSessionHandle tests passed! ===');
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
