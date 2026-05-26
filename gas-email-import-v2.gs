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
  // ★ 2026-05-02: 早期return時もheartbeat更新するよう構造変更（メール0件で「停止」誤判定される問題対策）
  // try-finally で必ず最後にheartbeatを書く。Slack通知やDB更新でエラーが出ても "動いた" 記録は残す
  var successes = [];
  var failures = [];
  var cancellations = [];
  var skipped = [];

  try {
    var label = getOrCreateLabel_(LABEL_NAME);
    var fromClause = Object.values(OTA_SENDERS).map(function(s) { return 'from:' + s; }).join(' OR ');
    // ★ 2026-04-30: 2d → 7d に拡張（HGU20355 / NUI44639 取り込み失敗障害対策）
    // GASダウン・ScriptProperties初期化等で2日以上空いた場合、newer_than:2d だと永久スキップになる
    var query = '(' + fromClause + ') newer_than:7d';

    var threads = GmailApp.search(query, 0, 50);
    if (threads.length === 0) {
      Logger.log('No new reservation emails found.');
      return;  // finally で heartbeat 更新される
    }

    var processedIds = getProcessedMsgIds_();
    var newProcessedIds = [];

    Logger.log('Found ' + threads.length + ' thread(s) to check.');

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
  } catch (e) {
    Logger.log('[processNewEmails] FATAL: ' + e.message + '\n' + e.stack);
    failures.push({id:'-', ota:'?', name:'', reason:'processNewEmails fatal: '+e.message});
  } finally {
    updateHeartbeat_('spk_gas_email', {
      success: successes.length,
      failure: failures.length,
      cancel: cancellations.length,
      skip: skipped.length
    });
  }
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
// 取り込み漏れ救済（2026-04-30 緊急対応）
// HGU20355 / NUI44639 等、newer_than:2d を超過した予約メールを
// 個別に検索して本番取込する。dryRun=false で実DB登録される。
// 関数を実行する前に TARGET_IDS を編集すること。
// ============================================================
function backfillSpecificReservations() {
  var TARGET_IDS = ['HGU20355', 'NUI44639'];
  var SEARCH_DAYS = 30;  // 30日まで遡る

  var processedIds = getProcessedMsgIds_();
  var newProcessedIds = [];
  var successes = [];
  var failures = [];
  var skipped = [];

  Logger.log('[Backfill] Target IDs: ' + TARGET_IDS.join(', '));

  for (var ti = 0; ti < TARGET_IDS.length; ti++) {
    var rid = TARGET_IDS[ti];
    Logger.log('[Backfill] === Searching: ' + rid + ' ===');

    // 全送信元 OR 全件名 で予約番号文字列を Gmail全文検索
    var query = '"' + rid + '" newer_than:' + SEARCH_DAYS + 'd';
    var threads = GmailApp.search(query, 0, 20);
    Logger.log('[Backfill] ' + rid + ': ' + threads.length + ' thread(s) hit');

    if (threads.length === 0) {
      Logger.log('[Backfill] ' + rid + ': NOT FOUND in Gmail (newer_than:' + SEARCH_DAYS + 'd)');
      failures.push({id:rid, ota:'?', name:'', reason:'Gmail未検出'});
      continue;
    }

    var processedThisId = false;
    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      for (var j = 0; j < messages.length; j++) {
        var msg = messages[j];
        var msgId = msg.getId();
        var subject = msg.getSubject();
        var from = msg.getFrom();
        var body = msg.getPlainBody();

        // 該当予約IDを含むメールのみ
        if (body.indexOf(rid) === -1 && subject.indexOf(rid) === -1) continue;

        Logger.log('[Backfill] ' + rid + ' processing msg: from=' + from + ', subject=' + subject);

        try {
          var result = processMessage_(msg, false);  // dryRun=false → 本番登録
          newProcessedIds.push(msgId);

          if (result) {
            Logger.log('[Backfill] ' + rid + ' result: ' + JSON.stringify(result));
            if (result.type === 'success') successes.push(result);
            else if (result.type === 'failure') failures.push(result);
            else if (result.type === 'skip') skipped.push(result);
          } else {
            Logger.log('[Backfill] ' + rid + ' result: null (skipped by router)');
          }
          processedThisId = true;
        } catch (e) {
          Logger.log('[Backfill] ' + rid + ' ERROR: ' + e.message + '\n' + e.stack);
          failures.push({id:rid, ota:'?', name:'', reason:'処理エラー: ' + e.message});
        }
      }
    }

    if (!processedThisId) {
      Logger.log('[Backfill] ' + rid + ': hit Gmail but no parseable message');
      failures.push({id:rid, ota:'?', name:'', reason:'メールあるがparseable無し'});
    }
  }

  if (newProcessedIds.length > 0) {
    saveProcessedMsgIds_(processedIds, newProcessedIds);
  }

  Logger.log('');
  Logger.log('[Backfill] === SUMMARY ===');
  Logger.log('  Success:  ' + successes.length + ' / Skip: ' + skipped.length + ' / Failure: ' + failures.length);
  if (successes.length > 0) Logger.log('  ✅ ' + successes.map(function(x){return x.id;}).join(', '));
  if (skipped.length > 0)   Logger.log('  ⏭️ ' + skipped.map(function(x){return x.id+'('+x.reason+')';}).join(', '));
  if (failures.length > 0)  Logger.log('  ❌ ' + failures.map(function(x){return x.id+'('+x.reason+')';}).join(', '));

  if (successes.length > 0) sendSlackSuccess_(successes);
  if (failures.length > 0) sendSlackFailure_(failures);
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

      // ★ 2026-04-23: じゃらん過大請求 根本修正
      // OTA自動登録GAS(30分先行) が price=合計金額(クーポン前) で作成 →
      // 札幌メール取込GAS(15分後追) が parseJalan_ で discount>0 を検出した場合、
      // 既存 price は「合計金額(クーポン前)」の可能性が極めて高い。
      // この場合は price / base_price / option_price / discount を一括で上書きする
      // （そうしないと price=¥19,300 + discount=¥3,000 の矛盾状態になり Square で過大請求される）
      // ★ 2026-05-06: ポイント全額充当(parser price=0)ケースを取りこぼしていた → 条件緩和
      // 旧条件: parser price > 0 を要求 → 0円ケースで発火せず existing price=合計金額 が残存 → 過大請求
      // 新条件: parser discount > 0 かつ existing discount=0 かつ existing price > parser price なら発火
      //         （parser price=0 かつ existing price>0 も含めるため = 等号付き）
      var jalanOverbillFix = (reservation.ota === 'J')
        && +(reservation.discount||0) > 0
        && +(existingRow.discount||0) === 0
        && +(existingRow.price||0) > 0
        && +(existingRow.price||0) >= +(reservation.price||0)
        && (+(reservation.price||0) === 0 || +(existingRow.price||0) > +(reservation.price||0));

      if (jalanOverbillFix) {
        patch.price = reservation.price;
        if (+(reservation.base_price||0) > 0) patch.base_price = reservation.base_price;
        if (+(reservation.option_price||0) > 0) patch.option_price = reservation.option_price;
        patch.discount = reservation.discount;
        Logger.log('[JalanOverbillFix] ' + reservation.id
          + ' price ' + existingRow.price + '→' + reservation.price
          + ' discount 0→' + reservation.discount);
      } else {
        // 従来の欠落補完ロジック
        if (!existingRow.price && +(reservation.price||0) > 0) patch.price = reservation.price;
        // 料金内訳: 既存が0でパーサーに値があれば常に上書き（那覇店障害 2026-04-20 再発防止）
        if (+(existingRow.base_price||0) === 0 && +(reservation.base_price||0) > 0) patch.base_price = reservation.base_price;
        if (+(existingRow.option_price||0) === 0 && +(reservation.option_price||0) > 0) patch.option_price = reservation.option_price;
        if (+(existingRow.discount||0) === 0 && +(reservation.discount||0) > 0) patch.discount = reservation.discount;
      }
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
        // ★ 2026-04-23: opts (B/C/J) が増えた場合は tasks 側 (memo/changed_json/opt_c) も同期
        // マキノリナ(R04OWZ6U)で tasks.opt_c=1 のまま reservations.opt_c=2 になっていた問題の再発防止
        if (patch.opt_b !== undefined || patch.opt_c !== undefined || patch.opt_j !== undefined) {
          var finalB = (patch.opt_b !== undefined) ? patch.opt_b : (+(existingRow.opt_b) || 0);
          var finalC = (patch.opt_c !== undefined) ? patch.opt_c : (+(existingRow.opt_c) || 0);
          var finalJ = (patch.opt_j !== undefined) ? patch.opt_j : (+(existingRow.opt_j) || 0);
          patchTaskOpts_(reservation.id, finalB, finalC, finalJ);
        }
      } else {
        Logger.log('Reservation already exists (active, no patch needed): ' + reservation.id);
      }
      // ★ 2026-04-21 修正: 既存予約でもじゃらん決済起票を試みる（OTA自動登録GASで先に予約作成された場合の対策）
      // handleJalanPayment_ 内で jalan_payments の存在チェック済みなので重複起票の心配なし
      if (reservation.ota === 'J' && reservation.price > 0) {
        try {
          handleJalanPayment_(reservation);
        } catch (e) {
          Logger.log('[JalanPayment] Error (existing path): ' + e.message);
        }
      }
      // ★ 2026-05-25 追加: skyticket(S)/airtrip(O) に LINE誘導案内メール自動送信
      // sendReservationWelcomeEmail_ 内部で ScriptProperty による冪等性チェック済み
      if (reservation.ota === 'S' || reservation.ota === 'O') {
        try { sendReservationWelcomeEmail_(reservation); } catch (e) { Logger.log('[WelcomeMail] Error (existing path): ' + e.message); }
      }
      return {type:'skip', id:reservation.id, reason:'登録済み'};
    }
  } else {
    var insertResult = insertReservation_(reservation);
    if (!insertResult) {
      var recheck = reservationExists_(reservation.id);
      if (recheck) {
        Logger.log('INSERT failed but reservation exists (race condition): ' + reservation.id);
        // ★ 2026-04-21 修正: 競合時もじゃらん決済起票を試みる
        if (reservation.ota === 'J' && reservation.price > 0) {
          try { handleJalanPayment_(reservation); } catch (e) { Logger.log('[JalanPayment] Error (race path): ' + e.message); }
        }
        // ★ 2026-05-25 追加: skyticket/airtrip 案内メール（冪等性は関数内で担保）
        if (reservation.ota === 'S' || reservation.ota === 'O') {
          try { sendReservationWelcomeEmail_(reservation); } catch (e) { Logger.log('[WelcomeMail] Error (race path): ' + e.message); }
        }
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
  // ★ 2026-05-25 追加: skyticket(S)/airtrip(O) に LINE誘導案内メール自動送信（新規INSERT経路）
  if (reservation.ota === 'S' || reservation.ota === 'O') {
    try { sendReservationWelcomeEmail_(reservation); } catch (e) { Logger.log('[WelcomeMail] Error: ' + e.message); }
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

// OTA側に登録された「店舗名」が HANDYMAN自社のOTA掲載名・PR文・★マーク等を含む場合は場所として使わない
// 例: "札幌デリバリー専門店 ★ホテルや自宅・駅へお届け！LINE完結の手続きで即出発★"
function sanitizeOtaStoreName_(storeName) {
  if (!storeName) return '';
  var s = String(storeName);
  // HANDYMAN自社のOTA掲載名マーカー
  if (/デリバリー専門店|HANDYMAN|ハンディマン|ホテルや自宅|LINE完結|即出発|★/i.test(s)) return '';
  // 汎用的な「店舗名」っぽいが住所情報を含まない短い文字列も除外
  return s.trim();
}

// ★ 2026-05-11: NHA 5/3 修正版と同形に統一
//   旧バグ: 「安心パック」が text に含まれるだけで NOC を返す → 「: なし」も「: あり」も
//          区別せず誤判定（OWX13785 織田様 / GUS75934 星様 事故で発覚）
//   修正: 各オプションの「: あり」を明示的に確認する形に書き換え
function detectInsurance_(text) {
  if (!text) return 'なし';
  // フル補償（明示キーワード）
  if (/フルカバー|フル補償|安心フル|あんしんフル/i.test(text)) return 'フル';
  // ★ 楽天形式: 「免責補償別 N」「NOC補償 N」両方検出して組み合わせ判定
  // 「N」は1以上の数字（「免責補償別 0」=未加入は除外）
  var hasNocRakuten = /NOC補償\s*[1-9]/i.test(text);
  var hasCdwRakuten = /免責補償別\s*[1-9]/i.test(text);
  if (hasNocRakuten && hasCdwRakuten) return 'フル';  // 両方加入 = フル相当
  if (hasNocRakuten) return 'NOC';                    // NOCのみ
  // NOC/安心パック「あり」を明示的に確認
  if (/レンタカー安心パック[：:\s]*あり/i.test(text)) return 'NOC';
  if (/安心パック[：:\s]*あり/i.test(text)) return 'NOC';
  if (/NOC[補償]*[：:\s]*あり/i.test(text)) return 'NOC';
  if (/ノンオペレーション[補償料金]*[：:\s]*あり|ノンオペ[：:\s]*あり/i.test(text)) return 'NOC';
  // 免責「あり」を明示的に確認
  if (/免責補償制度\(CDW\)[：:\s]*あり/i.test(text)) return '免責';
  if (/免責補償[：:\s]*あり|免責補償制度[：:\s]*あり|免責[：:\s]*加入|免責補償料/i.test(text)) return '免責';
  if (hasCdwRakuten) return '免責';  // 楽天 CDW のみ
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
  // ★ 2026-04-26: body全体から検出 (extractField_は1行のみ仕様のため取りこぼし防止)
  var insurance = detectInsurance_(insuranceStr) || detectInsurance_(body);
  if (insurance === 'なし') insurance = detectInsurance_(body);
  var peopleStr = extractField_(body, '乗車人数');
  var people = 0;
  // ★ 2026-05-09: じゃらん「子供（12歳未満）3人」の (12) を子供数と誤マッチするバグ修正
  //   旧: /子供.*?(\d+)/ → 「子供（12」マッチで 12 を拾う → 大人5+12=17 → >10で0クランプ
  //   新: 括弧書きを除去してからパース → 「子供 3」で正しく 3 を取得
  //   被害: R0MWIFG8 冨名腰様 8人(大人5+子供3) が DB people=0 になっていた、他12件
  var cleanStr = (peopleStr || '').replace(/[（(][^）)]*[）)]/g, '');
  var pM = cleanStr.match(/大人\s*(\d+)/);
  if (pM) people += parseInt(pM[1], 10);
  var cM = cleanStr.match(/子供\s*(\d+)/);
  if (cM) people += parseInt(cM[1], 10);
  // ★ CLAUDE.md ルール: people > 8 は 8 にクランプ（記録ロスト防止）
  if (people > 8) { Logger.log('WARNING: people=' + people + ' > 8 → 8にクランプ。raw=' + peopleStr); people = 8; }
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
  // ★ 2026-05-06: 「利用者への請求額: 0円」(ポイント全額充当)を正しく0として扱う
  // 旧: billingPrice > 0 で判定 → 0円のとき合計金額(クーポン前)にフォールバック → 過大請求
  // 新: extractField_ の戻り値（空文字 or 値あり）で判定。空文字ならフィールド自体が無いので合計金額
  var billingRaw = extractField_(body, '利用者への請求額');
  var billingPrice = parsePrice_(billingRaw);
  var price = (billingRaw !== '') ? billingPrice : parsePrice_(extractField_(body, '合計金額'));
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
  var delPlace = extractDeliveryPlace_(body) || sanitizeOtaStoreName_(store);
  var colPlace = extractCollectionPlace_(body) || sanitizeOtaStoreName_(retStore);
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
  // ★ 2026-04-26追加: optionsStr は extractField_ の仕様で1行目しか取れない (例: "カーナビ ※..." のみ)
  //   楽天オプション欄は複数行で「NOC補償 1」「免責補償別 1」が2行目以降にあるため、body全体から検出する
  var insurance = detectInsurance_(body);
  var basePriceR = parsePrice_(extractField_(body, '・基本料金'));
  if (!basePriceR) basePriceR = parsePrice_(extractField_(body, '基本料金'));
  var insurancePriceR = parsePrice_(extractField_(body, '・免責補償料金'));
  if (!insurancePriceR) insurancePriceR = parsePrice_(extractField_(body, '免責補償料金'));
  var optionPriceR = parsePrice_(extractField_(body, '・オプション料金'));
  if (!optionPriceR) optionPriceR = parsePrice_(extractField_(body, 'オプション料金'));
  // ★ クーポン割引
  //   事業者クーポン = 弊社負担 → 売上から差し引く（discount + price両方に反映）
  //   楽天クーポン / 楽天ポイント = 楽天負担 → 売上から引かない（後精算で弊社収入になる）
  //   オーナー方針確定 2026-05-07（NHA L1112-1114 と同期）:
  //     計上売上 = 合計 − 事業者クーポン（弊社負担分のみ差引）
  //     楽天クーポン・楽天ポイントは楽天が後精算するため売上に含める
  //   検算例:
  //     RC52461167634443526: 合計 53,800 − 事業者クーポン 10,000 = 43,800（楽天ポイント 8,800 は楽天負担→計上に含める）
  //   旧バグ (2026-05-08 修正): price = totalR をそのまま採用していたため、事業者クーポン分を売上から差し引けていなかった
  var couponR = parsePrice_(extractField_(body, '（レンタカー事業者クーポン利用）'));
  var discountR = couponR; // 事業者クーポンのみ
  var totalR = parsePrice_(extractField_(body, '（合計）'));
  var billingR = parsePrice_(extractField_(body, '（差引支払金額）'));
  // 計上売上 = 合計 − 事業者クーポン（楽天クーポン・楽天ポイントは売上に含める）
  var price = totalR > 0 ? (totalR - couponR) : billingR;
  var option_price_r = insurancePriceR + optionPriceR;
  // base_price が取れない場合のフォールバック（合計-事業者クーポン-オプション）
  var base_price_r = basePriceR > 0 ? basePriceR : Math.max(0, totalR - couponR - option_price_r);
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = optionsStr.match(/ベビーシート\s*(\d*)/);
  if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = optionsStr.match(/チャイルドシート\s*(\d*)/);
  if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = optionsStr.match(/ジュニアシート\s*(\d*)/);
  if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  // ★ 2026-04-26追加: extractField_は1行のみ取得するため、body全体からもフォールバック検索
  //   楽天メールの「・オプション/車両の特徴」は複数行: 1行目=カーナビ, 2行目=ETC, 3行目=チャイルドシート2 等
  var bAll = body.match(/ベビーシート[^\d\n]*(\d+)/g);
  var cAll = body.match(/チャイルドシート[^\d\n]*(\d+)/g);
  var jAll = body.match(/ジュニアシート[^\d\n]*(\d+)/g);
  if (bAll) { for (var bi=0;bi<bAll.length;bi++) { var bn=bAll[bi].match(/(\d+)/); if(bn) optB=Math.max(optB,parseInt(bn[1],10));} }
  if (cAll) { for (var ci=0;ci<cAll.length;ci++) { var cn=cAll[ci].match(/(\d+)/); if(cn) optC=Math.max(optC,parseInt(cn[1],10));} }
  if (jAll) { for (var ji=0;ji<jAll.length;ji++) { var jn=jAll[ji].match(/(\d+)/); if(jn) optJ=Math.max(optJ,parseInt(jn[1],10));} }
  var retStore = extractField_(body, '・返却営業所名') || extractField_(body, '□返却営業所名');
  var delPlace = extractDeliveryPlace_(body) || sanitizeOtaStoreName_(store);
  var colPlace = extractCollectionPlace_(body) || sanitizeOtaStoreName_(retStore);
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
  // ★ 2026-05-09: 括弧書き除去 + 8クランプに統一（CLAUDE.md ルール準拠）
  var cleanStrS = (peopleStr || '').replace(/[（(][^）)]*[）)]/g, '');
  var pM = cleanStrS.match(/大人\s*(\d+)/);
  if (pM) people += parseInt(pM[1], 10);
  if (people > 8) { Logger.log('WARNING: people=' + people + ' > 8 → 8にクランプ。raw=' + peopleStr); people = 8; }
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
  var delPlace = extractDeliveryPlace_(body) || sanitizeOtaStoreName_(store);
  var colPlace = extractCollectionPlace_(body) || sanitizeOtaStoreName_(retStore);
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
  // ★ 2026-04-26: insuranceStr が空でない時もbody全体で検出して取りこぼし防止
  //   (extractField_ は1行目のみ仕様、補償系オプションが2行目以降にあると拾えない)
  var insurance = detectInsurance_(body);
  if (insurance === 'なし' && insuranceStr) insurance = detectInsurance_(insuranceStr);
  var arrFlight = extractField_(body, '到着便');
  var depFlight = extractField_(body, '出発便');
  var flight = [arrFlight, depFlight].filter(Boolean).join(' / ');
  var optB = 0, optC = 0, optJ = 0;
  var bMatch = body.match(/ベビーシート[^\d]*(\d*)/); if (bMatch) optB = parseInt(bMatch[1], 10) || 1;
  var cMatch = body.match(/チャイルドシート[^\d]*(\d*)/); if (cMatch) optC = parseInt(cMatch[1], 10) || 1;
  var jMatch = body.match(/ジュニアシート[^\d]*(\d*)/); if (jMatch) optJ = parseInt(jMatch[1], 10) || 1;
  var retStore = extractField_(body, '返却営業所');
  var delPlace = extractDeliveryPlace_(body) || sanitizeOtaStoreName_(store);
  var colPlace = extractCollectionPlace_(body) || sanitizeOtaStoreName_(retStore);
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
  // ★ HPはタスク時間として「お届け希望時間・回収希望時間」を優先
  // ご利用開始日時 = 利用期間開始、お届け希望時間 = DEL配送時刻 （別物）
  var delHopeMatch = body.match(/【(?:お届け希望時間|お届け希望日時)】\s*\n\s*(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})/);
  if (delHopeMatch) {
    lend.date = delHopeMatch[1].replace(/\//g, '-');
    lend.time = delHopeMatch[2];
    Logger.log('[Official] お届け希望時間 を lend に採用: ' + lend.date + ' ' + lend.time);
  }
  var colHopeMatch = body.match(/【(?:回収希望時間|回収希望日時)】\s*\n\s*(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})/);
  if (colHopeMatch) {
    ret.date = colHopeMatch[1].replace(/\//g, '-');
    ret.time = colHopeMatch[2];
    Logger.log('[Official] 回収希望時間 を return に採用: ' + ret.date + ' ' + ret.time);
  }
  var people = 0;
  var adultMatch = body.match(/大人:\s*(\d+)/);
  if (adultMatch) people += parseInt(adultMatch[1], 10);
  var childMatch = body.match(/子ども:\s*(\d+)/);
  if (childMatch) people += parseInt(childMatch[1], 10);
  // ★ 2026-05-09: CLAUDE.md ルール準拠 → 8クランプ
  if (people > 8) { Logger.log('WARNING: people=' + people + ' > 8 → 8にクランプ'); people = 8; }
  var rawClassLine = '';
  var rawClassMatch = body.match(/ご予約車両クラス\s*\n\s*(.+)/);
  if (rawClassMatch) rawClassLine = rawClassMatch[1].trim();
  var vehicleClass = '';
  // ★ 2026-05-26 A2/B2 対応 (オーナー商品構成PDF準拠):
  //   優先順 (上から): B2クラス明示 > A2クラス明示 > ノア高年式 > 通常パターン
  var MODEL_CLASS_MAP = [
    // A2/B2 明示パターン (Tier0・最優先)
    {re:/B2[\s　]*クラス/i,cls:'B2'},
    {re:/A2[\s　]*クラス/i,cls:'A2'},
    {re:/ノア[\s　]*(高年式|新車|プレミアム)/,cls:'B2'},
    {re:/アルファード[\s　]*(預か|預け|プレミアム)/,cls:'A2'},
    // Tier1 (車種名)
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
    // ★ A2/B2 も match に対応
    var classMatch2 = body.match(/ご予約車両クラス\s*\n\s*(A2|B2)クラス/i);
    if (classMatch2) vehicleClass = classMatch2[1].toUpperCase();
    else {
      var classMatch = body.match(/ご予約車両クラス\s*\n\s*([ABCSFH])クラス/i);
      if (classMatch) vehicleClass = classMatch[1].toUpperCase();
    }
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
  // ★ 2026-05-15: 料金パース堅牢化（AEU53482 小村様の¥0障害対応）
  // 複数パターンで料金を抽出（メール表記揺れに対応）
  var price = 0;
  var pricePatterns = [
    /[【\-・\s]*料金[】]?\s*[\n\r]+\s*([\d,]+)\s*円/,   // 改行後に金額（標準）
    /[【\-・\s]*料金[】]?[：:\s]+([\d,]+)\s*円/,         // 同行に金額
    /(?:合計|請求|総額)[料金額]*[：:\s]*([\d,]+)\s*円/,  // 合計料金パターン
    /料金[：:\s]*[\n\r]*\s*([\d,]+)/,                  // 緩い数字キャッチ
  ];
  for (var pi = 0; pi < pricePatterns.length; pi++) {
    var m = body.match(pricePatterns[pi]);
    if (m && m[1]) {
      var p = parsePrice_(m[1]);
      if (p > 0) { price = p; break; }
    }
  }
  if (!price) Logger.log('[parseOfficial_] WARNING: 料金パース失敗 id=' + id);
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

// ============================================================
// 2026-04-23: tasks 側の opts (B/C/J) も reservations と同期する
// OTA自動登録GAS(30分)が先に予約作成 → tasks 生成 → メール取込GAS(15分)が
// reservations.opt_c をパッチ、という順序でタスク側が取り残されていた問題の修正
// APP _fromDbTask の優先順位: changed_json._optC > memo ##BCJ: > opt_c(bool)
// 3箇所すべて更新する
// ============================================================
function patchTaskOpts_(reservationId, optB, optC, optJ) {
  var encId = encodeURIComponent(reservationId);
  var tasks = supabaseGet_('tasks', 'reservation_id=eq.' + encId + '&select=_id,memo,changed_json,opt_c');
  if (!tasks || tasks.length === 0) {
    Logger.log('[patchTaskOpts_] No tasks found for ' + reservationId);
    return;
  }
  var nb = +(optB || 0), nc = +(optC || 0), nj = +(optJ || 0);
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    // memo: 既存 ##BCJ: マーカーを剥がして再付与（本文保持）
    var base = String(t.memo || '').split('\n##BCJ:')[0];
    var hasBCJ = (nb || nc || nj);
    var newMemo = hasBCJ ? (base + '\n##BCJ:' + nb + ',' + nc + ',' + nj) : base;
    // changed_json: 既存フィールド(_ssTime/_ssPlace等)保持のままマージ
    var cj = {};
    try { cj = t.changed_json ? JSON.parse(t.changed_json) : {}; } catch (e) { cj = {}; }
    cj._optB = nb;
    cj._optC = nc;
    cj._optJ = nj;
    var update = {
      memo: newMemo,
      opt_c: nc > 0,
      changed_json: JSON.stringify(cj)
    };
    supabaseUpdate_('tasks', '_id=eq.' + encodeURIComponent(t._id), update);
    Logger.log('[patchTaskOpts_] ' + t._id + ' → B=' + nb + ' C=' + nc + ' J=' + nj);
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
  // ★ 2026-04-26: active=true のみ取得（vehicles.active=false の永続除外車両は候補外）
  var vehicles = supabaseGet_('vehicles', 'type=eq.' + encodeURIComponent(vehicleClass) + '&insurance_veh=eq.false&active=eq.true&select=code,name,plate_no,seats');
  if (vehicles.length === 0) { Logger.log('No active vehicles of class ' + vehicleClass + '. ' + reservation.id + ' will be 未配車.'); return; }

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

  // ★ 2026-04-26: vehicle_monthly_kpi.active=false の月別除外チェック
  //   配車表で「除外」フラグが立っている車両に配車してはいけない（絶対ルール）
  //   レンタル期間に該当する全月のうち、いずれかで active=false なら候補から除外
  var relevantYms = listYearMonths_(lendDate, returnDate);
  if (relevantYms.length > 0) {
    var inactiveCodes = {};
    for (var ki = 0; ki < relevantYms.length; ki++) {
      var rows = supabaseGet_('vehicle_monthly_kpi', 'year_month=eq.' + encodeURIComponent(relevantYms[ki]) + '&active=eq.false&select=vehicle_code');
      for (var rj = 0; rj < rows.length; rj++) inactiveCodes[rows[rj].vehicle_code] = true;
    }
    var preFilter = vehicles.length;
    vehicles = vehicles.filter(function(v) { return !inactiveCodes[v.code]; });
    if (preFilter !== vehicles.length) {
      Logger.log('[KPI除外] ' + reservation.id + ': ' + (preFilter - vehicles.length) + '件の除外車両 (' + relevantYms.join(',') + ') を候補から除去');
    }
    if (vehicles.length === 0) {
      Logger.log('All ' + vehicleClass + 'クラス車両が ' + relevantYms.join(',') + ' で inactive。' + reservation.id + ' will be 未配車.');
      return null;
    }
  }

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

// ★ 2026-04-26追加: 期間内の年月リスト (YYYY-MM)
//   レンタル期間が複数月にまたがる場合に vehicle_monthly_kpi の各月をチェックするため
function listYearMonths_(lendDate, returnDate) {
  if (!lendDate || !returnDate) return [];
  var s = new Date(lendDate + 'T00:00:00Z');
  var e = new Date(returnDate + 'T00:00:00Z');
  if (isNaN(s) || isNaN(e)) return [];
  var result = [];
  var cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
  var maxIter = 24; // 安全装置: 最大24ヶ月
  while (cur <= e && maxIter-- > 0) {
    var y = cur.getUTCFullYear();
    var m = String(cur.getUTCMonth() + 1);
    if (m.length === 1) m = '0' + m;
    result.push(y + '-' + m);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return result;
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
  // ★ 2026-05-03: URL Fetchクォータ節約のため無効化
  Logger.log('[heartbeat] ' + key + ' ' + JSON.stringify(stats));
  return;
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
// じゃらん事前決済 自動化
// ============================================================
var JALAN_PAY_CHANNEL = 'C0AQL6HGG3E';  // #jalan_payment
function getSlackBotToken_() { return PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN'); }

// Square Payment Links API で決済リンクを直接作成（AIスタッフ_G依存を排除）
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
      Logger.log('[Square] Link created: ' + data.payment_link.url);
      return data.payment_link.url;
    }
    Logger.log('[Square] API error: ' + resp.getContentText());
    return null;
  } catch (e) { Logger.log('[Square] Exception: ' + e.message); return null; }
}

function handleJalanPayment_(reservation) {
  var resId = reservation.id;
  var store = reservation._store || '';
  if (/那覇|沖縄|OKA|naha/.test(store)) { Logger.log('[JalanPayment] BLOCKED: 那覇店予約 ' + resId); return; }
  // ★ 2026-05-06: ポイント全額充当等で利用者請求額0円のケースは決済リンク不要
  // (R0EQE3JK 田草川様で誤って¥7,000リンク発行→お客様にメール送信される事故が発生)
  if (+(reservation.price||0) <= 0) {
    Logger.log('[JalanPayment] SKIP price<=0 (ポイント全額充当等): ' + resId + ' price=' + reservation.price);
    return;
  }
  var existing = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId) + '&select=id');
  if (existing && existing.length > 0) { Logger.log('[JalanPayment] Already exists: ' + resId); return; }

  // 1. Square決済リンクを直接作成
  var lendShort = (reservation.lend_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
  var retShort = (reservation.return_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
  var itemName = '札幌店 ' + (reservation.name||'') + '様（' + resId + '） じゃらん事前決済 ' + lendShort + '-' + retShort;
  var payUrl = createSquarePaymentLink_(itemName, reservation.price||0);

  if (!payUrl) {
    // Square API失敗 → status='new'で保存（checkSquareLinksでリトライ）+ Slack障害通知
    var payData = {reservation_id:resId, customer_name:reservation.name, customer_email:reservation.mail||'', amount:reservation.price||0, status:'new', lend_date:reservation.lend_date, return_date:reservation.return_date, vehicle_class:reservation.vehicle||''};
    supabasePost_('jalan_payments', payData);
    postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *Squareリンク作成失敗*\n予約番号： ' + resId + '\n宛名： ' + reservation.name + '\n金額： ¥' + (reservation.price||0) + '\n→ checkSquareLinksトリガーでリトライします');
    Logger.log('[JalanPayment] Square link creation failed, saved as new: ' + resId);
    return;
  }

  // 2. DB保存（link_created状態で即保存）
  var now = new Date().toISOString();
  var payData = {reservation_id:resId, customer_name:reservation.name, customer_email:reservation.mail||'', amount:reservation.price||0, status:'link_created', square_payment_url:payUrl, link_created_at:now, lend_date:reservation.lend_date, return_date:reservation.return_date, vehicle_class:reservation.vehicle||''};
  var inserted = supabasePost_('jalan_payments', payData);
  if (!inserted) { Logger.log('[JalanPayment] DB insert failed: ' + resId); return; }
  Logger.log('[JalanPayment] Created with link: ' + resId + ' ¥' + reservation.price + ' → ' + payUrl);

  // 3. Slack投稿（リンク付きで可視化）
  var slackText = '💳 *じゃらん事前決済*\n利用店舗： 札幌店\n予約番号： ' + resId + '\n宛名： ' + reservation.name + '\n品目： じゃらん事前決済(' + lendShort + '-' + retShort + ')\n金額： ¥' + (reservation.price||0).toLocaleString() + '\nSquareリンク： ' + payUrl;
  var slackTs = postToSlackChannel_(JALAN_PAY_CHANNEL, slackText);
  if (slackTs) {
    supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId), {slack_ts: slackTs});
  }

  // 4. スプレッドシートに記録
  appendToPaymentSheet_({reservation_id:resId, customer_name:reservation.name, amount:reservation.price||0, lend_date:reservation.lend_date, return_date:reservation.return_date, slack_ts:slackTs||''}, payUrl);
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

function postToSlackChannel_(channel, text, blocks) {
  var token = getSlackBotToken_();
  if (!token) { Logger.log('[Slack] No SLACK_BOT_TOKEN configured'); return null; }
  try {
    var payload = {channel: channel, text: text || '通知'};
    if (blocks) payload.blocks = blocks;
    var resp = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {method:'post', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}, payload:JSON.stringify(payload), muteHttpExceptions:true});
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
  // ★ 2026-05-02: 早期return時もheartbeat更新するよう構造変更
  var rows = supabaseGet_('jalan_payments', 'status=in.(new,link_created)&select=reservation_id,customer_name,customer_email,amount,status,slack_ts,lend_date,return_date,square_payment_url');
  if (!rows || rows.length === 0) {
    updateHeartbeat_('spk_jalan_links', {success: 0, processed: 0});
    return;
  }
  for (var i = 0; i < rows.length; i++) {
    var pay = rows[i];

    // status=new: handleJalanPayment_でSquareリンク作成が失敗した行 → リトライ
    if (pay.status === 'new') {
      var lendShort = (pay.lend_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
      var retShort = (pay.return_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
      var itemName = '札幌店 ' + (pay.customer_name||'') + '様（' + pay.reservation_id + '） じゃらん事前決済 ' + lendShort + '-' + retShort;
      var payUrl = createSquarePaymentLink_(itemName, pay.amount||0);
      if (!payUrl) { Logger.log('[checkSquareLinks] Retry failed: ' + pay.reservation_id); continue; }
      var now = new Date().toISOString();
      supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id), {square_payment_url:payUrl, status:'link_created', link_created_at:now});
      Logger.log('[checkSquareLinks] Retry success: ' + pay.reservation_id + ' → ' + payUrl);
      // Slack投稿（リトライ成功通知）
      var slackText = '💳 *じゃらん事前決済（リトライ成功）*\n予約番号： ' + pay.reservation_id + '\n宛名： ' + pay.customer_name + '\n金額： ¥' + (pay.amount||0).toLocaleString() + '\nSquareリンク： ' + payUrl;
      var slackTs = postToSlackChannel_(JALAN_PAY_CHANNEL, slackText);
      if (slackTs && !pay.slack_ts) { supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id), {slack_ts: slackTs}); }
      appendToPaymentSheet_(pay, payUrl);
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
  updateHeartbeat_('spk_jalan_links', {success: 1});
}

function sendJalanPaymentEmail_(pay) {
  if (!pay || !pay.customer_email || !pay.square_payment_url) { Logger.log('[JalanPayment] Email BLOCKED: missing data'); return; }
  try {
    var subject = '【レンタカー HANDYMAN 札幌デリバリー専門店】事前決済・LINE登録のお願い（予約番号: ' + pay.reservation_id + '）';
    var body = pay.customer_name + ' 様\n\n'
      + 'この度はHANDYMAN札幌デリバリー専門店をご予約いただき、誠にありがとうございます。\n'
      + '予約番号: ' + pay.reservation_id + '\n'
      + '貸出日: ' + pay.lend_date + '\n'
      + '返却日: ' + pay.return_date + '\n\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + '■ STEP1: LINE登録（必須）\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + 'デリバリー情報の入力・当日のご連絡はLINEで行います。\n'
      + '下記リンクから友だち追加をお願いいたします。\n\n'
      + 'LINE公式👉 https://lin.ee/g6iDNYz\n'
      + 'LINE ID👉 @730kyhwl\n\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + '■ STEP2: 事前決済（HANDYMANではご出発までの「待ち時間」「待機時間」を解消するため事前決済をお願いしております。）\n'
      + '・現金決済をご希望の場合は大変お手数ですが事前にお問い合わせをお願い申しあげます。\n'
      + '・詳細はLINEにてご案内いたします。\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + 'お支払い金額: ¥' + (pay.amount||0).toLocaleString() + '\n'
      + '下記リンクよりお支払いをお願いいたします。\n'
      + pay.square_payment_url + '\n\n'
      + '※ ご出発3日前の19:00までにお支払いください。\n'
      + '※ 期限を過ぎた場合、ご予約をキャンセルさせていただく場合がございます。\n\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + '■ ご注意事項\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + '・当店は実店舗を持たないデリバリー専門店です。\n'
      + '・ご指定の場所へお車をお届け・ご回収いたします。\n'
      + '・詳細はLINEにてご案内いたします。\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + 'HANDYMAN 札幌デリバリー専門店\n'
      + 'TEL: 050-1724-6197（9:00〜19:00）\n'
      + 'LINE ID👉 @730kyhwl\n';
    GmailApp.sendEmail(pay.customer_email, subject, body, {name:'HANDYMAN 札幌デリバリー専門店', from:'reserve@rent-handyman.jp', replyTo:'reserve@rent-handyman.jp'});
    return true;
  } catch (e) { Logger.log('[JalanPaymentEmail] Error: ' + e.message); return false; }
}

/**
 * 📧 予約後 LINE誘導案内メール（自動送信） — 2026-05-25 新規追加
 * 対象OTA: skyticket(S) / airtrip(O)
 *   - じゃらん(J)は sendJalanPaymentEmail_ が決済リンク付きメールを送るため対象外
 *   - 楽天(R) / RC / G / HP(オフィシャル) は対象外
 * 冪等性: ScriptProperty 'spk_welcome_sent_ids' で送信済予約IDを管理（最大500件）
 * 送信元: reserve@rent-handyman.jp（既存Gmailエイリアス）
 *
 * @param {Object} reservation - パーサー出力の予約データ（id, name, customer_email, ota）
 * @return {boolean} 送信成功true / 対象外・失敗false
 */
function sendReservationWelcomeEmail_(reservation) {
  try {
    // 1. 対象OTAチェック (skyticket / airtrip のみ)
    var TARGET_OTAS = ['S', 'O'];
    if (TARGET_OTAS.indexOf(reservation.ota) < 0) return false;

    // 2. メールアドレス検証
    var email = (reservation.customer_email || '').trim();
    if (!email || !/@/.test(email)) {
      Logger.log('[WelcomeMail] skip (no email): ' + reservation.id);
      return false;
    }

    // 3. 重複送信防止 (ScriptProperty で送信済IDを管理)
    var props = PropertiesService.getScriptProperties();
    var SENT_KEY = 'spk_welcome_sent_ids';
    var sentIds = (props.getProperty(SENT_KEY) || '').split(',').filter(function(x){return x;});
    if (sentIds.indexOf(reservation.id) >= 0) {
      Logger.log('[WelcomeMail] skip (already sent): ' + reservation.id);
      return false;
    }

    // 4. 件名・本文を組み立て
    var otaLabel = (reservation.ota === 'S' ? 'skyticket' : 'airtrip');
    var subject = '【HANDYMAN 札幌デリバリー専門店】ご予約ありがとうございます(予約番号: ' + reservation.id + ')';
    var name = (reservation.name || 'お客').toString().trim();
    var body =
      name + ' 様\n' +
      '予約番号： ' + reservation.id + '\n\n' +
      'レンタカーショップHANDYMANカスタマーサポートです。\n' +
      'ご予約ありがとうございます。\n\n' +
      '札幌店は便利なデリバリー専門店となっております。\n' +
      'スムーズにお貸し出しできますよう事前のお手続きをお願いしております。\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '\\ LINE公式の友達登録 /\n' +
      'ご登録後流れに沿ってデリバリーに必要な情報を入力ください。\n' +
      '当日の時間・場所の詳細連絡にもLINEを利用いたします。\n\n' +
      'LINE ID：@730kyhwl\n' +
      'https://lin.ee/g6iDNYz\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      'お忙しいところ恐れ入りますが、お貸し出し3日前19:00までにご対応お願いいたします。\n\n' +
      '【注意点】\n' +
      '・無店舗型のデリバリー専門になります\n' +
      '・予約状況により内容のご調整をいただくことがございます。\n' +
      '・貸出日 3日前19:00時点で情報が不明確な場合はご希望に添えないことがございます。\n' +
      '・貸出時間からご連絡のないまま30分経過しますと貸出不可となることがございます。\n\n' +
      '【お問合せ】\n' +
      'お問い合わせは公式LINEお願いいたします。\n' +
      'HANDYMANカスタマーサポート\n' +
      'LINE公式：https://lin.ee/g6iDNYz\n' +
      'LINE ID：@730kyhwl\n' +
      '緊急連絡先： 050-1724-6197\n' +
      '営業時間： 9:00〜19:00\n';

    // 5. Gmail送信
    GmailApp.sendEmail(email, subject, body, {
      name: 'HANDYMAN 札幌デリバリー専門店',
      from: 'reserve@rent-handyman.jp',
      replyTo: 'reserve@rent-handyman.jp'
    });

    // 6. 送信済IDを記録（最大500件保持・冪等性確保）
    sentIds.push(reservation.id);
    if (sentIds.length > 500) sentIds = sentIds.slice(-500);
    props.setProperty(SENT_KEY, sentIds.join(','));

    Logger.log('[WelcomeMail] ✅ sent: ' + reservation.id + ' [' + otaLabel + '] → ' + email);

    // 7. Slack通知（失敗しても致命的でない）
    try {
      postToSlackChannel_(JALAN_PAY_CHANNEL,
        '📧 *予約案内メール送信完了*\n' +
        '予約番号： ' + reservation.id + '\n' +
        '宛名： ' + name + ' 様\n' +
        'OTA： ' + otaLabel + '\n' +
        '宛先： ' + email);
    } catch (e) { /* Slack失敗は無視 */ }

    return true;
  } catch (err) {
    Logger.log('[WelcomeMail] ❌ failed: ' + (reservation && reservation.id) + ' - ' + err.message);
    return false;
  }
}

/**
 * 🧪 sendReservationWelcomeEmail_ 動作テスト（GASエディタで手動実行）
 * テスト用ダミー予約で実際にメールを送信せず、対象判定とテンプレ出力のみ確認
 */
function testWelcomeMailDryRun() {
  var samples = [
    { id: 'TEST-S001', ota: 'S', name: '山田 太郎', customer_email: '' /* 空 → スキップ */ },
    { id: 'TEST-O001', ota: 'O', name: '佐藤 花子', customer_email: 'invalid' /* @なし → スキップ */ },
    { id: 'TEST-J001', ota: 'J', name: '田中 次郎', customer_email: 'tanaka@example.com' /* じゃらん → 対象外 */ },
    { id: 'TEST-R001', ota: 'R', name: '鈴木 三郎', customer_email: 'suzuki@example.com' /* 楽天 → 対象外 */ }
  ];
  samples.forEach(function(r) {
    var willSend = (['S','O'].indexOf(r.ota) >= 0) && r.customer_email && /@/.test(r.customer_email);
    Logger.log('[DryRun] ' + r.id + ' ota=' + r.ota + ' email=' + (r.customer_email || '(空)') + ' → ' + (willSend ? '送信対象' : 'スキップ'));
  });
  Logger.log('[DryRun] 完了。実際の送信は行いません。');
}

/**
 * 🧪 テスト送信: 指定アドレスに 案内メールを **実際に** 送信する
 *   - GASエディタで手動実行
 *   - 送信先 / 予約番号 / OTA を関数内で書き換えて使う
 *   - ScriptProperty による冪等性チェックは **バイパス**（何度でも実行可能）
 *   - 件名先頭に【テスト送信】を付与（誤受信時の判別用）
 *   - Slack通知も省略（テスト送信が #payment_sapporo に流れないように）
 */
function testSendWelcomeMail() {
  // ▼ 必要に応じて書き換え ▼
  var TO_EMAIL = 'oshita@mileshare.jp';   // 送信先（オーナー受信用）
  var TEST_NAME = '大下 典隆';              // 宛名（[名前] 様）
  var TEST_RESV_ID = 'TEST-S-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  var TEST_OTA = 'S';                     // 'S' = skyticket / 'O' = airtrip
  // ▲ ここまで ▲

  var otaLabel = (TEST_OTA === 'S' ? 'skyticket' : 'airtrip');
  var subject = '【テスト送信】【HANDYMAN 札幌デリバリー専門店】ご予約ありがとうございます(予約番号: ' + TEST_RESV_ID + ')';
  var body =
    TEST_NAME + ' 様\n' +
    '予約番号： ' + TEST_RESV_ID + '\n\n' +
    'レンタカーショップHANDYMANカスタマーサポートです。\n' +
    'ご予約ありがとうございます。\n\n' +
    '札幌店は便利なデリバリー専門店となっております。\n' +
    'スムーズにお貸し出しできますよう事前のお手続きをお願いしております。\n\n' +
    '━━━━━━━━━━━━━━━━━━━━\n' +
    '\\ LINE公式の友達登録 /\n' +
    'ご登録後流れに沿ってデリバリーに必要な情報を入力ください。\n' +
    '当日の時間・場所の詳細連絡にもLINEを利用いたします。\n\n' +
    'LINE ID：@730kyhwl\n' +
    'https://lin.ee/g6iDNYz\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    'お忙しいところ恐れ入りますが、お貸し出し3日前19:00までにご対応お願いいたします。\n\n' +
    '【注意点】\n' +
    '・無店舗型のデリバリー専門になります\n' +
    '・予約状況により内容のご調整をいただくことがございます。\n' +
    '・貸出日 3日前19:00時点で情報が不明確な場合はご希望に添えないことがございます。\n' +
    '・貸出時間からご連絡のないまま30分経過しますと貸出不可となることがございます。\n\n' +
    '【お問合せ】\n' +
    'お問い合わせは公式LINEお願いいたします。\n' +
    'HANDYMANカスタマーサポート\n' +
    'LINE公式：https://lin.ee/g6iDNYz\n' +
    'LINE ID：@730kyhwl\n' +
    '緊急連絡先： 050-1724-6197\n' +
    '営業時間： 9:00〜19:00\n' +
    '\n' +
    '────────────────────\n' +
    '※ これは送信テストです（OTA=' + otaLabel + '）\n' +
    '※ 送信時刻: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') + '\n';

  try {
    GmailApp.sendEmail(TO_EMAIL, subject, body, {
      name: 'HANDYMAN 札幌デリバリー専門店',
      from: 'reserve@rent-handyman.jp',
      replyTo: 'reserve@rent-handyman.jp'
    });
    Logger.log('[TestSend] ✅ 送信成功');
    Logger.log('  宛先  : ' + TO_EMAIL);
    Logger.log('  宛名  : ' + TEST_NAME + ' 様');
    Logger.log('  予約番号: ' + TEST_RESV_ID);
    Logger.log('  OTA   : ' + otaLabel);
    Logger.log('  件名  : ' + subject);
    Logger.log('---');
    Logger.log('受信箱を確認してください → ' + TO_EMAIL);
  } catch (err) {
    Logger.log('[TestSend] ❌ 送信失敗: ' + err.message);
    Logger.log('原因候補:');
    Logger.log('  1. reserve@rent-handyman.jp が Gmail エイリアスに登録されていない');
    Logger.log('  2. 送信先メールアドレスが不正');
    Logger.log('  3. Gmail APIスコープ未承認 → checkConfig 実行で再認可');
  }
}

/**
 * 🧪 テスト送信（実予約データ版）: DB から 指定予約IDを引いて実際にメール送信
 *   - 送信先は DB の customer_email
 *   - ScriptProperty 冪等性チェックは **バイパス**（テスト目的）
 *   - 件名に【テスト送信】を付与
 *   - 過去取込済の skyticket / airtrip 予約で動作確認したい場合に使用
 */
function testSendWelcomeMailByResvNo() {
  // ▼ 確認したい予約番号を入れる ▼
  var TARGET_RESV_NO = 'DY00000000XXX';   // skyticket例: DY00000000999 / エアトリ例: C260500XXX
  // ▲ ここまで ▲

  var cfg = getSupaCfg_();
  var url = cfg.url + '/rest/v1/reservations?id=eq.' + encodeURIComponent(TARGET_RESV_NO) + '&select=*';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('[TestSendByResv] ❌ DB取得失敗: HTTP ' + res.getResponseCode());
    return;
  }
  var rows = JSON.parse(res.getContentText() || '[]');
  if (!rows.length) {
    Logger.log('[TestSendByResv] ❌ 予約が見つかりません: ' + TARGET_RESV_NO);
    return;
  }
  var r = rows[0];
  Logger.log('[TestSendByResv] 予約取得:');
  Logger.log('  id          : ' + r.id);
  Logger.log('  name        : ' + r.name);
  Logger.log('  ota         : ' + r.ota);
  Logger.log('  customer_email: ' + r.customer_email);

  if (['S','O'].indexOf(r.ota) < 0) {
    Logger.log('[TestSendByResv] ⚠️ OTAが対象外 (S/O のみ): ' + r.ota);
    Logger.log('  対象外でも強制送信したい場合は ota を一時的に S/O に書き換えてください');
    return;
  }
  if (!r.customer_email || !/@/.test(r.customer_email)) {
    Logger.log('[TestSendByResv] ⚠️ メールアドレスが不正: ' + r.customer_email);
    return;
  }

  // 冪等性チェックをバイパスするため、送信済リストから一時的に除外
  var props = PropertiesService.getScriptProperties();
  var SENT_KEY = 'spk_welcome_sent_ids';
  var sentIds = (props.getProperty(SENT_KEY) || '').split(',').filter(function(x){return x;});
  var alreadySent = (sentIds.indexOf(r.id) >= 0);
  if (alreadySent) {
    Logger.log('[TestSendByResv] 既に送信済リストにあり → 一時的に除外して再送信');
    sentIds = sentIds.filter(function(x){return x !== r.id;});
    props.setProperty(SENT_KEY, sentIds.join(','));
  }

  // 件名に【テスト送信】プレフィックスを付けるため、ラッパー予約を作る
  var testResv = {
    id: '【TEST】' + r.id,
    ota: r.ota,
    name: r.name,
    customer_email: r.customer_email
  };
  var ok = sendReservationWelcomeEmail_(testResv);
  Logger.log('[TestSendByResv] 結果: ' + (ok ? '✅ 送信成功' : '❌ 送信失敗 or 対象外'));
  Logger.log('受信箱を確認してください → ' + r.customer_email);
}

/**
 * 🙇 お詫び+再送: 店名誤記の6件に札幌テンプレで再送信（2026-04-21）
 * - 那覇テンプレが札幌顧客11名に送信された障害の店名訂正
 * - 対象は金額相違なしの6件のみ（金額違う5件は別対応）
 * - R0A2UYY5（山口様）はご指摘メールへの返信として追加文言あり
 */
function resendApologyToSixCustomers() {
  var TARGETS = ['R02ZLN4R', 'R04A4WFY', 'R0PAFDNV', 'R04WYI54', 'R0FP9A0K', 'R0A2UYY5'];
  var YAMAGUCHI_ID = 'R0A2UYY5';
  var sent = [], failed = [];

  for (var i = 0; i < TARGETS.length; i++) {
    var resId = TARGETS[i];
    try {
      var rows = supabaseGet_('jalan_payments',
        'reservation_id=eq.' + encodeURIComponent(resId) +
        '&select=reservation_id,customer_name,customer_email,amount,lend_date,return_date,square_payment_url');
      if (!rows || rows.length === 0) {
        failed.push({id:resId, reason:'jalan_payments行なし'});
        continue;
      }
      var pay = rows[0];
      if (!pay.customer_email || !pay.square_payment_url) {
        failed.push({id:resId, reason:'email/url欠落'});
        continue;
      }

      var extraLine = (resId === YAMAGUCHI_ID)
        ? 'ご指摘をいただきありがとうございました。重ねてお詫び申し上げます。\n'
        : '';

      var subject = '【お詫び・再送】HANDYMAN 札幌デリバリー専門店 事前決済・LINE登録のお願い（予約番号: ' + pay.reservation_id + '）';

      var body = pay.customer_name + ' 様\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '【お詫び】\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '先ほどお送りしたメールにつきまして、当店の店舗名を誤って\n'
        + '「HANDYMAN 那覇空港店」と記載してお送りしてしまいました。\n'
        + '正しくは「HANDYMAN 札幌デリバリー専門店」でございます。\n\n'
        + 'ご予約内容（予約番号・金額・Square決済リンク）に変更はございません。\n'
        + 'お手数ですが、下記の正しいご案内にて改めてお願い申し上げます。\n'
        + 'この度は大変ご迷惑・ご混乱をおかけし、誠に申し訳ございません。\n'
        + extraLine
        + '\n━━━━━━━━━━━━━━━━━━━━\n\n'
        + 'この度はHANDYMAN札幌デリバリー専門店をご予約いただき、誠にありがとうございます。\n'
        + '予約番号: ' + pay.reservation_id + '\n'
        + '貸出日: ' + pay.lend_date + '\n'
        + '返却日: ' + pay.return_date + '\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '■ STEP1: LINE登録（必須）\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + 'デリバリー情報の入力・当日のご連絡はLINEで行います。\n'
        + '下記リンクから友だち追加をお願いいたします。\n\n'
        + 'LINE公式👉 https://lin.ee/g6iDNYz\n'
        + 'LINE ID👉 @730kyhwl\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '■ STEP2: 事前決済（HANDYMANではご出発までの「待ち時間」「待機時間」を解消するため事前決済をお願いしております。）\n'
        + '・現金決済をご希望の場合は大変お手数ですが事前にお問い合わせをお願い申しあげます。\n'
        + '・詳細はLINEにてご案内いたします。\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + 'お支払い金額: ¥' + (pay.amount||0).toLocaleString() + '\n'
        + '下記リンクよりお支払いをお願いいたします。\n'
        + pay.square_payment_url + '\n\n'
        + '※ ご出発3日前の19:00までにお支払いください。\n'
        + '※ 期限を過ぎた場合、ご予約をキャンセルさせていただく場合がございます。\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '■ ご注意事項\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '・当店は実店舗を持たないデリバリー専門店です。\n'
        + '・ご指定の場所へお車をお届け・ご回収いたします。\n'
        + '・詳細はLINEにてご案内いたします。\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + 'HANDYMAN 札幌デリバリー専門店\n'
        + 'TEL: 050-1724-6197（9:00〜19:00）\n'
        + 'LINE ID👉 @730kyhwl\n';

      GmailApp.sendEmail(pay.customer_email, subject, body, {
        name: 'HANDYMAN 札幌デリバリー専門店',
        from: 'reserve@rent-handyman.jp',
        replyTo: 'reserve@rent-handyman.jp'
      });
      sent.push({id:resId, name:pay.customer_name, email:pay.customer_email, amount:pay.amount});
      Logger.log('[ApologyResend] ✅ Sent: ' + resId + ' → ' + pay.customer_email);
      Utilities.sleep(500);
    } catch (e) {
      failed.push({id:resId, reason:e.message});
      Logger.log('[ApologyResend] ❌ Error: ' + resId + ' ' + e.message);
    }
  }

  // Slack通知
  var lines = ['🙇 *お詫び+再送メール 実行結果*', ''];
  lines.push('✅ 送信成功: ' + sent.length + '件');
  sent.forEach(function(x) { lines.push('  • ' + x.id + ' ' + x.name + ' ¥' + (x.amount||0).toLocaleString() + ' → ' + x.email); });
  if (failed.length > 0) {
    lines.push('');
    lines.push('❌ 送信失敗: ' + failed.length + '件');
    failed.forEach(function(x) { lines.push('  • ' + x.id + ' : ' + x.reason); });
  }
  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
  Logger.log('[ApologyResend] Summary: sent=' + sent.length + ' failed=' + failed.length);
}

// ★★★ 店舗判定ヘルパー（2026-05-14 追加・那覇通知が札幌に漏れる障害対策）★★★
//
// 旧仕様: checkPaymentStatus の振り分けは「スプシC列に『那覇』or『沖縄』含むか」だけ。
//         C列が空欄なら無条件で札幌(JALAN_PAY_CHANNEL)にデフォルトで流れていた。
//         → 那覇予約のC列が空欄で記録された3件が札幌チャンネルに通知され障害発生。
//
// 新仕様（3段階判定）:
//   Step 1. スプシC列が明示している場合はそれを信頼
//   Step 2. C列が空欄/不明 → 予約番号で Supabase 両テーブル(nha_accounting/spk_accounting)を照会
//   Step 3. それでも判定不能 → 両店チャンネルに警告付きで通知（札幌に勝手に流さない）
//
// 戻り値: { channels: [chan...], label: 表示用店舗名, warning: 警告文 or null, source: 'sheet'|'db'|'ambiguous'|'fallback' }
function resolvePaymentStore_(resvNo, sheetStore) {
  var NAHA_CH = 'C0AP2S5B147'; // #payment_naha
  var SPK_CH = JALAN_PAY_CHANNEL; // #payment_sapporo
  var s = String(sheetStore || '').trim();

  // Step 1: スプシC列が明示
  if (s.indexOf('那覇') >= 0 || s.indexOf('沖縄') >= 0) {
    return { channels: [NAHA_CH], label: s || '那覇空港店', warning: null, source: 'sheet' };
  }
  if (s.indexOf('札幌') >= 0) {
    return { channels: [SPK_CH], label: s || '札幌店', warning: null, source: 'sheet' };
  }

  // Step 2: C列が空欄/不明 → Supabase 両テーブル照合
  if (resvNo) {
    try {
      var enc = encodeURIComponent(resvNo);
      var nha = supabaseGet_('nha_accounting', 'resv_no=eq.' + enc + '&select=resv_no&limit=1');
      var spk = supabaseGet_('spk_accounting', 'resv_no=eq.' + enc + '&select=resv_no&limit=1');
      var nhaHit = !!(nha && nha.length > 0);
      var spkHit = !!(spk && spk.length > 0);
      if (nhaHit && !spkHit) {
        return { channels: [NAHA_CH], label: '那覇空港店（DB判定）', warning: 'スプシC列が空欄でした。予約番号でDB照合し那覇と判定。スプシC列の補修を推奨します。', source: 'db' };
      }
      if (spkHit && !nhaHit) {
        return { channels: [SPK_CH], label: '札幌店（DB判定）', warning: 'スプシC列が空欄でした。予約番号でDB照合し札幌と判定。スプシC列の補修を推奨します。', source: 'db' };
      }
      if (nhaHit && spkHit) {
        return { channels: [NAHA_CH, SPK_CH], label: '(両店該当)', warning: '予約番号が両店DBに存在しています。データ整合性を要確認。両店チャンネルに通知しました。', source: 'ambiguous' };
      }
    } catch (e) {
      Logger.log('[resolvePaymentStore_] DB query error: ' + e.message);
    }
  }

  // Step 3: 判定不能 → 両チャンネル通知（札幌だけに流さない）
  return { channels: [NAHA_CH, SPK_CH], label: '(判定不明)', warning: 'スプシC列空欄かつDB照合失敗。店舗判定不能のため両店チャンネルに通知。要手動確認＋スプシ補修。', source: 'fallback' };
}

// 動作確認用：手動実行で resolvePaymentStore_ の判定結果をログ出力
function testResolvePaymentStore() {
  var cases = [
    {resvNo:'SP-20260507-0001', store:'',           expect:'NHA (db判定)'},
    {resvNo:'SP-20260507-0002', store:'',           expect:'NHA (db判定)'},
    {resvNo:'SP-20260507-0003', store:'',           expect:'NHA (db判定)'},
    {resvNo:'',                 store:'',           expect:'fallback'},
    {resvNo:'TEST',             store:'札幌店',     expect:'SPK (sheet)'},
    {resvNo:'TEST',             store:'那覇空港店', expect:'NHA (sheet)'},
  ];
  cases.forEach(function(c) {
    var r = resolvePaymentStore_(c.resvNo, c.store);
    Logger.log('[Test] resvNo="' + c.resvNo + '" store="' + c.store + '" → source=' + r.source + ' channels=' + r.channels.join(',') + ' label=' + r.label + ' / expect=' + c.expect);
  });
}

// ★★★ 入金確認 v3（2026-04-17）★★★
function checkPaymentStatus() {
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('支払い管理');
  if (!sheet) { Logger.log('[PaymentStatus] Sheet not found'); updateHeartbeat_('spk_jalan_payment', {success:0, processed:0, error:'sheet_not_found'}); return; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { updateHeartbeat_('spk_jalan_payment', {success:0, processed:0}); return; }
  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  // 店舗別Slack通知先（那覇の入金通知を札幌チャンネルに出さない）
  var NAHA_PAY_CHANNEL = 'C0AP2S5B147'; // #payment_naha
  var unpaidRows = [];
  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][8] || '');
    var url = String(data[i][7] || '');
    var store = String(data[i][2] || '');
    // ★ 2026-05-08: '済' は「メール送信済」も誤マッチして未払い行から除外していた → '入金済' に厳密化
    // (R0SFCDMG ヤナギダ様の入金検知漏れ事故を契機に修正)
    if (status.indexOf('入金済') === -1 && status.indexOf('キャンセル') === -1 && status.indexOf('発行取消') === -1 && url) {
      unpaidRows.push({rowIndex:i+2, reservationId:String(data[i][3]||'').trim(), customerName:String(data[i][4]||'').replace(/様$/,'').trim(), amount:Number(data[i][6])||0, url:url.trim(), media:String(data[i][13]||'').trim(), store:store.trim(), orderId:null});
    }
  }
  if (unpaidRows.length === 0) { Logger.log('[PaymentStatus] No unpaid rows found'); updateHeartbeat_('spk_jalan_payment', {success:0, processed:0}); return; }
  Logger.log('[PaymentStatus] Checking ' + unpaidRows.length + ' unpaid rows');
  var token = getSquareToken_();
  if (!token) { Logger.log('[PaymentStatus] No SQUARE_API_TOKEN'); postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\nSQUARE_API_TOKENが未設定です。'); updateHeartbeat_('spk_jalan_payment', {success:0, processed:0, error:'no_token'}); return; }
  var linkMap = fetchPaymentLinkMap_(token);
  var linkMapSize = linkMap ? Object.keys(linkMap).length : 0;
  if (linkMapSize === 0) { Logger.log('[PaymentStatus] CRITICAL: Payment Links map is empty'); postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\nSquare Payment Links APIが0件を返しました。\n`debugPaymentV3` を手動実行して診断してください。'); updateHeartbeat_('spk_jalan_payment', {success:0, processed:0, error:'link_map_empty'}); return; }
  var orderIdsToCheck = [], unmatchedRows = [];
  for (var i = 0; i < unpaidRows.length; i++) {
    var normalizedUrl = normalizeSquareUrl_(unpaidRows[i].url);
    var orderId = linkMap[normalizedUrl];
    if (orderId) { unpaidRows[i].orderId = orderId; orderIdsToCheck.push(orderId); }
    else { unmatchedRows.push(unpaidRows[i].reservationId); Logger.log('[PaymentStatus] No URL match for ' + unpaidRows[i].reservationId); }
  }
  if (orderIdsToCheck.length === 0) { postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\nPayment Linksは'+linkMapSize+'件取得できましたが、スプシURLが1件もマッチしません。\n対象: ' + unmatchedRows.join(', ')); updateHeartbeat_('spk_jalan_payment', {success:0, processed:unpaidRows.length, error:'no_url_match'}); return; }
  var orderMap = batchRetrieveOrders_(token, orderIdsToCheck);
  if (!orderMap || Object.keys(orderMap).length === 0) { postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金確認システム障害*\nSquare Orders取得が0件です。'); updateHeartbeat_('spk_jalan_payment', {success:0, processed:unpaidRows.length, error:'orders_empty'}); return; }
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
        // ★ 2026-05-14: 店舗判定を fail-safe 化（C列空欄→DB照合→不明時は両店通知）
        var resolved = resolvePaymentStore_(pay.reservationId, pay.store);
        // ★ 2026-05-25: spk_accounting / nha_accounting の paid 更新を統合
        //   背景: HANDYMAN Payment Bot v1 の syncPaidToAccounting 経路が止まると、
        //         スプシ+Slack は更新されるが DB の paid=false が残り続け、
        //         APP TOP「予約外売上 未回収」に入金済レコードが残る障害が発生（2026-05-25 修正）
        //   仕様: 店舗判定結果 (resolved.channels) から対象テーブルを決定し paid=true に更新
        //         判定不明 (ambiguous/fallback) の場合は両店を試す（冪等：paid=eq.false 条件で多重更新なし）
        //   注意: spk_accounting / nha_accounting は paid_at カラムなし → paid のみ更新
        try {
          var acctTables = [];
          if (resolved.source === 'ambiguous' || resolved.source === 'fallback') {
            acctTables = ['nha_accounting', 'spk_accounting'];
          } else if (resolved.channels.indexOf('C0AP2S5B147') >= 0) {
            acctTables = ['nha_accounting'];
          } else {
            acctTables = ['spk_accounting'];
          }
          acctTables.forEach(function(tbl) {
            try {
              var okAcc = supabaseUpdate_(tbl,
                'resv_no=eq.' + encodeURIComponent(pay.reservationId) + '&paid=eq.false',
                { paid: true });
              if (okAcc) Logger.log('[PaymentStatus] ' + tbl + ' paid updated: ' + pay.reservationId);
            } catch(eAcc) { Logger.log('[PaymentStatus] ' + tbl + ' update error: ' + eAcc.message); }
          });
        } catch(eAcct) { Logger.log('[PaymentStatus] accounting update error: ' + eAcct.message); }
        var notifyText = '✅ *入金確認完了*\n予約番号： ' + pay.reservationId + '\n宛名： ' + pay.customerName + '\n金額： ¥' + pay.amount.toLocaleString() + (pay.media ? '\n媒体： ' + pay.media : '') + '\n店舗： ' + resolved.label + '\n判定根拠： ' + resolved.source + (resolved.warning ? '\n\n⚠️ ' + resolved.warning : '');
        resolved.channels.forEach(function(ch){ postToSlackChannel_(ch, notifyText); });
        Logger.log('[PaymentStatus] notified ' + pay.reservationId + ' → ' + resolved.channels.join(',') + ' (source=' + resolved.source + ')');
        Logger.log('[PaymentStatus] ✅ Paid: ' + pay.reservationId);
        paidCount++;
      }
    } catch (e) { Logger.log('[PaymentStatus] Error checking ' + pay.reservationId + ': ' + e.message); }
  }
  Logger.log('[PaymentStatus] Done. ' + paidCount + '/' + unpaidRows.length + ' confirmed paid');
  updateHeartbeat_('spk_jalan_payment', {success: paidCount, processed: unpaidRows.length});
}

