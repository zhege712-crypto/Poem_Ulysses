import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { fixture,origin } from './partners-fixture.mjs';
import { tokenHash,securityRate,cleanupSecurity } from './security.mjs';
import { SECURITY_HTML,securityPage } from './security-ui.mjs';
import publicWorker from './public.mjs';
const now=()=>new Date().toISOString();
async function data(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json()}
async function reviewer(f,token='c'.repeat(64),age=0,email='owner@example.com') {
  Object.assign(f.env,{REVIEW_AUTH:'github',GITHUB_OAUTH_CLIENT_ID:'test-client',GITHUB_OAUTH_SECRET:'test-private-oauth'});
  f.sql.prepare('INSERT INTO reviewer_sessions(session_hash,email,created_at,expires_at) VALUES (?,?,?,?)').run(await tokenHash(token),email,new Date(Date.now()-age).toISOString(),new Date(Date.now()+3600000).toISOString());
  return token;
}
function review(f,path,method='GET',body,token='c'.repeat(64),headers={}) { return f.call(path,method,body,{admin:true,headers:{Cookie:'__Host-poem_review='+token,...headers}}); }

test('maintainer logout revokes a copied token; legacy cookies and forged tokens are rejected',async()=>{const f=fixture();try{
  const token=await reviewer(f);await data(await review(f,'/api/submissions'));
  assert.equal((await review(f,'/auth/logout','POST')).status,302);
  await data(await review(f,'/api/submissions'),401);
  await data(await review(f,'/api/submissions','GET',undefined,'legacy.signed-cookie'),401);
  await data(await review(f,'/api/submissions','GET',undefined,'d'.repeat(64)),401);
  assert.equal(f.sql.prepare('SELECT result FROM security_audit').get().result,302);
}finally{f.close()}});

test('maintainer session controls never expose credential hashes and cannot revoke another reviewer',async()=>{const f=fixture();try{
  const first=await reviewer(f),second=await reviewer(f,'d'.repeat(64));await reviewer(f,'e'.repeat(64),0,'other@example.com');
  let list=await data(await review(f,'/api/security/sessions'));assert.equal(list.sessions.length,2);assert.equal(list.sessions.filter(s=>s.current).length,1);
  assert.ok(!JSON.stringify(list).includes(await tokenHash(first))&&!JSON.stringify(list).includes(first));
  await data(await review(f,'/api/security/sessions','POST',{action:'revoke',id:await tokenHash('session-handle:'+await tokenHash('e'.repeat(64)))}),404);
  await data(await review(f,'/api/security/sessions','POST',{action:'others'}));
  await data(await review(f,'/api/submissions','GET',undefined,second),401);await data(await review(f,'/api/submissions'));
  assert.equal(f.sql.prepare('SELECT count(*) n FROM reviewer_sessions WHERE email=?').get('other@example.com').n,1);
  const ended=await data(await review(f,'/api/security/sessions','POST',{action:'all'}));assert.equal(ended.signedOut,true);await data(await review(f,'/api/security/sessions'),401);
}finally{f.close()}});

test('partner can revoke an individual or all own sessions while other partners stay logged in',async()=>{const f=fixture();try{
  await f.person();await f.person('u2','active','b');const extra='f'.repeat(64);
  f.sql.prepare('INSERT INTO partner_sessions VALUES (?,?,?,?)').run(await tokenHash(extra),'u1',new Date(Date.now()+3600000).toISOString(),now());
  let list=await data(await f.call('/api/partners/security/sessions'));assert.equal(list.sessions.length,2);
  const other=list.sessions.find(s=>!s.current);await data(await f.call('/api/partners/security/sessions','POST',{action:'revoke',id:other.id}));
  await data(await f.call('/api/partners/me','GET',undefined,{token:extra}),401);
  await data(await f.call('/api/partners/security/sessions','POST',{action:'all'}));await data(await f.call('/api/partners/me'),401);
  await data(await f.call('/api/partners/me','GET',undefined,{token:'b'.repeat(64)}));
}finally{f.close()}});

test('pending collaborators retain safety controls and cannot read maintainer audit or settings',async()=>{const f=fixture();try{
  await f.person('u1','pending','');await data(await f.call('/api/partners/security/sessions'));
  assert.equal((await f.call('/api/security/audit')).status,403);assert.equal((await f.call('/api/security/settings')).status,403);
  await data(await f.call('/api/partners/security/sessions','POST',{action:'all'}));
}finally{f.close()}});

