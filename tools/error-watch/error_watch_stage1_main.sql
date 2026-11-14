-- ★2026-11-14 nosh「エラーを拾ってくれ」「全部」：第1段＝cron→EF の失敗を拾う・やり直す・知らせる（main・BT 共通。C07B5G3PV7C と 本部 を差し替えて流す）
--   main：C07B5G3PV7C=C07B5G3PV7C（HANDYMAN システム）・本部=本部   ／ BT：C07B5G3PV7C=C0BFD7U097V（BUDDICA システム）・本部=高松
--   戻し方：error_watch_stage1_rollback.sql
--   ※ CLAUDE.md §3.6（パトロール新設禁止）はオーナー本人の依頼で例外。データは直さない。やるのは「同じ呼び出しをもう一度」だけ。

create table if not exists private.cron_jobs (
  job text primary key,            -- cron.job.jobname
  orig_command text not null,      -- 元の文（秘密を含む・private）
  retry_ok boolean not null default false,  -- 送り済みを各 EF が log_key で飛ばすと確かめたものだけ true
  frequent boolean not null default false,  -- 1時間に何回も動く仕事（分の欄が * か */n か並び）。これだけ「続けて3回失敗」で知らせる
  migrated_at timestamptz not null default now()
);
create table if not exists private.cron_calls (
  id bigserial primary key,
  job text not null,
  attempt int not null default 1,
  parent_id bigint,                -- やり直しの元
  request_id bigint,
  at timestamptz not null default now(),
  result text,                     -- null=まだ / ok / timeout / dns / http_<code> / body_error / lost / call_error
  detail text,                     -- 短い理由（本文の先頭100字まで・個人情報は EF が返さない前提）
  checked_at timestamptz,
  retried boolean not null default false,
  notified_at timestamptz
);
create index if not exists cron_calls_open on private.cron_calls (at) where result is null;
create index if not exists cron_calls_job on private.cron_calls (job, at desc);
revoke all on private.cron_jobs, private.cron_calls from public, anon, authenticated;

-- 呼び出し口：元の文の最後の ")" の前に timeout 60秒を足して実行し、request_id を記録する
create or replace function private.cron_call(p_job text, p_attempt int default 1, p_parent bigint default null)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare c text; rid bigint; cid bigint;
begin
  select orig_command into c from private.cron_jobs where job = p_job;
  if c is null then raise exception 'cron_call: unknown job %', p_job; end if;
  if c !~* 'timeout_milliseconds' then c := regexp_replace(c, '\)\s*;?\s*$', ', timeout_milliseconds := 60000)'); end if;
  insert into private.cron_calls (job, attempt, parent_id) values (p_job, p_attempt, p_parent) returning id into cid;
  begin
    execute c into rid;
    update private.cron_calls set request_id = rid where id = cid;
  exception when others then
    update private.cron_calls set result = 'call_error', detail = left(sqlerrm, 100), checked_at = now() where id = cid;
  end;
  return cid;
end $$;

-- 仕事の名前を人が読める言葉に（知らない名前はそのまま）
create or replace function private.cron_label(p_job text) returns text language sql immutable as $$
  select case p_job
    when 'bt-mail-dayof' then '前日20時の案内メール（BUDDICA・傷チェックの案内）'
    when 'bt-mail-remind' then '前日18時のリマインドメール（BUDDICA）'
    when 'bt-mail-remind2' then '2日前のリマインドメール（BUDDICA）'
    when 'bt-mail-remind4' then '4日前のリマインドメール（BUDDICA）'
    when 'bt-mail-return' then '返却日の朝のメール（BUDDICA）'
    when 'bt-mail-thanks' then 'ご利用後のお礼メール（BUDDICA）'
    when 'bt-mail-guide' then '予約直後のご利用ガイドメール（BUDDICA）'
    when 'hdm-tkm-send-mail' then '高松 HANDYMAN の案内メール送信'
    when 'hdm-send-mail' then '札幌・那覇 HANDYMAN の案内メール送信'
    when 'keydrop-send-mail' then 'KEYDROP の案内メール送信'
    when 'license-reminder-nha' then '免許証アップのお願いメール（那覇）'
    when 'license-reminder-spk' then '免許証アップのお願いメール（札幌）'
    when 'line-thanks-nha' then 'ご利用後のお礼（那覇）'
    when 'line-thanks-spk' then 'ご利用後のお礼（札幌）'
    else p_job end || '〔' || p_job || '〕'
$$;

