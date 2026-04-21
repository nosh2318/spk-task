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
  var fromClause = Object.values(OTA_SENDERS).map(function(s) { return 'from:' + s; }).join(' OR ');
  var query = '(' + fromClause + ') newer_than:2d';

  var threads = GmailApp.search(query, 0, 50);
  if (threads.length === 0) {
    Logger.log('No new reservation emails found.');
    return;
  }

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
        continue;
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
        newProcessedIds.push(msgId);
        failures.push({id: '不明', ota: '?', name: '', reason: 'エラー: ' + e.message});
      }
    }
    threads[i].addLabel(label);
  }

  if (newProcessedIds.length > 0) {
    saveProcessedMsgIds_(processedIds, newProcessedIds);
  }

  if (successes.length > 0) sendSlackSuccess_(successes);
  if (failures.length > 0) sendSlackFailure_(failures);
  if (cancellations.length > 0) sendSlackCancel_(cancellations);

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

  var isCancellation = CANCEL_KEYWORDS.some(function(kw) { return subject.indexOf(kw) !== -1; });

  if (isCancellation) {
    var tmpId = (ota === 'rakuten')
      ? (extractField_(body, '・予約番号') || extractField_(body, '予約番号'))
      : (extractField_(body, '予約番号') || extractField_(body, '予約ID'));
    if (tmpId && !reservationExists_(tmpId)) {
      Logger.log('Skipping cancel (not in SPK DB): ' + tmpId);
      return {type:'skip', id:tmpId, reason:'DB未登録(沖縄)'};
    }
    if (tmpId && reservationIsCancelled_(tmpId)) {
      Logger.log('Already cancelled: ' + tmpId);
      return {type:'skip', id:tmpId, reason:'キャンセル済み'};
    }
    var cancelId = handleCancellation_(ota, body, dryRun);
    return cancelId ? {type:'cancel', id:cancelId, ota:otaCode} : null;
  }

  var normalizedSubject = subject.replace(/[\s\u3000]+/g, ' ').trim();
  var normalizedExpected = OTA_RESERVE_SUBJECTS[ota].replace(/[\s\u3000]+/g, ' ').trim();
  if (normalizedSubject.indexOf(normalizedExpected) === -1) {
    var noSpaceSubject = subject.replace(/[\s\u3000]+/g, '');
    var noSpaceExpected = OTA_RESERVE_SUBJECTS[ota].replace(/[\s\u3000]+/g, '');
    if (noSpaceSubject.indexOf(noSpaceExpected) === -1) {
      Logger.log('Skipping non-reservation email (' + ota + '): ' + subject);
      return null;
    }
  }

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

  var existingRow = reservationExists_(reservation.id);
  if (existingRow) {
    var existSt = existingRow.status || '';
    var isCancelled = existSt === 'cancelled' || existSt === 'キャンセル';
    if (isCancelled) {
      Logger.log('Re-booking cancelled reservation: ' + reservation.id);
      deleteFromFleet_(reservation.id);
      deleteFromTasks_(reservation.id);
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
      var patch = {};
      if (+(reservation.opt_b||0) > +(existingRow.opt_b||0)) patch.opt_b = reservation.opt_b;
      if (+(reservation.opt_c||0) > +(existingRow.opt_c||0)) patch.opt_c = reservation.opt_c;
      if (+(reservation.opt_j||0) > +(existingRow.opt_j||0)) patch.opt_j = reservation.opt_j;
      if (!existingRow.tel && reservation.tel) patch.tel = reservation.tel;
      if (!existingRow.mail && reservation.mail) patch.mail = reservation.mail;
      if (!existingRow.flight && reservation.flight) patch.flight = reservation.flight;
      if (!existingRow.people && +(reservation.people||0) > 0) patch.people = reservation.people;
      if (!existingRow.price && +(reservation.price||0) > 0) patch.price = reservation.price;
      // 料金内訳: 既存が0でパーサーに値があれば常に上書き（那覇店障害 2026-04-20 再発防止）
      if (+(existingRow.base_price||0) === 0 && +(reservation.base_price||0) > 0) patch.base_price = reservation.base_price;
      if (+(existingRow.option_price||0) === 0 && +(reservation.option_price||0) > 0) patch.option_price = reservation.option_price;
      if (+(existingRow.discount||0) === 0 && +(reservation.discount||0) > 0) patch.discount = reservation.discount;
      if ((!existingRow.insurance || existingRow.insurance === 'なし') && reservation.insurance && reservation.insurance !== 'なし') patch.insurance = reservation.insurance;
      if (!existingRow.del_place && reservation.del_place) patch.del_place = reservation.del_place;
      if (!existingRow.col_place && reservation.col_place) patch.col_place = reservation.col_place;
      if (!existingRow.visit_type && reservation.visit_type) patch.visit_type = reservation.visit_type;
      if (!existingRow.return_type && reservation.return_type) patch.return_type = reservation.return_type;
      if (Object.keys(patch).length > 0) {
        supabaseUpdate_('reservations', 'id=eq.' + encodeURIComponent(reservation.id), patch);
        Logger.log('Patched existing reservation: ' + reservation.id + ' fields=' + Object.keys(patch).join(','));
        if (patch.del_place || patch.col_place) {
          patchTaskPlaces_(reservation.id, patch.del_place, patch.col_place);
        }
      } else {
        Logger.log('Reservation already exists (active, no patch needed): ' + reservation.id);
      }
      return {type:'skip', id:reservation.id, reason:'登録済み'};
    }
  } else {
    var insertResult = insertReservation_(reservation);
    if (!insertResult) {
      var recheck = reservationExists_(reservation.id);
      if (recheck) {
        Logger.log('INSERT failed but reservation exists (race condition): ' + reservation.id);
        return {type:'skip', id:reservation.id, reason:'登録済み（競合）'};
      }
      return {type:'failure', id:reservation.id, ota:otaCode, name:reservation.name, reason:'DB登録失敗'};
    }
  }

  var assigned = autoAssignVehicle_(reservation);

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

  if (/沖縄県|那覇市|沖縄/.test(address)) return false;
  if (/北海道|札幌市/.test(address)) return true;

  if (/那覇|沖縄/.test(store)) return false;
  if (/札幌/.test(store)) return true;

  if (/那覇|沖縄|豊見城|宜野湾|浦添|北谷|読谷|恩納|名護|糸満/.test(places)) return false;
  if (/札幌|千歳|北海道|小樽|旭川|苫小牧|新千歳/.test(places)) return true;

  if (/_OKA/i.test(rawClass) || /_OKI/i.test(rawClass)) return false;
  if (/_SPK/i.test(rawClass)) return true;

  if (res.vehicle === 'D' || res.vehicle === 'A2' || res.vehicle === 'B2') return false;

  var spkOnlyClasses = ['F', 'H'];
  if (res.vehicle && spkOnlyClasses.indexOf(res.vehicle) !== -1) return true;

  Logger.log('WARNING: Store undetermined for ' + (res.id || '?') + ' vehicle=' + (res.vehicle || '') + ' store=' + store + ' address=' + address + ' places=' + places);
  return false;
}

