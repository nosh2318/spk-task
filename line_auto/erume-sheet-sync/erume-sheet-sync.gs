/**
 * エルメ回答シート → HANDYMAN（{store}_line_links）自動取込
 * 置き場所：エルメが作った「回答スプレッドシート」の 拡張機能 → Apps Script に貼る（3シートそれぞれ）
 *   札幌「フォーム_1」= STORE 'spk' ／ 那覇「現地_受付フォーム」「新規_受付フォーム」= STORE 'nha'
 * 初回だけ：
 *   1) 下の STORE を合わせる
 *   2) プロジェクトの設定 → スクリプト プロパティ に SYNC_SECRET を追加（値は別途お伝えする合言葉）
 *   3) 関数 setup を1回実行（権限を許可）→ 以後10分ごとに新しい行だけ送ります
 * 動作確認だけしたい時は dryRun を実行（書き込みなしで件数だけ返る）。
 */
const STORE = 'spk'; // 'spk' か 'nha'
const ENDPOINT = 'https://ckrxttbnawkclshczsia.supabase.co/functions/v1/erume-sheet-sync';
const BATCH = 500;

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'syncNewRows') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncNewRows').timeBased().everyMinutes(10).create();
  // 初回は全行を送る（既存の取込と同じ値になるだけなので安全）
  PropertiesService.getScriptProperties().setProperty('LAST_ROW', '1');
  syncNewRows();
}

function dryRun() { Logger.log(send_(readRows_(2), true)); }

function syncNewRows() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const last = Number(props.getProperty('LAST_ROW') || '1');
    const sh = sheet_();
    const lastRow = sh.getLastRow();
    if (lastRow <= last) return;
    // 念のため直前5行も重ねて送る（同じ値の再送は無害）
    const from = Math.max(2, last + 1 - 5);
    for (let r = from; r <= lastRow; r += BATCH) {
      const res = send_(readRows_(r, Math.min(BATCH, lastRow - r + 1)), false);
      if (!res.ok) throw new Error('取込失敗: ' + JSON.stringify(res));
    }
    props.setProperty('LAST_ROW', String(lastRow));
  } finally { lock.releaseLock(); }
}

function sheet_() { return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; }

function readRows_(fromRow, n) {
  const sh = sheet_();
  const cols = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, cols).getDisplayValues()[0];
  const cnt = n || Math.max(0, sh.getLastRow() - fromRow + 1);
  const rows = cnt > 0 ? sh.getRange(fromRow, 1, cnt, cols).getDisplayValues() : [];
  return { header, rows };
}

function send_(payload, dry) {
  const secret = PropertiesService.getScriptProperties().getProperty('SYNC_SECRET');
  const r = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-sync-secret': secret },
    payload: JSON.stringify({ store: STORE, header: payload.header, rows: payload.rows, dry: !!dry }),
  });
  try { return JSON.parse(r.getContentText()); } catch (e) { return { ok: false, status: r.getResponseCode(), text: r.getContentText().slice(0, 200) }; }
}
