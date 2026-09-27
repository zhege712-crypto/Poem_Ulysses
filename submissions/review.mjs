import { REVIEW_HTML } from './review-ui.mjs';
import { authorizeReviewer } from './review-auth.mjs';

const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' };
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8' } }); }
function clean(value) { return typeof value === 'string' ? value.trim() : ''; }
function editorError(message, status = 400) { return json({ error: message }, status); }

async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('请求格式错误');
  if (Number(request.headers.get('content-length') || 0) > 30000) throw new Error('稿件过长');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 30000) throw new Error('稿件过长');
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new Error('请求内容无法读取'); }
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(binary);
}

async function github(env, path, options = {}) {
  const response = await fetch('https://api.github.com/repos/' + encodeURIComponent(env.GITHUB_OWNER) + '/' + encodeURIComponent(env.GITHUB_REPO) + '/contents/' + path, {
    ...options,
    headers: {
      'accept': 'application/vnd.github+json',
      'authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'Poem-Ulysses-Review',
      ...(options.headers || {})
    }
  });
  return response;
}

async function readGitHubJson(env, path) {
  const response = await github(env, path);
  if (!response.ok) throw new Error('读取 ' + path + ' 失败（' + response.status + '）');
  const file = await response.json();
  return { sha: file.sha, data: JSON.parse(decodeBase64(file.content)) };
}

async function writeGitHubJson(env, path, data, sha, message) {
  const response = await github(env, path, {
    method: 'PUT',
    body: JSON.stringify({ message, content: encodeBase64(JSON.stringify(data, null, 2) + '\n'), sha })
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new Error('写入 ' + path + ' 失败（' + response.status + '）');
  return true;
}

async function updateAuthors(env, row) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha, data } = await readGitHubJson(env, 'data/authors.json');
    if (!Array.isArray(data)) throw new Error('作者数据格式错误');
    let author = row.author_id ? data.find(a => a.id === row.author_id) : null;
    if (row.author_id && !author) throw new Error('选择的作者已不存在，请重新选择');
    if (!author) author = data.find(a => a.name === row.author || (a.aliases || []).includes(row.author));
    let changed = false;
    if (author) {
      if (author.name !== row.author && !(author.aliases || []).includes(row.author)) {
        author.aliases = [...(author.aliases || []), row.author];
        changed = true;
      }
    } else {
      author = { id: 'contributor-' + row.id.slice(0, 8), name: row.author, aliases: [row.author], bio: '', tags: [], link: '' };
      data.push(author);
      changed = true;
    }
    if (!changed) return author.id;
    if (await writeGitHubJson(env, 'data/authors.json', data, sha, '收录作者: ' + row.author)) return author.id;
  }
  throw new Error('作者数据同时被修改，请稍后重试');
}

async function writePoem(env, row) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha, data } = await readGitHubJson(env, 'data/poems.json');
    if (!Array.isArray(data)) throw new Error('诗歌数据格式错误');
    const already = data.find(p => p.sourceSubmissionId === row.id);
    if (already) return already.id;
    if (data.some(p => p.id === row.poem_id)) throw new Error('诗歌编号冲突，请联系维护者');
    data.push({
      id: row.poem_id,
      title: row.title,
      date: row.date || new Date().toISOString().slice(0, 10),
      content: row.content,
      series: row.series || '未分类',
      ...(row.subseries ? { subseries: row.subseries } : {}),
      author: row.author,
      images: [],
      sourceSubmissionId: row.id
    });
    if (await writeGitHubJson(env, 'data/poems.json', data, sha, '发表投稿: ' + row.title)) return row.poem_id;
  }
  throw new Error('诗歌数据同时被修改，请稍后重试');
}

async function listSubmissions(env, status) {
  const allowed = ['submitted', 'reviewing', 'publishing', 'published', 'declined', 'withdrawn'];
  if (status && !allowed.includes(status)) throw new Error('状态无效');
  const query = status
    ? env.DB.prepare('SELECT id, title, author, status, created_at, updated_at, published_url FROM submissions WHERE status = ? ORDER BY created_at DESC LIMIT 200').bind(status)
    : env.DB.prepare('SELECT id, title, author, status, created_at, updated_at, published_url FROM submissions ORDER BY created_at DESC LIMIT 200');
  return (await query.all()).results;
}

async function getSubmission(env, id) {
  return env.DB.prepare('SELECT id, title, author, content, date, contact, series, subseries, author_id, status, public_note, private_note, poem_id, published_url, created_at, updated_at FROM submissions WHERE id = ?').bind(id).first();
}

