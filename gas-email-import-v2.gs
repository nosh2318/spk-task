// ============================================================
// GAS - Reservation Email Import & Vehicle Auto-Assignment
// Gmail: reserve@rent-handyman.jp
// Target: 札幌 (SPK) store only
// OTA: 楽天(R), じゃらん(J), skyticket(S), エアトリ(O), オフィシャル(HP)
// ============================================================

// --- Supabase Config (PropertiesServiceから取得) ---
var LABEL_NAME = 'processed';
function getSupabaseUrl_() { return PropertiesService.getScriptProperties().getProperty('SUPABASE_URL'); }
function getSupabaseKey_() { return PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY'); }
function getSlackEmail_() { return PropertiesService.getScriptProperties().getProperty('SLACK_EMAIL'); }
function getSquareToken_() { return PropertiesService.getScriptProperties().getProperty('SQUARE_API_TOKEN'); }

// 初回セットアップ用（1回実行後、このコメントごと削除推奨）
function setupProperties() {
  PropertiesService.getScriptProperties().setProperties({
    'SUPABASE_URL': 'https://ckrxttbnawkclshczsia.supabase.co',
    'SUPABASE_KEY': '<SERVICE_ROLE_KEYをSupabase Dashboardから取得して入力>',
    'SLACK_EMAIL': 'x-aaaatppttzyrldnhjt5el4jj3i@gl-oke5175.slack.com',
    'SQUARE_API_TOKEN': 'EAAAl0tQ2Ok8BDEwQw9LrZox4F2Q8I0GkRLiZAngMCjEQ3mfFv87X5Jxhut-nfS8'
  });
  Logger.log('Properties set successfully.');
}

// --- OTA sender definitions ---
var OTA_SENDERS = {
  jalan:     'info@jalan-rentacar.jalan.net',
  rakuten:   'travel@mail.travel.rakuten.co.jp',
  skyticket: 'rentacar@skyticket.com',
  airtrip:   'info@rentacar-mail.airtrip.jp',
  official:  'noreply@rent-handyman.jp'
};

// --- OTA reservation subject patterns ---
var OTA_RESERVE_SUBJECTS = {
  jalan:     'じゃらんnetレンタカー 予約通知',
  rakuten:   '【楽天トラベル】予約受付のお知らせ',
  skyticket: '【skyticket】 新規予約',
  airtrip:   '【予約確定】エアトリレンタカー',
  official:  'ご予約完了のお知らせ'
};

// --- Cancellation keywords in subject ---
var CANCEL_KEYWORDS = ['予約キャンセル受付', 'キャンセル'];

// ============================================================
// Setup & Trigger
// ============================================================
function setup() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processNewEmails') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('processNewEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  getOrCreateLabel_(LABEL_NAME);
  Logger.log('Setup complete: 15-minute trigger created, label "' + LABEL_NAME + '" ensured.');
}

// ============================================================
// Main Entry Points
// ============================================================
function processNewEmails() {
  var label = getOrCreateLabel_(LABEL_NAME);
  // ★ -label: 禁止（スレッド単位検索のため後続メールが見えなくなる）
  // 処理済み管理はメッセージID単位で行う
  var fromClause = Object.values(OTA_SENDERS).map(function(s) { return 'from:' + s; }).join(' OR ');
  var query = '(' + fromClause + ') newer_than:2d';

  var threads = GmailApp.search(query, 0, 50);
  if (threads.length === 0) {
    Logger.log('No new reservation emails found.');
    return;
  }

  // メッセージID単位の処理済み管理
  var processedIds = getProcessedMsgIds_();
  var newProcessedIds = [];

  Logger.log('Found ' + threads.length + ' thread(s) to check.');

  var successes = [];
  var failures = [];
  var cancellations = [];
  var skipped = [];

  threads.reverse();

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msgId = messages[j].getId();
      if (processedIds[msgId]) {
        continue;  // 処理済みメッセージはスキップ
      }
      try {
        var result = processMessage_(messages[j], false);
        newProcessedIds.push(msgId);
        if (result) {
          if (result.type === 'success') successes.push(result);
          else if (result.type === 'failure') failures.push(result);
          else if (result.type === 'cancel') cancellations.push(result);
          else if (result.type === 'skip') skipped.push(result);
        }
      } catch (e) {
        Logger.log('ERROR processing message ID ' + msgId + ': ' + e.message + '\n' + e.stack);
        newProcessedIds.push(msgId);  // エラーでも処理済みにする（無限リトライ防止）
        failures.push({id: '不明', ota: '?', name: '', reason: 'エラー: ' + e.message});
      }
    }
    threads[i].addLabel(label);  // ラベルは視覚目印としてのみ使用
  }

  // 処理済みIDを保存
  if (newProcessedIds.length > 0) {
    saveProcessedMsgIds_(processedIds, newProcessedIds);
  }

  if (successes.length > 0) sendSlackSuccess_(successes);
  if (failures.length > 0) sendSlackFailure_(failures);
  if (cancellations.length > 0) sendSlackCancel_(cancellations);

  // ハートビート: 実行完了をDBに記録
  updateHeartbeat_('spk_gas_email', {
    success: successes.length,
    failure: failures.length,
    cancel: cancellations.length,
    skip: skipped.length
  });
}

function testProcessLatest() {
  var fromClause = Object.values(OTA_SENDERS).map(function(s) { return 'from:' + s; }).join(' OR ');
  var query = '(' + fromClause + ') newer_than:7d';
  var threads = GmailApp.search(query, 0, 10);
  if (threads.length === 0) {
    Logger.log('No emails found for test.');
    return;
  }
  Logger.log('[TEST] Found ' + threads.length + ' thread(s).');
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      try {
        processMessage_(messages[j], true);
      } catch (e) {
        Logger.log('[TEST] ERROR: ' + e.message + '\n' + e.stack);
      }
    }
  }
}

