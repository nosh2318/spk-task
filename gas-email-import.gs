// ============================================================
// GAS - Reservation Email Import & Vehicle Auto-Assignment
// Gmail: reserve@rent-handyman.jp
// Target: 札幌 (SPK) store only
// OTA: 楽天(R), じゃらん(J), skyticket(S), エアトリ(O)
// ============================================================

// --- Supabase Config ---
var SUPABASE_URL = 'https://ckrxttbnawkclshczsia.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcnh0dGJuYXdrY2xzaGN6c2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Nzg1NTAsImV4cCI6MjA4NzQ1NDU1MH0.kDC_UDVWvcrS97wzqQ3NXP79ewjgYwF4vSFdV7y06S8';
var LABEL_NAME = '処理済み';
var SLACK_EMAIL = 'x-aaaatppttzyrldnhjt5el4jj3i@gl-oke5175.slack.com';

// --- OTA sender definitions ---
var OTA_SENDERS = {
  jalan:     'info@jalan-rentacar.jalan.net',
  rakuten:   'travel@mail.travel.rakuten.co.jp',
  skyticket: 'rentacar@skyticket.com',
  airtrip:   'info@rentacar-mail.airtrip.jp'
};

// --- OTA reservation subject patterns ---
var OTA_RESERVE_SUBJECTS = {
  jalan:     'じゃらんnetレンタカー 予約通知',
  rakuten:   '【楽天トラベル】予約受付のお知らせ',
  skyticket: '【skyticket】 新規予約',
  airtrip:   '【予約確定】エアトリレンタカー'
};

// --- Cancellation keywords in subject ---
var CANCEL_KEYWORDS = ['予約キャンセル受付', 'キャンセル'];

// ============================================================
// Setup & Trigger
// ============================================================

/**
 * Run once to create the 15-min trigger and the Gmail label.
 */
function setup() {
  // Remove existing triggers for processNewEmails
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

/**
 * Main: processes new reservation/cancellation emails.
 * Called every 15 minutes by the trigger.
 */
function processNewEmails() {
  var label = getOrCreateLabel_(LABEL_NAME);
  var fromClause = Object.values(OTA_SENDERS).map(function(s) { return 'from:' + s; }).join(' OR ');
  var query = '(' + fromClause + ') -label:' + LABEL_NAME + ' newer_than:2d';

  var threads = GmailApp.search(query, 0, 50);
  if (threads.length === 0) {
    Logger.log('No new reservation emails found.');
    return;
  }

  Logger.log('Found ' + threads.length + ' thread(s) to process.');

  // Track results for Slack notification
  var successes = []; // [{id, ota, name, dates, vehicle, assignedTo}]
  var failures = [];  // [{id, ota, name, reason}]
  var cancellations = []; // [{id, ota}]
  var skipped = [];   // [{id, reason}]

  // Process oldest first
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

  // Send Slack notifications
  if (successes.length > 0) {
    sendSlackSuccess_(successes);
  }
  if (failures.length > 0) {
    sendSlackFailure_(failures);
  }
  if (cancellations.length > 0) {
    sendSlackCancel_(cancellations);
  }
}

/**
 * Test: processes latest emails WITHOUT marking them as processed.
 */
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

/**
 * Routes a single email to the correct parser or cancellation handler.
 * @param {GmailMessage} message
 * @param {boolean} dryRun
 */
function processMessage_(message, dryRun) {
  var from = message.getFrom();
  var subject = message.getSubject();
  var body = message.getPlainBody();

  // Identify OTA
  var ota = null;
  var otaKeys = Object.keys(OTA_SENDERS);
  for (var i = 0; i < otaKeys.length; i++) {
    if (from.indexOf(OTA_SENDERS[otaKeys[i]]) !== -1) {
      ota = otaKeys[i];
      break;
    }
  }
  if (!ota) return null;

  var otaCode = {jalan:'J',rakuten:'R',skyticket:'S',airtrip:'O'}[ota] || ota;

  // Check for cancellation
  var isCancellation = CANCEL_KEYWORDS.some(function(kw) { return subject.indexOf(kw) !== -1; });
  if (isCancellation) {
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
    Logger.log('Reservation already exists: ' + reservation.id);
    return {type:'skip', id:reservation.id, reason:'登録済み'};
  }

  // Insert
  var insertResult = insertReservation_(reservation);
  if (!insertResult) {
    return {type:'failure', id:reservation.id, ota:otaCode, name:reservation.name, reason:'DB登録失敗'};
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

/**
 * Returns true if the reservation is for 札幌 store.
 */
function isSapporoReservation_(res) {
  var store = res._store || '';
  var rawClass = res._rawClass || '';

  // Reject Okinawa
  if (store.indexOf('那覇') !== -1) return false;
  if (/_OKA/i.test(rawClass) || /_OKI/i.test(rawClass)) return false;

  // Accept Sapporo
  if (store.indexOf('札幌') !== -1) return true;
  if (/_SPK/i.test(rawClass)) return true;

  return false;
}

/**
 * Extracts single-letter vehicle class from raw class string.
 * e.g. "A_SPK" -> "A", "コンパクトカープラン_F_SPK" -> "F"
 */
function extractVehicleClass_(rawClass) {
  if (!rawClass) return '';

  // Pattern: _A, _B, etc. (optionally followed by _SPK/_OKA or end)
  var m = rawClass.match(/[_]([ABCSFH])(?:[_]|$)/i);
  if (m) return m[1].toUpperCase();

  // Pattern: starts with A_, B_, etc.
  var m2 = rawClass.match(/^([ABCSFH])[_]/i);
  if (m2) return m2[1].toUpperCase();

  // Pattern: space + A_SPK, space + F_SPK etc. (skyticket format: "コンパクト  F_SPK")
  var m3 = rawClass.match(/\s([ABCSFH])[_]/i);
  if (m3) return m3[1].toUpperCase();

  // Pattern: standalone letter at end (e.g. "プラン_F")
  var m4 = rawClass.match(/[_]([ABCSFH])$/i);
  if (m4) return m4[1].toUpperCase();

  return '';
}

// ============================================================
// Field Extraction Helpers
// ============================================================

/**
 * Extract value from email body by label prefix.
 * Tries "label：value" and "label: value".
 */
function extractField_(body, label) {
  var escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var patterns = [
    new RegExp(escaped + '[：:]\\s*(.+)', 'm'),
    new RegExp(escaped + '\\s+(.+)', 'm')
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = body.match(patterns[i]);
    if (m) return m[1].trim();
  }
  return '';
}

/**
 * Parse Japanese date strings into { date: "YYYY-MM-DD", time: "HH:MM" }.
 * Supports: "2026年05月22日 09:00", "2026年04月14日（火）09時00分", "2026-5-1（金）10:30"
 */
function parseDateTime_(str) {
  if (!str) return { date: '', time: '' };

  // "2026年05月22日 09:00" or "2026年04月14日（火）09時00分"
  var m = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2})[時:](\d{2})/);
  if (m) {
    return {
      date: m[1] + '-' + padZero_(m[2]) + '-' + padZero_(m[3]),
      time: padZero_(m[4]) + ':' + m[5]
    };
  }

  // "2026-5-1（金）10:30"
  m = str.match(/(\d{4})-(\d{1,2})-(\d{1,2}).*?(\d{1,2}):(\d{2})/);
  if (m) {
    return {
      date: m[1] + '-' + padZero_(m[2]) + '-' + padZero_(m[3]),
      time: padZero_(m[4]) + ':' + m[5]
    };
  }

  return { date: '', time: '' };
}

