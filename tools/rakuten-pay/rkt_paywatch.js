#!/usr/bin/env node
// ★2026-11-07 楽天の決済方法 見張り（launchd com.handyman.rkt-paywatch・5分ごと）
//   楽天の「予約受付」メールの金額の後ろの (オンラインカード決済) / (現地決済) を読み、
//   予約番号ごとに EF ota-paymethod へ送る → 台帳 ota_pay_method（札幌・那覇のOPシート/個別URLが表示）＋高松は配車表の決済欄を合わせる。
//   読むだけ（Gmail にラベル付け・既読化などはしない）。使い方: node rkt_paywatch.js [--full] [--dry]
//   ログ ~/pne_tick/rkt_paywatch.log（鍵は書かない）
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const A = process.argv.slice(2), FULL = A.includes('--full'), DRY = A.includes('--dry');
const D = path.join(os.homedir(), 'pne_tick'), LOGF = path.join(D, 'rkt_paywatch.log');
const log = s => { try { fs.appendFileSync(LOGF, new Date().toISOString().replace('T', ' ').slice(0, 19) + ' ' + s + '\n', { mode: 0o600 }); } catch (_) {} };
const conf = {}; for (const l of fs.readFileSync(path.join(D, 'conf'), 'utf8').split('\n')) { const m = l.match(/^\s*(URL_SPK|KEY)=(.*)$/); if (m) conf[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
const runsh = fs.readFileSync(path.join(os.homedir(), 'handyman-invctl', 'run.sh'), 'utf8');
const IV_URL = (runsh.match(/INVCTL_URL="([^"]*)"/) || [])[1];
const IV_ANON = (runsh.match(/INVCTL_ANON="([^"]*)"/) || [])[1];
let IV_TOKEN = ''; try { IV_TOKEN = cp.execFileSync('security', ['find-generic-password', '-s', 'handyman-invctl', '-a', 'ingest_token', '-w']).toString().trim(); } catch (_) {}

function http(method, url, headers, body) {
  const tmp = path.join(os.tmpdir(), 'rp_' + process.pid + '_' + crypto.randomBytes(4).toString('hex'));
  const hf = tmp + '.req'; fs.writeFileSync(hf, Object.entries(headers || {}).map(([k, v]) => k + ': ' + v).join('\n') + '\n', { mode: 0o600 });
  const a = ['-sS', '-L', '-m', '120', '-o', tmp, '-w', '%{http_code}', '-H', '@' + hf];
  if (!(method === 'POST' && body != null)) a.push('-X', method);
  let input; if (body != null) { a.push('--data-binary', '@-'); input = Buffer.from(String(body), 'utf8'); }
  a.push(url);
  let code = 0; try { code = Number(cp.execFileSync('curl', a, { input, maxBuffer: 64 << 20 }).toString().trim()) || 0; } catch (_) {}
  let text = ''; try { text = fs.readFileSync(tmp, 'utf8'); } catch (_) {}
  for (const f of [tmp, hf]) { try { fs.unlinkSync(f); } catch (_) {} }
  return { code, text };
}
let TOKEN = null;
function gtoken() {
  const r = http('POST', conf.URL_SPK, { 'Content-Type': 'application/json' }, JSON.stringify({ action: 'pne_tick', key: conf.KEY, op: 'token' }));
  const j = JSON.parse(r.text); if (!j.ok || !j.token) throw new Error('gate token NG'); return j.token;
}
function gapi(p) {
  if (!TOKEN) TOKEN = gtoken();
  let r = http('GET', 'https://gmail.googleapis.com/gmail/v1/users/me' + p, { Authorization: 'Bearer ' + TOKEN });
  if (r.code === 401) { TOKEN = gtoken(); r = http('GET', 'https://gmail.googleapis.com/gmail/v1/users/me' + p, { Authorization: 'Bearer ' + TOKEN }); }
  if (r.code < 200 || r.code >= 300) throw new Error('Gmail ' + p.split('?')[0] + ' ' + r.code);
  return JSON.parse(r.text);
}
const b64d = s => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
function parts(p, acc) { acc = acc || []; if (!p) return acc; acc.push(p); (p.parts || []).forEach(x => parts(x, acc)); return acc; }
const hdr = (m, n) => ((m.payload && m.payload.headers || []).find(x => x.name.toLowerCase() === n.toLowerCase()) || {}).value || '';

// 本文 → {id, store, method, amount}
function parse(body) {
  const id = (body.match(/予約番号[\s　]*：[\s　]*(RC\d+)/) || [])[1];
  if (!id) return null;
  const pays = [...body.matchAll(/([\d,]+)円\((オンラインカード決済|現地決済)\)/g)];
  if (!pays.length) return null;
  const last = pays[pays.length - 1];            // （合計）→（差引支払金額）の順なので最後＝実際の支払額
  const shop = (body.match(/貸渡営業所名[\s　]*：([^\n]*)/) || [])[1] || '';
  const store = /那覇/.test(shop) ? 'nha' : /札幌/.test(shop) ? 'spk' : /高松/.test(shop) ? 'tkm' : '';
  return { id, store, method: last[2] === '現地決済' ? 'onsite' : 'card', amount: Number(last[1].replace(/,/g, '')) || null };
}

try {
  if (!IV_URL || !IV_TOKEN) throw new Error('INVCTL_URL / ingest_token が無い');
  const q = 'from:travel@mail.travel.rakuten.co.jp subject:予約受付 ' + (FULL ? 'after:2025/11/01' : 'newer_than:2d');
  const ids = []; let pt = '';
  do {
    const j = gapi('/messages?maxResults=500&q=' + encodeURIComponent(q) + (pt ? '&pageToken=' + pt : ''));
    (j.messages || []).forEach(m => ids.push(m.id)); pt = j.nextPageToken || '';
  } while (pt && ids.length < 20000);
  const best = {};  // 予約番号ごとに一番新しいメール
  let skipped = 0;
  for (const mid of ids) {
    const m = gapi('/messages/' + mid + '?format=full');
    if (/キャンセル/.test(hdr(m, 'Subject'))) { skipped++; continue; }
    const ps = parts(m.payload);
    let body = ps.filter(x => x.mimeType === 'text/plain' && x.body && x.body.data).map(x => b64d(x.body.data)).join('\n');
    if (!body) body = ps.filter(x => x.mimeType === 'text/html' && x.body && x.body.data).map(x => b64d(x.body.data)).join('\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const p = parse(body); if (!p) { skipped++; continue; }
    p.mail_at = new Date(Number(m.internalDate)).toISOString();
    if (!best[p.id] || best[p.id].mail_at < p.mail_at) best[p.id] = p;
  }
  const items = Object.values(best);
  const onsite = items.filter(x => x.method === 'onsite').map(x => x.store + ':' + x.id);
  if (DRY) { console.log(JSON.stringify({ dry: true, mails: ids.length, items: items.length, onsite })); process.exit(0); }
  let res = { ok: true, upserted: 0, bt: [] };
  for (let i = 0; i < items.length; i += 500) {
    const r = http('POST', IV_URL + '/functions/v1/ota-paymethod', { 'Content-Type': 'application/json', apikey: IV_ANON, Authorization: 'Bearer ' + IV_ANON },
      JSON.stringify({ token: IV_TOKEN, items: items.slice(i, i + 500) }));
    const j = JSON.parse(r.text || '{}'); if (!j.ok) throw new Error('EF ' + r.code + ' ' + (j.err || ''));
    res.upserted += j.upserted || 0; res.bt = res.bt.concat(j.bt || []);
  }
  const line = JSON.stringify({ ok: true, full: FULL, mails: ids.length, skipped, items: items.length, upserted: res.upserted, onsite, bt: res.bt });
  log(line); console.log(line);
} catch (e) { const line = JSON.stringify({ ok: false, err: String(e.message || e).slice(0, 200) }); log(line); console.log(line); process.exit(1); }