function extractVehicleClass_(rawClass) {
  if (!rawClass) return '';
  if (/[_](B2)(?:[_]|$)/i.test(rawClass)) return 'B2';
  if (/[_](A2)(?:[_]|$)/i.test(rawClass)) return 'A2';
  if (/[_](D)(?:[_]|$)/i.test(rawClass)) return 'D';
  var m = rawClass.match(/[_]([ABCSFH])(?:[_]|$)/i);
  if (m) return m[1].toUpperCase();
  var m2 = rawClass.match(/^([ABCSFH])[_]/i);
  if (m2) return m2[1].toUpperCase();
  var m3 = rawClass.match(/\s([ABCSFH])[_]/i);
  if (m3) return m3[1].toUpperCase();
  var m4 = rawClass.match(/[_]([ABCSFH])$/i);
  if (m4) return m4[1].toUpperCase();
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

function extractDeliveryPlace_(body) {
  var m = body.match(/【お届け場所名】\s*\n\s*(.+)/);
  if (m) return m[1].trim();
  var m2 = body.match(/(?:配達先|お届け先|受取場所|ピックアップ場所)[：:\s]*\n?\s*(.+)/);
  if (m2) return m2[1].trim();
  return '';
}

function extractCollectionPlace_(body) {
  var m = body.match(/【回収場所名】\s*\n\s*(.+)/);
  if (m) return m[1].trim();
  var m2 = body.match(/(?:返却先|回収場所|ドロップオフ場所)[：:\s]*\n?\s*(.+)/);
  if (m2) return m2[1].trim();
  return '';
}

function detectInsurance_(text) {
  if (!text) return 'なし';
  if (/フルカバー|フル補償|安心フル|あんしんフル/i.test(text)) return 'フル';
  if (/安心パック|NOC|ノンオペレーション|ノンオペ/i.test(text)) {
    if (/NOC[補償]*[：:\s]*(なし|未加入|無し|加入しない)/i.test(text)) {
      // NOC未加入 — 免責のみかどうかを再チェック
    } else {
      return 'NOC';
    }
  }
  if (/レンタカー安心パック[：:\s]*あり/i.test(text)) return 'NOC';
  if (/免責補償制度\(CDW\)[：:\s]*あり/i.test(text)) return '免責';
  if (/免責補償[：:\s]*あり|免責補償制度[：:\s]*あり|免責[：:\s]*加入|免責補償料/i.test(text)) return '免責';
  if (/免責/.test(text) && !/免責[：:\s]*(なし|未加入|無し|加入しない|0円)/i.test(text)) return '免責';
  return 'なし';
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
  var insurance = detectInsurance_(insuranceStr);
  var peopleStr = extractField_(body, '乗車人数');
  var people = 0;
  var pM = peopleStr.match(/大人\s*(\d+)/);
  if (pM) people += parseInt(pM[1], 10);
  var cM = peopleStr.match(/子供.*?(\d+)/);
  if (cM) people += parseInt(cM[1], 10);
  if (people > 10) { Logger.log('WARNING: people=' + people + ' は異常値。raw=' + peopleStr); people = 0; }
  var basePriceJ = parsePrice_(extractField_(body, '基本料金合計'));
  var optionPriceJ = parsePrice_(extractField_(body, 'オプション料金'));
  var insurancePriceJ = parsePrice_(extractField_(body, '補償（任意加入）料金'));
  var dropOffFeeJ = parsePrice_(extractField_(body, '乗捨料金'));
  var nightFeeJ = parsePrice_(extractField_(body, '深夜手数料'));
  var couponJ = parsePrice_(extractField_(body, '利用クーポン'));
  var pointStrJ = extractField_(body, '利用ポイント');
  var pointJ = 0;
  var pointMatchJ = (pointStrJ || '').match(/(\d[\d,]*)/);
  if (pointMatchJ) pointJ = parsePrice_(pointMatchJ[1]);
  var discountJ = couponJ + pointJ;
  var base_price_j = basePriceJ;
  var option_price_j = optionPriceJ + insurancePriceJ + dropOffFeeJ + nightFeeJ;
  var billingPrice = parsePrice_(extractField_(body, '利用者への請求額'));
  var price = billingPrice > 0 ? billingPrice : parsePrice_(extractField_(body, '合計金額'));
  var arrFlight = extractField_(body, '到着便');
  var depFlight = extractField_(body, '出発便');
  var flight = [arrFlight, depFlight].filter(Boolean).join(' / ');
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
  var bAll = body.match(/ベビーシート[^\d\n]*(\d+)/g);
  var cAll = body.match(/チャイルドシート[^\d\n]*(\d+)/g);
  var jAll = body.match(/ジュニアシート[^\d\n]*(\d+)/g);
  if (bAll) { for (var bi=0;bi<bAll.length;bi++) { var bn=bAll[bi].match(/(\d+)/); if(bn) optB=Math.max(optB,parseInt(bn[1],10));} }
  if (cAll) { for (var ci=0;ci<cAll.length;ci++) { var cn=cAll[ci].match(/(\d+)/); if(cn) optC=Math.max(optC,parseInt(cn[1],10));} }
  if (jAll) { for (var ji=0;ji<jAll.length;ji++) { var jn=jAll[ji].match(/(\d+)/); if(jn) optJ=Math.max(optJ,parseInt(jn[1],10));} }
  var retStore = extractField_(body, '返却営業所');
  var delPlace = extractDeliveryPlace_(body) || store || '';
  var colPlace = extractCollectionPlace_(body) || retStore || '';
  var visitType = delPlace ? 'DEL' : '';
  var returnType = colPlace ? 'COL' : '';
  return {
    id: id, ota: 'J', name: nameKana || name,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: price, base_price: base_price_j, option_price: option_price_j, discount: discountJ,
    status: '確定', tel: tel, mail: mail,
    flight: flight, visit_type: visitType, del_place: delPlace, col_place: colPlace,
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
  var insurance = detectInsurance_(optionsStr);
  var basePriceR = parsePrice_(extractField_(body, '・基本料金'));
  if (!basePriceR) basePriceR = parsePrice_(extractField_(body, '基本料金'));
  var insurancePriceR = parsePrice_(extractField_(body, '・免責補償料金'));
  if (!insurancePriceR) insurancePriceR = parsePrice_(extractField_(body, '免責補償料金'));
  var optionPriceR = parsePrice_(extractField_(body, '・オプション料金'));
  if (!optionPriceR) optionPriceR = parsePrice_(extractField_(body, 'オプション料金'));
  // ★ クーポン割引（レンタカー事業者クーポン）
  var couponR = parsePrice_(extractField_(body, '（レンタカー事業者クーポン利用）'));
  var discountR = couponR;
  // ★ 差引支払金額（クーポン差引後）を優先。なければ合計金額
  var billingR = parsePrice_(extractField_(body, '（差引支払金額）'));
  var price = billingR > 0 ? billingR : parsePrice_(extractField_(body, '（合計）'));
  var base_price_r = basePriceR;
  var option_price_r = insurancePriceR + optionPriceR;
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = optionsStr.match(/ベビーシート\s*(\d*)/);
  if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = optionsStr.match(/チャイルドシート\s*(\d*)/);
  if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = optionsStr.match(/ジュニアシート\s*(\d*)/);
  if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  var retStore = extractField_(body, '・返却営業所名') || extractField_(body, '□返却営業所名');
  var delPlace = extractDeliveryPlace_(body) || store || '';
  var colPlace = extractCollectionPlace_(body) || retStore || '';
  var visitType = delPlace ? 'DEL' : '';
  var returnType = colPlace ? 'COL' : '';
  return {
    id: id, ota: 'R', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: 0, insurance: insurance,
    price: price, base_price: base_price_r, option_price: option_price_r, discount: discountR,
    status: '確定', tel: '', mail: '',
    flight: '', visit_type: visitType, del_place: delPlace, col_place: colPlace,
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
  if (people > 10) { Logger.log('WARNING: people=' + people + ' は異常値。raw=' + peopleStr); people = 0; }
  var totalPrice = parsePrice_(extractField_(body, '合計料金'));
  var insurancePriceStr = extractField_(body, '免責補償料金');
  var insurancePrice = parsePrice_(insurancePriceStr);
  var insurance = detectInsurance_(body);
  if (insurance === 'なし' && insurancePrice > 0) insurance = '免責';
  var basePriceS = parsePrice_(extractField_(body, '基本料金'));
  var optionPriceS = parsePrice_(extractField_(body, 'オプション料金'));
  var base_price_s = basePriceS;
  var option_price_s = insurancePrice + optionPriceS;
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = body.match(/ベビーシート[^\d]*(\d*)/); if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = body.match(/チャイルドシート[^\d]*(\d*)/); if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = body.match(/ジュニアシート[^\d]*(\d*)/); if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  var retStore = extractField_(body, '返却店舗');
  var delPlace = extractDeliveryPlace_(body) || store || '';
  var colPlace = extractCollectionPlace_(body) || retStore || '';
  var visitType = delPlace ? 'DEL' : '';
  var returnType = colPlace ? 'COL' : '';
  return {
    id: id, ota: 'S', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: totalPrice, base_price: base_price_s, option_price: option_price_s, discount: 0,
    status: '確定', tel: tel, mail: mail,
    flight: '', visit_type: visitType, del_place: delPlace, col_place: colPlace,
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
  var basePriceA = parsePrice_(extractField_(body, '基本料金'));
  if (!basePriceA) basePriceA = parsePrice_(extractField_(body, 'レンタカー料金'));
  var optionPriceA = parsePrice_(extractField_(body, 'オプション料金'));
  var insurancePriceA = parsePrice_(extractField_(body, '補償料金'));
  if (!insurancePriceA) insurancePriceA = parsePrice_(extractField_(body, '免責補償料金'));
  var base_price_a = basePriceA;
  var option_price_a = optionPriceA + insurancePriceA;
  var insuranceStr = extractField_(body, '補償オプション');
  var insurance = detectInsurance_(insuranceStr || body);
  var arrFlight = extractField_(body, '到着便');
  var depFlight = extractField_(body, '出発便');
  var flight = [arrFlight, depFlight].filter(Boolean).join(' / ');
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = body.match(/ベビーシート[^\d]*(\d*)/); if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = body.match(/チャイルドシート[^\d]*(\d*)/); if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = body.match(/ジュニアシート[^\d]*(\d*)/); if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  var retStore = extractField_(body, '返却営業所');
  var delPlace = extractDeliveryPlace_(body) || store || '';
  var colPlace = extractCollectionPlace_(body) || retStore || '';
  var visitType = delPlace ? 'DEL' : '';
  var returnType = colPlace ? 'COL' : '';
  return {
    id: id, ota: 'O', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: 0, insurance: insurance,
    price: price, base_price: base_price_a, option_price: option_price_a, discount: 0,
    status: '確定', tel: tel, mail: mail,
    flight: flight, visit_type: visitType, del_place: delPlace, col_place: colPlace,
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
  if (people > 10) { Logger.log('WARNING: people=' + people + ' は異常値'); people = 0; }
  var rawClassLine = '';
  var rawClassMatch = body.match(/ご予約車両クラス\s*\n\s*(.+)/);
  if (rawClassMatch) rawClassLine = rawClassMatch[1].trim();
  var vehicleClass = '';
  var MODEL_CLASS_MAP = [
    {re:/アルファード/,cls:'A'},{re:/ヴェルファイア|ベルファイア/,cls:'A'},
    {re:/ノア/,cls:'B'},{re:/デリカ/,cls:'B'},{re:/ステップワゴン/,cls:'B'},
    {re:/ロッキー/,cls:'C'},{re:/CX-?3/i,cls:'C'},
    {re:/ハリアー/,cls:'S'},{re:/CX-?5/i,cls:'S'},
    {re:/ルーミー/,cls:'F'},{re:/ソリオ/,cls:'F'},{re:/ヴィッツ/,cls:'F'},{re:/パッソ/,cls:'F'},{re:/マーチ/,cls:'F'},
    {re:/カローラ/,cls:'H'},{re:/アクセラ/,cls:'H'},{re:/プリウス(?!α)/,cls:'H'},{re:/インプレッサ/,cls:'H'}
  ];
  for (var mi = 0; mi < MODEL_CLASS_MAP.length; mi++) {
    if (MODEL_CLASS_MAP[mi].re.test(rawClassLine)) {
      vehicleClass = MODEL_CLASS_MAP[mi].cls;
      Logger.log('[Official] Tier1 model match: "' + rawClassLine + '" → ' + vehicleClass);
      break;
    }
  }
  if (!vehicleClass) {
    var classMatch = body.match(/ご予約車両クラス\s*\n\s*([ABCSFH])クラス/i);
    if (classMatch) vehicleClass = classMatch[1].toUpperCase();
  }
  if (!vehicleClass) Logger.log('[Official] WARNING: クラス判定不能。raw=' + rawClassLine);
  var insurance = detectInsurance_(body);
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
  var hpStore = '';
  var storeMatch = body.match(/【(?:ご利用|利用)?店舗[名]?】\s*\n?\s*(.+)/);
  if (storeMatch) {
    hpStore = storeMatch[1].trim();
  } else {
    if (/那覇店|沖縄店|那覇空港/.test(body)) hpStore = '那覇';
    else if (/札幌店|札幌デリバリー/.test(body)) hpStore = '札幌';
    if (!hpStore && /沖縄県|那覇市/.test(address + delPlace + colPlace)) hpStore = '那覇';
    if (!hpStore && /北海道|札幌市/.test(address + delPlace + colPlace)) hpStore = '札幌';
  }
  if (hpStore) Logger.log('[Official] Store detected: ' + hpStore);
  return {
    id: id, ota: 'HP', name: name,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: people, insurance: insurance,
    price: price, base_price: price, option_price: 0, discount: 0,
    status: '確定', tel: tel, mail: mail,
    flight: '', visit_type: '', del_place: delPlace, col_place: colPlace,
    opt_b: optB, opt_c: optC, opt_j: optJ,
    _store: hpStore, _rawClass: vehicleClass, _address: address
  };
}

// ============================================================
// Cancellation Handler
// ============================================================
function handleCancellation_(ota, body, dryRun) {
  var reservationId = '';
  if (ota === 'rakuten') {
    reservationId = extractField_(body, '・予約番号') || extractField_(body, '予約番号');
  } else {
    reservationId = extractField_(body, '予約番号') || extractField_(body, '予約ID');
  }
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
  var fleetOk = deleteFromFleet_(reservationId);
  if (!fleetOk) {
    Logger.log('WARNING: fleet delete failed for ' + reservationId + ', retrying...');
    Utilities.sleep(1000);
    fleetOk = deleteFromFleet_(reservationId);
    if (!fleetOk) Logger.log('ERROR: fleet delete retry failed for ' + reservationId);
  }
  var tasksOk = deleteFromTasks_(reservationId);
  if (!tasksOk) Logger.log('WARNING: tasks delete failed for ' + reservationId);
  var statusOk = supabaseUpdate_('reservations', 'id=eq.' + encodeURIComponent(reservationId), {status: 'cancelled'});
  if (!statusOk) {
    Logger.log('ERROR: reservation status update failed for ' + reservationId);
    return null;
  }
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
  var resp = UrlFetchApp.fetch(url, {method:'GET', headers:supabaseHeaders_(), muteHttpExceptions:true});
  if (resp.getResponseCode() >= 400) {
    Logger.log('Supabase GET error (' + table + '): ' + resp.getContentText());
    return [];
  }
  return JSON.parse(resp.getContentText());
}

function supabasePost_(table, data) {
  var url = getSupabaseUrl_() + '/rest/v1/' + table;
  var resp = UrlFetchApp.fetch(url, {method:'POST', headers:supabaseHeaders_(), payload:JSON.stringify(data), muteHttpExceptions:true});
  if (resp.getResponseCode() >= 400) {
    Logger.log('Supabase POST error (' + table + '): ' + resp.getContentText());
    return null;
  }
  return JSON.parse(resp.getContentText());
}

function supabaseUpdate_(table, queryParams, data) {
  var url = getSupabaseUrl_() + '/rest/v1/' + table + '?' + queryParams;
  var resp = UrlFetchApp.fetch(url, {method:'PATCH', headers:supabaseHeaders_(), payload:JSON.stringify(data), muteHttpExceptions:true});
  return resp.getResponseCode() < 400;
}

function supabaseDelete_(table, queryParams) {
  var url = getSupabaseUrl_() + '/rest/v1/' + table + '?' + queryParams;
  var resp = UrlFetchApp.fetch(url, {method:'DELETE', headers:supabaseHeaders_(), muteHttpExceptions:true});
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
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(reservationId) + '&select=id,status,opt_b,opt_c,opt_j,tel,mail,flight,people,price,base_price,option_price,discount,del_place,col_place,visit_type,return_type,insurance');
  return rows.length > 0 ? rows[0] : null;
}

function patchTaskPlaces_(reservationId, delPlace, colPlace) {
  var encId = encodeURIComponent(reservationId);
  if (delPlace) {
    supabaseUpdate_('tasks', '_id=eq.d-' + encId, {place: delPlace});
    Logger.log('Patched DEL task place: ' + reservationId + ' → ' + delPlace);
  }
  if (colPlace) {
    supabaseUpdate_('tasks', '_id=eq.c-' + encId, {place: colPlace});
    Logger.log('Patched COL task place: ' + reservationId + ' → ' + colPlace);
    supabaseUpdate_('tasks', '_id=eq.d-' + encId, {col_place: colPlace});
  }
  var placePatch = {};
  if (delPlace) placePatch.del_place = delPlace;
  if (colPlace) placePatch.col_place = colPlace;
  if (Object.keys(placePatch).length > 0) {
    supabaseUpdate_('places', 'reservation_id=eq.' + encId, placePatch);
    Logger.log('Patched places table: ' + reservationId);
  }
}

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
    if (keys[i].charAt(0) !== '_') row[keys[i]] = reservation[keys[i]];
  }
  var result = supabasePost_('reservations', row);
  if (result) Logger.log('Inserted reservation: ' + reservation.id);
  return result;
}

function deleteReservation_(reservationId) { return supabaseDelete_('reservations', 'id=eq.' + encodeURIComponent(reservationId)); }
function deleteFromFleet_(reservationId) { return supabaseDelete_('fleet', 'reservation_id=eq.' + encodeURIComponent(reservationId)); }
function deleteFromTasks_(reservationId) { return supabaseDelete_('tasks', 'reservation_id=eq.' + encodeURIComponent(reservationId)); }

// ============================================================
// Vehicle Auto-Assignment
// ============================================================
function autoAssignVehicle_(reservation) {
  var vehicleClass = reservation.vehicle;
  if (!vehicleClass) { Logger.log('No vehicle class for ' + reservation.id + '. Will be 未配車.'); return; }
  var vehicles = supabaseGet_('vehicles', 'type=eq.' + encodeURIComponent(vehicleClass) + '&insurance_veh=eq.false&select=code,name,plate_no,seats');
  if (vehicles.length === 0) { Logger.log('No vehicles of class ' + vehicleClass + '. ' + reservation.id + ' will be 未配車.'); return; }

  // HP車種指定: _vehicleModel が設定されている場合、車種名でフィルタ
  var preferredModel = reservation._vehicleModel || '';
  if (preferredModel) {
    var filtered = [];
    for (var fi = 0; fi < vehicles.length; fi++) {
      if (isModelMatch_(vehicles[fi].name, preferredModel)) filtered.push(vehicles[fi]);
    }
    Logger.log('[AutoAssign] Model filter "' + preferredModel + '": ' + vehicles.length + ' → ' + filtered.length + ' vehicles');
    if (filtered.length === 0) {
      Logger.log('No vehicles matching model "' + preferredModel + '" in class ' + vehicleClass + '. ' + reservation.id + ' will be 未配車.');
      return null;
    }
    vehicles = filtered;
  }

  var lendDate = reservation.lend_date;
  var returnDate = reservation.return_date;
  var busyVehicleCodes = {};
  var overlappingFleet = getOverlappingFleetVehicles_(lendDate, returnDate);
  for (var i = 0; i < overlappingFleet.length; i++) busyVehicleCodes[overlappingFleet[i]] = true;
  var overlappingMaint = getOverlappingMaintenance_(lendDate, returnDate);
  for (var i = 0; i < overlappingMaint.length; i++) busyVehicleCodes[overlappingMaint[i].vehicle_code] = true;
  var assignedVehicle = null;
  for (var i = 0; i < vehicles.length; i++) {
    if (busyVehicleCodes[vehicles[i].code]) continue;
    assignedVehicle = vehicles[i];
    break;
  }
  if (!assignedVehicle) {
    var reason = preferredModel ? vehicleClass + 'クラスの「' + preferredModel + '」' : vehicleClass + 'クラス';
    Logger.log('No available vehicle for ' + reason + ' (' + lendDate + '~' + returnDate + '). ' + reservation.id + ' will be 未配車.');
    return null;
  }
  var result = supabasePost_('fleet', {reservation_id: reservation.id, vehicle_code: assignedVehicle.code});
  if (result) {
    Logger.log('Assigned ' + assignedVehicle.code + ' (' + assignedVehicle.name + ') to ' + reservation.id);
    return assignedVehicle;
  }
  return null;
}

// --- 車種名マッチング（HP車種指定配車用） ---
// 「アルファード」→「アルファード」にマッチ、「アルファードM」にはマッチしない
// 「ノア」→「ノア」にマッチ、「ノアH」にはマッチしない
function isModelMatch_(vehicleName, preferredModel) {
  if (!vehicleName || !preferredModel) return false;
  var vName = vehicleName.replace(/[①②③④⑤⑥⑦⑧⑨⑩\d]+$/, '').trim();
  if (vName === preferredModel) return true;
  // 表記ゆれ許容（ハイフン・中黒・全角スペース等を除去して比較）
  // 例: "CX5" ↔ "CX-5", "マツダ3" ↔ "MAZDA3"（大文字化後）
  var norm = function(s) { return String(s).toUpperCase().replace(/[\s\-ー－・]/g, ''); };
  return norm(vName) === norm(preferredModel);
}

function getOverlappingFleetVehicles_(lendDate, returnDate) {
  var allFleet = supabaseGet_('fleet', 'select=vehicle_code,reservation_id,reservations(lend_date,return_date,status)');
  var busyCodes = [];
  for (var i = 0; i < allFleet.length; i++) {
    var f = allFleet[i];
    if (!f.reservations) continue;
    var r = f.reservations;
    var st = r.status || '';
    if (st === 'cancelled' || st === 'キャンセル') {
      Logger.log('Skipping cancelled fleet: ' + f.reservation_id + ' → ' + f.vehicle_code);
      continue;
    }
    if (r.lend_date <= returnDate && r.return_date >= lendDate) busyCodes.push(f.vehicle_code);
  }
  return busyCodes;
}

function getOverlappingMaintenance_(lendDate, returnDate) {
  return supabaseGet_('maintenance', 'start_date=lte.' + encodeURIComponent(returnDate) + '&end_date=gte.' + encodeURIComponent(lendDate) + '&select=vehicle_code');
}

// ============================================================
// Slack Notifications
// ============================================================
var SPK_RESV_CHANNEL = 'C08TDTPEB36';  // #sapporo_reservation

function sendSlackToSpk_(subject, body) {
  var posted = postToSlackChannel_(SPK_RESV_CHANNEL, body);
  if (!posted) {
    try { MailApp.sendEmail(getSlackEmail_(), subject, body); Logger.log('[Slack] Fallback email sent: ' + subject); }
    catch (e) { Logger.log('[Slack] Both bot API and email failed: ' + e.message); }
  }
}

function sendSlackSuccess_(items) {
  var lines = ['✅ 札幌店新規予約取込完了通知', ''];
  items.forEach(function(r) {
    lines.push('【' + r.ota + '】' + r.id);
    lines.push('  ' + r.name + ' / ' + r.dates + ' / ' + r.vehicle + 'クラス');
    lines.push('  → 配車: ' + r.assignedTo);
    lines.push('');
  });
  lines.push('合計: ' + items.length + '件');
  sendSlackToSpk_('✅ 札幌店新規予約取込完了通知 ' + items.length + '件', lines.join('\n'));
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
  sendSlackToSpk_('❌ 札幌店新規予約取込失敗通知 ' + items.length + '件', lines.join('\n'));
}

function sendSlackCancel_(items) {
  var lines = ['🔄 札幌店予約キャンセル処理通知', ''];
  items.forEach(function(r) { lines.push('【' + r.ota + '】' + r.id + ' → キャンセル処理完了'); });
  lines.push(''); lines.push('合計: ' + items.length + '件');
  sendSlackToSpk_('🔄 札幌店予約キャンセル処理 ' + items.length + '件', lines.join('\n'));
}

// ============================================================
// Heartbeat & Monitoring
// ============================================================
function updateHeartbeat_(key, stats) {
  try {
    var payload = {
      key: 'heartbeat_' + key,
      value: JSON.stringify({last_run: new Date().toISOString(), status: (stats.failure||0)>0?'warning':'ok', processed:(stats.success||0)+(stats.cancel||0)+(stats.skip||0), errors:stats.failure||0, details:stats})
    };
    UrlFetchApp.fetch(getSupabaseUrl_() + '/rest/v1/app_settings', {
      method:'post', headers:{'apikey':getSupabaseKey_(),'Authorization':'Bearer '+getSupabaseKey_(),'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      payload:JSON.stringify(payload), muteHttpExceptions:true
    });
    Logger.log('[Heartbeat] Updated: ' + key);
  } catch (e) { Logger.log('[Heartbeat] Error: ' + e.message); }
}

function checkHeartbeats() {
  var checks = [{key:'spk_gas_email', label:'札幌GAS予約取込', thresholdMin:30}];
  checks.forEach(function(check) {
    try {
      var res = UrlFetchApp.fetch(getSupabaseUrl_()+'/rest/v1/app_settings?key=eq.heartbeat_'+check.key+'&select=value', {method:'get', headers:{'apikey':getSupabaseKey_(),'Authorization':'Bearer '+getSupabaseKey_()}, muteHttpExceptions:true});
      var data = JSON.parse(res.getContentText());
      var props = PropertiesService.getScriptProperties();
      if (!data || data.length === 0) {
        var initKey = 'alert_init_' + check.key;
        if (!props.getProperty(initKey)) { sendSlackAlert_('⚠️ ' + check.label + ': ハートビート未登録（初回実行待ち）'); props.setProperty(initKey, 'true'); }
        return;
      }
      var hb = JSON.parse(data[0].value);
      var lastRun = new Date(hb.last_run);
      var diffMin = Math.round((new Date() - lastRun) / 60000);
      var alertKey = 'alert_sent_' + check.key;
      var alertSent = props.getProperty(alertKey);
      if (diffMin > check.thresholdMin) {
        if (!alertSent) {
          sendSlackAlert_('🚨 ' + check.label + ' が' + diffMin + '分間停止中\n最終実行: ' + Utilities.formatDate(lastRun,'Asia/Tokyo','MM/dd HH:mm') + '\n処理数: ' + (hb.processed||0) + '件 / エラー: ' + (hb.errors||0) + '件');
          props.setProperty(alertKey, 'true');
        }
      } else {
        if (alertSent) { sendSlackAlert_('✅ ' + check.label + ' 復旧しました（停止' + diffMin + '分）'); props.deleteProperty(alertKey); }
      }
    } catch (e) { Logger.log('[checkHeartbeats] Error for ' + check.key + ': ' + e.message); }
  });
}

function sendSlackAlert_(message) {
  try { MailApp.sendEmail(getSlackEmail_(), message.split('\n')[0], message); }
  catch (e) { Logger.log('[Alert] Send error: ' + e.message); }
}

function setupMonitoring() {
  ScriptApp.getProjectTriggers().forEach(function(t) { if (t.getHandlerFunction()==='checkHeartbeats') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkHeartbeats').timeBased().everyMinutes(30).create();
  Logger.log('Monitoring setup complete.');
}


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

function updateSheetOtaColumn() {
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('支払い管理');
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  if (sheet.getRange(1,14).getValue() !== '媒体') sheet.getRange(1,14).setValue('媒体');
  var resIds = sheet.getRange(2, 4, lastRow-1, 1).getValues();
  var otaCol = sheet.getRange(2, 14, lastRow-1, 1).getValues();
  var otaMap = {J:'じゃらん', R:'楽天', S:'skyticket', O:'エアトリ', HP:'HP直'};
  for (var i = 0; i < resIds.length; i++) {
    if (otaCol[i][0]) continue;
    var rid = String(resIds[i][0]).trim();
    if (!rid) continue;
    var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(rid) + '&select=ota');
    if (rows && rows.length > 0 && rows[0].ota) { sheet.getRange(i+2, 14).setValue(otaMap[rows[0].ota] || rows[0].ota); }
  }
}

function setupJalanPaymentTriggers() {
  var funcs = ['checkSquareLinks','checkPaymentStatus','checkUnpaidAlert','updateSheetOtaColumn'];
  ScriptApp.getProjectTriggers().forEach(function(t) { if (funcs.indexOf(t.getHandlerFunction())!==-1) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkSquareLinks').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('checkPaymentStatus').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('checkUnpaidAlert').timeBased().atHour(9).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger('updateSheetOtaColumn').timeBased().atHour(9).nearMinute(30).everyDays(1).create();
  Logger.log('Jalan payment triggers setup complete.');
}

// ============================================================
// Processed Message ID Management
// ============================================================
var PROCESSED_IDS_KEY = 'PROCESSED_MSG_IDS';
var MAX_PROCESSED_IDS = 500;

function getProcessedMsgIds_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROCESSED_IDS_KEY) || '';
  var map = {};
  if (raw) { raw.split(',').forEach(function(id) { if (id) map[id] = true; }); }
  return map;
}

function saveProcessedMsgIds_(existingMap, newIds) {
  newIds.forEach(function(id) { existingMap[id] = true; });
  var allIds = Object.keys(existingMap);
  if (allIds.length > MAX_PROCESSED_IDS) allIds = allIds.slice(allIds.length - MAX_PROCESSED_IDS);
  PropertiesService.getScriptProperties().setProperty(PROCESSED_IDS_KEY, allIds.join(','));
}

// ============================================================
// Gmail Helpers
// ============================================================
function getOrCreateLabel_(labelName) {
  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) { label = GmailApp.createLabel(labelName); Logger.log('Created Gmail label: ' + labelName); }
  return label;
}

// ============================================================
// Slack → 予約登録 & 自動配車（札幌店）
// ============================================================

var SLACK_CHANNEL_RESV_ID = 'C08TDTPEB36';  // #sapporo_reservation（通知と共用）
var SLACK_RESV_MARKER = '【新規予約】';
var PROCESSED_SLACK_KEY = 'spk_processed_slack_ts';

// --- Slack API 読み取り（conversations.history 用） ---
function slackGet_(endpoint, params) {
  var token = getSlackBotToken_();
  if (!token) { Logger.log('[SlackGet] SLACK_BOT_TOKEN not set'); return null; }
  var qs = '';
  if (params) {
    var parts = [];
    for (var k in params) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    qs = '?' + parts.join('&');
  }
  var resp = UrlFetchApp.fetch('https://slack.com/api/' + endpoint + qs, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  return JSON.parse(resp.getContentText());
}

// --- スレッド返信 ---
function replySlackThread_(channelId, threadTs, text) {
  var token = getSlackBotToken_();
  if (!token) { Logger.log('[SlackReply] SLACK_BOT_TOKEN not set'); return null; }
  var resp = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' },
    payload: JSON.stringify({ channel: channelId, thread_ts: threadTs, text: text }),
    muteHttpExceptions: true
  });
  return JSON.parse(resp.getContentText());
}

// --- 処理済みts管理 ---
function getProcessedSlackTs_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROCESSED_SLACK_KEY) || '{}';
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

function saveProcessedSlackTs_(tsMap) {
  var cutoff = (Date.now() / 1000) - 3 * 86400;
  var clean = {};
  for (var ts in tsMap) {
    if (Number(ts) > cutoff) clean[ts] = tsMap[ts];
  }
  PropertiesService.getScriptProperties().setProperty(PROCESSED_SLACK_KEY, JSON.stringify(clean));
}

// --- 予約番号自動採番 SP-YYYYMMDD-NNNN ---
function generateSlackReservationId_() {
  var now = new Date();
  var ds = now.getFullYear() + padZero_(now.getMonth() + 1) + padZero_(now.getDate());
  var prefix = 'SP-' + ds + '-';
  var existing = supabaseGet_('reservations', 'id=like.' + encodeURIComponent(prefix + '%') + '&select=id');
  var maxN = 0;
  for (var i = 0; i < existing.length; i++) {
    var n = parseInt(existing[i].id.replace(prefix, ''), 10);
    if (!isNaN(n) && n > maxN) maxN = n;
  }
  return prefix + ('0000' + (maxN + 1)).slice(-4);
}

// --- 車種名→クラス自動判定テーブル（札幌6クラス） ---
var SPK_MODEL_TO_CLASS = {
  // A: アルファード/ヴェルファイア
  'アルファード':'A','ヴェルファイア':'A','ベルファイア':'A','VELLFIRE':'A','ALPHARD':'A',
  // B: ノア/デリカD5
  'ノア':'B','NOAH':'B','デリカ':'B','デリカD5':'B','DELICA':'B',
  // C: ロッキー/CX-3
  'ロッキー':'C','ROCKY':'C','CX-3':'C','CX3':'C',
  // S: ハリアー/CX-5
  'ハリアー':'S','HARRIER':'S','CX-5':'S','CX5':'S',
  // F: ルーミー/ソリオ
  'ルーミー':'F','ROOMY':'F','ソリオ':'F','SOLIO':'F',
  // H: カローラ/アクセラ
  'カローラ':'H','COROLLA':'H','アクセラ':'H','AXELA':'H','MAZDA3':'H','マツダ3':'H'
};

function modelToClass_(s) {
  if (!s) return '';
  var u = String(s).toUpperCase().replace(/[\s\-ー－]/g, '');
  for (var key in SPK_MODEL_TO_CLASS) {
    var ku = key.toUpperCase().replace(/[\s\-ー－]/g, '');
    if (u.indexOf(ku) >= 0) return SPK_MODEL_TO_CLASS[key];
  }
  return '';
}

// --- Slackメッセージパーサー ---
function parseSlackReservation_(text) {
  var errors = [];
  var lines = text.split('\n');

  function getVal() {
    // 複数ラベルのどれかにマッチしたら返す（タイポ許容）
    for (var a = 0; a < arguments.length; a++) {
      var label = arguments[a];
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(new RegExp(label + '[：:]\\s*(.+)'));
        if (m) return m[1].trim();
      }
    }
    return '';
  }

  var name = getVal('名前', 'お名前', '氏名');
  var route = getVal('経路', 'OTA', 'ルート') || 'SP';
  var clsRaw = getVal('クラス', '車両クラス');
  var model = getVal('車種', '車両', 'モデル');
  var lendRaw = getVal('貸出', '貸出日時', '出発', 'ピックアップ');
  var returnRaw = getVal('返却', '返却日時', '回収日時', 'ドロップ');
  var delPlace = getVal('届先', '屋先', '配達先', 'お届け先', '受取場所', 'デリバリー');
  var colPlace = getVal('回収', '回収先', '返却先', '返却場所');
  var priceRaw = getVal('料金', '合計', '金額', '総額');
  var insRaw = getVal('補償', '保険');
  var flight = getVal('便名', 'フライト', '到着便');
  var tel = getVal('TEL', '電話', '電話番号', 'Tel', 'tel');
  var basePriceRaw = getVal('基本料金');
  var optionPriceRaw = getVal('オプション料金', 'オプション');
  var discountRaw = getVal('割引', 'クーポン');

  // 必須チェック
  if (!name) errors.push('名前が未入力です');
  if (!lendRaw) errors.push('貸出日時が未入力です（例: 貸出: 2026-04-25 09:00）');
  if (!returnRaw) errors.push('返却日時が未入力です（例: 返却: 2026-04-28 18:00）');

  // ★ クラス判定: クラス欄に車種名が入っていても自動でクラスに変換
  var validClasses = ['A', 'B', 'C', 'S', 'F', 'H'];
  var cls = '';
  if (clsRaw) {
    var u = clsRaw.toUpperCase().trim();
    if (validClasses.indexOf(u) >= 0) {
      cls = u;
    } else {
      // 車種名扱いで自動判定（例: CX5→S, アルファード→A）
      var detected = modelToClass_(clsRaw);
      if (detected) {
        cls = detected;
        if (!model) model = clsRaw; // 車種未指定なら自動補完
      } else {
        errors.push('クラス「' + clsRaw + '」は無効です。' + validClasses.join('/') + ' から選ぶか、車種名（アルファード/CX-5/ノア等）を指定してください');
      }
    }
  } else {
    // クラス未指定でも車種から判定できればOK
    if (model) {
      var detected2 = modelToClass_(model);
      if (detected2) cls = detected2;
      else errors.push('クラスが未入力です（A/B/C/S/F/H）。もしくは車種名から自動判定できません');
    } else {
      errors.push('クラスが未入力です（A/B/C/S/F/H）');
    }
  }

  // 経路バリデーション
  var validRoutes = ['SP', 'HP', 'J', 'R', 'S', 'O', 'RC'];
  route = route.toUpperCase();
  if (validRoutes.indexOf(route) === -1) {
    errors.push('経路「' + route + '」は無効です。' + validRoutes.join('/') + ' から選んでください');
    route = 'SP';
  }

  // HP予約で車種未指定
  if (route === 'HP' && !model) {
    errors.push('HP（オフィシャル）予約は車種指定が必須です（例: 車種: アルファード）');
  }

  // 日時パース
  function parseDateTime(raw) {
    if (!raw) return { date: '', time: '' };
    raw = raw.replace(/\//g, '-').trim();
    var m = raw.match(/(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}:\d{2})/);
    if (m) {
      var parts = m[1].split('-');
      return { date: parts[0] + '-' + padZero_(parts[1]) + '-' + padZero_(parts[2]), time: padZero_(m[2].split(':')[0]) + ':' + m[2].split(':')[1] };
    }
    m = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}:\d{2})/);
    if (m) {
      var yr = new Date().getFullYear();
      return { date: yr + '-' + padZero_(m[1]) + '-' + padZero_(m[2]), time: padZero_(m[3].split(':')[0]) + ':' + m[3].split(':')[1] };
    }
    return { date: '', time: '' };
  }

  var lend = parseDateTime(lendRaw);
  var ret = parseDateTime(returnRaw);
  if (lendRaw && !lend.date) errors.push('貸出日時の形式が不正です（例: 2026-04-25 09:00）');
  if (returnRaw && !ret.date) errors.push('返却日時の形式が不正です（例: 2026-04-28 18:00）');
  if (lend.date && ret.date && lend.date > ret.date) errors.push('返却日が貸出日より前です');

  // 料金パース
  var price = parsePrice_(priceRaw);
  var basePrice = parsePrice_(basePriceRaw);
  var optionPrice = parsePrice_(optionPriceRaw);
  var discount = parsePrice_(discountRaw);
  if (price > 0 && basePrice === 0 && optionPrice === 0) basePrice = price;

  // 補償
  var insurance = 'なし';
  if (insRaw) {
    var insLower = insRaw.toLowerCase();
    if (insLower.indexOf('フル') >= 0) insurance = 'フル';
    else if (insLower.indexOf('安心') >= 0) insurance = '安心パック';
    else if (insLower.indexOf('noc') >= 0) insurance = 'NOC';
    else if (insLower.indexOf('免責') >= 0 || insLower.indexOf('cdw') >= 0) insurance = '免責';
    else insurance = insRaw;
  }

  // 訪問タイプ判定
  var visitType = '';
  var returnType = '';
  if (delPlace && !/来店|店舗|店頭|ヤード|営業所/.test(delPlace)) visitType = 'DEL';
  if (colPlace && !/来店|店舗|店頭|ヤード|営業所/.test(colPlace)) returnType = 'COL';

  var reservation = {
    id: '',
    ota: route,
    name: cleanName_(name),
    lend_date: lend.date,
    lend_time: lend.time,
    return_date: ret.date,
    return_time: ret.time,
    vehicle: cls,
    people: 0,
    insurance: insurance,
    price: price || (basePrice + optionPrice - discount),
    base_price: basePrice,
    option_price: optionPrice,
    discount: discount,
    tel: cleanPhone_(tel),
    mail: '',
    flight: flight,
    del_place: delPlace,
    col_place: colPlace,
    visit_type: visitType,
    return_type: returnType,
    opt_c: 0, opt_j: 0, opt_b: 0,
    _store: '札幌',
    _vehicleModel: model,
    _booked_at: new Date().toISOString()
  };

  return { reservation: reservation, errors: errors };
}