function fetchPaymentLinkMap_(token) {
  var map = {}, cursor = null, fetched = 0;
  do {
    var apiUrl = 'https://connect.squareup.com/v2/online-checkout/payment-links?limit=100';
    if (cursor) apiUrl += '&cursor=' + encodeURIComponent(cursor);
    try {
      var resp = UrlFetchApp.fetch(apiUrl, {method:'get', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Square-Version':'2024-01-18'}, muteHttpExceptions:true});
      if (resp.getResponseCode() !== 200) { Logger.log('[PaymentLinks] API error ' + resp.getResponseCode()); break; }
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
  } while (cursor && fetched < 200);
  Logger.log('[PaymentLinks] Total map entries: ' + Object.keys(map).length);
  return map;
}

function normalizeSquareUrl_(url) { return String(url||'').trim().replace(/\/+$/,'').toLowerCase(); }

function batchRetrieveOrders_(token, orderIds) {
  var map = {}, unique = [], seen = {};
  orderIds.forEach(function(id) { if (!seen[id]) { unique.push(id); seen[id]=true; } });
  for (var i = 0; i < unique.length; i += 100) {
    try {
      var resp = UrlFetchApp.fetch('https://connect.squareup.com/v2/orders/batch-retrieve', {method:'post', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Square-Version':'2024-01-18'}, payload:JSON.stringify({location_id:'L8N7J9RKPN3WH', order_ids:unique.slice(i,i+100)}), muteHttpExceptions:true});
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
  // ★ 2026-05-10: 店舗振分け対応（checkPaymentStatus と同型）
  //   旧: 全件 JALAN_PAY_CHANNEL(札幌) に通知 → 那覇予約が札幌アラートに混入
  //   新: スプシC列「店舗」で札幌/那覇に振り分けて別チャンネルに通知
  var NAHA_PAY_CHANNEL = 'C0AP2S5B147'; // #payment_naha
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('支払い管理');
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var now = new Date();
  var alertsByCh = {}; alertsByCh[JALAN_PAY_CHANNEL] = []; alertsByCh[NAHA_PAY_CHANNEL] = [];
  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][8]||'');
    // ★ 2026-05-08: '済' → '入金済' に厳密化（メール送信済の誤マッチ防止）
    if (status.indexOf('入金済')!==-1 || status.indexOf('キャンセル')!==-1 || status.indexOf('発行取消')!==-1) continue;
    var store = String(data[i][2]||'').trim();
    var resvId = String(data[i][3]||'').trim(), name = String(data[i][4]||'').trim(), amount = Number(data[i][6])||0, url = String(data[i][7]||'').trim();
    if (!resvId || !url) continue;
    // ★ 2026-05-14: 店舗判定を fail-safe 化（C列空欄→DB照合→不明時は両店通知）
    var resolved = resolvePaymentStore_(resvId, store);
    var hasNaha = resolved.channels.indexOf(NAHA_PAY_CHANNEL) >= 0;
    var hasSpk = resolved.channels.indexOf(JALAN_PAY_CHANNEL) >= 0;
    var lendDate = null;
    if (hasNaha) {
      var nhaR = supabaseGet_('nha_reservations', 'id=eq.' + encodeURIComponent(resvId) + '&select=start_date');
      if (nhaR && nhaR.length > 0 && nhaR[0].start_date) lendDate = nhaR[0].start_date;
    }
    if (!lendDate && hasSpk) {
      var spkR = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(resvId) + '&select=lend_date');
      if (spkR && spkR.length > 0 && spkR[0].lend_date) lendDate = spkR[0].lend_date;
    }
    if (!lendDate) { var dm = String(data[i][5]||'').match(/(\d{2})\/(\d{2})/); if (dm) lendDate = now.getFullYear() + '-' + dm[1] + '-' + dm[2]; }
    if (!lendDate) continue;
    var diffDays = Math.floor((new Date(lendDate+'T00:00:00+09:00') - now) / 86400000);
    if (diffDays <= 3) {
      // 判定不能/両店該当時は両チャンネルにアラート（札幌に勝手に流さない）
      resolved.channels.forEach(function(ch) {
        alertsByCh[ch] = alertsByCh[ch] || [];
        alertsByCh[ch].push({reservationId:resvId, customerName:name, amount:amount, lendDate:lendDate, daysLeft:diffDays, store:resolved.label, warning:resolved.warning});
      });
    }
  }
  // チャンネル別に投稿
  Object.keys(alertsByCh).forEach(function(ch) {
    var alerts = alertsByCh[ch];
    if (!alerts || alerts.length === 0) return;
    var lines = ['🚨 *未入金アラート* ' + alerts.length + '件\n'];
    alerts.forEach(function(a) {
      var urgency = a.daysLeft<=0 ? '🔴期限超過' : a.daysLeft<=1 ? '🟠明日出発' : '🟡'+a.daysLeft+'日後';
      lines.push('• ' + a.reservationId + ' ' + a.customerName + ' ¥' + a.amount + '（出発: ' + a.lendDate + ' ' + urgency + '）');
    });
    lines.push('\n期限超過・要電話確認');
    postToSlackChannel_(ch, lines.join('\n'));
    Logger.log('[UnpaidAlert] ' + alerts.length + '件通知 → ' + ch);
  });
}

/**
 * 🚨 じゃらん決済起票漏れ監視（watchdog） — 2026-04-21 追加
 * 背景: R0XHDPI1でOTA自動登録GASが先に予約作成→メール取込GASの重複スキップで handleJalanPayment_ が呼ばれず、じゃらん決済が2時間起票されなかった。
 * 対策3層のうち第2層。コード修正(第1層)が再度外れても、1時間以内にSlack通知＋自動リトライする。
 *
 * 動作:
 *   1. reservations.ota='J' & price>0 & lend_date≥今日 & status≠cancelled を取得
 *   2. isSapporoReservation_で札幌予約に絞込（那覇は対象外）
 *   3. jalan_payments に対応行がない予約を検出
 *   4. handleJalanPayment_(r) を呼んで自動復旧を試みる（冪等）
 *   5. 結果をSlack #jalan_payment に投稿（復旧成功/失敗を区別）
 * トリガー: 毎時実行（setupWatchdogTrigger で設定）
 */
function watchdogJalanPayment() {
  try {
    var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    var resvs = supabaseGet_('reservations',
      'ota=eq.J&price=gt.0&lend_date=gte.' + today +
      '&status=neq.cancelled' +
      '&select=id,name,mail,price,lend_date,return_date,vehicle,del_place,col_place,status,ota' +
      '&order=lend_date.asc&limit=200'
    );
    if (!resvs || resvs.length === 0) { Logger.log('[Watchdog] No active じゃらん reservations'); return; }

    var missing = [], recovered = [], failed = [], uncertain = [];
    for (var i = 0; i < resvs.length; i++) {
      var r = resvs[i];
      // ★ 先に jalan_payments の有無を確認（起票済みなら店舗判定コスト不要＋ログも静かに）
      var pays = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(r.id) + '&select=id,status');
      if (pays && pays.length > 0) continue;   // 既に起票済み → OK

      // ★ 起票漏れ候補のみ札幌判定に入る（3段階フォールバック）
      var isSapporo = isSapporoReservation_(r);
      if (!isSapporo) {
        // 2段目: fleet テーブルに行があれば札幌（那覇は nha_fleet を使うため）
        var fleetRows = supabaseGet_('fleet', 'reservation_id=eq.' + encodeURIComponent(r.id) + '&select=vehicle_code');
        if (fleetRows && fleetRows.length > 0) {
          isSapporo = true;
          Logger.log('[Watchdog] ' + r.id + ' → Sapporo (fleet lookup fallback)');
        }
      }

      if (!isSapporo) {
        // 札幌か那覇か判定できない → 自動起票せず要人手確認リストへ
        uncertain.push({id:r.id, name:r.name, amount:r.price, lend:r.lend_date});
        continue;
      }

      missing.push(r);
      try {
        handleJalanPayment_(r);
        Utilities.sleep(1500);  // Square API + DB書込みの完了待ち
        var verify = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(r.id) + '&select=id,status');
        if (verify && verify.length > 0) {
          recovered.push({id:r.id, name:r.name, amount:r.price, status:verify[0].status});
        } else {
          failed.push({id:r.id, name:r.name, amount:r.price, reason:'handleJalanPayment_ called but no row'});
        }
      } catch (e) {
        failed.push({id:r.id, name:r.name, amount:r.price, reason:e.message});
      }
    }

    if (missing.length === 0 && uncertain.length === 0) {
      Logger.log('[Watchdog] OK - all じゃらん reservations have jalan_payments rows');
      return;
    }

    var lines = [];
    if (missing.length > 0) {
      lines.push('🚨 *じゃらん決済起票漏れ検知* ' + missing.length + '件');
      lines.push('');
      if (recovered.length > 0) {
        lines.push('✅ *自動復旧成功 ' + recovered.length + '件*');
        recovered.forEach(function(x) { lines.push('  • ' + x.id + ' ' + (x.name||'') + ' ¥' + (x.amount||0) + ' → ' + x.status); });
        lines.push('');
      }
      if (failed.length > 0) {
        lines.push('❌ *自動復旧失敗 ' + failed.length + '件（要手動対応）*');
        failed.forEach(function(x) { lines.push('  • ' + x.id + ' ' + (x.name||'') + ' ¥' + (x.amount||0) + ' : ' + x.reason); });
        lines.push('');
      }
    }
    if (uncertain.length > 0) {
      lines.push('⚠️ *店舗判定不能 ' + uncertain.length + '件（要人手確認）*');
      lines.push('jalan_payments に行なし・札幌/那覇の判別不能 → 自動起票していません');
      uncertain.forEach(function(x) { lines.push('  • ' + x.id + ' ' + (x.name||'') + ' ¥' + (x.amount||0) + ' 貸出:' + (x.lend||'?')); });
    }
    postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
    Logger.log('[Watchdog] missing=' + missing.length + ' recovered=' + recovered.length + ' failed=' + failed.length + ' uncertain=' + uncertain.length);
  } catch (e) {
    Logger.log('[Watchdog] Exception: ' + e.message);
    try { postToSlackChannel_(JALAN_PAY_CHANNEL, '⚠️ *Watchdog例外*\n' + e.message); } catch(_){}
  }
}

/**
 * 🔍 Watchdogで復旧した10件の安全性診断（2026-04-21 緊急追加）
 * - 各予約の booked_at / lend_date / 旧Square URL / メール送信履歴を一覧化
 * - 「新Squareリンクでメール送信してOK」か「人手確認必要」かを判定
 */
function diagnoseRecoveredPayments() {
  var ids = ['R0Q7UEF3','R0742RTL','R02XF89Q','R02ZLN4R','R04A4WFY','R0PAFDNV','R0CYV6NR','R0A2UYY5','R0GRD083','R04WYI54','R0FP9A0K'];
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('支払い管理');
  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow-1, 14).getValues();
  var byResv = {};
  data.forEach(function(row, idx) {
    var rid = String(row[3]||'').trim();
    if (!rid) return;
    if (!byResv[rid]) byResv[rid] = [];
    byResv[rid].push({sheetRow:idx+2, issueDate:row[1], url:String(row[7]||''), status:String(row[8]||''), paidDate:row[9]||'', orderId:row[10]||''});
  });

  Logger.log('===== Watchdog復旧予約 安全性診断 =====');
  var sendOK = [], needReview = [];
  ids.forEach(function(id) {
    var resv = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(id) + '&select=id,name,mail,price,lend_date,status,ota,booked_at,created_at');
    var pay = supabaseGet_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(id) + '&select=id,status,amount,square_payment_url,email_sent_at,created_at,paid_at');
    var sheetRows = byResv[id] || [];
    var r = (resv && resv[0]) || {}, p = (pay && pay[0]) || {};
    var flag = '';
    var reasons = [];
    // 複数シート行 = 過去に別URLで決済試行あり
    if (sheetRows.length > 1) { reasons.push('スプシに'+sheetRows.length+'行（過去URL複数）'); flag='REVIEW'; }
    // スプシ行が入金済み = 既に支払い済み
    // ★ 2026-05-08: '済' → '入金済' に厳密化（メール送信済の誤マッチ防止）
    var anyPaid = sheetRows.some(function(s){return s.status.indexOf('入金済')>=0;});
    if (anyPaid) { reasons.push('スプシに入金済み行あり'); flag='REVIEW'; }
    // 貸出日が近い
    var today = new Date(); today.setHours(0,0,0,0);
    if (r.lend_date) {
      var ld = new Date(r.lend_date+'T00:00:00+09:00');
      var days = Math.floor((ld - today)/86400000);
      if (days < 0) { reasons.push('貸出日超過'); flag='REVIEW'; }
      else if (days <= 3) reasons.push('貸出'+days+'日後・急ぎ');
    }
    // 予約日（古い予約 = 他チャネルで決済済みリスク）
    if (r.booked_at || r.created_at) {
      var bd = new Date(r.booked_at || r.created_at);
      var ageDays = Math.floor((today - bd)/86400000);
      if (ageDays > 14) { reasons.push('予約作成から'+ageDays+'日経過（要確認）'); if(flag!=='REVIEW') flag='REVIEW'; }
    }
    if (!flag) flag = 'SAFE';
    var line = '[' + flag + '] ' + id + ' ' + (r.name||'?') + ' ¥' + (r.price||0) + ' 貸出=' + (r.lend_date||'?') + ' 予約日=' + (r.booked_at||r.created_at||'?').slice(0,10) + ' メール=' + (r.mail||'?');
    if (reasons.length > 0) line += ' ← ' + reasons.join(' / ');
    if (sheetRows.length > 0) line += ' [スプシ行数=' + sheetRows.length + ' 最新状態=' + (sheetRows[sheetRows.length-1].status||'?') + ']';
    Logger.log(line);
    if (flag === 'SAFE') sendOK.push(id); else needReview.push({id:id, reasons:reasons, mail:r.mail, amount:r.price});
  });

  Logger.log('');
  Logger.log('===== 集計 =====');
  Logger.log('✅ メール送信OK ' + sendOK.length + '件: ' + sendOK.join(', '));
  Logger.log('⚠️ 要人手確認 ' + needReview.length + '件: ' + needReview.map(function(x){return x.id;}).join(', '));

  // Slack通知
  var lines = ['🔍 *Watchdog復旧11件の安全性診断*', ''];
  lines.push('✅ 新リンクでメール送信OK: ' + sendOK.length + '件');
  sendOK.forEach(function(id) { lines.push('  • ' + id); });
  if (needReview.length > 0) {
    lines.push('');
    lines.push('⚠️ 要人手確認: ' + needReview.length + '件（checkSquareLinksトリガー停止推奨）');
    needReview.forEach(function(x) { lines.push('  • ' + x.id + ' ¥' + (x.amount||0) + ' : ' + x.reasons.join(', ')); });
    lines.push('');
    lines.push('→ 各予約でお客様への確認電話 → 入金済みならDB `jalan_payments.status=paid` 手動更新 → 新リンクは無効化');
  }
  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
}

