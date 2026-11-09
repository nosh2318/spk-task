// 独立チェッカー 第2段：公式サイトをお客様と同じ画面で読む（ログインしない・予約/決済ボタンは押さない）。
// 書き込みロボ（readers.mjs）とは別プログラム。読んだ「表示金額」「予約できるか」を DB へ渡すだけ。判定は DB 側。
// 使い方：CHK_OUT=latest.json node chk_official.mjs [対象名…]   （対象名なし＝全部）
//   CHK_OUT あり＝鍵なし。読んだ結果をファイルに書くだけ（GitHub Actions が chk-results ブランチに置き、DB が10分ごとに取りに来る）
//   CHK_OUT なし＝従来どおり CHK_TOKEN で DB の invctl_chk_put へ直接送る（ミニでの手元試験用）
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const MAIN = { url: 'https://ckrxttbnawkclshczsia.supabase.co', key: 'sb_publishable_aTVhlY0YD-5BBfI03ZNnsg_MzO_vsIe' };
const BT = { url: 'https://ggqugvyskyiblxiycpci.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18' };
// 公式サイトの車カードは「総額÷日数を100円で丸めた1日あたり」(avg100)、KEYDROP は「初日の1日料金」(first)
const TARGETS = [
  { name: 'hdm-nha', store: 'nha', site: 'OFFICIAL', db: MAIN, page: 'https://hdm-rentacar.jp/official-flow.html', area: 'naha', method: 'delivery', unit: 'avg100' },
  { name: 'hdm-spk', store: 'spk', site: 'OFFICIAL', db: MAIN, page: 'https://hdm-rentacar.jp/official-flow.html', area: 'sapporo', method: 'delivery', unit: 'avg100' },
  { name: 'hdm-tkm', store: 'takh', site: 'OFFICIAL', db: BT, page: 'https://hdm-rentacar.jp/official-flow.html', area: 'takamatsu', method: 'airport', unit: 'avg100' },
  { name: 'old-nha', store: 'nha', site: 'OFFICIAL_OLD', db: MAIN, page: 'https://rent-handyman.com/official-flow.html', area: 'naha', method: 'delivery', unit: 'avg100' },
  { name: 'old-spk', store: 'spk', site: 'OFFICIAL_OLD', db: MAIN, page: 'https://rent-handyman.com/official-flow.html', area: 'sapporo', method: 'delivery', unit: 'avg100' },
  { name: 'old-tkm', store: 'takh', site: 'OFFICIAL_OLD', db: BT, page: 'https://rent-handyman.com/official-flow.html', area: 'takamatsu', method: 'airport', unit: 'avg100' },
  { name: 'kd-nha', store: 'nha', site: 'KEYDROP', db: MAIN, page: 'https://keydrop.jp/v3/keydrop-flow.html', area: 'naha', method: 'delivery', unit: 'first' },
  { name: 'kd-spk', store: 'spk', site: 'KEYDROP', db: MAIN, page: 'https://keydrop.jp/v3/keydrop-flow.html', area: 'sapporo', method: 'delivery', unit: 'first' },
  // 11/9 BUDDICA 公式（tourism.buddica.jp）：検索（POST /reserve_class）の結果ページの「基本料金（期間の合計）」を読む。予約に進むは押さない。
  // 当日・翌日は全車でエラーページ（422）を返すことがあるので読まない（far=2 から）。一覧に無いクラス＝その日は予約できない
  { name: 'bdc-tkb', store: 'takb', site: 'OFFICIAL', db: BT, page: 'https://tourism.buddica.jp/', kind: 'bdc', unit: 'total', from: 2, par: 1 },  // 同時に開くと検索の鍵（_token）が合わず 419 になるので1つずつ
];
const BDC_CODE = n => { const m = n.match(/_\(([A-Z]{1,2})\)\s*$/); if (m) return m[1];
  return /G400d/i.test(n) ? 'G4D' : /Cabriolet/i.test(n) ? 'ECB' : /Evoque/i.test(n) ? 'EVQ' : /Urus/i.test(n) ? 'URS' : /911/.test(n) ? '911' : null; };