// ============================================================
// Message Router
// ============================================================
function processMessage_(message, dryRun) {
  var from = message.getFrom();
  var subject = message.getSubject();
  var body = message.getPlainBody();

  var ota = null;
  var otaKeys = Object.keys(OTA_SENDERS);
  for (var i = 0; i < otaKeys.length; i++) {
    if (from.indexOf(OTA_SENDERS[otaKeys[i]]) !== -1) {
      ota = otaKeys[i];
      break;
    }
  }
  if (!ota) return null;

  var otaCode = {jalan:'J',rakuten:'R',skyticket:'S',airtrip:'O',official:'HP'}[ota] || ota;

  // Check for cancellation
  var isCancellation = CANCEL_KEYWORDS.some(function(kw) { return subject.indexOf(kw) !== -1; });

  if (isCancellation) {
    // ★ キャンセル: DB存在チェック（沖縄の予約はDBにないのでスキップ）
    var tmpId = (ota === 'rakuten')
      ? (extractField_(body, '・予約番号') || extractField_(body, '予約番号'))
      : (extractField_(body, '予約番号') || extractField_(body, '予約ID'));
    if (tmpId && !reservationExists_(tmpId)) {
      Logger.log('Skipping cancel (not in SPK DB): ' + tmpId);
      return {type:'skip', id:tmpId, reason:'DB未登録(沖縄)'};
    }
    // ★ 既にキャンセル済みならスキップ（重複キャンセルメール対応）
    if (tmpId && reservationIsCancelled_(tmpId)) {
      Logger.log('Already cancelled: ' + tmpId);
      return {type:'skip', id:tmpId, reason:'キャンセル済み'};
    }
    var cancelId = handleCancellation_(ota, body, dryRun);
    return cancelId ? {type:'cancel', id:cancelId, ota:otaCode} : null;
  }

  // Check subject matches reservation notification
  if (subject.indexOf(OTA_RESERVE_SUBJECTS[ota]) === -1) {
    Logger.log('Skipping non-reservation email (' + ota + '): ' + subject);
    return null;
  }

  // Parse reservation
  var reservation = null;
  switch (ota) {
    case 'jalan':     reservation = parseJalan_(body); break;
    case 'rakuten':   reservation = parseRakuten_(body); break;
    case 'skyticket': reservation = parseSkyticket_(body); break;
    case 'airtrip':   reservation = parseAirtrip_(body); break;
    case 'official':  reservation = parseOfficial_(body); break;
  }

  if (!reservation) {
    Logger.log('Failed to parse reservation from ' + ota);
    return {type:'failure', id:'不明', ota:otaCode, name:'', reason:'パース失敗'};
  }

  // Filter: 札幌 only
  if (!isSapporoReservation_(reservation)) {
    Logger.log('Skipping non-Sapporo: ' + reservation.id +
      ' (store=' + (reservation._store || '') + ', rawClass=' + (reservation._rawClass || '') + ')');
    return {type:'skip', id:reservation.id, reason:'沖縄店'};
  }

  Logger.log('Parsed: ' + reservation.id + ' (' + reservation.ota + ') ' +
    reservation.lend_date + '~' + reservation.return_date + ' class=' + reservation.vehicle);

  if (dryRun) {
    Logger.log('[DRY RUN] Would insert: ' + JSON.stringify(reservation));
    return null;
  }

  // Duplicate check
  var existingRow = reservationExists_(reservation.id);
  if (existingRow) {
    var existSt = existingRow.status || '';
    var isCancelled = existSt === 'cancelled' || existSt === 'キャンセル';
    if (isCancelled) {
      Logger.log('Re-booking cancelled reservation: ' + reservation.id);
      // 古いデータをクリーンアップ
      deleteFromFleet_(reservation.id);
      deleteFromTasks_(reservation.id);
      // 予約データを上書き更新
      var updateData = {};
      var keys = Object.keys(reservation);
      for (var ki = 0; ki < keys.length; ki++) {
        if (keys[ki].charAt(0) !== '_') updateData[keys[ki]] = reservation[keys[ki]];
      }
      updateData.status = 'confirmed';
      var updated = supabaseUpdate_('reservations', 'id=eq.' + encodeURIComponent(reservation.id), updateData);
      if (!updated) {
        return {type:'failure', id:reservation.id, ota:otaCode, name:reservation.name, reason:'再予約DB更新失敗'};
      }
      Logger.log('Re-booked (updated existing cancelled record): ' + reservation.id);
    } else {
      // ★ 既存レコードに欠落している情報をメールから補完
      var patch = {};
      if (!existingRow.opt_b && +(reservation.opt_b||0) > 0) patch.opt_b = reservation.opt_b;
      if (!existingRow.opt_c && +(reservation.opt_c||0) > 0) patch.opt_c = reservation.opt_c;
      if (!existingRow.opt_j && +(reservation.opt_j||0) > 0) patch.opt_j = reservation.opt_j;
      if (!existingRow.tel && reservation.tel) patch.tel = reservation.tel;
      if (!existingRow.mail && reservation.mail) patch.mail = reservation.mail;
      if (!existingRow.flight && reservation.flight) patch.flight = reservation.flight;
      if (!existingRow.people && +(reservation.people||0) > 0) patch.people = reservation.people;
      if (!existingRow.price && +(reservation.price||0) > 0) patch.price = reservation.price;
      if (Object.keys(patch).length > 0) {
        supabaseUpdate_('reservations', 'id=eq.' + encodeURIComponent(reservation.id), patch);
        Logger.log('Patched existing reservation: ' + reservation.id + ' fields=' + Object.keys(patch).join(','));
      } else {
        Logger.log('Reservation already exists (active, no patch needed): ' + reservation.id);
      }
      return {type:'skip', id:reservation.id, reason:'登録済み'};
    }
  } else {
    // Insert new
    var insertResult = insertReservation_(reservation);
    if (!insertResult) {
      // ★ unique制約違反（既にOTA自動登録で存在）の場合はスキップ扱い
      var recheck = reservationExists_(reservation.id);
      if (recheck) {
        Logger.log('INSERT failed but reservation exists (race condition): ' + reservation.id);
        return {type:'skip', id:reservation.id, reason:'登録済み（競合）'};
      }
      return {type:'failure', id:reservation.id, ota:otaCode, name:reservation.name, reason:'DB登録失敗'};
    }
  }

  // Auto-assign vehicle
  var assigned = autoAssignVehicle_(reservation);

  // ★ じゃらん事前決済: 自動レコード作成 + Slack投稿
  if (reservation.ota === 'J' && reservation.price > 0) {
    try {
      handleJalanPayment_(reservation);
    } catch (e) {
      Logger.log('[JalanPayment] Error: ' + e.message);
    }
  }

  if (assigned) {
    return {type:'success', id:reservation.id, ota:otaCode, name:reservation.name,
      dates:reservation.lend_date+'~'+reservation.return_date,
      vehicle:reservation.vehicle, assignedTo:assigned.name+' ('+assigned.plate_no+')'};
  } else {
    return {type:'failure', id:reservation.id, ota:otaCode, name:reservation.name,
      reason:'配車不可（'+reservation.vehicle+'クラス空車なし）',
      dates:reservation.lend_date+'~'+reservation.return_date};
  }
}

// ============================================================
// Store / Class Filter
// ============================================================
function isSapporoReservation_(res) {
  var store = res._store || '';
  var rawClass = res._rawClass || '';
  var address = res._address || '';
  var delPlace = res.del_place || '';
  var colPlace = res.col_place || '';
  var places = delPlace + colPlace;

  // 1. 住所で判定
  if (/沖縄県|那覇市|沖縄/.test(address)) return false;
  if (/北海道|札幌市/.test(address)) return true;

  // 2. 店舗名で判定
  if (/那覇|沖縄/.test(store)) return false;
  if (/札幌/.test(store)) return true;

  // 3. 配送先/返却先で判定
  if (/那覇|沖縄|豊見城|宜野湾|浦添|北谷|読谷|恩納|名護|糸満/.test(places)) return false;
  if (/札幌|千歳|北海道|小樽|旭川|苫小牧|新千歳/.test(places)) return true;

  // 4. クラスコードで判定
  if (/_OKA/i.test(rawClass) || /_OKI/i.test(rawClass)) return false;
  if (/_SPK/i.test(rawClass)) return true;

  // 5. 那覇専用クラス（D, A2, B2）は除外
  if (res.vehicle === 'D' || res.vehicle === 'A2' || res.vehicle === 'B2') return false;

  // 6. 札幌クラスならtrue
  var spkClasses = ['A', 'B', 'C', 'S', 'F', 'H'];
  if (res.vehicle && spkClasses.indexOf(res.vehicle) !== -1) return true;

  // 7. 判定不能 → 安全のためスキップ（手動確認）
  Logger.log('WARNING: Store undetermined for ' + (res.id || '?') + ' vehicle=' + (res.vehicle || '') + ' store=' + store + ' address=' + address + ' places=' + places);
  return false;
}

function extractVehicleClass_(rawClass) {
  if (!rawClass) return '';
  // ★ 先にB2/A2/Dなど複数文字クラスをチェック（那覇専用クラス）
  if (/[_](B2)(?:[_]|$)/i.test(rawClass)) return 'B2';
  if (/[_](A2)(?:[_]|$)/i.test(rawClass)) return 'A2';
  if (/[_](D)(?:[_]|$)/i.test(rawClass)) return 'D';
  // 単一文字クラス
  var m = rawClass.match(/[_]([ABCSFH])(?:[_]|$)/i);
  if (m) return m[1].toUpperCase();
  var m2 = rawClass.match(/^([ABCSFH])[_]/i);
  if (m2) return m2[1].toUpperCase();
  var m3 = rawClass.match(/\s([ABCSFH])[_]/i);
  if (m3) return m3[1].toUpperCase();
  var m4 = rawClass.match(/[_]([ABCSFH])$/i);
  if (m4) return m4[1].toUpperCase();
  // 複数文字クラス（位置違いパターン）
  if (/B2/i.test(rawClass)) return 'B2';
  if (/A2/i.test(rawClass)) return 'A2';
  return '';
}

// ============================================================
// Field Extraction Helpers
// ============================================================
function extractField_(body, label) {
  var escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var patterns = [
    new RegExp(escaped + '[：:]\\s*(.+)', 'm'),
    new RegExp(escaped + '\\s+(.+)', 'm')
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = body.match(patterns[i]);
    if (m) { var val = m[1].trim(); val = val.replace(/^[：:]+\s*/, ''); return val; }
  }
  return '';
}

