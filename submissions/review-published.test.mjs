import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { readFileSync } from 'node:fs';
import reviewWorker from './review.mjs';
import { PUBLISHED_HTML } from './published-ui.mjs';
import { ADMIN_HTML } from './admin-ui.mjs';

const origin = 'https://review.example';
const reviewer = { access: { getIdentity: async () => ({ email: 'owner@example.com' }) } };

function request(path, method = 'GET', body, headers = {}) {
  return new Request(origin + path, {
    method,
    headers: { Origin: origin, 'X-Requested-With': 'poem-review', ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: body instanceof Uint8Array ? body : JSON.stringify(body) } : {})
  });
}

function fixture() {
  const files = {
    'data/poems.json': [{ id: '1790741273052', title: '原题', author: '逍之遥', date: '2026-09-30', series: '拾遗记', content: '第一行\n第二行', images: ['images/old.jpg'], sourceSubmissionId: 'submission-id', extra: 'preserve' }],
    'data/authors.json': [{ id: 'author-one', name: '逍之遥', aliases: ['逍之遥', '逍遥'], bio: '旧简介', tags: [], link: '' }],
    'data/logs.json': [{ id: 'log-001', place: '旧地点', lat: 31.5, lng: 120.2, poemId: '1790741273052', link: true }]
  };
  const versions = { 'data/poems.json': 1, 'data/authors.json': 1, 'data/logs.json': 1 };
  const uploaded = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    const match = url.match(/\/contents\/(.+)$/);
    assert.ok(match, `Unexpected fetch: ${url}`);
    const path = match[1];
    assert.equal(options.headers.authorization, 'Bearer server-only-token');
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      if (path.startsWith('images/')) {
        uploaded.push({ path, bytes: Buffer.from(body.content, 'base64') });
        return Response.json({ content: { path } });
      }
      if (body.sha !== String(versions[path])) return Response.json({}, { status: 409 });
      files[path] = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      versions[path]++;
      return Response.json({ content: { sha: String(versions[path]) } });
    }
    assert.ok(Object.hasOwn(files, path));
    return Response.json({ sha: String(versions[path]), content: Buffer.from(JSON.stringify(files[path])).toString('base64') });
  };
  const env = { REVIEW_AUTH: 'access', REVIEWER_EMAILS: 'owner@example.com', GITHUB_OWNER: 'owner', GITHUB_REPO: 'poems', GITHUB_TOKEN: 'server-only-token', PUBLIC_SITE_URL: 'https://poems.example/Poem_Ulysses/' };
  return { files, versions, uploaded, env, close() { globalThis.fetch = previousFetch; } };
}

test('published editor inline script parses', () => {
  const script = PUBLISHED_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Script(script));
});

test('unified admin inline script parses and contains no browser GitHub token flow', () => {
  const script = ADMIN_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Script(script.replace('__PUBLIC_SITE_URL__', JSON.stringify('https://poems.example/'))));
  assert.doesNotMatch(ADMIN_HTML, /api\.github\.com|raw\.githubusercontent\.com|gh-token/);
});

test('published editor is protected and serves a nonce-protected page', async () => {
  const f = fixture();
  try {
    assert.equal((await reviewWorker.fetch(request('/poems'), f.env, {})).status, 403);
    const page = await reviewWorker.fetch(request('/poems'), f.env, reviewer);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /script-src 'nonce-[a-f0-9]+'/);
    assert.match(await page.text(), /已发表诗歌/);
    assert.equal((await reviewWorker.fetch(request('/api/published-poems'), f.env, {})).status, 403);
  } finally { f.close(); }
});

test('unified admin requires reviewer login and serves the protected interface', async () => {
  const f = fixture();
  try {
    assert.equal((await reviewWorker.fetch(request('/admin'), f.env, {})).status, 403);
    const response = await reviewWorker.fetch(request('/admin'), f.env, reviewer);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /投稿审核/);
    assert.match(html, /<script nonce="[a-f0-9]+">/);
    assert.match(html, /var publicSiteUrl = "https:\/\/poems\.example\/Poem_Ulysses\/"/);
    assert.equal((await reviewWorker.fetch(request('/api/admin/files/poems'), f.env, {})).status, 403);
  } finally { f.close(); }
});

test('unified admin shows GitHub login instead of protected content without a session', async () => {
  const f = fixture();
  Object.assign(f.env, { REVIEW_AUTH: 'github', GITHUB_OAUTH_CLIENT_ID: 'client', GITHUB_OAUTH_SECRET: 'secret', SESSION_SECRET: 'test-session-secret', REVIEWER_EMAILS: 'owner@example.com' });
  try {
    const response = await reviewWorker.fetch(request('/admin'), f.env, {});
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /使用 GitHub 登录/);
    assert.doesNotMatch(html, /漂流日志/);
    assert.equal((await reviewWorker.fetch(request('/api/admin/files/logs'), f.env, {})).status, 401);
  } finally { f.close(); }
});

