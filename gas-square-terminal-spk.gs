// ============================================================
// Square端末決済 → 会計自動取込（札幌専用）
// NHA GAS の SquareTerminal.gs から独立
// 対象: store === 'SPK' の端末決済のみ
// トリガー: importSquareTerminalPaymentsSpk 15分間隔
// ============================================================

var SQ_SPK_PROCESSED_KEY = 'sq_terminal_spk_processed_ids';
var SQ_SPK_SLACK_CHANNEL = 'C0AQL6HGG3E'; // #jalan_payment（SPK決済通知）

// ============================================================
// メイン: Square端末決済(SPK分)を取得→会計自動起票
// ============================================================
function importSquareTerminalPaymentsSpk() {
  var token = getSquareToken_();
  if (!token) { Logger.log('[SqSpk] SQUARE_API_TOKEN未設定'); return; }

  var since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  var sinceISO = since.toISOString();

  var processed = getProcessedTerminalIdsSpk_();
  var payments = fetchSquarePaymentsSpk_(token, sinceISO);
  if (!payments || payments.length === 0) { Logger.log('[SqSpk] 新規端末決済なし'); return; }

  Logger.log('[SqSpk] 取得: ' + payments.length + '件');

  var existingInDb = {};
  try { existingInDb = fetchExistingSquarePaymentIdsSpk_(); } catch(e) {}

  var imported = 0;
  var errors = [];

  payments.forEach(function(payment) {
    var paymentId = payment.id;
    if (!paymentId) return;

    // 処理済みかつDB確認
    if (processed[paymentId] && existingInDb[paymentId]) {
      return;
    }
    if (processed[paymentId] && !existingInDb[paymentId]) {
      Logger.log('[SqSpk] 処理済みフラグあるがDB未登録 → 再処理: ' + paymentId);
    }

    // ECOMMERCE_API = PaymentLink（じゃらん事前決済等）→ 除外
    if (payment.application_details && payment.application_details.square_product === 'ECOMMERCE_API') {
      Logger.log('[SqSpk] ECOMMERCE_API スキップ: ' + paymentId);
      processed[paymentId] = Date.now();
      return;
    }

    // 端末判定
    var isTerminal = !!(payment.device_details ||
      (payment.application_details && payment.application_details.product_type === 'TERMINAL_API'));

    // オーダー取得
    var orderInfo = null;
    if (payment.order_id) {
      orderInfo = fetchSquareOrderSpk_(token, payment.order_id);
    }

    if (orderInfo && orderInfo.order) {
      // PaymentLinkメタデータチェック
      if (orderInfo.order.metadata && orderInfo.order.metadata.payment_link_id) {
        Logger.log('[SqSpk] PaymentLink スキップ: ' + paymentId);
        processed[paymentId] = Date.now();
        return;
      }
      // じゃらん事前決済チェック
      var allItemNames = (orderInfo.order.line_items || []).map(function(li){ return li.name || ''; }).join(' ');
      if (allItemNames.indexOf('じゃらん事前決済') !== -1 || allItemNames.indexOf('事前決済') !== -1) {
        Logger.log('[SqSpk] じゃらん事前決済 スキップ: ' + paymentId);
        processed[paymentId] = Date.now();
        return;
      }
      // line_item.note からメモ補完
      var itemNotes = [];
      (orderInfo.order.line_items || []).forEach(function(li){
        if (li.note) itemNotes.push(li.note);
      });
      if (itemNotes.length > 0) {
        var noteFromItem = itemNotes.join(' ');
        if (!payment.note) payment.note = noteFromItem;
      }
    }

    var note = (payment.note || '').trim();
    var parsed = parseTerminalNoteSpk_(note);
    var category = detectCategorySpk_(orderInfo, note);
    var itemName = extractItemNameSpk_(orderInfo);
    var store = parsed.store || 'UNKNOWN';

    // ★ NHA決済・UNKNOWN → NHA GASに委譲（SPK GASはスキップ）
    if (store === 'NHA' || store === 'UNKNOWN') {
      Logger.log('[SqSpk] NHA/UNKNOWN決済はNHA GASに委譲: ' + paymentId);
      return; // processedに追加しない
    }

    // SPK以外はスキップ（念のため）
    if (store !== 'SPK') { return; }

    var amount = (payment.amount_money && payment.amount_money.amount) ? payment.amount_money.amount : 0;
    if (amount === 0) { return; }

    // 科目不明 → sq_terminal_failed
    if (!category || (category !== '立替' && category !== '予約外売上')) {
      var reasonCat = '科目不明（「立替」か「予約外売上」商品を選択してください）';
      saveFailedSqPaymentSpk_(payment, reasonCat, itemName);
      errors.push({ paymentId: paymentId, amount: amount, note: note, reason: reasonCat });
      processed[paymentId] = Date.now();
      return;
    }

    // 会計レコード生成
    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
    var acctId = 'SQ_' + paymentId.substring(0, 12) + '_' + Date.now();
    var acctType = category === '立替' ? 'advance' : 'extra_sales';

    var acctRow = {
      id: acctId,
      date: dateStr,
      type: acctType,
      category: parsed.description || category,
      sub_category: '',
      description: parsed.description || note || '（Square端末決済）',
      amount: amount,
      input_by: 'Square自動',
      memo: 'Square決済ID: ' + paymentId,
      pay_method: 'カード',
      resv_no: parsed.resvNo || '',
      url: payment.receipt_url || '',
      paid: true,
      staff_name: '',
      user_name: '',
      created_at: now.toISOString()
    };

    var result = supabasePost_('spk_accounting', acctRow);
    if (result) {
      imported++;
      Logger.log('[SqSpk] ✅ 起票: ' + paymentId + ' ¥' + amount);
      try {
        postToSlackChannel_(SQ_SPK_SLACK_CHANNEL,
          '✅ *Square端末 自動起票（札幌）*\n¥' + amount.toLocaleString() +
          ' | ' + category + ' | ' + (parsed.description || note || '-') +
          (parsed.resvNo ? ' | 予約: ' + parsed.resvNo : ''));
      } catch(ex) {}
    } else {
      var reasonDb = 'Supabase INSERT失敗';
      saveFailedSqPaymentSpk_(payment, reasonDb, itemName);
      errors.push({ paymentId: paymentId, amount: amount, note: note, reason: reasonDb });
    }
    processed[paymentId] = Date.now();
  });

  saveProcessedTerminalIdsSpk_(processed);
  Logger.log('[SqSpk] 完了: 起票=' + imported + '件, 要対応=' + errors.length + '件');

  if (errors.length > 0) {
    var alertMsg = '📋 *Square起票仕訳 ' + errors.length + '件（判断必要・札幌）*\n';
    errors.forEach(function(e) {
      alertMsg += '\n• ¥' + (e.amount || 0) + ' | メモ: `' + (e.note || '空') + '` | 理由: ' + e.reason;
    });
    alertMsg += '\n\nAPPの「Square起票仕訳」から店舗・科目を確認して起票してください。';
    try { postToSlackChannel_(SQ_SPK_SLACK_CHANNEL, alertMsg); } catch(ex) {}
  }
}