/**
 * 🛑 Watchdog復旧予約のメール送信を一時停止（checkSquareLinksトリガー削除）
 */
function pauseCheckSquareLinks() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkSquareLinks') { ScriptApp.deleteTrigger(t); removed++; }
  });
  Logger.log('checkSquareLinks トリガー削除: ' + removed + '件');
  postToSlackChannel_(JALAN_PAY_CHANNEL, '🛑 *checkSquareLinks トリガー一時停止*\n削除数: ' + removed + '件\n→ メール自動送信が止まりました。安全確認後 setupJalanPaymentTriggers で再設定してください。');
}

/**
 * Watchdog用トリガー設定（1回だけ手動実行）
 */
function setupWatchdogTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'watchdogJalanPayment') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('watchdogJalanPayment').timeBased().everyHours(1).create();
  Logger.log('[Watchdog] Trigger set: every 1 hour');
}

function appendToPaymentSheet_(pay, payUrl) {
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
    sheet.appendRow([lastRow, Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy/MM/dd'), '札幌店', pay.reservation_id, (pay.customer_name||'')+'様', 'じゃらん事前決済('+lendShort+'-'+retShort+')', pay.amount||0, payUrl||pay.square_payment_url||'', '⏳ 未払い', '', '', pay.slack_ts||'', JALAN_PAY_CHANNEL||'', 'じゃらん']);
    Logger.log('[Sheet] Appended: ' + pay.reservation_id);
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

function fixR0R8QVZR() {
  updatePaymentSheetStatus_('R0R8QVZR', '✅ 入金済み', '2026-04-04T11:23:48Z');
  Logger.log('R0R8QVZR → 入金済みに更新。この関数は削除してOK。');
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

function debugPaymentV3() {
  var token = getSquareToken_();
  if (!token) { Logger.log('No SQUARE_API_TOKEN'); return; }
  Logger.log('=== Phase 1: Payment Links API ===');
  var linkMap = fetchPaymentLinkMap_(token);
  var linkUrls = Object.keys(linkMap);
  Logger.log('Payment Links取得数: ' + linkUrls.length);
  linkUrls.slice(0,5).forEach(function(url,i) { Logger.log('  ['+i+'] url='+url+' → order_id='+linkMap[url]); });
  Logger.log('=== Phase 2: スプシURL照合 ===');
  var ss = SpreadsheetApp.openById('1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc');
  var sheet = ss.getSheetByName('支払い管理');
  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow-1, 14).getValues();
  var matchedIds = [];
  data.forEach(function(row) {
    var status = String(row[8]||''), url = String(row[7]||'').trim();
    // ★ 2026-05-08: '済' → '入金済' に厳密化（メール送信済の誤マッチ防止）
    if (status.indexOf('入金済')!==-1 || status.indexOf('キャンセル')!==-1 || status.indexOf('発行取消')!==-1 || !url) return;
    var resvId = String(row[3]||'').trim(), name = String(row[4]||'').trim(), amount = Number(row[6])||0;
    var normalizedUrl = normalizeSquareUrl_(url), orderId = linkMap[normalizedUrl];
    Logger.log('  スプシ未払い: '+resvId+' '+name+' ¥'+amount);
    Logger.log('    URL: '+url+'\n    正規化URL: '+normalizedUrl+'\n    → order_id: '+(orderId||'❌ NOT FOUND'));
    if (orderId) matchedIds.push(orderId);
  });
  if (matchedIds.length > 0) {
    Logger.log('=== Phase 3: Orders tenders確認 ===');
    var orderMap = batchRetrieveOrders_(token, matchedIds);
    for (var oid in orderMap) {
      var order = orderMap[oid], hasTenders = order.tenders && order.tenders.length > 0;
      Logger.log('  order='+oid+' total=¥'+(order.total_money?order.total_money.amount:0)+' tenders='+(hasTenders?'✅'+order.tenders.length+'件':'❌なし')+' net_due='+(order.net_amount_due_money?order.net_amount_due_money.amount:'?'));
      if (hasTenders) Logger.log('    paid_at='+order.tenders[0].created_at);
    }
  }
  Logger.log('=== debugPaymentV3 完了 ===');
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
  // ★ 2026-05-02: 早期return時もheartbeat更新するよう構造変更
  var token = getSlackBotToken_();
  if (!token) {
    Logger.log('[SlackResv] SLACK_BOT_TOKEN not set. Skipping.');
    updateHeartbeat_('spk_slack_resv', {success:0, failure:0, processed:0, error:'no_token'});
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
    updateHeartbeat_('spk_slack_resv', {success:0, failure:0, processed:0, error:'slack_api_error'});
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
  updateHeartbeat_('spk_slack_resv', {success: success, failure: failed, processed: success + failed + skipped});
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
  // ★ 2026-05-18: UrlFetchApp クォータ節約のため 1分 → 5分間隔 に緩和
  //    1分間隔 = 1日 1,440回実行 → 5分間隔 = 1日 288回 (80%削減)
  //    業務影響: Slack予約登録の処理遅延が最大1分 → 最大5分（許容範囲）
  ScriptApp.newTrigger('processSlackReservations')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Slack予約取込トリガー設定完了（5分間隔 / Events APIフォールバック）');
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

// ============================================================
// 金額相違5件診断（2026-04-21）
// 対象: R0Q7UEF3 / R0742RTL / R02XF89Q / R0CYV6NR / R0GRD083
// 目的: 元じゃらんメールから「利用者への請求額」を抽出し、
//       現在のDB金額との差分を確認する（送信・変更なし）
// ============================================================
function diagnoseFiveAmountDiscrepancies() {
  var TARGETS = ['R0Q7UEF3', 'R0742RTL', 'R02XF89Q', 'R0CYV6NR', 'R0GRD083'];
  var results = [];

  for (var i = 0; i < TARGETS.length; i++) {
    var resId = TARGETS[i];
    var result = { id: resId };
    try {
      // 1. jalan_payments 現在状態（square_order_id カラムは存在しないので除外）
      var dbRows = supabaseGet_('jalan_payments',
        'reservation_id=eq.' + encodeURIComponent(resId) +
        '&select=reservation_id,customer_name,customer_email,amount,square_payment_url,lend_date,return_date,status,slack_ts,created_at,email_sent_at,paid_at');
      result.db = (dbRows && dbRows[0]) ? dbRows[0] : null;

      // 2. reservations 状態
      var resvRows = supabaseGet_('reservations',
        'id=eq.' + encodeURIComponent(resId) +
        '&select=id,price,base_price,option_price,discount');
      result.resv = (resvRows && resvRows[0]) ? resvRows[0] : null;

      // 3. 元じゃらんメール検索（OTA_SENDERS.jalan と一致させる）
      var threads = GmailApp.search('from:' + OTA_SENDERS.jalan + ' ' + resId, 0, 10);
      var found = null;
      for (var t = 0; t < threads.length && !found; t++) {
        var msgs = threads[t].getMessages();
        for (var m = 0; m < msgs.length && !found; m++) {
          var body = msgs[m].getPlainBody();
          if (body.indexOf(resId) < 0) continue;
          if (body.indexOf('利用者への請求額') < 0 && body.indexOf('合計金額') < 0) continue;
          found = { subject: msgs[m].getSubject(), date: msgs[m].getDate(), body: body };
        }
      }

      if (found) {
        // 利用者への請求額を抽出
        var mRequest = found.body.match(/利用者への請求額[\s\S]{0,100}?([\d,]+)\s*円/);
        var mTotal   = found.body.match(/合計金額[\s\S]{0,100}?([\d,]+)\s*円/);
        var mCoupon  = found.body.match(/クーポン[\s\S]{0,100}?([\d,]+)\s*円/);
        var mPoint   = found.body.match(/ポイント[\s\S]{0,100}?([\d,]+)\s*円/);

        result.email = {
          date: Utilities.formatDate(found.date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
          subject: found.subject,
          requestAmount: mRequest ? parseInt(mRequest[1].replace(/,/g,''), 10) : null,
          totalAmount: mTotal ? parseInt(mTotal[1].replace(/,/g,''), 10) : null,
          couponAmount: mCoupon ? parseInt(mCoupon[1].replace(/,/g,''), 10) : null,
          pointAmount: mPoint ? parseInt(mPoint[1].replace(/,/g,''), 10) : null
        };

        // parseJalan_ で再パースした値も参考に
        try {
          var parsed = parseJalan_(found.body);
          if (parsed) {
            result.parsed = {
              price: parsed.price,
              base_price: parsed.base_price,
              option_price: parsed.option_price,
              discount: parsed.discount
            };
          }
        } catch(e) { result.parseError = e.message; }
      } else {
        result.emailMissing = true;
      }
    } catch (e) {
      result.error = e.message;
    }
    results.push(result);
  }

  // Slack出力
  var lines = ['🔍 *金額相違5件 診断結果*', ''];
  results.forEach(function(r) {
    lines.push('━━━━━━━━━━━━━━━━━━');
    var name = (r.db && r.db.customer_name) ? r.db.customer_name : '(DB行なし)';
    lines.push('*' + r.id + '* ' + name);

    if (r.error) {
      lines.push('  ❌ エラー: ' + r.error);
      return;
    }
    if (r.db) {
      lines.push('  DB amount      : ¥' + (r.db.amount||0).toLocaleString());
      lines.push('  DB status      : ' + (r.db.status||''));
      lines.push('  DB email       : ' + (r.db.customer_email||'(なし)'));
      lines.push('  現Square URL   : ' + (r.db.square_payment_url||'(なし)'));
      lines.push('  email_sent_at  : ' + (r.db.email_sent_at||'(未送信)'));
      lines.push('  paid_at        : ' + (r.db.paid_at||'(未入金)'));
      lines.push('  created_at     : ' + (r.db.created_at||''));
    }
    if (r.resv) {
      lines.push('  resv price     : ¥' + (r.resv.price||0).toLocaleString() +
                 ' (bp:¥' + (r.resv.base_price||0).toLocaleString() +
                 ' + op:¥' + (r.resv.option_price||0).toLocaleString() +
                 ' - dc:¥' + (r.resv.discount||0).toLocaleString() + ')');
    }
    if (r.email) {
      lines.push('  📧 元メール (' + r.email.date + ')');
      if (r.email.requestAmount != null) lines.push('  ★ 利用者への請求額: ¥' + r.email.requestAmount.toLocaleString());
      if (r.email.totalAmount   != null) lines.push('     合計金額        : ¥' + r.email.totalAmount.toLocaleString());
      if (r.email.couponAmount  != null) lines.push('     クーポン        : -¥' + r.email.couponAmount.toLocaleString());
      if (r.email.pointAmount   != null) lines.push('     ポイント        : -¥' + r.email.pointAmount.toLocaleString());
      if (r.db && r.email.requestAmount != null && r.db.amount !== r.email.requestAmount) {
        var diff = r.email.requestAmount - (r.db.amount||0);
        lines.push('  ⚠️ 差額        : ' + (diff > 0 ? '+' : '') + '¥' + diff.toLocaleString());
      }
      if (r.parsed) {
        lines.push('  (参考) parseJalan_: price=¥' + (r.parsed.price||0).toLocaleString() +
                   ' dc=¥' + (r.parsed.discount||0).toLocaleString());
      }
    } else if (r.emailMissing) {
      lines.push('  ❌ 元メール未検出');
    }
  });

  var msg = lines.join('\n');
  Logger.log(msg);
  try { postToSlackChannel_(JALAN_PAY_CHANNEL, msg); } catch(e) { Logger.log('Slack post失敗: ' + e.message); }
  return results;
}

// ============================================================
// 金額相違5件 新請求書発行（2026-04-21）
// 対象: R0Q7UEF3 / R0742RTL / R02XF89Q / R0CYV6NR / R0GRD083
// 動作:
//   1. checkSquareLinks トリガー自動停止（安全策）
//   2. 旧Squareリンクを DELETE API で無効化
//   3. 新Squareリンクを正しい金額で発行
//   4. jalan_payments 更新（amount/url/status→link_created/email_sent_at→null）
//   5. スプシ更新（金額・URL・ステータス戻し）
// 送信は一切しない（メール再送は STEP 4 の別関数で承認後）
// ============================================================
function reissueFivePaymentLinks() {
  var CORRECTIONS = {
    'R0Q7UEF3': 16300,   // クロキ ミヨコ ¥19,300 → ¥16,300
    'R0742RTL': 52050,   // ニシモト ケイゴ ¥55,950 → ¥52,050
    'R02XF89Q': 27000,   // コンノ ヒロキ ¥30,000 → ¥27,000
    'R0CYV6NR': 17000,   // サカモト リョウタ ¥21,300 → ¥17,000
    'R0GRD083': 78200    // ヨシダ タカシ ¥78,600 → ¥78,200
  };

  // 1. checkSquareLinks トリガーを自動停止（冪等）
  var trgRemoved = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkSquareLinks') { ScriptApp.deleteTrigger(t); trgRemoved++; }
  });
  Logger.log('[Reissue] checkSquareLinks トリガー停止: ' + trgRemoved + '件');

  var token = getSquareToken_();
  if (!token) { Logger.log('[Reissue] SQUARE_API_TOKEN not set'); return; }

  // 2. 全 Payment Links を取得して URL → payment_link_id マップを作る
  var linkIdMap = {};
  var cursor = null, fetched = 0;
  do {
    var apiUrl = 'https://connect.squareup.com/v2/online-checkout/payment-links?limit=100';
    if (cursor) apiUrl += '&cursor=' + encodeURIComponent(cursor);
    try {
      var resp = UrlFetchApp.fetch(apiUrl, {method:'get', headers:{'Authorization':'Bearer '+token,'Square-Version':'2024-01-18'}, muteHttpExceptions:true});
      if (resp.getResponseCode() !== 200) { Logger.log('[Reissue] Payment Links API error ' + resp.getResponseCode()); break; }
      var data = JSON.parse(resp.getContentText());
      (data.payment_links||[]).forEach(function(link) {
        if (link.id) {
          if (link.url) linkIdMap[normalizeSquareUrl_(link.url)] = link.id;
          if (link.long_url) linkIdMap[normalizeSquareUrl_(link.long_url)] = link.id;
        }
      });
      fetched += (data.payment_links||[]).length;
      cursor = data.cursor;
    } catch (e) { Logger.log('[Reissue] Payment Links fetch error: ' + e.message); break; }
  } while (cursor && fetched < 500);
  Logger.log('[Reissue] Payment Links取得: ' + Object.keys(linkIdMap).length + '件');

  var succeeded = [], failed = [];
  var targets = Object.keys(CORRECTIONS);
  for (var i = 0; i < targets.length; i++) {
    var resId = targets[i];
    var correctAmount = CORRECTIONS[resId];
    try {
      // A. 現在のjalan_payments状態
      var rows = supabaseGet_('jalan_payments',
        'reservation_id=eq.' + encodeURIComponent(resId) +
        '&select=reservation_id,customer_name,customer_email,amount,lend_date,return_date,square_payment_url,slack_ts,status');
      if (!rows || rows.length === 0) { failed.push({id:resId, reason:'jalan_payments行なし'}); continue; }
      var pay = rows[0];
      var oldAmount = pay.amount || 0;
      var oldUrl = pay.square_payment_url || '';

      // B. 旧リンク無効化（Square DELETE）
      var oldLinkId = linkIdMap[normalizeSquareUrl_(oldUrl)];
      var oldDeactivated = false;
      var oldDeactReason = '';
      if (!oldLinkId) {
        oldDeactReason = '旧URLからID特定不可';
        Logger.log('[Reissue] ' + resId + ' 旧リンクID未検出: ' + oldUrl);
      } else {
        try {
          var delResp = UrlFetchApp.fetch('https://connect.squareup.com/v2/online-checkout/payment-links/' + oldLinkId, {
            method: 'delete',
            headers: {'Authorization':'Bearer '+token,'Square-Version':'2024-01-18'},
            muteHttpExceptions: true
          });
          var dCode = delResp.getResponseCode();
          oldDeactivated = (dCode >= 200 && dCode < 300);
          if (!oldDeactivated) {
            oldDeactReason = 'DELETE ' + dCode + ': ' + delResp.getContentText().slice(0,200);
            Logger.log('[Reissue] ' + resId + ' 旧リンク無効化失敗: ' + oldDeactReason);
          } else {
            Logger.log('[Reissue] ' + resId + ' 旧リンク無効化成功: ' + oldLinkId);
          }
        } catch (e) { oldDeactReason = 'DELETE例外: ' + e.message; }
      }

      // C. 新リンク発行（正しい金額）
      var lendShort = (pay.lend_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
      var retShort = (pay.return_date||'').replace(/^\d{4}-/,'').replace(/-/g,'/');
      var itemName = '札幌店 ' + (pay.customer_name||'') + '様（' + resId + '） じゃらん事前決済 ' + lendShort + '-' + retShort;
      var newUrl = createSquarePaymentLink_(itemName, correctAmount);
      if (!newUrl) {
        failed.push({id:resId, reason:'Square API 失敗 (新リンク発行)', oldAmount:oldAmount, newAmount:correctAmount});
        continue;
      }

      // D. DB更新
      var patched = supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId), {
        amount: correctAmount,
        square_payment_url: newUrl,
        status: 'link_created',
        email_sent_at: null,
        link_created_at: new Date().toISOString()
      });
      if (!patched) Logger.log('[Reissue] ' + resId + ' DB patch 失敗');

      // E. スプシ更新（支払い管理シート）
      var sheetUpdated = false;
      try {
        var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
        var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('支払い管理');
        if (sheet) {
          var lastRow = sheet.getLastRow();
          if (lastRow >= 2) {
            var resIdCol = sheet.getRange(2, 4, lastRow-1, 1).getValues();
            for (var si = 0; si < resIdCol.length; si++) {
              if (String(resIdCol[si][0]).trim() === resId) {
                sheet.getRange(si+2, 7).setValue(correctAmount);      // 金額(G)
                sheet.getRange(si+2, 8).setValue(newUrl);             // URL(H)
                sheet.getRange(si+2, 9).setValue('⏳ 未払い');         // ステータス(I)
                sheet.getRange(si+2, 10).setValue('');                // 入金日(J)クリア
                sheet.getRange(si+2, 11).setValue('');                // OrderID(K)クリア
                sheetUpdated = true;
                Logger.log('[Reissue] ' + resId + ' スプシ更新: 行' + (si+2));
                break;
              }
            }
          }
        }
      } catch (e) { Logger.log('[Reissue] スプシ更新エラー ' + resId + ': ' + e.message); }

      succeeded.push({
        id:resId, name:pay.customer_name||'',
        oldAmount:oldAmount, newAmount:correctAmount, diff:(oldAmount-correctAmount),
        oldUrl:oldUrl, newUrl:newUrl,
        oldDeactivated:oldDeactivated, oldDeactReason:oldDeactReason,
        dbPatched: !!patched, sheetUpdated:sheetUpdated
      });
      Utilities.sleep(800);
    } catch (e) {
      failed.push({id:resId, reason:'例外: ' + e.message});
      Logger.log('[Reissue] ' + resId + ' 例外: ' + e.message);
    }
  }

  // F. Slack通知
  var lines = ['💰 *金額相違5件 新請求書発行 実行結果*', ''];
  lines.push('⚠️ checkSquareLinks トリガー停止: ' + trgRemoved + '件（安全のため再送完了後に setupJalanPaymentTriggers で再設定）');
  lines.push('');
  lines.push('✅ 成功: ' + succeeded.length + '件');
  succeeded.forEach(function(s) {
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push('• *' + s.id + '* ' + s.name);
    lines.push('  金額: ¥' + s.oldAmount.toLocaleString() + ' → ¥' + s.newAmount.toLocaleString() + '（差額 -¥' + s.diff.toLocaleString() + '）');
    lines.push('  旧リンク無効化: ' + (s.oldDeactivated ? '✅' : '❌ ' + s.oldDeactReason));
    lines.push('  旧URL: ' + s.oldUrl);
    lines.push('  新URL: ' + s.newUrl);
    lines.push('  DB更新: ' + (s.dbPatched?'✅':'❌') + ' / スプシ更新: ' + (s.sheetUpdated?'✅':'❌'));
  });
  if (failed.length > 0) {
    lines.push('');
    lines.push('❌ 失敗: ' + failed.length + '件');
    failed.forEach(function(x) { lines.push('  • ' + x.id + ' : ' + x.reason); });
  }
  lines.push('');
  lines.push('📧 次のSTEP: お客様への「お詫び+新金額+新リンク」再送は `resendApologyToFiveCustomers` を手動実行');
  var msg = lines.join('\n');
  Logger.log(msg);
  try { postToSlackChannel_(JALAN_PAY_CHANNEL, msg); } catch(e) { Logger.log('Slack post失敗: ' + e.message); }
  return {succeeded:succeeded, failed:failed};
}

// ============================================================
// 金額相違5件 お詫び+新リンクでメール再送（2026-04-21）
// 前提: reissueFivePaymentLinks 実行済み（新URL・新金額がDBに反映されている）
// 動作: jalan_payments から最新URL・金額を取得し、お詫び文頭+札幌テンプレでメール送信
// ============================================================
function resendApologyToFiveCustomers() {
  // 旧金額（差額表示用） - reissueFivePaymentLinks と同一
  var OLD_AMOUNTS = {
    'R0Q7UEF3': 19300,
    'R0742RTL': 55950,
    'R02XF89Q': 30000,
    'R0CYV6NR': 21300,
    'R0GRD083': 78600
  };
  var TARGETS = Object.keys(OLD_AMOUNTS);
  var sent = [], failed = [];

  for (var i = 0; i < TARGETS.length; i++) {
    var resId = TARGETS[i];
    try {
      var rows = supabaseGet_('jalan_payments',
        'reservation_id=eq.' + encodeURIComponent(resId) +
        '&select=reservation_id,customer_name,customer_email,amount,lend_date,return_date,square_payment_url,status');
      if (!rows || rows.length === 0) { failed.push({id:resId, reason:'jalan_payments行なし'}); continue; }
      var pay = rows[0];
      if (!pay.customer_email || !pay.square_payment_url) { failed.push({id:resId, reason:'email/url欠落'}); continue; }

      var oldAmount = OLD_AMOUNTS[resId];
      var newAmount = pay.amount || 0;
      var diff = oldAmount - newAmount;
      if (newAmount === oldAmount) { failed.push({id:resId, reason:'DB金額が旧金額のまま(reissue未実行の可能性)'}); continue; }

      var subject = '【お詫び・再送】HANDYMAN 札幌デリバリー専門店 事前決済金額訂正のお願い（予約番号: ' + pay.reservation_id + '）';

      var body = pay.customer_name + ' 様\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '【重要なお詫び】\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '先ほどお送りしたメールにつきまして、下記2点に誤りがございました。\n\n'
        + '① 店舗名の誤り\n'
        + '  誤: HANDYMAN 那覇空港店\n'
        + '  正: HANDYMAN 札幌デリバリー専門店\n\n'
        + '② 請求金額の誤り\n'
        + '  誤: ¥' + oldAmount.toLocaleString() + '\n'
        + '  正: ¥' + newAmount.toLocaleString() + '（差額 -¥' + diff.toLocaleString() + '）\n\n'
        + 'じゃらん決済におけるクーポン・ポイントを差し引く前の金額で\n'
        + '請求してしまっておりました。心よりお詫び申し上げます。\n\n'
        + '【ご重要】\n'
        + '先ほどお送りしたSquare決済リンクは既に無効化済みです。\n'
        + 'お支払いは必ず下記の新しい決済リンクよりお願いいたします。\n'
        + '旧リンクからはお支払いいただけませんのでご注意ください。\n\n'
        + 'この度は大変ご迷惑・ご混乱をおかけし、誠に申し訳ございません。\n'
        + '━━━━━━━━━━━━━━━━━━━━\n\n'
        + 'この度はHANDYMAN札幌デリバリー専門店をご予約いただき、誠にありがとうございます。\n'
        + '予約番号: ' + pay.reservation_id + '\n'
        + '貸出日: ' + pay.lend_date + '\n'
        + '返却日: ' + pay.return_date + '\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '■ STEP1: LINE登録（必須）\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + 'デリバリー情報の入力・当日のご連絡はLINEで行います。\n'
        + '下記リンクから友だち追加をお願いいたします。\n\n'
        + 'LINE公式👉 https://lin.ee/g6iDNYz\n'
        + 'LINE ID👉 @730kyhwl\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '■ STEP2: 事前決済（HANDYMANではご出発までの「待ち時間」「待機時間」を解消するため事前決済をお願いしております。）\n'
        + '・現金決済をご希望の場合は大変お手数ですが事前にお問い合わせをお願い申しあげます。\n'
        + '・詳細はLINEにてご案内いたします。\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + 'お支払い金額: ¥' + newAmount.toLocaleString() + '\n'
        + '下記リンクよりお支払いをお願いいたします。\n'
        + pay.square_payment_url + '\n\n'
        + '※ ご出発3日前の19:00までにお支払いください。\n'
        + '※ 期限を過ぎた場合、ご予約をキャンセルさせていただく場合がございます。\n\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '■ ご注意事項\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + '・当店は実店舗を持たないデリバリー専門店です。\n'
        + '・ご指定の場所へお車をお届け・ご回収いたします。\n'
        + '・詳細はLINEにてご案内いたします。\n'
        + '━━━━━━━━━━━━━━━━━━━━\n'
        + 'HANDYMAN 札幌デリバリー専門店\n'
        + 'TEL: 050-1724-6197（9:00〜19:00）\n'
        + 'LINE ID👉 @730kyhwl\n';

      GmailApp.sendEmail(pay.customer_email, subject, body, {
        name: 'HANDYMAN 札幌デリバリー専門店',
        from: 'reserve@rent-handyman.jp',
        replyTo: 'reserve@rent-handyman.jp'
      });

      // DB: email_sent_at を更新（再送したことを記録、status は link_created のまま）
      supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(resId), {
        status: 'email_sent',
        email_sent_at: new Date().toISOString()
      });

      sent.push({id:resId, name:pay.customer_name, email:pay.customer_email, oldAmount:oldAmount, newAmount:newAmount, diff:diff, newUrl:pay.square_payment_url});
      Logger.log('[ApologyResendFive] ✅ Sent: ' + resId + ' → ' + pay.customer_email + ' ¥' + oldAmount + ' → ¥' + newAmount);
      Utilities.sleep(800);
    } catch (e) {
      failed.push({id:resId, reason:e.message});
      Logger.log('[ApologyResendFive] ❌ Error: ' + resId + ' ' + e.message);
    }
  }

  // Slack通知
  var lines = ['🙇 *お詫び+金額訂正+新リンクで再送 実行結果*', ''];
  lines.push('✅ 送信成功: ' + sent.length + '件');
  sent.forEach(function(x) {
    lines.push('  • ' + x.id + ' ' + x.name + ' → ' + x.email);
    lines.push('    ¥' + x.oldAmount.toLocaleString() + ' → ¥' + x.newAmount.toLocaleString() + '（-¥' + x.diff.toLocaleString() + '）');
    lines.push('    新URL: ' + x.newUrl);
  });
  if (failed.length > 0) {
    lines.push('');
    lines.push('❌ 送信失敗: ' + failed.length + '件');
    failed.forEach(function(x) { lines.push('  • ' + x.id + ' : ' + x.reason); });
  }
  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
  Logger.log('[ApologyResendFive] Summary: sent=' + sent.length + ' failed=' + failed.length);
}

/**
 * 全じゃらん予約から「過大請求の疑いがあるレコード」を炙り出す診断
 *
 * 判定ロジック:
 *   reservations.ota='J' かつ
 *   price > base_price + option_price - discount （不整合＝discount未反映の疑い）
 *   OR
 *   price > 0 かつ base_price = 0 かつ option_price = 0 かつ discount = 0
 *     （内訳未登録＝合計金額だけ入った状態）
 *
 * さらに jalan_payments と照合し、既に発行済み/送信済み/入金済みの金額が
 * reservations.price と一致しているか確認。
 *
 * 既に手動訂正済みの5名（R0Q7UEF3/R0742RTL/R02XF89Q/R0CYV6NR/R0GRD083）は除外。
 *
 * 結果を Slack #jalan_payment に報告。実際の訂正はまだ行わない（診断のみ）。
 */
/**
 * ★ 2026-05-06 追加: ポイント全額充当（請求額0円）ケースの監査
 * 既存じゃらん予約のうち、reservations.price=0 にすべきだったのに
 * jalan_payments で >0 で発行されているレコードを検出。
 * R0EQE3JK 田草川様事故と同型のバグ被害者がいないかチェック。
 *
 * 結果を Slack #jalan_payment に報告。実際の訂正はせず一覧のみ。
 */
function auditAllJalanZeroBilling() {
  Logger.log('[AuditZeroBilling] Start');

  // jalan_payments で amount > 0 かつ status != cancelled/refunded を取得
  var pays = supabaseGet_('jalan_payments', 'amount=gt.0&status=not.in.(cancelled,refunded,refund)&select=reservation_id,amount,status,customer_name,square_payment_url,email_sent_at,paid_at&order=created_at.desc&limit=500');
  if (!pays || pays.length === 0) { Logger.log('[AuditZeroBilling] no targets'); return; }

  var suspects = [];
  for (var i = 0; i < pays.length; i++) {
    var pay = pays[i];
    var resv = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(pay.reservation_id) + '&select=id,name,lend_date,return_date,price,base_price,discount,status,ota');
    if (!resv || resv.length === 0) continue;
    var r = resv[0];
    if (r.ota !== 'J') continue;
    if (r.status === 'cancelled' || r.status === 'キャンセル') continue;
    // 疑わしい条件: discount >= base_price - 1 (=ほぼ全額割引) or price < amount
    var fullDiscount = +(r.discount||0) > 0 && +(r.base_price||0) > 0 && +(r.discount||0) >= +(r.base_price||0);
    var amountMismatch = +(pay.amount||0) > +(r.price||0);
    if (fullDiscount || amountMismatch) {
      suspects.push({
        id: r.id, name: r.name, lend: r.lend_date, ret: r.return_date,
        resv_price: r.price, base: r.base_price, discount: r.discount,
        pay_amount: pay.amount, pay_status: pay.status,
        url: pay.square_payment_url, email_sent: pay.email_sent_at, paid: pay.paid_at,
        reason: fullDiscount ? '全額割引(ポイント等)' : (amountMismatch ? 'amount > resv.price' : '')
      });
    }
  }

  Logger.log('[AuditZeroBilling] suspects=' + suspects.length);
  if (suspects.length === 0) {
    postToSlackChannel_(JALAN_PAY_CHANNEL, '✅ *じゃらん0円請求監査*\n疑わしいレコードはありませんでした（全' + pays.length + '件チェック）');
    return;
  }

  var lines = ['🔍 *じゃらん0円請求監査 — ' + suspects.length + '件 要確認*'];
  for (var s = 0; s < suspects.length; s++) {
    var x = suspects[s];
    lines.push('— ' + x.id + ' / ' + x.name + ' / ' + x.lend);
    lines.push('  resv.price=¥' + (x.resv_price||0) + ' base=¥' + (x.base||0) + ' discount=¥' + (x.discount||0));
    lines.push('  pay.amount=¥' + (x.pay_amount||0) + ' status=' + x.pay_status + (x.email_sent ? ' (メール送信済)' : '') + (x.paid ? ' (入金済)' : ''));
    lines.push('  ' + x.url + ' | reason=' + x.reason);
  }
  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
}

function auditAllJalanOverbilling() {
  var ALREADY_FIXED = {
    'R0Q7UEF3': true, 'R0742RTL': true, 'R02XF89Q': true,
    'R0CYV6NR': true, 'R0GRD083': true
  };

  Logger.log('[AuditOverbilling] Start');

  // 1. 全じゃらん予約を取得（過去分・キャンセル除く）
  var resvs = supabaseGet_('reservations',
    'ota=eq.J&status=neq.cancelled' +
    '&select=id,name,mail,lend_date,return_date,price,base_price,option_price,discount,status' +
    '&order=lend_date.desc&limit=2000');
  if (!resvs) { Logger.log('[AuditOverbilling] reservations fetch failed'); return; }
  Logger.log('[AuditOverbilling] じゃらん予約 総数: ' + resvs.length);

  // 2. 不整合レコードを抽出
  var suspects = [];
  for (var i = 0; i < resvs.length; i++) {
    var r = resvs[i];
    if (ALREADY_FIXED[r.id]) continue;

    var price = +(r.price || 0);
    var base = +(r.base_price || 0);
    var opt = +(r.option_price || 0);
    var disc = +(r.discount || 0);

    if (price <= 0) continue;

    var expected = base + opt - disc;
    var reason = null;

    if (base === 0 && opt === 0 && disc === 0 && price > 0) {
      reason = '内訳未登録(合計のみ)';
    } else if (base > 0 && price > expected + 10) {
      // 差10円以内はfloat誤差として許容
      reason = '不整合: price>base+opt-disc (差¥' + (price - expected).toLocaleString() + ')';
    } else if (base > 0 && price < expected - 10) {
      reason = '逆不整合: price<base+opt-disc';
    }

    if (reason) {
      suspects.push({
        id: r.id, name: r.name, mail: r.mail,
        lend_date: r.lend_date, return_date: r.return_date,
        price: price, base: base, opt: opt, disc: disc, expected: expected,
        reason: reason
      });
    }
  }
  Logger.log('[AuditOverbilling] 不整合候補: ' + suspects.length + '件');

  // 3. jalan_payments と照合
  var confirmed = []; // 実害あり（決済発行済み）
  var noPayment = []; // 決済未発行（DB不整合のみ）
  for (var j = 0; j < suspects.length; j++) {
    var s = suspects[j];
    var payRows = supabaseGet_('jalan_payments',
      'reservation_id=eq.' + encodeURIComponent(s.id) +
      '&select=reservation_id,customer_name,customer_email,amount,status,square_payment_url,email_sent_at,paid_at');
    var pay = (payRows && payRows[0]) ? payRows[0] : null;
    s.pay = pay;
    if (pay && (pay.status === 'link_created' || pay.status === 'email_sent' || pay.status === 'paid')) {
      // Square発行済み。実際の請求額 (pay.amount) と正しい金額 (s.expected) を比較
      s.actualBilled = +(pay.amount || 0);
      s.correctAmount = s.expected > 0 ? s.expected : s.price;
      s.diff = s.actualBilled - s.correctAmount;
      if (Math.abs(s.diff) > 10) {
        confirmed.push(s);
      } else {
        // 金額は正しく発行されていた
        noPayment.push(s);
      }
    } else {
      noPayment.push(s);
    }
  }

  // 4. Slack報告
  var lines = ['🔍 *じゃらん過大請求 監査結果*', ''];
  lines.push('調査対象: じゃらん予約 ' + resvs.length + '件（キャンセル除く、手動訂正5名除外）');
  lines.push('DB不整合検出: ' + suspects.length + '件');
  lines.push('');
  lines.push('🚨 *実害あり（決済発行額が誤り）: ' + confirmed.length + '件*');
  if (confirmed.length === 0) {
    lines.push('  (なし)');
  } else {
    confirmed.forEach(function(x) {
      var pay = x.pay || {};
      lines.push('• `' + x.id + '` ' + (x.name || '-') + ' / ' + (x.mail || '-'));
      lines.push('  貸出: ' + x.lend_date + ' / 決済状態: ' + (pay.status || '-'));
      lines.push('  発行額: ¥' + x.actualBilled.toLocaleString() +
                 ' / 正: ¥' + x.correctAmount.toLocaleString() +
                 ' / 差: ¥' + x.diff.toLocaleString());
      lines.push('  DB内訳: base¥' + x.base.toLocaleString() +
                 ' + opt¥' + x.opt.toLocaleString() +
                 ' - disc¥' + x.disc.toLocaleString() +
                 ' / price¥' + x.price.toLocaleString());
      lines.push('  理由: ' + x.reason);
      lines.push('');
    });
  }
  lines.push('');
  lines.push('⚠️ *DB不整合のみ（決済未発行/発行額は正）: ' + noPayment.length + '件*');
  if (noPayment.length > 0 && noPayment.length <= 20) {
    noPayment.forEach(function(x) {
      var payStatus = (x.pay && x.pay.status) || '未発行';
      lines.push('• `' + x.id + '` ' + (x.name || '-') + ' (' + payStatus + ') ' + x.reason);
    });
  } else if (noPayment.length > 20) {
    lines.push('  (' + noPayment.length + '件のため詳細は省略。Loggerを確認)');
  }

  // Logger用の詳細ログ
  Logger.log('');
  Logger.log('=== 🚨 実害あり（再送要検討）===');
  confirmed.forEach(function(x) {
    Logger.log(x.id + ' | ' + x.name + ' | ' + x.mail +
               ' | 発行¥' + x.actualBilled + ' 正¥' + x.correctAmount + ' 差¥' + x.diff);
  });
  Logger.log('');
  Logger.log('=== ⚠️ DB不整合のみ ===');
  noPayment.forEach(function(x) {
    var payStatus = (x.pay && x.pay.status) || '未発行';
    Logger.log(x.id + ' | ' + x.name + ' | ' + (x.pay ? 'pay:' + payStatus : '未発行') + ' | ' + x.reason);
  });

  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
  Logger.log('[AuditOverbilling] Done: confirmed=' + confirmed.length + ' noPayment=' + noPayment.length);
}

/**
 * 5名への謝罪メール送信を事後検証する
 * - jalan_payments の status/amount/email_sent_at/square_payment_url
 * - Gmail 送信済みトレイに該当メール有無
 */
function verifyFiveApologySent() {
  var TARGETS = [
    { id: 'R0Q7UEF3', email: 'smhi4381@docomo.ne.jp', newAmount: 16300 },
    { id: 'R0742RTL', email: 'itarian_barbar@yahoo.co.jp', newAmount: 52050 },
    { id: 'R02XF89Q', email: 'zamasu44@icloud.com', newAmount: 27000 },
    { id: 'R0CYV6NR', email: 'ryota.223@icloud.com', newAmount: 17000 },
    { id: 'R0GRD083', email: 't.y.network29@docomo.ne.jp', newAmount: 78200 }
  ];

  Logger.log('=== 5名謝罪メール送信 事後検証 ===');
  var lines = ['🔍 *5名謝罪メール送信 事後検証結果*', ''];

  var allOk = true;
  for (var i = 0; i < TARGETS.length; i++) {
    var t = TARGETS[i];
    var block = ['---', '▼ ' + t.id + ' (' + t.email + ')'];

    // 1. DB状態
    var rows = supabaseGet_('jalan_payments',
      'reservation_id=eq.' + encodeURIComponent(t.id) +
      '&select=reservation_id,customer_name,customer_email,amount,status,email_sent_at,square_payment_url,link_created_at');
    if (!rows || rows.length === 0) {
      block.push('  ❌ DB行なし');
      allOk = false;
    } else {
      var r = rows[0];
      var amountOk = +(r.amount || 0) === t.newAmount;
      var statusOk = r.status === 'email_sent' || r.status === 'paid';
      var sentAtOk = !!r.email_sent_at;
      block.push('  DB金額: ¥' + (+r.amount).toLocaleString() + (amountOk ? ' ✅' : ' ❌ 期待¥' + t.newAmount.toLocaleString()));
      block.push('  status: ' + r.status + (statusOk ? ' ✅' : ' ❌'));
      block.push('  email_sent_at: ' + (r.email_sent_at || '未記録') + (sentAtOk ? ' ✅' : ' ❌'));
      block.push('  新URL: ' + (r.square_payment_url || '(なし)'));
      if (!amountOk || !statusOk || !sentAtOk) allOk = false;
    }

    // 2. Gmail送信済みトレイ検索（reserve@rent-handyman.jp の送信済みから）
    // 件名パターン: 【お詫び・再送】... 予約番号: R0Q7UEF3
    try {
      var q = 'from:reserve@rent-handyman.jp to:' + t.email + ' ' + t.id + ' お詫び・再送';
      var threads = GmailApp.search(q, 0, 5);
      if (threads.length === 0) {
        // 絞り込み条件が厳しすぎる可能性 → to+id のみで再検索
        var q2 = 'to:' + t.email + ' ' + t.id;
        var threads2 = GmailApp.search(q2, 0, 10);
        if (threads2.length === 0) {
          block.push('  📧 Gmail: 送信痕跡なし ❌');
          allOk = false;
        } else {
          block.push('  📧 Gmail(緩): ' + threads2.length + '件ヒット');
          var latest = null;
          threads2.forEach(function(th) {
            th.getMessages().forEach(function(m) {
              if (m.getSubject().indexOf('お詫び・再送') >= 0 && m.getSubject().indexOf(t.id) >= 0) {
                if (!latest || m.getDate().getTime() > latest.getDate().getTime()) latest = m;
              }
            });
          });
          if (latest) {
            block.push('  📧 お詫び・再送メール: ' + Utilities.formatDate(latest.getDate(), 'Asia/Tokyo', 'MM/dd HH:mm:ss') + ' ✅');
          } else {
            block.push('  📧 お詫び・再送メール: 見つからず ❌');
            allOk = false;
          }
        }
      } else {
        var latestS = null;
        threads.forEach(function(th) {
          th.getMessages().forEach(function(m) {
            if (!latestS || m.getDate().getTime() > latestS.getDate().getTime()) latestS = m;
          });
        });
        if (latestS) {
          block.push('  📧 Gmail送信済み: ' + Utilities.formatDate(latestS.getDate(), 'Asia/Tokyo', 'MM/dd HH:mm:ss') + ' ✅');
          block.push('    件名: ' + latestS.getSubject());
        }
      }
    } catch (e) {
      block.push('  📧 Gmail検索エラー: ' + e.message);
    }

    lines = lines.concat(block);
    Logger.log(block.join('\n'));
  }

  lines.push('');
  lines.push(allOk ? '🎉 全5名 送信確認OK' : '⚠️ 一部確認NG — 詳細は上記');
  postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
  Logger.log('[Verify5] done. allOk=' + allOk);
}

// ===============================================================
// 🔍 チャイルドシート数量不一致 診断ツール（2026-04-22追加）
// ===============================================================
/**
 * 指定予約IDについて、Gmail全メール×parseJalan_再解析×DB現状値を比較する診断関数
 * 使い方: GASエディタで関数名を「diagnoseOptSeatMismatch」に設定し「実行」
 * 対象予約IDは下記 TARGET_ID を書き換えて再実行
 */
function diagnoseOptSeatMismatch() {
  var TARGET_ID = 'R04OWZ6U';  // ← 調査したい予約IDに書き換え

  Logger.log('=== チャイルドシート数量 診断開始: ' + TARGET_ID + ' ===');

  // 1) DB現状値
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(TARGET_ID) + '&select=id,name,ota,opt_b,opt_c,opt_j,price,lend_date,status,created_at,updated_at');
  Logger.log('--- [1] DB現状値 ---');
  if (rows && rows.length > 0) {
    var r = rows[0];
    Logger.log('id=' + r.id + ' name=' + r.name + ' ota=' + r.ota);
    Logger.log('opt_b=' + r.opt_b + ' opt_c=' + r.opt_c + ' opt_j=' + r.opt_j);
    Logger.log('price=' + r.price + ' lend_date=' + r.lend_date + ' status=' + r.status);
    Logger.log('created_at=' + r.created_at + ' updated_at=' + r.updated_at);
  } else {
    Logger.log('⚠️ DBに予約が見つかりません');
  }

  // 2) Gmail全メール取得
  Logger.log('--- [2] Gmail 検索 ---');
  var threads = GmailApp.search(TARGET_ID, 0, 20);
  Logger.log('threads found: ' + threads.length);

  var allMessages = [];
  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var subject = msgs[m].getSubject();
      var body = msgs[m].getPlainBody();
      if (body.indexOf(TARGET_ID) < 0) continue;
      allMessages.push({
        date: msgs[m].getDate(),
        from: msgs[m].getFrom(),
        subject: subject,
        body: body,
        msgId: msgs[m].getId()
      });
    }
  }

  // 日付順ソート
  allMessages.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
  Logger.log('合計メール: ' + allMessages.length + '通');

  // 3) 各メールを parseJalan_ で解析
  Logger.log('--- [3] 各メール解析 ---');
  for (var i = 0; i < allMessages.length; i++) {
    var msg = allMessages[i];
    Logger.log('\n[メール' + (i+1) + '/' + allMessages.length + '] ' + msg.date + ' / ' + msg.from);
    Logger.log('  件名: ' + msg.subject);
    Logger.log('  msgId: ' + msg.msgId);

    // チャイルドシート行を抜き出し
    var csLine = '';
    var lines = msg.body.split('\n');
    for (var li = 0; li < lines.length; li++) {
      if (lines[li].indexOf('チャイルドシート') >= 0 || lines[li].indexOf('ベビーシート') >= 0 || lines[li].indexOf('ジュニアシート') >= 0) {
        csLine += '    > ' + lines[li].trim() + '\n';
      }
    }
    if (csLine) Logger.log('  シート関連行:\n' + csLine);
    else Logger.log('  シート関連行: (なし)');

    // parseJalan_ で再解析
    try {
      var parsed = parseJalan_(msg.body);
      Logger.log('  parseJalan_: opt_b=' + parsed.opt_b + ' opt_c=' + parsed.opt_c + ' opt_j=' + parsed.opt_j);
    } catch (e) {
      Logger.log('  parseJalan_ エラー: ' + e.toString());
    }

    // 処理済みID管理状況
    var processedIds = getProcessedMsgIds_();
    var processed = processedIds.indexOf(msg.msgId) >= 0;
    Logger.log('  処理済みID管理: ' + (processed ? '✅処理済み' : '⚠️未処理'));
  }

  // 4) 既存予約パッチロジックシミュレーション（最新メール値を使用）
  Logger.log('--- [4] パッチロジックシミュレーション ---');
  if (rows && rows.length > 0 && allMessages.length > 0) {
    var existing = rows[0];
    var latest = allMessages[allMessages.length - 1];
    try {
      var latestParsed = parseJalan_(latest.body);
      Logger.log('existing.opt_c = ' + existing.opt_c + ', latestParsed.opt_c = ' + latestParsed.opt_c);
      var shouldPatch = +(latestParsed.opt_c||0) > +(existing.opt_c||0);
      Logger.log('現行パッチ条件 (latestParsed > existing): ' + shouldPatch);
      if (shouldPatch) {
        Logger.log('→ パッチされるはず。なぜされていないか別原因調査必要');
      } else {
        Logger.log('→ パッチされない条件。existingが既にlatestParsed以上のため');
      }
    } catch (e) {
      Logger.log('シミュレーションエラー: ' + e.toString());
    }
  }

  Logger.log('=== 診断完了 ===');
}

