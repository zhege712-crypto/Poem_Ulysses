import { writing, storedWriting } from './writing.mjs';
import { partnerJson as json, partnerIdentity, partnerConfigured, samePartnerOrigin, digest, randomToken } from './partner-auth.mjs';
import { partnerPage } from './partner-ui.mjs';
import { privateRate, rateReply, audited, sessionRoutes, submissionsPaused } from './security.mjs';
import { securityPage } from './security-ui.mjs';

const clean = value => typeof value === 'string' ? value.trim() : '';
function fail(message, status = 400) { const error=new Error(message); error.status=status; throw error; }
async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('请使用正确的提交格式');
  if (Number(request.headers.get('content-length')||0)>60000) fail('内容过长',413);
  const text=await request.text();
  if (new TextEncoder().encode(text).length>60000) fail('内容过长',413);
  let value; try { value=JSON.parse(text); } catch { fail('提交内容无法读取'); }
  if (!value || typeof value!=='object' || Array.isArray(value)) fail('提交格式错误');
  return value;
}
function stamp(previous = '') { return new Date(Math.max(Date.now(),(Date.parse(previous)||0)+1)).toISOString(); }
function publicPerson(person) { return {id:person.id,email:person.email,status:person.status,authorId:person.author_id,desiredName:person.desired_name,applicationNote:person.application_note,reviewerNote:person.reviewer_note,updatedAt:person.updated_at}; }
function editable(poem) { return {title:poem.title||'',author:poem.author||'',content:poem.content||'',date:poem.date||'',series:poem.series||'',subseries:poem.subseries||'',images:poem.images||[],...(writing.text(storedWriting(poem.writing))||storedWriting(poem.writing).public?{writing:storedWriting(poem.writing)}:{})}; }
async function fingerprint(poem) { return digest(JSON.stringify(editable(poem))); }
function fields(value, {draft=false,published=false}={}) {
  for (const key of ['title','content','date','series','subseries']) if (value[key]!==undefined && typeof value[key]!=='string') fail('作品信息格式错误');
  const title=clean(value.title),content=typeof value.content==='string'?value.content.replace(/\r\n?/g,'\n'):'',date=clean(value.date),series=clean(value.series),subseries=clean(value.subseries);
  if (title.length>80 || content.length>12000 || date.length>40 || series.length>60 || subseries.length>60 || /[\u0000-\u001f<>]/.test(date+series+subseries)) fail('标题最多 80 字，正文最多 12000 字，合集和子分类最多 60 字');
  if (!draft && (!title || content.trim().length<2)) fail('请填写诗题和至少 2 个字的正文');
  if (!published && date) { const d=new Date(date+'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==date) fail('请填写有效的作品日期'); }
  if (published && (!date || !series)) fail('已发表作品需要保留日期和合集');
  return {title,content,date,series,subseries,writing:storedWriting(value.writing)};
}
async function audit(env,actor,action,target) { await env.DB.prepare('INSERT INTO partner_audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,new Date().toISOString()).run(); }
async function profile(env,ops,person) { const file=await ops.readGitHubJson(env,'data/authors.json'); const author=file.data.find(a=>a.id===person.author_id); if (!author) fail('作者资料已变更，请联系维护者',409); return {file,author}; }
async function ownedPoem(env,ops,person,id) {
  const ownership=await env.DB.prepare('SELECT poem_id FROM partner_poems WHERE poem_id=? AND partner_id=? AND author_id=?').bind(id,person.id,person.author_id).first();
  if (!ownership) fail('这篇作品不属于你的账号',404);
  const file=await ops.readGitHubJson(env,'data/poems.json'),poem=file.data.find(p=>p.id===id);
  if (!poem) fail('这篇作品已不在公开诗集中，请联系维护者',404);
  const {author}=await profile(env,ops,person);
  if (![author.name,...(author.aliases||[])].includes(poem.author)) fail('作品作者归属已变化，请联系维护者核对',409);
  return {file,poem};
}
async function ownWork(env,person,id) {
  const work=await env.DB.prepare('SELECT * FROM partner_works WHERE id=? AND partner_id=?').bind(id,person.id).first();
  if (!work) fail('稿件不存在',404);
  const submission=work.submission_id?await env.DB.prepare('SELECT title,author,content,date,series,subseries,writing,status,public_note,published_url,updated_at FROM submissions WHERE id=?').bind(work.submission_id).first():null;
  return {work,submission};
}
async function ownOpenRevision(env,person,poemId) { return env.DB.prepare("SELECT * FROM partner_revisions WHERE partner_id=? AND poem_id=? AND status IN ('draft','submitted','publishing')").bind(person.id,poemId).first(); }
function revisionView(row) { if (!row) return null; return {id:row.id,status:row.status,version:row.version,data:row.data?JSON.parse(row.data):null,baseHash:row.base_hash,note:row.note,reviewerNote:row.reviewer_note,updatedAt:row.updated_at}; }

export async function partnerRoutes(request, env, ops) {
  const url=new URL(request.url);
  if (url.pathname==='/partners' && request.method==='GET') return partnerPage('creator',env);
  if (url.pathname==='/partner-security' && request.method==='GET') return securityPage(true);
  if (!url.pathname.startsWith('/api/partners/')) return null;
  try {
    if (!partnerConfigured(env)) return json({error:'Google 登录尚未配置，普通投稿仍可使用。'},503);
    if (request.method!=='GET' && !samePartnerOrigin(request,env)) fail('请求来源无效',403);
    const person=await partnerIdentity(request,env);
    if (!person) fail('请先使用 Google 登录',401);
    if (!await privateRate(request,env,'partner:'+person.id)) return rateReply();
    return await audited(request,env,'partner:'+person.id,async()=>{
    const session=await sessionRoutes(request,env,{kind:'partner',owner:person.id,accountLabel:person.email,sessionHash:person.session_hash,authenticatedAt:person.authenticated_at});
    if(session)return session;
    if (url.pathname==='/api/partners/me' && request.method==='GET') return json({person:publicPerson(person)});
    if (url.pathname==='/api/partners/apply' && request.method==='POST') {
      const data=await body(request),name=clean(data.name),note=clean(data.note);
      if (!name || name.length>40 || /[\u0000-\u001f<>]/.test(name) || note.length>500 || data.consent!==true) fail('请填写笔名、简短说明，并确认申请说明');
      const result=await env.DB.prepare("UPDATE partners SET status='pending',desired_name=?,application_note=?,reviewer_note='',applied_at=?,updated_at=? WHERE id=? AND status IN ('new','rejected')").bind(name,note,stamp(),stamp(person.updated_at),person.id).run();
      if (!result.meta?.changes) fail('申请状态已变化，请刷新查看',409);
      await audit(env,person.id,'apply',person.id);
      return json({ok:true});
    }
    if (person.status!=='active') fail('合作权限尚未开通或已暂停，请查看申请状态',403);
    if (url.pathname==='/api/partners/profile') {
      const {file,author}=await profile(env,ops,person);
      if (request.method==='GET') return json({author,sha:file.sha});
      if (request.method!=='PUT') fail('未找到',404);
      const data=await body(request);
      if (['id','name','aliases','authorId','email'].some(k=>Object.hasOwn(data,k))) fail('笔名、别名和作者归属需要维护者确认',403);
      const bio=clean(data.bio),link=clean(data.link),tags=Array.isArray(data.tags)?[...new Set(data.tags.map(clean))]:null;
      if (bio.length>2000 || !tags || tags.length>30 || tags.some(t=>!t || t.length>40) || link.length>300) fail('请检查简介、标签和个人链接');
      if (link) { try { if (new URL(link).protocol!=='https:') fail('个人链接须使用 HTTPS'); } catch { fail('个人链接须为有效的 HTTPS 地址'); } }
      if (data.sha!==file.sha) fail('作者资料已更新，请刷新核对后再保存',409);
      Object.assign(author,{bio,link,tags});
      if (!await ops.writeGitHubJson(env,'data/authors.json',file.data,file.sha,'合作伙伴修改作者资料: '+author.name)) fail('作者资料同时被修改，请刷新后重试',409);
      await audit(env,person.id,'profile',person.author_id);
      return json({ok:true});
    }
    if (url.pathname==='/api/partners/library' && request.method==='GET') {
      const rows=(await env.DB.prepare("SELECT w.id,w.title,w.version,w.updated_at,w.submission_id,s.status,s.title AS review_title,s.public_note FROM partner_works w LEFT JOIN submissions s ON s.id=w.submission_id WHERE w.partner_id=? AND (s.status IS NULL OR s.status!='published') ORDER BY w.updated_at DESC").bind(person.id).all()).results;
      const ownership=(await env.DB.prepare('SELECT poem_id FROM partner_poems WHERE partner_id=? AND author_id=?').bind(person.id,person.author_id).all()).results;
      const ids=new Set(ownership.map(p=>p.poem_id));
      const published=ids.size?(await ops.readGitHubJson(env,'data/poems.json')).data.filter(p=>ids.has(p.id)):[];
      const revisions=(await env.DB.prepare("SELECT poem_id,status,updated_at FROM partner_revisions WHERE partner_id=? AND status IN ('draft','submitted','publishing')").bind(person.id).all()).results;
      return json({works:rows.map(w=>({id:w.id,kind:'work',title:w.review_title||w.title||'未题',status:w.status||(w.submission_id?'missing':'draft'),version:w.version,updatedAt:w.updated_at,note:w.public_note||''})),poems:published.map(p=>({id:p.id,kind:'poem',title:p.title,status:'published',revision:revisions.find(r=>r.poem_id===p.id)?.status||'',updatedAt:p.updatedAt||p.publishedAt||''}))});
    }
    if (url.pathname==='/api/partners/works' && request.method==='POST') {
      const data=fields(await body(request),{draft:true});
      const count=await env.DB.prepare('SELECT count(*) AS count FROM partner_works WHERE partner_id=? AND submission_id IS NULL').bind(person.id).first();
      if (count.count>=100) fail('未提交草稿已达 100 篇，请先整理已有草稿',409);
      const id=crypto.randomUUID(),now=stamp();
      await env.DB.prepare('INSERT INTO partner_works (id,partner_id,title,content,date,series,subseries,writing,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,person.id,data.title,data.content,data.date,data.series,data.subseries,JSON.stringify(data.writing),now,now).run();
      return json({ok:true,id},201);
    }
    const workMatch=url.pathname.match(/^\/api\/partners\/works\/([^/]+)(?:\/(submit|history|withdraw))?$/);
    if (workMatch) {
      const [,id,action]=workMatch,{work,submission}=await ownWork(env,person,id);
      if (request.method==='GET' && !action) return json({work:{...work,...(submission?{title:submission.title,content:submission.content,date:submission.date,series:submission.series,subseries:submission.subseries,writing:submission.writing}:{}),status:submission?.status||(work.submission_id?'missing':'draft'),submissionUpdatedAt:submission?.updated_at||'',note:submission?.public_note||''}});
      if (request.method==='GET' && action==='history') return json({versions:(await env.DB.prepare('SELECT version,data,created_at FROM partner_work_history WHERE work_id=? ORDER BY version DESC LIMIT 10').bind(id).all()).results.map(r=>({...r,data:JSON.parse(r.data)}))});
      if (request.method==='DELETE' && !action) {
        const data=await body(request);
        if (work.submission_id || data.version!==work.version) fail('只能删除尚未送审的当前草稿版本',409);
        const results=await env.DB.batch([env.DB.prepare('DELETE FROM partner_work_history WHERE work_id IN (SELECT id FROM partner_works WHERE id=? AND partner_id=? AND version=? AND submission_id IS NULL)').bind(id,person.id,work.version),env.DB.prepare('DELETE FROM partner_works WHERE id=? AND partner_id=? AND version=? AND submission_id IS NULL').bind(id,person.id,work.version)]);
        if (!results[1].meta?.changes) fail('草稿版本已变化，请刷新',409);
        return json({ok:true});
      }
      if (work.submission_id && (!submission || !['submitted','reviewing'].includes(submission.status))) fail('稿件已处理，请刷新；已发表作品可以提交修订',409);
      const data=await body(request);
      if (data.version!==work.version || (submission && data.submissionUpdatedAt!==submission.updated_at)) fail('稿件已有新版本，请先备份当前输入，再刷新核对',409);
      if (request.method==='PUT' && !action) {
        const values=fields({...data,writing:data.writing===undefined?(submission?.writing??work.writing):data.writing},{draft:!work.submission_id});
        const now=stamp(submission?.updated_at||work.updated_at);
        const gate="id=? AND partner_id=? AND version=? AND (submission_id IS NULL OR EXISTS (SELECT 1 FROM submissions s WHERE s.id=partner_works.submission_id AND s.updated_at=? AND s.status IN ('submitted','reviewing')))";
        const params=[id,person.id,work.version,submission?.updated_at||''];
        const current=submission?fields(submission):fields(work,{draft:true});
        const statements=[env.DB.prepare('INSERT INTO partner_work_history (work_id,version,data,created_at) SELECT id,version,?,? FROM partner_works WHERE '+gate).bind(JSON.stringify(current),now,...params),env.DB.prepare('UPDATE partner_works SET title=?,content=?,date=?,series=?,subseries=?,writing=?,version=version+1,updated_at=? WHERE '+gate).bind(values.title,values.content,values.date,values.series,values.subseries,JSON.stringify(values.writing),now,...params)];
        if (submission) statements.push(env.DB.prepare("UPDATE submissions SET title=?,content=?,date=?,series=?,subseries=?,writing=?,status='submitted',updated_at=? WHERE id=? AND updated_at=? AND status IN ('submitted','reviewing') AND EXISTS (SELECT 1 FROM partner_works w WHERE w.id=? AND w.version=? AND w.updated_at=?)").bind(values.title,values.content,values.date,values.series,values.subseries,JSON.stringify(values.writing),now,work.submission_id,submission.updated_at,id,work.version+1,now));
        statements.push(env.DB.prepare('DELETE FROM partner_work_history WHERE work_id=? AND version<?').bind(id,work.version-9));
        const results=await env.DB.batch(statements);
        if (!results[1].meta?.changes) fail('稿件状态已变化，请刷新核对',409);
        return json({ok:true});
      }
      if (request.method==='POST' && action==='submit') {
        if(await submissionsPaused(env))fail('目前暂停接收新投稿，草稿可以继续保存，请稍后再送审。',503);
        if (work.submission_id) fail('稿件已经送审，修改后会自动回到待审列表',409);
        if (data.consent!==true) fail('请确认有权投稿并同意审核后公开发表');
        const values=fields(work),{author}=await profile(env,ops,person),sid=crypto.randomUUID(),now=stamp(work.updated_at);
        const results=await env.DB.batch([
          env.DB.prepare("INSERT INTO submissions (id,receipt_hash,consent_version,consent_at,title,author,content,date,series,subseries,writing,author_id,created_at,updated_at) SELECT ?,?,'partner-v1',?,?,?,?,?,?,?,?,?,?,? FROM partner_works WHERE id=? AND partner_id=? AND version=? AND submission_id IS NULL").bind(sid,await digest(randomToken()),now,values.title,author.name,values.content,values.date,values.series,values.subseries,JSON.stringify(values.writing),person.author_id,now,now,id,person.id,work.version),
          env.DB.prepare('UPDATE partner_works SET submission_id=?,version=version+1,updated_at=? WHERE id=? AND partner_id=? AND version=? AND submission_id IS NULL AND EXISTS (SELECT 1 FROM submissions WHERE id=?)').bind(sid,now,id,person.id,work.version,sid)
        ]);
        if (!results[1].meta?.changes) fail('稿件版本已变化，请刷新核对',409);
        return json({ok:true});
      }
      if (request.method==='POST' && action==='withdraw') {
        if (!submission) fail('尚未提交的草稿无需撤回');
        const now=stamp(submission.updated_at);
        const result=await env.DB.prepare("UPDATE submissions SET status='withdrawn',content='',contact='',writing='{}',decided_at=?,updated_at=? WHERE id=? AND updated_at=? AND status IN ('submitted','reviewing')").bind(now,now,work.submission_id,submission.updated_at).run();
        if (!result.meta?.changes) fail('稿件状态已变化，请刷新核对',409);
        await env.DB.batch([env.DB.prepare("UPDATE partner_works SET content='',writing='{}' WHERE id=?").bind(id),env.DB.prepare('DELETE FROM partner_work_history WHERE work_id=?').bind(id)]);
        return json({ok:true});
      }
      fail('未找到',404);
    }
    const poemMatch=url.pathname.match(/^\/api\/partners\/poems\/([^/]+)(?:\/(revision|rebase|history|withdraw))?$/);
    if (poemMatch) {
      const [,id,action]=poemMatch,{poem}=await ownedPoem(env,ops,person,id),baseHash=await fingerprint(poem),revision=await ownOpenRevision(env,person,id);
      if (request.method==='GET' && !action) {
        const last=await env.DB.prepare("SELECT status,reviewer_note FROM partner_revisions WHERE poem_id=? AND partner_id=? AND status IN ('published','declined','withdrawn') ORDER BY decided_at DESC LIMIT 1").bind(id,person.id).first();
        return json({poem,baseHash,revision:revisionView(revision),lastDecision:last});
      }
      if (request.method==='GET' && action==='history') {
        const versions=revision?(await env.DB.prepare('SELECT version,data,created_at FROM partner_revision_history WHERE revision_id=? ORDER BY version DESC LIMIT 10').bind(revision.id).all()).results:[];
        return json({versions:versions.map(r=>({...r,data:JSON.parse(r.data)}))});
      }
      const data=await body(request);
      if (revision && (data.version!==revision.version || revision.status==='publishing')) fail('修订正在发表或已有新版本，请刷新查看',409);
      if (!revision && data.version!==0) fail('修订状态已变化，请刷新查看',409);
      if (request.method==='POST' && action==='rebase') {
        if (!revision) fail('没有待处理的修订',409);
        const result=await env.DB.prepare("UPDATE partner_revisions SET base_hash=?,base_data=?,status='draft',version=version+1,updated_at=? WHERE id=? AND version=? AND status IN ('draft','submitted')").bind(baseHash,JSON.stringify(editable(poem)),stamp(revision.updated_at),revision.id,revision.version).run();
        if (!result.meta?.changes) fail('修订状态已变化，请刷新',409);
        return json({ok:true});
      }
      if (request.method==='POST' && action==='withdraw') {
        if (!revision) fail('没有待处理的修订',409);
        const now=stamp(revision.updated_at);
        const result=await env.DB.prepare("UPDATE partner_revisions SET status='withdrawn',decided_at=?,updated_at=? WHERE id=? AND version=? AND status IN ('draft','submitted')").bind(now,now,revision.id,revision.version).run();
        if (!result.meta?.changes) fail('修订状态已变化，请刷新',409);
        return json({ok:true});
      }
      if (request.method==='PUT' && action==='revision') {
        const values=fields({...data,writing:data.writing===undefined?(revision?JSON.parse(revision.data).writing:poem.writing):data.writing},{published:true}),note=clean(data.note),status=data.submit===true?'submitted':'draft';
        if (note.length>300) fail('修改说明最多 300 字');
        if (data.baseHash!==baseHash || (revision && revision.base_hash!==baseHash)) fail('已发表作品有新版本，请先备份当前输入，再更新对照版本',409);
        const now=stamp(revision?.updated_at),serialized=JSON.stringify(values);
        if (revision) {
          const result=await env.DB.batch([
            env.DB.prepare("INSERT INTO partner_revision_history (revision_id,version,data,created_at) SELECT id,version,data,? FROM partner_revisions WHERE id=? AND version=? AND status IN ('draft','submitted')").bind(now,revision.id,revision.version),
            env.DB.prepare("UPDATE partner_revisions SET data=?,note=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status IN ('draft','submitted')").bind(serialized,note,status,now,revision.id,revision.version),
            env.DB.prepare('DELETE FROM partner_revision_history WHERE revision_id=? AND version<?').bind(revision.id,revision.version-9)
          ]);
          if (!result[1].meta?.changes) fail('修订版本已变化，请刷新',409);
        } else {
          try { await env.DB.prepare('INSERT INTO partner_revisions (id,partner_id,poem_id,status,data,base_data,base_hash,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),person.id,id,status,serialized,JSON.stringify(editable(poem)),baseHash,note,now,now).run(); } catch { fail('已有另一份待审修订，请刷新查看',409); }
        }
        return json({ok:true});
      }
      fail('未找到',404);
    }
    fail('未找到',404);
    });
  } catch (error) { return json({error:error.status?error.message:'暂时无法完成操作，请保留输入并稍后重试'},error.status||502); }
}

export async function partnerSubmission(env, id) {
  return env.DB.prepare('SELECT p.id,p.status,p.author_id FROM partner_works w JOIN partners p ON p.id=w.partner_id WHERE w.submission_id=?').bind(id).first();
}
export async function recordPartnerPublication(env, person, poemId) {
  if (!person) return;
  const existing=await env.DB.prepare('SELECT partner_id FROM partner_poems WHERE poem_id=?').bind(poemId).first();
  if (existing && existing.partner_id!==person.id) fail('作品归属冲突，请联系维护者',409);
  await env.DB.prepare('INSERT INTO partner_poems (poem_id,partner_id,author_id,assigned_at) VALUES (?,?,?,?) ON CONFLICT(poem_id) DO UPDATE SET partner_id=CASE WHEN partner_poems.partner_id=excluded.partner_id THEN partner_poems.partner_id ELSE NULL END').bind(poemId,person.id,person.author_id,stamp()).run();
}

async function checkAssignments(env,ops,person,author,ids) {
  if (!Array.isArray(ids) || ids.length>5000 || ids.some(id=>typeof id!=='string') || new Set(ids).size!==ids.length) fail('请选择有效的历史作品');
  if (!ids.length) return;
  const poems=(await ops.readGitHubJson(env,'data/poems.json')).data;
  const byId=new Map(poems.map(p=>[p.id,p]));
  for (const id of ids) { const poem=byId.get(id); if (!poem || ![author.name,...(author.aliases||[])].includes(poem.author)) fail('历史作品与选定作者不符，请重新核对',409); }
  const conflict=await env.DB.prepare('SELECT poem_id FROM partner_poems WHERE poem_id IN (SELECT value FROM json_each(?)) AND partner_id!=? LIMIT 1').bind(JSON.stringify(ids),person.id).first();
  if (conflict) fail('所选作品已属于另一合作账号，不能重复分配',409);
}
function assignmentStatement(env,ids,person,authorId,now) {
  // json_each keeps a prolific author's assignment within D1 query/binding limits.
  // A competing owner causes NOT NULL failure and rolls back the entire batch.
  return env.DB.prepare("INSERT INTO partner_poems (poem_id,partner_id,author_id,assigned_at) SELECT value,?,?,? FROM json_each(?) WHERE EXISTS (SELECT 1 FROM partners WHERE id=? AND author_id=? AND updated_at=? AND status IN ('active','suspended')) ON CONFLICT(poem_id) DO UPDATE SET partner_id=CASE WHEN partner_poems.partner_id=excluded.partner_id THEN partner_poems.partner_id ELSE NULL END,assigned_at=excluded.assigned_at").bind(person.id,authorId,now,JSON.stringify(ids),person.id,authorId,now);
}
async function approveMember(request,env,ops,id,actor) {
  const data=await body(request),person=await env.DB.prepare('SELECT * FROM partners WHERE id=?').bind(id).first();
  const note=clean(data.note);if(note.length>300) fail('说明最多 300 字');
  if (!person || person.status!=='pending' || data.updatedAt!==person.updated_at) fail('申请已变化，请刷新核对',409);
  const authorId=clean(data.authorId)||'partner-'+person.id;
  const file=await ops.readGitHubJson(env,'data/authors.json');
  let author=file.data.find(a=>a.id===authorId),newAuthor=false;
  if (!author && data.authorId) fail('选中的作者资料不存在',409);
  if (!author) {
    if (file.data.some(a=>[a.name,...(a.aliases||[])].includes(person.desired_name))) fail('这个笔名已有作者资料，请核实身份后选择已有作者',409);
    author={id:authorId,name:person.desired_name,aliases:[person.desired_name],bio:'',tags:[],link:''};
    file.data.push(author);newAuthor=true;
  }
  const ids=data.poemIds===undefined?[]:data.poemIds;
  if (!Array.isArray(ids) || ids.length>5000 || ids.some(id=>typeof id!=='string') || new Set(ids).size!==ids.length) fail('请选择有效的历史作品');
  await checkAssignments(env,ops,person,author,ids);
  let lock;
  const lockedAt=stamp(person.updated_at);
  try { lock=await env.DB.prepare("UPDATE partners SET status='approving',author_id=?,updated_at=? WHERE id=? AND status='pending' AND updated_at=?").bind(authorId,lockedAt,id,person.updated_at).run(); } catch { fail('这个作者已绑定其他账号，请核实身份',409); }
  if (!lock.meta?.changes) fail('申请已被处理，请刷新查看',409);
  try {
    if (newAuthor && !await ops.writeGitHubJson(env,'data/authors.json',file.data,file.sha,'开通合作作者: '+author.name)) fail('作者资料同时更新，请刷新重试',409);
    const now=stamp(lockedAt);
    const result=await env.DB.batch([env.DB.prepare("UPDATE partners SET status='active',reviewer_note=?,updated_at=? WHERE id=? AND status='approving' AND author_id=? AND updated_at=?").bind(note,now,id,authorId,lockedAt),assignmentStatement(env,ids,person,authorId,now)]);
    if (!result[0].meta?.changes) fail('开通状态已变化，请刷新',409);
    await audit(env,actor,'approve-member',id);
    return json({ok:true});
  } catch(error) {
    await env.DB.prepare("UPDATE partners SET status='pending',author_id='',updated_at=? WHERE id=? AND status='approving' AND updated_at=?").bind(stamp(lockedAt),id,lockedAt).run();
    throw error;
  }
}

async function approveRevision(request,env,ops,id,actor) {
  const data=await body(request);
  const revision=await env.DB.prepare('SELECT r.*,p.status AS member_status,p.author_id FROM partner_revisions r JOIN partners p ON p.id=r.partner_id WHERE r.id=?').bind(id).first();
  if (!revision || revision.member_status!=='active') fail('申请者合作权限不可用，请先核对',409);
  if (data.version!==revision.version) fail('修订已有新版本，请重新查看差异',409);
  if (revision.status==='published') return json({ok:true});
  const person={id:revision.partner_id,author_id:revision.author_id};
  const proposal=fields(JSON.parse(revision.data),{published:true});
  const now=stamp(revision.updated_at),stale=new Date(Date.now()-5*60000).toISOString();
  const locked=await env.DB.prepare("UPDATE partner_revisions SET status='publishing',updated_at=? WHERE id=? AND version=? AND (status='submitted' OR (status='publishing' AND updated_at<?))").bind(now,id,revision.version,stale).run();
  if (!locked.meta?.changes) fail('修订尚未提交、已处理或正在发表，请刷新',409);
  try {
    let written=false;
    for (let attempt=0;attempt<3;attempt++) {
      const {file,poem}=await ownedPoem(env,ops,person,revision.poem_id);
      if (poem.lastPartnerRevisionId===id && Object.keys(proposal).every(key=>JSON.stringify(key==='writing'?storedWriting(poem.writing):(poem[key]||''))===JSON.stringify(proposal[key]))) { written=true;break; }
      if (await fingerprint(poem)!==revision.base_hash) fail('公开作品在申请之后已有变化，请让作者更新对照版本后重送修订',409);
      const currentMember=await env.DB.prepare("SELECT id FROM partners WHERE id=? AND status='active' AND author_id=?").bind(person.id,person.author_id).first();
      if (!currentMember) fail('合作权限已变化，请刷新',409);
      const previous={...poem}; Object.assign(poem,proposal);if(!proposal.subseries)delete poem.subseries;
      poem.lastPartnerRevisionId=id;ops.stampPoem(poem,previous);
      if (await ops.writeGitHubJson(env,'data/poems.json',file.data,file.sha,'批准作品修订: '+proposal.title)) { written=true;break; }
    }
    if (!written) fail('诗集同时被修改，请稍后重试',409);
    await env.DB.prepare("UPDATE partner_revisions SET status='published',decided_at=?,updated_at=? WHERE id=? AND status='publishing' AND version=?").bind(stamp(),stamp(),id,revision.version).run();
    await audit(env,actor,'approve-revision',id);
    return json({ok:true});
  } catch(error) {
    await env.DB.prepare("UPDATE partner_revisions SET status='submitted' WHERE id=? AND status='publishing' AND version=?").bind(id,revision.version).run();
    throw error;
  }
}

export async function partnerAdminRoutes(request,env,ops,actor) {
  const url=new URL(request.url);
  // All calls enter here only after authorizeReviewer has accepted the maintainer.
  if (request.method==='GET' && (url.pathname==='/collaborators'||url.pathname==='/revisions')) return partnerPage(url.pathname==='/collaborators'?'members':'revisions',env);
  if (!url.pathname.startsWith('/api/collaborators') && !url.pathname.startsWith('/api/revisions')) return null;
  try {
    if (request.method!=='GET' && (request.headers.get('Origin')!==url.origin || request.headers.get('X-Requested-With')!=='poem-review')) fail('请求来源无效',403);
    if (request.method==='GET' && url.pathname==='/api/collaborators') {
      const rows=(await env.DB.prepare('SELECT id,email,status,author_id,desired_name,application_note,reviewer_note,created_at,updated_at,applied_at FROM partners ORDER BY applied_at DESC,created_at DESC').all()).results;
      return json({partners:rows,configured:partnerConfigured(env)});
    }
    if (request.method==='GET' && url.pathname==='/api/collaborators/options') {
      const [authors,poems]=await Promise.all([ops.readGitHubJson(env,'data/authors.json'),ops.readGitHubJson(env,'data/poems.json')]);
      const owners=(await env.DB.prepare('SELECT poem_id,partner_id FROM partner_poems').all()).results;
      return json({authors:authors.data.map(a=>({id:a.id,name:a.name,aliases:a.aliases||[]})),poems:poems.data.map(p=>({id:p.id,title:p.title,author:p.author,owner:owners.find(o=>o.poem_id===p.id)?.partner_id||''}))});
    }
    const memberMatch=url.pathname.match(/^\/api\/collaborators\/([^/]+)\/(approve|reject|suspend|reactivate|assign|recover)$/);
    if (memberMatch && request.method==='POST') {
      const [,id,action]=memberMatch;
      if (action==='approve') return await approveMember(request,env,ops,id,actor);
      const data=await body(request),note=clean(data.note);
      if (note.length>300) fail('说明最多 300 字');
      const person=await env.DB.prepare('SELECT * FROM partners WHERE id=?').bind(id).first();
      if (!person || data.updatedAt!==person.updated_at) fail('账号状态已有变化，请刷新核对',409);
      if (action==='recover') {
        if (person.status!=='approving' || Date.parse(person.updated_at)>Date.now()-300000) fail('开通仍在进行，请等待五分钟后刷新重试',409);
        const result=await env.DB.prepare("UPDATE partners SET status='pending',author_id='',updated_at=? WHERE id=? AND status='approving' AND updated_at=?").bind(stamp(person.updated_at),id,person.updated_at).run();
        if (!result.meta?.changes) fail('开通状态已变化，请刷新',409);
        await audit(env,actor,'recover-member',id);return json({ok:true});
      }
      if (action==='assign') {
        if (!['active','suspended'].includes(person.status)) fail('请先开通合作权限',409);
        const {author}=await profile(env,ops,person),ids=data.poemIds||[];
        await checkAssignments(env,ops,person,author,ids);
        const now=stamp(person.updated_at);
        const result=await env.DB.batch([env.DB.prepare("UPDATE partners SET updated_at=? WHERE id=? AND status IN ('active','suspended') AND updated_at=?").bind(now,id,person.updated_at),assignmentStatement(env,ids,person,person.author_id,now)]);
        if (!result[0].meta?.changes) fail('账号状态已变化，请刷新',409);
        await audit(env,actor,'assign-poems',id);return json({ok:true});
      }
      const from=action==='reject'?'pending':action==='suspend'?'active':'suspended',to=action==='reject'?'rejected':action==='suspend'?'suspended':'active';
      if (action==='reactivate') await profile(env,ops,person);
      const result=await env.DB.prepare('UPDATE partners SET status=?,reviewer_note=?,updated_at=? WHERE id=? AND status=? AND updated_at=?').bind(to,note,stamp(person.updated_at),id,from,person.updated_at).run();
      if (!result.meta?.changes) fail('账号状态不允许此操作，请刷新查看',409);
      if (action==='suspend') await env.DB.prepare('DELETE FROM partner_sessions WHERE partner_id=?').bind(id).run();
      await audit(env,actor,action+'-member',id);return json({ok:true});
    }
    if (request.method==='GET' && url.pathname==='/api/revisions') {
      const rows=(await env.DB.prepare("SELECT r.id,r.poem_id,r.status,r.version,r.note,r.created_at,r.updated_at,p.desired_name,p.email FROM partner_revisions r JOIN partners p ON p.id=r.partner_id WHERE r.status IN ('submitted','publishing') ORDER BY r.updated_at DESC").all()).results;
      return json({revisions:rows});
    }
    const revMatch=url.pathname.match(/^\/api\/revisions\/([^/]+)(?:\/(approve|reject))?$/);
    if (revMatch) {
      const [,id,action]=revMatch;
      if (request.method==='GET' && !action) {
        const row=await env.DB.prepare('SELECT r.*,p.desired_name,p.email,p.status AS member_status FROM partner_revisions r JOIN partners p ON p.id=r.partner_id WHERE r.id=?').bind(id).first();
        if (!row) fail('修订不存在',404);
        return json({revision:{...row,data:row.data?JSON.parse(row.data):null,base_data:row.base_data?JSON.parse(row.base_data):null}});
      }
      if (request.method==='POST' && action==='approve') return await approveRevision(request,env,ops,id,actor);
      if (request.method==='POST' && action==='reject') {
        const data=await body(request),note=clean(data.note),now=stamp();
        if (note.length>300) fail('反馈最多 300 字');
        const result=await env.DB.prepare("UPDATE partner_revisions SET status='declined',reviewer_note=?,decided_at=?,updated_at=? WHERE id=? AND version=? AND status='submitted'").bind(note,now,now,id,data.version).run();
        if (!result.meta?.changes) fail('修订已有新版本或正在发表，请重新核对',409);
        await audit(env,actor,'reject-revision',id);return json({ok:true});
      }
    }
    fail('未找到',404);
  } catch(error) { return json({error:error.status?error.message:'操作未完成，请刷新检查后重试'},error.status||502); }
}