// ============================================================
// Square Payments API 取得
// ============================================================
function fetchSquarePaymentsSpk_(token, sinceISO) {
  try {
    var url = 'https://connect.squareup.com/v2/payments?begin_time=' + encodeURIComponent(sinceISO) + '&limit=50&sort_order=DESC';
    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) { Logger.log('[SqSpk] Payments API error: ' + resp.getResponseCode()); return []; }
    var data = JSON.parse(resp.getContentText());
    return data.payments || [];
  } catch(e) { Logger.log('[SqSpk] fetchPayments error: ' + e.message); return []; }
}

// ============================================================
// Square Order 取得
// ============================================================
function fetchSquareOrderSpk_(token, orderId) {
  try {
    var resp = UrlFetchApp.fetch('https://connect.squareup.com/v2/orders/' + orderId, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return null;
    return JSON.parse(resp.getContentText());
  } catch(e) { return null; }
}

// ============================================================
// メモ解析: 「SPK IEI40399 延長料金」→ {store, resvNo, description}
// ============================================================
function parseTerminalNoteSpk_(note) {
  var result = { store: '', resvNo: '', description: '' };
  if (!note) return result;

  var text = note.replace(/　/g, ' ').replace(/：/g, ':').replace(/\s+/g, ' ').trim();
  var parts = text.split(/\s+/);

  if (parts.length >= 1) {
    var first = parts[0].toUpperCase();
    if (first === 'NHA' || first === 'SPK') { result.store = first; parts.shift(); }
  }

  // フォールバック: 「那覇」「札幌」キーワード
  if (!result.store) {
    if (/那覇|naha/i.test(text)) result.store = 'NHA';
    else if (/札幌|sapporo/i.test(text)) result.store = 'SPK';
    else {
      var asteriskMatch = text.match(/\*([A-Z0-9]{4,})\*/i);
      if (asteriskMatch) {
        var c = asteriskMatch[1].toUpperCase();
        if (/^R0/.test(c)) { result.store = 'NHA'; if (!result.resvNo) result.resvNo = c; }
        else if (/^(DY|RC|KUI)/.test(c)) { result.store = 'SPK'; if (!result.resvNo) result.resvNo = c; }
      }
    }
  }

  if (parts.length >= 1) {
    var second = parts[0];
    if (second === 'なし' || second === 'ナシ' || second === '-') {
      result.resvNo = ''; parts.shift();
    } else if (/^[A-Za-z0-9\-]{4,}$/.test(second)) {
      result.resvNo = second; parts.shift();
    } else if (/^SP-\d{8}-\d+$/.test(second)) {
      result.resvNo = second; parts.shift();
    }
  }
  if (parts.length > 0) result.description = parts.join(' ');
  return result;
}

// ============================================================
// 科目判定: 「立替」「予約外売上」→ category
// ============================================================
function detectCategorySpk_(orderInfo, note) {
  var combined = '';
  if (orderInfo && orderInfo.order && orderInfo.order.line_items) {
    combined = orderInfo.order.line_items.map(function(li){ return (li.name||'') + ' ' + (li.note||''); }).join(' ');
  }
  combined = combined + ' ' + (note || '');
  combined = combined.toLowerCase();
  var TATE  = /立替|たてかえ|経費|ガソリン|駐車|洗車|部品|備品|修理/;
  var EXTRA = /予約外|売上|rental|レンタル|追加|延長|オプション|チャイルド|ベビー/i;
  if (TATE.test(combined)) return '立替';
  if (EXTRA.test(combined)) return '予約外売上';
  return '';
}

// ============================================================
// item_name 抽出
// ============================================================
function extractItemNameSpk_(orderInfo) {
  try {
    if (!orderInfo || !orderInfo.order || !orderInfo.order.line_items) return '';
    return orderInfo.order.line_items.map(function(li){ return li.name||''; }).filter(Boolean).join(', ');
  } catch(e) { return ''; }
}

// ============================================================
// 処理済みID管理（ScriptProperties）
// ============================================================
function getProcessedTerminalIdsSpk_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(SQ_SPK_PROCESSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function saveProcessedTerminalIdsSpk_(map) {
  var now = Date.now();
  var cutoff = now - 48 * 60 * 60 * 1000;
  var cleaned = {};
  Object.keys(map).forEach(function(k){ if (map[k] > cutoff) cleaned[k] = map[k]; });
  PropertiesService.getScriptProperties().setProperty(SQ_SPK_PROCESSED_KEY, JSON.stringify(cleaned));
}

// ============================================================
// sq_terminal_failed に失敗レコード保存
// ============================================================
function saveFailedSqPaymentSpk_(payment, reason, itemName) {
  try {
    var row = {
      id: payment.id,
      payment_at: payment.created_at || new Date().toISOString(),
      amount: (payment.amount_money && payment.amount_money.amount) || 0,
      note: payment.note || '',
      item_name: itemName || '',
      reason: reason,
      raw_data: JSON.stringify(payment),
      resolved: false
    };
    supabasePost_('sq_terminal_failed', row);
    Logger.log('[SqSpk] 失敗記録: ' + payment.id + ' / ' + reason);
  } catch(e) { Logger.log('[SqSpk] saveFailedSq error: ' + e.message); }
}

// ============================================================
// 既存DB照合（dedup用）
// ============================================================
function fetchExistingSquarePaymentIdsSpk_() {
  var map = {};
  try {
    var SUPA_URL = getSupabaseUrl_();
    var SUPA_KEY = getSupabaseKey_();
    var headers = { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY };
    // spk_accounting のメモから payment_id 抽出
    var r1 = UrlFetchApp.fetch(SUPA_URL + "/rest/v1/spk_accounting?select=memo&memo=like.*Square%E6%B1%BA%E6%B8%88ID*&limit=500", { headers: headers, muteHttpExceptions: true });
    if (r1.getResponseCode() === 200) {
      JSON.parse(r1.getContentText()).forEach(function(row){
        var m = (row.memo||'').match(/Square決済ID:\s*([A-Za-z0-9]+)/);
        if (m) map[m[1]] = true;
      });
    }
    // sq_terminal_failed の id
    var r2 = UrlFetchApp.fetch(SUPA_URL + "/rest/v1/sq_terminal_failed?select=id&limit=500", { headers: headers, muteHttpExceptions: true });
    if (r2.getResponseCode() === 200) {
      JSON.parse(r2.getContentText()).forEach(function(row){ if (row.id) map[row.id] = true; });
    }
  } catch(e) { Logger.log('[SqSpk] fetchExisting error: ' + e.message); }
  return map;
}

// ============================================================
// トリガー設定（一度だけ手動実行）
// ============================================================
function setupSquareTerminalSpk() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'importSquareTerminalPaymentsSpk') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('importSquareTerminalPaymentsSpk')
    .timeBased().everyMinutes(15).create();
  Logger.log('✅ importSquareTerminalPaymentsSpk トリガー設定完了（15分間隔）');
}