// --- メインエントリーポイント（5分間隔トリガー） ---
function processSlackReservations() {
  var token = getSlackBotToken_();
  if (!token) {
    Logger.log('[SlackResv] SLACK_BOT_TOKEN not set. Skipping.');
    return;
  }

  var processed = getProcessedSlackTs_();
  var processedKeys = Object.keys(processed);

  var oldest = '0';
  if (processedKeys.length > 0) {
    oldest = processedKeys.sort().pop();
  } else {
    oldest = String((Date.now() / 1000) - 86400);
  }

  var result = slackGet_('conversations.history', {
    channel: SLACK_CHANNEL_RESV_ID,
    oldest: oldest,
    limit: '50'
  });

  if (!result || !result.ok) {
    Logger.log('[SlackResv] Slack API error: ' + JSON.stringify(result));
    return;
  }

  var messages = result.messages || [];
  Logger.log('[SlackResv] Fetched ' + messages.length + ' messages since ts=' + oldest);

  var success = 0, failed = 0, skipped = 0;

  for (var i = messages.length - 1; i >= 0; i--) {
    var msg = messages[i];
    var ts = msg.ts;

    if (processed[ts]) { skipped++; continue; }

    if (!msg.text || msg.text.indexOf(SLACK_RESV_MARKER) === -1) {
      processed[ts] = 'skip';
      continue;
    }

    Logger.log('[SlackResv] Processing ts=' + ts);

    var parsed = parseSlackReservation_(msg.text);

    if (parsed.errors.length > 0) {
      var errMsg = '❌ 予約登録できません。以下を修正して再投稿してください:\n' +
        parsed.errors.map(function(e) { return '・' + e; }).join('\n');
      replySlackThread_(SLACK_CHANNEL_RESV_ID, ts, errMsg);
      processed[ts] = 'error';
      failed++;
      continue;
    }

    var resv = parsed.reservation;

    resv.id = generateSlackReservationId_();
    Logger.log('[SlackResv] Generated ID: ' + resv.id);

    var insertResult = insertReservation_(resv);
    if (!insertResult) {
      replySlackThread_(SLACK_CHANNEL_RESV_ID, ts, '❌ 予約登録失敗: DB登録エラー（' + resv.id + '）');
      processed[ts] = 'db_error';
      failed++;
      continue;
    }

    var assigned = autoAssignVehicle_(resv);
    var replyText = '';
    if (assigned) {
      replyText = '✅ 予約登録 + 配車完了\n' +
        '予約番号: ' + resv.id + '\n' +
        '予約者: ' + resv.name + '\n' +
        '経路: ' + resv.ota + '\n' +
        'クラス: ' + resv.vehicle + ' → ' + assigned.name + ' (' + (assigned.plate_no || '') + ')\n' +
        '期間: ' + resv.lend_date + ' ' + resv.lend_time + ' ～ ' + resv.return_date + ' ' + resv.return_time;
      if (resv.del_place || resv.col_place) replyText += '\n届先: ' + (resv.del_place || '未指定') + ' / 回収: ' + (resv.col_place || '未指定');
      if (resv.price > 0) replyText += '\n料金: ¥' + resv.price.toLocaleString();
      if (resv._vehicleModel) replyText += '\n車種指定: ' + resv._vehicleModel;
    } else {
      var reason = resv._vehicleModel ?
        resv.vehicle + 'クラスの「' + resv._vehicleModel + '」に空車がありません' :
        resv.vehicle + 'クラスに空車がありません';
      replyText = '⚠️ 予約登録完了（配車は手動で）\n' +
        '予約番号: ' + resv.id + '\n' +
        '予約者: ' + resv.name + '\n' +
        '経路: ' + resv.ota + '\n' +
        'クラス: ' + resv.vehicle + '\n' +
        '期間: ' + resv.lend_date + ' ' + resv.lend_time + ' ～ ' + resv.return_date + ' ' + resv.return_time + '\n' +
        '配車不可: ' + reason + '\n配車表から手動で配車してください';
    }

    replySlackThread_(SLACK_CHANNEL_RESV_ID, ts, replyText);
    processed[ts] = resv.id;
    success++;
    Logger.log('[SlackResv] Done: ' + resv.id + ' assigned=' + (assigned ? assigned.code : 'none'));
  }

  saveProcessedSlackTs_(processed);
  Logger.log('[SlackResv] Summary: success=' + success + ' failed=' + failed + ' skipped=' + skipped);
}

