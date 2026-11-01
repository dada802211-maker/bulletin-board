// 2投稿を交互に編集し、画面の本文と更新先IDが一致することを検証する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../front/package.json'));
const { JSDOM } = req('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent','FormData']) global[name] = dom.window[name];
global.IS_REACT_ACT_ENVIRONMENT = true;
const ts = req('typescript');
function compile(mod, filename) {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
}
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;
require.extensions['.css'] = () => {};
const React = req('react');
const { act } = React;
const { createRoot } = req('react-dom/client');
const App = req('./src/App.tsx').default;
const originals = [
  { id: 22, user_id: 1, name: 'Author', title: 'PHP投稿', body: '```php\n<?php\n  echo "PHP";\n```', category: '質問', created_at: '2026-11-01T00:00:00Z', comment_count: 0 },
  { id: 11, user_id: 1, name: 'Author', title: 'TypeScript投稿', body: '```typescript\nconst message: string = "TypeScript";\n```', category: '雑談', created_at: '2026-11-01T00:00:00Z', comment_count: 0 },
];
let posts = structuredClone(originals);
const updates = [];
global.fetch = async (url, options) => {
  const action = new URL(url, 'http://localhost/').searchParams.get('action');
  let result;
  if (action === 'session') result = { user: { id: 1, name: 'Author' }, csrf: 'test-token' };
  else if (action === 'posts') result = { posts: structuredClone(posts) };
  else if (action === 'update') {
    const data = JSON.parse(options.body);
    updates.push(data);
    posts = posts.map(post => post.id === data.id ? { ...post, ...data } : post);
    result = { ok: true };
  } else throw new Error(`Unexpected API action: ${action}`);
  return { ok: true, json: async () => result };
};
async function click(element) { assert.ok(element); await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))); }
async function open(id) {
  const post = posts.find(p => p.id === id);
  const article = [...document.querySelectorAll('article')].find(a => a.querySelector('h3').textContent === post.title);
  await click([...article.querySelectorAll('button')].find(b => b.textContent === '編集'));
  assert.equal(document.querySelector('input[name="title"]').value, post.title);
  assert.equal(document.querySelector('textarea[name="body"]').value, post.body);
  assert.equal(document.querySelector('select[name="category"]').value, post.category);
}
async function input(selector, value) {
  const element = document.querySelector(selector);
  const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
(async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(App)));
  // PHPを編集してキャンセルした後、TSには変更途中のPHPを表示しない。
  await open(22);
  await input('textarea[name="body"]', '未保存のPHP');
  await click(document.querySelector('[aria-label="閉じる"]'));
  await open(11);
  const tsBody = posts.find(p => p.id === 11).body + '\nTS追記';
  await input('textarea[name="body"]', tsBody);
  await act(async () => document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(updates[0].id, 11);
  assert.equal(updates[0].body, tsBody);
  assert.equal(posts.find(p => p.id === 22).body, originals[0].body);
  await open(22);
  const phpBody = posts.find(p => p.id === 22).body + '\nPHP追記';
  await input('textarea[name="body"]', phpBody);
  await act(async () => document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(updates[1].id, 22);
  assert.equal(updates[1].body, phpBody);
  assert.equal(posts.find(p => p.id === 11).body, tsBody);
  await open(11);
  await click(document.querySelector('[aria-label="閉じる"]'));
  await click([...document.querySelectorAll('button')].find(b => b.textContent === '＋ 投稿する'));
  assert.equal(document.querySelector('input[name="title"]').value, '');
  assert.equal(document.querySelector('textarea[name="body"]').value, '');
  // Tabでカーソル位置へ挿入し、選択範囲はタブ1文字に置き換える。
  const area = document.querySelector('textarea[name="body"]');
  async function tab(options = {}) {
    const event = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, ...options });
    await act(async () => area.dispatchEvent(event));
    return event;
  }
  await input('textarea[name="body"]', 'abcd');
  area.setSelectionRange(2, 2);
  assert.equal((await tab()).defaultPrevented, true);
  assert.equal(area.value, 'ab\tcd');
  assert.equal(area.selectionStart, 3);
  area.setSelectionRange(0, 2);
  await tab();
  assert.equal(area.value, '\t\tcd');
  assert.equal(area.selectionStart, 1);
  assert.equal((await tab({ shiftKey: true })).defaultPrevented, false);
  assert.equal(area.value, '\t\tcd');
  await input('textarea[name="body"]', 'x'.repeat(5000));
  area.setSelectionRange(5000, 5000);
  await tab();
  assert.equal(area.value.length, 5000);
  console.log('PASS: Tab insertion, selection replacement, cursor position, Shift+Tab navigation, max length');
  await act(async () => root.unmount());
  dom.window.close();
  console.log('PASS: PHP/TypeScript alternating edit, cancel, correct update IDs, unchanged other post, reopen, empty new post');
})().catch(e => { console.error(e); process.exitCode = 1; dom.window.close(); });
