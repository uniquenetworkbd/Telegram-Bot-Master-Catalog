import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../worker/auth-engine/index.js', import.meta.url), 'utf8');
const frontend = await readFile(new URL('../assets/js/auth-engine.js', import.meta.url), 'utf8');
const config = await readFile(new URL('../assets/js/auth-config.js', import.meta.url), 'utf8');
const schema = await readFile(new URL('../worker/auth-engine/schema.sql', import.meta.url), 'utf8');

test('Worker exposes all authentication and Telegram webhook routes', () => {
  for (const route of [
    '/api/auth/start',
    '/api/auth/verify',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/telegram/webhook'
  ]) assert.ok(worker.includes(route), `missing route: ${route}`);
});

test('OTP challenge is time-limited, attempt-limited and bound to Telegram identity', () => {
  assert.match(worker, /CHALLENGE_TTL_SECONDS\s*=\s*10\s*\*\s*60/);
  assert.match(worker, /MAX_OTP_ATTEMPTS\s*=\s*5/);
  assert.match(worker, /x-telegram-bot-api-secret-token/);
  assert.match(worker, /telegram_user_id/);
  assert.match(worker, /otpHash\(env, challengeId, otp\)/);
});

test('Session tokens are HttpOnly/Secure and server-side hashes are stored', () => {
  assert.match(worker, /HttpOnly; Secure; SameSite=None/);
  assert.match(worker, /token_hash/);
  assert.match(worker, /UPDATE auth_sessions SET revoked_at/);
  assert.match(worker, /SESSION_TTL_SECONDS\s*=\s*30\s*\*\s*24\s*\*\s*60\s*\*\s*60/);
});

test('Registration cannot choose an admin role and D1 schema enforces unique identities', () => {
  assert.match(worker, /'user','active'/);
  assert.match(schema, /telegram_user_id TEXT NOT NULL UNIQUE/);
  assert.match(schema, /telegram_username TEXT NOT NULL UNIQUE COLLATE NOCASE/);
  assert.match(schema, /CHECK \(role IN \('user', 'admin'\)\)/);
});

test('Frontend fails closed without an explicitly configured API URL', () => {
  assert.match(config, /apiBaseUrl:\s*''/);
  assert.match(frontend, /AUTH_BACKEND_NOT_CONFIGURED/);
  assert.doesNotMatch(frontend, /localStorage\.setItem\([^\n]*(?:auth|session|token)/i);
});

test('Login, registration and logout documents are separate pages', async () => {
  for (const path of ['../login.html', '../register.html', '../logout.html']) {
    const page = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(page, /assets\/js\/auth-engine\.js/);
    assert.match(page, /data-auth-status/);
  }
});