async function readBdc(ctx, t, pd, days, want) {
  const rd = addDays(pd, days - 1), p = await ctx.newPage();
  try {
    await p.goto(t.page, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const r = await p.evaluate(async ([pd, rd]) => { const f = document.form_index; if (!f) return { err: '検索の欄が無い' }; const fd = new FormData(f);
      fd.set('borrowing_date', pd); fd.set('return_date', rd); fd.set('borrowing_time', '10:00'); fd.set('return_time', pd === rd ? '18:00' : '10:00');  // 2日物は readPage と同じく返却10:00
      const res = await fetch(f.action, { method: 'POST', body: fd }); return { s: res.status, h: await res.text() }; }, [pd.replace(/-/g, '/'), rd.replace(/-/g, '/')]);
    if (r.err || r.s !== 200) throw new Error(r.err || 'HTTP ' + r.s);
    const tx = r.h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
    const n = +((tx.match(/検索結果：\s*(\d+)\s*件/) || [])[1]); if (!Number.isInteger(n)) throw new Error('検索結果の件数が読めない');
    const cards = [], segs = tx.split(/ ?乗車人数 /);
    for (let i = 1; i < segs.length; i++) { const name = segs[i - 1].split(/予約に進む|再検索|満車/).pop().trim().slice(-45), code = BDC_CODE(name), pm = segs[i].match(/基本料金 ([\d,]+) 円/);
      const ri = segs[i].indexOf('予約に進む'), fi = segs[i].indexOf('満車'), ok = ri >= 0 && (fi < 0 || ri < fi);  // 満車のカードは予約できない
      if (code) cards.push({ cls: code, shown: pm ? +pm[1].replace(/,/g, '') : null, bookable: ok, raw: (name + ' ' + (pm ? pm[0] : '')).slice(0, 60) }); }
    if (cards.length !== n) throw new Error(`件数 ${n} とカード ${cards.length} が合わない`);
    const seen = new Set(cards.map(c => c.cls));
    for (const c of want) if (!seen.has(c)) cards.push({ cls: c, shown: null, bookable: false, raw: '一覧に無い（予約できない）' });
    return cards;
  } finally { await p.close(); }
}
const TOKEN = (process.env.CHK_TOKEN || '').trim();
const OUT = process.env.CHK_OUT || '';
if (!TOKEN && !OUT) { console.error('CHK_OUT（ファイルに書く）か CHK_TOKEN（DB へ送る）のどちらかが要ります'); process.exit(2); }
const OUTBOX = [];                                // CHK_OUT の時に書く中身（クラス×日付×金額×空きだけ）
const dbName = (db) => db === BT ? 'bt' : 'main';
const put = async (t, payload) => {
  if (OUT) { OUTBOX.push({ db: dbName(t.db), run: payload.run, obs: payload.obs }); return; }
  for (let k = 0; k < Math.max(1, payload.obs.length); k += 300) {   // anon は3秒で切れるので 300件ずつ（同じ run_id に足し込む）
    const part = payload.obs.slice(k, k + 300);
    await rpc(t.db, 'invctl_chk_put', { p_token: TOKEN, p_payload: { run: { ...payload.run, got: part.filter(o => o.bookable !== null).length }, obs: part } });
  }
};
const PAR = +process.env.CHK_PAR || 3;           // 同時に開くページ数（相手に負担をかけない）
const NEAR = +process.env.CHK_NEAR || 15;        // 今日〜14日は毎回
const FAR = 61;                                  // 60日先まで。残り（15〜60日）は30分ごとに1日ずつ回す＝1日で一巡
const BLOCK = /googletagmanager|google-analytics|googleads|doubleclick|facebook|clarity\.ms|kd-track\.js|\/rest\/v1\/kd_events/;

const rpc = async (db, fn, body) => {
  const r = await fetch(`${db.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${fn} ${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : null;
};
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };

async function readPage(ctx, t, pd, days) {
  const rd = addDays(pd, days - 1);
  const url = `${t.page}?area=${t.area}&method=${t.method}&pd=${pd}&pt=10:00&rd=${rd}&rt=${days === 1 ? '18:00' : '10:00'}`;
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await p.waitForSelector('#vgrid [data-k]', { timeout: 20000 });
    await p.waitForTimeout(1500); // 料金表・空きの読み込み後の描き直しを待つ
    return await p.$$eval('#vgrid [data-k]', els => els.map(e => {
      const pr = (e.querySelector('.pc,.pr') || {}).innerText || '';
      const m = pr.replace(/[,，]/g, '').match(/[¥￥]\s*(\d+)/);
      return { cls: e.dataset.k, shown: m ? +m[1] : null, bookable: !/is-full|soldout/.test(e.className), raw: pr.replace(/\s+/g, ' ').slice(0, 60) };
    }));
  } finally { await p.close(); }
}

async function runTarget(browser, t) {
  const runId = `off-${t.name}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  const plan = TOKEN ? await rpc(t.db, 'invctl_chk_plan', { p_token: TOKEN, p_store: t.store, p_site: t.site })
                     : await rpc(t.db, 'invctl_chk_plan_pub', { p_store: t.store, p_site: t.site });
  const want = new Set(plan.classes.map(c => c.cls));
  const today = plan.today, slot = Math.floor(Date.now() / 1800000);
  const dates = [];
  for (let i = t.from || 0; i < NEAR; i++) dates.push(addDays(today, i));
  dates.push(addDays(today, NEAR + (slot % (FAR - NEAR))));
  const canary = plan.canary; if (canary && !dates.includes(canary.dd)) dates.push(canary.dd);
  const jobs = []; for (const d of dates) for (const days of [1, 2]) jobs.push({ d, days });
  const ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', userAgent: undefined });
  await ctx.route('**/*', r => BLOCK.test(r.request().url()) ? r.abort() : r.continue());
  const obs = [], errs = []; let i = 0;
  await Promise.all(Array.from({ length: t.par || PAR }, async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      try {
        const cards = t.kind === 'bdc' ? await readBdc(ctx, t, j.d, j.days, want) : await readPage(ctx, t, j.d, j.days);
        for (const c of cards) if (want.has(c.cls)) obs.push({ cls: c.cls, dd: j.d, days: j.days, shown: c.shown, bookable: c.bookable, raw: c.raw, unit: t.unit });
        const seen = new Set(cards.map(c => c.cls));
        for (const c of want) if (!seen.has(c)) obs.push({ cls: c, dd: j.d, days: j.days, shown: null, bookable: null, raw: 'カードなし', unit: t.unit });
      } catch (e) { errs.push(`${j.d}/${j.days}日: ${String(e.message || e).slice(0, 120)}`); }
    }
  }));
  await ctx.close();
  let canaryOk = null;
  if (canary) { const o = obs.find(x => x.cls === canary.cls && x.dd === canary.dd && x.days === 1); canaryOk = o ? o.bookable === false : false; }
  const got = obs.filter(o => o.bookable !== null).length, expected = jobs.length * want.size;
  const run = { run_id: runId, src: 'official', store: t.store, site: t.site, expected, got, canary_ok: canaryOk, err: errs.length ? errs.slice(0, 5).join(' | ') : null };
  await put(t, { run, obs });
  console.log(`${t.name}: 読めた ${got}/${expected}・目印 ${canary ? (canaryOk ? 'OK' : 'NG') : 'なし'}・失敗 ${errs.length}`);
  return errs.length;
}

