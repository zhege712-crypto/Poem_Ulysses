// Local browser checks. Uses the existing Edge browser and bundled Playwright; installs nothing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('C:/Users/10141/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '../..');
const base = process.env.POEM_PICK_PREVIEW_URL || 'http://127.0.0.1:8162';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local preview only');
const poems = JSON.parse(fs.readFileSync(path.join(root, 'data/poems.json'), 'utf8'));
const longest = poems.reduce((a, b) => a.title.length > b.title.length ? a : b);
const evidence = path.join(root, '_preview_shots/poem-pick-2026-10-11');
fs.mkdirSync(evidence, { recursive: true });
const results = [];
let browser;

async function home(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, ...options });
  await page.addInitScript(() => { Math.random = () => 0; sessionStorage.setItem('intro_poem_shown', '1'); });
  page.on('pageerror', error => results.push({ pageError: error.message }));
  // External statistics and comments are outside this local interaction check.
  await page.route(/busuanzi|giscus/, route => route.abort());
  await page.goto(base + '/index.html');
  await page.locator('#stat-count').filter({ hasText: String(poems.length) }).waitFor();
  return page;
}
async function metrics(page) {
  return page.evaluate(() => {
    const slip = document.querySelector('#poem-pick-slip');
    const box = slip.getBoundingClientRect();
    const style = getComputedStyle(slip);
    const button = document.querySelector('#random-btn').getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > innerWidth,
      paper: style.backgroundColor, ink: style.color,
      slip: { x: box.x, right: box.right, top: box.top, bottom: box.bottom },
      button: { width: button.width, height: button.height } };
  });
}
async function routePick(page, handler) {
  await page.route('**/data/poems.json?*', route => {
    const referrer = route.request().headers().referer || '';
    return referrer.includes('/read.html') ? route.continue() : handler(route);
  });
}

