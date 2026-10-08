import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './partners-fixture.mjs';
import { writing, storedWriting, cleanupWriting } from './writing.mjs';
import { cleanupPartnerData } from './partner-auth.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const metadata = {start:'2001',end:'2002-03',place:'合成测试地点甲、合成测试地点乙',public:false};
const props = {title:'隔离测试稿',content:'仅用于本地自动测试',date:'2026-10-07',series:'测试合集',subseries:'',writing:metadata};
const admin = {admin:true};
async function ok(response, status=200) { assert.equal(response.status,status,await response.clone().text());return response.json(); }
async function detail(f,id='p1') { return ok(await f.call('/api/published-poems/'+id,'GET',undefined,admin)); }
async function edit(f,w,id='p1') { const d=await detail(f,id);return ok(await f.call('/api/published-poems/'+id,'PUT',{...d.poem,sha:d.sha,writing:w},admin)); }
async function owner(f) { await f.person(); f.sql.prepare('INSERT INTO partner_poems VALUES (?,?,?,?)').run('p1','u1','a',new Date().toISOString()); }
async function view(f) { return ok(await f.call('/api/partners/poems/p1')); }

test('date precision, leap years, independent blanks and range overlap',()=>{
  for(const date of ['0001','1900','2000-02-29','2026-02','9999-12-31'])assert.equal(writing.normalize({start:date}).start,date);
  for(const date of ['0000','2026-2','1900-02-29','2026-02-30','2026-00','2026-13','2026-01-00','26',' 2026/01','2026-01-01T00:00:00Z'])assert.throws(()=>writing.normalize({start:date}));
  for(const pair of [['2026-12','2026'],['2026','2026-01'],['2026-03-31','2026-03'],['2026','2026']])assert.doesNotThrow(()=>writing.normalize({start:pair[0],end:pair[1]}));
  for(const pair of [['2027','2026'],['2026-04','2026-03'],['2026-03-02','2026-03-01']])assert.throws(()=>writing.normalize({start:pair[0],end:pair[1]}),e=>e.field==='end');
  assert.deepEqual(writing.normalize(),{start:'',end:'',place:'',public:false});
  assert.equal(writing.publicValue(metadata),undefined);
  assert.equal(writing.publicValue({public:true}),undefined);
  assert.deepEqual(writing.publicValue({place:'甲、乙',public:true}),{place:'甲、乙'});
  for(const value of [{start:2026},{public:'true'},{place:'<img>'},{place:'a\nb'},{place:'字'.repeat(201)},[]])assert.throws(()=>writing.normalize(value));
});

test('additive migration preserves old manuscripts and leaves their writing dates empty',()=>{
  const sql=new DatabaseSync(':memory:');try{
    for(const name of ['schema.sql','partners-schema.sql','security-schema.sql'])sql.exec(readFileSync(new URL(name,import.meta.url),'utf8'));
    sql.prepare("INSERT INTO submissions (id,receipt_hash,consent_version,consent_at,title,author,content,created_at,updated_at) VALUES ('old','hash','v1','2020','旧稿','旧笔名','原正文','2020','2020')").run();
    sql.exec(readFileSync(new URL('writing-schema.sql',import.meta.url),'utf8'));
    const row=sql.prepare("SELECT * FROM submissions WHERE id='old'").get();assert.equal(row.content,'原正文');assert.equal(row.updated_at,'2020');assert.deepEqual(storedWriting(row.writing),writing.normalize());
  }finally{sql.close();}
});

test('old partner clients preserve saved writing when the new field is omitted',async()=>{
  const f=fixture();try{
    await owner(f);const c=await ok(await f.call('/api/partners/works','POST',props),201),path='/api/partners/works/'+c.id;
    const w=(await ok(await f.call(path))).work;const {writing:omitted,...legacy}=props;
    await ok(await f.call(path,'PUT',{...legacy,version:w.version}));assert.deepEqual(storedWriting((await ok(await f.call(path))).work.writing),metadata);
    await edit(f,metadata);const v=await view(f);
    await ok(await f.call('/api/partners/poems/p1/revision','PUT',{...legacy,version:0,baseHash:v.baseHash,submit:true}));assert.deepEqual((await view(f)).revision.data.writing,metadata);
  }finally{f.close();}
});