// --- 単一メッセージを即時処理（Events API / 手動呼び出し用） ---
function processSingleSlackMessage_(ts, text) {
  var processed = getProcessedSlackTs_();
  if (processed[ts]) {
    Logger.log('[SlackResv] Already processed ts=' + ts);
    return;
  }
  if (!text || text.indexOf(SLACK_RESV_MARKER) === -1) {
    processed[ts] = 'skip';
    saveProcessedSlackTs_(processed);
    return;
  }
  Logger.log('[SlackResv][Immediate] Processing ts=' + ts);
  var parsed = parseSlackReservation_(text);
  if (parsed.errors.length > 0) {
    var errMsg = '❌ 予約登録できません。以下を修正して再投稿してください:\n' +
      parsed.errors.map(function(e){return '・'+e;}).join('\n');
    replySlackThread_(SLACK_CHANNEL_RESV_ID, ts, errMsg);
    processed[ts] = 'error';
    saveProcessedSlackTs_(processed);
    return;
  }
  var resv = parsed.reservation;
  resv.id = generateSlackReservationId_();
  var insertResult = insertReservation_(resv);
  if (!insertResult) {
    replySlackThread_(SLACK_CHANNEL_RESV_ID, ts, '❌ 予約登録失敗: DB登録エラー（'+resv.id+'）');
    processed[ts] = 'db_error';
    saveProcessedSlackTs_(processed);
    return;
  }
  var assigned = autoAssignVehicle_(resv);
  var replyText;
  if (assigned) {
    replyText = '✅ 予約登録 + 配車完了\n予約番号: '+resv.id+'\n予約者: '+resv.name+'\n経路: '+resv.ota+
      '\nクラス: '+resv.vehicle+' → '+assigned.name+' ('+(assigned.plate_no||'')+')\n'+
      '期間: '+resv.lend_date+' '+resv.lend_time+' ～ '+resv.return_date+' '+resv.return_time;
    if (resv.del_place || resv.col_place) replyText += '\n届先: '+(resv.del_place||'未指定')+' / 回収: '+(resv.col_place||'未指定');
    if (resv.price > 0) replyText += '\n料金: ¥'+resv.price.toLocaleString();
    if (resv._vehicleModel) replyText += '\n車種指定: '+resv._vehicleModel;
  } else {
    var reason = resv._vehicleModel ?
      resv.vehicle+'クラスの「'+resv._vehicleModel+'」に空車がありません' :
      resv.vehicle+'クラスに空車がありません';
    replyText = '⚠️ 予約登録完了（配車は手動で）\n予約番号: '+resv.id+'\n予約者: '+resv.name+
      '\n経路: '+resv.ota+'\nクラス: '+resv.vehicle+
      '\n期間: '+resv.lend_date+' '+resv.lend_time+' ～ '+resv.return_date+' '+resv.return_time+
      '\n配車不可: '+reason+'\n配車表から手動で配車してください';
  }
  replySlackThread_(SLACK_CHANNEL_RESV_ID, ts, replyText);
  processed[ts] = resv.id;
  saveProcessedSlackTs_(processed);
  Logger.log('[SlackResv][Immediate] Done: '+resv.id+' assigned='+(assigned?assigned.code:'none'));
}