test('unified admin writes validated poems and rejects stale, invalid or cross-site changes', async () => {
  const f = fixture();
  try {
    const path = '/api/admin/files/poems';
    const original = await (await reviewWorker.fetch(request(path), f.env, reviewer)).json();
    assert.equal(original.sha, '1');
    const edited = structuredClone(original.data);
    edited[0].title = '后台修改';
    const crossSite = request(path, 'PUT', { sha: original.sha, data: edited }, { Origin: 'https://evil.example' });
    assert.equal((await reviewWorker.fetch(crossSite, f.env, reviewer)).status, 403);
    const invalid = structuredClone(edited);
    invalid[0].images = ['../secret'];
    assert.equal((await reviewWorker.fetch(request(path, 'PUT', { sha: original.sha, data: invalid }), f.env, reviewer)).status, 400);
    assert.equal((await reviewWorker.fetch(request(path, 'PUT', { sha: original.sha, data: edited }), f.env, reviewer)).status, 200);
    assert.equal(f.files['data/poems.json'][0].title, '后台修改');
    assert.equal(f.files['data/poems.json'][0].sourceSubmissionId, 'submission-id');
    assert.equal((await reviewWorker.fetch(request(path, 'PUT', { sha: original.sha, data: edited }), f.env, reviewer)).status, 409);
  } finally { f.close(); }
});

test('unified admin maintains authors and travel log order without browser credentials', async () => {
  const f = fixture();
  try {
    const authors = await (await reviewWorker.fetch(request('/api/admin/files/authors'), f.env, reviewer)).json();
    authors.data[0].bio = '新简介';
    assert.equal((await reviewWorker.fetch(request('/api/admin/files/authors', 'PUT', authors), f.env, reviewer)).status, 200);
    assert.equal(f.files['data/authors.json'][0].bio, '新简介');
    const logs = await (await reviewWorker.fetch(request('/api/admin/files/logs'), f.env, reviewer)).json();
    logs.data.push({ id: 'log-002', place: '新地点', lat: 32, lng: 118, link: false });
    assert.equal((await reviewWorker.fetch(request('/api/admin/files/logs', 'PUT', logs), f.env, reviewer)).status, 200);
    assert.deepEqual(f.files['data/logs.json'].map(x => x.id), ['log-001', 'log-002']);
    assert.equal(f.files['data/logs.json'][1].link, false);
    const reordered = await (await reviewWorker.fetch(request('/api/admin/files/logs'), f.env, reviewer)).json();
    reordered.data.reverse();
    assert.equal((await reviewWorker.fetch(request('/api/admin/files/logs', 'PUT', reordered), f.env, reviewer)).status, 200);
    assert.deepEqual(f.files['data/logs.json'].map(x => x.id), ['log-002', 'log-001']);
  } finally { f.close(); }
});

test('unified admin deletes a poem record while retaining unrelated image files', async () => {
  const f = fixture();
  try {
    const response = await reviewWorker.fetch(request('/api/admin/files/poems', 'PUT', { sha: '1', data: [] }), f.env, reviewer);
    assert.equal(response.status, 200);
    assert.deepEqual(f.files['data/poems.json'], []);
    assert.deepEqual(f.uploaded, []);
  } finally { f.close(); }
});

test('unified admin accepts the repository’s current poem, author and log formats', async () => {
  const f = fixture();
  try {
    for (const kind of ['poems', 'authors', 'logs']) {
      const data = JSON.parse(readFileSync(new URL('../data/' + kind + '.json', import.meta.url), 'utf8'));
      f.files['data/' + kind + '.json'] = data;
      const response = await reviewWorker.fetch(request('/api/admin/files/' + kind, 'PUT', { sha: '1', data }), f.env, reviewer);
      assert.equal(response.status, 200, kind + ': ' + await response.text());
    }
  } finally { f.close(); }
});

