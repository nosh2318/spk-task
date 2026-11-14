-- ★2026-11-15 nosh「エラーを拾ってくれ」「全部」：第3段＝取込 GAS の止まり・Mac の常駐の止まりと失敗・オムニの失敗・画面の保存の失敗
--   main・BT 共通。C07B5G3PV7C と 本部 を差し替えて流す（main：C07B5G3PV7C／本部・BT：C0BFD7U097V／高松）。第2段（private.watch_say）の後に流す
--   決まり：拾う → 自動でやり直せるものは仕組みがやり直す → だめな時だけ ①原因②自動でやったこと③人がやること を1件（同じ種類は1時間に1回・同じ事故は1回）
--   戻し方：error_watch_stage3_rollback.sql
--   ★画面の保存はやり直さない（二重に書かないため・§3）。GAS は15分ごとのトリガー、Mac の常駐は launchd と mini の自己回復がやり直す。ここは知らせるだけ

-- 1) 画面の保存の失敗（3店のスタッフ画面・管理画面から1件ずつ届く）。中身はどの表/EF・状態番号・エラー番号だけ（お客様の情報は画面側で落とす）
create table if not exists private.client_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  app text not null,       -- nha / spk / bt
  dev text,                -- 端末ごとの印（ランダム・個人は分からない）
  target text not null,    -- rest:<表> / ef:<関数名>
  method text,
  status int,              -- 0＝通信そのものが失敗（回線・DB に届かない）
  code text,
  msg text
);
create index if not exists client_errors_at on private.client_errors (at);
revoke all on private.client_errors from public, anon, authenticated;

create or replace function public.report_client_error(p jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _app text := left(coalesce(p->>'app', ''), 8);
begin
  if _app not in ('nha', 'spk', 'bt') then return; end if;
  -- 送りすぎ止め：同じ画面から10分に200件まで
  if (select count(*) from private.client_errors where app = _app and at > now() - interval '10 minutes') >= 200 then return; end if;
  insert into private.client_errors (app, dev, target, method, status, code, msg)
  values (_app, left(p->>'dev', 24), left(coalesce(p->>'target', '?'), 60), left(p->>'method', 8),
          case when (p->>'status') ~ '^[0-9]{1,3}$' then (p->>'status')::int end,
          left(p->>'code', 16), left(regexp_replace(coalesce(p->>'msg', ''), '\(.*\)', '(…)', 'g'), 120));
end $$;
revoke all on function public.report_client_error(jsonb) from public;
grant execute on function public.report_client_error(jsonb) to anon, authenticated;

-- 2) Mac mini の見張り（ops_beat.py）が書く「今ある問題」。1行＝1つの問題。Mac が5分ごとに書き直し、直れば消す
create table if not exists public.ops_watch_events (
  key text primary key,     -- mac:<launchd の名前> / omni:<ボット名>
  title text not null,
  why text not null,
  auto text not null,
  todo text not null,
  mark text,                -- 同じ事故の印（増えた・変わった時だけまた知らせる）
  seen_at timestamptz not null default now()
);
alter table public.ops_watch_events enable row level security;   -- ポリシーなし＝service_role（Mac）だけ
revoke all on public.ops_watch_events from anon, authenticated;

