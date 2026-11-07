#!/usr/bin/env python3
# 2026-11-07 取込GAS(Code.js)に「楽天の決済方法を ota_pay_method に記録」を足す。clasp pull した本番の Code.js に当てる。
# 使い方: python3 gas_patch.py spk|nha <Code.jsのパス>   （2回当てても二重にならない）
import sys
store, p = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf8').read()
if 'function parseRktPayMethod_' in s:
    print('already patched'); sys.exit(0)
fn = '''
// ★2026-11-07 楽天の決済方法（金額の後ろの「(オンラインカード決済)」/「(現地決済)」）を台帳 ota_pay_method へ。
//   OPシート（タスクサマリ）・スタッフ個別URLの💳表示用。（合計）→（差引支払金額）の順なので最後の一致が実際の支払。
//   失敗しても取込は止めない（ログだけ）。
function parseRktPayMethod_(body) {
  var all = String(body || '').match(/([\\d,]+)円\\((オンラインカード決済|現地決済)\\)/g);
  if (!all) return null;
  var m = all[all.length - 1].match(/([\\d,]+)円\\((オンラインカード決済|現地決済)\\)/);
  return { method: m[2] === '現地決済' ? 'onsite' : 'card', amount: Number(m[1].replace(/,/g, '')) || null };
}
function recordRktPay_(url, key, id, store, pm, mailAt) {
  if (!id || !pm || !url || !key) return;
  try {
    var now = new Date().toISOString();
    var res = UrlFetchApp.fetch(url + '/rest/v1/ota_pay_method?on_conflict=reservation_id', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'resolution=merge-duplicates,return=minimal' },
      payload: JSON.stringify([{ reservation_id: id, store: store, ota: 'R', method: pm.method, amount: pm.amount,
                                 mail_at: mailAt || now, source: 'gas_import', updated_at: now }])
    });
    var c = res.getResponseCode();
    if (c >= 300) Logger.log('[RktPay] ' + id + ' NG ' + c + ' ' + String(res.getContentText()).slice(0, 150));
  } catch (e) { Logger.log('[RktPay] err ' + e); }
}
'''
anchor_fn = "\nfunction parseRakuten_(body) {"
assert s.count(anchor_fn) == 1, 'parseRakuten_ not found once'
s = s.replace(anchor_fn, fn + anchor_fn)
if store == 'spk':
    old = "  // ★2026-09-23 高松HDM(_TAK/高松空港店)→ BT直接取込(bt-import EF)。"
    assert s.count(old) == 1, 'spk anchor'
    ins = """  // ★2026-11-07 楽天の決済方法を記録（高松は bt-import にも pay_method を渡し、配車表の決済欄を正しく入れる）
  if (ota === 'rakuten') {
    var _pm = parseRktPayMethod_(body);
    if (_pm) reservation.pay_method = _pm.method;
    if (_pm && !dryRun) recordRktPay_(getSupabaseUrl_(), PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY') || getSupabaseKey_(),
      reservation.id, (/_TAK/i.test(body) || body.indexOf('高松空港店') !== -1) ? 'tkm' : 'spk', _pm, message.getDate().toISOString());
  }

"""
    s = s.replace(old, ins + old)
elif store == 'nha':
    old = """    return {type:'skip', id:reservation.id, reason:'札幌店'};
  }
"""
    assert s.count(old) == 1, 'nha anchor'
    s = s.replace(old, old + """
  // ★2026-11-07 楽天の決済方法を記録（OPシート・個別URLの💳表示用）
  if (ota === 'rakuten' && !dryRun) recordRktPay_(SUPABASE_URL, SUPABASE_KEY, reservation.id, 'nha', parseRktPayMethod_(body), message.getDate().toISOString());
""")
else:
    sys.exit('store must be spk or nha')
open(p, 'w', encoding='utf8').write(s)
print('patched', store, p)