function parseDateTime_(str) {
  if (!str) return { date: '', time: '' };
  var m = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2})[時:](\d{2})/);
  if (m) {
    return {
      date: m[1] + '-' + padZero_(m[2]) + '-' + padZero_(m[3]),
      time: padZero_(m[4]) + ':' + m[5]
    };
  }
  m = str.match(/(\d{4})-(\d{1,2})-(\d{1,2}).*?(\d{1,2}):(\d{2})/);
  if (m) {
    return {
      date: m[1] + '-' + padZero_(m[2]) + '-' + padZero_(m[3]),
      time: padZero_(m[4]) + ':' + m[5]
    };
  }
  return { date: '', time: '' };
}

function padZero_(n) { return ('0' + parseInt(n, 10)).slice(-2); }
function parsePrice_(str) { if (!str) return 0; return parseInt(str.replace(/[,，円\s]/g, ''), 10) || 0; }
function cleanPhone_(str) { if (!str) return ''; return str.replace(/[^\d-]/g, '').trim(); }
function cleanName_(str) { if (!str) return ''; return str.replace(/\s*様\s*$/, '').trim(); }

// ============================================================
// Parsers
// ============================================================
function parseJalan_(body) {
  var id = extractField_(body, '予約番号');
  if (!id) return null;
  var name = cleanName_(extractField_(body, '予約者氏名'));
  var nameKana = cleanName_(extractField_(body, '運転者氏名カナ'));
  var tel = cleanPhone_(extractField_(body, '運転者電話番号'));
  var mail = extractField_(body, '予約者メールアドレス');
  var lend = parseDateTime_(extractField_(body, '貸出日時'));
  var ret  = parseDateTime_(extractField_(body, '返却日時'));
  var store = extractField_(body, '貸出営業所');
  var rawClass = extractField_(body, '車両クラス');
  var vehicleClass = extractVehicleClass_(rawClass);
  if (!vehicleClass) {
    var plan = extractField_(body, '料金プラン');
    vehicleClass = extractVehicleClass_(plan);
    if (!rawClass) rawClass = plan;
  }
  var insuranceStr = extractField_(body, '補償（任意加入）');
  var insurance = insuranceStr.indexOf('免責') !== -1 ? '免責' : 'なし';
  var peopleStr = extractField_(body, '乗車人数');
  var people = 0;
  var pM = peopleStr.match(/大人\s*(\d+)/);
  if (pM) people += parseInt(pM[1], 10);
  var cM = peopleStr.match(/子供.*?(\d+)/);
  if (cM) people += parseInt(cM[1], 10);
  // ★ 利用者への請求額（クーポン・ポイント差引後）を優先。なければ合計金額
  var billingPrice = parsePrice_(extractField_(body, '利用者への請求額'));
  var price = billingPrice > 0 ? billingPrice : parsePrice_(extractField_(body, '合計金額'));
  var arrFlight = extractField_(body, '到着便');
  var depFlight = extractField_(body, '出発便');
  var flight = [arrFlight, depFlight].filter(Boolean).join(' / ');
  // ★ チャイルドシート等パース（オプション行から検出）
  var optionsStr = extractField_(body, 'オプション');
  var optB = 0, optC = 0, optJ = 0;
  if (optionsStr) {
    var bMatch = optionsStr.match(/ベビーシート\D*(\d+)/);
    if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
    var cMatch = optionsStr.match(/チャイルドシート\D*(\d+)/);
    if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
    var jMatch = optionsStr.match(/ジュニアシート\D*(\d+)/);
    if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  }
  return {
    id: id, ota: 'J', name: nameKana || name,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: price, status: '確定', tel: tel, mail: mail,
    flight: flight, visit_type: '', del_place: '', col_place: '',
    opt_b: optB, opt_c: optC, opt_j: optJ,
    _store: store, _rawClass: rawClass
  };
}

function parseRakuten_(body) {
  var id = extractField_(body, '・予約番号');
  if (!id) return null;
  var nameKana = cleanName_(extractField_(body, '・予約者氏名（カナ）'));
  var lend = parseDateTime_(extractField_(body, '□貸出日時'));
  var ret  = parseDateTime_(extractField_(body, '□返却日時'));
  var store = extractField_(body, '・貸渡営業所名');
  var detailClass = extractField_(body, '・詳細車両クラス');
  var rawClass = detailClass;
  var vehicleClass = extractVehicleClass_(detailClass);
  if (!vehicleClass) {
    var planMatch = detailClass.match(/プラン[_]([ABCSFH])/i);
    if (planMatch) {
      vehicleClass = planMatch[1].toUpperCase();
      rawClass = planMatch[1] + '_SPK';
    }
  }
  var optionsStr = extractField_(body, '・オプション/車両の特徴');
  var insurance = optionsStr.indexOf('免責') !== -1 ? '免責' : 'なし';
  var price = parsePrice_(extractField_(body, '（合計）'));
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = optionsStr.match(/ベビーシート\s*(\d*)/);
  if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = optionsStr.match(/チャイルドシート\s*(\d*)/);
  if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = optionsStr.match(/ジュニアシート\s*(\d*)/);
  if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  return {
    id: id, ota: 'R', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: 0, insurance: insurance,
    price: price, status: '確定', tel: '', mail: '',
    flight: '', visit_type: '', del_place: '', col_place: '',
    opt_b: optB, opt_c: optC, opt_j: optJ,
    _store: store, _rawClass: rawClass
  };
}

function parseSkyticket_(body) {
  var id = extractField_(body, '予約番号');
  if (!id) return null;
  var nameKana = cleanName_(extractField_(body, 'ご利用者名'));
  var tel = cleanPhone_(extractField_(body, '電話番号'));
  var mail = extractField_(body, 'メールアドレス');
  var lend = parseDateTime_(extractField_(body, '受取日時'));
  var ret  = parseDateTime_(extractField_(body, '返却日時'));
  var store = extractField_(body, '受取店舗');
  var rawClass = extractField_(body, '車両タイプ / クラス');
  if (!rawClass) rawClass = extractField_(body, 'プラン名');
  var vehicleClass = extractVehicleClass_(rawClass);
  var peopleStr = extractField_(body, 'ご利用人数');
  var people = 0;
  var pM = peopleStr.match(/大人\s*(\d+)/);
  if (pM) people += parseInt(pM[1], 10);
  var totalPrice = parsePrice_(extractField_(body, '合計料金'));
  var insurancePriceStr = extractField_(body, '免責補償料金');
  var insurancePrice = parsePrice_(insurancePriceStr);
  var insurance = insurancePrice > 0 ? '免責' : 'なし';
  // シート検出（オプション+本文全体から）
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = body.match(/ベビーシート[^\d]*(\d*)/); if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = body.match(/チャイルドシート[^\d]*(\d*)/); if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = body.match(/ジュニアシート[^\d]*(\d*)/); if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  return {
    id: id, ota: 'S', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: totalPrice, status: '確定', tel: tel, mail: mail,
    flight: '', visit_type: '', del_place: '', col_place: '',
    opt_b: optB, opt_c: optC, opt_j: optJ,
    _store: store, _rawClass: rawClass
  };
}

function parseAirtrip_(body) {
  var id = extractField_(body, '予約番号');
  if (!id) return null;
  var nameKana = cleanName_(extractField_(body, '予約者名'));
  var tel = cleanPhone_(extractField_(body, '電話番号'));
  var mail = extractField_(body, 'メールアドレス');
  var lend = parseDateTime_(extractField_(body, '貸出日時'));
  var ret  = parseDateTime_(extractField_(body, '返却日時'));
  var store = extractField_(body, '出発営業所');
  var rawClass = extractField_(body, '詳細車両クラス');
  if (!rawClass) rawClass = extractField_(body, 'プラン名');
  var vehicleClass = extractVehicleClass_(rawClass);
  var price = parsePrice_(extractField_(body, '合計金額'));
  var insuranceStr = extractField_(body, '補償オプション');
  var insurance = (insuranceStr && insuranceStr.indexOf('免責') !== -1) ? '免責' : 'なし';
  var arrFlight = extractField_(body, '到着便');
  var depFlight = extractField_(body, '出発便');
  var flight = [arrFlight, depFlight].filter(Boolean).join(' / ');
  // シート検出（本文全体から）
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = body.match(/ベビーシート[^\d]*(\d*)/); if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = body.match(/チャイルドシート[^\d]*(\d*)/); if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = body.match(/ジュニアシート[^\d]*(\d*)/); if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  return {
    id: id, ota: 'O', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: 0, insurance: insurance,
    price: price, status: '確定', tel: tel, mail: mail,
    flight: flight, visit_type: '', del_place: '', col_place: '',
    opt_b: optB, opt_c: optC, opt_j: optJ,
    _store: store, _rawClass: rawClass
  };
}

