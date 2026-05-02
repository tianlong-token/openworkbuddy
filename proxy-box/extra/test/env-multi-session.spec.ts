/**
 * PR1 单元测试 — ENV 改造验证
 *
 * 验证 getDefaultSessionId、multiSessionEnabled。
 * 运行方式：npx tsx src/test/multi-session/env-multi-session.spec.ts
 */

import assert from 'assert';

import { ENV, getDefaultSessionId, multiSessionEnabled, updateEnv } from '../../const/env';

process.env.NODE_ENV = 'test';

console.log('=== ENV Multi-Session Tests ===\n');

// 测试：getDefaultSessionId 返回 ENV.AGENT_ID
{
    assert.strictEqual(getDefaultSessionId(), ENV.AGENT_ID);
    console.log('✅ getDefaultSessionId returns ENV.AGENT_ID');
}

// 测试：updateEnv 更新 AGENT_ID 后 getDefaultSessionId 同步
{
    const oldId = ENV.AGENT_ID;

    updateEnv({ agentId: 'updated-via-updateenv' });
    assert.strictEqual(ENV.AGENT_ID, 'updated-via-updateenv');
    assert.strictEqual(getDefaultSessionId(), 'updated-via-updateenv');

    // 恢复
    updateEnv({ agentId: oldId });
    console.log('✅ updateEnv agentId syncs with getDefaultSessionId');
}

// 测试：multiSessionEnabled 动态读取 process.env
{
    const result = multiSessionEnabled();
    assert.strictEqual(typeof result, 'boolean');
    console.log(`✅ multiSessionEnabled() = ${result}`);

    // 验证动态性：设置后应返回 true
    const oldVal = process.env.SANDBOX_MULTI_SESSION;
    process.env.SANDBOX_MULTI_SESSION = '1';
    assert.strictEqual(multiSessionEnabled(), true);
    // 恢复
    if (oldVal === undefined) {
        delete process.env.SANDBOX_MULTI_SESSION;
    } else {
        process.env.SANDBOX_MULTI_SESSION = oldVal;
    }
    console.log('✅ multiSessionEnabled() dynamically reads process.env');
}

console.log('\n=== All ENV Multi-Session tests passed! ===');