// ============================================================
// 2026-04-23: tasks opts 同期 テスト & 遡及バッチ
// ============================================================

/**
 * 単体テスト: 指定予約ID のタスクopts を reservations から再同期
 * GASエディタで手動実行して動作確認用
 */
function testPatchTaskOpts() {
  var TARGET_ID = 'R04OWZ6U'; // マキノリナ
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(TARGET_ID) + '&select=id,name,opt_b,opt_c,opt_j');
  if (!rows.length) { Logger.log('予約が見つかりません: ' + TARGET_ID); return; }
  var r = rows[0];
  Logger.log('reservations: name=' + r.name + ' opt_b=' + r.opt_b + ' opt_c=' + r.opt_c + ' opt_j=' + r.opt_j);
  patchTaskOpts_(TARGET_ID, r.opt_b, r.opt_c, r.opt_j);
  // 結果確認
  var tasks = supabaseGet_('tasks', 'reservation_id=eq.' + encodeURIComponent(TARGET_ID) + '&select=_id,type,memo,opt_c,changed_json');
  tasks.forEach(function(t) {
    Logger.log(t._id + ' (' + t.type + '): opt_c=' + t.opt_c + ' memo末尾=' + String(t.memo||'').slice(-20) + ' changed_json=' + (t.changed_json||''));
  });
}

