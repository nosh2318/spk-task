// 画面（.html）の中の JavaScript に文法エラーがないかを確かめる（2026-10-27 hq.html のカンマ抜けで本部ダッシュボードが真っ白になった再発防止）
// 使い方: node .github/scripts/check-html-js.mjs a.html b.html ...
import fs from 'node:fs';
import vm from 'node:vm';
let bad = 0;
for (const f of process.argv.slice(2)) {
  if (!f.endsWith('.html') || !fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, 'utf8');
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '', code = m[2];
    i++;
    if (/\bsrc\s*=/.test(attrs) || !code.trim()) continue;
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (type && !/^(text|application)\/(javascript|ecmascript)$|^module$/i.test(type)) continue; // JSON・babel などは対象外
    const line = html.slice(0, m.index).split('\n').length;
    try {
      // module は import/export を含むと Script では読めないので、含まない時だけ async 関数として確かめる
      if (type.toLowerCase() === 'module') { if (/^\s*(import|export)\b/m.test(code)) continue; new vm.Script(`(async () => {\n${code}\n})`, { filename: `${f}:script${i}` }); }
      else new vm.Script(code, { filename: `${f}:script${i}` });
    } catch (e) {
      bad++;
      console.log(`::error file=${f},line=${line}::${f} の ${i} 番目の <script>（${line}行目〜）に文法エラー: ${e.message}`);
    }
  }
}
if (bad) { console.log(`文法エラー ${bad} 件。このままマージすると画面が真っ白になります。`); process.exit(1); }
console.log('OK: 文法エラーなし');
