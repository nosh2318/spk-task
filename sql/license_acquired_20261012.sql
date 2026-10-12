-- 免許の取得年月日（免許証左下・普通免許は「他」欄）で「取得6か月以内」を検知する（main DB：札幌 spk・那覇 nha）
-- 2026-10-12 オーナー指示。実行は SQL Editor で1回（再実行しても壊れない）。
-- 影響範囲：license_uploads に列を3つ足すだけ（既存の列・行・書込経路は変更なし）。新しい関数1つ・設定テーブル1つを追加。

-- ① license_uploads に3列追加（既存行は空のまま）
alter table public.license_uploads add column if not exists acquired_by_driver jsonb;      -- 運転者ごとの取得年月日 例 {"1":"2026-05-01","2":"2019-03-10"}
alter table public.license_uploads add column if not exists lic_recent boolean default false; -- どれか1人でも取得6か月以内
alter table public.license_uploads add column if not exists lic_recent_at timestamptz;        -- 初めて検知した日時

-- ①b 新しい3列は、画面から直接（ログインなし・ログインあり共に）書けないようにする。書けるのは下の関数だけ。
--   既存の6列は今までどおり書ける（license.html・ガイド等の既存の書込はそのまま動く）。
revoke insert, update on public.license_uploads from anon, authenticated;
grant insert (reservation_id, store, cnt, drivers, first_at, last_at) on public.license_uploads to anon, authenticated;
grant update (reservation_id, store, cnt, drivers, first_at, last_at) on public.license_uploads to anon, authenticated;

-- ② 通知先の設定（店ごと）。RLS有効・ポリシーなし＝画面からは読めない（下の関数だけが読む）
create table if not exists public.lic_alert_cfg (
  store   text primary key,       -- spk / nha
  webhook text,                    -- （旧・未使用）2026-10-12 から channel ＋ Vault のボットトークンで投稿
  mention text                     -- 各店オペのグループ。例 <!subteam^S0123456789>
);
alter table public.lic_alert_cfg enable row level security;
insert into public.lic_alert_cfg(store) values ('spk'),('nha') on conflict do nothing;

