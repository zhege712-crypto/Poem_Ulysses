import { REVIEW_HTML } from './review-ui.mjs';
import { PUBLISHED_HTML } from './published-ui.mjs';
import { ADMIN_HTML } from './admin-ui.mjs';
import { authorizeReviewer } from './review-auth.mjs';
import { burstRate, privateRate, rateReply, recentReviewer, reauthReply, audited, securityAdminRoutes, cleanupSecurity } from './security.mjs';
import { partnerAuthRoute, cleanupPartnerData } from './partner-auth.mjs';
import { partnerRoutes, partnerAdminRoutes, partnerSubmission, recordPartnerPublication } from './partners.mjs';

const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' };
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8' } }); }
function clean(value) { return typeof value === 'string' ? value.trim() : ''; }
function editorError(message, status = 400) { return json({ error: message }, status); }

async function readBody(request, limit = 30000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('请求格式错误');
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('稿件过长');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > limit) throw new Error('稿件过长');
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
  return encodeBytes(bytes);
}
function encodeBytes(bytes) {
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

function validDate(value) { return value.length <= 40 && !/[\u0000-\u001f<>]/.test(value); }
function validImagePath(value) {
  return typeof value === 'string' && /^images\/[A-Za-z0-9._/-]{1,180}$/.test(value) && !value.split('/').includes('..');
}
function validId(value) { return typeof value === 'string' && /^[\p{L}\p{N}_.-]{1,100}$/u.test(value); }
// Work dates describe the poem; these server-owned timestamps describe publication and edits.
function stampPoem(row, previous, now = new Date().toISOString()) {
  const keys = ['title', 'author', 'date', 'series', 'subseries', 'content', 'images'];
  const changed = !previous || keys.some(key => JSON.stringify(row[key] ?? (key === 'images' ? [] : '')) !== JSON.stringify(previous[key] ?? (key === 'images' ? [] : '')));
  if (!previous) row.publishedAt = now;
  if (changed) row.updatedAt = now;
  return row;
}
function validateAdminData(kind, incoming, current) {
  if (!Array.isArray(incoming) || incoming.length > 5000 || !Array.isArray(current)) return null;
  const ids = new Set();
  const previous = new Map(current.map(row => [row.id, row]));
  const output = [];
  for (const item of incoming) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !validId(item.id) || ids.has(item.id)) return null;
    ids.add(item.id);
    const old = previous.get(item.id) || {};
    if (kind === 'poems') {
      const title = clean(item.title), author = clean(item.author), date = clean(item.date), series = clean(item.series);
      const subseries = clean(item.subseries);
      const content = typeof item.content === 'string' ? item.content.replace(/\r\n?/g, '\n') : '';
      if (!title || title.length > 80 || !author || author.length > 40 || !date || !validDate(date) || !series || series.length > 60 || subseries.length > 60 || content.trim().length < 2 || content.length > 12000 || !Array.isArray(item.images) || item.images.length > 20 || item.images.some(x => !validImagePath(x))) return null;
      const row = { ...old, id: item.id, title, author, date, series, content, images: item.images };
      if (subseries) row.subseries = subseries; else delete row.subseries;
      output.push(stampPoem(row, previous.get(item.id)));
    } else if (kind === 'authors') {
      const profile = validProfile(item);
      if (!profile) return null;
      output.push({ ...old, id: item.id, ...profile });
    } else {
      const place = clean(item.place), date = clean(item.date), note = clean(item.text);
      const poemId = clean(item.poemId), authorId = clean(item.authorId);
      if (!place || place.length > 80 || !Number.isFinite(item.lat) || !Number.isFinite(item.lng) || item.lat < -90 || item.lat > 90 || item.lng < -180 || item.lng > 180 || date.length > 40 || (date && !validDate(date)) || note.length > 2000 || poemId.length > 100 || authorId.length > 100 || (item.link !== undefined && typeof item.link !== 'boolean')) return null;
      const row = { ...old, id: item.id, place, lat: item.lat, lng: item.lng };
      for (const [key, value] of Object.entries({ date, text: note, poemId, authorId })) { if (value) row[key] = value; else delete row[key]; }
      if (item.link === false) row.link = false; else delete row.link;
      output.push(row);
    }
  }
  if (kind === 'authors') {
    const names = new Map();
    for (const row of output) for (const name of [row.name, ...row.aliases]) {
      if (names.has(name) && names.get(name) !== row.id) return null;
      names.set(name, row.id);
    }
  }
  return output;
}
async function adminFile(request, env, kind) {
  const path = 'data/' + kind + '.json';
  const { sha, data } = await readGitHubJson(env, path);
  if (!Array.isArray(data)) throw new Error('仓库数据格式错误');
  if (request.method === 'GET') return json({ sha, data });
  const body = await readBody(request, 1024 * 1024);
  if (!clean(body.sha)) return editorError('缺少数据版本，请刷新后重试');
  if (body.sha !== sha) return editorError('仓库数据已更新，请刷新后核对修改。', 409);
  const validated = validateAdminData(kind, body.data, data);
  if (!validated) return editorError('数据格式有误，请核对填写内容');
  if (!await writeGitHubJson(env, path, validated, sha, '后台维护: ' + kind)) return editorError('仓库数据同时被修改，请刷新后重试', 409);
  return json({ ok: true });
}
function validProfile(body) {
  const name = clean(body.name);
  const bio = clean(body.bio);
  const link = clean(body.link);
  const aliases = Array.isArray(body.aliases) ? [...new Set(body.aliases.map(clean).filter(Boolean))] : null;
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map(clean).filter(Boolean))] : null;
  if (!name || name.length > 40 || bio.length > 2000 || !aliases || aliases.length > 30 || aliases.some(x => x.length > 40) || !tags || tags.length > 30 || tags.some(x => x.length > 40) || link.length > 300) return null;
  if (link) { try { if (new URL(link).protocol !== 'https:') return null; } catch { return null; } }
  return { name, bio, aliases, tags, link };
}
async function listPublishedPoems(env) {
  const { data } = await readGitHubJson(env, 'data/poems.json');
  if (!Array.isArray(data)) throw new Error('诗歌数据格式错误');
  return data.map(p => ({ id: p.id, title: p.title, author: p.author, date: p.date, series: p.series }));
}
async function getPublishedPoem(env, id) {
  const [poems, authors] = await Promise.all([readGitHubJson(env, 'data/poems.json'), readGitHubJson(env, 'data/authors.json')]);
  if (!Array.isArray(poems.data) || !Array.isArray(authors.data)) throw new Error('作品数据格式错误');
  const poem = poems.data.find(p => p.id === id);
  if (!poem) return null;
  const profile = authors.data.find(a => a.name === poem.author || (Array.isArray(a.aliases) && a.aliases.includes(poem.author))) || null;
  return { poem, sha: poems.sha, profile, authorsSha: authors.sha, publicSiteUrl: env.PUBLIC_SITE_URL };
}
async function savePublishedPoem(request, env, id) {
  const body = await readBody(request, 60000);
  const title = clean(body.title), author = clean(body.author), date = clean(body.date);
  const series = clean(body.series), subseries = clean(body.subseries);
  const content = typeof body.content === 'string' ? body.content.replace(/\r\n?/g, '\n') : '';
  const images = body.images;
  if (!clean(body.sha) || !title || title.length > 80 || !author || author.length > 40 || !date || !validDate(date) || !series || series.length > 60 || subseries.length > 60 || content.trim().length < 2 || content.length > 12000 || !Array.isArray(images) || images.length > 20 || images.some(x => !validImagePath(x))) return editorError('请检查诗歌字段、日期和图片路径');
  const { sha, data } = await readGitHubJson(env, 'data/poems.json');
  if (sha !== body.sha) return editorError('诗歌数据已被别人更新。请刷新后重新核对修改。', 409);
  if (!Array.isArray(data)) throw new Error('诗歌数据格式错误');
  const poem = data.find(p => p.id === id);
  if (!poem) return editorError('这首诗已不存在，请刷新列表', 404);
  const previous = { ...poem };
  Object.assign(poem, { title, author, date, series, content, images });
  if (subseries) poem.subseries = subseries;
  else delete poem.subseries;
  stampPoem(poem, previous);
  if (!await writeGitHubJson(env, 'data/poems.json', data, sha, '修改已发表诗歌: ' + title)) return editorError('诗歌数据同时被修改，请刷新后重试', 409);
  let warning = '';
  if (poem.sourceSubmissionId && env.DB) {
    try {
      await env.DB.prepare("UPDATE submissions SET title = ?, author = ?, date = ?, series = ?, subseries = ?, updated_at = ? WHERE id = ? AND status = 'published'")
        .bind(title, author, date, series, subseries, new Date().toISOString(), poem.sourceSubmissionId).run();
    } catch { warning = '诗歌已保存，但投稿记录未能同步；请稍后检查审核列表。'; }
  }
  return json({ ok: true, warning });
}
async function saveAuthorProfile(request, env, id) {
  const body = await readBody(request);
  const values = validProfile(body);
  if (!values || !clean(body.sha)) return editorError('请检查作者资料');
  const { sha, data } = await readGitHubJson(env, 'data/authors.json');
  if (sha !== body.sha) return editorError('作者资料已被别人更新。请刷新后重新核对修改。', 409);
  if (!Array.isArray(data)) throw new Error('作者数据格式错误');
  const profile = data.find(a => a.id === id);
  if (!profile) return editorError('作者资料不存在', 404);
  if (data.some(a => a.id !== id && [a.name, ...(a.aliases || [])].some(x => x === values.name || values.aliases.includes(x)))) return editorError('这个笔名或别名已属于另一位作者', 409);
  if (profile.name !== values.name && !values.aliases.includes(profile.name)) values.aliases.push(profile.name);
  Object.assign(profile, values);
  if (!await writeGitHubJson(env, 'data/authors.json', data, sha, '修改作者资料: ' + values.name)) return editorError('作者数据同时被修改，请刷新后重试', 409);
  return json({ ok: true });
}
async function createAuthorProfile(request, env) {
  const body = await readBody(request);
  const values = validProfile(body);
  if (!values || !clean(body.sha)) return editorError('请检查作者资料');
  const { sha, data } = await readGitHubJson(env, 'data/authors.json');
  if (sha !== body.sha) return editorError('作者资料已被别人更新。请刷新后重新核对修改。', 409);
  if (!Array.isArray(data)) throw new Error('作者数据格式错误');
  if (data.some(a => [a.name, ...(a.aliases || [])].some(x => x === values.name || values.aliases.includes(x)))) return editorError('这位作者或别名已有资料，请刷新后选择', 409);
  const id = 'contributor-' + crypto.randomUUID().slice(0, 12);
  data.push({ id, ...values });
  if (!await writeGitHubJson(env, 'data/authors.json', data, sha, '建立作者资料: ' + values.name)) return editorError('作者数据同时被修改，请刷新后重试', 409);
  return json({ ok: true, id });
}
async function uploadPoemImage(request, env) {
  const mime = (request.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  if (!extensions[mime]) return editorError('只接受 JPEG、PNG、WebP 或 GIF 图片', 415);
  if (Number(request.headers.get('content-length') || 0) > 3 * 1024 * 1024) return editorError('图片不能超过 3 MB', 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) return editorError('图片不能超过 3 MB', 413);
  const starts = (...signature) => signature.every((byte, index) => bytes[index] === byte);
  const valid = mime === 'image/png' ? starts(137, 80, 78, 71, 13, 10, 26, 10)
    : mime === 'image/jpeg' ? starts(255, 216, 255)
    : mime === 'image/gif' ? (starts(71, 73, 70, 56, 55, 97) || starts(71, 73, 70, 56, 57, 97))
    : starts(82, 73, 70, 70) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
  if (!valid) return editorError('图片内容与格式不符', 415);
  const path = 'images/editor-' + crypto.randomUUID() + '.' + extensions[mime];
  const response = await github(env, path, { method: 'PUT', body: JSON.stringify({ message: '添加诗歌配图', content: encodeBytes(bytes) }) });
  if (!response.ok) throw new Error('图片写入仓库失败（' + response.status + '）');
  return json({ path });
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
    const now = new Date().toISOString();
    data.push({
      id: row.poem_id,
      title: row.title,
      date: row.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
      content: row.content,
      series: row.series || '未分类',
      ...(row.subseries ? { subseries: row.subseries } : {}),
      author: row.author,
      images: [],
      sourceSubmissionId: row.id,
      publishedAt: now,
      updatedAt: now
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
  const body = await readBody(request, 60000);
  const current = await getSubmission(env, id);
  if (!current) return editorError('稿件不存在',404);
  const member = await partnerSubmission(env,id);
  if ((member && body.expectedUpdatedAt !== current.updated_at) || (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== current.updated_at)) return editorError('稿件已有新版本，请刷新核对后再保存',409);
  if (member && (member.status !== 'active' || body.authorId !== member.author_id)) return editorError('合作权限或作者归属已变化，请核对合作账号',409);
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
  const now = new Date(Math.max(Date.now(),Date.parse(current.updated_at)+1)).toISOString();
  const result = await env.DB.prepare("UPDATE submissions SET title = ?, author = ?, content = ?, date = ?, series = ?, subseries = ?, author_id = ?, private_note = ?, status = 'reviewing', updated_at = ? WHERE id = ? AND updated_at = ? AND status IN ('submitted', 'reviewing')")
    .bind(title, author, content, date, series, subseries, authorId, privateNote, now, id, current.updated_at).run();
  if (!result.meta?.changes) return editorError('稿件状态已变化，请刷新后重试', 409);
  return json({ ok: true, updatedAt: now });
}

async function declineSubmission(request, env, id) {
  const body = await readBody(request);
  const note = clean(body.note);
  if (note.length > 300) return editorError('给投稿人的说明不能超过 300 字');
  const current = await getSubmission(env,id), member = await partnerSubmission(env,id);
  if (!current) return editorError('稿件不存在',404);
  if ((member && body.expectedUpdatedAt !== current.updated_at) || (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== current.updated_at)) return editorError('稿件已有新版本，请重新核对后再处理',409);
  const now = new Date(Math.max(Date.now(),Date.parse(current.updated_at)+1)).toISOString();
  const result = await env.DB.prepare("UPDATE submissions SET status = 'declined', public_note = ?, contact = '', decided_at = ?, updated_at = ? WHERE id = ? AND updated_at = ? AND status IN ('submitted', 'reviewing')")
    .bind(note, now, now, id, current.updated_at).run();
  if (!result.meta?.changes) return editorError('稿件状态已变化，请刷新后重试', 409);
  return json({ ok: true });
}

async function publishSubmission(env, id, expectedUpdatedAt) {
  const row = await getSubmission(env, id);
  if (!row) return editorError('稿件不存在', 404);
  const member = await partnerSubmission(env,id);
  if (row.status === 'published') { await recordPartnerPublication(env,member,row.poem_id); return json({ ok: true, publishedUrl: row.published_url }); }
  if (member && (member.status !== 'active' || row.author_id !== member.author_id)) return editorError('合作权限或作者归属已变化，请先核对',409);
  if ((member && expectedUpdatedAt !== row.updated_at) || (expectedUpdatedAt !== undefined && expectedUpdatedAt !== row.updated_at)) return editorError('稿件已有新版本，请重新查看后再发表',409);
  let readPage;
  try {
    readPage = new URL('read.html', env.PUBLIC_SITE_URL);
    if (readPage.protocol !== 'https:') throw new Error();
  } catch { return editorError('网站地址配置有误，请检查审核服务设置', 503); }
  const now = new Date();
  const stale = new Date(now.getTime() - 5 * 60000).toISOString();
  const poemId = row.poem_id || String(now.getTime());
  const lock = await env.DB.prepare("UPDATE submissions SET status = 'publishing', poem_id = ?, publishing_at = ?, updated_at = ? WHERE id = ? AND updated_at = ? AND (status IN ('submitted', 'reviewing') OR (status = 'publishing' AND publishing_at < ?))")
    .bind(poemId, now.toISOString(), now.toISOString(), id, row.updated_at, stale).run();
  if (!lock.meta?.changes) return editorError('稿件正在发布、已撤回或已处理，请刷新后重试', 409);
  try {
    const current = { ...row, poem_id: poemId };
    await updateAuthors(env, current);
    const publishedId = await writePoem(env, current);
    await recordPartnerPublication(env,member,publishedId);
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
    const ops={readGitHubJson,writeGitHubJson,stampPoem};
    const requestPath=new URL(request.url).pathname;
    if(requestPath.startsWith('/api/') || requestPath.startsWith('/auth/') || requestPath.startsWith('/partner-auth/') || ['/','/admin','/poems','/collaborators','/revisions','/security'].includes(requestPath)) {
      try {
        if(!await burstRate(request,env,'review-ip'))return rateReply();
      } catch { return editorError('访问验证暂时不可用，请稍后重试',503); }
    }
    try {
      const partnerAuth=await partnerAuthRoute(request,env);
      if (partnerAuth) return partnerAuth;
      const partnerResponse=await partnerRoutes(request,env,ops);
      if (partnerResponse) return partnerResponse;
    } catch { return editorError('合作服务暂时不可用，请稍后重试',503); }
    const allowed = (env.REVIEWER_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    let auth;try{auth = await authorizeReviewer(request, env, ctx, allowed)}catch{return editorError('登录服务暂时不可用，请稍后重试',503)}
    if (auth.response) return auth.response;
    try {
      const url=new URL(request.url);
      if(request.method!=='GET' && (request.headers.get('Origin')!==url.origin || request.headers.get('x-requested-with')!=='poem-review'))return editorError('请求来源无效',403);
      if(url.pathname.startsWith('/api/') && !await privateRate(request,env,'reviewer:'+auth.email))return rateReply();
      return await audited(request,env,'reviewer:'+auth.email,async()=>{
        const important=request.method==='DELETE' || (request.method!=='GET' && (/\/(publish|approve|assign|reactivate|recover)$/.test(url.pathname) || /^\/api\/admin\/files\//.test(url.pathname) || url.pathname.startsWith('/api/author-profiles')));
        if(important && !recentReviewer(auth,env))return reauthReply();
        return reviewerRoutes(request,env,auth,ops);
      });
    } catch { return editorError('服务暂时不可用，请保留输入并稍后重试',503); }
  },
  async scheduled(event,env) { await cleanupPartnerData(env); await cleanupSecurity(env); }
};

async function reviewerRoutes(request,env,auth,ops) {
    const url = new URL(request.url);
    const securityResponse=await securityAdminRoutes(request,env,auth);
    if(securityResponse)return securityResponse;
    const partnerAdmin=await partnerAdminRoutes(request,env,ops,auth.email);
    if (partnerAdmin) return partnerAdmin;
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/poems' || url.pathname === '/admin')) {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      const template = url.pathname === '/poems' ? PUBLISHED_HTML : url.pathname === '/admin' ? ADMIN_HTML : REVIEW_HTML;
      const html = template.replace('<script>', '<script nonce="' + nonce + '">').replace(/(id="logout"[^>]*?)\s+hidden(?=[\s>])/g,(_,prefix)=>env.REVIEW_AUTH==='github'?prefix:prefix+' hidden').replace('__PUBLIC_SITE_URL__', JSON.stringify(env.PUBLIC_SITE_URL).replace(/</g, '\\u003c'));
      const siteOrigin = new URL(env.PUBLIC_SITE_URL).origin;
      return new Response(html, { headers: { ...BASE_HEADERS, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: " + siteOrigin + "; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
    }
    if (request.method === 'GET' && url.pathname === '/api/published-poems') {
      try { return json({ poems: await listPublishedPoems(env) }); }
      catch (error) { return editorError(error.message || '无法读取已发表诗歌', 502); }
    }
    const adminMatch = url.pathname.match(/^\/api\/admin\/files\/(poems|authors|logs)$/);
    if (adminMatch) {
      if (request.method !== 'GET' && request.method !== 'PUT') return editorError('未找到', 404);
      if (request.method === 'PUT' && (request.headers.get('x-requested-with') !== 'poem-review' || request.headers.get('Origin') !== url.origin)) return editorError('请求来源无效', 403);
      try { return await adminFile(request, env, adminMatch[1]); }
      catch (error) { return editorError(error.message || '管理操作失败', 502); }
    }
    const publishedMatch = url.pathname.match(/^\/api\/published-poems\/([^/]+)$/);
    if (request.method === 'GET' && publishedMatch) {
      try {
        const result = await getPublishedPoem(env, decodeURIComponent(publishedMatch[1]));
        return result ? json(result) : editorError('诗歌不存在', 404);
      } catch (error) { return editorError(error.message || '无法读取诗歌', 502); }
    }
    if (url.pathname === '/api/images' || url.pathname === '/api/author-profiles' || url.pathname.startsWith('/api/author-profiles/') || publishedMatch) {
      if (request.headers.get('x-requested-with') !== 'poem-review' || request.headers.get('Origin') !== url.origin) return editorError('请求来源无效', 403);
      try {
        if (request.method === 'POST' && url.pathname === '/api/images') return await uploadPoemImage(request, env);
        if (request.method === 'POST' && url.pathname === '/api/author-profiles') return await createAuthorProfile(request, env);
        const authorMatch = url.pathname.match(/^\/api\/author-profiles\/([^/]+)$/);
        if (request.method === 'PUT' && authorMatch) return await saveAuthorProfile(request, env, decodeURIComponent(authorMatch[1]));
        if (request.method === 'PUT' && publishedMatch) return await savePublishedPoem(request, env, decodeURIComponent(publishedMatch[1]));
      } catch (error) { return editorError(error.message || '操作失败', 502); }
      return editorError('未找到', 404);
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
      if (request.method === 'POST' && action === 'publish') {
        const body=request.headers.get('content-type')?.startsWith('application/json')?await readBody(request):{};
        return await publishSubmission(env, id, body.expectedUpdatedAt);
      }
    } catch (error) { return editorError(error.message || '操作失败', 400); }
    return editorError('未找到', 404);
}