/**
 * 遡及バッチ: 過去に tasks.opts が反映されずズレている予約を全件洗い替え
 * 対象: 今日以降に lend_date がある reservations で opt_b+opt_c+opt_j > 0 のもの
 * 手動実行専用（トリガー不要）
 */
function resyncAllTaskOpts() {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var rows = supabaseGet_('reservations', 'lend_date=gte.' + today + '&or=(opt_b.gt.0,opt_c.gt.0,opt_j.gt.0)&status=not.eq.cancelled&select=id,name,opt_b,opt_c,opt_j,lend_date');
  if (!rows.length) { Logger.log('対象予約なし'); return; }
  Logger.log('対象: ' + rows.length + '件');
  var patched = 0, skipped = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tasks = supabaseGet_('tasks', 'reservation_id=eq.' + encodeURIComponent(r.id) + '&select=_id,changed_json,opt_c');
    if (!tasks.length) { skipped++; continue; }
    // 差分検知: 3タスクの changed_json._optC/_optB/_optJ が reservations と一致していればスキップ
    var needSync = false;
    for (var ti = 0; ti < tasks.length; ti++) {
      var cj = {};
      try { cj = tasks[ti].changed_json ? JSON.parse(tasks[ti].changed_json) : {}; } catch(e){}
      if ((cj._optB||0) !== (r.opt_b||0) || (cj._optC||0) !== (r.opt_c||0) || (cj._optJ||0) !== (r.opt_j||0)) {
        needSync = true; break;
      }
    }
    if (!needSync) { skipped++; continue; }
    patchTaskOpts_(r.id, r.opt_b, r.opt_c, r.opt_j);
    patched++;
    Logger.log('[resync] ' + r.id + ' (' + r.name + ' ' + r.lend_date + ') B=' + r.opt_b + ' C=' + r.opt_c + ' J=' + r.opt_j);
  }
  Logger.log('=== 完了: 同期=' + patched + '件 / スキップ=' + skipped + '件 / 合計=' + rows.length + '件 ===');
}