test('a whole library of private metadata uses bounded batch reads and preserves every poem binding',async()=>{
  const f=fixture();try{
    for(let i=0;i<120;i++)f.files['data/poems.json'].push({...f.files['data/poems.json'][0],id:'batch-'+i});
    const all=await ok(await f.call('/api/admin/files/poems','GET',undefined,admin));all.data.forEach(p=>{p.writing={...metadata,place:'隔离地点 '+p.id};});
    await ok(await f.call('/api/admin/files/poems','PUT',all,admin));
    let reads=0;const prepare=f.DB.prepare.bind(f.DB);f.DB.prepare=query=>{if(query.includes('poem_writing WHERE revision IN')){reads++;const statement=prepare(query),bind=statement.bind.bind(statement);statement.bind=(...values)=>{assert.ok(values.length<=90);return bind(...values);};return statement;}return prepare(query);};
    const loaded=await ok(await f.call('/api/admin/files/poems','GET',undefined,admin));assert.equal(reads,2);for(const p of loaded.data)assert.equal(p.writing.place,'隔离地点 '+p.id);
    const pointers=f.files['data/poems.json'];pointers[0].writingRevision=pointers[1].writingRevision;
    assert.equal((await f.call('/api/admin/files/poems','GET',undefined,admin)).status,502);
  }finally{f.close();}
});

test('protected admin and single editor round trip private/public/cleared data with a real SHA conflict',async()=>{
  const f=fixture();try{
    const before=await detail(f); await edit(f,metadata);
    const raw=f.files['data/poems.json'][0];assert.equal(raw.writing,undefined);assert.ok(raw.writingRevision);
    assert.ok(!JSON.stringify(f.files).includes(metadata.place));assert.deepEqual((await detail(f)).poem.writing,metadata);
    assert.equal((await f.call('/api/published-poems/p1','PUT',{...before.poem,sha:before.sha,writing:{place:'stale'}},admin)).status,409);
    assert.equal((await f.call('/api/published-poems/p1')).status,403);
    assert.equal((await f.call('/api/published-poems/p1','PUT',{...before.poem,sha:before.sha},{admin:true,headers:{Origin:'https://evil.example'}})).status,403);
    const all=await ok(await f.call('/api/admin/files/poems','GET',undefined,admin));all.data[0].writing.public=true;
    // Client pointers and system timestamps never win over server values.
    all.data[0].writingRevision='forged';all.data[0].updatedAt='forged';
    await ok(await f.call('/api/admin/files/poems','PUT',all,admin));
    assert.deepEqual(f.files['data/poems.json'][0].writing,{start:'2001',end:'2002-03',place:metadata.place});
    assert.notEqual(f.files['data/poems.json'][0].writingRevision,'forged');
    await edit(f,{...metadata,public:false});assert.equal(f.files['data/poems.json'][0].writing,undefined);
    await edit(f,{});assert.deepEqual((await detail(f)).poem.writing,writing.normalize());
    const noOp=f.files['data/poems.json'][0].updatedAt,pointer=f.files['data/poems.json'][0].writingRevision;
    await edit(f,{});assert.equal(f.files['data/poems.json'][0].updatedAt,noOp);assert.equal(f.files['data/poems.json'][0].writingRevision,pointer);
    assert.ok(!JSON.stringify(f.sql.prepare('SELECT * FROM security_audit').all()).includes(metadata.place));
  }finally{f.close();}
});