-- ③ 画面から呼ぶ関数
--   本人確認＝その予約のマイページトークン（mypage_token）。予約番号では呼べない（他人の予約に書けない）。予約はトークンから引く。
--   取得日は運転者ごと（1人目・2人目…）に保存し、申告された運転者の分だけ置き換える（他の人の分はそのまま）。
--   ⚠️は「どれか1人でも 取得日 ＞ 予約の貸出日 − 6か月」で判定（基準は今日ではなく貸出日）。打ち間違いを直せばその人の分だけ消え、別の人を追加しても前の人の⚠️は残る。
--   通知は⚠️が立った時の1回だけ（同じ内容の再送では通知しない）。運転者は1〜20人目まで。
drop function if exists public.lic_report_acquired(text,text,text[]);
drop function if exists public.lic_report_acquired(text,text,jsonb);
create or replace function public.lic_report_acquired(p_token text, p_store text, p_drivers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res text; v_name text; v_lend_txt text; v_base date;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_in jsonb := '{}'; v_prev jsonb; v_merged jsonb;
  v_was boolean; v_now boolean; v_recent text; v_at timestamptz;
  k text; v text; v_cfg record; v_txt text; v_tok text;
begin
  if p_store not in ('spk','nha') then return jsonb_build_object('ok',false,'error','store'); end if;
  if p_token is null or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('ok',false,'error','auth');
  end if;
  if p_store = 'spk' then select id, name, lend_date::text into v_res, v_name, v_lend_txt from reservations where mypage_token = p_token::uuid limit 1;
  else select id, name, start_date::text into v_res, v_name, v_lend_txt from nha_reservations where mypage_token = p_token::uuid limit 1; end if;
  if v_res is null then return jsonb_build_object('ok',false,'error','auth'); end if;
  -- 判定の基準日＝予約の貸出日（札幌 lend_date／那覇 start_date）。読めない時だけ今日で判定する
  v_lend_txt := substring(coalesce(v_lend_txt,'') from '^\d{4}[-/]\d{1,2}[-/]\d{1,2}');
  begin v_base := to_date(replace(v_lend_txt,'/','-'),'YYYY-MM-DD'); exception when others then v_base := null; end;
  v_base := coalesce(v_base, v_today);

  -- 申告値の検査：キー＝運転者番号 1〜20、値＝YYYY-MM-DD の実在する日付（1940-01-01〜今日）
  --   または 'foreign'（外国の免許証・国際免許＝取得日の欄がない。判定・通知の対象外、配車表で「要目視確認」）
  if jsonb_typeof(p_drivers) <> 'object' then return jsonb_build_object('ok',false,'error','no_dates'); end if;
  for k, v in select key, value from jsonb_each_text(p_drivers) loop
    if k ~ '^[0-9]{1,2}$' and k::int between 1 and 20 and v = 'foreign' then
      v_in := v_in || jsonb_build_object(k::int::text, v);
    elsif k ~ '^[0-9]{1,2}$' and k::int between 1 and 20 and v ~ '^\d{4}-\d{2}-\d{2}$' then
      begin
        if v::date between date '1940-01-01' and v_today then v_in := v_in || jsonb_build_object(k::int::text, v); end if;
      exception when others then null;  -- 2026-02-31 のような存在しない日付は無視
      end;
    end if;
  end loop;
  if v_in = '{}'::jsonb then return jsonb_build_object('ok',false,'error','no_dates'); end if;

  select coalesce(lic_recent,false), coalesce(acquired_by_driver,'{}'::jsonb), lic_recent_at
    into v_was, v_prev, v_at from license_uploads where reservation_id = v_res;
  v_was := coalesce(v_was,false); v_prev := coalesce(v_prev,'{}'::jsonb);
  v_merged := v_prev || v_in;   -- 申告された運転者の分だけ置き換え・他の人はそのまま

  select string_agg('運転者' || key || '：' || value, '、' order by key::int) into v_recent
    from jsonb_each_text(v_merged)
    where case when value ~ '^\d{4}-\d{2}-\d{2}$' then value::date > v_base - interval '6 months' else false end;   -- 取得日 ＞ 貸出日 − 6か月 なら⚠️（'foreign' は対象外）
  v_now := v_recent is not null;

  insert into license_uploads(reservation_id, store, acquired_by_driver, lic_recent, lic_recent_at, last_at)
  values (v_res, p_store, v_merged, v_now, case when v_now then now() end, now())
  on conflict (reservation_id) do update set
    acquired_by_driver = excluded.acquired_by_driver,
    lic_recent         = excluded.lic_recent,
    lic_recent_at      = case when excluded.lic_recent then coalesce(case when v_was then v_at end, now()) end;

  if v_now and not v_was then
    select * into v_cfg from lic_alert_cfg where store = p_store;
    -- ★2026-10-12 Webhook → Slackボット（chat.postMessage）＋チャンネルID。トークンは Vault（slack_bot_token）
    select decrypted_secret into v_tok from vault.decrypted_secrets where name = 'slack_bot_token' limit 1;
    if coalesce(v_cfg.channel,'') <> '' and coalesce(v_tok,'') <> '' then
      v_txt := case when v_res ilike 'LICTEST%' then '【テスト】' else '' end
            || '⚠️ *免許取得6か月以内の可能性* [' || case p_store when 'spk' then '札幌' else '那覇' end || ']' || chr(10)
            || '予約番号: ' || v_res || ' / ' || coalesce(v_name,'') || ' 様（貸出日 ' || to_char(v_base,'YYYY-MM-DD') || '）' || chr(10)
            || '申告された取得日: ' || v_recent || chr(10)
            || '※お客様の自己申告です。*免許証の画像で取得日を要確認*。取得6か月未満なら貸出不可のため、来店前にご連絡ください。'
            || case when coalesce(v_cfg.mention,'') <> '' then chr(10) || v_cfg.mention else '' end;
      begin  -- 通知の失敗で記録（上の insert）を巻き戻さない
        perform net.http_post(url := 'https://slack.com/api/chat.postMessage',
                              body := jsonb_build_object('channel', v_cfg.channel, 'text', v_txt, 'link_names', true),
                              headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_tok));
      exception when others then raise warning 'lic notify failed: %', sqlerrm;
      end;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'recent', v_now, 'drivers', v_merged);
end $$;

-- 画面で「登録済みの運転者と取得日」を表示・訂正するための読み取り（同じくトークンで本人確認）
create or replace function public.lic_get_acquired(p_token text, p_store text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_res text; v_name text; v_map jsonb;
begin
  if p_store not in ('spk','nha') then return jsonb_build_object('ok',false,'error','store'); end if;
  if p_token is null or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('ok',false,'error','auth');
  end if;
  if p_store = 'spk' then select id, name into v_res, v_name from reservations where mypage_token = p_token::uuid limit 1;
  else select id, name into v_res, v_name from nha_reservations where mypage_token = p_token::uuid limit 1; end if;
  if v_res is null then return jsonb_build_object('ok',false,'error','auth'); end if;

  select acquired_by_driver into v_map from license_uploads where reservation_id = v_res;
  return jsonb_build_object('ok', true, 'drivers', coalesce(v_map,'{}'::jsonb));
end $$;

revoke all on function public.lic_report_acquired(text,text,jsonb) from public;
revoke all on function public.lic_get_acquired(text,text) from public;
grant execute on function public.lic_report_acquired(text,text,jsonb) to anon, authenticated;
grant execute on function public.lic_get_acquired(text,text) to anon, authenticated;

-- ④ 確認
select column_name, data_type from information_schema.columns where table_name='license_uploads' order by ordinal_position;