async function saveSubmission(request, env, id) {
  const body = await readBody(request);
  const title = clean(body.title);
  const author = clean(body.author);
  const content = clean(body.content).replace(/\r\n?/g, '\n');
  const date = clean(body.date);
  const series = clean(body.series);
  const subseries = clean(body.subseries);
  const authorId = clean(body.authorId);
  const privateNote = clean(body.privateNote);
  const parsedDate = new Date(date + 'T00:00:00Z');
  if (!title || title.length > 80 || !author || author.length > 40 || content.length < 2 || content.length > 12000 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || series.length > 60 || subseries.length > 60 || authorId.length > 100 || privateNote.length > 500) return editorError('请检查标题、笔名、正文、日期和分类长度');
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE submissions SET title = ?, author = ?, content = ?, date = ?, series = ?, subseries = ?, author_id = ?, private_note = ?, status = 'reviewing', updated_at = ? WHERE id = ? AND status IN ('submitted', 'reviewing')")
    .bind(title, author, content, date, series, subseries, authorId, privateNote, now, id).run();
  if (!result.meta?.changes) return editorError('稿件状态已变化，请刷新后重试', 409);
  return json({ ok: true });
}

async function declineSubmission(request, env, id) {
  const body = await readBody(request);
  const note = clean(body.note);
  if (note.length > 300) return editorError('给投稿人的说明不能超过 300 字');
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE submissions SET status = 'declined', public_note = ?, contact = '', decided_at = ?, updated_at = ? WHERE id = ? AND status IN ('submitted', 'reviewing')")
    .bind(note, now, now, id).run();
  if (!result.meta?.changes) return editorError('稿件状态已变化，请刷新后重试', 409);
  return json({ ok: true });
}

async function publishSubmission(env, id) {
  const row = await getSubmission(env, id);
  if (!row) return editorError('稿件不存在', 404);
  if (row.status === 'published') return json({ ok: true, publishedUrl: row.published_url });
  let readPage;
  try {
    readPage = new URL('read.html', env.PUBLIC_SITE_URL);
    if (readPage.protocol !== 'https:') throw new Error();
  } catch { return editorError('网站地址配置有误，请检查审核服务设置', 503); }
  const now = new Date();
  const stale = new Date(now.getTime() - 5 * 60000).toISOString();
  const poemId = row.poem_id || String(now.getTime());
  const lock = await env.DB.prepare("UPDATE submissions SET status = 'publishing', poem_id = ?, publishing_at = ?, updated_at = ? WHERE id = ? AND (status IN ('submitted', 'reviewing') OR (status = 'publishing' AND publishing_at < ?))")
    .bind(poemId, now.toISOString(), now.toISOString(), id, stale).run();
  if (!lock.meta?.changes) return editorError('稿件正在发布、已撤回或已处理，请刷新后重试', 409);
  try {
    const current = { ...row, poem_id: poemId };
    await updateAuthors(env, current);
    const publishedId = await writePoem(env, current);
    readPage.searchParams.set('id', publishedId);
    const url = readPage.href;
    await env.DB.prepare("UPDATE submissions SET status = 'published', published_url = ?, contact = '', decided_at = ?, updated_at = ? WHERE id = ? AND status = 'publishing'")
      .bind(url, now.toISOString(), now.toISOString(), id).run();
    return json({ ok: true, publishedUrl: url });
  } catch (error) {
    await env.DB.prepare("UPDATE submissions SET status = 'reviewing', publishing_at = '', updated_at = ? WHERE id = ? AND status = 'publishing'")
      .bind(new Date().toISOString(), id).run();
    return editorError(error.message || '发布失败，请稍后重试', 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const allowed = (env.REVIEWER_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    const auth = await authorizeReviewer(request, env, ctx, allowed);
    if (auth.response) return auth.response;
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      const html = REVIEW_HTML.replace('<script>', '<script nonce="' + nonce + '">').replace('id="logout" hidden', env.REVIEW_AUTH === 'github' ? 'id="logout"' : 'id="logout" hidden');
      return new Response(html, { headers: { ...BASE_HEADERS, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'" } });
    }
    if (request.method === 'GET' && url.pathname === '/api/submissions') {
      try { return json({ submissions: await listSubmissions(env, url.searchParams.get('status')) }); }
      catch (error) { return editorError(error.message); }
    }
    if (request.method === 'GET' && url.pathname === '/api/options') {
      try {
        const [poems, authors] = await Promise.all([readGitHubJson(env, 'data/poems.json'), readGitHubJson(env, 'data/authors.json')]);
        return json({ series: [...new Set(poems.data.map(p => p.series).filter(Boolean))], authors: authors.data.map(a => ({ id: a.id, name: a.name, aliases: a.aliases || [] })) });
      } catch (error) { return editorError(error.message, 502); }
    }
    const match = url.pathname.match(/^\/api\/submissions\/([a-f0-9-]{36})(?:\/(publish|decline))?$/);
    if (!match) return editorError('未找到', 404);
    const [, id, action] = match;
    if (request.method === 'GET' && !action) {
      const row = await getSubmission(env, id);
      return row ? json({ submission: row }) : editorError('稿件不存在', 404);
    }
    if (request.headers.get('x-requested-with') !== 'poem-review' || request.headers.get('Origin') !== url.origin) return editorError('请求来源无效', 403);
    try {
      if (request.method === 'PUT' && !action) return await saveSubmission(request, env, id);
      if (request.method === 'POST' && action === 'decline') return await declineSubmission(request, env, id);
      if (request.method === 'POST' && action === 'publish') return await publishSubmission(env, id);
    } catch (error) { return editorError(error.message || '操作失败', 400); }
    return editorError('未找到', 404);
  }
};
