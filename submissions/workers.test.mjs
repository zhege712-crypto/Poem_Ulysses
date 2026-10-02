import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import publicWorker from './public.mjs';
import reviewWorker from './review.mjs';

function fixture({ turnstileValid = true, failPoemOnce = false, oauthEmail = 'owner@example.com', oauthVerified = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('./partners-schema.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        run() { const result = statement.run(...values); return Promise.resolve({ meta: { changes: Number(result.changes) } }); },
        first() { return Promise.resolve(statement.get(...values) || null); },
        all() { return Promise.resolve({ results: statement.all(...values) }); }
      };
    }
  };
  const env = {
    DB, ALLOWED_ORIGIN: 'https://poems.example', PUBLIC_HOSTNAME: 'poems.example',
    PUBLIC_SITE_URL: 'https://poems.example/Poem_Ulysses/',
    TURNSTILE_SECRET: 'test-secret', RATE_SECRET: 'rate-secret',
    REVIEWER_EMAILS: 'owner@example.com', GITHUB_OWNER: 'owner', GITHUB_REPO: 'poems', GITHUB_TOKEN: 'private-test-token'
  };
  const files = {
    'data/poems.json': [],
    'data/authors.json': [{ id: 'known', name: '旧作者', aliases: ['旧作者'], bio: '', tags: [], link: '' }]
  };
  let writes = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.includes('/turnstile/v0/siteverify')) return Response.json({ success: turnstileValid, hostname: 'poems.example' });
    if (url === 'https://github.com/login/oauth/access_token') {
      const body = JSON.parse(options.body);
      assert.equal(body.client_secret, 'oauth-test-secret');
      return Response.json({ access_token: 'oauth-test-token' });
    }
    if (url === 'https://api.github.com/user/emails') {
      assert.equal(options.headers.authorization, 'Bearer oauth-test-token');
      return Response.json([{ email: oauthEmail, verified: oauthVerified, primary: true }]);
    }
    const match = url.match(/\/contents\/(data\/(?:poems|authors)\.json)$/);
    if (!match) throw new Error('Unexpected fetch: ' + url);
    const path = match[1];
    assert.equal(options.headers.authorization, 'Bearer private-test-token');
    if (options.method === 'PUT') {
      if (path === 'data/poems.json' && failPoemOnce) {
        failPoemOnce = false;
        return Response.json({ message: 'temporary failure' }, { status: 502 });
      }
      const body = JSON.parse(options.body);
      if (body.sha !== String(writes)) return Response.json({}, { status: 409 });
      files[path] = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      writes++;
      return Response.json({ content: { sha: String(writes) } });
    }
    return Response.json({ sha: String(writes), content: Buffer.from(JSON.stringify(files[path])).toString('base64') });
  };
  return { env, files, sqlite, close() { globalThis.fetch = previousFetch; sqlite.close(); } };
}

