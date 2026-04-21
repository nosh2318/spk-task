// ============================================================
// じゃらん事前決済 自動化 — v4（2026-04-20 修正）
// 変更点:
//   1. createSquarePaymentLink_ → {url, orderId} を返す
//   2. handleJalanPayment_ → order_id をスプシCol K に保存
//   3. appendToPaymentSheet_ → orderId引数追加
//   4. checkPaymentStatus → order_id直接参照 + URL照合フォールバック + 個別アラート
//   5. normalizeSquareUrl_ → 不可視文字除去・クエリ除去の強化
//   6. fetchPaymentLinkMap_ → 上限200→1000に引き上げ
// ============================================================
var JALAN_PAY_CHANNEL = 'C0AQL6HGG3E';  // #jalan_payment
function getSlackBotToken_() { return PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN'); }

// Square Payment Links API で決済リンクを直接作成
var SQUARE_LOCATION_ID = 'L8N7J9RKPN3WH';

function createSquarePaymentLink_(itemName, amount) {
  var token = getSquareToken_();
  if (!token) { Logger.log('[Square] No SQUARE_API_TOKEN'); return null; }
  try {
    var resp = UrlFetchApp.fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'post',
      headers: {'Authorization':'Bearer '+token, 'Content-Type':'application/json', 'Square-Version':'2024-01-18'},
      payload: JSON.stringify({
        idempotency_key: Utilities.getUuid(),
        quick_pay: {
          name: itemName,
          price_money: {amount: amount, currency: 'JPY'},
          location_id: SQUARE_LOCATION_ID
        }
      }),
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (data.payment_link && data.payment_link.url) {
      Logger.log('[Square] Link created: ' + data.payment_link.url + ' order_id=' + (data.payment_link.order_id||''));
      return {url: data.payment_link.url, orderId: data.payment_link.order_id || ''};
    }
    Logger.log('[Square] API error: ' + resp.getContentText());
    return null;
  } catch (e) { Logger.log('[Square] Exception: ' + e.message); return null; }
}

function handleJalanPayment_(reservation) {
  var resId = reservation.id;
  var store = reservation._store || '';
  if (/那覇|沖縄|OKA|naha/.test(store)) { Logger.log('[JalanPayment] BLOCKED: 那覇店予約 ' + resId); return; }
  var existing = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId) + '&select=id');
  if (existing && existing.length > 0) { Logger.log('[JalanPayment] Already exists: ' + resId); return; }

  // 1. Square決済リンクを直接作成
  var lendShort = (reservation.lend_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
  var retShort = (reservation.return_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
  var itemName = (reservation.name||'') + '様 じゃらん事前決済(' + lendShort + '-' + retShort + ')';
  var linkResult = createSquarePaymentLink_(itemName, reservation.price||0);

  if (!linkResult) {
    // Square API失敗 → status='new'で保存（checkSquareLinksでリトライ）
    var payData = {reservation_id:resId, customer_name:reservation.name, customer_email:reservation.mail||'', amount:reservation.price||0, status:'new', lend_date:reservation.lend_date, return_date:reservation.return_date, vehicle_class:reservation.vehicle||''};
    supabasePost_('jalan_payments', payData);
    postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *Squareリンク作成失敗*\n予約番号： ' + resId + '\n宛名： ' + reservation.name + '\n金額： ¥' + (reservation.price||0) + '\n→ checkSquareLinksトリガーでリトライします');
    Logger.log('[JalanPayment] Square link creation failed, saved as new: ' + resId);
    return;
  }

  var payUrl = linkResult.url;
  var orderId = linkResult.orderId;

  // 2. DB保存（link_created状態で即保存）
  var now = new Date().toISOString();
  var payData = {reservation_id:resId, customer_name:reservation.name, customer_email:reservation.mail||'', amount:reservation.price||0, status:'link_created', square_payment_url:payUrl, link_created_at:now, lend_date:reservation.lend_date, return_date:reservation.return_date, vehicle_class:reservation.vehicle||''};
  var inserted = supabasePost_('jalan_payments', payData);
  if (!inserted) { Logger.log('[JalanPayment] DB insert failed: ' + resId); return; }
  Logger.log('[JalanPayment] Created with link: ' + resId + ' ¥' + reservation.price + ' → ' + payUrl + ' order_id=' + orderId);

  // 3. Slack投稿（リンク付きで可視化）
  var slackText = '💳 *じゃらん事前決済*\n利用店舗： 札幌店\n予約番号： ' + resId + '\n宛名： ' + reservation.name + '\n品目： じゃらん事前決済(' + lendShort + '-' + retShort + ')\n金額： ¥' + (reservation.price||0).toLocaleString() + '\nSquareリンク： ' + payUrl;
  var slackTs = postToSlackChannel_(JALAN_PAY_CHANNEL, slackText);
  if (slackTs) {
    supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId), {slack_ts: slackTs});
  }

  // 4. スプレッドシートに記録（order_id付き）
  appendToPaymentSheet_({reservation_id:resId, customer_name:reservation.name, amount:reservation.price||0, lend_date:reservation.lend_date, return_date:reservation.return_date, slack_ts:slackTs||''}, payUrl, orderId);
}