create or replace function private.ops_watch(p_ch text, p_sys text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; n_note int := 0; _hr int := extract(hour from (now() at time zone 'Asia/Tokyo')); _t timestamptz; _c timestamptz;
begin
  begin
  -- E) 画面の保存の失敗
  --   ・DB/EF がエラーを返した（status>0）：同じ表/EF で15分に3件以上
  --   ・通信そのものが失敗（status=0）：10分に3台以上（1台だけなら、その端末の回線＝知らせない）
  for r in select app, target, max(status) st, max(code) cd, max(msg) m, count(*) n, count(distinct dev) d, max(at) last
           from private.client_errors where at > now() - interval '15 minutes' and status > 0
           group by 1, 2 having count(*) >= 3 loop
    if private.watch_say(p_ch, p_sys, 'screen:' || r.app || ':' || r.target,
         '画面の保存が失敗しています（' || r.target || '・15分で' || r.n || '件・' || r.d || '台）',
         'DB/EF がエラーを返した（' || r.st || coalesce('・' || r.cd, '') || '）' || coalesce('：' || nullif(r.m, ''), ''),
         'なし（画面に赤い印で本人に知らせています。二重に書かないため自動のやり直しはしません）',
         '保存できなかった操作は、画面を読み込み直してからもう一度してください。続く時は本部（オムニ）へ',
         r.n || '@' || r.last) then n_note := n_note + 1; end if;
  end loop;
  for r in select app, count(*) n, count(distinct dev) d, max(at) last
           from private.client_errors where at > now() - interval '10 minutes' and status = 0
           group by 1 having count(distinct dev) >= 3 loop
    if private.watch_say(p_ch, p_sys, 'screen:' || r.app || ':net',
         '画面から DB に届かない状態が複数の端末で起きています（10分で' || r.d || '台・' || r.n || '件）',
         '通信が途中で失敗した（DB 側の不調か、店の回線）',
         'なし（画面に赤い印で本人に知らせています）',
         '数分待って読み込み直してください。10分以上続く時は本部へ', r.d || '@' || r.last) then n_note := n_note + 1; end if;
  end loop;
  delete from private.client_errors where at < now() - interval '14 days';
  exception when others then perform private.watch_say(p_ch, p_sys, 'watch:E', '画面の見張り（E）が止まりました', left(sqlerrm, 150), 'なし', '本部（オムニ）が直します。現場の対応は不要です'); end;

  if to_regclass('public.cli_heartbeat') is not null then   -- main だけ
  begin
  -- F) 取込 GAS（那覇・札幌（高松 HANDYMAN を含む）・問い合わせ）：7〜23時に心拍が3時間止まったら。GAS は15分ごとのトリガーで自動で動き直す
  for r in select * from (values
             ('nha_gas_email', '那覇の予約取込', 'Apps Script「那覇店 予約取込」', (select (value::jsonb->>'last_run')::timestamptz from nha_app_settings where key = 'heartbeat_nha_gas_email')),
             ('spk_gas_email', '札幌・高松 HANDYMAN の予約取込', 'Apps Script「札幌予約メール自動配車」', (select (value::jsonb->>'last_run')::timestamptz from app_settings where key = 'heartbeat_spk_gas_email')),
             ('inquiry_import', '問い合わせの取込', 'Apps Script「HANDYMAN 問い合わせ管理」', (select (value::jsonb->>'last_run')::timestamptz from nha_app_settings where key = 'heartbeat_inquiry_import'))
           ) v(k, label, gas, last) loop
    if _hr between 7 and 23 and r.last is not null and r.last < now() - interval '3 hours' then
      if private.watch_say(p_ch, p_sys, 'gas:' || r.k,
           r.label || 'が止まっています（最後に動いたのは ' || to_char(r.last at time zone 'Asia/Tokyo', 'MM-DD HH24:MI') || '）',
           'GAS が3時間動いていない（トリガーが消えた・Gmail の1日の上限・実行エラーのどれか）',
           'GAS は15分ごとに自動で動き直す仕組み → 3時間動いていない',
           r.gas || '→ トリガーと実行数を確認してください（Gmail の上限なら枠が戻ると自動で再開します）。急ぐ予約はメールを見て手で登録',
           r.last::text || '@' || (now() at time zone 'Asia/Tokyo')::date) then n_note := n_note + 1; end if;
    end if;
  end loop;
  exception when others then perform private.watch_say(p_ch, p_sys, 'watch:F', '取込の見張り（F）が止まりました', left(sqlerrm, 150), 'なし', '本部（オムニ）が直します。現場の対応は不要です'); end;

  begin
  -- G) Mac mini：①Mac そのものが止まった（心拍 cli が10分止まった）②Mac の見張り（ops_beat）が止まった ③Mac が書いた問題（常駐の失敗・オムニの失敗）
  select beat_at into _c from cli_heartbeat where id = 'cli';
  select beat_at into _t from cli_heartbeat where id = 'ops_beat';
  if _c < now() - interval '10 minutes' then
    if private.watch_say(p_ch, p_sys, 'mac:down', 'Mac mini が止まっています（最後の合図 ' || to_char(_c at time zone 'Asia/Tokyo', 'MM-DD HH24:MI') || '）',
         '電源・回線・スリープのどれかで、Mac から合図が来ていない',
         'なし（Mac が止まると自分では立ち上げ直せません。止まっている間はオムニ・在庫ロボ・自動登録ロボも止まります）',
         '本部が Mac mini の電源と回線を確認してください', _c::text) then n_note := n_note + 1; end if;
  elsif _t is not null and _t < now() - interval '20 minutes' then
    if private.watch_say(p_ch, p_sys, 'mac:ops_beat', 'Mac の常駐の見張りが止まっています（最後 ' || to_char(_t at time zone 'Asia/Tokyo', 'MM-DD HH24:MI') || '）',
         'Mac は動いているが、見張り（com.handyman.ops-beat）が動いていない',
         'なし', '本部（オムニ）が直します。現場の対応は不要です', _t::text) then n_note := n_note + 1; end if;
  end if;
  for r in select * from public.ops_watch_events where seen_at > now() - interval '15 minutes' loop
    if private.watch_say(p_ch, p_sys, r.key, r.title, r.why, r.auto, r.todo, r.mark) then n_note := n_note + 1; end if;
  end loop;
  exception when others then perform private.watch_say(p_ch, p_sys, 'watch:G', 'Mac の見張り（G）が止まりました', left(sqlerrm, 150), 'なし', '本部（オムニ）が直します。現場の対応は不要です'); end;
  end if;

  return jsonb_build_object('notified', n_note);
end $$;
revoke all on function private.ops_watch(text, text) from public, anon, authenticated;

select cron.schedule('ops-watch', '4-59/5 * * * *', $q$select private.ops_watch('C07B5G3PV7C', '本部')$q$);
-- main だけ：取込の止まりは F に移したので、旧 import_stall_monitor は記録だけにする（二重に出さない・戻すなら (true,false)）
do $$ begin
  if exists (select 1 from cron.job where jobname = 'import-stall-monitor') then
    perform cron.alter_job((select jobid from cron.job where jobname = 'import-stall-monitor'), command := 'select import_stall_monitor(false,false); -- 2026-11-15 第3段の F に移した（戻すなら true,false）');
  end if;
end $$;