// --- Slack Events API Webhook（投稿と同時に即起動） ---
// GAS Web App としてデプロイ → Slack App「Event Subscriptions」に Request URL を登録
// 購読イベント: message.channels
// 必要スコープ: channels:history, chat:write
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // ① URL Verification（初回登録時のチャレンジ応答）
    if (body.type === 'url_verification') {
      return ContentService.createTextOutput(body.challenge).setMimeType(ContentService.MimeType.TEXT);
    }

    // ② Event Callback
    if (body.type === 'event_callback' && body.event) {
      var ev = body.event;
      // message の新規投稿のみ処理（編集/削除/bot投稿は無視）
      if (ev.type === 'message' &&
          !ev.subtype &&
          !ev.bot_id &&
          ev.channel === SLACK_CHANNEL_RESV_ID &&
          ev.text &&
          ev.text.indexOf(SLACK_RESV_MARKER) >= 0) {

        // Slack は3秒以内にackしないと再送する。処理を非同期化したいがGASは同期のみ。
        // 処理が3秒を超える場合はSlackが再送 → processedTsで二重防止
        try {
          processSingleSlackMessage_(ev.ts, ev.text);
        } catch (err) {
          Logger.log('[SlackEvents] processing error: ' + err.message);
        }
      }
    }
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log('[SlackEvents] doPost error: ' + err.message);
    return ContentService.createTextOutput('ERR').setMimeType(ContentService.MimeType.TEXT);
  }
}

