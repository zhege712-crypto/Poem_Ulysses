import { securityPage } from './security-ui.mjs';

export const SECURITY_HEADERS = { 'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-content-type-options':'nosniff', 'x-frame-options':'DENY' };
export function securityJson(value, status=200) { return Response.json(value,{status,headers:SECURITY_HEADERS}); }
export async function tokenHash(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join(''); }
export function browserLabel(request) {
  const ua=request.headers.get('user-agent')||'';
  const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'其他浏览器';
  const device=/Android|iPhone|iPad/.test(ua)?'移动设备':/Windows|Macintosh|Linux/.test(ua)?'电脑':'设备类型未知';
  return browser+' · '+device;
}

// A bounded isolate-local rejection cache reduces D1 writes after a limit is exceeded.
// It is an optimization only; the shared database counter is the enforcement authority.
const rejections=new WeakMap();
export async function burstRate(request,env,scope) {
  const ip=request.headers.get('CF-Connecting-IP'),secret=env.SESSION_SECRET||env.RATE_SECRET;
  if(!ip||!secret)return false;
  if(!env.BURST_LIMITER)return securityRate(env,scope+':'+ip,120,60);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const hash=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(scope+':'+ip))),x=>x.toString(16).padStart(2,'0')).join('');
  return (await env.BURST_LIMITER.limit({key:hash})).success===true;
}
export async function securityRate(env, subject, limit, seconds=3600) {
  const secret=env.SESSION_SECRET||env.RATE_SECRET;
  if (!secret || !env.DB) return false;
  let blocked=rejections.get(env.DB);if(!blocked){blocked=new Map();rejections.set(env.DB,blocked)}
  const now=Date.now(),end=(Math.floor(now/(seconds*1000))+1)*seconds*1000;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('security:'+subject+':'+seconds+':'+end));
  const rateKey=Array.from(new Uint8Array(signed),x=>x.toString(16).padStart(2,'0')).join('');
  const cached=blocked.get(rateKey);
  if (cached && cached>now) return false;
  const row=await env.DB.prepare('INSERT INTO security_rate (rate_key,count,expires_at) VALUES (?,1,?) ON CONFLICT(rate_key) DO UPDATE SET count=count+1 RETURNING count').bind(rateKey,new Date(end+3600000).toISOString()).first();
  if (row.count<=limit) return true;
  if (blocked.size>=4096) blocked.delete(blocked.keys().next().value);
  blocked.set(rateKey,end);
  return false;
}
export async function privateRate(request,env,actor) {
  const ip=request.headers.get('CF-Connecting-IP');
  if (!ip) return false;
  const read=request.method==='GET';
  if (!await securityRate(env,'private-account:'+actor+':'+(read?'read':'write'),read?1200:120)) return false;
  return securityRate(env,'private-ip:'+ip+':'+(read?'read':'write'),read?3600:300);
}
export function rateReply() { const response=securityJson({error:'操作过于频繁，请稍后再试；未保存的输入仍在页面中。'},429);response.headers.set('retry-after','60');return response; }
export function recentReviewer(auth,env) { return env.REVIEW_AUTH!=='github' || (Number.isFinite(Date.parse(auth.authenticatedAt)) && Date.now()-Date.parse(auth.authenticatedAt)<=30*60000); }
export function reauthReply() { return securityJson({error:'此操作需要重新确认登录。请在新标签页重新登录 GitHub，再回到本页重试；保留当前输入。',code:'reauth_required',loginUrl:'/auth/login?return=/security'},403); }
export async function submissionsPaused(env) { const setting=await env.DB.prepare("SELECT value FROM security_settings WHERE name='submissions_paused'").first();return setting?.value==='1'; }

// Audit metadata never contains request bodies, query strings, cookies, IPs or tokens.
export async function audited(request,env,actor,handler) {
  if (['GET','HEAD','OPTIONS'].includes(request.method)) return handler();
  const path=new URL(request.url).pathname;
  const target=path.split('/').filter(Boolean).map(part=>/^[\p{L}\p{N}_.-]{1,100}$/u.test(part)?part:'item').join('/').slice(0,300);
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO security_audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)').bind(id,actor,request.method,target,new Date().toISOString()).run();
  let result=503;
  try { const response=await handler();result=response.status;return response; }
  catch(error) { result=error.status||503;throw error; }
  finally {
    // A remote publication may already have succeeded; never falsely report its failure.
    // A zero result retains evidence of an attempt with an unconfirmed outcome.
    try { await env.DB.prepare('UPDATE security_audit SET result=? WHERE id=?').bind(result,id).run(); }
    catch { console.error('Security audit outcome could not be confirmed'); }
  }
}