/**
 * ★ 2026-04-26追加: 楽天パーサーのチャイルドシート検出を実メールで動作確認
 * 使い方: GASエディタで関数名を「diagnoseRakutenChildSeat」に設定し「実行」
 * 対象予約IDは TARGET_ID を書き換えて再実行
 *
 * 修正前(L605-613のみ)はメール本文1行目しか見ないため、複数行に渡る
 * オプション欄でチャイルドシート2が拾えなかった。
 * 修正後はbody全体検索のフォールバック(L611-619)で拾う想定。
 * 本関数はその挙動を実メールで証明するためのもの。
 */
function diagnoseRakutenChildSeat() {
  var TARGET_ID = 'RC22461157100261654';  // ← 確認したい予約IDに書き換え

  Logger.log('=== 楽天 チャイルドシート検出 診断開始: ' + TARGET_ID + ' ===');

  // 1) DB現状値
  var rows = supabaseGet_('reservations', 'id=eq.' + encodeURIComponent(TARGET_ID) + '&select=id,name,ota,opt_b,opt_c,opt_j,price,lend_date');
  Logger.log('--- [1] DB現状値 ---');
  if (rows && rows.length > 0) {
    var r = rows[0];
    Logger.log('id=' + r.id + ' name=' + r.name + ' ota=' + r.ota);
    Logger.log('opt_b=' + r.opt_b + ' opt_c=' + r.opt_c + ' opt_j=' + r.opt_j);
    Logger.log('price=' + r.price + ' lend_date=' + r.lend_date);
  } else {
    Logger.log('⚠️ DBに予約が見つかりません');
  }

  // 2) Gmail検索（楽天メール）
  Logger.log('--- [2] Gmail 検索 ---');
  var threads = GmailApp.search('from:' + OTA_SENDERS.rakuten + ' ' + TARGET_ID, 0, 10);
  Logger.log('threads found: ' + threads.length);
  var allMessages = [];
  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var body = msgs[m].getPlainBody();
      if (body.indexOf(TARGET_ID) < 0) continue;
      allMessages.push({
        date: msgs[m].getDate(),
        subject: msgs[m].getSubject(),
        body: body
      });
    }
  }
  allMessages.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
  Logger.log('合計メール: ' + allMessages.length + '通');

  if (allMessages.length === 0) {
    Logger.log('⚠️ メール未検出。テストできません');
    return;
  }

  // 3) 最新メールでチャイルドシート関連行抽出 + parseRakuten_ 再解析
  var msg = allMessages[allMessages.length - 1];
  Logger.log('--- [3] 最新メール解析 (' + msg.date + ') ---');
  Logger.log('  件名: ' + msg.subject);

  // チャイルドシート行を抜き出し
  Logger.log('  --- シート関連行 (body 全体から) ---');
  var lines = msg.body.split('\n');
  for (var li = 0; li < lines.length; li++) {
    if (lines[li].indexOf('チャイルドシート') >= 0 || lines[li].indexOf('ベビーシート') >= 0 || lines[li].indexOf('ジュニアシート') >= 0) {
      Logger.log('    > ' + lines[li].trim());
    }
  }

  // optionsStr (1行目のみ取れる方) と body全体の比較
  var optionsStr = extractField_(msg.body, '・オプション/車両の特徴');
  Logger.log('  --- extractField_ で取れるoptionsStr (1行目のみ) ---');
  Logger.log('    "' + optionsStr + '"');
  Logger.log('  → optionsStr内に「チャイルドシート」: ' + (optionsStr.indexOf('チャイルドシート') >= 0 ? '✅' : '❌(これが旧バグ)'));

  // body全体fallback の動作確認
  var cAll = msg.body.match(/チャイルドシート[^\d\n]*(\d+)/g);
  Logger.log('  --- body全体fallback ---');
  Logger.log('    body.match(/チャイルドシート[^\\d\\n]*(\\d+)/g) = ' + JSON.stringify(cAll));
  if (cAll && cAll.length > 0) {
    var maxC = 0;
    cAll.forEach(function(s) { var n = s.match(/(\d+)/); if (n) maxC = Math.max(maxC, parseInt(n[1], 10)); });
    Logger.log('    → 抽出される最大値: ' + maxC + ' (これが新コードの opt_c になる想定)');
  }

  // parseRakuten_ で再解析
  Logger.log('  --- parseRakuten_ 再解析結果 ---');
  try {
    var parsed = parseRakuten_(msg.body);
    if (parsed) {
      Logger.log('    opt_b=' + parsed.opt_b + ' opt_c=' + parsed.opt_c + ' opt_j=' + parsed.opt_j);
      Logger.log('    price=' + parsed.price + ' base_price=' + parsed.base_price + ' option_price=' + parsed.option_price + ' discount=' + parsed.discount);
      Logger.log('    vehicle=' + parsed.vehicle + ' name=' + parsed.name);
      Logger.log('  ★ 結論:');
      if (parsed.opt_c >= 1) {
        Logger.log('    ✅ チャイルドシート検出 OK (opt_c=' + parsed.opt_c + ')');
        if (rows && rows.length > 0 && +(rows[0].opt_c||0) < parsed.opt_c) {
          Logger.log('    → 新規メール取込でこの予約に取り込まれていれば opt_c が ' + (rows[0].opt_c||0) + ' から ' + parsed.opt_c + ' にパッチされる');
        }
      } else {
        Logger.log('    ❌ チャイルドシート検出失敗。コード未反映の可能性。GASエディタで最新版が保存されているか確認');
      }
    } else {
      Logger.log('    parseRakuten_ が null を返した。メール形式を確認');
    }
  } catch (e) {
    Logger.log('    parseRakuten_ エラー: ' + e.toString());
  }

  Logger.log('=== 診断完了 ===');
}

/* ========================================================================
 * 再発防止: opts自動パトロール (2026-04-30 追加)
 * ========================================================================
 * 背景: reservations.opt_b/c/j と tasks.opt_b/c/j (boolean) /
 *       changed_json._optB/_optC/_optJ のズレが時々発生。
 *       既に patchTaskOpts_ は実装済みだが、過去取込分や
 *       Realtime取りこぼし等で同期漏れが起こる。
 *
 * 対策3層:
 *  1) nightlyOptsPatrol — 毎晩2:00 に自動でPattern A検出+修正+Slack通知
 *  2) bulkReprocessByResvNos(resvNos) — 引数の予約番号を Gmail から再パース
 *  3) bulkReprocessPatternB — Pattern B 未来日を全件再パース
 * ======================================================================== */