// --- トリガー設定（Events APIフォールバック用・1分間隔） ---
function setupSlackImport() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processSlackReservations') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('processSlackReservations')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('Slack予約取込トリガー設定完了（1分間隔 / Events APIフォールバック）');
}

// --- テスト ---
function testSlackParse() {
  var sample = '【新規予約】\n名前: テスト太郎\n経路: SP\nクラス: C\n貸出: 2026-05-01 09:00\n返却: 2026-05-03 18:00\n届先: 札幌グランドホテル\n回収: 新千歳空港\n料金: 8000\n補償: 免責';
  var result = parseSlackReservation_(sample);
  Logger.log('Errors: ' + JSON.stringify(result.errors));
  Logger.log('Reservation: ' + JSON.stringify(result.reservation));
}

function testSlackHpParse() {
  var sample = '【新規予約】\n名前: テスト次郎\n経路: HP\nクラス: A\n車種: ヴェルファイア\n貸出: 2026-05-10 10:00\n返却: 2026-05-12 17:00\n届先: クインテッサホテル札幌\n回収: 新千歳空港\n料金: 45000\n補償: NOC\n便名: ANA123\nTEL: 090-1234-5678';
  var result = parseSlackReservation_(sample);
  Logger.log('Errors: ' + JSON.stringify(result.errors));
  Logger.log('Reservation: ' + JSON.stringify(result.reservation));
}