const only = process.argv.slice(2);
const browser = await chromium.launch(process.env.CHK_CHANNEL ? { channel: process.env.CHK_CHANNEL } : {});
let bad = 0;
for (const t of TARGETS.filter(t => !only.length || only.includes(t.name))) {
  try { bad += await runTarget(browser, t); }
  catch (e) {
    bad++; console.log(`${t.name}: 失敗 ${String(e.message || e).slice(0, 200)}`);
    try { await put(t, { run: { run_id: `off-${t.name}-${Date.now()}`, src: 'official', store: t.store, site: t.site, expected: null, got: 0, canary_ok: null, err: String(e.message || e).slice(0, 500) }, obs: [] }); } catch {}
  }
}
await browser.close();
if (OUT) {
  // 出すのはクラス×日付×日数×表示金額×予約できるか×金額欄の文字だけ（お客様の情報は読んでいない）
  const clean = OUTBOX.map(x => ({ db: x.db, run: x.run, obs: x.obs.map(o => ({ cls: o.cls, dd: o.dd, days: o.days, shown: o.shown, bookable: o.bookable, raw: String(o.raw || '').slice(0, 60), unit: o.unit })) }));
  writeFileSync(OUT, JSON.stringify({ gen: new Date().toISOString(), targets: clean }));
  console.log(`書いた ${OUT}：${clean.length}件・読み ${clean.reduce((a, x) => a + x.obs.length, 0)}`);
}
process.exit(0); // 読めなかったことは DB の見張り（chk_watch）が拾う。ここで落とすと記録が残らない