function handleJalanPaymentCancel_(reservationId) {
  var rows = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(reservationId) + '&select=id,status,amount,customer_name');
  if (!rows || rows.length === 0) return;
  var pay = rows[0];
  var prevStatus = pay.status;
  if (prevStatus === 'cancelled' || prevStatus === 'refund' || prevStatus === 'refunded') { Logger.log('[JalanPaymentCancel] Already cancelled/refunded: ' + reservationId); return; }
  var now = new Date().toISOString();
  if (prevStatus === 'paid') {
    supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(reservationId), {status:'refund', cancelled_at:now});
    updatePaymentSheetStatus_(reservationId, '⚠️ 要返金', '');
    postToSlackChannel_(JALAN_PAY_CHANNEL, '⚠️ *返金対応必要*\n予約番号： ' + reservationId + '\n宛名： ' + (pay.customer_name||'') + '\n金額： ¥' + (pay.amount||0) + '\n状態： 入金済みキャンセル → *要Square返金*');
  } else {
    supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(reservationId), {status:'cancelled', cancelled_at:now});
    updatePaymentSheetStatus_(reservationId, '❌ キャンセル', '');
    postToSlackChannel_(JALAN_PAY_CHANNEL, '🔄 *キャンセル（決済前）*\n予約番号： ' + reservationId + '\n宛名： ' + (pay.customer_name||'') + '\n金額： ¥' + (pay.amount||0) + '\n状態： 未入金キャンセル・対応不要');
  }
  Logger.log('[JalanPaymentCancel] Done: ' + reservationId + ' → ' + (prevStatus === 'paid' ? 'refund' : 'cancelled'));
}

function postToSlackChannel_(channel, text) {
  var token = getSlackBotToken_();
  if (!token) { Logger.log('[Slack] No SLACK_BOT_TOKEN configured'); return null; }
  try {
    var resp = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {method:'post', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}, payload:JSON.stringify({channel:channel, text:text}), muteHttpExceptions:true});
    var data = JSON.parse(resp.getContentText());
    if (data.ok) return data.ts;
    Logger.log('[Slack] Post error: ' + data.error);
    return null;
  } catch (e) { Logger.log('[Slack] Exception: ' + e.message); return null; }
}

function getSlackThreadReplies_(channel, ts) {
  var token = getSlackBotToken_();
  if (!token) return [];
  try {
    var resp = UrlFetchApp.fetch('https://slack.com/api/conversations.replies?channel=' + channel + '&ts=' + ts, {method:'get', headers:{'Authorization':'Bearer '+token}, muteHttpExceptions:true});
    var data = JSON.parse(resp.getContentText());
    return data.ok ? (data.messages||[]) : [];
  } catch (e) { Logger.log('[Slack] Thread read error: ' + e.message); return []; }
}

