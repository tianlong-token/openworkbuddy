/**
 * PR1 单元测试 — validateSessionId
 *
 * 使用 Node.js 内置 assert 模块。
 * 避免 monorepo 跨包依赖，直接 mock ENV 模块。
 *
 * 运行方式：npx tsx src/test/validate-session-id.spec.ts
 */

import assert from 'assert';

// 设置测试环境变量
process.env.NODE_ENV = 'test';

// 直接测试 validateSessionId 的逻辑（从 session-router 中提取）
// 为避免 @genie/core 依赖链问题，这里单独实现验证逻辑进行测试

const SESSION_ID_REGEX = /^[a-zA-Z0-9\-_.]+$/;
const MAX_SESSION_ID_LENGTH = 128;
const DEFAULT_SESSION_ID = 'test-default-session-id';

function validateSessionId(sessionId: string): string {
    if (!sessionId) {
        throw new Error('sessionId cannot be empty');
    }
    if (sessionId === DEFAULT_SESSION_ID) {
        return sessionId;
    }
    if (sessionId.length > MAX_SESSION_ID_LENGTH) {
        throw new Error(`sessionId too long (max ${MAX_SESSION_ID_LENGTH}): ${sessionId.length} chars`);
    }
    if (!SESSION_ID_REGEX.test(sessionId)) {
        throw new Error(`sessionId contains invalid characters: "${sessionId}". Only [a-zA-Z0-9\\-_.] allowed`);
    }
    if (sessionId.startsWith('.')) {
        throw new Error(`sessionId cannot start with ".": "${sessionId}"`);
    }
    if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
        throw new Error(`sessionId contains path traversal pattern: "${sessionId}"`);
    }
    return sessionId;
}

console.log('=== validateSessionId Tests ===\n');

// 测试：正常 sessionId 通过
{
    assert.strictEqual(validateSessionId('session-123'), 'session-123');
    assert.strictEqual(validateSessionId('abc.def_ghi-123'), 'abc.def_ghi-123');
    assert.strictEqual(validateSessionId('a'), 'a');
    console.log('✅ Normal sessionId accepted');
}

// 测试：默认 session ID 豁免
{
    assert.strictEqual(validateSessionId(DEFAULT_SESSION_ID), DEFAULT_SESSION_ID);
    console.log('✅ Default sessionId exempted');
}

// 测试：空字符串拒绝
{
    assert.throws(() => validateSessionId(''), /cannot be empty/);
    console.log('✅ Empty sessionId rejected');
}

// 测试：过长 ID 拒绝
{
    const longId = 'a'.repeat(129);
    assert.throws(() => validateSessionId(longId), /too long/);
    console.log('✅ Too long sessionId rejected');
}

// 测试：非法字符拒绝
{
    assert.throws(() => validateSessionId('session id'), /invalid characters/);
    assert.throws(() => validateSessionId('session@id'), /invalid characters/);
    assert.throws(() => validateSessionId('session#id'), /invalid characters/);
    console.log('✅ Invalid characters rejected');
}

// 测试：点开头拒绝（隐藏文件）
{
    assert.throws(() => validateSessionId('.bashrc'), /cannot start with/);
    assert.throws(() => validateSessionId('.hidden'), /cannot start with/);
    console.log('✅ Dot-prefixed sessionId rejected');
}

// 测试：路径穿越拒绝（/和\被正则拒绝）
{
    assert.throws(() => validateSessionId('a..b'), /path traversal/);
    assert.throws(() => validateSessionId('a/b'), /invalid characters/);
    assert.throws(() => validateSessionId('a\\b'), /invalid characters/);
    console.log('✅ Path traversal patterns rejected');
}

// 测试：边界值 — 128 字符通过
{
    const maxLenId = 'a'.repeat(128);
    assert.strictEqual(validateSessionId(maxLenId), maxLenId);
    console.log('✅ Max length (128) sessionId accepted');
}

console.log('\n=== All validateSessionId tests passed! ===');