-- 見張り（5分ごと）：結果を付ける → やり直す → だめなら知らせる
--   レビュー条件：①同じ仕事は1回の見張りで1件だけ・1時間に1回 ②数分ごとの仕事だけ「続けて3回」、それ以外は1回の失敗（やり直し後）で知らせる
--   ④cron が起動できなかった（job_run_details failed）は文を分け、retry_ok ならやり直す ⑤見張り自身が落ちたら素の1行を出す
create or replace function private.cron_watch(p_ch text, p_sys text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; n_ok int := 0; n_bad int := 0; n_retry int := 0; n_note int := 0; _tok text;
  _why text; _auto text; _todo text; _msg text; _chain text; _okv text;
begin
 begin
  _tok := private.slack_bot_token('slack_bot_token');
  -- 1) 結果を付ける（net._http_response は6時間で消える。60秒＋余裕2分で返事が無ければ待つ、30分で無ければ lost）
  for r in select c.id, c.at, h.status_code, h.timed_out, h.error_msg, h.content
           from private.cron_calls c left join net._http_response h on h.id = c.request_id
           where c.result is null and c.request_id is not null and c.at < now() - interval '2 minutes' loop
    if r.status_code is null and r.timed_out is null and r.error_msg is null then
      if r.at < now() - interval '30 minutes' then update private.cron_calls set result = 'lost', checked_at = now() where id = r.id; n_bad := n_bad + 1; end if;
      continue;
    end if;
    _okv := null;
    begin if r.content ~ '^\s*\{' then _okv := coalesce(r.content::jsonb ->> 'ok', case when (r.content::jsonb) ? 'error' then 'error' end); end if; exception when others then _okv := null; end;
    if coalesce(r.timed_out, false) then
      update private.cron_calls set result = case when r.error_msg ~ 'DNS time: [0-9]{4}' then 'dns' else 'timeout' end, detail = left(r.error_msg, 100), checked_at = now() where id = r.id; n_bad := n_bad + 1;
    elsif r.error_msg is not null then
      update private.cron_calls set result = 'call_error', detail = left(r.error_msg, 100), checked_at = now() where id = r.id; n_bad := n_bad + 1;
    elsif r.status_code >= 400 then
      update private.cron_calls set result = 'http_' || r.status_code, detail = left(r.content, 100), checked_at = now() where id = r.id; n_bad := n_bad + 1;
    elsif _okv in ('false', 'error') then  -- 先頭の階層の ok:false／error だけ（results[] の中は見ない）
      update private.cron_calls set result = 'body_error', detail = left(r.content, 100), checked_at = now() where id = r.id; n_bad := n_bad + 1;
    else
      update private.cron_calls set result = 'ok', checked_at = now() where id = r.id; n_ok := n_ok + 1;
    end if;
  end loop;

  -- 2) やり直す（retry_ok の仕事だけ・失敗が分かったらすぐ2回目、その失敗から3分後に3回目。20:00 の送信なら 20:05・20:15 ごろ＝20:30 の点検より前に終わる）
  for r in select c.* from private.cron_calls c join private.cron_jobs j on j.job = c.job
           where j.retry_ok and c.result is not null and c.result <> 'ok' and not c.retried and c.attempt < 3
             and c.checked_at <= now() - case when c.attempt = 1 then interval '0 minutes' else interval '3 minutes' end loop
    update private.cron_calls set retried = true where id = r.id;
    perform private.cron_call(r.job, r.attempt + 1, r.id); n_retry := n_retry + 1;
  end loop;

  -- 3) 知らせる（仕事ごとに1件・1時間に1回まで）
  for r in select distinct on (c.job) c.*, j.retry_ok, j.frequent from private.cron_calls c join private.cron_jobs j on j.job = c.job
           where c.result is not null and c.result not in ('ok', 'not_started') and c.notified_at is null
             and ((j.retry_ok and c.attempt >= 3)
               or (not j.retry_ok and not j.frequent)
               or (not j.retry_ok and j.frequent and 3 <= (select count(*) from (select result from private.cron_calls x where x.job = c.job and x.result is not null and x.result <> 'not_started' and x.at <= c.at order by x.at desc limit 3) t where t.result <> 'ok')))
             and not exists (select 1 from private.cron_calls y where y.job = c.job and y.notified_at > now() - interval '1 hour')
           order by c.job, c.at desc loop
    _why := case r.result when 'dns' then '呼び出し先の名前が引けず届かなかった（DNS・一時的な回線の不調）'
      when 'timeout' then '60秒で返事が無く途中で切れた（処理が重い・止まっている）'
      when 'lost' then '返事の記録が無い（呼び出しが届いたか不明）'
      when 'call_error' then '呼び出しを作れなかった：' || coalesce(r.detail, '')
      when 'body_error' then '仕組みがエラーを返した：' || coalesce(r.detail, '')
      else 'エラーの返事（' || r.result || '）：' || coalesce(r.detail, '') end;
    select string_agg(to_char(x.at at time zone 'Asia/Tokyo', 'HH24:MI') || ' ' || coalesce(x.result, '待ち'), '・' order by x.at) into _chain
      from private.cron_calls x where x.job = r.job and x.at > now() - interval '1 hour';
    _auto := case when r.retry_ok then '同じ呼び出しを3回（' || _chain || '）→ すべて失敗（送り済みの分は飛ばしています）'
      else 'やり直しはしていません（次の自動実行に任せる仕事）。直近：' || _chain end;
    _todo := case when r.job ~ '^bt-mail-' then '案内メールが届いていないお客様がいる可能性があります。BUDDICA のマイページ／管理画面で対象のお客様を確認し、必要なら案内を送ってください'
      when r.result in ('dns', 'lost', 'timeout') and r.frequent then '次の自動実行で直ることが多いです。1時間たっても続く時は本部へ'
      else '本部（オムニ）が原因を調べます。現場の対応は不要です' end;
    _msg := public.hdm_msg_txt('🚨', p_sys || '｜システム', '自動処理が失敗しました：' || private.cron_label(r.job), null, '',
      array['①原因：' || _why, '②自動でやったこと：' || _auto, '③人がやること：' || _todo], null, true);
    perform net.http_post(url := 'https://slack.com/api/chat.postMessage',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _tok),
      body := jsonb_build_object('channel', p_ch, 'text', _msg));
    update private.cron_calls set notified_at = now() where job = r.job and result is not null and result <> 'ok' and notified_at is null;
    n_note := n_note + 1;
  end loop;

  -- 4) cron が起動できなかった／cron の文が落ちた（cron.job_run_details failed）。仕事ごとに1件
  for r in select distinct on (j.jobname) j.jobname, left(d.return_message, 120) msg, d.start_time, c.retry_ok
           from cron.job_run_details d join cron.job j on j.jobid = d.jobid left join private.cron_jobs c on c.job = j.jobname
           where d.status = 'failed' and d.start_time > now() - interval '6 minutes' and j.jobname <> 'cron-watch'
             and not exists (select 1 from private.cron_calls y where y.job = j.jobname and y.result = 'not_started' and y.at > now() - interval '30 minutes')
           order by j.jobname, d.start_time desc loop
    insert into private.cron_calls (job, result, detail, checked_at, retried) values (r.jobname, 'not_started', r.msg, now(), true);
    if coalesce(r.retry_ok, false) then
      perform private.cron_call(r.jobname, 2, null); n_retry := n_retry + 1;  -- やり直し（その後は 1)〜3) が見る）
    elsif not exists (select 1 from private.cron_calls y where y.job = r.jobname and y.notified_at > now() - interval '1 hour') then
      _msg := public.hdm_msg_txt('🚨', p_sys || '｜システム', '自動処理が動きませんでした：' || private.cron_label(r.jobname), null, '',
        array['①原因：' || case when r.msg ~* 'startup timeout|connection failed' then '予定の時刻に処理を始められなかった（DB の混雑・接続の不調）' else 'DB の処理がエラーで止まった：' || coalesce(r.msg, '') end,
              '②自動でやったこと：やり直しはしていません（次の自動実行に任せる仕事）',
              '③人がやること：' || case when r.msg ~* 'startup timeout|connection failed' then '次の自動実行で直ることが多いです。続く時は本部へ' else '本部（オムニ）が原因を調べます。現場の対応は不要です' end], null, true);
      perform net.http_post(url := 'https://slack.com/api/chat.postMessage',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _tok),
        body := jsonb_build_object('channel', p_ch, 'text', _msg));
      update private.cron_calls set notified_at = now() where job = r.jobname and result = 'not_started' and notified_at is null;
      n_note := n_note + 1;
    end if;
  end loop;

  delete from private.cron_calls where at < now() - interval '14 days';
 exception when others then
  -- ⑤見張り自身が落ちた：素の1行だけ出す（hdm_msg_txt も使わない）
  begin
    perform net.http_post(url := 'https://slack.com/api/chat.postMessage',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(_tok, private.slack_bot_token('slack_bot_token'))),
      body := jsonb_build_object('channel', p_ch, 'text', '🚨【' || p_sys || '｜システム】自動処理の見張りが止まりました' || E'\n①原因：' || left(sqlerrm, 150) || E'\n②自動でやったこと：なし（次の5分後にもう一度動きます）\n③人がやること：本部（オムニ）が直します。現場の対応は不要です'));
  exception when others then null; end;
  return jsonb_build_object('error', sqlerrm);
 end;
  return jsonb_build_object('ok', n_ok, 'bad', n_bad, 'retried', n_retry, 'notified', n_note);
end $$;
revoke all on function private.cron_call(text, int, bigint), private.cron_watch(text, text) from public, anon, authenticated;

-- 移行：functions/v1 を呼ぶ cron（main 31・BT 15）の元の文を控え、呼び出し口へ差し替える
insert into private.cron_jobs (job, orig_command, retry_ok, frequent)
select jobname, command, jobname in ('bt-mail-dayof', 'bt-mail-remind', 'bt-mail-remind2', 'bt-mail-remind4', 'bt-mail-return', 'bt-mail-thanks'),
       split_part(schedule, ' ', 1) ~ '[*,]'
from cron.job where command ~* '^\s*select\s+net\.http_post\s*\(' and command ilike '%functions/v1%'
on conflict (job) do nothing;
select cron.alter_job(j.jobid, command := format('select private.cron_call(%L)', j.jobname))
from cron.job j join private.cron_jobs c on c.job = j.jobname where j.command = c.orig_command;

select cron.schedule('cron-watch', '*/5 * * * *', $q$select private.cron_watch('C07B5G3PV7C', '本部')$q$);