function publicRequest(path, method = 'GET', body, headers = {}) {
  return new Request('https://public.example' + path, {
    method,
    headers: { Origin: 'https://poems.example', 'CF-Connecting-IP': '192.0.2.1', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}
function reviewRequest(path, method = 'GET', body) {
  return new Request('https://review.example' + path, {
    method,
    headers: { Origin: 'https://review.example', 'X-Requested-With': 'poem-review', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}
const reviewer = { access: { getIdentity: async () => ({ email: 'owner@example.com' }) } };
const draft = { title: '一首诗', author: '新笔名', content: '第一行\n第二行', contact: 'private@example.com', consent: true, turnstileToken: 'valid' };

test('reader metadata survives submission, review and publication without leaking through receipts', async () => {
  const f = fixture();
  try {
    const fields = { date: '2000-02-29', series: '读者合集', subseries: '现代诗' };
    const response = await publicWorker.fetch(publicRequest('/api/submissions', 'POST', { ...draft, ...fields }), f.env);
    assert.equal(response.status, 201);
    const receipt = await response.json();
    const detail = await (await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id), f.env, reviewer)).json();
    for (const key of Object.keys(fields)) assert.equal(detail.submission[key], fields[key]);
    const status = await (await publicWorker.fetch(publicRequest('/api/status', 'GET', null, { Authorization: 'Bearer ' + receipt.statusUrl.split('#')[1] }), f.env)).json();
    for (const key of Object.keys(fields)) assert.equal(status[key], undefined);
    assert.equal((await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id + '/publish', 'POST'), f.env, reviewer)).status, 200);
    const poem = f.files['data/poems.json'][0];
    for (const key of Object.keys(fields)) assert.equal(poem[key], fields[key]);
    assert.equal(poem.updatedAt, poem.publishedAt);
    assert.ok(Date.parse(poem.updatedAt) >= Date.now() - 10000);
  } finally { f.close(); }
});

test('metadata is optional, but malformed dates and collections cannot enter the review database', async () => {
  const f = fixture();
  try {
    for (const fields of [{ date: '2025-02-29' }, { date: '2026-04-31' }, { date: 'yesterday' }, { date: [] }, { series: {} }, { series: '诗'.repeat(61) }, { subseries: '<script>' }]) {
      assert.equal((await publicWorker.fetch(publicRequest('/api/submissions', 'POST', { ...draft, ...fields }), f.env)).status, 400);
    }
    assert.equal(f.sqlite.prepare('SELECT count(*) AS count FROM submissions').get().count, 0);
    assert.equal((await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env)).status, 201);
    assert.deepEqual({ ...f.sqlite.prepare('SELECT date, series, subseries FROM submissions').get() }, { date: '', series: '', subseries: '' });
  } finally { f.close(); }
});

test('the full advertised Chinese text limit fits submission and review requests with metadata', async () => {
  const f = fixture();
  try {
    const content = '诗'.repeat(12000);
    const fields = { ...draft, content, date: '2026-10-02', series: '集'.repeat(60), subseries: '类'.repeat(60) };
    const response = await publicWorker.fetch(publicRequest('/api/submissions', 'POST', fields), f.env);
    assert.equal(response.status, 201);
    const receipt = await response.json();
    assert.equal((await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id, 'PUT', { ...fields, authorId: '', privateNote: '' }), f.env, reviewer)).status, 200);
    assert.equal(f.sqlite.prepare('SELECT content FROM submissions').get().content.length, 12000);
  } finally { f.close(); }
});

test('submission remains private, receipt shows only status, and reviewer can publish once', async () => {
  const f = fixture();
  try {
    const submitted = await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env);
    assert.equal(submitted.status, 201);
    const receipt = await submitted.json();
    const token = receipt.statusUrl.split('#')[1];
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(f.sqlite.prepare('SELECT receipt_hash FROM submissions').get().receipt_hash.length, 64);
    assert.equal(f.files['data/poems.json'].length, 0);

    const lookup = await publicWorker.fetch(publicRequest('/api/status', 'GET', null, { Authorization: 'Bearer ' + token }), f.env);
    const publicData = await lookup.json();
    assert.equal(publicData.status, 'submitted');
    assert.equal(JSON.stringify(publicData).includes('private@example.com'), false);
    assert.equal(JSON.stringify(publicData).includes('第一行'), false);

    const unauthorized = await reviewWorker.fetch(reviewRequest('/api/submissions'), f.env, {});
    assert.equal(unauthorized.status, 403);
    const list = await reviewWorker.fetch(reviewRequest('/api/submissions?status=submitted'), f.env, reviewer);
    assert.equal((await list.json()).submissions.length, 1);

    const saved = await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id, 'PUT', {
      title: '一首诗', author: '新笔名', content: '第一行\n第二行', date: '2026-09-26', series: '新系列', subseries: '', authorId: '', privateNote: '待发表'
    }), f.env, reviewer);
    assert.equal(saved.status, 200);
    const published = await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id + '/publish', 'POST'), f.env, reviewer);
    assert.equal(published.status, 200);
    assert.equal(f.files['data/poems.json'].length, 1);
    assert.equal(f.files['data/authors.json'].length, 2);
    assert.equal(f.files['data/poems.json'][0].sourceSubmissionId, receipt.id);
    assert.equal(f.sqlite.prepare('SELECT contact FROM submissions WHERE id = ?').get(receipt.id).contact, '');
    const repeated = await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id + '/publish', 'POST'), f.env, reviewer);
    assert.equal(repeated.status, 200);
    assert.equal(f.files['data/poems.json'].length, 1);
    const after = await publicWorker.fetch(publicRequest('/api/status', 'GET', null, { Authorization: 'Bearer ' + token }), f.env);
    assert.equal((await after.json()).status, 'published');
  } finally { f.close(); }
});

