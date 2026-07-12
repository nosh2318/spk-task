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

// --- 4) app.js に書き出し（外部読込＝ローダー型・NHA同型） ---
//   ★ index.html にインライン挿入せず app.js を別ファイルにする。
//      これにより index.html は軽量ローダーになり(常にネット取得)、
//      app.js だけを Service Worker で cache-first キャッシュ → 起動高速化。
//   ★ 外部ファイルなので </script> 無害化は不要（インライン時のみ必要だった）。
fs.writeFileSync('app.js', compiled);
console.log(`[build] wrote app.js: ${(compiled.length/1024).toFixed(0)}KB`);

// --- 5) index.html 組み立て（ローダー化） ---
// SW登録の ./sw.js?v=NNN の版数字を app.js?v= のキャッシュキーに使う。
// → sw.js?v= と app.js?v= が同値 → SWキャッシュキー(SW_V)と一致し確実にヒット/更新される (NHA同型)。
const swvMatch = before.match(/sw\.js\?v=(\d+)/);
const APPV = swvMatch ? swvMatch[1] : '841';

// babel-standalone の CDN 読込行を削除（コンパイル済みなので不要）
let newBefore = before
  .replace(/\s*<link rel="preload" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+" as="script" crossorigin>\s*/g, '\n')
  .replace(/\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>\s*/g, '\n');

// after は '</script>' で始まる（元 text/babel ブロックの閉じタグ）。
// これを app.js 外部読込に差し替える。'</script>' を取り除いてから after 本体を残す。
let afterBody = after.replace(/^<\/script>/, '');

// app.js を外部読込するローダーを挿入（CVをキャッシュキーに固定 → SWキャッシュがヒット）
const loader = '<script>\n'
  + '// ★ アプリ本体を外部読込（NHA同型ローダー・2026-07-12）\n'
  + '//    ./app.js?v=<版> に固定 → SWキャッシュキーが安定しヒット(2回目以降 激速)。\n'
  + '//    sw.js?v= を上げれば新URL → SWが旧キャッシュを掃除して新app.jsを取得。\n'
  + '(function(){\n'
  + '  var s=document.createElement("script");\n'
  + '  s.src="./app.js?v=' + APPV + '";\n'
  + '  s.onerror=function(){try{splashMsg("読込エラー。再試行中...");}catch(e){}setTimeout(function(){location.reload();},2000);};\n'
  + '  document.body.appendChild(s);\n'
  + '})();\n'
  + '</script>';

const newHtml = newBefore + loader + afterBody;

fs.writeFileSync(DST, newHtml);
console.log(`[build] wrote ${DST}: ${(newHtml.length/1024).toFixed(0)}KB (loader) / app.js?v=${APPV}`);

fs.writeFileSync(DST2, newHtml);
console.log(`[build] wrote ${DST2}`);

console.log('✅ Build complete');
