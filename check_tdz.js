#!/usr/bin/env node
/*
 * TDZ(宣言前参照)静的検査 — 白画面(ReferenceError: Cannot access X before initialization)を事前に潰す。
 * 実例 2026-08-17: const invTodoTotal=React.useMemo(()=>..invTodoCount.., [invTodoCount,...]) が
 *   invTodoCount(=後の行で const 宣言) を宣言前に参照 → App描画時にTDZ → 全員白画面。
 *
 * ロジック（決定的・ブラウザ不要）:
 *   1) 各識別子の「最初に束縛される行」を収集: const/let/var(分割代入含む)・関数名・関数引数・アロー引数。
 *   2) 各 useMemo/useCallback 行の依存配列 [ ... ] の識別子について、
 *      その識別子の最初の束縛行が「自分より後」なら TDZ リスクとして報告。
 *   （最初の束縛が前にあれば安全＝propや同一関数内の先行宣言を誤検知しない。外部/グローバルは束縛不明→無視）
 * 使い方: node check_tdz.js index.src.html   （問題なし=exit 0 / 検出=exit 1）
 */
const fs = require('fs');
const file = process.argv[2] || 'index.src.html';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const bind = {}; // name -> 最初の束縛行(1-based)
function addBind(name, line) {
  if (!name) return;
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return;
  if (bind[name] === undefined || line < bind[name]) bind[name] = line;
}
function namesFromParams(str) {
  // "{a,b:c={},...rest}" や "a, {x}, [y]" から識別子を抽出
  const out = [];
  (str || '').replace(/[{}\[\]]/g, ' ').split(',').forEach(tok => {
    let t = tok.trim();
    if (!t) return;
    t = t.split(':').pop().trim();      // b:c → c
    t = t.split('=')[0].trim();          // x=1 → x
    t = t.replace(/^\.\.\./, '').trim();  // ...rest → rest
    const m = t.match(/^[A-Za-z_$][\w$]*/);
    if (m) out.push(m[0]);
  });
  return out;
}

lines.forEach((ln, i) => {
  const L = i + 1;
  // const/let/var NAME=  （単純宣言）
  let m;
  const simpleRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = simpleRe.exec(ln))) addBind(m[1], L);
  // const/let/var {..}= / [..]=  （分割代入）
  const destrRe = /\b(?:const|let|var)\s*([\{\[][^=;]*?[\}\]])\s*=/g;
  while ((m = destrRe.exec(ln))) namesFromParams(m[1]).forEach(n => addBind(n, L));
  // function NAME(params)
  const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
  while ((m = fnRe.exec(ln))) { addBind(m[1], L); namesFromParams(m[2]).forEach(n => addBind(n, L)); }
  // 無名関数/コンポーネントの引数 function(params){ , (params)=>
  const anonFnRe = /\bfunction\s*\(([^)]*)\)/g;
  while ((m = anonFnRe.exec(ln))) namesFromParams(m[1]).forEach(n => addBind(n, L));
  const arrowRe = /\(([^)]*)\)\s*=>/g;
  while ((m = arrowRe.exec(ln))) namesFromParams(m[1]).forEach(n => addBind(n, L));
});

// useMemo/useCallback の依存配列を検査
const hookCallRe = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?(useMemo|useCallback)\s*\(/;
const problems = [];
lines.forEach((ln, i) => {
  const mm = ln.match(hookCallRe);
  if (!mm) return;
  const selfName = mm[1], selfLine = i + 1;
  const depMatch = ln.match(/\[([^\[\]]*)\]\s*\)\s*;?\s*$/); // 行末の依存配列
  if (!depMatch) return;
  depMatch[1].split(',').map(s => s.trim()).filter(Boolean).forEach(dep => {
    const base = dep.split(/[.\s(]/)[0];
    if (!base || base === selfName) return;
    const bl = bind[base];
    if (bl !== undefined && bl > selfLine) {
      problems.push({ name: selfName, line: selfLine, dep: base, depLine: bl });
    }
  });
});

if (problems.length) {
  console.error('❌ TDZ検査 失敗: 依存配列が「後で束縛される変数」を参照（実行時 Cannot access before initialization → 白画面）');
  problems.forEach(p => {
    console.error(`   - L${p.line} const ${p.name}=useMemo/useCallback が [${p.dep}] を参照 → ${p.dep} の束縛は L${p.depLine}（後方）`);
    console.error(`     修正: ${p.name} を ${p.dep} の宣言より後ろへ移動する`);
  });
  process.exit(1);
}
console.log('✅ TDZ検査OK: フック依存配列の前方参照なし');
process.exit(0);
