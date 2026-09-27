export const REVIEW_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>投稿审核 · 诗歌漂流</title>
<style>
:root{--paper:#f7f5f0;--paper-dark:#ede9e2;--ink:#2c2a28;--ink-light:#5a554e;--gold:#d4b896;--gold-light:#ded5c7;--clay:#9c4d32;--serif:Georgia,"Noto Serif SC",serif;--sans:"Noto Sans SC",system-ui,sans-serif}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 var(--sans)}button,input,textarea,select{font:inherit}button{cursor:pointer}a{color:inherit}header{border-bottom:1px solid var(--gold-light);padding:20px max(24px,calc((100vw - 1160px)/2));display:flex;justify-content:space-between;align-items:center;gap:16px}header a{text-decoration:none}header strong{font:normal 27px var(--serif)}header span{color:var(--clay)}header nav{font-size:13px;color:var(--ink-light)}main{max-width:1160px;margin:0 auto;padding:48px 24px 80px}.intro{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:28px}.intro h1{font:normal clamp(32px,5vw,52px)/1.2 var(--serif);margin:0}.intro p{color:var(--ink-light);margin:10px 0 0}.refresh{background:none;border:1px solid var(--gold-light);border-radius:999px;padding:8px 16px;color:var(--ink)}.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}.filters button{border:1px solid var(--gold-light);background:transparent;color:var(--ink-light);border-radius:999px;padding:8px 16px}.filters button.active{background:var(--ink);color:var(--paper);border-color:var(--ink)}.layout{display:grid;grid-template-columns:minmax(245px,340px) minmax(0,1fr);gap:24px;align-items:start}.queue{border:1px solid var(--gold-light);border-radius:12px;overflow:hidden;min-height:280px}.queue button{display:block;text-align:left;width:100%;border:0;border-bottom:1px solid var(--gold-light);background:transparent;color:var(--ink);padding:17px 19px}.queue button:last-child{border-bottom:0}.queue button:hover,.queue button.active{background:var(--paper-dark)}.queue .title{display:block;font:normal 20px var(--serif);margin-bottom:3px}.queue .meta{font-size:12px;color:var(--ink-light)}.queue .empty{padding:30px 20px;color:var(--ink-light)}.editor{border:1px solid var(--gold-light);border-radius:12px;padding:28px;min-height:280px}.editor[hidden]{display:none}.empty-detail{color:var(--ink-light);padding:24px 0}.editor h2{font:normal 28px var(--serif);margin:0 0 6px}.editor .sub{font-size:12px;color:var(--ink-light);margin-bottom:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}.field label{font-size:13px;color:var(--ink-light)}.field input,.field textarea,.field select{width:100%;border:1px solid var(--gold-light);border-radius:8px;background:var(--paper);color:var(--ink);padding:11px 12px;outline:none}.field textarea{min-height:230px;resize:vertical;line-height:1.8}.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--clay);box-shadow:0 0 0 3px rgba(156,77,50,.12)}.hint{font-size:12px;color:var(--ink-light);margin:-8px 0 16px}.contact{font-size:13px;color:var(--ink-light);margin-bottom:18px;overflow-wrap:anywhere}.preview{background:var(--paper-dark);border:1px solid var(--gold-light);border-radius:12px;padding:24px;margin:20px 0 24px}.preview h3{font:normal 28px var(--serif);margin:0}.preview .byline{font-size:13px;color:var(--ink-light);margin:3px 0 16px}.preview .poem{font:18px/2 "STKaiti","KaiTi",var(--serif);white-space:pre-wrap;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:10px}.actions button{border:1px solid var(--gold-light);border-radius:999px;padding:10px 18px;background:transparent;color:var(--ink)}.actions .primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}.actions .danger{color:var(--clay)}.actions button:disabled{opacity:.5;cursor:wait}.feedback{min-height:24px;margin-top:16px;color:var(--ink-light);font-size:13px}.feedback.error{color:var(--clay)}.published{display:inline-block;margin-top:8px;color:var(--clay)}:focus-visible{outline:3px solid var(--gold);outline-offset:2px}@media(max-width:760px){main{padding-top:32px}.layout{grid-template-columns:1fr}.queue{min-height:0;max-height:280px;overflow:auto}.editor{padding:20px}.grid{grid-template-columns:1fr}.intro{align-items:start;flex-direction:column}}
</style>
<style>header nav button{margin-left:12px;border:1px solid var(--gold-light);border-radius:999px;padding:4px 11px;background:transparent;color:var(--ink-light);font-size:12px}</style>
</head>
<body>
<header><a href="/" aria-label="投稿审核首页"><strong>诗歌<span>漂流</span></strong></a><nav>投稿审核 · 仅维护者 <button id="logout" type="button" hidden>退出登录</button></nav></header>
<main>
  <div class="intro"><div><h1>待审稿件</h1><p>从收到到发表，稿件都留在这里。</p></div><button class="refresh" id="refresh" type="button">刷新列表</button></div>
  <div class="filters" id="filters" aria-label="筛选投稿状态">
    <button type="button" data-status="submitted" class="active">已收到</button><button type="button" data-status="reviewing">审核中</button><button type="button" data-status="publishing">发布中</button><button type="button" data-status="published">已发表</button><button type="button" data-status="declined">未采用</button><button type="button" data-status="withdrawn">已撤回</button>
  </div>
  <div class="layout">
    <div class="queue" id="queue" aria-label="稿件列表"><div class="empty">正在载入…</div></div>
    <section class="editor" id="editor" hidden>
      <h2 id="detail-heading">稿件</h2><div class="sub" id="detail-meta"></div>
      <div class="grid"><div class="field"><label for="title">标题</label><input id="title" maxlength="80"></div><div class="field"><label for="author">发表笔名</label><input id="author" maxlength="40"></div></div>
      <div class="field"><label for="content">正文</label><textarea id="content" maxlength="12000"></textarea></div>
      <div class="grid"><div class="field"><label for="date">发表日期</label><input id="date" type="date" required></div><div class="field"><label for="series">系列</label><input id="series" list="series-options" maxlength="60"><datalist id="series-options"></datalist></div></div>
      <div class="field"><label for="subseries">子系列（选填）</label><input id="subseries" maxlength="60"></div>
      <div class="field"><label for="author-id">作者资料</label><select id="author-id"><option value="">按笔名自动匹配；若无匹配则新建作者</option></select></div>
      <p class="hint">选择已有作者会把当前笔名加入其别名；请确认投稿人确实使用该身份。</p>
      <div class="contact" id="contact"></div>
      <div class="field"><label for="private-note">内部备注（投稿人看不到）</label><textarea id="private-note" maxlength="500" style="min-height:72px"></textarea></div>
      <div class="preview" aria-label="发表预览"><h3 id="preview-title"></h3><div class="byline" id="preview-author"></div><div class="poem" id="preview-content"></div></div>
      <div class="field"><label for="public-note">未采用时给投稿人的说明（选填）</label><textarea id="public-note" maxlength="300" style="min-height:72px"></textarea></div>
      <div class="actions"><button id="save" type="button">保存修改</button><button id="publish" type="button" class="primary">发表这首诗</button><button id="decline" type="button" class="danger">标为未采用</button></div>
      <a id="published-link" class="published" target="_blank" rel="noopener noreferrer" hidden>查看已发表作品 →</a>
      <div class="feedback" id="feedback" role="status" aria-live="polite"></div>
    </section>
  </div>
</main>
<script>
(function(){
  var current=null, status='submitted', options={series:[],authors:[]};
  var $=function(id){return document.getElementById(id)};
  var fields=['title','author','content','date','series','subseries','author-id','private-note'];
  async function api(path,method,data){
    var init={method:method||'GET',credentials:'same-origin',headers:{}};
    if(data!==undefined){init.headers['Content-Type']='application/json';init.headers['X-Requested-With']='poem-review';init.body=JSON.stringify(data)}
    else if(method==='POST'){init.headers['X-Requested-With']='poem-review'}
    var response=await fetch(path,init), result=await response.json();
    if(!response.ok)throw new Error(result.error||'请求失败');
    return result;
  }
  function feedback(message,error){$('feedback').textContent=message;$('feedback').classList.toggle('error',!!error)}
  function busy(value){['save','publish','decline'].forEach(function(id){$(id).disabled=value})}
  function preview(){$('preview-title').textContent=$('title').value||'未题';$('preview-author').textContent=$('author').value;$('preview-content').textContent=$('content').value}
  fields.slice(0,3).forEach(function(id){$(id).addEventListener('input',preview)});
  function setOptions(){
    var selected=$('author-id').value||current?.author_id;
    $('series-options').replaceChildren();options.series.forEach(function(s){var item=document.createElement('option');item.value=s;$('series-options').appendChild(item)});
    $('author-id').replaceChildren();var empty=document.createElement('option');empty.value='';empty.textContent='按笔名自动匹配；若无匹配则新建作者';$('author-id').appendChild(empty);
    options.authors.forEach(function(a){var item=document.createElement('option');item.value=a.id;item.textContent=a.name;$('author-id').appendChild(item)});
    $('author-id').value=selected||'';
  }
  async function loadOptions(){try{options=await api('/api/options');setOptions()}catch(e){feedback('作者和分类选项未加载：'+e.message,true)}}
  async function loadList(){
    var result=await api('/api/submissions?status='+encodeURIComponent(status));
    var queue=$('queue');queue.replaceChildren();
    if(!result.submissions.length){var empty=document.createElement('div');empty.className='empty';empty.textContent='这里暂时没有稿件';queue.appendChild(empty);return}
    result.submissions.forEach(function(row){
      var button=document.createElement('button');button.type='button';button.className=row.id===current?.id?'active':'';
      var title=document.createElement('span');title.className='title';title.textContent=row.title;
      var meta=document.createElement('span');meta.className='meta';meta.textContent=row.author+' · '+new Date(row.created_at).toLocaleString('zh-CN');
      button.append(title,meta);button.addEventListener('click',function(){open(row.id)});queue.appendChild(button)
    });
  }
  async function open(id){
    try{
      var result=await api('/api/submissions/'+id);current=result.submission;
      $('editor').hidden=false;$('detail-heading').textContent=current.title;$('detail-meta').textContent='投稿于 '+new Date(current.created_at).toLocaleString('zh-CN')+' · '+current.status;
      ['title','author','content','series','subseries','private-note'].forEach(function(key){$(key).value=current[key]||''});$('date').value=current.date||new Date().toLocaleDateString('sv-SE');
      $('author-id').value=current.author_id||'';$('public-note').value=current.public_note||'';
      $('contact').textContent=current.contact?'投稿人联系方式：'+current.contact:'投稿人未留联系方式';
      var editable=['submitted','reviewing'].includes(current.status);
      fields.forEach(function(key){$(key).disabled=!editable});$('public-note').disabled=!editable;
      ['save','publish','decline'].forEach(function(key){$(key).hidden=!editable});
      $('published-link').hidden=!current.published_url;if(current.published_url)$('published-link').href=current.published_url;
      feedback('');preview();await loadList();
    }catch(e){feedback(e.message,true)}
  }
  function values(){return {title:$('title').value,author:$('author').value,content:$('content').value,date:$('date').value,series:$('series').value,subseries:$('subseries').value,authorId:$('author-id').value,privateNote:$('private-note').value}}
  async function save(){if(!current)throw new Error('请先选择稿件');await api('/api/submissions/'+current.id,'PUT',values());feedback('修改已保存');await open(current.id)}
  $('save').addEventListener('click',async function(){busy(true);try{await save()}catch(e){feedback(e.message,true)}finally{busy(false)}});
  $('publish').addEventListener('click',async function(){
    if(!current||!confirm('确认发表这首诗？发表后将对所有读者公开。'))return;
    busy(true);feedback('正在保存并发表，请勿重复操作…');
    try{await api('/api/submissions/'+current.id,'PUT',values());var result=await api('/api/submissions/'+current.id+'/publish','POST');await open(current.id);feedback('已发表。站点更新可能需要一点时间。');if(result.publishedUrl)$('published-link').href=result.publishedUrl}
    catch(e){feedback(e.message,true)}finally{busy(false)}
  });
  $('decline').addEventListener('click',async function(){
    if(!current||!confirm('确认将这篇稿件标为未采用？'))return;
    busy(true);try{await api('/api/submissions/'+current.id+'/decline','POST',{note:$('public-note').value});await open(current.id);feedback('已标为未采用')}catch(e){feedback(e.message,true)}finally{busy(false)}
  });
  $('filters').addEventListener('click',async function(e){var button=e.target.closest('button[data-status]');if(!button)return;status=button.dataset.status;document.querySelectorAll('#filters button').forEach(function(item){item.classList.toggle('active',item===button)});current=null;$('editor').hidden=true;try{await loadList()}catch(error){$('queue').textContent=error.message}});
  $('refresh').addEventListener('click',function(){loadList().catch(function(e){$('queue').textContent=e.message})});
  $('logout').addEventListener('click',async function(){try{var response=await fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'poem-review'}});if(!response.ok)throw new Error('退出失败');location.href='/'}catch(e){feedback(e.message,true)}});
  loadOptions();loadList().catch(function(e){$('queue').textContent=e.message});
})();
</script>
</body>
</html>`;