function checkSquareLinks() {
  var rows = supabaseGet_('jalan_payments', 'status=in.(new,link_created)&select=reservation_id,customer_name,customer_email,amount,status,slack_ts,lend_date,return_date,square_payment_url');
  if (!rows || rows.length === 0) return;
  for (var i = 0; i < rows.length; i++) {
    var pay = rows[i];

    // status=new: handleJalanPayment_でSquareリンク作成が失敗した行 → リトライ
    if (pay.status === 'new') {
      var lendShort = (pay.lend_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
      var retShort = (pay.return_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
      var itemName = (pay.customer_name||'') + '様 じゃらん事前決済(' + lendShort + '-' + retShort + ')';
      var linkResult = createSquarePaymentLink_(itemName, pay.amount||0);
      if (!linkResult) { Logger.log('[checkSquareLinks] Retry failed: ' + pay.reservation_id); continue; }
      var payUrl = linkResult.url;
      var now = new Date().toISOString();
      supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id), {square_payment_url:payUrl, status:'link_created', link_created_at:now});
      Logger.log('[checkSquareLinks] Retry success: ' + pay.reservation_id + ' → ' + payUrl);
      var slackText = '💳 *じゃらん事前決済（リトライ成功）*\n予約番号： ' + pay.reservation_id + '\n宛名： ' + pay.customer_name + '\n金額： ¥' + (pay.amount||0).toLocaleString() + '\nSquareリンク： ' + payUrl;
      var slackTs = postToSlackChannel_(JALAN_PAY_CHANNEL, slackText);
      if (slackTs && !pay.slack_ts) { supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id), {slack_ts: slackTs}); }
      appendToPaymentSheet_(pay, payUrl, linkResult.orderId);
      pay.square_payment_url = payUrl; pay.status = 'link_created';
    }

    // status=link_created: メール送信
    if (pay.status === 'link_created' && pay.square_payment_url && pay.customer_email) {
      var sent = sendJalanPaymentEmail_(pay);
      if (sent) {
        supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id), {status:'email_sent', email_sent_at:new Date().toISOString()});
        postToSlackChannel_(JALAN_PAY_CHANNEL, '📧 *メール送信完了*\n予約番号： ' + pay.reservation_id + '\n宛名： ' + pay.customer_name + '\n金額： ¥' + pay.amount);
        Logger.log('[checkSquareLinks] Email sent: ' + pay.reservation_id);
      }
    }
  }
}

function sendJalanPaymentEmail_(pay) {
  if (!pay || !pay.customer_email || !pay.square_payment_url) { Logger.log('[JalanPayment] Email BLOCKED: missing data'); return; }
  try {
    var subject = '【レンタカー HANDYMAN】事前決済・LINE登録のお願い（予約番号: ' + pay.reservation_id + '）';
    var body = pay.customer_name + ' 様\n\nこの度はHANDYMAN札幌デリバリー専門店をご予約いただき、誠にありがとうございます。\n予約番号: ' + pay.reservation_id + '\n貸出日: ' + pay.lend_date + '\n返却日: ' + pay.return_date + '\n\n━━━━━━━━━━━━━━━━━━━━\n■ STEP1: LINE登録（必須）\n━━━━━━━━━━━━━━━━━━━━\nデリバリー情報の入力・当日のご連絡はLINEで行います。\n下記リンクから友だち追加をお願いいたします。\nhttps://lin.ee/g6iDNYz\n\nLINE ID: @730kyhwl\n\n━━━━━━━━━━━━━━━━━━━━\n■ STEP2: 事前決済（必須）\n━━━━━━━━━━━━━━━━━━━━\nお支払い金額: ¥' + (pay.amount||0).toLocaleString() + '\n下記リンクよりお支払いをお願いいたします。\n' + pay.square_payment_url + '\n\n※ ご出発3日前の19:00までにお支払いください。\n※ 期限を過ぎた場合、ご予約をキャンセルさせていただく場合がございます。\n\n━━━━━━━━━━━━━━━━━━━━\n■ ご注意事項\n━━━━━━━━━━━━━━━━━━━━\n・当店は実店舗を持たないデリバリー専門店です。\n・ご指定の場所へお車をお届けいたします。\n・詳細はLINEにてご案内いたします。\n\n━━━━━━━━━━━━━━━━━━━━\nHANDYMAN 札幌デリバリー専門店\nTEL: 050-1724-6197（9:00〜19:00）\nLINE: @730kyhwl\n';
    GmailApp.sendEmail(pay.customer_email, subject, body, {name:'HANDYMAN 札幌デリバリー専門店', from:'reserve@rent-handyman.jp', replyTo:'reserve@rent-handyman.jp'});
    return true;
  } catch (e) { Logger.log('[JalanPaymentEmail] Error: ' + e.message); return false; }
}