test('withdrawal removes the draft and blocks publication', async () => {
  const f = fixture();
  try {
    const receipt = await (await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env)).json();
    const token = receipt.statusUrl.split('#')[1];
    const withdrawn = await publicWorker.fetch(publicRequest('/api/withdraw', 'POST', null, { Authorization: 'Bearer ' + token }), f.env);
    assert.equal(withdrawn.status, 200);
    const row = f.sqlite.prepare('SELECT content, contact, status FROM submissions WHERE id = ?').get(receipt.id);
    assert.deepEqual({ ...row }, { content: '', contact: '', status: 'withdrawn' });
    const publish = await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id + '/publish', 'POST'), f.env, reviewer);
    assert.equal(publish.status, 409);
    assert.equal(f.files['data/poems.json'].length, 0);
  } finally { f.close(); }
});

test('submission enforces origin, consent, and reviewer identity', async () => {
  const f = fixture();
  try {
    const wrongOrigin = publicRequest('/api/submissions', 'POST', draft, { Origin: 'https://other.example' });
    assert.equal((await publicWorker.fetch(wrongOrigin, f.env)).status, 403);
    const noConsent = publicRequest('/api/submissions', 'POST', { ...draft, consent: false });
    assert.equal((await publicWorker.fetch(noConsent, f.env)).status, 400);
    const other = { access: { getIdentity: async () => ({ email: 'other@example.com' }) } };
    assert.equal((await reviewWorker.fetch(reviewRequest('/'), f.env, other)).status, 403);
    const forbiddenMutation = new Request('https://review.example/api/submissions/00000000-0000-0000-0000-000000000000', { method: 'PUT', headers: { Origin: 'https://review.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal((await reviewWorker.fetch(forbiddenMutation, f.env, reviewer)).status, 403);
  } finally { f.close(); }
});

test('server verification and hourly limit reject unwanted submissions', async () => {
  const blocked = fixture({ turnstileValid: false });
  try {
    const response = await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), blocked.env);
    assert.equal(response.status, 403);
    assert.equal(blocked.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get().count, 0);
  } finally { blocked.close(); }

  const f = fixture();
  try {
    for (let i = 0; i < 5; i++) assert.equal((await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env)).status, 201);
    assert.equal((await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env)).status, 429);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get().count, 5);
  } finally { f.close(); }
});

test('declined submissions cannot publish and expose only the public decision note', async () => {
  const f = fixture();
  try {
    const receipt = await (await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env)).json();
    const token = receipt.statusUrl.split('#')[1];
    const declined = await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id + '/decline', 'POST', { note: '感谢投稿，暂未收录。' }), f.env, reviewer);
    assert.equal(declined.status, 200);
    assert.equal((await reviewWorker.fetch(reviewRequest('/api/submissions/' + receipt.id + '/publish', 'POST'), f.env, reviewer)).status, 409);
    const result = await (await publicWorker.fetch(publicRequest('/api/status', 'GET', null, { Authorization: 'Bearer ' + token }), f.env)).json();
    assert.equal(result.status, 'declined');
    assert.equal(result.note, '感谢投稿，暂未收录。');
    assert.equal(JSON.stringify(result).includes('private@example.com'), false);
  } finally { f.close(); }
});

test('publishing can recover when author write succeeds but poem write fails', async () => {
  const f = fixture({ failPoemOnce: true });
  try {
    const receipt = await (await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env)).json();
    const path = '/api/submissions/' + receipt.id + '/publish';
    assert.equal((await reviewWorker.fetch(reviewRequest(path, 'POST'), f.env, reviewer)).status, 502);
    assert.equal(f.files['data/authors.json'].length, 2);
    assert.equal(f.files['data/poems.json'].length, 0);
    assert.equal((await reviewWorker.fetch(reviewRequest(path, 'POST'), f.env, reviewer)).status, 200);
    assert.equal(f.files['data/authors.json'].length, 2);
    assert.equal(f.files['data/poems.json'].length, 1);
  } finally { f.close(); }
});