/**
 * 毎晩自動パトロール: tasks.opts 同期漏れの自動修正 + Pattern B 検出
 * トリガー: setupNightlyOptsPatrolTrigger() で毎晩2時設定
 */
function nightlyOptsPatrol() {
  var startTime = new Date();
  Logger.log('[nightlyOptsPatrol] 開始: ' + startTime.toISOString());

  var rows = supabaseGet_(
    'reservations',
    'status=not.eq.cancelled&select=id,name,ota,lend_date,return_date,opt_b,opt_c,opt_j,option_price,base_price,price,discount,insurance'
  );
  if (!rows.length) { Logger.log('[nightlyOptsPatrol] 対象予約なし'); return; }

  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  // Step 1: Pattern A 自動修正
  var patternA_fixed = 0;
  var patternA_examples = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rb = +(r.opt_b||0), rc = +(r.opt_c||0), rj = +(r.opt_j||0);
    var tasks = supabaseGet_(
      'tasks',
      'reservation_id=eq.' + encodeURIComponent(r.id) + '&select=_id,changed_json,opt_b,opt_c,opt_j'
    );
    if (!tasks.length) continue;

    var needSync = false;
    for (var ti = 0; ti < tasks.length; ti++) {
      var t = tasks[ti];
      var tb = !!t.opt_b, tc = !!t.opt_c, tj = !!t.opt_j;
      if (tb !== (rb > 0) || tc !== (rc > 0) || tj !== (rj > 0)) { needSync = true; break; }
      var cj = {};
      try { cj = t.changed_json ? JSON.parse(t.changed_json) : {}; } catch(e){}
      if (+(cj._optB||0) !== rb || +(cj._optC||0) !== rc || +(cj._optJ||0) !== rj) {
        needSync = true; break;
      }
    }

    if (needSync) {
      try {
        patchTaskOpts_(r.id, rb, rc, rj);
        patternA_fixed++;
        if (patternA_examples.length < 5) {
          patternA_examples.push(r.id + ' (' + r.name + ' ' + r.lend_date + ')');
        }
      } catch (e) {
        Logger.log('[nightlyOptsPatrol] Pattern A修正エラー ' + r.id + ': ' + e.toString());
      }
    }
  }

  // Step 2: Pattern B 検出 (未来日のみ)
  var patternB_list = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.lend_date < today) continue;
    var rb = +(r.opt_b||0), rc = +(r.opt_c||0), rj = +(r.opt_j||0);
    if (rb > 0 || rc > 0 || rj > 0) continue;
    var optPrice = +(r.option_price||0);
    if (optPrice <= 0) continue;

    var insurance = (r.insurance||'').trim();
    var days = 1;
    try {
      if (r.return_date && r.lend_date) {
        var d1 = new Date(r.lend_date + 'T00:00:00');
        var d2 = new Date(r.return_date + 'T00:00:00');
        days = Math.max(1, Math.round((d2 - d1) / 86400000));
      }
    } catch(e){}
    var perDay = optPrice / days;

    if (insurance === '' || insurance === 'なし' || perDay > 1200) {
      patternB_list.push({
        id: r.id, name: r.name, ota: r.ota, lend: r.lend_date,
        opt_price: optPrice, per_day: Math.round(perDay), insurance: insurance
      });
    }
  }

  // Step 3: Slack 通知
  var endTime = new Date();
  var duration = ((endTime - startTime) / 1000).toFixed(1);
  var slackMsg = ':robot_face: *opts パトロール結果* (' + duration + '秒)\n';
  slackMsg += '対象: ' + rows.length + '件 / 日付: ' + today + '\n';
  slackMsg += ':white_check_mark: Pattern A 自動修正: *' + patternA_fixed + '件*\n';
  if (patternA_examples.length > 0) {
    slackMsg += '  例: ' + patternA_examples.join(', ') + '\n';
  }
  slackMsg += ':warning: Pattern B (要目視・未来日): *' + patternB_list.length + '件*';
  if (patternB_list.length > 0) {
    var first10 = patternB_list.slice(0, 10).map(function(x){
      return x.id + ' ' + x.name + ' ' + x.ota + ' ' + x.lend +
             ' ¥' + x.opt_price + '=¥' + x.per_day + '/日 "' + x.insurance + '"';
    }).join('\n');
    slackMsg += '\n```\n' + first10;
    if (patternB_list.length > 10) slackMsg += '\n... 他 ' + (patternB_list.length - 10) + '件';
    slackMsg += '\n```';
    slackMsg += '\n→ GASエディタで `bulkReprocessPatternB()` 実行で一括再パース';
  }

  Logger.log(slackMsg);

  try {
    if (typeof sendSlackToSpk_ === 'function') {
      sendSlackToSpk_('opts パトロール結果', slackMsg);
    }
  } catch (e) {
    Logger.log('[nightlyOptsPatrol] Slack送信エラー: ' + e.toString());
  }
}

/**
 * setupNightlyOptsPatrolTrigger: 毎晩2時のトリガーを作成
 * 1回だけ手動実行
 */
function setupNightlyOptsPatrolTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var deleted = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'nightlyOptsPatrol') {
      ScriptApp.deleteTrigger(triggers[i]);
      deleted++;
    }
  }
  ScriptApp.newTrigger('nightlyOptsPatrol').timeBased().atHour(2).nearMinute(0).everyDays(1).create();
  Logger.log('[setupNightlyOptsPatrolTrigger] 旧トリガー削除=' + deleted + ' / 新トリガー設定: 毎晩2:00');
}

/**
 * bulkReprocessByResvNos: 引数で渡された予約番号を Gmail から再パースして DB+tasks 同期
 * processMessage_ の既存予約パッチ経路を使う (patch.opt_b/c/j → patchTaskOpts_ 自動呼び出し)
 *
 * 例: bulkReprocessByResvNos(['R0742RTL', 'RC52461055442120662'])
 */
function bulkReprocessByResvNos(resvNos) {
  if (!resvNos || !resvNos.length) {
    Logger.log('[bulkReprocessByResvNos] 引数 resvNos が空'); return;
  }
  Logger.log('[bulkReprocessByResvNos] 開始: ' + resvNos.length + '件');

  var ok = 0, fail = 0, notFound = 0;
  var query = 'after:' + Utilities.formatDate(new Date(Date.now() - 60*86400000), 'Asia/Tokyo', 'yyyy/MM/dd');

  for (var i = 0; i < resvNos.length; i++) {
    var resvNo = resvNos[i];
    Logger.log('[' + (i+1) + '/' + resvNos.length + '] ' + resvNo);

    try {
      var threads = GmailApp.search(query, 0, 500);
      var found = false;
      for (var t = 0; t < threads.length && !found; t++) {
        var msgs = threads[t].getMessages();
        for (var m = 0; m < msgs.length && !found; m++) {
          var msg = msgs[m];
          if (msg.getPlainBody().indexOf(resvNo) === -1) continue;
          Logger.log('  メール発見: ' + msg.getSubject());
          try {
            var result = processMessage_(msg, false);
            if (result) {
              Logger.log('  ' + (result.type || 'ok') + ' ' + (result.id || ''));
              ok++;
            } else {
              Logger.log('  processMessage_ が null');
              fail++;
            }
            found = true;
          } catch (e) {
            Logger.log('  処理エラー: ' + e.toString());
            fail++;
            found = true;
          }
        }
      }
      if (!found) {
        Logger.log('  メール未発見 (60日以内に存在しない)');
        notFound++;
      }
    } catch (e) {
      Logger.log('  例外: ' + e.toString());
      fail++;
    }
    Utilities.sleep(200);
  }

  Logger.log('=== bulkReprocessByResvNos 完了 ===');
  Logger.log('成功=' + ok + ' / 失敗=' + fail + ' / メール未発見=' + notFound + ' / 合計=' + resvNos.length);
}

/**
 * bulkReprocessPatternB: Pattern B 未来日 (option_price>0 / opt全0 / 補償なし or 日割>1200) を全件再パース
 * 1回だけ手動実行
 */
function bulkReprocessPatternB() {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var rows = supabaseGet_(
    'reservations',
    'status=not.eq.cancelled&lend_date=gte.' + today +
    '&option_price=gt.0&opt_b=eq.0&opt_c=eq.0&opt_j=eq.0' +
    '&select=id,name,lend_date,return_date,option_price,insurance'
  );
  if (!rows.length) { Logger.log('[bulkReprocessPatternB] 対象予約なし'); return; }

  var targets = rows.filter(function(r){
    var insurance = (r.insurance||'').trim();
    var optPrice = +(r.option_price||0);
    var days = 1;
    try {
      if (r.return_date && r.lend_date) {
        var d1 = new Date(r.lend_date + 'T00:00:00');
        var d2 = new Date(r.return_date + 'T00:00:00');
        days = Math.max(1, Math.round((d2 - d1) / 86400000));
      }
    } catch(e){}
    return insurance === '' || insurance === 'なし' || (optPrice / days) > 1200;
  });
  Logger.log('[bulkReprocessPatternB] 候補: ' + targets.length + '件 (全' + rows.length + '件中)');
  bulkReprocessByResvNos(targets.map(function(r){ return r.id; }));
}

/**
 * ★ 2026-05-09 追加: じゃらん people=0 取りこぼし バックフィル
 * 「子供（12歳未満）N人」の (12) を子供数と誤マッチして >10クランプ→0 にしていたバグ被害者を復旧。
 * Gmail検索を伴うため CLAUDE.md ルール「1日1関数 / 100件以下」を遵守。今回対象は最大13件。
 * GASエディタで関数選択 → ▶️実行（1回のみ）
 */
function backfillJalanPeople() {
  var resvs = supabaseGet_('reservations', 'ota=eq.J&people=eq.0&status=neq.cancelled&select=id,name,lend_date&order=lend_date.desc&limit=200');
  if (!resvs || !resvs.length) { Logger.log('[BackfillPeople] 対象0件'); return; }
  Logger.log('[BackfillPeople] 対象: ' + resvs.length + '件');

  var fixed = 0, notFound = 0, alreadyZero = 0;
  var details = [];
  for (var i = 0; i < resvs.length; i++) {
    var r = resvs[i];
    // Gmail検索（直近120日制限）
    var threads = GmailApp.search('from:' + OTA_SENDERS.jalan + ' ' + r.id + ' newer_than:120d', 0, 5);
    var msg = null;
    for (var t = 0; t < threads.length && !msg; t++) {
      var ms = threads[t].getMessages();
      for (var m = 0; m < ms.length; m++) {
        if (ms[m].getPlainBody().indexOf(r.id) !== -1) { msg = ms[m]; break; }
      }
    }
    if (!msg) {
      Logger.log('  ❌ ' + r.id + ' (' + r.name + '): Gmail未検出');
      notFound++;
      continue;
    }
    try {
      var parsed = parseJalan_(msg.getPlainBody());
      if (!parsed) { Logger.log('  ⚠️ ' + r.id + ': parseJalan_ null'); continue; }
      if (parsed.people === 0) {
        Logger.log('  ⏭️ ' + r.id + ' (' + r.name + '): メール上も大人0 子供0 → 正常0件');
        alreadyZero++;
        continue;
      }
      var ok = supabaseUpdate_('reservations', 'id=eq.' + encodeURIComponent(r.id), {people: parsed.people});
      if (ok) {
        Logger.log('  ✅ ' + r.id + ' (' + r.name + ' ' + r.lend_date + ') → people=' + parsed.people);
        details.push(r.id + ' ' + r.name + ' →' + parsed.people + '人');
        fixed++;
      } else {
        Logger.log('  ❌ ' + r.id + ': DB更新失敗');
      }
    } catch (e) {
      Logger.log('  ❌ ' + r.id + ': 例外 ' + e.message);
    }
    Utilities.sleep(200);
  }

  Logger.log('=== 完了: 修正=' + fixed + ' / メール上0=' + alreadyZero + ' / Gmail未検出=' + notFound + ' / 合計=' + resvs.length + '件 ===');

  // Slack 通知
  try {
    var lines = ['🔧 *じゃらん people=0 バックフィル完了*'];
    lines.push('対象: ' + resvs.length + '件');
    lines.push('✅ 修正: ' + fixed + '件');
    lines.push('⏭️ メール上も0で正常: ' + alreadyZero + '件');
    if (notFound > 0) lines.push('❌ Gmail未検出: ' + notFound + '件（要手動）');
    if (details.length > 0) {
      lines.push('');
      lines.push('修正内訳:');
      details.slice(0, 20).forEach(function(d){ lines.push('  • ' + d); });
    }
    postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
  } catch (e) { Logger.log('[BackfillPeople] Slack post error: ' + e.message); }
}

/**
 * ★ 2026-05-08 追加: R0SFCDMG ヤナギダ様 入金確認漏れ復旧 (1回のみ実行)
 * - DB は既に paid に更新済み（外部から PATCH 済み）
 * - スプシ I列「メール送信済」→「✅ 入金済み」、J列入金日、K列OrderID を更新
 * - Slack #payment_sapporo に入金確認完了通知を投稿
 * - 二重実行防止: ScriptProperty 'recover_R0SFCDMG_done'
 */
function recoverR0SFCDMGPayment() {
  var DONE_KEY = 'recover_R0SFCDMG_done';
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(DONE_KEY)) {
    Logger.log('[Recover] Already done at ' + props.getProperty(DONE_KEY));
    return;
  }

  var resvId = 'R0SFCDMG';
  var paidAt = '2026-05-04T07:07:29Z';
  var paidDateStr = '2026/05/04';
  var orderId = 'Jeixiny0i9Ce7WY9hIo9JPJPqeNZY';

  // スプシ更新
  try {
    var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('支払い管理');
    var lastRow = sheet.getLastRow();
    var resIds = sheet.getRange(2, 4, lastRow-1, 1).getValues();
    var rowIdx = -1;
    for (var i = 0; i < resIds.length; i++) {
      if (String(resIds[i][0]).trim() === resvId) { rowIdx = i + 2; break; }
    }
    if (rowIdx < 0) { Logger.log('[Recover] スプシ行未検出'); return; }
    sheet.getRange(rowIdx, 9).setValue('✅ 入金済み');
    sheet.getRange(rowIdx, 10).setValue(paidDateStr);
    sheet.getRange(rowIdx, 11).setValue(orderId);
    Logger.log('[Recover] スプシ行' + rowIdx + ' 更新完了');
  } catch (e) {
    Logger.log('[Recover] スプシ更新エラー: ' + e.message);
    return;
  }

  // Slack 通知
  try {
    postToSlackChannel_(JALAN_PAY_CHANNEL,
      '✅ *入金確認完了 (取りこぼし復旧)*\n' +
      '予約番号: ' + resvId + '\n' +
      '宛名: ヤナギダ ナオヤ\n' +
      '金額: ¥41,750\n' +
      '入金日時: ' + paidAt + ' (Mastercard末尾7530)\n' +
      '店舗: 札幌店\n\n' +
      '原因: スプシ「メール送信済」を `status.indexOf("済")` で誤マッチ → 未払い行から除外 → checkPaymentStatus 未実行\n' +
      '対策: フィルタを `indexOf("入金済")` に厳密化（4箇所修正済）');
  } catch (e) { Logger.log('[Recover] Slack post error: ' + e.message); }

  props.setProperty(DONE_KEY, new Date().toISOString());
  Logger.log('[Recover] Done');
}

/**
 * ★ 2026-05-14 追加: スプシC列「利用店舗」空欄の行をDB照合で補修
 *
 * 背景:
 *   2026-05-14 #payment_sapporo に那覇予約 SP-20260507-0001〜0003 の入金通知が誤って流れた。
 *   真因: スプシC列が空欄で記録された行があり、checkPaymentStatus がデフォルト=札幌で振り分け。
 *
 * 動作:
 *   支払い管理シートの全行を走査し、C列が空欄なら予約番号でDB照合 (nha_accounting/spk_accounting)
 *   → ヒットした店舗名で C列を埋める。
 *   ヒットしないか両店該当の行はログ出力のみ（手動確認）。
 *
 * 使い方:
 *   1. dryRun=true で実行 → ログで件数確認
 *   2. dryRun=false で実行 → スプシ更新
 */
function backfillPaymentSheetStore(dryRun) {
  if (dryRun === undefined) dryRun = true;
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('支払い管理');
  if (!sheet) { Logger.log('[Backfill] Sheet not found'); return; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var fixed = [], ambiguous = [], unknown = [];
  for (var i = 0; i < data.length; i++) {
    var store = String(data[i][2]||'').trim();
    var resvId = String(data[i][3]||'').trim();
    if (store) continue;     // C列が既に埋まっている行はスキップ
    if (!resvId) continue;   // 予約番号も無ければスキップ
    var r = resolvePaymentStore_(resvId, '');
    if (r.source === 'db') {
      // 一意に判定された
      var label = r.channels[0] === 'C0AP2S5B147' ? '那覇空港店' : '札幌店';
      fixed.push({row:i+2, resv:resvId, label:label});
      if (!dryRun) sheet.getRange(i+2, 3).setValue(label);
    } else if (r.source === 'ambiguous') {
      ambiguous.push({row:i+2, resv:resvId});
    } else {
      unknown.push({row:i+2, resv:resvId});
    }
  }
  Logger.log('[Backfill] mode=' + (dryRun?'DRY_RUN':'APPLY') + ' fixed=' + fixed.length + ' ambiguous=' + ambiguous.length + ' unknown=' + unknown.length);
  fixed.forEach(function(x){ Logger.log('  ✅ row=' + x.row + ' resv=' + x.resv + ' → ' + x.label); });
  ambiguous.forEach(function(x){ Logger.log('  ⚠️ row=' + x.row + ' resv=' + x.resv + ' (両店該当)'); });
  unknown.forEach(function(x){ Logger.log('  ❓ row=' + x.row + ' resv=' + x.resv + ' (DB未検出)'); });
  // Slack 報告
  var lines = ['📋 *スプシC列補修* (mode=' + (dryRun?'DRY_RUN':'APPLY') + ')', ''];
  lines.push('✅ 補修対象: ' + fixed.length + '件');
  fixed.slice(0, 10).forEach(function(x){ lines.push('  • ' + x.resv + ' → ' + x.label); });
  if (fixed.length > 10) lines.push('  ... 他' + (fixed.length - 10) + '件');
  if (ambiguous.length > 0) {
    lines.push('');
    lines.push('⚠️ 両店該当: ' + ambiguous.length + '件 (要手動確認)');
    ambiguous.forEach(function(x){ lines.push('  • ' + x.resv); });
  }
  if (unknown.length > 0) {
    lines.push('');
    lines.push('❓ DB未検出: ' + unknown.length + '件 (要手動確認)');
    unknown.slice(0, 20).forEach(function(x){ lines.push('  • ' + x.resv); });
    if (unknown.length > 20) lines.push('  ... 他' + (unknown.length - 20) + '件');
  }
  try { postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n')); } catch(e) {}
}
function backfillPaymentSheetStoreDryRun() { backfillPaymentSheetStore(true); }
function backfillPaymentSheetStoreApply()  { backfillPaymentSheetStore(false); }

/**
 * ★ 2026-05-06 追加: R0EQE3JK 田草川様 お詫びメール送信 (1回のみ実行)
 * GASエディタで関数名 `sendApologyToTakusagawa` を選択 → ▶️実行
 * 二重送信防止: ScriptProperty 'apology_R0EQE3JK_sent' で一度送信したら以後 abort
 */
function sendApologyToTakusagawa() {
  var SENT_KEY = 'apology_R0EQE3JK_sent';
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(SENT_KEY)) {
    Logger.log('[Apology] Already sent at ' + props.getProperty(SENT_KEY) + '. Aborting to prevent double-send.');
    return;
  }

  var to = 'chagie.1218@gmail.com';
  var subject = '【重要・お詫び】Square決済リンク誤送信のお詫びとお取消しのご連絡（じゃらん予約 R0EQE3JK）';
  var body = '田草川 豊 様\n\n'
    + '平素より「レンタカーショップHANDYMAN」をご利用いただき、誠にありがとうございます。\n\n'
    + 'このたびは、本日（5月6日）17時31分頃、お客様のじゃらんご予約\n'
    + '「予約番号 R0EQE3JK／2026年5月25日ご利用」につきまして、\n'
    + '弊社システムの不具合により、本来お送りすべきでないSquare決済リンクを\n'
    + 'ご案内するメールを誤送信してしまいましたこと、心よりお詫び申し上げます。\n\n'
    + '【正しい請求金額】\n'
    + '　合計金額　　　　：7,000円\n'
    + '　ご利用ポイント　：7,000ポイント\n'
    + '　お客様ご請求額　：　　0円（税込）\n\n'
    + 'ポイントの全額ご利用により、お客様には追加でのお支払いは一切発生いたしません。\n\n'
    + '【誤って送信したSquare決済リンクについて】\n'
    + '　既に弊社にて該当リンクを無効化（取消）処理しておりますため、\n'
    + '　万一リンクを開かれましてもお支払いは完了いたしません。\n'
    + '　また、再度の請求も発生いたしません。\n'
    + '　もし既に決済画面を開かれた場合でも、ご請求は0円のままですのでご安心ください。\n\n'
    + '【ご予約自体について】\n'
    + '　ご予約（5月25日 09:00〜19:00／コンパクトSUV／札幌デリバリー専門店）は\n'
    + '　通常通り承っております。当日のご利用に支障はございません。\n\n'
    + 'このたびは弊社の不手際により、ご不安とご不便をおかけしましたこと\n'
    + '重ねて深くお詫び申し上げます。\n'
    + 'ご不明な点がございましたら、本メールに直接ご返信いただくか、\n'
    + '下記までお気軽にお問い合わせくださいませ。\n\n'
    + '──────────────────────\n'
    + 'レンタカーショップHANDYMAN 札幌デリバリー専門店\n'
    + '予約担当\n'
    + 'Mail: reserve@rent-handyman.jp\n'
    + '──────────────────────\n';

  try {
    GmailApp.sendEmail(to, subject, body, {
      name: 'HANDYMAN 札幌デリバリー専門店',
      from: 'reserve@rent-handyman.jp',
      replyTo: 'reserve@rent-handyman.jp'
    });
    var nowIso = new Date().toISOString();
    props.setProperty(SENT_KEY, nowIso);
    Logger.log('[Apology] Sent to ' + to + ' at ' + nowIso);

    // Slack 通知
    try {
      postToSlackChannel_('C0AQL6HGG3E',
        '📧 *田草川様 お詫びメール送信完了*\n'
        + '予約番号: R0EQE3JK\n'
        + '宛先: ' + to + '\n'
        + '件名: ' + subject + '\n'
        + '送信時刻: ' + nowIso);
    } catch(e) { Logger.log('[Apology] Slack post error: ' + e.message); }
  } catch (e) {
    Logger.log('[Apology] Send error: ' + e.message);
    try {
      postToSlackChannel_('C0AQL6HGG3E', '🔴 *お詫びメール送信失敗*\n予約: R0EQE3JK / 田草川様\nエラー: ' + e.message);
    } catch(_) {}
  }
}

// ============================================================
// ★ じゃらん未決済 リマインダーメール再送（札幌）
//    トリガー: 毎日 9:30（setupSpkJalanReminderTrigger で設定）
// ============================================================

/**
 * 札幌: じゃらん未決済リマインダー再送
 * 対象: status=email_sent かつ 出発3日以内
 */
function resendSpkJalanUnpaidReminder() {
  var now = new Date();
  var today = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
  var in3days = Utilities.formatDate(new Date(now.getTime() + 3 * 86400000), 'Asia/Tokyo', 'yyyy-MM-dd');

  var rows = supabaseGet_('jalan_payments',
    'status=in.(email_sent,link_created)' +
    '&lend_date=gte.' + today +
    '&lend_date=lte.' + in3days +
    '&select=reservation_id,customer_name,customer_email,amount,square_payment_url,lend_date,return_date,vehicle_class');

  if (!rows || rows.length === 0) {
    Logger.log('[SpkJalanReminder] 対象なし');
    return;
  }

  var sent = [], failed = [];
  rows.forEach(function(pay) {
    if (!pay.customer_email || !pay.square_payment_url) {
      failed.push(pay.reservation_id + '(email/url欠落)');
      return;
    }
    var ok = sendSpkJalanReminderEmail_(pay);
    if (ok) {
      // ★ 送信成功 → status='reminded' に更新（翌日以降の重複送信を防止）
      supabaseUpdate_('jalan_payments', 'reservation_id=eq.' + encodeURIComponent(pay.reservation_id), {status: 'reminded'});
      sent.push(pay.reservation_id + ' ' + pay.customer_name + '様（' + pay.lend_date + '出発）');
      Logger.log('[SpkJalanReminder] 送信+status=reminded: ' + pay.reservation_id);
    } else {
      failed.push(pay.reservation_id + '(送信失敗)');
    }
  });

  // Slack通知
  var msg = '📧 *じゃらん未決済リマインダー再送（札幌）*\n'
    + '対象: ' + rows.length + '件 → 送信: ' + sent.length + '件\n'
    + (sent.length > 0 ? sent.map(function(s){return '✅ ' + s;}).join('\n') + '\n' : '')
    + (failed.length > 0 ? failed.map(function(f){return '❌ ' + f;}).join('\n') : '');
  postToSlackChannel_(JALAN_PAY_CHANNEL, msg);
  Logger.log('[SpkJalanReminder] 完了 送信:' + sent.length + ' 失敗:' + failed.length);
}

/**
 * 札幌: リマインダーメール本文（件名に【リマインド】追記）
 */
function sendSpkJalanReminderEmail_(pay) {
  if (!pay || !pay.customer_email || !pay.square_payment_url) return false;
  try {
    var subject = '【リマインド】【レンタカー HANDYMAN 札幌デリバリー専門店】事前決済のお願い（予約番号: ' + pay.reservation_id + '）';
    var body = pay.customer_name + ' 様\n\n'
      + 'レンタカー HANDYMAN 札幌デリバリー専門店です。\n'
      + 'この度はご予約いただきありがとうございます。\n\n'
      + '当店では貸渡時の待ち時間をゼロにし、スムーズにご出発いただくため、\n'
      + '事前決済のご協力をお願いしております。\n'
      + 'お手数ですが、ご出発前にお手続きいただけますと幸いです。\n\n'
      + '予約番号: ' + pay.reservation_id + '\n'
      + '貸出日: ' + (pay.lend_date || '') + '\n'
      + '返却日: ' + (pay.return_date || '') + '\n\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + '■ 事前決済\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + 'お支払い金額: ¥' + (pay.amount || 0).toLocaleString() + '\n'
      + '下記リンクよりお支払いをお願いいたします。\n'
      + pay.square_payment_url + '\n\n'
      + '※ ご出発3日前の19:00までにお支払いください。\n'
      + '※ 期限を過ぎた場合、ご予約をキャンセルさせていただく場合がございます。\n\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + '■ LINE登録（未登録の方）\n'
      + '━━━━━━━━━━━━━━━━━━━━\n'
      + 'お届け情報・当日のご連絡はLINEで行います。\n'
      + 'LINE公式👉 https://lin.ee/g6iDNYz\n'
      + 'LINE ID👉 @730kyhwl\n\n'
      + 'HANDYMAN 札幌デリバリー専門店\n'
      + 'TEL: 050-1724-6197（9:00〜19:00）\n';
    GmailApp.sendEmail(pay.customer_email, subject, body, {
      name: 'HANDYMAN 札幌デリバリー専門店',
      from: 'reserve@rent-handyman.jp',
      replyTo: 'reserve@rent-handyman.jp'
    });
    return true;
  } catch (e) {
    Logger.log('[SpkJalanReminderEmail] Error: ' + e.message);
    return false;
  }
}

/**
 * リマインダートリガー設定（1回実行で完了）
 * 札幌: 毎日 9:30
 */
function setupSpkJalanReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'resendSpkJalanUnpaidReminder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('resendSpkJalanUnpaidReminder')
    .timeBased().everyDays(1).atHour(9).nearMinute(30).create();
  Logger.log('[Trigger] resendSpkJalanUnpaidReminder 毎日9:30 設定完了');
}