test('session revocation and pause switches reject cross-origin requests without changing data',async()=>{const f=fixture();try{
  await reviewer(f);await f.person();
  await data(await review(f,'/api/security/sessions','POST',{action:'all'},'c'.repeat(64),{Origin:'https://evil.example'}),403);
  await data(await review(f,'/api/security/settings','PUT',{submissionsPaused:true},'c'.repeat(64),{'X-Requested-With':''}),403);
  await data(await f.call('/api/partners/security/sessions','POST',{action:'all'},{headers:{Origin:'https://evil.example'}}),403);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM reviewer_sessions').get().n,1);assert.equal(f.sql.prepare('SELECT count(*) n FROM partner_sessions').get().n,1);assert.equal(f.sql.prepare('SELECT count(*) n FROM security_settings').get().n,0);
}finally{f.close()}});

test('stale maintainer login can read and exit but must reauthenticate before important writes',async()=>{const f=fixture();try{
  await reviewer(f,'c'.repeat(64),31*60000);
  await data(await review(f,'/api/security/sessions'));
  for(const [path,method,body] of [['/api/security/settings','PUT',{submissionsPaused:true}],['/api/admin/files/poems','PUT',{sha:'1',data:[]}],['/api/collaborators/missing/approve','POST',{}],['/api/submissions/00000000-0000-0000-0000-000000000000/publish','POST',{}]]) {
    const result=await data(await review(f,path,method,body),403);assert.equal(result.code,'reauth_required');
  }
  assert.equal(f.writes,0);assert.equal(f.sql.prepare('SELECT count(*) n FROM security_settings').get().n,0);
  await data(await review(f,'/api/security/sessions','POST',{action:'all'}));
}finally{f.close()}});

test('new-submission pause affects both entry points; drafts, old withdrawals and resume still work',async()=>{const f=fixture();try{
  await reviewer(f);await f.person();const props={title:'新稿',content:'正文内容',date:'2026-10-03',series:'合集'};
  const work=await data(await f.call('/api/partners/works','POST',props),201);
  await data(await f.call('/api/partners/works/'+work.id+'/submit','POST',{version:1,consent:true}));
  const second=await data(await f.call('/api/partners/works','POST',props),201);
  await data(await review(f,'/api/security/settings','PUT',{submissionsPaused:true}));
  await data(await f.call('/api/partners/works/'+second.id+'/submit','POST',{version:1,consent:true}),503);
  await data(await f.call('/api/partners/works/'+second.id,'PUT',{...props,title:'仍可保存',version:1}));
  const old=(await data(await f.call('/api/partners/works/'+work.id))).work;
  await data(await f.call('/api/partners/works/'+work.id+'/withdraw','POST',{version:old.version,submissionUpdatedAt:old.submissionUpdatedAt}));
  Object.assign(f.env,{ALLOWED_ORIGIN:'https://poems.example',PUBLIC_HOSTNAME:'poems.example',RATE_SECRET:'public-rate-secret',TURNSTILE_SECRET:'private-turnstile'});
  const request=new Request('https://public.example/api/submissions',{method:'POST',headers:{Origin:'https://poems.example','CF-Connecting-IP':'192.0.2.2','Content-Type':'application/json'},body:JSON.stringify({...props,author:'笔名',consent:true,turnstileToken:'private-challenge'})});
  const response=await publicWorker.fetch(request,f.env);assert.match((await data(response,503)).error,/暂停/);
  await data(await review(f,'/api/security/settings','PUT',{submissionsPaused:false}));
  await data(await f.call('/api/partners/works/'+second.id+'/submit','POST',{version:2,consent:true}));
}finally{f.close()}});

test('account write limits survive IP changes and read limits cover GitHub-backed queries',async()=>{const f=fixture();try{
  await f.person();await securityRate(f.env,'private-account:partner:u1:write',0);
  const response=await f.call('/api/partners/works','POST',{title:'限流',content:'正文内容'},{headers:{'CF-Connecting-IP':'192.0.2.99'}});await data(response,429);assert.ok(response.headers.get('retry-after'));
  assert.equal(f.sql.prepare('SELECT count(*) n FROM partner_works').get().n,0);
  await securityRate(f.env,'private-account:partner:u1:read',0);
  await data(await f.call('/api/partners/library','GET',undefined,{headers:{'CF-Connecting-IP':'192.0.2.100'}}),429);
}finally{f.close()}});

test('rate storage contains neither raw IP nor identity and cached rejection avoids repeat writes',async()=>{const f=fixture();try{
  assert.equal(await securityRate(f.env,'private-ip:192.0.2.1:person@example.com',1),true);
  assert.equal(await securityRate(f.env,'private-ip:192.0.2.1:person@example.com',1),false);
  const rows=f.sql.prepare('SELECT * FROM security_rate').all();assert.ok(!JSON.stringify(rows).includes('192.0.2.1')&&!JSON.stringify(rows).includes('person@example.com'));
  assert.equal(await securityRate(f.env,'private-ip:192.0.2.1:person@example.com',1),false);assert.equal(f.sql.prepare('SELECT count FROM security_rate').get().count,2);
}finally{f.close()}});