function parseOfficial_(body) {
  var idMatch = body.match(/【予約番号】\s*\n\s*(\S+)/);
  if (!idMatch) return null;
  var id = idMatch[1].trim();
  var nameMatch = body.match(/^(.+?)様/m);
  var name = nameMatch ? nameMatch[1].trim() : '';
  var lendMatch = body.match(/ご利用開始日時\s*\n\s*(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})/);
  var lend = { date: '', time: '' };
  if (lendMatch) { lend.date = lendMatch[1].replace(/\//g, '-'); lend.time = lendMatch[2]; }
  var retMatch = body.match(/ご利用終了日時\s*\n\s*(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})/);
  var ret = { date: '', time: '' };
  if (retMatch) { ret.date = retMatch[1].replace(/\//g, '-'); ret.time = retMatch[2]; }
  var people = 0;
  var adultMatch = body.match(/大人:\s*(\d+)/);
  if (adultMatch) people += parseInt(adultMatch[1], 10);
  var childMatch = body.match(/子ども:\s*(\d+)/);
  if (childMatch) people += parseInt(childMatch[1], 10);
  var classMatch = body.match(/ご予約車両クラス\s*\n\s*([ABCSFH])クラス/i);
  var vehicleClass = classMatch ? classMatch[1].toUpperCase() : '';
  var insurance = 'なし';
  if (/免責補償制度\(CDW\):\s*あり/.test(body)) insurance = '免責';
  if (/レンタカー安心パック:\s*あり/.test(body)) insurance = 'NOC';
  var optB = 0, optC = 0, optJ = 0;
  var cbMatch = body.match(/チャイルドシート\(チャイルド\):\s*(\d+)\s*台/);
  if (cbMatch) optC = parseInt(cbMatch[1], 10);
  if (!cbMatch) { var cbAlt = body.match(/チャイルドシート\(チャイルド\):\s*あり\s*(\d*)/); if (cbAlt) optC = parseInt(cbAlt[1], 10) || 1; }
  var jbMatch = body.match(/チャイルドシート\(ジュニア\):\s*(\d+)\s*台/);
  if (jbMatch) optJ = parseInt(jbMatch[1], 10);
  if (!jbMatch) { var jbAlt = body.match(/チャイルドシート\(ジュニア\):\s*あり\s*(\d*)/); if (jbAlt) optJ = parseInt(jbAlt[1], 10) || 1; }
  var priceMatch = body.match(/料金\s*\n\s*(\d[\d,]*)\s*円/);
  var price = priceMatch ? parsePrice_(priceMatch[1]) : 0;
  var telMatch = body.match(/【電話番号】\s*\n\s*(\S+)/);
  var tel = telMatch ? cleanPhone_(telMatch[1]) : '';
  var mailMatch = body.match(/【メールアドレス】\s*\n\s*(\S+)/);
  var mail = mailMatch ? mailMatch[1].trim() : '';
  var delPlaceMatch = body.match(/【お届け場所名】\s*\n\s*(.+)/);
  var delPlace = delPlaceMatch ? delPlaceMatch[1].trim() : '';
  var colPlaceMatch = body.match(/【回収場所名】\s*\n\s*(.+)/);
  var colPlace = colPlaceMatch ? colPlaceMatch[1].trim() : '';
  var addressMatch = body.match(/【お届け場所住所】\s*\n\s*(.+)/);
  var address = addressMatch ? addressMatch[1].trim() : '';
  return {
    id: id, ota: 'HP', name: name,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: price, status: '確定', tel: tel, mail: mail,
    flight: '', visit_type: '', del_place: delPlace, col_place: colPlace,
    opt_b: optB, opt_c: optC, opt_j: optJ,
    _store: '', _rawClass: vehicleClass, _address: address
  };
}

// ============================================================
// Cancellation Handler
// ============================================================
function handleCancellation_(ota, body, dryRun) {
  var reservationId = '';

  // ★ 複数パターンで予約番号抽出（OTAフォーマット変更に対応）
  if (ota === 'rakuten') {
    reservationId = extractField_(body, '・予約番号') || extractField_(body, '予約番号');
  } else {
    reservationId = extractField_(body, '予約番号') || extractField_(body, '予約ID');
  }

  // 正規表現フォールバック
  if (!reservationId) {
    var patterns = [/予約番号[：:]\s*(\S+)/m, /予約番号\s+(\S+)/m, /予約ID[：:]\s*(\S+)/m];
    for (var p = 0; p < patterns.length; p++) {
      var m = body.match(patterns[p]);
      if (m && m[1]) { reservationId = m[1].trim(); break; }
    }
  }

  if (!reservationId) {
    Logger.log('ERROR: Cancellation ID extraction failed (' + ota + ')');
    return null;
  }

  Logger.log('Cancellation detected: ' + reservationId + ' (' + ota + ')');

  if (dryRun) {
    Logger.log('[DRY RUN] Would cancel: ' + reservationId);
    return reservationId;
  }

  // ★ fleet削除（リトライ付き）
  var fleetOk = deleteFromFleet_(reservationId);
  if (!fleetOk) {
    Logger.log('WARNING: fleet delete failed for ' + reservationId + ', retrying...');
    Utilities.sleep(1000);
    fleetOk = deleteFromFleet_(reservationId);
    if (!fleetOk) Logger.log('ERROR: fleet delete retry failed for ' + reservationId);
  }

  // ★ tasks削除
  var tasksOk = deleteFromTasks_(reservationId);
  if (!tasksOk) {
    Logger.log('WARNING: tasks delete failed for ' + reservationId);
  }

  // ★ ステータスを "cancelled" に統一（APP側と同じ値）
  var statusOk = supabaseUpdate_('reservations', 'id=eq.' + encodeURIComponent(reservationId), {status: 'cancelled'});
  if (!statusOk) {
    Logger.log('ERROR: reservation status update failed for ' + reservationId);
    return null;
  }

  // ★ じゃらん決済キャンセル連動
  try {
    handleJalanPaymentCancel_(reservationId);
  } catch (e) {
    Logger.log('[JalanPaymentCancel] Error: ' + e.message);
  }

  Logger.log('Cancelled reservation: ' + reservationId + ' (fleet=' + fleetOk + ', tasks=' + tasksOk + ')');
  return reservationId;
}

// ============================================================
// Supabase API
// ============================================================
function supabaseHeaders_() {
  return {
    'apikey': getSupabaseKey_(),
    'Authorization': 'Bearer ' + getSupabaseKey_(),
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

function supabaseGet_(table, queryParams) {
  var url = getSupabaseUrl_() + '/rest/v1/' + table + '?' + queryParams;
  var resp = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: supabaseHeaders_(),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 400) {
    Logger.log('Supabase GET error (' + table + '): ' + resp.getContentText());
    return [];
  }
  return JSON.parse(resp.getContentText());
}

function supabasePost_(table, data) {
  var url = getSupabaseUrl_() + '/rest/v1/' + table;
  var resp = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: supabaseHeaders_(),
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 400) {
    Logger.log('Supabase POST error (' + table + '): ' + resp.getContentText());
    return null;
  }
  return JSON.parse(resp.getContentText());
}

function supabaseUpdate_(table, queryParams, data) {
  var url = getSupabaseUrl_() + '/rest/v1/' + table + '?' + queryParams;
  var resp = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    headers: supabaseHeaders_(),
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  });
  return resp.getResponseCode() < 400;
}

function supabaseDelete_(table, queryParams) {
  var url = getSupabaseUrl_() + '/rest/v1/' + table + '?' + queryParams;
  var resp = UrlFetchApp.fetch(url, {
    method: 'DELETE',
    headers: supabaseHeaders_(),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 400) {
    Logger.log('Supabase DELETE error (' + table + '): ' + resp.getContentText());
    return false;
  }
  return true;
}

// ============================================================
// Reservation DB Operations
// ============================================================
function reservationExists_(reservationId) {
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(reservationId) + '&select=id,status,opt_b,opt_c,opt_j,tel,mail,flight,people,price');
  return rows.length > 0 ? rows[0] : null;
}