function padZero_(n) {
  return ('0' + parseInt(n, 10)).slice(-2);
}

/** "42,300円" -> 42300 */
function parsePrice_(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[,，円\s]/g, ''), 10) || 0;
}

/** Keep digits and hyphens only */
function cleanPhone_(str) {
  if (!str) return '';
  return str.replace(/[^\d-]/g, '').trim();
}

/** Remove trailing 様 */
function cleanName_(str) {
  if (!str) return '';
  return str.replace(/\s*様\s*$/, '').trim();
}

// ============================================================
// Parsers
// ============================================================

// ---- じゃらん (J) ----
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

  // If class not found from 車両クラス, try 料金プラン
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

// ---- 楽天 (R) ----
function parseRakuten_(body) {
  var id = extractField_(body, '・予約番号');
  if (!id) return null;

  var nameKana = cleanName_(extractField_(body, '・予約者氏名（カナ）'));

  var lend = parseDateTime_(extractField_(body, '□貸出日時'));
  var ret  = parseDateTime_(extractField_(body, '□返却日時'));

  var store = extractField_(body, '・貸渡営業所名');

  // 詳細車両クラス: "ワンボックス、バン / ミドル ワンボックスカープラン_B"
  var detailClass = extractField_(body, '・詳細車両クラス');
  var rawClass = detailClass;
  var vehicleClass = extractVehicleClass_(detailClass);

  // Fallback: try extracting from the plan name portion
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

  // Check for child seat options
  var optB = optionsStr.indexOf('チャイルドシート') !== -1;
  var optC = optionsStr.indexOf('ジュニアシート') !== -1;

  return {
    id: id, ota: 'R', name: nameKana,
    lend_date: lend.date, lend_time: lend.time,
    return_date: ret.date, return_time: ret.time,
    vehicle: vehicleClass, people: 0, insurance: insurance,
    price: price, status: '確定', tel: '', mail: '',
    flight: '', visit_type: '', del_place: '', col_place: '',
    opt_b: optB, opt_c: optC,
    _store: store, _rawClass: rawClass
  };
}

