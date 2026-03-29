// ============================================================
// GAS - Reservation Email Import & Vehicle Auto-Assignment
// Gmail: reserve@rent-handyman.jp
// Target: 札幌 (SPK) store only
// OTA: 楽天(R), じゃらん(J), skyticket(S), エアトリ(O), オフィシャル(HP)
// ============================================================

// --- Supabase Config ---
var SUPABASE_URL = 'https://ckrxttbnawkclshczsia.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh0dGJuYXdrY2xzaGN6c2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Nzg1NTAsImV4cCI6MjA4NzQ1NDU1MH0.kDC_UDVWvcrS97wzqQ3NXP79ewjgYwF4vSFdV7y06S8';
var LABEL_NAME = 'processed';
var SLACK_EMAIL = 'x-aaaatppttzyrldnhjt5el4jj3i@gl-oke5175.slack.com';

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
  var fromClause = Object.values(OTA_SENDERS).map(function(s) { return 'from:' + s; }).join(' OR ');
  var query = '(' + fromClause + ') -label:' + LABEL_NAME + ' -label:処理済み newer_than:2d';

  var threads = GmailApp.search(query, 0, 50);
  if (threads.length === 0) {
    Logger.log('No new reservation emails found.');
    return;
  }

  Logger.log('Found ' + threads.length + ' thread(s) to process.');

  var successes = [];
  var failures = [];
  var cancellations = [];
  var skipped = [];

  threads.reverse();

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      try {
        var result = processMessage_(messages[j], false);
        if (result) {
          if (result.type === 'success') successes.push(result);
          else if (result.type === 'failure') failures.push(result);
          else if (result.type === 'cancel') cancellations.push(result);
          else if (result.type === 'skip') skipped.push(result);
        }
      } catch (e) {
        Logger.log('ERROR processing message ID ' + messages[j].getId() + ': ' + e.message + '\n' + e.stack);
        failures.push({id: '不明', ota: '?', name: '', reason: 'エラー: ' + e.message});
      }
    }
    threads[i].addLabel(label);
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
  if (reservationExists_(reservation.id)) {
    // ★ キャンセル済み予約の再予約（取り直し）対応
    if (reservationIsCancelled_(reservation.id)) {
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
      Logger.log('Reservation already exists (active): ' + reservation.id);
      return {type:'skip', id:reservation.id, reason:'登録済み'};
    }
  } else {
    // Insert new
    var insertResult = insertReservation_(reservation);
    if (!insertResult) {
      return {type:'failure', id:reservation.id, ota:otaCode, name:reservation.name, reason:'DB登録失敗'};
    }
  }

  // Auto-assign vehicle
  var assigned = autoAssignVehicle_(reservation);
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
  var m = rawClass.match(/[_]([ABCSFH])(?:[_]|$)/i);
  if (m) return m[1].toUpperCase();
  var m2 = rawClass.match(/^([ABCSFH])[_]/i);
  if (m2) return m2[1].toUpperCase();
  var m3 = rawClass.match(/\s([ABCSFH])[_]/i);
  if (m3) return m3[1].toUpperCase();
  var m4 = rawClass.match(/[_]([ABCSFH])$/i);
  if (m4) return m4[1].toUpperCase();
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
  var price = parsePrice_(extractField_(body, '合計金額'));
  var arrFlight = extractField_(body, '到着便');
  var depFlight = extractField_(body, '出発便');
  var flight = [arrFlight, depFlight].filter(Boolean).join(' / ');
  return {
    id: id, ota: 'J', name: nameKana || name,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: price, status: '確定', tel: tel, mail: mail,
    flight: flight, visit_type: '', del_place: '', col_place: '',
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
  return {
    id: id, ota: 'S', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: totalPrice, status: '確定', tel: tel, mail: mail,
    flight: '', visit_type: '', del_place: '', col_place: '',
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
  return {
    id: id, ota: 'O', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: 0, insurance: insurance,
    price: price, status: '確定', tel: tel, mail: mail,
    flight: flight, visit_type: '', del_place: '', col_place: '',
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

  Logger.log('Cancelled reservation: ' + reservationId + ' (fleet=' + fleetOk + ', tasks=' + tasksOk + ')');
  return reservationId;
}

// ============================================================
// Supabase API
// ============================================================
function supabaseHeaders_() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

function supabaseGet_(table, queryParams) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + queryParams;
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
  var url = SUPABASE_URL + '/rest/v1/' + table;
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
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + queryParams;
  var resp = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    headers: supabaseHeaders_(),
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  });
  return resp.getResponseCode() < 400;
}

function supabaseDelete_(table, queryParams) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + queryParams;
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
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(reservationId) + '&select=id,status');
  return rows.length > 0;
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
  MailApp.sendEmail(SLACK_EMAIL, '✅ 札幌店新規予約取込完了通知 ' + items.length + '件', lines.join('\n'));
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
  MailApp.sendEmail(SLACK_EMAIL, '❌ 札幌店新規予約取込失敗通知 ' + items.length + '件', lines.join('\n'));
  Logger.log('Slack failure notification sent: ' + items.length + '件');
}

function sendSlackCancel_(items) {
  var lines = ['🔄 札幌店予約キャンセル処理通知', ''];
  items.forEach(function(r) {
    lines.push('【' + r.ota + '】' + r.id + ' → キャンセル処理完了');
  });
  lines.push('');
  lines.push('合計: ' + items.length + '件');
  MailApp.sendEmail(SLACK_EMAIL, '🔄 札幌店予約キャンセル処理 ' + items.length + '件', lines.join('\n'));
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
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/app_settings', options);
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
      var url = SUPABASE_URL + '/rest/v1/app_settings?key=eq.heartbeat_' + check.key + '&select=value';
      var options = {
        method: 'get',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
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
    MailApp.sendEmail(SLACK_EMAIL, message.split('\n')[0], message);
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