// ★★★ 入金確認 v4（2026-04-20 修正）★★★
// 変更点:
//   1. Col K(OrderID) が既にある行 → URL照合不要で直接order取得
//   2. Col K が空の行 → 従来通りURL照合（fetchPaymentLinkMap_経由）
//   3. URL照合失敗時 → 部分一致フォールバック + Slackアラート
//   4. 全行処理後にURLマッチ失敗サマリーをSlack通知
function checkPaymentStatus() {
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('支払い管理');
  if (!sheet) { Logger.log('[PaymentStatus] Sheet not found'); return; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var NAHA_PAY_CHANNEL = 'C0AP2S5B147';
  var unpaidRows = [];
  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][8] || '');
    var url = String(data[i][7] || '');
    var store = String(data[i][2] || '');
    if (status.indexOf('済') === -1 && status.indexOf('キャンセル') === -1 && url) {
      unpaidRows.push({
        rowIndex: i + 2,
        reservationId: String(data[i][3] || '').trim(),
        customerName: String(data[i][4] || '').replace(/様$/, '').trim(),
        amount: Number(data[i][6]) || 0,
        url: url.trim(),
        media: String(data[i][13] || '').trim(),
        store: store.trim(),
        savedOrderId: String(data[i][10] || '').trim(),  // Col K = OrderID（v4: 既に保存済みならURL照合不要）
        orderId: null
      });
    }
  }
  if (unpaidRows.length === 0) { Logger.log('[PaymentStatus] No unpaid rows found'); return; }
  Logger.log('[PaymentStatus v4] Checking ' + unpaidRows.length + ' unpaid rows');

  var token = getSquareToken_();
  if (!token) { Logger.log('[PaymentStatus] No SQUARE_API_TOKEN'); postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\nSQUARE_API_TOKENが未設定です。'); return; }

  // Phase 1: 既にOrderIDが保存されている行 → 直接取得
  var directOrderIds = [], urlMatchNeeded = [];
  for (var i = 0; i < unpaidRows.length; i++) {
    if (unpaidRows[i].savedOrderId) {
      unpaidRows[i].orderId = unpaidRows[i].savedOrderId;
      directOrderIds.push(unpaidRows[i].savedOrderId);
      Logger.log('[PaymentStatus v4] Direct order_id: ' + unpaidRows[i].reservationId + ' → ' + unpaidRows[i].savedOrderId);
    } else {
      urlMatchNeeded.push(i);
    }
  }
  Logger.log('[PaymentStatus v4] Direct order_id: ' + directOrderIds.length + '件, URL照合必要: ' + urlMatchNeeded.length + '件');

  // Phase 2: URL照合が必要な行 → fetchPaymentLinkMap_
  var unmatchedRows = [];
  if (urlMatchNeeded.length > 0) {
    var linkMap = fetchPaymentLinkMap_(token);
    var linkMapSize = linkMap ? Object.keys(linkMap).length : 0;
    Logger.log('[PaymentStatus v4] Payment Links map: ' + linkMapSize + ' entries');

    if (linkMapSize === 0 && directOrderIds.length === 0) {
      postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\nSquare Payment Links APIが0件を返しました。\n`debugPaymentV3` を手動実行して診断してください。');
      return;
    }

    // 全Payment Link URLをリスト化（部分一致フォールバック用）
    var allLinkUrls = Object.keys(linkMap);

    for (var j = 0; j < urlMatchNeeded.length; j++) {
      var idx = urlMatchNeeded[j];
      var normalizedUrl = normalizeSquareUrl_(unpaidRows[idx].url);
      var orderId = linkMap[normalizedUrl];

      // 完全一致 → OK
      if (orderId) {
        unpaidRows[idx].orderId = orderId;
        // ★ Col Kにorder_idを保存（次回からURL照合不要に）
        sheet.getRange(unpaidRows[idx].rowIndex, 11).setValue(orderId);
        continue;
      }

      // ★ 部分一致フォールバック: URLの末尾パス部分で検索
      var urlPath = normalizedUrl.replace(/^https?:\/\/[^\/]+/, '');
      var fallbackId = null;
      for (var k = 0; k < allLinkUrls.length; k++) {
        if (allLinkUrls[k].indexOf(urlPath) >= 0 || normalizedUrl.indexOf(allLinkUrls[k].replace(/^https?:\/\/[^\/]+/, '')) >= 0) {
          fallbackId = linkMap[allLinkUrls[k]];
          Logger.log('[PaymentStatus v4] Partial match fallback: ' + unpaidRows[idx].reservationId + ' → ' + fallbackId);
          break;
        }
      }

      if (fallbackId) {
        unpaidRows[idx].orderId = fallbackId;
        sheet.getRange(unpaidRows[idx].rowIndex, 11).setValue(fallbackId);
      } else {
        unmatchedRows.push(unpaidRows[idx]);
        Logger.log('[PaymentStatus v4] ❌ No URL match: ' + unpaidRows[idx].reservationId + ' URL=' + unpaidRows[idx].url);
      }
    }
  }

  // Phase 3: 全order_id取得 → tenders確認
  var allOrderIds = [];
  for (var i = 0; i < unpaidRows.length; i++) {
    if (unpaidRows[i].orderId) allOrderIds.push(unpaidRows[i].orderId);
  }

  if (allOrderIds.length === 0) {
    postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\n未払い' + unpaidRows.length + '件中、order_id特定0件。\nURL不一致: ' + unmatchedRows.map(function(r){return r.reservationId;}).join(', '));
    return;
  }

  var orderMap = batchRetrieveOrders_(token, allOrderIds);
  if (!orderMap || Object.keys(orderMap).length === 0) {
    postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\nSquare Orders取得が0件です。order_ids: ' + allOrderIds.slice(0,5).join(', '));
    return;
  }

  // Phase 4: 入金判定 + 更新
  var paidCount = 0;
  for (var i = 0; i < unpaidRows.length; i++) {
    var pay = unpaidRows[i];
    if (!pay.orderId) continue;
    try {
      var matched = isOrderPaid_(orderMap[pay.orderId]);
      if (matched) {
        var paidDateStr = Utilities.formatDate(new Date(matched.paid_at), 'Asia/Tokyo', 'yyyy/MM/dd');
        sheet.getRange(pay.rowIndex, 9).setValue('✅ 入金済み');
        sheet.getRange(pay.rowIndex, 10).setValue(paidDateStr);
        sheet.getRange(pay.rowIndex, 11).setValue(matched.order_id);
        try { supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservationId) + '&status=neq.paid', {status:'paid', paid_at:matched.paid_at}); } catch(e) {}
        var notifyChannel = (pay.store.indexOf('那覇') >= 0 || pay.store.indexOf('沖縄') >= 0) ? NAHA_PAY_CHANNEL : JALAN_PAY_CHANNEL;
        postToSlackChannel_(notifyChannel, '✅ *入金確認完了*\n予約番号： ' + pay.reservationId + '\n宛名： ' + pay.customerName + '\n金額： ¥' + pay.amount.toLocaleString() + (pay.media ? '\n媒体： ' + pay.media : '') + '\n店舗： ' + pay.store);
        Logger.log('[PaymentStatus v4] ✅ Paid: ' + pay.reservationId);
        paidCount++;
      }
    } catch (e) { Logger.log('[PaymentStatus v4] Error checking ' + pay.reservationId + ': ' + e.message); }
  }

  // Phase 5: URL不一致アラート（毎回通知→サイレントスキップ撲滅）
  if (unmatchedRows.length > 0) {
    var alertLines = ['⚠️ *入金確認 URL不一致* ' + unmatchedRows.length + '件\n以下の行はSquare Payment LinksとURLが一致しません。手動確認が必要です。\n'];
    for (var i = 0; i < unmatchedRows.length; i++) {
      alertLines.push('• ' + unmatchedRows[i].reservationId + ' ' + unmatchedRows[i].customerName + ' ¥' + unmatchedRows[i].amount + '\n  URL: ' + unmatchedRows[i].url);
    }
    alertLines.push('\n👉 スプシのOrderID列(K)に手動でorder_idを入力すれば次回から自動照合されます。');
    postToSlackChannel_(JALAN_PAY_CHANNEL, alertLines.join('\n'));
  }

  Logger.log('[PaymentStatus v4] Done. ' + paidCount + '/' + unpaidRows.length + ' confirmed paid, ' + unmatchedRows.length + ' unmatched');
}

