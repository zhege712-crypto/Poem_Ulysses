// LOCAL ONLY: isolated in-memory D1/GitHub fixtures; never import from a Worker.
// node submissions/writing-preview.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture } from './partners-fixture.mjs';
const workerImpl=process.argv[3]?(await import(pathToFileURL(process.argv[3]).href)).default:undefined;
const f=fixture(workerImpl); await f.person();
f.sql.prepare('INSERT INTO partner_poems VALUES (?,?,?,?)').run('p1','u1','a',new Date().toISOString());
Object.assign(f.files['data/poems.json'][0],{title:'隔离测试作品（不发表）',content:'本地功能测试文本。\n不属于站点真实诗作。',images:[]});
const writing={start:'2025',end:'2026-03',place:'测试城市、测试校园、旅途中（均为本地合成数据）',public:true};
const d=await (await f.call('/api/published-poems/p1','GET',undefined,{admin:true})).json();
await f.call('/api/published-poems/p1','PUT',{...d.poem,sha:d.sha,writing},{admin:true});
const props={title:'隔离测试草稿（不发表）',content:'本地功能测试文本。\n不属于站点真实诗作。',date:'2026-10-07',series:'测试合集',writing:{...writing,public:false}};
const w=await (await f.call('/api/partners/works','POST',props)).json();
await f.call('/api/partners/works/'+w.id+'/submit','POST',{version:1,consent:true});
const p=await (await f.call('/api/partners/poems/p1')).json();
await f.call('/api/partners/poems/p1/revision','PUT',{...props,title:d.poem.title,version:0,baseHash:p.baseHash,submit:true});
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8'};
const staticNames=new Set(['submit.html','read.html','privacy.html','writing-info.js','writing-form.js']);
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1'),name=url.pathname.slice(1);let response;
    if(name==='submission-config.js')response=new Response('window.POEM_SUBMISSION_CONFIG={};',{headers:{'content-type':types.js}});
    else if(staticNames.has(name))response=new Response(await readFile(new URL('../'+name,import.meta.url)),{headers:{'content-type':types[name.split('.').at(-1)]}});
    else if(name==='data/poems.json'||name==='data/authors.json')response=Response.json(f.files[name]);
    else if(name.startsWith('api/')||['','partners','admin','poems','revisions'].includes(name)) {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();
      response=await f.call(req.url,req.method,raw?JSON.parse(raw):undefined,{admin:!name.startsWith('api/partners')&&name!=='partners'});
    } else response=new Response('Local preview only',{status:404});
    res.writeHead(response.status,{...Object.fromEntries(response.headers),'cache-control':'no-store'});res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end('Local fixture error: '+e.message);}
}).listen(Number(process.argv[2]||8776),'127.0.0.1',()=>console.log('Isolated local preview: http://127.0.0.1:'+(process.argv[2]||8776)+'/submit.html'));