// ---- skyticket (S) ----
function parseSkyticket_(body) {
  var id = extractField_(body, '予約番号');
  if (!id) return null;

  var nameKana = cleanName_(extractField_(body, 'ご利用者名'));
  var tel = cleanPhone_(extractField_(body, '電話番号'));
  var mail = extractField_(body, 'メールアドレス');

  var lend = parseDateTime_(extractField_(body, '受取日時'));
  var ret  = parseDateTime_(extractField_(body, '返却日時'));

  var store = extractField_(body, '受取店舗');

  // 車両タイプ / クラス: "コンパクト  F_SPK"
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

// ---- エアトリ (O) ----
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

// ============================================================
// Cancellation Handler
// ============================================================

function handleCancellation_(ota, body, dryRun) {
  var reservationId = '';
  if (ota === 'rakuten') {
    reservationId = extractField_(body, '・予約番号');
  } else {
    reservationId = extractField_(body, '予約番号');
  }

  if (!reservationId) {
    Logger.log('Cancellation: could not extract reservation ID (' + ota + ')');
    return;
  }

  Logger.log('Cancellation detected: ' + reservationId + ' (' + ota + ')');

  if (dryRun) {
    Logger.log('[DRY RUN] Would cancel: ' + reservationId);
    return;
  }

  // Delete fleet first (FK dependency), then reservation
  deleteFromFleet_(reservationId);
  deleteReservation_(reservationId);
  Logger.log('Cancelled reservation: ' + reservationId);
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
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(reservationId) + '&select=id');
  return rows.length > 0;
}

function insertReservation_(reservation) {
  // Build row excluding internal _fields
  var row = {};
  var keys = Object.keys(reservation);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].charAt(0) !== '_') {
      row[keys[i]] = reservation[keys[i]];
    }
  }

  var result = supabasePost_('reservations', row);
  if (result) {
    Logger.log('Inserted reservation: ' + reservation.id);
  }
  return result;
}

function deleteReservation_(reservationId) {
  return supabaseDelete_('reservations', 'id=eq.' + encodeURIComponent(reservationId));
}

function deleteFromFleet_(reservationId) {
  return supabaseDelete_('fleet', 'reservation_id=eq.' + encodeURIComponent(reservationId));
}

// ============================================================
// Vehicle Auto-Assignment
// ============================================================

/**
 * Attempts to auto-assign a vehicle to the reservation.
 * If none available, reservation remains as 未配車.
 */
function autoAssignVehicle_(reservation) {
  var vehicleClass = reservation.vehicle;
  if (!vehicleClass) {
    Logger.log('No vehicle class for ' + reservation.id + '. Will be 未配車.');
    return;
  }

  // 1. Get all vehicles of the same class (exclude insurance vehicles)
  var vehicles = supabaseGet_('vehicles',
    'type=eq.' + encodeURIComponent(vehicleClass) + '&insurance_veh=eq.false&select=code,name,plate_no,seats');
  if (vehicles.length === 0) {
    Logger.log('No vehicles of class ' + vehicleClass + '. ' + reservation.id + ' will be 未配車.');
    return;
  }

  var lendDate = reservation.lend_date;
  var returnDate = reservation.return_date;

  // 2. Find which vehicles are busy (fleet overlap)
  var busyVehicleCodes = {};
  var overlappingFleet = getOverlappingFleetVehicles_(lendDate, returnDate);
  for (var i = 0; i < overlappingFleet.length; i++) {
    busyVehicleCodes[overlappingFleet[i]] = true;
  }

  // 3. Find which vehicles are in maintenance
  var overlappingMaint = getOverlappingMaintenance_(lendDate, returnDate);
  for (var i = 0; i < overlappingMaint.length; i++) {
    busyVehicleCodes[overlappingMaint[i].vehicle_code] = true;
  }

  // 4. Find first available vehicle (skip insurance vehicles)
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

  // 5. Insert fleet assignment
  var fleetRow = {
    reservation_id: reservation.id,
    vehicle_code: assignedVehicle.code
  };

  var result = supabasePost_('fleet', fleetRow);
  if (result) {
    Logger.log('Assigned ' + assignedVehicle.code + ' (' + assignedVehicle.name + ') to ' + reservation.id);
    return assignedVehicle;
  }
  return null;
}

/**
 * Gets vehicle codes that have overlapping reservations for the given date range.
 * Uses fleet joined with reservations to check date overlap.
 */
function getOverlappingFleetVehicles_(lendDate, returnDate) {
  // Get fleet entries with reservation dates via embedded resource
  var query = 'select=vehicle_code,reservation_id,reservations(lend_date,return_date)';
  var allFleet = supabaseGet_('fleet', query);

  var busyCodes = [];
  for (var i = 0; i < allFleet.length; i++) {
    var f = allFleet[i];
    if (!f.reservations) continue;
    var r = f.reservations;
    // Overlap: existing.lend_date <= new.return_date AND existing.return_date >= new.lend_date
    if (r.lend_date <= returnDate && r.return_date >= lendDate) {
      busyCodes.push(f.vehicle_code);
    }
  }
  return busyCodes;
}

/**
 * Gets maintenance records overlapping the given date range.
 */
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
    lines.push('【' + r.ota + '】' + r.id + ' → キャンセル削除完了');
  });
  lines.push('');
  lines.push('合計: ' + items.length + '件');
  MailApp.sendEmail(SLACK_EMAIL, '🔄 札幌店予約キャンセル処理 ' + items.length + '件', lines.join('\n'));
  Logger.log('Slack cancel notification sent: ' + items.length + '件');
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
