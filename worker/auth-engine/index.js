/**
 * Authentication & OTP Bot Engine v1.0
 * Cloudflare Worker + D1 + Telegram OTP Bot.
 *
 * Routes:
 * POST /api/auth/start       { action: "register"|"login", telegramUsername, displayName? }
 * POST /api/auth/verify      { challengeId, otp }
 * GET  /api/auth/me
 * POST /api/auth/logout
 * POST /api/telegram/webhook (Telegram webhook; protected by Telegram secret_token)
 *
 * Secrets (never put in source control):
 * TELEGRAM_OTP_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, OTP_PEPPER
 * Bind D1 as DB. Set ALLOWED_ORIGIN to the exact frontend origin.
 */
const CHALLENGE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_OTP_ATTEMPTS = 5;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
function now() { return Math.floor(Date.now() / 1000); }
function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}
function randomHex(bytes = 24) {
  const array = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}
function randomOtp() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1000000).padStart(6, "0");
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function otpHash(env, challengeId, otp) {
  return sha256(`${env.OTP_PEPPER}:${challengeId}:${otp}`);
}
function cookieValue(request, name) {
  const raw = request.headers.get("cookie") || "";
  const entry = raw.split(";").map(part => part.trim()).find(part => part.startsWith(name + "="));
  return entry ? entry.slice(name.length + 1) : "";
}
function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const allowed = env.ALLOWED_ORIGIN || "";
  if (!origin || origin !== allowed) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin"
  };
}
function cookieHeader(token, maxAge) {
  return `tbmc_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}
async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_OTP_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error("TELEGRAM_API_FAILED");
  return data.result;
}
async function sendMessage(env, chatId, text) {
  return telegram(env, "sendMessage", { chat_id: chatId, text, protect_content: true });
}
function botStartUrl(env, challengeId) {
  const username = String(env.TELEGRAM_OTP_BOT_USERNAME || "").replace(/^@/, "");
  return `https://t.me/${username}?start=${encodeURIComponent(challengeId)}`;
}
async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
function validUsername(username) {
  return /^[a-z0-9_]{5,32}$/.test(username);
}
async function currentSession(request, env, extend = true) {
  const token = cookieValue(request, "tbmc_session");
  if (!token || token.length < 40) return null;
  const tokenHash = await sha256(token);
  const timestamp = now();
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.user_id, s.expires_at, u.telegram_username, u.display_name, u.role, u.status
     FROM auth_sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active' LIMIT 1`
  ).bind(tokenHash, timestamp).first();
  if (!row) return null;
  if (extend) {
    await env.DB.prepare("UPDATE auth_sessions SET last_seen_at=?, expires_at=? WHERE id=?")
      .bind(timestamp, timestamp + SESSION_TTL_SECONDS, row.session_id).run();
  }
  return row;
}
async function startChallenge(request, env) {
  const body = await readJson(request);
  if (!body || !["register", "login"].includes(body.action)) return json({ error: "INVALID_REQUEST" }, 400);
  const username = normalizeUsername(body.telegramUsername);
  const displayName = String(body.displayName || "").trim().slice(0, 80);
  if (!validUsername(username)) return json({ error: "INVALID_TELEGRAM_USERNAME" }, 400);
  if (body.action === "register" && displayName.length < 2) return json({ error: "DISPLAY_NAME_REQUIRED" }, 400);

  const timestamp = now();
  // Reduce automated challenge flooding per username; old challenges are not reusable.
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM auth_challenges WHERE telegram_username=? AND created_at>?"
  ).bind(username, timestamp - 15 * 60).first();
  if (Number(recent?.count || 0) >= 3) return json({ error: "TOO_MANY_REQUESTS", message: "Wait a few minutes before trying again." }, 429);

  const id = randomHex(16);
  await env.DB.prepare(
    "INSERT INTO auth_challenges (id,action,telegram_username,display_name,status,created_at,expires_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(id, body.action, username, body.action === "register" ? displayName : null, "pending", timestamp, timestamp + CHALLENGE_TTL_SECONDS).run();

  return json({
    challengeId: id,
    expiresInSeconds: CHALLENGE_TTL_SECONDS,
    botStartUrl: botStartUrl(env, id),
    message: "Open the OTP bot using the button, press Start, then enter the code sent by the bot here."
  }, 201);
}
async function telegramWebhook(request, env) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) return json({ error: "UNAUTHORIZED" }, 401);
  const update = await readJson(request);
  const message = update?.message;
  const text = String(message?.text || "");
  const match = text.match(/^\/start(?:\s+([a-f0-9]{32}))?$/i);
  if (!message?.from?.id || !message?.chat?.id || !match?.[1]) {
    if (message?.chat?.id) await sendMessage(env, message.chat.id, "To sign in or register, open the OTP bot from the website's verification button. Do not share your OTP with anyone.");
    return json({ ok: true });
  }

  const challengeId = match[1].toLowerCase();
  const timestamp = now();
  const challenge = await env.DB.prepare(
    "SELECT * FROM auth_challenges WHERE id=? AND status='pending' AND expires_at>? LIMIT 1"
  ).bind(challengeId, timestamp).first();
  if (!challenge) {
    await sendMessage(env, message.chat.id, "This verification link has expired or was already used. Return to the website and request a new code.");
    return json({ ok: true });
  }

  const telegramUserId = String(message.from.id);
  const actualUsername = normalizeUsername(message.from.username || "");
  if (!actualUsername || actualUsername !== challenge.telegram_username) {
    await sendMessage(env, message.chat.id, "The Telegram username does not match the username entered on the website. Return and try again with your exact Telegram username.");
    await env.DB.prepare("UPDATE auth_challenges SET status='cancelled' WHERE id=?").bind(challengeId).run();
    return json({ ok: true });
  }

  if (challenge.action === "register") {
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE telegram_username=? COLLATE NOCASE OR telegram_user_id=? LIMIT 1"
    ).bind(actualUsername, telegramUserId).first();
    if (existing) {
      await sendMessage(env, message.chat.id, "An account already exists for this Telegram identity. Use Login instead.");
      await env.DB.prepare("UPDATE auth_challenges SET status='cancelled' WHERE id=?").bind(challengeId).run();
      return json({ ok: true });
    }
  } else {
    const user = await env.DB.prepare(
      "SELECT id,telegram_user_id,status FROM users WHERE telegram_username=? COLLATE NOCASE LIMIT 1"
    ).bind(actualUsername).first();
    if (!user || user.telegram_user_id !== telegramUserId || user.status !== "active") {
      await sendMessage(env, message.chat.id, "We could not verify this account. Check the username or contact the administrator.");
      await env.DB.prepare("UPDATE auth_challenges SET status='cancelled' WHERE id=?").bind(challengeId).run();
      return json({ ok: true });
    }
  }

  const otp = randomOtp();
  const hash = await otpHash(env, challengeId, otp);
  await env.DB.prepare(
    "UPDATE auth_challenges SET telegram_user_id=?,otp_hash=?,status='otp_sent' WHERE id=? AND status='pending'"
  ).bind(telegramUserId, hash, challengeId).run();
  await sendMessage(env, message.chat.id, `Your Telegram Bot Master Catalog verification code is: ${otp}\n\nIt expires in 10 minutes. Never share this code. If you did not request it, ignore this message.`);
  return json({ ok: true });
}
async function verifyOtp(request, env) {
  const body = await readJson(request);
  const challengeId = String(body?.challengeId || "");
  const otp = String(body?.otp || "").trim();
  if (!/^[a-f0-9]{32}$/.test(challengeId) || !/^\d{6}$/.test(otp)) return json({ error: "INVALID_CODE" }, 400);
  const timestamp = now();
  const challenge = await env.DB.prepare("SELECT * FROM auth_challenges WHERE id=? LIMIT 1").bind(challengeId).first();
  if (!challenge || challenge.status !== "otp_sent" || challenge.expires_at <= timestamp) {
    if (challenge && challenge.status !== "verified") await env.DB.prepare("UPDATE auth_challenges SET status='expired' WHERE id=?").bind(challengeId).run();
    return json({ error: "CHALLENGE_EXPIRED", message: "The verification code expired. Start again." }, 400);
  }
  if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
    await env.DB.prepare("UPDATE auth_challenges SET status='locked' WHERE id=?").bind(challengeId).run();
    return json({ error: "TOO_MANY_ATTEMPTS" }, 429);
  }
  const expectedHash = await otpHash(env, challengeId, otp);
  if (expectedHash !== challenge.otp_hash) {
    const attempts = challenge.attempts + 1;
    await env.DB.prepare("UPDATE auth_challenges SET attempts=?,status=? WHERE id=?")
      .bind(attempts, attempts >= MAX_OTP_ATTEMPTS ? "locked" : "otp_sent", challengeId).run();
    return json({ error: "INVALID_CODE", attemptsRemaining: Math.max(0, MAX_OTP_ATTEMPTS - attempts) }, 401);
  }

  let userId;
  if (challenge.action === "register") {
    userId = randomHex(16);
    const created = await env.DB.prepare(
      "INSERT INTO users (id,telegram_user_id,telegram_username,display_name,role,status,created_at,updated_at,last_login_at) VALUES (?,?,?,?, 'user','active',?,?,?)"
    ).bind(userId, challenge.telegram_user_id, challenge.telegram_username, challenge.display_name, timestamp, timestamp, timestamp).run();
    if (!created.success) return json({ error: "REGISTRATION_FAILED" }, 409);
  } else {
    const user = await env.DB.prepare(
      "SELECT id FROM users WHERE telegram_username=? COLLATE NOCASE AND telegram_user_id=? AND status='active' LIMIT 1"
    ).bind(challenge.telegram_username, challenge.telegram_user_id).first();
    if (!user) return json({ error: "ACCOUNT_NOT_FOUND" }, 401);
    userId = user.id;
    await env.DB.prepare("UPDATE users SET last_login_at=?,updated_at=? WHERE id=?").bind(timestamp, timestamp, userId).run();
  }

  const sessionToken = randomHex(32);
  const sessionId = randomHex(16);
  await env.DB.prepare(
    "INSERT INTO auth_sessions (id,user_id,token_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?)"
  ).bind(sessionId, userId, await sha256(sessionToken), timestamp, timestamp, timestamp + SESSION_TTL_SECONDS).run();
  await env.DB.prepare("UPDATE auth_challenges SET status='verified',verified_at=? WHERE id=?").bind(timestamp, challengeId).run();
  const user = await env.DB.prepare("SELECT id,telegram_username,display_name,role FROM users WHERE id=?").bind(userId).first();
  return json({ authenticated: true, user, sessionExpiresInSeconds: SESSION_TTL_SECONDS }, 200, {
    "set-cookie": cookieHeader(sessionToken, SESSION_TTL_SECONDS)
  });
}
async function health(env) {
  const checks = { database: false, telegramToken: Boolean(env.TELEGRAM_OTP_BOT_TOKEN), webhookConfigured: false, secretsConfigured: Boolean(env.TELEGRAM_WEBHOOK_SECRET && env.OTP_PEPPER && env.TELEGRAM_OTP_BOT_USERNAME) };
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    checks.database = true;
  } catch (_) {}
  if (checks.telegramToken) {
    try {
      const info = await telegram(env, "getWebhookInfo", {});
      const expectedSuffix = "/api/telegram/webhook";
      checks.webhookConfigured = typeof info.url === "string" && info.url.endsWith(expectedSuffix) && !info.last_error_message;
    } catch (_) {}
  }
  const ready = Object.values(checks).every(Boolean);
  return json({ ready, checks, checkedAt: new Date().toISOString() }, ready ? 200 : 503);
}
async function me(request, env) {
  const session = await currentSession(request, env, true);
  if (!session) return json({ authenticated: false }, 401);
  return json({
    authenticated: true,
    user: { id: session.user_id, telegramUsername: session.telegram_username, displayName: session.display_name, role: session.role },
    sessionExpiresAt: session.expires_at
  });
}
async function logout(request, env) {
  const token = cookieValue(request, "tbmc_session");
  if (token) {
    await env.DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL")
      .bind(now(), await sha256(token)).run();
  }
  return json({ authenticated: false, message: "Signed out." }, 200, {
    "set-cookie": cookieHeader("", 0)
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === "/api/telegram/webhook" && request.method === "POST") {
        if (!env.DB || !env.TELEGRAM_OTP_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.OTP_PEPPER) {
          return json({ error: "AUTH_SERVICE_NOT_CONFIGURED" }, 503);
        }
        return await telegramWebhook(request, env);
      }
      let response;
      if (url.pathname === "/api/auth/health" && request.method === "GET") response = await health(env);
      else if (url.pathname.startsWith("/api/auth/") &&
          (!env.DB || !env.TELEGRAM_OTP_BOT_TOKEN || !env.TELEGRAM_OTP_BOT_USERNAME || !env.TELEGRAM_WEBHOOK_SECRET || !env.OTP_PEPPER)) {
        response = json({ error: "AUTH_SERVICE_NOT_CONFIGURED", message: "The secure authentication service is not fully configured." }, 503);
      } else if (url.pathname === "/api/auth/start" && request.method === "POST") response = await startChallenge(request, env);
      else if (url.pathname === "/api/auth/verify" && request.method === "POST") response = await verifyOtp(request, env);
      else if (url.pathname === "/api/auth/me" && request.method === "GET") response = await me(request, env);
      else if (url.pathname === "/api/auth/logout" && request.method === "POST") response = await logout(request, env);
      else response = json({ error: "NOT_FOUND" }, 404);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      // Never log request bodies, OTPs, session tokens, or bot credentials.
      console.error("auth-engine-error", error?.message === "TELEGRAM_API_FAILED" ? "TELEGRAM_API_FAILED" : "INTERNAL_ERROR");
      return json({ error: "INTERNAL_ERROR", message: "The authentication service is temporarily unavailable." }, 500, cors);
    }
  }
};