// ============================================================================
// 協力会社操作 Slack通知 (2026-05-16 追加・Phase 4)
// ============================================================================
//
// 用途: partner.html で協力会社が在庫調整 (自社予約/メンテ登録・削除) した時に
//       Slack #partner_handyman に通知する。partner_actions テーブルを 5分polling。
// 通知先: PARTNER_NOTIFY_CHANNEL（既存 JALAN_PAY_CHANNEL を流用 or 新規チャンネル）
//
var PARTNER_NOTIFY_CHANNEL = 'C0B451BSK1B'; // #partner予約管理 (2026-05-16 設定)
                                                  // 専用チャンネル作成後に差し替え

// ★ 通知対象: 自社予約 作成/削除 + メンテ削除 のみ（オーナー指示 2026-05-16）
var PARTNER_NOTIFY_ACTIONS = ['partner_reserved_add', 'partner_reserved_delete', 'maintenance_delete'];

function notifyPartnerActions() {
  try {
    var rows = supabaseGet_('partner_actions', 'notified_slack=eq.false&order=ts.asc&limit=50');
    if (!rows || rows.length === 0) {
      updateHeartbeat_('spk_partner_notify', {success:0, processed:0});
      return;
    }
    Logger.log('[PartnerNotify] ' + rows.length + ' new actions');
    var notified = 0, skipped = 0;
    rows.forEach(function(r) {
      try {
        // ★ 通知対象外は notified_slack=true に更新してスキップ（ログは残る）
        if (PARTNER_NOTIFY_ACTIONS.indexOf(r.action_type) === -1) {
          supabaseUpdate_('partner_actions', 'id=eq.' + r.id, {
            notified_slack: true,
            notified_at: new Date().toISOString()
          });
          skipped++;
          return;
        }
        var label = '', emoji = '';
        switch (r.action_type) {
          case 'partner_reserved_add': emoji = '🟣'; label = '自社予約 作成'; break;
          case 'partner_reserved_delete': emoji = '🗑️'; label = '自社予約 削除'; break;
          case 'maintenance_delete': emoji = '🗑️'; label = 'メンテナンス 削除'; break;
          default: emoji = '📝'; label = r.action_type;
        }
        // 協力会社名
        var pcRows = supabaseGet_('partner_companies', 'id=eq.' + encodeURIComponent(r.owner_company || '') + '&select=label&limit=1');
        var companyLabel = (pcRows && pcRows.length > 0) ? pcRows[0].label : (r.owner_company || '不明');
        // 車種（車両名+ナンバー）
        var vRows = supabaseGet_('vehicles', 'code=eq.' + encodeURIComponent(r.vehicle_code || '') + '&select=name,plate_no,type&limit=1');
        var vehicleInfo = (vRows && vRows.length > 0)
          ? ((vRows[0].name || '') + ' (' + (vRows[0].plate_no || '') + ')')
          : (r.vehicle_code || '?');
        var vehicleClass = (vRows && vRows.length > 0) ? (vRows[0].type || '') : '';
        // 日程
        var period = '';
        if (r.target_date_from) {
          period = r.target_date_from;
          if (r.target_date_to && r.target_date_to !== r.target_date_from) {
            period += ' 〜 ' + r.target_date_to;
            // 日数計算
            try {
              var d1 = new Date(r.target_date_from);
              var d2 = new Date(r.target_date_to);
              var days = Math.floor((d2 - d1) / 86400000) + 1;
              period += '  (' + days + '日間)';
            } catch(e) {}
          } else {
            period += '  (1日)';
          }
        }
        // タイムスタンプ
        var tsStr = '';
        try { tsStr = new Date(r.ts).toLocaleString('ja-JP', {timeZone:'Asia/Tokyo', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}); } catch(e) { tsStr = String(r.ts).substring(0,16); }

        // ★ 2026-05-16: Block Kit リッチデザイン
        var blocks = [
          {
            type: 'header',
            text: { type: 'plain_text', text: emoji + ' ' + label, emoji: true }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: '*🏢 協力会社*\n' + companyLabel },
              { type: 'mrkdwn', text: '*🚗 車両*\n' + vehicleInfo + (vehicleClass ? ' / ' + vehicleClass + 'クラス' : '') }
            ]
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*📅 期間*\n`' + period + '`' }
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: '⏰ ' + tsStr + ' ／ 操作者: ' + (r.user_email || '不明') }
            ]
          },
          { type: 'divider' }
        ];
        // フォールバックtext（通知バー・モバイル通知センター用）
        var fallback = emoji + ' ' + label + ' / ' + companyLabel + ' / ' + vehicleInfo + ' / ' + period;
        postToSlackChannel_(PARTNER_NOTIFY_CHANNEL, fallback, blocks);
        supabaseUpdate_('partner_actions', 'id=eq.' + r.id, {
          notified_slack: true,
          notified_at: new Date().toISOString()
        });
        notified++;
      } catch (e) {
        Logger.log('[PartnerNotify] Error id=' + r.id + ': ' + e.message);
      }
    });
    Logger.log('[PartnerNotify] Done. notified=' + notified + ' skipped=' + skipped + '/' + rows.length);
    updateHeartbeat_('spk_partner_notify', {success: notified, processed: rows.length, skipped: skipped});
  } catch (e) {
    Logger.log('[PartnerNotify] FATAL: ' + e.message);
    updateHeartbeat_('spk_partner_notify', {success:0, processed:0, error: e.message});
  }
}

/**
 * 協力会社操作通知トリガー設定（1回実行で完了）
 * 5分間隔
 */
function setupPartnerNotifyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'notifyPartnerActions') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifyPartnerActions')
    .timeBased().everyMinutes(5).create();
  Logger.log('[Trigger] notifyPartnerActions 5分間隔 設定完了');
}

/**
 * 動作確認用 - 手動実行
 */
function testNotifyPartnerActions() {
  notifyPartnerActions();
}

/**
 * 🔧 2026-05-25: 予約外売上 手動 paid=true 更新（取りこぼし復旧用）
 *
 * 背景:
 *   入金確認システム v3 (checkPaymentStatus) はスプシ更新+Slack通知まで完了するが、
 *   DB spk_accounting.paid の更新は HANDYMAN Payment Bot v1 の syncPaidToAccounting に委譲されている。
 *   syncPaidToAccounting が動いていない or 対象をスキップした場合、APP TOP「予約外売上 未回収」に
 *   実際は入金済みのレコードが残り続ける。
 *
 * 動作:
 *   1. TARGETS の予約番号で spk_accounting.type='extra_sales' AND paid=false を検索
 *   2. ヒット行を paid=true, paid_at=now() に更新
 *   3. Slack #payment_sapporo に結果通知
 *
 * 使い方:
 *   1. TARGETS を編集（予約番号・宛名・金額を確認のため記載）
 *   2. GASエディタで関数選択 → ▶️実行
 *   3. ログ + Slack で結果確認
 *   4. APP TOP リロードで「予約外売上 未回収」から外れることを確認
 */
function markExtraSalesPaidManual() {
  // type省略時は 'extra_sales' をデフォルト（既存呼び出し互換）
  // 'advance' = 立替金（ガソリン代・有料道路 等）
  var TARGETS = [
    { resvNo: 'DY00000000966', name: 'ワダ タイキ',     amount: 1833,  type: 'advance'     }  // 2026-05-25 19:17 ガソリン代立替
  ];
  var fixed = [], skipped = [], failed = [];

  for (var i = 0; i < TARGETS.length; i++) {
    var t = TARGETS[i];
    var targetType = t.type || 'extra_sales';
    try {
      // 現在状態確認（指定 type のみを対象、type 違いを誤更新しないため）
      // ★ 2026-05-25: spk_accounting には paid_at カラムが存在しないため除外
      var rows = supabaseGet_('spk_accounting',
        'resv_no=eq.' + encodeURIComponent(t.resvNo) +
        '&type=eq.' + encodeURIComponent(targetType) +
        '&select=id,resv_no,user_name,amount,paid,category,type,date');
      if (!rows || rows.length === 0) {
        skipped.push(t.resvNo + ' (' + targetType + ': DB行なし)');
        Logger.log('[ManualPaid] skip: ' + t.resvNo + ' type=' + targetType + ' (no row)');
        continue;
      }

      var unpaidRows = rows.filter(function(r){ return !r.paid; });
      if (unpaidRows.length === 0) {
        skipped.push(t.resvNo + ' (' + targetType + ': 既に paid=true)');
        Logger.log('[ManualPaid] skip: ' + t.resvNo + ' type=' + targetType + ' (already paid)');
        continue;
      }

      // 金額検証（誤更新防止）— 同 type 内の未払い行が複数ある場合 t.amount で絞り込み
      var rowsToUpdate = unpaidRows;
      if (unpaidRows.length > 1 && t.amount) {
        var matched = unpaidRows.filter(function(r){ return Math.abs(+r.amount - t.amount) <= 1; });
        if (matched.length === 0) {
          skipped.push(t.resvNo + ' (' + targetType + ': 金額¥' + t.amount + 'と一致する行なし、' + unpaidRows.length + '行候補)');
          Logger.log('[ManualPaid] skip: ' + t.resvNo + ' amount no match. candidates=' + unpaidRows.map(function(r){return r.amount;}).join(','));
          continue;
        }
        rowsToUpdate = matched;
      }

      // 金額検証（誤更新防止）
      var totalAmt = rowsToUpdate.reduce(function(s, r){ return s + (+r.amount||0); }, 0);
      if (t.amount && Math.abs(totalAmt - t.amount) > 1) {
        Logger.log('[ManualPaid] WARNING amount mismatch ' + t.resvNo + ': expect=¥' + t.amount + ' actual=¥' + totalAmt);
      }

      // 更新（id ベースで確実に対象行のみ更新）
      var allOk = true;
      rowsToUpdate.forEach(function(r) {
        var ok = supabaseUpdate_('spk_accounting',
          'id=eq.' + encodeURIComponent(r.id) + '&paid=eq.false',
          { paid: true });
        if (!ok) allOk = false;
      });

      if (allOk) {
        fixed.push('[' + (targetType === 'advance' ? '立替' : '予約外') + '] ' + t.resvNo + ' ' + t.name + ' ¥' + totalAmt.toLocaleString() + ' (' + rowsToUpdate.length + '行)');
        Logger.log('[ManualPaid] ✅ ' + t.resvNo + ' type=' + targetType + ' → paid=true (' + rowsToUpdate.length + ' rows)');
      } else {
        failed.push(t.resvNo + ' (一部更新失敗)');
      }
    } catch (e) {
      failed.push(t.resvNo + ' (例外: ' + e.message + ')');
      Logger.log('[ManualPaid] error: ' + t.resvNo + ' - ' + e.message);
    }
  }

  // Slack通知
  var lines = ['🔧 *予約外売上 手動 paid=true 更新*', ''];
  lines.push('✅ 修正: ' + fixed.length + '件');
  fixed.forEach(function(x){ lines.push('  • ' + x); });
  if (skipped.length > 0) {
    lines.push('');
    lines.push('⏭️ スキップ: ' + skipped.length + '件');
    skipped.forEach(function(x){ lines.push('  • ' + x); });
  }
  if (failed.length > 0) {
    lines.push('');
    lines.push('❌ 失敗: ' + failed.length + '件');
    failed.forEach(function(x){ lines.push('  • ' + x); });
  }
  lines.push('');
  lines.push('📌 根本対応: HANDYMAN Payment Bot v1 の `syncPaidToAccounting` トリガー稼働状況を要確認');

  try { postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n')); } catch(e) {}
  Logger.log('[ManualPaid] Done: fixed=' + fixed.length + ' skipped=' + skipped.length + ' failed=' + failed.length);
}

/**
 * 🔍 2026-05-25: 未回収レコードの 一括 paid 同期診断
 * spk_accounting.type IN ('extra_sales','advance') AND paid=false のうち、
 * スプシ「✅ 入金済み」になっている行を一覧化
 * （手動更新が必要なレコードを炙り出す診断・更新はしない）
 * - extra_sales: 予約外売上
 * - advance: 立替金（ガソリン代立替・有料道路立替 等）
 */
function diagnoseExtraSalesUnpaid() {
  // 1. DB 未収一覧（extra_sales / advance 両方対象）
  var dbRows = supabaseGet_('spk_accounting',
    'type=in.(extra_sales,advance)&paid=eq.false&select=id,resv_no,user_name,amount,date,category,type&order=date.desc&limit=100');
  if (!dbRows || dbRows.length === 0) {
    Logger.log('[Diagnose] DB未収なし'); return;
  }
  Logger.log('[Diagnose] DB未収: ' + dbRows.length + '件');

  // 2. スプシ「✅ 入金済み」読み込み
  var sheetId = '1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc';
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('支払い管理');
  var lastRow = sheet.getLastRow();
  var sheetData = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var paidSet = {};
  sheetData.forEach(function(row) {
    var status = String(row[8] || '');
    var resvNo = String(row[3] || '').trim();
    if (status.indexOf('入金済') >= 0 && resvNo) paidSet[resvNo] = true;
  });

  // 3. 突合
  var mismatch = [];
  dbRows.forEach(function(r) {
    if (paidSet[r.resv_no]) {
      mismatch.push({ resvNo:r.resv_no, name:r.user_name, amount:r.amount, date:r.date, type:r.type, category:r.category });
    }
  });

  Logger.log('[Diagnose] スプシ入金済 & DB未収 = ' + mismatch.length + '件（要修正）');
  mismatch.forEach(function(m) {
    var label = (m.type === 'advance' ? '立替' : '予約外');
    Logger.log('  • [' + label + '] ' + m.resvNo + ' ' + m.name + ' ¥' + (+m.amount||0).toLocaleString() + ' (' + m.category + ' / ' + m.date + ')');
  });

  // Slack通知
  var lines = ['🔍 *未回収診断 (予約外売上+立替金)*', ''];
  lines.push('DB `paid=false`: ' + dbRows.length + '件 (extra_sales/advance 合算)');
  lines.push('うちスプシ✅入金済 (=要DB更新): ' + mismatch.length + '件');
  if (mismatch.length > 0) {
    lines.push('');
    mismatch.forEach(function(m) {
      var label = (m.type === 'advance' ? '立替' : '予約外');
      lines.push('  • `[' + label + ']` ' + m.resvNo + ' ' + m.name + ' ¥' + (+m.amount||0).toLocaleString() + ' (' + (m.category||'') + ' / ' + m.date + ')');
    });
    lines.push('');
    lines.push('→ `markExtraSalesPaidManual` の TARGETS に追加して手動更新してください');
  }
  try { postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n')); } catch(e) {}
}

/**
 * 🌙 2026-05-25: 日次自動診断パトロール（再発防止 層3・検出+通知のみ）
 *
 * 目的:
 *   層1 (checkPaymentStatus v3 の DB更新統合) が将来破損・コード書き換えで動かなくなった時、
 *   翌朝には Slack 通知で気づける早期検知の保険。
 *
 * 動作:
 *   - 毎朝 9:15 に自動実行
 *   - spk_accounting (extra_sales/advance) で paid=false かつスプシ✅入金済の差分を検出
 *   - 0件なら通知なし（情報過多防止）
 *   - 1件以上なら Slack #payment_sapporo に通知（オーナーが手動修正）
 *
 * 自動修正はしない（CLAUDE.md 2026-05-11 ルール「自動修復系GASは原則作らない」遵守）
 */
function nightlyAccountingPatrol() {
  try {
    var dbRows = supabaseGet_('spk_accounting',
      'type=in.(extra_sales,advance)&paid=eq.false&select=id,resv_no,user_name,amount,date,category,type&order=date.desc&limit=100');
    if (!dbRows || dbRows.length === 0) {
      Logger.log('[NightlyPatrol] DB未収なし → OK');
      return;
    }

    var sheet = SpreadsheetApp.openById('1-QU8JwrGgwp9CcZT6QieYQH0y112Hb4I5GoobrrM6tc').getSheetByName('支払い管理');
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var sheetData = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
    var paidMap = {};
    sheetData.forEach(function(row) {
      var status = String(row[8] || '');
      var resvNo = String(row[3] || '').trim();
      if (status.indexOf('入金済') >= 0 && resvNo) paidMap[resvNo] = true;
    });

    var mismatch = dbRows.filter(function(r){ return paidMap[r.resv_no]; })
      .map(function(r){ return { resvNo:r.resv_no, name:r.user_name, amount:r.amount, date:r.date, type:r.type, category:r.category }; });

    if (mismatch.length === 0) {
      Logger.log('[NightlyPatrol] 同期漏れなし → OK (DB未収 ' + dbRows.length + '件は全てスプシも未払い)');
      return;
    }

    var lines = ['⚠️ *入金同期漏れ検出* (' + mismatch.length + '件・要手動修正)', ''];
    lines.push('スプシ✅入金済 だが DB `paid=false` のレコード:');
    lines.push('');
    mismatch.forEach(function(m) {
      var label = (m.type === 'advance' ? '立替' : '予約外');
      lines.push('  • `[' + label + ']` ' + m.resvNo + ' ' + m.name + ' ¥' + (+m.amount||0).toLocaleString() + ' (' + (m.category||'') + ' / ' + m.date + ')');
    });
    lines.push('');
    lines.push('対応: GASエディタで `markExtraSalesPaidManual` の TARGETS に追加して実行');
    lines.push('```');
    mismatch.forEach(function(m) {
      lines.push('  { resvNo: \'' + m.resvNo + '\', name: \'' + m.name + '\', amount: ' + m.amount + ', type: \'' + m.type + '\' },');
    });
    lines.push('```');
    postToSlackChannel_(JALAN_PAY_CHANNEL, lines.join('\n'));
    Logger.log('[NightlyPatrol] ⚠️ 同期漏れ ' + mismatch.length + '件 検出 → Slack通知');
  } catch (e) {
    Logger.log('[NightlyPatrol] FATAL: ' + e.message);
    try { postToSlackChannel_(JALAN_PAY_CHANNEL, '🔴 *入金同期パトロール例外*\n' + e.message); } catch(_) {}
  }
}

/**
 * nightlyAccountingPatrol のトリガー設定（1回だけ手動実行）
 * 毎朝9:15に自動実行
 */
function setupAccountingPatrolTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'nightlyAccountingPatrol') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nightlyAccountingPatrol')
    .timeBased().everyDays(1).atHour(9).nearMinute(15).create();
  Logger.log('[Trigger] nightlyAccountingPatrol 毎朝9:15 設定完了');
}