// ★ キャンセル済みかどうか（再予約判定用）
function reservationIsCancelled_(reservationId) {
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(reservationId) + '&select=id,status');
  if (rows.length === 0) return false;
  var st = rows[0].status || '';
  return st === 'cancelled' || st === 'キャンセル';
}

function insertReservation_(reservation) {
  var row = {};
  var keys = Object.keys(reservation);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].charAt(0) !== '_') {
      row[keys[i]] = reservation[keys[i]];
    }
  }
  var result = supabasePost_('reservations', row);
  if (result) Logger.log('Inserted reservation: ' + reservation.id);
  return result;
}

function deleteReservation_(reservationId) {
  return supabaseDelete_('reservations', 'id=eq.' + encodeURIComponent(reservationId));
}

function deleteFromFleet_(reservationId) {
  return supabaseDelete_('fleet', 'reservation_id=eq.' + encodeURIComponent(reservationId));
}

function deleteFromTasks_(reservationId) {
  return supabaseDelete_('tasks', 'reservation_id=eq.' + encodeURIComponent(reservationId));
}

// ============================================================
// Vehicle Auto-Assignment
// ============================================================
function autoAssignVehicle_(reservation) {
  var vehicleClass = reservation.vehicle;
  if (!vehicleClass) {
    Logger.log('No vehicle class for ' + reservation.id + '. Will be 未配車.');
    return;
  }

  var vehicles = supabaseGet_('vehicles',
    'type=eq.' + encodeURIComponent(vehicleClass) + '&insurance_veh=eq.false&select=code,name,plate_no,seats');
  if (vehicles.length === 0) {
    Logger.log('No vehicles of class ' + vehicleClass + '. ' + reservation.id + ' will be 未配車.');
    return;
  }

  var lendDate = reservation.lend_date;
  var returnDate = reservation.return_date;

  var busyVehicleCodes = {};
  var overlappingFleet = getOverlappingFleetVehicles_(lendDate, returnDate);
  for (var i = 0; i < overlappingFleet.length; i++) {
    busyVehicleCodes[overlappingFleet[i]] = true;
  }

  var overlappingMaint = getOverlappingMaintenance_(lendDate, returnDate);
  for (var i = 0; i < overlappingMaint.length; i++) {
    busyVehicleCodes[overlappingMaint[i].vehicle_code] = true;
  }

  var assignedVehicle = null;
  for (var i = 0; i < vehicles.length; i++) {
    var v = vehicles[i];
    if (busyVehicleCodes[v.code]) continue;
    assignedVehicle = v;
    break;
  }

  if (!assignedVehicle) {
    Logger.log('No available vehicle for class ' + vehicleClass +
      ' (' + lendDate + '~' + returnDate + '). ' + reservation.id + ' will be 未配車.');
    return null;
  }

  var fleetRow = { reservation_id: reservation.id, vehicle_code: assignedVehicle.code };
  var result = supabasePost_('fleet', fleetRow);
  if (result) {
    Logger.log('Assigned ' + assignedVehicle.code + ' (' + assignedVehicle.name + ') to ' + reservation.id);
    return assignedVehicle;
  }
  return null;
}

function getOverlappingFleetVehicles_(lendDate, returnDate) {
  // ★ statusを取得してキャンセル予約を除外
  var query = 'select=vehicle_code,reservation_id,reservations(lend_date,return_date,status)';
  var allFleet = supabaseGet_('fleet', query);
  var busyCodes = [];
  for (var i = 0; i < allFleet.length; i++) {
    var f = allFleet[i];
    if (!f.reservations) continue;
    var r = f.reservations;
    // ★ キャンセル済み予約はスキップ（ゴミfleetが残っていても安全）
    var st = r.status || '';
    if (st === 'cancelled' || st === 'キャンセル') {
      Logger.log('Skipping cancelled fleet: ' + f.reservation_id + ' → ' + f.vehicle_code);
      continue;
    }
    if (r.lend_date <= returnDate && r.return_date >= lendDate) {
      busyCodes.push(f.vehicle_code);
    }
  }
  return busyCodes;
}

function getOverlappingMaintenance_(lendDate, returnDate) {
  var query = 'start_date=lte.' + encodeURIComponent(returnDate) +
    '&end_date=gte.' + encodeURIComponent(lendDate) +
    '&select=vehicle_code';
  return supabaseGet_('maintenance', query);
}

// ============================================================
// Slack Notifications
// ============================================================
function sendSlackSuccess_(items) {
  var lines = ['✅ 札幌店新規予約取込完了通知', ''];
  items.forEach(function(r) {
    lines.push('【' + r.ota + '】' + r.id);
    lines.push('  ' + r.name + ' / ' + r.dates + ' / ' + r.vehicle + 'クラス');
    lines.push('  → 配車: ' + r.assignedTo);
    lines.push('');
  });
  lines.push('合計: ' + items.length + '件');
  MailApp.sendEmail(getSlackEmail_(), '✅ 札幌店新規予約取込完了通知 ' + items.length + '件', lines.join('\n'));
  Logger.log('Slack success notification sent: ' + items.length + '件');
}

function sendSlackFailure_(items) {
  var lines = ['❌ 札幌店新規予約取込失敗通知', ''];
  items.forEach(function(r) {
    lines.push('【' + r.ota + '】' + (r.id || '不明'));
    if (r.name) lines.push('  ' + r.name + (r.dates ? ' / ' + r.dates : ''));
    lines.push('  理由: ' + r.reason);
    lines.push('');
  });
  lines.push('合計: ' + items.length + '件 ※手動対応が必要です');
  MailApp.sendEmail(getSlackEmail_(), '❌ 札幌店新規予約取込失敗通知 ' + items.length + '件', lines.join('\n'));
  Logger.log('Slack failure notification sent: ' + items.length + '件');
}

function sendSlackCancel_(items) {
  var lines = ['🔄 札幌店予約キャンセル処理通知', ''];
  items.forEach(function(r) {
    lines.push('【' + r.ota + '】' + r.id + ' → キャンセル処理完了');
  });
  lines.push('');
  lines.push('合計: ' + items.length + '件');
  MailApp.sendEmail(getSlackEmail_(), '🔄 札幌店予約キャンセル処理 ' + items.length + '件', lines.join('\n'));
  Logger.log('Slack cancel notification sent: ' + items.length + '件');
}

// ============================================================
// Heartbeat & Monitoring
// ============================================================