test('platform burst rejection precedes any database access and does not disclose IPs in binding keys',async()=>{const f=fixture();try{
  let passedKey='';f.env.BURST_LIMITER={async limit({key}){passedKey=key;return{success:false}}};
  f.DB.prepare=()=>{throw new Error('burst rejection must not touch D1')};
  await data(await f.call('/api/partners/me'),429);assert.match(passedKey,/^[a-f0-9]{64}$/);
  assert.equal(passedKey.includes('192.0.2.1'),false);
  Object.assign(f.env,{ALLOWED_ORIGIN:'https://poems.example',RATE_SECRET:'public-secret'});
  const response=await publicWorker.fetch(new Request('https://public.example/api/status',{headers:{Origin:'https://poems.example','CF-Connecting-IP':'192.0.2.1'}}),f.env);
  await data(response,429);assert.equal(response.headers.get('access-control-allow-origin'),'https://poems.example');
}finally{f.close()}});

test('audit captures failed and successful writes without private payload or query strings',async()=>{const f=fixture();try{
  await f.person();await reviewer(f);
  await data(await f.call('/api/partners/works?secret=private-query','POST',{title:'private-title',content:'private-poem-content'}),201);
  await data(await f.call('/api/partners/works/no-such-id','DELETE',{version:99,contact:'private-contact@example.com'}),404);
  const events=(await data(await review(f,'/api/security/audit'))).events;assert.equal(events.length,2);assert.ok(events.some(e=>e.result===201)&&events.some(e=>e.result===404));
  const text=JSON.stringify(events);for(const value of ['private-query','private-title','private-poem-content','private-contact@example.com','a'.repeat(64),f.env.GITHUB_TOKEN])assert.ok(!text.includes(value));
}finally{f.close()}});

test('audit storage failure stops a write before remote data changes',async()=>{const f=fixture();try{
  await reviewer(f);const real=f.DB.prepare.bind(f.DB);f.DB.prepare=query=>{if(query.startsWith('INSERT INTO security_audit'))throw new Error('audit unavailable');return real(query)};
  await data(await review(f,'/api/admin/files/authors','PUT',{sha:'1',data:[]}),503);assert.equal(f.writes,0);
}finally{f.close()}});

test('audit pagination is stable and cleanup expires metadata without deleting active sessions or manuscripts',async()=>{const f=fixture();try{
  await reviewer(f);await f.person();const current=now(),old=new Date(Date.now()-91*86400000).toISOString();
  for(let i=0;i<55;i++)f.sql.prepare('INSERT INTO security_audit VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),'reviewer:owner@example.com','PUT','api/admin/files/poems',200,current);
  f.sql.prepare('INSERT INTO security_audit VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),'reviewer:owner@example.com','PUT','old',200,old);
  const first=await data(await review(f,'/api/security/audit')),second=await data(await review(f,'/api/security/audit?before='+first.next));assert.equal(first.events.length,50);assert.equal(second.events.length,6);assert.equal(new Set([...first.events,...second.events].map(e=>e.id)).size,56);
  f.sql.prepare('INSERT INTO session_labels VALUES (?,?)').run('unused','Chrome');f.sql.prepare('INSERT INTO security_rate VALUES (?,1,?)').run('old-rate',old);
  await cleanupSecurity(f.env);assert.equal(f.sql.prepare('SELECT count(*) n FROM security_audit').get().n,55);assert.equal(f.sql.prepare('SELECT count(*) n FROM partner_sessions').get().n,1);assert.equal(f.sql.prepare('SELECT count(*) n FROM reviewer_sessions').get().n,1);assert.equal(f.sql.prepare('SELECT count(*) n FROM session_labels').get().n,0);
}finally{f.close()}});

test('security pages parse and have strict CSP, role-specific requests and usable safety actions',async()=>{
  const script=SECURITY_HTML.match(/<script nonce="__NONCE__">([\s\S]*?)<\/script>/)[1].replace('__CONFIG__',JSON.stringify({partner:true}));assert.doesNotThrow(()=>new Script(script));
  for(const partner of [true,false]){const response=securityPage(partner);assert.match(response.headers.get('content-security-policy'),/style-src 'nonce-/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();assert.match(html,/退出所有会话/);assert.ok(!html.includes('__CONFIG__'));assert.ok(!html.includes('__NONCE__'))}
});