function fetchPaymentLinkMap_(token) {
  var map = {}, cursor = null, fetched = 0;
  do {
    var apiUrl = 'https://connect.squareup.com/v2/online-checkout/payment-links?limit=100';
    if (cursor) apiUrl += '&cursor=' + encodeURIComponent(cursor);
    try {
      var resp = UrlFetchApp.fetch(apiUrl, {method:'get', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Square-Version':'2024-01-18'}, muteHttpExceptions:true});
      var code = resp.getResponseCode();
      if (code !== 200) { Logger.log('[PaymentLinks] API error ' + code + ': ' + resp.getContentText().substring(0,200)); break; }
      var data = JSON.parse(resp.getContentText());
      (data.payment_links||[]).forEach(function(link) {
        if (link.order_id) {
          if (link.url) map[normalizeSquareUrl_(link.url)] = link.order_id;
          if (link.long_url) map[normalizeSquareUrl_(link.long_url)] = link.order_id;
        }
      });
      fetched += (data.payment_links||[]).length;
      cursor = data.cursor;
    } catch (e) { Logger.log('[PaymentLinks] Fetch error: ' + e.message); break; }
  } while (cursor && fetched < 1000);  // ★ v4: 上限200→1000に引き上げ
  Logger.log('[PaymentLinks] Total map entries: ' + Object.keys(map).length + ' (fetched ' + fetched + ' links)');
  return map;
}

// ★ v4: 不可視文字除去 + クエリパラメータ除去の強化
function normalizeSquareUrl_(url) {
  return String(url||'')
    .trim()
    .replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, '')  // ゼロ幅文字・NBSP除去
    .replace(/\/+$/, '')
    .replace(/\?.*$/, '')  // クエリパラメータ除去
    .toLowerCase();
}

function batchRetrieveOrders_(token, orderIds) {
  var map = {}, unique = [], seen = {};
  orderIds.forEach(function(id) { if (id && !seen[id]) { unique.push(id); seen[id]=true; } });
  for (var i = 0; i < unique.length; i += 100) {
    try {
      var resp = UrlFetchApp.fetch('https://connect.squareup.com/v2/orders/batch-retrieve', {method:'post', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Square-Version':'2024-01-18'}, payload:JSON.stringify({location_id:SQUARE_LOCATION_ID, order_ids:unique.slice(i,i+100)}), muteHttpExceptions:true});
      var code = resp.getResponseCode();
      if (code !== 200) { Logger.log('[BatchOrders] API error ' + code + ': ' + resp.getContentText().substring(0,200)); continue; }
      (JSON.parse(resp.getContentText()).orders||[]).forEach(function(o) { map[o.id]=o; });
    } catch (e) { Logger.log('[BatchOrders] Error: ' + e.message); }
  }
  Logger.log('[BatchOrders] Retrieved ' + Object.keys(map).length + '/' + unique.length + ' orders');
  return map;
}

function isOrderPaid_(order) {
  if (!order || !order.tenders || order.tenders.length === 0) return null;
  var netDue = order.net_amount_due_money;
  if (netDue && netDue.amount !== 0) return null;
  return {paid_at: order.tenders[0].created_at, order_id: order.id};
}

function checkUnpaidAlert() {
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('支払い管理');
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var now = new Date(), alerts = [];
  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][8]||'');
    if (status.indexOf('済')!==-1 || status.indexOf('キャンセル')!==-1) continue;
    var resvId = String(data[i][3]||'').trim(), name = String(data[i][4]||'').trim(), amount = Number(data[i][6])||0, url = String(data[i][7]||'').trim();
    if (!resvId || !url) continue;
    var resv = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(resvId) + '&select=lend_date');
    var lendDate = (resv && resv.length > 0 && resv[0].lend_date) ? resv[0].lend_date : null;
    if (!lendDate) { var dm = String(data[i][5]||'').match(/(\d{2})\/(\d{2})/); if (dm) lendDate = now.getFullYear() + '-' + dm[1] + '-' + dm[2]; }
    if (!lendDate) continue;
    var diffDays = Math.floor((new Date(lendDate+'T00:00:00+09:00') - now) / 86400000);
    if (diffDays <= 3) alerts.push({reservationId:resvId, customerName:name, amount:amount, lendDate:lendDate, daysLeft:diffDays});
  }
  if (alerts.length === 0) return;
  var lines = ['🚨 *未入金アラート* ' + alerts.length + '件\n'];
  alerts.forEach(function(a) {
    var urgency = a.daysLeft<=0 ? '🔴期限超過' : a.daysLeft<=1 ? '🟠明日出発' : '🟡'+a.daysLeft+'日後';
    lines.push('• ' + a.reservationId + ' ' + a.customerName + ' ¥' + a.amount + '（出発: ' + a.lendDate + ' ' + urgency + '）');
  });
  lines.push('\n期限超過・要電話確認');
  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
  Logger.log('[UnpaidAlert] ' + alerts.length + '件通知');
}

