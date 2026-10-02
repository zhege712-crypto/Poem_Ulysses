export const PUBLISHED_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>已发表诗歌 · 诗歌漂流</title>
<style>
:root{--paper:#f7f5f0;--paper-dark:#ede9e2;--ink:#2c2a28;--ink-light:#5a554e;--gold:#d4b896;--gold-light:#ded5c7;--clay:#9c4d32;--serif:Georgia,"Noto Serif SC",serif;--sans:"Noto Sans SC",system-ui,sans-serif}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 var(--sans)}button,input,textarea{font:inherit}button{cursor:pointer}a{color:inherit}header{border-bottom:1px solid var(--gold-light);padding:20px max(24px,calc((100vw - 1160px)/2));display:flex;justify-content:space-between;align-items:center;gap:16px}header a{text-decoration:none}header strong{font:normal 27px var(--serif)}header strong span{color:var(--clay)}header nav{display:flex;align-items:center;gap:16px;font-size:13px;color:var(--ink-light)}header nav button{border:1px solid var(--gold-light);border-radius:999px;padding:5px 12px;background:transparent;color:var(--ink-light);font-size:12px}main{max-width:1160px;margin:auto;padding:44px 24px 80px}.intro{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:30px}.intro h1{font:normal clamp(34px,5vw,52px)/1.2 var(--serif);margin:0}.intro p{margin:9px 0 0;color:var(--ink-light)}.intro button,.action{border:1px solid var(--gold-light);border-radius:999px;padding:9px 17px;background:transparent;color:var(--ink)}.action.primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}.action:disabled{opacity:.55;cursor:wait}.layout{display:grid;grid-template-columns:minmax(250px,330px) minmax(0,1fr);gap:24px;align-items:start}.library{border:1px solid var(--gold-light);border-radius:12px;overflow:hidden}.search-wrap{padding:13px;border-bottom:1px solid var(--gold-light)}.search-wrap input{width:100%;border:1px solid var(--gold-light);border-radius:8px;background:var(--paper);color:var(--ink);padding:10px 12px}.poem-list{max-height:68vh;overflow:auto}.poem-list button{display:block;width:100%;padding:14px 17px;border:0;border-bottom:1px solid var(--gold-light);background:transparent;color:var(--ink);text-align:left}.poem-list button:last-child{border-bottom:0}.poem-list button:hover,.poem-list button.active{background:var(--paper-dark)}.poem-list .title{display:block;font:normal 20px var(--serif)}.poem-list .meta{display:block;margin-top:3px;font-size:12px;color:var(--ink-light)}.empty{padding:28px;color:var(--ink-light)}.editor{border:1px solid var(--gold-light);border-radius:12px;padding:28px}.editor h2{font:normal 29px var(--serif);margin:0}.editor .sub{margin:2px 0 22px;font-size:12px;color:var(--ink-light)}.editor h3{font:normal 23px var(--serif);margin:34px 0 12px;padding-top:25px;border-top:1px solid var(--gold-light)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:flex;flex-direction:column;gap:6px;margin:0 0 15px}.field label{font-size:13px;color:var(--ink-light)}.field input,.field textarea{width:100%;border:1px solid var(--gold-light);border-radius:8px;background:var(--paper);color:var(--ink);padding:11px 12px;outline:none}.field textarea{min-height:220px;resize:vertical;line-height:1.85}.field textarea.short{min-height:90px}.field input:focus,.field textarea:focus{border-color:var(--clay)}.hint{margin:5px 0 16px;font-size:12px;color:var(--ink-light)}.images{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px;margin:12px 0}.image-item{border:1px solid var(--gold-light);border-radius:10px;padding:8px;min-width:0}.image-item img{width:100%;height:115px;object-fit:cover;background:var(--paper-dark);border-radius:6px}.image-item .filename{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--ink-light)}.image-item .image-actions{display:flex;justify-content:space-between;gap:3px;margin-top:6px}.image-item button{border:1px solid var(--gold-light);border-radius:6px;background:transparent;color:var(--ink);font-size:12px;padding:3px 7px}.image-item button:disabled{opacity:.4}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:19px}.feedback{min-height:24px;color:var(--ink-light);font-size:13px;margin-top:12px}.feedback.error{color:var(--clay)}.published{font-size:13px;color:var(--clay)}:focus-visible{outline:3px solid var(--gold);outline-offset:2px}@media(max-width:760px){main{padding:32px 16px 64px}.layout{grid-template-columns:1fr}.poem-list{max-height:280px}.editor{padding:20px}.grid{grid-template-columns:1fr}.intro{align-items:start;flex-direction:column}header{padding:16px}header nav{gap:8px}}
</style>
</head>
<body>
<header><a href="/" aria-label="投稿审核首页"><strong>诗歌<span>漂流</span></strong></a><nav><a href="/">返回审核</a><a href="/admin">管理后台</a><a href="/security">账号安全</a> <a href="/auth/login?return=/security" target="_blank" rel="noopener">重新确认登录</a> <button id="logout" type="button" hidden>退出登录</button></nav></header>
<main>
  <div class="intro"><div><h1>已发表诗歌</h1><p>在受保护的页面修改作品；保存后写入 GitHub，网站可能稍后更新。</p></div><button id="refresh" type="button">刷新作品</button></div>
  <div class="layout">
    <aside class="library" aria-label="已发表诗歌列表"><div class="search-wrap"><input id="search" type="search" placeholder="搜索标题、笔名或系列" aria-label="搜索已发表诗歌"></div><div id="poem-list" class="poem-list"><div class="empty">正在载入…</div></div></aside>
    <section class="editor" id="editor" hidden>
      <h2 id="editor-heading">作品</h2><p class="sub" id="poem-id"></p>
      <div class="grid"><div class="field"><label for="title">标题</label><input id="title" maxlength="80"></div><div class="field"><label for="author">发表笔名</label><input id="author" maxlength="40"></div></div>
      <div class="grid"><div class="field"><label for="date">发表日期</label><input id="date" maxlength="40" placeholder="例如 2026-09-30"></div><div class="field"><label for="series">系列</label><input id="series" maxlength="60"></div></div>
      <div class="field"><label for="subseries">子系列（选填）</label><input id="subseries" maxlength="60"></div>
      <div class="field"><label for="content">正文</label><textarea id="content" maxlength="12000"></textarea></div>
      <h3>配图</h3><div id="images" class="images"></div>
      <div class="field"><label for="image-files">添加配图（JPEG、PNG、WebP、GIF；每张不超过 3 MB）</label><input id="image-files" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple></div>
      <p class="hint">上传图片会立即写入公开仓库。移除配图只取消作品中的引用，不会删除仓库原文件。</p>
      <button id="upload-images" type="button" class="action">上传所选图片</button>
      <div class="actions"><button id="save-poem" type="button" class="action primary">保存诗歌</button><a id="published-link" class="published" target="_blank" rel="noopener noreferrer">查看已发表页面 ↗</a></div>
      <div id="poem-feedback" class="feedback" role="status" aria-live="polite"></div>
      <h3>作者资料</h3>
      <p class="hint" id="profile-hint">作者资料单独保存。更改发表笔名时，请核对这里的姓名与别名。</p>
      <div class="field"><label for="profile-name">显示姓名</label><input id="profile-name" maxlength="40"></div>
      <div class="field"><label for="profile-aliases">别名（每行一个）</label><textarea id="profile-aliases" class="short"></textarea></div>
      <div class="field"><label for="profile-bio">简介</label><textarea id="profile-bio" class="short" maxlength="2000"></textarea></div>
      <div class="field"><label for="profile-tags">标签（每行一个）</label><textarea id="profile-tags" class="short"></textarea></div>
      <div class="field"><label for="profile-link">作者链接（HTTPS，可留空）</label><input id="profile-link" maxlength="300"></div>
      <button id="save-profile" type="button" class="action">保存作者资料</button>
      <div id="profile-feedback" class="feedback" role="status" aria-live="polite"></div>
    </section>
  </div>
</main>
<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var rows=[],current=null,images=[];
  async function api(path,method,body){
    var init={method:method||'GET',credentials:'same-origin',headers:{}};
    if(body!==undefined){init.headers['Content-Type']='application/json';init.headers['X-Requested-With']='poem-review';init.body=JSON.stringify(body)}
    var response=await fetch(path,init),result=await response.json();
    if(!response.ok)throw new Error(result.error||'操作失败（HTTP '+response.status+'）');
    return result;
  }
  function feedback(id,message,error){$(id).textContent=message;$(id).classList.toggle('error',!!error)}
  function renderList(){
    var term=$('search').value.trim().toLocaleLowerCase();
    var matches=rows.filter(function(row){return [row.title,row.author,row.series].join(' ').toLocaleLowerCase().includes(term)});
    $('poem-list').replaceChildren();
    if(!matches.length){var empty=document.createElement('div');empty.className='empty';empty.textContent=rows.length?'没有匹配的诗歌':'还没有已发表诗歌';$('poem-list').appendChild(empty);return}
    matches.forEach(function(row){
      var button=document.createElement('button');button.type='button';button.className=row.id===current?.poem.id?'active':'';
      var title=document.createElement('span');title.className='title';title.textContent=row.title||'未题';
      var meta=document.createElement('span');meta.className='meta';meta.textContent=(row.author||'匿名')+' · '+(row.series||'未分类');
      button.append(title,meta);button.addEventListener('click',function(){open(row.id)});$('poem-list').appendChild(button);
    });
  }
  async function loadList(){var result=await api('/api/published-poems');rows=result.poems;renderList()}
  function renderImages(){
    $('images').replaceChildren();
    if(!images.length){var empty=document.createElement('p');empty.className='hint';empty.textContent='这首诗还没有配图。';$('images').appendChild(empty);return}
    images.forEach(function(path,index){
      var item=document.createElement('div');item.className='image-item';
      var img=document.createElement('img');img.loading='lazy';img.alt='第 '+(index+1)+' 张配图';img.src=new URL(path,current.publicSiteUrl).href;
      var name=document.createElement('span');name.className='filename';name.textContent=path.split('/').pop();
      var actions=document.createElement('div');actions.className='image-actions';
      [{label:'上移',to:index-1},{label:'下移',to:index+1},{label:'移除',remove:true}].forEach(function(action){
        var button=document.createElement('button');button.type='button';button.textContent=action.label;
        button.disabled=!action.remove&&(action.to<0||action.to>=images.length);
        button.addEventListener('click',function(){if(action.remove)images.splice(index,1);else{var moved=images.splice(index,1)[0];images.splice(action.to,0,moved)}renderImages()});actions.appendChild(button);
      });
      item.append(img,name,actions);$('images').appendChild(item);
    });
  }
  async function open(id){
    try{
      current=await api('/api/published-poems/'+encodeURIComponent(id));images=(current.poem.images||[]).slice();
      var poem=current.poem;$('editor').hidden=false;$('editor-heading').textContent=poem.title||'未题';$('poem-id').textContent='作品编号 '+poem.id;
      ['title','author','date','series','subseries','content'].forEach(function(key){$(key).value=poem[key]||''});
      $('published-link').href=new URL('read.html?id='+encodeURIComponent(poem.id),current.publicSiteUrl).href;
      var profile=current.profile;$('profile-name').value=profile?.name||poem.author||'';
      $('profile-aliases').value=(profile?.aliases||[]).join('\n');$('profile-bio').value=profile?.bio||'';
      $('profile-tags').value=(profile?.tags||[]).join('\n');$('profile-link').value=profile?.link||'';
      $('profile-hint').textContent=profile?'编辑现有作者资料。更改发表笔名时，请核对姓名与别名。':'这位作者暂无资料；保存时会建立一份作者资料。';
      $('image-files').value='';renderImages();renderList();feedback('poem-feedback','');feedback('profile-feedback','');
    }catch(error){feedback('poem-feedback',error.message,true)}
  }
  function poemValues(){return {sha:current.sha,title:$('title').value,author:$('author').value,date:$('date').value,series:$('series').value,subseries:$('subseries').value,content:$('content').value,images:images.slice()}}
  function profileValues(){return {sha:current.authorsSha,name:$('profile-name').value,aliases:$('profile-aliases').value.split(/\r?\n|、|,/).map(function(x){return x.trim()}).filter(Boolean),bio:$('profile-bio').value,tags:$('profile-tags').value.split(/\r?\n|、|,/).map(function(x){return x.trim()}).filter(Boolean),link:$('profile-link').value}}
  $('search').addEventListener('input',renderList);
  $('refresh').addEventListener('click',function(){loadList().catch(function(e){$('poem-list').textContent=e.message})});
  $('save-poem').addEventListener('click',async function(){
    if(!current)return;this.disabled=true;feedback('poem-feedback','正在保存…');
    try{var saved=await api('/api/published-poems/'+encodeURIComponent(current.poem.id),'PUT',poemValues());
      try{var latest=await api('/api/published-poems/'+encodeURIComponent(current.poem.id));current.sha=latest.sha;current.poem=latest.poem;
        await loadList();$('editor-heading').textContent=current.poem.title;feedback('poem-feedback',saved.warning||'诗歌已保存。网站更新可能需要一点时间。',!!saved.warning)}
      catch(refreshError){feedback('poem-feedback','诗歌已保存，但未能刷新最新版本。请刷新页面后再编辑。'+(saved.warning||''),true)}
    }catch(e){feedback('poem-feedback',e.message,true)}finally{this.disabled=false}
  });
  $('save-profile').addEventListener('click',async function(){
    if(!current)return;this.disabled=true;feedback('profile-feedback','正在保存…');
    try{var path=current.profile?'/api/author-profiles/'+encodeURIComponent(current.profile.id):'/api/author-profiles';
      var saved=await api(path,current.profile?'PUT':'POST',profileValues());
      try{var latest=await api('/api/published-poems/'+encodeURIComponent(current.poem.id));current.authorsSha=latest.authorsSha;current.profile=latest.profile;
        if(!current.profile&&saved.id)current.profile={id:saved.id};feedback('profile-feedback','作者资料已保存。')}
      catch(refreshError){feedback('profile-feedback','作者资料已保存，但未能刷新最新版本。请刷新页面后再编辑。',true)}
    }catch(e){feedback('profile-feedback',e.message,true)}finally{this.disabled=false}
  });
  $('upload-images').addEventListener('click',async function(){
    if(!current)return;var files=Array.from($('image-files').files||[]);if(!files.length){feedback('poem-feedback','请先选择图片',true);return}
    if(images.length+files.length>20){feedback('poem-feedback','一首诗最多保留 20 张配图',true);return}
    this.disabled=true;
    try{for(var i=0;i<files.length;i++){
      var file=files[i];if(file.size>3*1024*1024)throw new Error('“'+file.name+'”超过 3 MB');
      feedback('poem-feedback','正在上传第 '+(i+1)+' / '+files.length+' 张图片…');
      var response=await fetch('/api/images',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-Requested-With':'poem-review'},body:file});
      var result=await response.json();if(!response.ok)throw new Error(result.error||'图片上传失败');images.push(result.path);renderImages();
    }$('image-files').value='';feedback('poem-feedback','图片已上传；请点击“保存诗歌”使配图显示在作品中。')}
    catch(e){feedback('poem-feedback',e.message,true)}finally{this.disabled=false}
  });
  $('logout').addEventListener('click',async function(){try{var response=await fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'poem-review'}});if(!response.ok)throw new Error('退出失败');location.href='/'}catch(e){feedback('poem-feedback',e.message,true)}});
  loadList().catch(function(e){$('poem-list').textContent=e.message});
})();
</script>
</body>
</html>`;
