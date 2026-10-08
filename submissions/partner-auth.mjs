import { securityRate, tokenHash, browserLabel, audited, privateRate, rateReply } from './security.mjs';
const SESSION = '__Host-poem_partner';
const STATE = '__Host-poem_partner_state';
const SESSION_MS = 7 * 86400000;
const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' };
export function partnerJson(data, status = 200) { return Response.json(data, { status, headers }); }
export function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2,'0')).join(''); }
export async function digest(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2,'0')).join(''); }
function cookie(request, name) { return (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1) || ''; }
function cookieValue(name, value, seconds) { return name + '=' + value + '; Path=/; Max-Age=' + seconds + '; HttpOnly; Secure; SameSite=Lax'; }
function redirect(url, cookies = []) { const result = new Headers({ ...headers, location: url }); for (const value of cookies) result.append('set-cookie',value); return new Response(null, { status:303, headers: result }); }
export function partnerConfigured(env) { try { const url = new URL(env.PARTNER_BASE_URL); return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET && url.protocol === 'https:' && url.pathname === '/'); } catch { return false; } }
export function samePartnerOrigin(request, env) { return request.headers.get('Origin') === new URL(env.PARTNER_BASE_URL).origin && new URL(request.url).origin === new URL(env.PARTNER_BASE_URL).origin && request.headers.get('X-Requested-With') === 'poem-partner'; }
export async function partnerRate(request, env, kind, limit = 60) {
  if (!env.SESSION_SECRET) return false;
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return false;
  return securityRate(env,'partner:'+kind+':'+ip,limit);
}
export async function partnerIdentity(request, env) {
  const value = cookie(request, SESSION);
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  const hash=await digest(value);
  const person=await env.DB.prepare('SELECT p.*,s.created_at AS authenticated_at FROM partner_sessions s JOIN partners p ON p.id=s.partner_id WHERE s.session_hash=? AND s.expires_at>?').bind(hash,new Date().toISOString()).first();
  return person?{...person,session_hash:hash}:null;
}
export async function partnerAuthRoute(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/partner-auth/')) return null;
  if (url.pathname === '/partner-auth/logout' && request.method === 'POST') {
    if (!samePartnerOrigin(request,env)) return partnerJson({error:'请求来源无效'},403);
    const person=await partnerIdentity(request,env);
    if(!person)return partnerJson({error:'请先使用 Google 登录'},401);
    if(!await privateRate(request,env,'partner:'+person.id))return rateReply();
    return audited(request,env,'partner:'+person.id,async()=>{
      await env.DB.prepare('DELETE FROM partner_sessions WHERE session_hash=?').bind(person.session_hash).run();
      return new Response(JSON.stringify({ok:true}),{headers:{...headers,'content-type':'application/json','set-cookie':cookieValue(SESSION,'',0)}});
    });
  }
  if (!partnerConfigured(env) || url.origin !== new URL(env.PARTNER_BASE_URL).origin) return partnerJson({error:'Google 登录尚未配置，请稍后再试；普通投稿仍可使用。'},503);
  if (url.pathname === '/partner-auth/login' && request.method === 'GET') {
    if (!await partnerRate(request,env,'login',30)) return partnerJson({error:'登录尝试过于频繁，请稍后再试'},429);
    const state=randomToken();
    await env.DB.prepare('INSERT INTO partner_oauth_states (state_hash,expires_at) VALUES (?,?)').bind(await digest(state),new Date(Date.now()+600000).toISOString()).run();
    const destination = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for (const [key,value] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:new URL('partner-auth/callback',env.PARTNER_BASE_URL).href,response_type:'code',scope:'openid email',state,prompt:'select_account'})) destination.searchParams.set(key,value);
    return redirect(destination.href,[cookieValue(STATE,state,600)]);
  }
  if (url.pathname === '/partner-auth/callback' && request.method === 'GET') {
    const state=url.searchParams.get('state')||'', code=url.searchParams.get('code')||'';
    if (!/^[a-f0-9]{64}$/.test(state) || state !== cookie(request,STATE) || !code || code.length>2048) return partnerJson({error:'登录验证已失效，请从合作伙伴页面重新登录'},403);
    const challenge=await env.DB.prepare('DELETE FROM partner_oauth_states WHERE state_hash=? AND expires_at>? RETURNING state_hash').bind(await digest(state),new Date().toISOString()).first();
    if (!challenge) return partnerJson({error:'登录验证已使用或过期，请重新登录'},403);
    try {
      const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:new URL('partner-auth/callback',env.PARTNER_BASE_URL).href,grant_type:'authorization_code'})});
      if (!response.ok) throw new Error();
      const token=await response.json();
      if (typeof token.access_token !== 'string' || !token.access_token) throw new Error();
      // Identity comes from Google's authenticated UserInfo endpoint, never from browser claims.
      const infoResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{authorization:'Bearer '+token.access_token}});
      if (!infoResponse.ok) throw new Error();
      const info=await infoResponse.json();
      if (typeof info.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(info.sub) || typeof info.email !== 'string' || info.email.length>254 || !info.email.includes('@') || info.email_verified!==true) return partnerJson({error:'需要使用已验证邮箱的 Google 账号'},403);
      const now=new Date().toISOString();
      await env.DB.prepare('INSERT INTO partners (id,google_sub,email,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email').bind(crypto.randomUUID(),info.sub,info.email,now,now).run();
      const person=await env.DB.prepare('SELECT id,status FROM partners WHERE google_sub=?').bind(info.sub).first();
      if (person.status==='suspended') return partnerJson({error:'合作权限已暂停，请联系维护者'},403);
      const session=randomToken();
      const hash=await tokenHash(session);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM partner_sessions WHERE partner_id=? AND (expires_at<? OR session_hash IN (SELECT session_hash FROM partner_sessions WHERE partner_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 19))').bind(person.id,now,person.id),
        env.DB.prepare('INSERT INTO partner_sessions (session_hash,partner_id,expires_at,created_at) VALUES (?,?,?,?)').bind(hash,person.id,new Date(Date.now()+SESSION_MS).toISOString(),now),
        env.DB.prepare('INSERT INTO session_labels (session_hash,browser) VALUES (?,?)').bind(hash,browserLabel(request)),
        env.DB.prepare('INSERT INTO security_audit(id,actor,action,target,result,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),'partner:'+person.id,'LOGIN','partner-session',201,now)
      ]);
      return redirect(new URL('partners',env.PARTNER_BASE_URL).href,[cookieValue(STATE,'',0),cookieValue(SESSION,session,SESSION_MS/1000)]);
    } catch { return partnerJson({error:'Google 登录暂时不可用，请重新登录；普通投稿不受影响。'},502); }
  }
  return partnerJson({error:'未找到'},404);
}
export async function cleanupPartnerData(env) {
  const now=new Date().toISOString(),cutoff=new Date(Date.now()-30*86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM partner_sessions WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM partner_oauth_states WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM partner_rate WHERE expires_at<?').bind(now),
    env.DB.prepare("DELETE FROM partner_revision_history WHERE revision_id IN (SELECT id FROM partner_revisions WHERE status IN ('published','declined','withdrawn') AND decided_at<?)").bind(cutoff),
    env.DB.prepare("UPDATE partner_revisions SET data='',base_data='' WHERE status IN ('published','declined','withdrawn') AND decided_at<?").bind(cutoff),
    env.DB.prepare("DELETE FROM partner_work_history WHERE work_id IN (SELECT w.id FROM partner_works w JOIN submissions s ON s.id=w.submission_id WHERE s.status IN ('published','declined','withdrawn') AND s.decided_at<?)").bind(cutoff),
    env.DB.prepare("UPDATE partner_works SET content='',writing='{}' WHERE submission_id IN (SELECT id FROM submissions WHERE status IN ('published','declined','withdrawn') AND decided_at<?)").bind(cutoff),
    env.DB.prepare('DELETE FROM partner_work_history WHERE work_id IN (SELECT id FROM partner_works WHERE submission_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM submissions WHERE submissions.id=partner_works.submission_id))'),
    env.DB.prepare("UPDATE partner_works SET content='',writing='{}' WHERE submission_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM submissions WHERE submissions.id=partner_works.submission_id)")
  ]);
}