test('review page uses a nonce and retention removes expired private drafts', async () => {
  const f = fixture();
  try {
    const page = await reviewWorker.fetch(reviewRequest('/'), f.env, reviewer);
    const html = await page.text();
    assert.match(page.headers.get('content-security-policy'), /script-src 'nonce-[a-f0-9]+'/);
    assert.match(html, /<script nonce="[a-f0-9]+">/);

    const receipt = await (await publicWorker.fetch(publicRequest('/api/submissions', 'POST', draft), f.env)).json();
    const oldDate = new Date(Date.now() - 181 * 86400000).toISOString();
    f.sqlite.prepare('UPDATE submissions SET created_at = ? WHERE id = ?').run(oldDate, receipt.id);
    await publicWorker.scheduled({}, f.env);
    assert.equal(f.sqlite.prepare('SELECT id FROM submissions WHERE id = ?').get(receipt.id), undefined);
  } finally { f.close(); }
});

test('GitHub login accepts only a verified reviewer email and signs a short session', async () => {
  const f = fixture();
  Object.assign(f.env, { REVIEW_AUTH: 'github', GITHUB_OAUTH_CLIENT_ID: 'client-test-id', GITHUB_OAUTH_SECRET: 'oauth-test-secret', SESSION_SECRET: 'test-session-secret-with-enough-entropy-for-hmac' });
  try {
    const denied = await reviewWorker.fetch(reviewRequest('/api/submissions'), f.env, {});
    assert.equal(denied.status, 401);
    const loginPage = await reviewWorker.fetch(reviewRequest('/'), f.env, {});
    assert.match(await loginPage.text(), /使用 GitHub 登录/);
    const start = await reviewWorker.fetch(reviewRequest('/auth/login'), f.env, {});
    assert.equal(start.status, 302);
    const authorize = new URL(start.headers.get('location'));
    assert.equal(authorize.origin, 'https://github.com');
    assert.equal(authorize.searchParams.get('scope'), 'user:email');
    const state = authorize.searchParams.get('state');
    assert.match(state, /^[a-f0-9]{64}$/);
    const callback = new Request('https://review.example/auth/callback?code=validCode123&state=' + state, { headers: { Cookie: '__Host-poem_oauth_state=' + state } });
    const completed = await reviewWorker.fetch(callback, f.env, {});
    assert.equal(completed.status, 302);
    const session = completed.headers.get('set-cookie').match(/__Host-poem_review=([^;]+)/)?.[1];
    assert.ok(session);
    assert.match(completed.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
    const authorized = await reviewWorker.fetch(new Request('https://review.example/api/submissions', { headers: { Cookie: '__Host-poem_review=' + session } }), f.env, {});
    assert.equal(authorized.status, 200);
    const page = await reviewWorker.fetch(new Request('https://review.example/', { headers: { Cookie: '__Host-poem_review=' + session } }), f.env, {});
    assert.match(await page.text(), /id="logout"/);
    const sigStart=session.indexOf('.')+1;
    const forgedValue=session.slice(0,sigStart)+(session[sigStart]==='A'?'B':'A')+session.slice(sigStart+1);
    const forged = await reviewWorker.fetch(new Request('https://review.example/api/submissions', { headers: { Cookie: '__Host-poem_review=' + forgedValue } }), f.env, {});
    assert.equal(forged.status, 401);
    const logout = await reviewWorker.fetch(new Request('https://review.example/auth/logout', { method: 'POST', headers: { Cookie: '__Host-poem_review=' + session, Origin: 'https://review.example', 'X-Requested-With': 'poem-review' } }), f.env, {});
    assert.equal(logout.status, 302);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  } finally { f.close(); }

  const unverified = fixture({ oauthVerified: false });
  Object.assign(unverified.env, { REVIEW_AUTH: 'github', GITHUB_OAUTH_CLIENT_ID: 'client-test-id', GITHUB_OAUTH_SECRET: 'oauth-test-secret', SESSION_SECRET: 'test-session-secret-with-enough-entropy-for-hmac' });
  try {
    const start = await reviewWorker.fetch(reviewRequest('/auth/login'), unverified.env, {});
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = new Request('https://review.example/auth/callback?code=validCode123&state=' + state, { headers: { Cookie: '__Host-poem_oauth_state=' + state } });
    assert.equal((await reviewWorker.fetch(callback, unverified.env, {})).status, 403);
  } finally { unverified.close(); }
});
