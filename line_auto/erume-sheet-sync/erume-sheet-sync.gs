/**
 * エルメ回答シート → HANDYMAN（{store}_line_links）自動取込
 * エルメのスプレッドシート連携は、質問ページごとにタブが分かれ、どのタブにも「回答ID」列がある。
 * このスクリプトは全タブを回答IDでつなぎ直して1行＝1回答にし、新しい回答だけを送る。
 * 列の意味づけ（予約番号・お届け場所など）は受け口の EF erume-sheet-sync が行う（OMNIのCSV取込と同じ読み方）。
 *
 * 置き場所：エルメが作った回答スプレッドシートの 拡張機能 → Apps Script（3シートそれぞれ）
 *   札幌「フォーム_1」= STORE 'spk' ／ 那覇「現地_受付フォーム」「新規_受付フォーム」= STORE 'nha'
 * 初回だけ：
 *   1) 下の STORE を合わせる
 *   2) プロジェクトの設定 → スクリプト プロパティ に SYNC_SECRET を追加（値は別途お伝えする合言葉）
 *   3) dryRun を実行 → ログに件数と見本が出る（書き込みなし）
 *   4) setup を実行（権限を許可）→ 以後10分ごとに新しい回答だけ送ります
 */
const STORE = 'spk'; // 'spk' か 'nha'
const ENDPOINT = 'https://ckrxttbnawkclshczsia.supabase.co/functions/v1/erume-sheet-sync';
const SKIP_SHEETS = ['LINE集約', 'シート1']; // エルメ以外が作った集計タブは読まない
const BATCH = 300;
const OVERLAP = 30; // 直前の回答も少し重ねて送る（同じ値の再送は無害）

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'syncNewRows') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncNewRows').timeBased().everyMinutes(10).create();
  PropertiesService.getScriptProperties().setProperty('LAST_AID', '0'); // 初回は全件（既存の取込と同じ値になるだけ）
  syncNewRows();
}

function dryRun() {
  const t = collect_();
  Logger.log('タブ統合: %s 回答 / 列 %s', t.rows.length, t.header.length);
  Logger.log(JSON.stringify(send_(t.header, t.rows, true)));
}

function syncNewRows() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const last = Number(props.getProperty('LAST_AID') || '0');
    const t = collect_();
    const aidCol = t.header.indexOf('回答ID');
    const all = t.rows.map(r => ({ aid: Number(r[aidCol]) || 0, r })).sort((a, b) => a.aid - b.aid);
    const idx = all.findIndex(x => x.aid > last);
    if (idx < 0) return;
    const todo = all.slice(Math.max(0, idx - OVERLAP));
    for (let i = 0; i < todo.length; i += BATCH) {
      const res = send_(t.header, todo.slice(i, i + BATCH).map(x => x.r), false);
      if (!res.ok) throw new Error('取込失敗: ' + JSON.stringify(res));
    }
    props.setProperty('LAST_AID', String(all[all.length - 1].aid));
  } finally { lock.releaseLock(); }
}

// 全タブを回答IDでまとめる。同じ見出しは最初に見つかった空でない値を使う。
function collect_() {
  const header = ['回答ID'];
  const pos = { '回答ID': 0 };
  const recs = {};
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(sh => {
    if (SKIP_SHEETS.indexOf(sh.getName()) >= 0) return;
    const lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (lr < 2 || lc < 1) return;
    const v = sh.getRange(1, 1, lr, lc).getDisplayValues();
    const h = v[0].map(s => String(s).trim());
    const a = h.indexOf('回答ID');
    if (a < 0) return;
    h.forEach(name => { if (name && pos[name] === undefined) { pos[name] = header.length; header.push(name); } });
    for (let i = 1; i < v.length; i++) {
      const aid = String(v[i][a]).trim();
      if (!aid) continue;
      const rec = recs[aid] || (recs[aid] = { '回答ID': aid });
      h.forEach((name, c) => { const x = String(v[i][c]).trim(); if (name && x && !rec[name]) rec[name] = x; });
    }
  });
  const rows = Object.keys(recs).map(k => header.map(name => recs[k][name] || ''));
  return { header, rows };
}

function send_(header, rows, dry) {
  const secret = PropertiesService.getScriptProperties().getProperty('SYNC_SECRET');
  const r = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-sync-secret': secret },
    payload: JSON.stringify({ store: STORE, header: header, rows: rows, dry: !!dry }),
  });
  try { return JSON.parse(r.getContentText()); } catch (e) { return { ok: false, status: r.getResponseCode(), text: r.getContentText().slice(0, 200) }; }
}