test('partner drafts, histories, review edits and publication preserve writing with fixed ownership',async()=>{
  const f=fixture();try{
    await f.person();await f.person('u2','active','b');const created=await ok(await f.call('/api/partners/works','POST',props),201);
    const path='/api/partners/works/'+created.id;let w=(await ok(await f.call(path))).work;
    assert.deepEqual(storedWriting(w.writing),metadata);
    await ok(await f.call(path,'PUT',{...props,writing:{...metadata,end:'2003'},version:w.version}));
    assert.deepEqual((await ok(await f.call(path+'/history'))).versions[0].data.writing,metadata);
    assert.equal((await f.call(path,'GET',undefined,{token:'b'.repeat(64)})).status,404);
    assert.equal((await f.call(path+'/history','GET',undefined,{token:'b'.repeat(64)})).status,404);
    w=(await ok(await f.call(path))).work;await ok(await f.call(path+'/submit','POST',{version:w.version,consent:true}));
    w=(await ok(await f.call(path))).work;const sid=w.submission_id,stamp=w.submissionUpdatedAt;
    const saved=await ok(await f.call('/api/submissions/'+sid,'PUT',{...props,author:'作者甲',authorId:'a',expectedUpdatedAt:stamp},admin));
    w=(await ok(await f.call(path))).work;assert.deepEqual(storedWriting(w.writing),metadata);
    assert.equal((await f.call(path,'PUT',{...props,version:w.version,submissionUpdatedAt:stamp})).status,409);
    await ok(await f.call('/api/submissions/'+sid+'/publish','POST',{expectedUpdatedAt:saved.updatedAt},admin));
    const poem=f.files['data/poems.json'].at(-1);assert.equal(poem.writing,undefined);
    assert.deepEqual((await ok(await f.call('/api/partners/poems/'+poem.id))).poem.writing,metadata);
    f.sql.prepare("UPDATE submissions SET decided_at='2000-01-01' WHERE id=?").run(sid);await cleanupPartnerData(f.env);
    assert.deepEqual(storedWriting(f.sql.prepare('SELECT writing FROM partner_works WHERE id=?').get(w.id).writing),writing.normalize());
    assert.deepEqual((await detail(f,poem.id)).poem.writing,metadata);
  }finally{f.close();}
});

test('revision publication, privacy reversal, conflict and retry after an uncertain successful write',async()=>{
  const f=fixture();try{
    await owner(f);await edit(f,metadata);let v=await view(f);
    await ok(await f.call('/api/partners/poems/p1/revision','PUT',{...props,writing:{...metadata,public:true},version:0,baseHash:v.baseHash,submit:true}));
    assert.equal(f.files['data/poems.json'][0].writing,undefined);v=await view(f);
    const reviewed=await ok(await f.call('/api/revisions/'+v.revision.id,'GET',undefined,admin));assert.deepEqual(reviewed.revision.base_data.writing,metadata);
    // Simulate a D1 completion failure after GitHub has already committed.
    const prepare=f.DB.prepare.bind(f.DB);let failOnce=true;
    f.DB.prepare=query=>{if(failOnce&&query.startsWith("UPDATE partner_revisions SET status='published'")){failOnce=false;throw new Error('isolated completion failure');}return prepare(query);};
    assert.equal((await f.call('/api/revisions/'+v.revision.id+'/approve','POST',{version:v.revision.version},admin)).status,502);
    const writes=f.writes;await ok(await f.call('/api/revisions/'+v.revision.id+'/approve','POST',{version:v.revision.version},admin));assert.equal(f.writes,writes);
    assert.equal(f.files['data/poems.json'][0].writing.place,metadata.place);
    v=await view(f);await ok(await f.call('/api/partners/poems/p1/revision','PUT',{...props,version:0,baseHash:v.baseHash,submit:true}));
    assert.ok(f.files['data/poems.json'][0].writing);v=await view(f);
    await edit(f,{...metadata,public:true,place:'另一个隔离测试地点'});
    assert.equal((await f.call('/api/revisions/'+v.revision.id+'/approve','POST',{version:v.revision.version},admin)).status,409);
    await ok(await f.call('/api/partners/poems/p1/rebase','POST',{version:v.revision.version}));v=await view(f);
    await ok(await f.call('/api/partners/poems/p1/revision','PUT',{...props,version:v.revision.version,baseHash:v.baseHash,submit:true}));v=await view(f);
    await ok(await f.call('/api/revisions/'+v.revision.id+'/approve','POST',{version:v.revision.version},admin));
    assert.equal(f.files['data/poems.json'][0].writing,undefined);assert.deepEqual((await view(f)).poem.writing,metadata);
  }finally{f.close();}
});