// ハートビート書込み: 実行のたびにapp_settingsに記録
function updateHeartbeat_(key, stats) {
  try {
    var payload = {
      key: 'heartbeat_' + key,
      value: JSON.stringify({
        last_run: new Date().toISOString(),
        status: (stats.failure || 0) > 0 ? 'warning' : 'ok',
        processed: (stats.success || 0) + (stats.cancel || 0) + (stats.skip || 0),
        errors: stats.failure || 0,
        details: stats
      })
    };
    var options = {
      method: 'post',
      headers: {
        'apikey': getSupabaseKey_(),
        'Authorization': 'Bearer ' + getSupabaseKey_(),
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(getSupabaseUrl_() + '/rest/v1/app_settings', options);
    Logger.log('[Heartbeat] Updated: ' + key);
  } catch (e) {
    Logger.log('[Heartbeat] Error: ' + e.message);
  }
}

// 監視チェック: 30分間隔で実行。ハートビートが途絶えていたらSlack通知
function checkHeartbeats() {
  var checks = [
    { key: 'spk_gas_email', label: '札幌GAS予約取込', thresholdMin: 30 }
  ];

  checks.forEach(function(check) {
    try {
      var url = getSupabaseUrl_() + '/rest/v1/app_settings?key=eq.heartbeat_' + check.key + '&select=value';
      var options = {
        method: 'get',
        headers: {
          'apikey': getSupabaseKey_(),
          'Authorization': 'Bearer ' + getSupabaseKey_()
        },
        muteHttpExceptions: true
      };
      var res = UrlFetchApp.fetch(url, options);
      var data = JSON.parse(res.getContentText());
      var props = PropertiesService.getScriptProperties();

      if (!data || data.length === 0) {
        var initKey = 'alert_init_' + check.key;
        if (!props.getProperty(initKey)) {
          sendSlackAlert_('⚠️ ' + check.label + ': ハートビート未登録（初回実行待ち）');
          props.setProperty(initKey, 'true');
        }
        return;
      }

      var hb = JSON.parse(data[0].value);
      var lastRun = new Date(hb.last_run);
      var now = new Date();
      var diffMin = Math.round((now - lastRun) / 60000);

      // ScriptProperties で通知済みフラグ管理（同じ障害で連続通知しない）
      var props = PropertiesService.getScriptProperties();
      var alertKey = 'alert_sent_' + check.key;
      var alertSent = props.getProperty(alertKey);

      if (diffMin > check.thresholdMin) {
        if (!alertSent) {
          var timeStr = Utilities.formatDate(lastRun, 'Asia/Tokyo', 'MM/dd HH:mm');
          sendSlackAlert_('🚨 ' + check.label + ' が' + diffMin + '分間停止中\n最終実行: ' + timeStr + '\n処理数: ' + (hb.processed || 0) + '件 / エラー: ' + (hb.errors || 0) + '件');
          props.setProperty(alertKey, 'true');
        }
      } else {
        // 復旧検知
        if (alertSent) {
          sendSlackAlert_('✅ ' + check.label + ' 復旧しました（停止' + diffMin + '分）');
          props.deleteProperty(alertKey);
        }
      }
    } catch (e) {
      Logger.log('[checkHeartbeats] Error for ' + check.key + ': ' + e.message);
    }
  });
}

function sendSlackAlert_(message) {
  try {
    MailApp.sendEmail(getSlackEmail_(), message.split('\n')[0], message);
    Logger.log('[Alert] Sent: ' + message.split('\n')[0]);
  } catch (e) {
    Logger.log('[Alert] Send error: ' + e.message);
  }
}

// セットアップ: 監視トリガー追加（30分間隔）
function setupMonitoring() {
  // 既存の監視トリガーを削除
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkHeartbeats') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('checkHeartbeats')
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log('Monitoring setup complete: 30-minute heartbeat check trigger created.');
}

// ============================================================
// じゃらん事前決済 自動化
// ============================================================
var JALAN_PAY_CHANNEL = 'C0AQL6HGG3E';  // #jalan_payment
function getSlackBotToken_() { return PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN'); }

// ★ 新規じゃらん予約 → jalan_payments作成 + Slack投稿
// ※ このGAS自体が札幌専用だが、万一のため那覇ガードを入れる
function handleJalanPayment_(reservation) {
  var resId = reservation.id;
  var store = reservation._store || '';
  if (/那覇|沖縄|OKA|naha/.test(store)) {
    Logger.log('[JalanPayment] BLOCKED: 那覇店予約 ' + resId + ' store=' + store);
    return;
  }

  // 重複チェック
  var existing = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId) + '&select=id');
  if (existing && existing.length > 0) {
    Logger.log('[JalanPayment] Already exists: ' + resId);
    return;
  }

  // ① jalan_payments にレコード作成
  var payData = {
    reservation_id: resId,
    customer_name: reservation.name,
    customer_email: reservation.mail || '',
    amount: reservation.price || 0,
    status: 'new',
    lend_date: reservation.lend_date,
    return_date: reservation.return_date,
    vehicle_class: reservation.vehicle || ''
  };
  var inserted = supabasePost_('jalan_payments', payData);
  if (!inserted) {
    Logger.log('[JalanPayment] DB insert failed: ' + resId);
    return;
  }
  Logger.log('[JalanPayment] Created: ' + resId + ' ¥' + reservation.price);

  // ② #jalan_payment にSlack投稿（AIスタッフ_Gが決済リンクを作成）
  var lendShort = (reservation.lend_date || '').replace(/^\d{4}-/, '').replace(/-/g, '/');
  var retShort = (reservation.return_date || '').replace(/^\d{4}-/, '').replace(/-/g, '/');
  var slackText = '利用店舗： 札幌店\n' +
    '予約番号： ' + resId + '\n' +
    '宛名： ' + reservation.name + '\n' +
    '品目： じゃらん事前決済(' + lendShort + '-' + retShort + ')\n' +
    '金額： ' + (reservation.price || 0);

  var slackTs = postToSlackChannel_(JALAN_PAY_CHANNEL, slackText);
  if (slackTs) {
    // slack_tsを保存（スレッド監視用）
    supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId), {slack_ts: slackTs});
    Logger.log('[JalanPayment] Slack posted: ' + resId + ' ts=' + slackTs);
  }
}

// ★ キャンセル時のじゃらん決済連動
function handleJalanPaymentCancel_(reservationId) {
  var rows = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(reservationId) + '&select=id,status,amount,customer_name');
  if (!rows || rows.length === 0) return;  // じゃらん以外 or 決済レコードなし

  var pay = rows[0];
  var prevStatus = pay.status;

  if (prevStatus === 'cancelled' || prevStatus === 'refund' || prevStatus === 'refunded') {
    Logger.log('[JalanPaymentCancel] Already cancelled/refunded: ' + reservationId);
    return;
  }

  var now = new Date().toISOString();

  if (prevStatus === 'paid') {
    // 入金後キャンセル → 返金対応必要
    supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(reservationId),
      {status: 'refund', cancelled_at: now});
    updatePaymentSheetStatus_(reservationId, '⚠️ 要返金', '');
    postToSlackChannel_(JALAN_PAY_CHANNEL,
      '⚠️ *返金対応必要*\n' +
      '予約番号： ' + reservationId + '\n' +
      '宛名： ' + (pay.customer_name || '') + '\n' +
      '金額： ¥' + (pay.amount || 0) + '\n' +
      '状態： 入金済みキャンセル → *要Square返金*');
    Logger.log('[JalanPaymentCancel] Refund needed: ' + reservationId);
  } else {
    // 決済前キャンセル（new/link_created/email_sent）
    supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(reservationId),
      {status: 'cancelled', cancelled_at: now});
    updatePaymentSheetStatus_(reservationId, '❌ キャンセル', '');
    postToSlackChannel_(JALAN_PAY_CHANNEL,
      '🔄 *キャンセル（決済前）*\n' +
      '予約番号： ' + reservationId + '\n' +
      '宛名： ' + (pay.customer_name || '') + '\n' +
      '金額： ¥' + (pay.amount || 0) + '\n' +
      '状態： 未入金キャンセル・対応不要');
    Logger.log('[JalanPaymentCancel] Cancelled (pre-payment): ' + reservationId);
  }
}

// ★ Slack API投稿（Bot Token使用 → スレッド返信をAIスタッフ_Gが検知）
function postToSlackChannel_(channel, text) {
  var token = getSlackBotToken_();
  if (!token) {
    Logger.log('[Slack] No SLACK_BOT_TOKEN configured');
    return null;
  }
  try {
    var resp = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
      method: 'post',
      headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
      payload: JSON.stringify({channel: channel, text: text}),
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (data.ok) {
      return data.ts;  // メッセージのts（スレッド追跡に使用）
    } else {
      Logger.log('[Slack] Post error: ' + data.error);
      return null;
    }
  } catch (e) {
    Logger.log('[Slack] Exception: ' + e.message);
    return null;
  }
}

// ★ Slackスレッド返信を取得（決済リンク検出用）
function getSlackThreadReplies_(channel, ts) {
  var token = getSlackBotToken_();
  if (!token) return [];
  try {
    var url = 'https://slack.com/api/conversations.replies?channel=' + channel + '&ts=' + ts;
    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {'Authorization': 'Bearer ' + token},
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    return data.ok ? (data.messages || []) : [];
  } catch (e) {
    Logger.log('[Slack] Thread read error: ' + e.message);
    return [];
  }
}

