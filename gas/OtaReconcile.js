// ============================================================
// OtaReconcile.gs (札幌) — 取込漏れを"絶対に逃さない"自発リカバリ（メール↔DB突合）
// 2026-09-15 CLI omni: OTA予約メール(源泉)から予約番号を抜き、DBに入っているか照合。
//   入っていなければ本体の取込処理(processMessage_)で自動取込（配車は既存ルール＝空車なしは未配車=スタッフ）。
//   新着は"取込待ち"なので RECON_GRACE_MS を過ぎるまで触らない。通知は「✅ 取り込んだ実績」だけ。
//   ★DB照会は1回にまとめる(直近予約IDを一括取得→メモリ照合)。N+1でGAS6分制限に当たるのを回避。
// ★このファイルは「札幌分」専用。本文が札幌(札幌デリバリー専門店/_SPK)の予約だけを reservations と照合。
// 依存(このプロジェクト): supabaseGet_ / processMessage_ / postToSlackChannel_（gas-email-import-v2.gs）
// 起動: setupOtaReconcile() を1回Runでトリガー作成(30分間隔)
// ============================================================

var RECON_SLACK_CH   = 'C07B5G3PV7C';         // #handyman_development
var RECON_ALERTED_KEY = 'spk_ota_reconcile_alerted';
var RECON_ID_RE = /予約番号[：:\s　]*([A-Za-z0-9]{6,})/;
var RECON_GRACE_MS = 3 * 3600 * 1000;
var RECON_LOOKBACK_DAYS = 35;

var RECON_SOURCES = [
  { ota: 'J',  label: 'じゃらん',       query: 'from:info@jalan-rentacar.jalan.net newer_than:2d' },
  { ota: 'R',  label: '楽天',           query: 'from:travel@mail.travel.rakuten.co.jp newer_than:2d' },
  { ota: 'S',  label: 'skyticket',      query: 'from:rentacar@skyticket.com newer_than:2d' },
  { ota: 'O',  label: 'エアトリ',       query: 'from:info@rentacar-mail.airtrip.jp newer_than:2d' },
  { ota: 'O',  label: 'エアトリプラス', query: 'from:info@skygate.co.jp newer_than:2d' },
  { ota: 'G',  label: 'GoGoOut',        query: 'from:service@gogoout.com newer_than:2d' }
];

function _reconIsSpk_(body) { return /札幌デリバリー専門店|_SPK/.test(body || ''); }  // 那覇(_OKA)/高松(_TAK)は除外

function getReconAlerted_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(RECON_ALERTED_KEY) || '{}'); }
  catch (e) { return {}; }
}
function saveReconAlerted_(m) {
  var cutoff = Date.now() - 3 * 86400 * 1000, clean = {};
  for (var k in m) { if (m[k] > cutoff) clean[k] = m[k]; }
  try { PropertiesService.getScriptProperties().setProperty(RECON_ALERTED_KEY, JSON.stringify(clean)); } catch (e) {}
}

function _reconCollect_() {
  var cand = [], seen = {};
  for (var s = 0; s < RECON_SOURCES.length; s++) {
    var src = RECON_SOURCES[s], threads;
    try { threads = GmailApp.search(src.query, 0, 50); } catch (e) { continue; }
    for (var i = 0; i < threads.length; i++) {
      var msgs = threads[i].getMessages();
      for (var j = 0; j < msgs.length; j++) {
        if (Date.now() - msgs[j].getDate().getTime() < RECON_GRACE_MS) continue;
        if (/キャンセル|取消|変更/.test(msgs[j].getSubject() || '')) continue;
        var body = msgs[j].getPlainBody() || '';
        if (!_reconIsSpk_(body)) continue;
        var m = body.match(RECON_ID_RE);
        if (!m) continue;
        var rid = String(m[1]);
        if (seen[rid]) continue; seen[rid] = true;
        var nm = ((body.match(/(?:予約者氏名|予約者名|氏名)[：:\s　]*(.+)/) || [])[1] || '').replace(/　/g, ' ').trim();
        cand.push({ rid: rid, msg: msgs[j], label: src.label, name: nm });
      }
    }
  }
  return cand;
}

