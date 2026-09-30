const SESSION_COOKIE = '__Host-poem_review';
const STATE_COOKIE = '__Host-poem_oauth_state';
const SESSION_SECONDS = 8 * 60 * 60;
const STATE_SECONDS = 10 * 60;
const HEADERS = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' };

function cookie(request, name) {
  const item = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return item ? item.slice(name.length + 1) : '';
}

function randomHex() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const text = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(text, c => c.charCodeAt(0));
  } catch { return null; }
}

async function signature(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function equal(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function makeSession(secret, email) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ email, expires: Date.now() + SESSION_SECONDS * 1000, nonce: randomHex() })));
  return payload + '.' + base64url(await signature(secret, payload));
}

async function readSession(secret, value) {
  const match = value.match(/^([A-Za-z0-9_-]{20,700})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return null;
  const expected = await signature(secret, match[1]);
  if (!equal(expected, fromBase64url(match[2]))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64url(match[1])));
    if (typeof data.email !== 'string' || !Number.isSafeInteger(data.expires) || data.expires <= Date.now() || data.expires > Date.now() + SESSION_SECONDS * 1000) return null;
    return data.email;
  } catch { return null; }
}

function reply(message, status = 403) {
  return new Response(message, { status, headers: { ...HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ ...HEADERS, location });
  for (const value of cookies) headers.append('set-cookie', value);
  return new Response(null, { status: 302, headers });
}

function loginPage() {
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>投稿审核登录</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f5f0;color:#2c2a28;font:16px/1.8 system-ui,sans-serif}main{max-width:430px;padding:32px}h1{font:normal 38px Georgia,serif}a{display:inline-block;background:#2c2a28;color:#fff;border-radius:999px;padding:10px 22px;text-decoration:none}a:focus-visible{outline:3px solid #d4b896}</style><main><h1>投稿审核</h1><p>请用维护者的 GitHub 账号登录。读者投稿无需 GitHub 账号。</p><a href="/auth/login">使用 GitHub 登录</a></main></html>`;
  return new Response(html, { headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
}

function configured(env) {
  return Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_SECRET && env.SESSION_SECRET && env.REVIEWER_EMAILS);
}

async function githubLogin(request, env) {
  if (!configured(env)) return reply('审核登录尚未配置', 503);
  const origin = new URL(request.url).origin;
  const state = randomHex();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', origin + '/auth/callback');
  authorize.searchParams.set('scope', 'user:email');
  authorize.searchParams.set('state', state);
  return redirect(authorize.href, [`${STATE_COOKIE}=${state}; Path=/; Max-Age=${STATE_SECONDS}; HttpOnly; Secure; SameSite=Lax`]);
}

async function githubCallback(request, env, allowed) {
  if (!configured(env)) return reply('审核登录尚未配置', 503);
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const saved = cookie(request, STATE_COOKIE);
  const clearState = `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  if (!/^[A-Za-z0-9_-]{8,512}$/.test(code) || !/^[a-f0-9]{64}$/.test(state) || !equal(new TextEncoder().encode(state), new TextEncoder().encode(saved))) return reply('登录验证已过期，请重新开始', 403);
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_SECRET, code, redirect_uri: url.origin + '/auth/callback' })
    });
    if (!tokenResponse.ok) return reply('GitHub 登录暂时不可用', 502);
    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string' || !token.access_token) return reply('GitHub 未批准登录', 403);
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: { accept: 'application/vnd.github+json', authorization: 'Bearer ' + token.access_token, 'user-agent': 'Poem-Ulysses-Review', 'x-github-api-version': '2022-11-28' }
    });
    if (!emailResponse.ok) return reply('无法核对 GitHub 邮箱', 403);
    const emails = await emailResponse.json();
    const matched = Array.isArray(emails) && emails.find(item => item.verified === true && typeof item.email === 'string' && allowed.includes(item.email.toLowerCase()));
    if (!matched) return reply('此 GitHub 账号没有获准的已验证邮箱', 403);
    const session = await makeSession(env.SESSION_SECRET, matched.email.toLowerCase());
    return redirect(url.origin + '/', [clearState, `${SESSION_COOKIE}=${session}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`]);
  } catch { return reply('GitHub 登录暂时不可用', 502); }
}

export async function authorizeReviewer(request, env, ctx, allowed) {
  const url = new URL(request.url);
  if (env.REVIEW_AUTH !== 'github') {
    let identity;
    try { identity = await ctx?.access?.getIdentity(); } catch { /* deny below */ }
    if (!identity?.email || !allowed.includes(identity.email.toLowerCase())) return { response: reply('无权访问') };
    return { email: identity.email.toLowerCase() };
  }
  if (request.method === 'GET' && url.pathname === '/auth/login') return { response: await githubLogin(request, env) };
  if (request.method === 'GET' && url.pathname === '/auth/callback') return { response: await githubCallback(request, env, allowed) };
  if (!configured(env)) return { response: reply('审核登录尚未配置', 503) };
  const email = await readSession(env.SESSION_SECRET, cookie(request, SESSION_COOKIE));
  if (!email || !allowed.includes(email.toLowerCase())) return { response: request.method === 'GET' && (url.pathname === '/' || url.pathname === '/poems' || url.pathname === '/admin') ? loginPage() : reply('请先登录', 401) };
  if (request.method === 'POST' && url.pathname === '/auth/logout') {
    if (request.headers.get('Origin') !== url.origin || request.headers.get('x-requested-with') !== 'poem-review') return { response: reply('请求来源无效') };
    return { response: redirect(url.origin + '/', [`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]) };
  }
  return { email };
}