// ★ 定期実行: スレッド監視→決済リンク取得→メール送信
function checkSquareLinks() {
  // status=new でslack_tsがある（投稿済みだがリンク未取得）
  var rows = supabaseGet_('jalan_payments',
    'status=in.(new,link_created)&slack_ts=neq.&select=reservation_id,customer_name,customer_email,amount,status,slack_ts,lend_date,return_date,square_payment_url');

  if (!rows || rows.length === 0) return;

  for (var i = 0; i < rows.length; i++) {
    var pay = rows[i];

    // リンク未取得 → スレッドからURL抽出
    if (pay.status === 'new' && pay.slack_ts) {
      var replies = getSlackThreadReplies_(JALAN_PAY_CHANNEL, pay.slack_ts);
      var payUrl = null;
      for (var j = 0; j < replies.length; j++) {
        var txt = replies[j].text || '';
        var urlMatch = txt.match(/https:\/\/square\.link\/u\/\S+/);
        if (urlMatch) { payUrl = urlMatch[0]; break; }
      }
      if (payUrl) {
        supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id),
          {square_payment_url: payUrl, status: 'link_created', link_created_at: new Date().toISOString()});
        Logger.log('[JalanPayment] Link found: ' + pay.reservation_id + ' → ' + payUrl);
        // ★ スプレッドシートに行追加（Square請求書ウィジェット用）
        appendToPaymentSheet_(pay, payUrl);
        // 更新して次のループでメール送信
        pay.square_payment_url = payUrl;
        pay.status = 'link_created';
      } else {
        Logger.log('[JalanPayment] Waiting for link: ' + pay.reservation_id);
        continue;
      }
    }

    // リンク取得済み + メール未送信 → テンプレメール送信
    if (pay.status === 'link_created' && pay.square_payment_url && pay.customer_email) {
      var sent = sendJalanPaymentEmail_(pay);
      if (sent) {
        supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id),
          {status: 'email_sent', email_sent_at: new Date().toISOString()});
        // Slack通知
        postToSlackChannel_(JALAN_PAY_CHANNEL,
          '📧 *メール送信完了*\n' +
          '予約番号： ' + pay.reservation_id + '\n' +
          '宛名： ' + pay.customer_name + '\n' +
          '金額： ¥' + pay.amount);
        Logger.log('[JalanPayment] Email sent: ' + pay.reservation_id);
      }
    }
  }
}

// ★ テンプレメール送信（札幌店専用 — 那覇店に絶対送信しない）
function sendJalanPaymentEmail_(pay) {
  // ★ 那覇店ガード: reservation_idの先頭やDBから店舗判定できない場合でも
  //    このGAS自体が札幌専用なので到達しないが、安全装置として残す
  if (!pay || !pay.customer_email || !pay.square_payment_url) {
    Logger.log('[JalanPayment] Email BLOCKED: missing data for ' + (pay && pay.reservation_id || '?'));
    return;
  }
  try {
    var subject = '【レンタカー HANDYMAN】事前決済・LINE登録のお願い（予約番号: ' + pay.reservation_id + '）';
    var body = pay.customer_name + ' 様\n\n' +
      'この度はHANDYMAN札幌デリバリー専門店をご予約いただき、誠にありがとうございます。\n' +
      '予約番号: ' + pay.reservation_id + '\n' +
      '貸出日: ' + pay.lend_date + '\n' +
      '返却日: ' + pay.return_date + '\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '■ STEP1: LINE登録（必須）\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      'デリバリー情報の入力・当日のご連絡はLINEで行います。\n' +
      '下記リンクから友だち追加をお願いいたします。\n' +
      'https://lin.ee/g6iDNYz\n\n' +
      'LINE ID: @730kyhwl\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '■ STEP2: 事前決済（必須）\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      'お支払い金額: ¥' + (pay.amount || 0).toLocaleString() + '\n' +
      '下記リンクよりお支払いをお願いいたします。\n' +
      pay.square_payment_url + '\n\n' +
      '※ ご出発3日前の19:00までにお支払いください。\n' +
      '※ 期限を過ぎた場合、ご予約をキャンセルさせていただく場合がございます。\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '■ ご注意事項\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '・当店は実店舗を持たないデリバリー専門店です。\n' +
      '・ご指定の場所へお車をお届けいたします。\n' +
      '・詳細はLINEにてご案内いたします。\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      'HANDYMAN 札幌デリバリー専門店\n' +
      'TEL: 050-1724-6197（9:00〜19:00）\n' +
      'LINE: @730kyhwl\n';

    GmailApp.sendEmail(pay.customer_email, subject, body, {
      name: 'HANDYMAN 札幌デリバリー専門店',
      from: 'reserve@rent-handyman.jp',
      replyTo: 'reserve@rent-handyman.jp'
    });
    return true;
  } catch (e) {
    Logger.log('[JalanPaymentEmail] Error: ' + e.message);
    return false;
  }
}

// ★ 定期実行: 入金確認（Square Orders API で直接確認）
function checkPaymentStatus() {
  // email_sent または link_created のレコードを取得
  var rows = supabaseGet_('jalan_payments',
    'status=in.(email_sent,link_created)&square_payment_url=neq.&select=reservation_id,customer_name,amount,square_payment_url,slack_ts');

  if (!rows || rows.length === 0) return;

  var token = getSquareToken_();
  if (!token) { Logger.log('[PaymentStatus] No SQUARE_API_TOKEN'); return; }

  for (var i = 0; i < rows.length; i++) {
    var pay = rows[i];
    try {
      // Square Payment Links一覧からorder_idを検索（URLのIDで特定）
      var paid = checkSquarePayment_(token, pay.square_payment_url, pay.customer_name, pay.amount);
      if (paid) {
        var paidAt = paid.paid_at || new Date().toISOString();
        supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id),
          {status: 'paid', paid_at: paidAt});
        // ★ スプレッドシートのステータスも更新
        updatePaymentSheetStatus_(pay.reservation_id, '✅ 入金済み', paidAt);
        postToSlackChannel_(JALAN_PAY_CHANNEL,
          '✅ *入金確認完了*\n' +
          '予約番号： ' + pay.reservation_id + '\n' +
          '宛名： ' + pay.customer_name + '\n' +
          '金額： ¥' + pay.amount);
        Logger.log('[PaymentStatus] Paid: ' + pay.reservation_id);
      }
    } catch (e) {
      Logger.log('[PaymentStatus] Error checking ' + pay.reservation_id + ': ' + e.message);
    }
  }
}

// ★ Square APIで入金確認（Orders検索→顧客名+金額で照合→tenders確認）
function checkSquarePayment_(token, paymentUrl, customerName, amount) {
  if (!paymentUrl) return null;

  // Square Search Orders API: 最近のOrdersを検索
  var searchBody = {
    location_ids: ['L8N7J9RKPN3WH'],
    query: {
      filter: {
        state_filter: { states: ['OPEN', 'COMPLETED'] },
        date_time_filter: {
          created_at: {
            start_at: new Date(Date.now() - 90 * 86400000).toISOString()
          }
        }
      },
      sort: { sort_field: 'CREATED_AT', sort_order: 'DESC' }
    },
    limit: 50
  };

  var resp = UrlFetchApp.fetch('https://connect.squareup.com/v2/orders/search', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Square-Version': '2024-01-18'
    },
    payload: JSON.stringify(searchBody),
    muteHttpExceptions: true
  });

  var data = JSON.parse(resp.getContentText());
  var orders = data.orders || [];

  for (var i = 0; i < orders.length; i++) {
    var order = orders[i];
    // tenders存在 = 決済完了、net_amount_due = 0 = 全額入金
    if (!order.tenders || order.tenders.length === 0) continue;
    var netDue = order.net_amount_due_money;
    if (!netDue || netDue.amount !== 0) continue;

    // 照合: line_items.name に顧客名が含まれる AND 金額一致
    var orderAmount = order.total_money ? order.total_money.amount : 0;
    var lineItems = order.line_items || [];
    for (var j = 0; j < lineItems.length; j++) {
      var itemName = lineItems[j].name || '';
      var nameMatch = customerName && itemName.indexOf(customerName) !== -1;
      var amountMatch = amount && orderAmount === amount;
      if (nameMatch && amountMatch) {
        Logger.log('[SquareCheck] Matched order ' + order.id + ' for ' + customerName);
        return {
          paid_at: order.tenders[0].created_at,
          order_id: order.id
        };
      }
    }
  }

  return null;
}

// ★ 日次実行: 未入金アラート（出発3日前で未入金）
function checkUnpaidAlert() {
  var rows = supabaseGet_('jalan_payments',
    'status=eq.email_sent&select=reservation_id,customer_name,amount,lend_date');

  if (!rows || rows.length === 0) return;

  var now = new Date();
  var alerts = [];
  for (var i = 0; i < rows.length; i++) {
    var pay = rows[i];
    if (!pay.lend_date) continue;
    var lend = new Date(pay.lend_date + 'T00:00:00+09:00');
    var diffDays = Math.floor((lend - now) / 86400000);
    if (diffDays <= 3) {
      alerts.push(pay);
    }
  }

  if (alerts.length === 0) return;

  var lines = ['🚨 *未入金アラート* ' + alerts.length + '件\n'];
  for (var i = 0; i < alerts.length; i++) {
    var a = alerts[i];
    lines.push('• ' + a.reservation_id + ' ' + a.customer_name + ' ¥' + a.amount + '（出発: ' + a.lend_date + '）');
  }
  lines.push('\n期限超過・要電話確認');
  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
  Logger.log('[JalanPayment] Unpaid alert: ' + alerts.length + '件');
}