// --- 診断: Slack予約登録の動作確認 ---
function diagnoseSlackReservation() {
  Logger.log('=== Slack予約登録 診断 ===');
  var token = getSlackBotToken_();
  Logger.log('SLACK_BOT_TOKEN: ' + (token ? '✅ 設定済み' : '❌ 未設定'));
  if (!token) return;

  // conversations.history が読めるか
  var result = slackGet_('conversations.history', { channel: SLACK_CHANNEL_RESV_ID, limit: '5' });
  if (!result) { Logger.log('❌ Slack API応答なし'); return; }
  if (!result.ok) {
    Logger.log('❌ Slack APIエラー: ' + JSON.stringify(result));
    if (result.error === 'not_in_channel') {
      Logger.log('→ Botが #sapporo_reservation に参加していません。Slackで `/invite @<Bot名>` を実行してください');
    } else if (result.error === 'missing_scope') {
      Logger.log('→ Botに channels:history スコープがありません。Slack App設定で追加→再インストール');
    } else if (result.error === 'channel_not_found') {
      Logger.log('→ チャンネルID SLACK_CHANNEL_RESV_ID=' + SLACK_CHANNEL_RESV_ID + ' が見つかりません');
    }
    return;
  }
  Logger.log('✅ conversations.history 読取OK: ' + (result.messages||[]).length + '件');

  // トリガー確認
  var triggers = ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='processSlackReservations';});
  Logger.log('processSlackReservations トリガー: ' + (triggers.length > 0 ? '✅ 設定済み('+triggers.length+'個)' : '❌ 未設定'));
  if (triggers.length === 0) Logger.log('→ setupSlackImport() を実行してトリガー登録してください');

  // 処理済みts
  var processed = getProcessedSlackTs_();
  Logger.log('処理済みts: ' + Object.keys(processed).length + '件');

  Logger.log('=== 完了。processSlackReservations を手動実行して動作確認してください ===');
}

// --- 手動: 直近メッセージを即時処理（トリガー待たずに実行） ---
function runSlackReservationsNow() {
  Logger.log('手動実行開始...');
  processSlackReservations();
  Logger.log('手動実行完了');
}
