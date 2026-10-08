// Shared DOM-only editor. Never uses innerHTML or transmits preview content.
globalThis.PoemWritingForm = function (host, initial, changed) {
  const rules = globalThis.PoemWriting;
  function node(tag, text, cls) { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; }
  if (!document.getElementById('writing-style')) {
    const style = node('style'); style.id = 'writing-style';
    const script = document.querySelector('script[nonce]'); if (script) style.nonce = script.nonce;
    style.textContent = '.writing-fields{margin:22px 0;border-block:1px solid var(--gold-light,var(--line));padding:8px 0}.writing-fields summary{cursor:pointer;min-height:44px;padding:9px 0;color:var(--ink);font-size:15px}.writing-fields p,.writing-preview{font-size:13px;line-height:1.75;color:var(--ink-light,var(--muted));overflow-wrap:anywhere}.writing-fields .writing-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.writing-fields .writing-field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;color:var(--ink-light,var(--muted));font-size:14px}.writing-fields input[type=text]{width:100%;min-width:0;padding:11px 12px;border:1px solid var(--gold-light,var(--line));border-radius:12px;background:var(--paper);color:var(--ink);font:inherit}.writing-fields .writing-check{display:flex;align-items:flex-start;gap:10px;font-size:14px;margin:16px 0}.writing-fields input[type=checkbox]{width:auto;flex-shrink:0;margin-top:5px;accent-color:var(--clay)}.writing-fields small{color:var(--clay);line-height:1.6}.writing-fields :focus-visible{outline:3px solid var(--gold);outline-offset:3px}.writing-preview{margin:18px 0 0;white-space:pre-wrap}.writing-fields [hidden],.writing-preview[hidden]{display:none!important}@media(max-width:640px){.writing-fields .writing-grid{grid-template-columns:1fr;gap:0}}';
    document.head.append(style);
  }
  const details = node('details', '', 'writing-fields');
  details.append(node('summary', '写作信息（选填）'));
  const hint = node('p', '三项独立选填。日期可只写年份或年月，不会用投稿或发表时间补齐。地点可写城市、校园或旅途中；多个地点用顿号分隔，不使用定位。');
  hint.id = 'writing-help'; details.append(hint);
  const grid = node('div', '', 'writing-grid'); details.append(grid);
  const inputs = {}, errors = {};
  for (const [key, label, placeholder] of [['start','起稿日期','YYYY / YYYY-MM / YYYY-MM-DD'],['end','完稿日期','YYYY / YYYY-MM / YYYY-MM-DD'],['place','写作地点','可填写多个地点']]) {
    const wrap = node('label', '', 'writing-field'), input = node('input'), error = node('small');
    input.type = 'text'; input.id = 'writing-' + key; input.maxLength = key === 'place' ? 200 : 10; input.autocomplete = 'off'; input.placeholder = placeholder;
    error.id = input.id + '-error'; error.hidden = true; error.setAttribute('aria-live','polite');
    input.setAttribute('aria-describedby', 'writing-help ' + error.id);
    wrap.append(node('span', label), input, error); (key === 'place' ? details : grid).append(wrap); inputs[key] = input; errors[key] = error;
  }
  const label = node('label', '', 'writing-check'), check = node('input'); check.type = 'checkbox'; check.id = 'writing-public'; inputs.public = check;
  label.append(check, node('span','在作品页公开这些写作信息')); details.append(label);
  details.append(node('p','不勾选时，仅供本人及有权限的审核／管理者查看。勾选并通过审核后才随作品公开。以后取消公开会移除当前展示；已公开内容可能仍留在 Git 历史、缓存或他人副本中。'));
  const privatePreview = node('p'), preview = node('p', '', 'writing-preview'); preview.setAttribute('aria-live','polite'); details.append(privatePreview); host.append(details);
  function raw() { return {start:inputs.start.value,end:inputs.end.value,place:inputs.place.value,public:check.checked}; }
  function update() {
    try {
      const value = rules.normalize(raw()), text = rules.text(value);
      for (const key of ['start','end','place']) { errors[key].hidden = true; inputs[key].removeAttribute('aria-invalid'); }
      privatePreview.textContent = text ? '完整信息（仅编辑时可见）：' + text : '未填写写作信息，作品页不会预留位置。';
      preview.textContent = text ? (value.public ? '作品页公开预览：' + text : '作品页公开预览：写作信息未选公开，作品页不显示。') : '';
      preview.hidden = !text;
    } catch (_) { privatePreview.textContent = '日期或地点尚未填写完整，请核对后保存。'; preview.textContent = '写作信息待核对，暂不预览。'; preview.hidden = false; }
  }
  function set(value) {
    if (typeof value === 'string') value = JSON.parse(value || '{}'); value = value || {};
    ['start','end','place'].forEach(k => {inputs[k].value = value[k] || ''; errors[k].hidden = true; inputs[k].removeAttribute('aria-invalid');}); check.checked = value.public === true; details.open = false; update();
  }
  function read() {
    for (const key of ['start','end','place']) { errors[key].hidden = true; inputs[key].removeAttribute('aria-invalid'); }
    try { return rules.normalize(raw()); } catch (e) {
      details.open = true; const key = errors[e.field] ? e.field : 'start'; errors[key].textContent = e.message; errors[key].hidden = false; inputs[key].setAttribute('aria-invalid','true'); inputs[key].focus(); throw e;
    }
  }
  details.addEventListener('input', () => { update(); if (changed) changed(raw()); });
  set(initial);
  return {read, raw, set, preview, details, disable(value){Object.values(inputs).forEach(input => {input.disabled = value;});}};
};