(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const viewport of [{ width: 1536, height: 1024 }, { width: 390, height: 844 }]) {
    for (const theme of ['light', 'dark', 'eye-care']) {
      const page = await home({ viewport });
      await page.locator(`#theme-side button[data-theme="${theme}"]`).click();
      let fetches = 0, navigations = 0, selectedAt, navigatedAt, release;
      const gate = new Promise(resolve => release = resolve);
      await routePick(page, async route => {
        fetches++;
        selectedAt = Date.now();
        await route.fulfill({ json: [longest, ...poems.filter(p => p.id !== longest.id)] });
      });
      await page.route('**/read.html?*', async route => {
        navigations++;
        navigatedAt = Date.now();
        await gate;
        await route.continue();
      });
      await page.locator('#random-btn').focus();
      await page.keyboard.press('Enter');
      await page.locator('#poem-pick-slip').waitFor({ state: 'visible' });
      await page.evaluate(() => { for (let i = 0; i < 20; i++) document.querySelector('#random-btn').click(); });
      assert(await page.locator('#random-btn').isDisabled());
      assert.equal(await page.locator('#poem-pick-title').textContent(), longest.title);
      assert.equal(await page.locator('#poem-pick-author').textContent(), longest.author || '');
      assert.equal(await page.locator('#poem-pick-status').getAttribute('data-state'), 'selected');
      await page.waitForTimeout(340);
      const measure = await metrics(page);
      assert(!measure.overflow);
      assert(measure.slip.x >= 0 && measure.slip.right <= viewport.width);
      assert(measure.button.height >= 44);
      const device = viewport.width > 640 ? 'desktop' : 'mobile';
      await page.screenshot({ path: path.join(evidence, `${device}-${theme}.png`) });
      release();
      await page.waitForURL('**/read.html?*');
      assert.equal(new URL(page.url()).searchParams.get('id'), longest.id);
      await page.locator('.poem-title').waitFor();
      assert.equal(await page.locator('.poem-title').textContent(), longest.title);
      assert.equal(await page.locator('.p-author').textContent(), longest.author);
      assert.equal(fetches, 1);
      assert.equal(navigations, 1);
      assert(navigatedAt - selectedAt >= 450 && navigatedAt - selectedAt < 1000);
      results.push({ check: `${device}-${theme}`, fetches, navigations, revealMs: navigatedAt - selectedAt, ...measure });
      await page.goBack();
      await page.locator('#random-btn').waitFor();
      assert(await page.locator('#random-btn').isEnabled());
      assert(await page.locator('#poem-pick-slip').isHidden());
      await page.close();
    }
  }
  const reduced = await home({ reducedMotion: 'reduce' });
  let reducedAt, reducedNav;
  await routePick(reduced, async route => { reducedAt = Date.now(); await route.fulfill({ json: poems }); });
  reduced.on('request', request => { if (request.url().includes('/read.html?')) reducedNav = Date.now(); });
  await reduced.locator('#random-btn').focus();
  await reduced.keyboard.press('Space');
  await reduced.waitForURL('**/read.html?*');
  assert(reducedNav - reducedAt < 300);
  results.push({ check: 'reduced-motion-space-key', delayMs: reducedNav - reducedAt });
  await reduced.close();

  const errors = [
    ['network', route => route.abort()],
    ['http', route => route.fulfill({ status: 503, body: '' })],
    ['json', route => route.fulfill({ body: '{' })],
    ['empty', route => route.fulfill({ json: [] })],
    ['schema', route => route.fulfill({ json: [{ ...poems[0], id: 123 }] })],
    ['duplicate-id', route => route.fulfill({ json: [poems[0], poems[0]] })]
  ];
  for (const [name, fail] of errors) {
    const page = await home();
    let calls = 0;
    await routePick(page, route => ++calls === 1 ? fail(route) : route.fulfill({ json: poems }));
    await page.locator('#random-btn').click();
    await page.locator('#poem-pick-status[data-state="error"]').waitFor();
    assert(await page.locator('#random-btn').isEnabled());
    assert(await page.locator('#poem-pick-slip').isHidden());
    assert.equal(await page.locator('#poem-pick-label').textContent(), '重试拾诗');
    assert(await page.locator('#random-btn').evaluate(button => document.activeElement === button));
    const feedback = await page.locator('#poem-pick-status').textContent();
    await page.locator('#random-btn').click();
    await page.waitForURL('**/read.html?*');
    assert.equal(new URL(page.url()).searchParams.get('id'), poems[0].id);
    results.push({ check: `failure-retry-${name}`, calls, feedback });
    await page.close();
  }
  const slow = await home();
  let slowCalls = 0, finish;
  const pending = new Promise(resolve => finish = resolve);
  await routePick(slow, async route => {
    if (++slowCalls === 1) { await pending; try { await route.fulfill({ json: poems }); } catch {} }
    else await route.fulfill({ json: poems });
  });
  await slow.locator('#random-btn').click();
  await slow.locator('#poem-pick-status').filter({ hasText: '读取较慢' }).waitFor();
  assert(await slow.locator('#random-btn').isDisabled());
  await slow.screenshot({ path: path.join(evidence, 'slow-request.png') });
  await slow.locator('#poem-pick-status[data-state="error"]').waitFor({ timeout: 10000 });
  assert.equal(await slow.locator('#poem-pick-status').textContent(), '读取超时，请重试。');
  await slow.screenshot({ path: path.join(evidence, 'timeout-retry.png') });
  assert(await slow.locator('#random-btn').isEnabled());
  await slow.locator('#random-btn').click();
  await slow.waitForURL('**/read.html?*');
  finish();
  results.push({ check: 'slow-timeout-retry', calls: slowCalls });
  await slow.close();

  for (const viewport of [{ width: 820, height: 1000 }, { width: 320, height: 900 }]) {
    const page = await home({ viewport });
    await routePick(page, route => route.fulfill({ json: [longest] }));
    let release;
    const gate = new Promise(resolve => release = resolve);
    await page.route('**/read.html?*', async route => { await gate; await route.continue(); });
    await page.locator('#random-btn').click();
    await page.locator('#poem-pick-slip').waitFor({ state: 'visible' });
    await page.waitForTimeout(340);
    const measure = await metrics(page);
    assert(!measure.overflow);
    assert(measure.slip.x >= 0 && measure.slip.right <= viewport.width);
    await page.screenshot({ path: path.join(evidence, `confirmation-${viewport.width}.png`) });
    release();
    await page.waitForURL('**/read.html?*');
    results.push({ check: `confirmation-width-${viewport.width}`, ...measure });
    await page.close();
  }
  const changed = await home();
  await routePick(changed, route => route.fulfill({ json: poems }));
  await changed.locator('#random-btn').click();
  await changed.locator('#poem-pick-slip').waitFor({ state: 'visible' });
  const changeAt = Date.now();
  await changed.emulateMedia({ reducedMotion: 'reduce' });
  await changed.waitForURL('**/read.html?*');
  results.push({ check: 'reduce-motion-during-reveal', pageLoadedMs: Date.now() - changeAt });
  await changed.close();
  assert(!results.some(item => item.pageError), 'No page script errors');
  fs.writeFileSync(path.join(evidence, 'checks.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