async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('请求格式错误');
  if (Number(request.headers.get('content-length')||0)>2048) throw new Error('请求过长');
  const text=await request.text();if(new TextEncoder().encode(text).length>2048) throw new Error('请求过长');
  const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('请求格式错误');return value;
}
export async function sessionRoutes(request,env,identity) {
  const path=new URL(request.url).pathname,partner=identity.kind==='partner';
  const page=partner?'/partner-security':'/security',api=partner?'/api/partners/security/sessions':'/api/security/sessions';
  if (path===page && request.method==='GET') return securityPage(partner);
  if (path!==api) return null;
  const table=partner?'partner_sessions':'reviewer_sessions',column=partner?'partner_id':'email';
  const rows=(await env.DB.prepare(`SELECT s.session_hash,s.created_at,s.expires_at,l.browser FROM ${table} s LEFT JOIN session_labels l ON l.session_hash=s.session_hash WHERE s.${column}=? AND s.expires_at>? ORDER BY s.created_at DESC LIMIT 20`).bind(identity.owner,new Date().toISOString()).all()).results;
  const sessions=await Promise.all(rows.map(async row=>({id:await tokenHash('session-handle:'+row.session_hash),current:row.session_hash===identity.sessionHash,browser:row.browser||'较早的登录（浏览器信息未记录）',createdAt:row.created_at,expiresAt:row.expires_at})));
  if (request.method==='GET') return securityJson({sessions,accountLabel:identity.accountLabel||identity.owner,authenticatedAt:identity.authenticatedAt||'',managed:partner||env.REVIEW_AUTH==='github'});
  if (request.method!=='POST') return securityJson({error:'未找到'},404);
  let data;try{data=await body(request)}catch{return securityJson({error:'请求格式错误'},400)}
  if (!['all','others','revoke'].includes(data.action)) return securityJson({error:'请选择有效的退出操作'},400);
  let current=false;
  if (data.action==='revoke') {
    const index=sessions.findIndex(row=>row.id===data.id);
    if(index<0)return securityJson({error:'该登录已失效或不属于你的账号'},404);
    await env.DB.prepare(`DELETE FROM ${table} WHERE ${column}=? AND session_hash=?`).bind(identity.owner,rows[index].session_hash).run();current=sessions[index].current;
  } else if(data.action==='others') {
    await env.DB.prepare(`DELETE FROM ${table} WHERE ${column}=? AND session_hash!=?`).bind(identity.owner,identity.sessionHash||'').run();
  } else { await env.DB.prepare(`DELETE FROM ${table} WHERE ${column}=?`).bind(identity.owner).run();current=true; }
  const response=securityJson({ok:true,signedOut:current});
  if(current)response.headers.set('set-cookie',(partner?'__Host-poem_partner':'__Host-poem_review')+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  return response;
}
export async function securityAdminRoutes(request,env,auth) {
  const path=new URL(request.url).pathname;
  const session=await sessionRoutes(request,env,{kind:'reviewer',owner:auth.email,sessionHash:auth.sessionHash,authenticatedAt:auth.authenticatedAt});
  if(session)return session;
  if(path==='/api/security/settings') {
    if(request.method==='GET')return securityJson({submissionsPaused:await submissionsPaused(env)});
    if(request.method!=='PUT')return securityJson({error:'未找到'},404);
    if(!recentReviewer(auth,env))return reauthReply();
    let data;try{data=await body(request)}catch{return securityJson({error:'请求格式错误'},400)}
    if(typeof data.submissionsPaused!=='boolean')return securityJson({error:'请选择是否暂停新投稿'},400);
    await env.DB.prepare("INSERT INTO security_settings(name,value) VALUES ('submissions_paused',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").bind(data.submissionsPaused?'1':'0').run();return securityJson({ok:true});
  }
  if(path==='/api/security/audit'&&request.method==='GET') {
    const cursor=new URL(request.url).searchParams.get('before');
    let rows;
    if(cursor) {
      if(!/^[a-f0-9-]{36}$/.test(cursor))return securityJson({error:'记录页码无效'},400);
      rows=(await env.DB.prepare('SELECT id,actor,action,target,result,created_at FROM security_audit WHERE (created_at,id)<(SELECT created_at,id FROM security_audit WHERE id=?) ORDER BY created_at DESC,id DESC LIMIT 50').bind(cursor).all()).results;
    } else rows=(await env.DB.prepare('SELECT id,actor,action,target,result,created_at FROM security_audit ORDER BY created_at DESC,id DESC LIMIT 50').all()).results;
    return securityJson({events:rows,next:rows.length===50?rows.at(-1).id:null});
  }
  return null;
}
export async function cleanupSecurity(env) {
  const now=new Date().toISOString(),cutoff=new Date(Date.now()-90*86400000).toISOString();
  for(const [sql,args] of [
    ['DELETE FROM reviewer_sessions WHERE expires_at<?',[now]],
    ['DELETE FROM reviewer_oauth_states WHERE expires_at<?',[now]],
    ['DELETE FROM security_rate WHERE expires_at<?',[now]],
    ['DELETE FROM security_audit WHERE created_at<?',[cutoff]],
    ['DELETE FROM partner_audit WHERE created_at<?',[cutoff]],
    ['DELETE FROM session_labels WHERE session_hash NOT IN (SELECT session_hash FROM reviewer_sessions UNION SELECT session_hash FROM partner_sessions)',[]]
  ]) await env.DB.prepare(sql).bind(...args).run();
}
