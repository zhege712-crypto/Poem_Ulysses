import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {SECURITY_HTML} from './security-ui.mjs';

// Exercise the actual client script through user handlers with failed fetches.
// These tests prevent a completed security action being misreported after a read failure.
function client({failSessions=false,failSettings=false,failAfterWrite=false,failAfterRevoke=false}={}) {
  const all=[],elements=new Map();
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.disabled=false;this.hidden=false;this.textContent='';this.attributes={};all.push(this)}
    append(...nodes){this.children.push(...nodes)}
    replaceChildren(...nodes){this.children=nodes}
    setAttribute(key,value){this.attributes[key]=value}
  }
  for(const [,id] of SECURITY_HTML.matchAll(/id="([a-z-]+)"/g))elements.set(id,new Element(['theme','refresh','others','all','pause','more','session-retry','settings-retry','audit-retry'].includes(id)?'button':'div'));
  let writes=0,revokes=0,settingsFailures=failSettings?1:0,sessionFailures=failSessions?1:0;
  const context={document:{getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),documentElement:{dataset:{}},querySelectorAll:selector=>all.filter(el=>selector==='button'?el.tag==='button':el.dataset.revoke)},location:{href:''},localStorage:{getItem(){return'light'},setItem(){}},confirm:()=>true,fetch:async(path,opt)=>{
    if(opt.method==='POST'){revokes++;if(failAfterRevoke)sessionFailures++;return Response.json({ok:true,signedOut:false})}
    if(opt.method==='PUT'){writes++;if(failAfterWrite)settingsFailures++;return Response.json({ok:true})}
    if(path.endsWith('/sessions')){if(sessionFailures>0){sessionFailures--;return Response.json({error:'登录记录读取失败，请重试'}, {status:503})}return Response.json({sessions:[{id:'current',current:true,browser:'Chrome',createdAt:new Date().toISOString(),expiresAt:new Date().toISOString()},{id:'other',current:false,browser:'Safari',createdAt:new Date().toISOString(),expiresAt:new Date().toISOString()}],accountLabel:'preview@example.com',managed:true})}
    if(path.endsWith('/settings')){if(settingsFailures>0){settingsFailures--;return Response.json({error:'设置读取失败，请重试'},{status:503})}return Response.json({submissionsPaused:writes>0})}
    return Response.json({events:[],next:null})
  }};
  const script=SECURITY_HTML.match(/<script nonce="__NONCE__">([\s\S]*?)<\/script>/)[1].replace('__CONFIG__','{"partner":false}');
  runInNewContext(script,context);
  async function settle(){for(let i=0;i<250;i++){await new Promise(resolve=>setImmediate(resolve));if(!elements.get('refresh').disabled)return}throw new Error('Client did not settle')}
  return {get:id=>elements.get(id),settle,get writes(){return writes},get revokes(){return revokes}};
}

test('failed security reads settle separately, expose local retries and leave unrelated sections usable',async()=>{
  const c=client({failSessions:true,failSettings:true});await c.settle();
  assert.equal(c.get('sessions').attributes['aria-busy'],'false');assert.equal(c.get('settings').attributes['aria-busy'],'false');
  assert.equal(c.get('session-retry').hidden,false);assert.equal(c.get('settings-retry').hidden,false);assert.equal(c.get('pause').disabled,true);
  assert.equal(c.get('events').children[0].textContent,'还没有操作记录。');assert.equal(c.get('events').attributes['aria-busy'],'false');
  c.get('settings-retry').onclick();await c.settle();assert.equal(c.get('settings-retry').hidden,true);assert.equal(c.get('pause').disabled,false);
  c.get('session-retry').onclick();await c.settle();assert.equal(c.get('sessions').children.length,2);assert.equal(c.get('session-feedback').textContent,'');
});

test('successful pause or session revoke remains reported as success when the subsequent read fails',async()=>{
  const setting=client({failAfterWrite:true});await setting.settle();setting.get('pause').onclick();await setting.settle();
  assert.equal(setting.writes,1);assert.match(setting.get('notice').textContent,/投稿接收设置已更新.*最新记录暂未加载/);assert.equal(setting.get('settings-retry').hidden,false);
  const session=client({failAfterRevoke:true});await session.settle();session.get('others').onclick();await session.settle();
  assert.equal(session.revokes,1);assert.match(session.get('notice').textContent,/所选会话已退出.*最新记录暂未加载/);assert.equal(session.get('session-retry').hidden,false);
});