// ★ スプレッドシートに決済行を追加（Square請求書ウィジェット用）
// 列: A=# B=発行日 C=利用店舗 D=予約番号 E=宛名 F=品目 G=金額 H=支払いURL I=ステータス J=入金日 K=OrderID L=Slack TS M=Channel N=媒体
function appendToPaymentSheet_(pay, payUrl) {
  try {
    var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('支払い管理');
    if (!sheet) { Logger.log('[Sheet] 支払い管理 not found'); return; }

    // 重複チェック（D列=予約番号）
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var existingIds = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
      for (var i = 0; i < existingIds.length; i++) {
        if (String(existingIds[i][0]).trim() === pay.reservation_id) {
          Logger.log('[Sheet] Already exists: ' + pay.reservation_id);
          return;
        }
      }
    }

    var rowNum = lastRow;  // 連番（ヘッダー除く）
    var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
    var lendShort = (pay.lend_date || '').replace(/^\d{4}-/, '').replace(/-/g, '/');
    var retShort = (pay.return_date || '').replace(/^\d{4}-/, '').replace(/-/g, '/');

    var row = [
      rowNum,                                          // A: #
      today,                                           // B: 発行日
      '札幌店',                                        // C: 利用店舗
      pay.reservation_id,                              // D: 予約番号
      (pay.customer_name || '') + '様',                // E: 宛名
      'じゃらん事前決済(' + lendShort + '-' + retShort + ')', // F: 品目
      pay.amount || 0,                                 // G: 金額
      payUrl || pay.square_payment_url || '',           // H: 支払いURL
      '⏳ 未払い',                                     // I: ステータス
      '',                                              // J: 入金日
      '',                                              // K: OrderID
      pay.slack_ts || '',                               // L: Slack TS
      JALAN_PAY_CHANNEL || '',                          // M: Channel
      'じゃらん'                                       // N: 媒体
    ];

    sheet.appendRow(row);
    Logger.log('[Sheet] Appended: ' + pay.reservation_id);
  } catch (e) {
    Logger.log('[Sheet] Append error: ' + e.message);
  }
}

// ★ スプレッドシートのステータス列を更新
function updatePaymentSheetStatus_(reservationId, newStatus, paidDate) {
  try {
    var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('支払い管理');
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var resIds = sheet.getRange(2, 4, lastRow - 1, 1).getValues(); // D列=予約番号
    for (var i = 0; i < resIds.length; i++) {
      if (String(resIds[i][0]).trim() === reservationId) {
        sheet.getRange(i + 2, 9).setValue(newStatus);  // I列=ステータス
        if (paidDate) {
          var d = new Date(paidDate);
          sheet.getRange(i + 2, 10).setValue(Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd')); // J列=入金日
        }
        Logger.log('[Sheet] Status updated: ' + reservationId + ' → ' + newStatus);
        return;
      }
    }
    Logger.log('[Sheet] Row not found for status update: ' + reservationId);
  } catch (e) {
    Logger.log('[Sheet] Status update error: ' + e.message);
  }
}

// ★ R0R8QVZR手動追加（実行後に削除すること）
// ★ R0R8QVZR スプシステータス更新（実行後に削除すること）
function fixR0R8QVZR() {
  updatePaymentSheetStatus_('R0R8QVZR', '✅ 入金済み', '2026-04-04T11:23:48Z');
  Logger.log('R0R8QVZR → 入金済みに更新。この関数は削除してOK。');
}

// ★ スプシ媒体列自動入力（支払い管理シートの予約番号→Supabase→OTA判定）
function updateSheetOtaColumn() {
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('支払い管理');
  if (!sheet) { Logger.log('[OTA] Sheet not found'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // N列（14列目）がなければヘッダー追加
  var headerN = sheet.getRange(1, 14).getValue();
  if (headerN !== '媒体') {
    sheet.getRange(1, 14).setValue('媒体');
  }

  var resIds = sheet.getRange(2, 4, lastRow - 1, 1).getValues();  // D列=予約番号
  var otaCol = sheet.getRange(2, 14, lastRow - 1, 1).getValues(); // N列=媒体

  var otaMap = {J:'じゃらん', R:'楽天', S:'skyticket', O:'エアトリ', HP:'HP直'};

  for (var i = 0; i < resIds.length; i++) {
    if (otaCol[i][0]) continue;  // 既に入力済みならスキップ
    var rid = String(resIds[i][0]).trim();
    if (!rid) continue;

    var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(rid) + '&select=ota');
    if (rows && rows.length > 0 && rows[0].ota) {
      var otaName = otaMap[rows[0].ota] || rows[0].ota;
      sheet.getRange(i + 2, 14).setValue(otaName);
      Logger.log('[OTA] ' + rid + ' → ' + otaName);
    }
  }
}

// ★ トリガーセットアップ（じゃらん決済用）
function setupJalanPaymentTriggers() {
  // 既存トリガー削除
  var funcs = ['checkSquareLinks', 'checkPaymentStatus', 'checkUnpaidAlert', 'updateSheetOtaColumn'];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (funcs.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // スレッド監視（5分間隔）
  ScriptApp.newTrigger('checkSquareLinks').timeBased().everyMinutes(5).create();
  // 入金確認（15分間隔）
  ScriptApp.newTrigger('checkPaymentStatus').timeBased().everyMinutes(15).create();
  // 未入金アラート（毎朝9時）
  ScriptApp.newTrigger('checkUnpaidAlert').timeBased().atHour(9).nearMinute(0).everyDays(1).create();
  // スプシ媒体列更新（毎朝9:30）
  ScriptApp.newTrigger('updateSheetOtaColumn').timeBased().atHour(9).nearMinute(30).everyDays(1).create();

  Logger.log('Jalan payment triggers setup complete.');
}

// ============================================================
// Processed Message ID Management（メッセージID単位の処理済み管理）
// ============================================================
var PROCESSED_IDS_KEY = 'PROCESSED_MSG_IDS';
var MAX_PROCESSED_IDS = 500;  // 保持する最大ID数（古いものから削除）

function getProcessedMsgIds_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROCESSED_IDS_KEY) || '';
  var map = {};
  if (raw) {
    var ids = raw.split(',');
    for (var i = 0; i < ids.length; i++) {
      if (ids[i]) map[ids[i]] = true;
    }
  }
  return map;
}

function saveProcessedMsgIds_(existingMap, newIds) {
  for (var i = 0; i < newIds.length; i++) {
    existingMap[newIds[i]] = true;
  }
  var allIds = Object.keys(existingMap);
  // 古いIDを削除（MAX超過時）
  if (allIds.length > MAX_PROCESSED_IDS) {
    allIds = allIds.slice(allIds.length - MAX_PROCESSED_IDS);
  }
  PropertiesService.getScriptProperties().setProperty(PROCESSED_IDS_KEY, allIds.join(','));
}

// ============================================================
// Gmail Helpers
// ============================================================
function getOrCreateLabel_(labelName) {
  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
    Logger.log('Created Gmail label: ' + labelName);
  }
  return label;
}

// ★ R0JQ20US手動テスト（実行後に削除すること）
function testJalanPaymentR0JQ20US() {
  var rows = supabaseGet_('reservations', 'id=eq.R0JQ20US&select=*');
  if (!rows || rows.length === 0) { Logger.log('R0JQ20US not found'); return; }
  var r = rows[0];
  var reservation = {
    id: r.id, ota: r.ota, name: r.name,
    price: r.price, mail: r.mail || '',
    lend_date: r.lend_date, return_date: r.return_date,
    vehicle: r.vehicle || '', _store: '札幌デリバリー専門店'
  };
  Logger.log('Testing with: ' + JSON.stringify(reservation));
  handleJalanPayment_(reservation);
  Logger.log('Done. Check #jalan_payment and jalan_payments table.');
}