// ★ v4: orderId引数を追加
function appendToPaymentSheet_(pay, payUrl, orderId) {
  try {
    var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('支払い管理');
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var existingIds = sheet.getRange(2, 4, lastRow-1, 1).getValues();
      for (var i = 0; i < existingIds.length; i++) { if (String(existingIds[i][0]).trim() === pay.reservation_id) { Logger.log('[Sheet] Already exists: ' + pay.reservation_id); return; } }
    }
    var lendShort = (pay.lend_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
    var retShort = (pay.return_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
    sheet.appendRow([lastRow, Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy/MM/dd'), '札幌店', pay.reservation_id, (pay.customer_name||'')+'様', 'じゃらん事前決済('+lendShort+'-'+retShort+')', pay.amount||0, payUrl||pay.square_payment_url||'', '⏳ 未払い', '', orderId||'', pay.slack_ts||'', JALAN_PAY_CHANNEL||'', 'じゃらん']);
    Logger.log('[Sheet] Appended: ' + pay.reservation_id + (orderId ? ' order_id=' + orderId : ''));
  } catch (e) { Logger.log('[Sheet] Append error: ' + e.message); }
}

function updatePaymentSheetStatus_(reservationId, newStatus, paidDate) {
  try {
    var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('支払い管理');
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var resIds = sheet.getRange(2, 4, lastRow-1, 1).getValues();
    for (var i = 0; i < resIds.length; i++) {
      if (String(resIds[i][0]).trim() === reservationId) {
        sheet.getRange(i+2, 9).setValue(newStatus);
        if (paidDate) sheet.getRange(i+2, 10).setValue(Utilities.formatDate(new Date(paidDate), 'Asia/Tokyo', 'yyyy/MM/dd'));
        Logger.log('[Sheet] Status updated: ' + reservationId + ' → ' + newStatus);
        return;
      }
    }
  } catch (e) { Logger.log('[Sheet] Status update error: ' + e.message); }
}

// ★ v4: 既存未払い行のOrderIDを一括補完する関数（手動実行用）
// スプシの全未払い行に対し、URLからorder_idを特定してCol Kに書き込む
function backfillOrderIds() {
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('支払い管理');
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var token = getSquareToken_();
  if (!token) { Logger.log('[Backfill] No token'); return; }
  var linkMap = fetchPaymentLinkMap_(token);
  var filled = 0, missing = 0;
  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][8]||'');
    var url = String(data[i][7]||'').trim();
    var existingOid = String(data[i][10]||'').trim();
    var resvId = String(data[i][3]||'').trim();
    // 既にOrderIDがある行、または済/キャンセル行はスキップ
    if (existingOid || !url || status.indexOf('済') !== -1 || status.indexOf('キャンセル') !== -1) continue;
    var normalizedUrl = normalizeSquareUrl_(url);
    var orderId = linkMap[normalizedUrl];
    if (orderId) {
      sheet.getRange(i + 2, 11).setValue(orderId);
      Logger.log('[Backfill] ✅ ' + resvId + ' → ' + orderId);
      filled++;
    } else {
      Logger.log('[Backfill] ❌ ' + resvId + ' URL不一致: ' + url);
      missing++;
    }
  }
  Logger.log('[Backfill] 完了: 補完=' + filled + '件, 不一致=' + missing + '件');
}

