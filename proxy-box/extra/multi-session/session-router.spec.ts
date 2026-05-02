/**
 * PR1 单元测试 — SessionRouter + DefaultSessionFacade
 *
 * ⚠️ 本测试依赖完整 monorepo build（@genie/core 等）。
 * 运行前需先执行 `yarn compile` 或 `yarn build`。
 *
 * 运行方式：yarn compile && npx tsx packages/sandbox-proxy/src/test/session-router.spec.ts
 *
 * 如果无法运行完整 build，请使用以下无依赖的测试替代：
 * - env-multi-session.spec.ts — ENV 改造验证
 * - bound-session-handle.spec.ts — BoundSessionHandle 代理正确性
 * - validate-session-id.spec.ts — validateSessionId 安全校验
 * - idle-gate-session.spec.ts — IdleGate 隔离性
 */

import assert from 'assert';

import { getDefaultSessionId } from '../../const/env';
import {
    ensureSessionRouter,
    resetSessionRouter,
    SessionRouter,
} from '../../service/multi-session/session-router';

process.env.NODE_ENV = 'test';

function runTests() {
    console.log('=== SessionRouter Tests ===\n');

    // 每个测试前重置
    resetSessionRouter();

    // 测试：ensureSessionRouter 返回降级 router
    {
        resetSessionRouter();
        const router = ensureSessionRouter();
        assert.ok(router instanceof SessionRouter, 'Should return SessionRouter instance');
        console.log('✅ ensureSessionRouter returns fallback router');
    }

    // 测试：route(undefined) 路由到默认 session
    {
        resetSessionRouter();
        const router = ensureSessionRouter();
        const handle = router.route(undefined);
        assert.strictEqual(handle.sessionId, getDefaultSessionId());
        console.log('✅ route(undefined) routes to default session');
    }

    // 测试：isDefaultSession
    {
        resetSessionRouter();
        const router = ensureSessionRouter();
        const defaultId = getDefaultSessionId();
        assert.strictEqual(router.isDefaultSession(defaultId), true);
        assert.strictEqual(router.isDefaultSession('other-session'), false);
        console.log('✅ isDefaultSession works correctly');
    }

    // 测试：DefaultSessionFacade 默认 session 不可删除
    {
        resetSessionRouter();
        const router = ensureSessionRouter();
        const handle = router.route();
        assert.strictEqual(handle.removeSession(), false);
        console.log('✅ Default session cannot be removed');
    }

    // 测试：getAllSessionIds 包含默认 session
    {
        resetSessionRouter();
        const router = ensureSessionRouter();
        const allIds = router.getAllSessionIds();
        assert.ok(allIds.includes(getDefaultSessionId()));
        assert.strictEqual(allIds.length, 1);
        console.log('✅ getAllSessionIds includes default session');
    }

    // 测试：getSessionCount
    {
        resetSessionRouter();
        const router = ensureSessionRouter();
        assert.strictEqual(router.getSessionCount(), 1);
        console.log('✅ getSessionCount returns 1 in fallback mode');
    }

    resetSessionRouter();
    console.log('\n=== All SessionRouter tests passed! ===');
}

runTests();
