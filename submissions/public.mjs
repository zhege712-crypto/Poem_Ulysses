import { securityRate, burstRate, submissionsPaused } from './security.mjs';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function cors(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== env.ALLOWED_ORIGIN) return null;
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type', 'vary': 'Origin' };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function receiptToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function clean(value) { return typeof value === 'string' ? value.trim() : ''; }

async function readBody(request, limit = 60000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('请使用正确的提交格式');
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > limit) throw new Error('稿件过长');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > limit) throw new Error('稿件过长');
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new Error('提交内容无法读取'); }
}

async function verifyTurnstile(token, ip, env) {
  if (!token || !env.TURNSTILE_SECRET || !env.PUBLIC_HOSTNAME) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && result.hostname === env.PUBLIC_HOSTNAME;
}

async function consumeRateLimit(env, ip, now) {
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  for (const [window, limit, expires] of [
    ['hour:' + hour, 5, new Date(now.getTime() + 3600000).toISOString()],
    ['day:' + day, 15, new Date(now.getTime() + 86400000).toISOString()]
  ]) {
    const key = await hmac(env.RATE_SECRET, ip + ':' + window);
    await env.DB.prepare('INSERT INTO submission_rate (rate_key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(rate_key) DO UPDATE SET count = count + 1').bind(key, expires).run();
    const row = await env.DB.prepare('SELECT count FROM submission_rate WHERE rate_key = ?').bind(key).first();
    if (row.count > limit) return false;
  }
  return true;
}

async function submit(request, env, headers) {
  let body;
  try { body = await readBody(request); }
  catch (error) { return json({ error: error.message }, 400, headers); }
  if (clean(body.website)) return json({ ok: true }, 200, headers);
  const title = clean(body.title);
  const author = clean(body.author);
  const content = clean(body.content).replace(/\r\n?/g, '\n');
  const contact = clean(body.contact);
  const date = clean(body.date), series = clean(body.series), subseries = clean(body.subseries);
  const invalidMetadata = ['date', 'series', 'subseries'].some(key => body[key] !== undefined && typeof body[key] !== 'string');
  const parsedDate = date ? new Date(date + 'T00:00:00Z') : null;
  if (invalidMetadata || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date)) || series.length > 60 || subseries.length > 60 || /[\u0000-\u001f<>]/.test(series + subseries)) {
    return json({ error: '请检查作品日期、合集和子分类，日期须为有效的年月日，合集及子分类最多 60 字' }, 400, headers);
  }
  if (!title || title.length > 80 || !author || author.length > 40 || content.length < 2 || content.length > 12000 || contact.length > 120 || body.consent !== true) {
    return json({ error: '请检查标题、笔名、正文及公开发表确认' }, 400, headers);
  }
  let statusPage;
  try {
    statusPage = new URL('status.html', env.PUBLIC_SITE_URL);
    if (statusPage.protocol !== 'https:') throw new Error();
  } catch { return json({ error: '投稿服务配置有误，请联系维护者' }, 503, headers); }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json({ error: '暂时无法验证投稿来源，请稍后重试' }, 503, headers);
  try {
    if(await submissionsPaused(env))return json({error:'目前暂停接收新投稿，请稍后重试。稿件仍保留在此页面，也可使用邮件备用入口。'},503,headers);
    if (!await verifyTurnstile(clean(body.turnstileToken), ip, env)) return json({ error: '验证未通过，请刷新验证后重试' }, 403, headers);
    const now = new Date();
    if (!await consumeRateLimit(env, ip, now)) return json({ error: '投稿过于频繁，请稍后再试' }, 429, headers);
    const token = receiptToken();
    const id = crypto.randomUUID();
    const timestamp = now.toISOString();
    await env.DB.prepare('INSERT INTO submissions (id, receipt_hash, consent_version, consent_at, title, author, content, contact, date, series, subseries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, await sha256(token), 'v1', timestamp, title, author, content, contact, date, series, subseries, timestamp, timestamp).run();
    statusPage.hash = token;
    return json({ ok: true, id, statusUrl: statusPage.href }, 201, headers);
  } catch {
    return json({ error: '暂时无法保存投稿，请稍后重试。稿件仍保留在此页面。' }, 503, headers);
  }
}

async function findByReceipt(request, env) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare('SELECT id, status, public_note, published_url, created_at FROM submissions WHERE receipt_hash = ?').bind(await sha256(token)).first();
}

async function status(request, env, headers) {
  const row = await findByReceipt(request, env);
  if (!row) return json({ error: '查询链接无效或稿件已删除' }, 404, headers);
  return json({ id: row.id, status: row.status === 'publishing' ? 'reviewing' : row.status, note: row.public_note, publishedUrl: row.published_url, createdAt: row.created_at }, 200, headers);
}

async function withdraw(request, env, headers) {
  const row = await findByReceipt(request, env);
  if (!row) return json({ error: '查询链接无效或稿件已删除' }, 404, headers);
  if (!['submitted', 'reviewing'].includes(row.status)) return json({ error: '这篇稿件当前无法撤回' }, 409, headers);
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE submissions SET status = 'withdrawn', contact = '', content = '', updated_at = ?, decided_at = ? WHERE id = ? AND status IN ('submitted', 'reviewing')")
    .bind(now, now, row.id).run();
  if (!result.meta?.changes) return json({ error: '状态已变化，请刷新后重试' }, 409, headers);
  return json({ ok: true }, 200, headers);
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (!headers) return json({ error: '不允许的来源' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const path = new URL(request.url).pathname;
    if(['/api/submissions','/api/status','/api/withdraw'].includes(path)) {
      try {
        const ip=request.headers.get('CF-Connecting-IP');
        if(!ip || !await burstRate(request,env,'public-ip'))return json({error:'访问过于频繁，请稍后再试。'},429,{...headers,'retry-after':'60'});
        if(!await securityRate(env,'public-ip:'+ip+':'+path,path==='/api/status'?1200:120))return json({error:'访问过于频繁，请稍后再试。'},429,{...headers,'retry-after':'60'});
      } catch { return json({error:'投稿服务暂时不可用，请稍后重试。'},503,headers); }
    }
    if (path === '/api/submissions' && request.method === 'POST') return submit(request, env, headers);
    if (path === '/api/status' && request.method === 'GET') return status(request, env, headers);
    if (path === '/api/withdraw' && request.method === 'POST') return withdraw(request, env, headers);
    return json({ error: '未找到' }, 404, headers);
  },
  async scheduled(event, env) {
    const now = new Date().toISOString();
    const decidedCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const pendingCutoff = new Date(Date.now() - 180 * 86400000).toISOString();
    const publishingCutoff = new Date(Date.now() - 60 * 60000).toISOString();
    await env.DB.prepare('DELETE FROM submission_rate WHERE expires_at < ?').bind(now).run();
    await env.DB.prepare("UPDATE submissions SET status = 'reviewing', publishing_at = '' WHERE status = 'publishing' AND publishing_at < ?").bind(publishingCutoff).run();
    await env.DB.prepare("DELETE FROM submissions WHERE status IN ('declined', 'withdrawn') AND decided_at < ?").bind(decidedCutoff).run();
    await env.DB.prepare("DELETE FROM submissions WHERE status IN ('submitted', 'reviewing') AND created_at < ?").bind(pendingCutoff).run();
    await env.DB.prepare("UPDATE submissions SET contact = '', content = '', private_note = '' WHERE status = 'published' AND decided_at < ? AND (contact != '' OR content != '' OR private_note != '')").bind(decidedCutoff).run();
  }
};