test('failed GitHub CAS cannot activate staged private metadata and orphan cleanup preserves active pointers',async()=>{
  const f=fixture();try{
    await edit(f,metadata);const d=await detail(f);f.conflict();
    assert.equal((await f.call('/api/published-poems/p1','PUT',{...d.poem,sha:d.sha,writing:{place:'未生效的私有信息'}},admin)).status,409);
    assert.deepEqual((await detail(f)).poem.writing,metadata);
    f.sql.prepare("UPDATE poem_writing SET created_at='2000-01-01'").run();await cleanupWriting(f.env,f.files['data/poems.json']);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM poem_writing').get().n,1);
    const all=await ok(await f.call('/api/admin/files/poems','GET',undefined,admin));all.data=all.data.filter(p=>p.id!=='p1');await ok(await f.call('/api/admin/files/poems','PUT',all,admin));
    await cleanupWriting(f.env,f.files['data/poems.json']);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM poem_writing').get().n,0);
  }finally{f.close();}
});

test('withdrawal deletes private draft fields/history and missing D1 snapshots fail closed',async()=>{
  const f=fixture();try{
    await f.person();const c=await ok(await f.call('/api/partners/works','POST',props),201),path='/api/partners/works/'+c.id;let w=(await ok(await f.call(path))).work;
    await ok(await f.call(path+'/submit','POST',{version:w.version,consent:true}));w=(await ok(await f.call(path))).work;
    await ok(await f.call(path+'/withdraw','POST',{version:w.version,submissionUpdatedAt:w.submissionUpdatedAt}));
    assert.deepEqual(storedWriting(f.sql.prepare('SELECT writing FROM submissions').get().writing),writing.normalize());
    assert.deepEqual(storedWriting(f.sql.prepare('SELECT writing FROM partner_works').get().writing),writing.normalize());
    await edit(f,metadata);f.sql.prepare('DELETE FROM poem_writing').run();assert.equal((await f.call('/api/published-poems/p1','GET',undefined,admin)).status,502);
  }finally{f.close();}
});

test('deleting a poem cleans its aged open revision and history while live poem revisions remain',async()=>{
  const f=fixture();try{
    await owner(f);const v=await view(f);
    await ok(await f.call('/api/partners/poems/p1/revision','PUT',{...props,version:0,baseHash:v.baseHash,submit:true}));
    const current=await view(f),id=current.revision.id;
    await ok(await f.call('/api/partners/poems/p1/revision','PUT',{...props,version:current.revision.version,baseHash:v.baseHash,submit:true}));
    f.sql.prepare("UPDATE partner_revisions SET updated_at='2000-01-01'").run();await cleanupWriting(f.env,f.files['data/poems.json']);
    assert.ok(f.sql.prepare('SELECT data FROM partner_revisions WHERE id=?').get(id).data.includes(metadata.place));
    f.files['data/poems.json']=f.files['data/poems.json'].filter(p=>p.id!=='p1');await cleanupWriting(f.env,f.files['data/poems.json']);
    const row=f.sql.prepare('SELECT * FROM partner_revisions WHERE id=?').get(id);assert.equal(row.status,'withdrawn');assert.equal(row.data,'');assert.equal(row.base_data,'');assert.equal(f.sql.prepare('SELECT count(*) AS n FROM partner_revision_history').get().n,0);
  }finally{f.close();}
});