test('published poem edit preserves identity and unrelated data, rejects stale SHA and cross-site writes', async () => {
  const f = fixture();
  try {
    const list = await (await reviewWorker.fetch(request('/api/published-poems'), f.env, reviewer)).json();
    assert.equal(list.poems[0].id, '1790741273052');
    const detail = await (await reviewWorker.fetch(request('/api/published-poems/1790741273052'), f.env, reviewer)).json();
    assert.equal(detail.sha, '1');
    assert.equal(detail.profile.id, 'author-one');
    const payload = { sha: detail.sha, title: '新题', author: '逍之遥', date: '2026-10-01', series: '拾遗记', subseries: '新分类', content: '新的第一行\n新的第二行', images: ['images/old.jpg'] };
    const crossSite = request('/api/published-poems/1790741273052', 'PUT', payload, { Origin: 'https://evil.example' });
    assert.equal((await reviewWorker.fetch(crossSite, f.env, reviewer)).status, 403);
    const saved = await reviewWorker.fetch(request('/api/published-poems/1790741273052', 'PUT', payload), f.env, reviewer);
    assert.equal(saved.status, 200);
    assert.equal(f.files['data/poems.json'][0].title, '新题');
    assert.equal(f.files['data/poems.json'][0].sourceSubmissionId, 'submission-id');
    assert.equal(f.files['data/poems.json'][0].extra, 'preserve');
    assert.deepEqual(f.files['data/poems.json'][0].images, ['images/old.jpg']);
    assert.equal((await reviewWorker.fetch(request('/api/published-poems/1790741273052', 'PUT', payload), f.env, reviewer)).status, 409);
  } finally { f.close(); }
});

test('author profile can be edited or created and duplicate names are refused', async () => {
  const f = fixture();
  try {
    const updated = await reviewWorker.fetch(request('/api/author-profiles/author-one', 'PUT', { sha: '1', name: '新笔名', aliases: ['逍遥'], bio: '新简介', tags: ['现代诗'], link: 'https://example.com' }), f.env, reviewer);
    assert.equal(updated.status, 200);
    assert.deepEqual(f.files['data/authors.json'][0].aliases, ['逍遥', '逍之遥']);
    assert.equal((await reviewWorker.fetch(request('/api/author-profiles/author-one', 'PUT', { sha: '1', name: '新笔名', aliases: [], bio: '', tags: [], link: '' }), f.env, reviewer)).status, 409);
    const created = await reviewWorker.fetch(request('/api/author-profiles', 'POST', { sha: '2', name: '另一位作者', aliases: [], bio: '', tags: [], link: '' }), f.env, reviewer);
    assert.equal(created.status, 200);
    assert.equal(f.files['data/authors.json'].length, 2);
    assert.equal((await reviewWorker.fetch(request('/api/author-profiles', 'POST', { sha: '3', name: '重复作者', aliases: ['逍遥'], bio: '', tags: [], link: '' }), f.env, reviewer)).status, 409);
  } finally { f.close(); }
});

test('image upload validates signature and size before writing to GitHub', async () => {
  const f = fixture();
  try {
    const invalid = await reviewWorker.fetch(request('/api/images', 'POST', Uint8Array.from([1, 2, 3]), { 'Content-Type': 'image/png' }), f.env, reviewer);
    assert.equal(invalid.status, 415);
    assert.equal(f.uploaded.length, 0);
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]);
    const valid = await reviewWorker.fetch(request('/api/images', 'POST', png, { 'Content-Type': 'image/png' }), f.env, reviewer);
    assert.equal(valid.status, 200);
    assert.match((await valid.json()).path, /^images\/editor-[a-f0-9-]+\.png$/);
    assert.deepEqual(f.uploaded[0].bytes, Buffer.from(png));
    assert.equal(f.files['data/poems.json'][0].images.length, 1);
  } finally { f.close(); }
});

test('published poem remains saved when the submission record cannot be synchronized', async () => {
  const f = fixture();
  f.env.DB = { prepare() { throw new Error('database unavailable'); } };
  try {
    const poem = f.files['data/poems.json'][0];
    const response = await reviewWorker.fetch(request('/api/published-poems/' + poem.id, 'PUT', {
      sha: '1', title: '已改标题', author: poem.author, date: poem.date, series: poem.series,
      subseries: '', content: poem.content, images: poem.images
    }), f.env, reviewer);
    assert.equal(response.status, 200);
    assert.match((await response.json()).warning, /诗歌已保存/);
    assert.equal(f.files['data/poems.json'][0].title, '已改标题');
  } finally { f.close(); }
});

test('published edit does not restore a retained private body in the review database', async () => {
  const f = fixture();
  let query = '';
  f.env.DB = { prepare(sql) { query = sql; return { bind() { return this; }, async run() { return { meta: { changes: 1 } }; } }; } };
  try {
    const poem = f.files['data/poems.json'][0];
    const response = await reviewWorker.fetch(request('/api/published-poems/' + poem.id, 'PUT', {
      sha: '1', title: poem.title, author: poem.author, date: poem.date, series: poem.series,
      subseries: '', content: '\n  第一句\n第二句\n', images: poem.images
    }), f.env, reviewer);
    assert.equal(response.status, 200);
    assert.equal(f.files['data/poems.json'][0].content, '\n  第一句\n第二句\n');
    assert.doesNotMatch(query, /SET[^]*content\s*=/);
  } finally { f.close(); }
});
