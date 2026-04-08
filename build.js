// build.js — JSX事前コンパイル版
// index.html 内の <script type="text/babel"> ブロックを
// Babel で事前コンパイル → <script> に差し替え → babel-standalone CDN削除
// これにより初回ロード時の Babel 約3MB ダウンロード＆JSXコンパイルを不要にする

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const SRC = 'index.src.html';
const DST = 'index.html';
const DST2 = 'index2.html';

console.log('[build] reading', SRC);
const html = fs.readFileSync(SRC, 'utf8');

// --- 1) JSX ブロックを抽出 ---
const babelOpenRe = /<script type="text\/babel">/;
const m = html.match(babelOpenRe);
if (!m) {
  console.error('[build] ERROR: text/babel block not found in', SRC);
  process.exit(1);
}
const startIdx = m.index;
const openLen = m[0].length;
const afterOpen = html.slice(startIdx + openLen);
const endRel = afterOpen.indexOf('</script>');
if (endRel < 0) { console.error('[build] </script> not found after text/babel opener'); process.exit(1); }

const jsx = afterOpen.slice(0, endRel);
const before = html.slice(0, startIdx);
const after = afterOpen.slice(endRel); // starts with </script>

console.log(`[build] JSX source: ${(jsx.length/1024).toFixed(0)}KB`);

// --- 2) Babel compile (JSX → JS) ---
const result = babel.transformSync(jsx, {
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  compact: false,
  comments: false,
  sourceType: 'script',
});
let compiled = result.code;
console.log(`[build] compiled JS: ${(compiled.length/1024).toFixed(0)}KB`);

// --- 3) Terser minify ---
try {
  const tmp = '.build-tmp.js';
  fs.writeFileSync(tmp, compiled);
  const { execSync } = require('child_process');
  execSync(`./node_modules/.bin/terser ${tmp} --compress passes=2,pure_getters=true --mangle --output ${tmp}`, { stdio: 'inherit' });
  compiled = fs.readFileSync(tmp, 'utf8');
  fs.unlinkSync(tmp);
  console.log(`[build] minified: ${(compiled.length/1024).toFixed(0)}KB`);
} catch (e) {
  console.warn('[build] terser failed, using unminified:', e.message);
}

// `</script>` が出現すると inline script が途中で閉じてしまうので無害化
compiled = compiled.replace(/<\/script>/gi, '<\\/script>');

// --- 4) app.js にも書き出し（外部参照しないが念のため保存） ---
fs.writeFileSync('app.js', compiled);

// --- 5) index.html 組み立て ---
// babel-standalone の CDN 読込行を削除
let newBefore = before
  .replace(/\s*<link rel="preload" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+" as="script" crossorigin>\s*/g, '\n')
  .replace(/\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>\s*/g, '\n');

const newHtml = newBefore + '<script>\n' + compiled + '\n' + after;

fs.writeFileSync(DST, newHtml);
console.log(`[build] wrote ${DST}: ${(newHtml.length/1024).toFixed(0)}KB`);

fs.writeFileSync(DST2, newHtml);
console.log(`[build] wrote ${DST2}`);

console.log('✅ Build complete');