// ★ v4: デバッグ強化版
function debugPaymentV4() {
  var token = getSquareToken_();
  if (!token) { Logger.log('No SQUARE_API_TOKEN'); return; }
  Logger.log('=== Phase 1: Payment Links API ===');
  var linkMap = fetchPaymentLinkMap_(token);
  var linkUrls = Object.keys(linkMap);
  Logger.log('Payment Links取得数: ' + linkUrls.length);
  linkUrls.slice(0,5).forEach(function(url,i) { Logger.log('  ['+i+'] url='+url+' → order_id='+linkMap[url]); });

  Logger.log('=== Phase 2: スプシ全行照合 ===');
  var ss = SpreadsheetApp.openById('1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc');
  var sheet = ss.getSheetByName('支払い管理');
  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow-1, 14).getValues();
  var matchedIds = [], unmatchedList = [];
  data.forEach(function(row, idx) {
    var status = String(row[8]||''), url = String(row[7]||'').trim(), savedOid = String(row[10]||'').trim();
    if (status.indexOf('済')!==-1 || status.indexOf('キャンセル')!==-1 || !url) return;
    var resvId = String(row[3]||'').trim(), name = String(row[4]||'').trim(), amount = Number(row[6])||0;
    Logger.log('  [Row'+(idx+2)+'] '+resvId+' '+name+' ¥'+amount+(savedOid?' OrderID='+savedOid:''));
    if (savedOid) {
      Logger.log('    → Direct order_id: ' + savedOid);
      matchedIds.push(savedOid);
      return;
    }
    var normalizedUrl = normalizeSquareUrl_(url);
    var orderId = linkMap[normalizedUrl];
    Logger.log('    URL: '+url);
    Logger.log('    正規化: '+normalizedUrl);
    Logger.log('    → order_id: '+(orderId||'❌ NOT FOUND'));
    if (orderId) matchedIds.push(orderId);
    else unmatchedList.push(resvId);
  });

  Logger.log('=== URL不一致リスト: ' + unmatchedList.join(', ') + ' ===');

  if (matchedIds.length > 0) {
    Logger.log('=== Phase 3: Orders tenders確認 ===');
    var orderMap = batchRetrieveOrders_(token, matchedIds);
    for (var oid in orderMap) {
      var order = orderMap[oid], hasTenders = order.tenders && order.tenders.length > 0;
      var netDue = order.net_amount_due_money ? order.net_amount_due_money.amount : '?';
      Logger.log('  order='+oid+' total=¥'+(order.total_money?order.total_money.amount:0)+' tenders='+(hasTenders?'✅'+order.tenders.length+'件':'❌なし')+' net_due='+netDue);
      if (hasTenders) Logger.log('    paid_at='+order.tenders[0].created_at);
    }
  }
  Logger.log('=== debugPaymentV4 完了 ===');
}