function _reconExistingSet_() {
  var existing = {};
  try {
    var since = new Date(Date.now() - RECON_LOOKBACK_DAYS * 86400 * 1000).toISOString();
    var rows = supabaseGet_('reservations', 'select=id&created_at=gte.' + encodeURIComponent(since) + '&limit=5000');
    if (rows) for (var r = 0; r < rows.length; r++) existing[rows[r].id] = true;
  } catch (e) {}
  return existing;
}

function otaReconcileScan_() {
  // ★2026-10-02 Gmail枠保護を強化: 4時間毎→1日1回(深夜帯JST)に削減。skip時はGmail読取0。安全網は維持(窓2d×6OTA)。
  var _thP=PropertiesService.getScriptProperties();
  var _rLast=Number(_thP.getProperty('ota_recon_last_ms')||0), _rSince=Date.now()-_rLast;
  var _rHour=Number(Utilities.formatDate(new Date(),'Asia/Tokyo','H'));
  if (_rSince < 20*3600*1000) return;                               // 1日1回
  if (_rSince < 26*3600*1000 && !(_rHour>=2 && _rHour<=5)) return;  // 通常は深夜帯に実行(26h超過なら時間帯問わず救済)
  _thP.setProperty('ota_recon_last_ms', String(Date.now()));

  var alerted = getReconAlerted_();
  var cand = _reconCollect_();
  var existing = _reconExistingSet_();
  var imported = [], manual = [];
  for (var i = 0; i < cand.length; i++) {
    var c = cand[i];
    if (existing[c.rid]) continue;                          // 取込済＝OK
    var pr = null;
    try { pr = processMessage_(c.msg, false); } catch (e) { pr = null; }
    var after = null;                                       // 取込成否はDBに入ったかで判定
    try { after = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(c.rid) + '&select=id&limit=1'); } catch (e) {}
    if (after && after.length > 0) imported.push({ label: c.label, id: c.rid, name: c.name, assigned: (pr && pr.type === 'success') });
    else manual.push({ label: c.label, id: c.rid, name: c.name });
  }

  // ★Slackは「実際に取り込んだ実績」だけ通知（お願い/手動依頼系は出さない＝オーナー方針）
  if (imported.length > 0) {
    var t1 = '✅ *OTA取込漏れを自動取込しました（札幌）*（自動取込が取りこぼした予約を突合で復旧）\n'
      + imported.map(function (x) { return '・' + x.label + '  ' + x.id + '  ' + x.name + '  ' + (x.assigned ? '（配車済）' : '（未配車→スタッフ配車をお願いします）'); }).join('\n');
    try { postToSlackChannel_(RECON_SLACK_CH, t1); } catch (e) {}
  }
  if (manual.length > 0) Logger.log('[OtaReconcile] 自動取込不可(要手動): ' + manual.map(function (x) { return x.label + ' ' + x.id + ' ' + x.name; }).join(', '));
  saveReconAlerted_(alerted);
  Logger.log('[OtaReconcile] cand=' + cand.length + ' imported=' + imported.length + ' manual=' + manual.length);
  try { updateHeartbeat_('spk_ota_reconcile', { success: imported.length, failure: manual.length, processed: cand.length }); } catch (e) {}
  return { imported: imported, manual: manual };
}

function testOtaReconcile() {
  var cand = _reconCollect_();
  var existing = _reconExistingSet_();
  var miss = 0;
  for (var i = 0; i < cand.length; i++) {
    if (!existing[cand[i].rid]) { miss++; Logger.log('   ❌真の漏れ ' + cand[i].label + ' ' + cand[i].rid + ' ' + cand[i].name); }
  }
  Logger.log('[TEST] 候補(札幌/猶予超)=' + cand.length + ' / 真の取込漏れ=' + miss);
}

function setupOtaReconcile() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'otaReconcileScan_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('otaReconcileScan_').timeBased().everyHours(4).create();
  Logger.log('OTA突合(自動取込)トリガー設定完了（30分間隔・全OTA/札幌分）');
}
