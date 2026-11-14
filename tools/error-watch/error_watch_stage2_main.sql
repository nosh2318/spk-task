-- ★2026-11-15 nosh「エラーを拾ってくれ」「全部」：第2段＝送信の失敗（DB の中から出る呼び出し・Slack・メール・LINE）を拾う
--   main・BT 共通。C07B5G3PV7C と 本部 を差し替えて流す（main：C07B5G3PV7C／本部・BT：C0BFD7U097V／高松）。第1段（private.cron_* ）の後に流す
--   決まり：拾う → 送り済みを飛ばしてやり直せるものだけ自動でやり直す → だめな時だけ①原因②自動でやったこと③人がやること を1件（同じ種類は1時間に1回）
--   戻し方：error_watch_stage2_rollback.sql

create table if not exists private.watch_notes (
  key text primary key,            -- 種類（例 http:dns・slack:not_in_channel・mail:bt:dayof）
  last_seen timestamptz,
  notified_at timestamptz,
  retried_at timestamptz,
  retries int not null default 0,
  mark text                         -- 前回知らせた時の件数・最終時刻（増えた時だけまた知らせる）
);
revoke all on private.watch_notes from public, anon, authenticated;

create or replace function private.watch_say(p_ch text, p_sys text, p_key text, p_title text, p_why text, p_auto text, p_todo text, p_mark text default null)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare n record;
begin
  select * into n from private.watch_notes where key = p_key;
  if n.notified_at is not null and n.notified_at > now() - interval '1 hour' then return false; end if;
  if p_mark is not null and n.mark is not distinct from p_mark then return false; end if;  -- 前回から増えていない＝同じ事故なので1件だけ
  perform net.http_post(url := 'https://slack.com/api/chat.postMessage',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || private.slack_bot_token('slack_bot_token')),
    body := jsonb_build_object('channel', p_ch, 'text', public.hdm_msg_txt('🚨', p_sys || '｜システム', p_title, null, '',
      array['①原因：' || p_why, '②自動でやったこと：' || p_auto, '③人がやること：' || p_todo], null, true)),
    timeout_milliseconds := 30000);
  insert into private.watch_notes (key, last_seen, notified_at, mark) values (p_key, now(), now(), p_mark)
    on conflict (key) do update set notified_at = now(), last_seen = now(), mark = p_mark;
  return true;
end $$;

create or replace function private.send_watch(p_ch text, p_sys text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; n_note int := 0; n_retry int := 0; _n int; _job text; _k text; _mark text;
begin
 begin
  begin
  -- A) DB の中から直接出た呼び出し（第1段の cron_calls 以外）の失敗：直近10分で3件以上なら知らせる（やり直しは送り元が分からないのでしない）
  for r in select case when error_msg ~ 'DNS time: [0-9]{4}' then 'dns' when timed_out then 'timeout' when status_code >= 500 then '5xx' else 'other' end kind, count(*) n
           from net._http_response h
           where h.created > now() - interval '10 minutes'
             and (h.timed_out or h.error_msg is not null or h.status_code >= 500)
             and not exists (select 1 from private.cron_calls c where c.request_id = h.id)
           group by 1 having count(*) >= 3 loop
    if private.watch_say(p_ch, p_sys, 'http:' || r.kind, 'DB から出る通知・呼び出しが失敗しています（直近10分 ' || r.n || '件）',
         case r.kind when 'dns' then '呼び出し先の名前が引けない（DNS・一時的な回線の不調）' when 'timeout' then '相手の返事が遅く途中で切れた' when '5xx' then '相手のサーバーがエラーを返した' else '呼び出しの失敗' end,
         'やり直しはしていません（送り元ごとに次の回で送られます）',
         '10分以上続く時は本部へ。Slack の通知やメールが一部届いていない可能性があります') then n_note := n_note + 1; end if;
  end loop;
  exception when others then perform private.watch_say(p_ch, p_sys, 'watch:A', '送信の見張り（A）が止まりました', left(sqlerrm, 150), 'なし', '本部（オムニ）が直します。現場の対応は不要です'); end;

  begin
  -- B) Slack が「送れない」と返した（ok:false）。理由の語（not_in_channel 等）ごとに知らせる
  for r in select coalesce(substring(h.content from '"error"\s*:\s*"([a-z_]+)"'), 'unknown') err, count(*) n
           from net._http_response h
           where h.created > now() - interval '10 minutes' and h.content like '%"ok":false%' and h.content ~ '"error"\s*:\s*"[a-z_]+"'
             and h.headers ? 'x-slack-req-id'  -- Slack の返事だけ（EF の {"ok":false} は見ない）
             and not exists (select 1 from private.cron_calls c where c.request_id = h.id)
             and h.content !~ '"error"\s*:\s*"(already_reacted|message_not_found|thread_not_found)"'
             -- ★11/15 読む権限の不足（users:read 等）は調べもので出る。システムの送信は書く権限（chat:write・files:write）だけなので、それ以外の不足は数えない
             and not (h.content ~ '"error"\s*:\s*"missing_scope"' and h.content !~ '"needed"\s*:\s*"[^"]*(chat:write|files:write)')
           group by 1 loop
    if private.watch_say(p_ch, p_sys, 'slack:' || r.err, 'Slack への通知が送れていません（直近10分 ' || r.n || '件・' || r.err || '）',
         case r.err when 'not_in_channel' then 'ボットが部屋に入っていない' when 'channel_not_found' then '部屋が見つからない（消えた・名前が変わった）'
           when 'invalid_auth' then 'Slack の鍵が無効' when 'ratelimited' then '送りすぎで Slack に止められた' else 'Slack がエラーを返した（' || r.err || '）' end,
         'やり直しはしていません',
         case r.err when 'not_in_channel' then 'その部屋にボットを招待してください（本部）' when 'invalid_auth' then '本部が Slack の鍵を入れ直します' else '本部（オムニ）が調べます。現場の対応は不要です' end) then n_note := n_note + 1; end if;
  end loop;
  exception when others then perform private.watch_say(p_ch, p_sys, 'watch:B', '送信の見張り（B）が止まりました', left(sqlerrm, 150), 'なし', '本部（オムニ）が直します。現場の対応は不要です'); end;

  begin
  -- C) メール（Resend）の失敗
  if to_regclass('public.bt_mail_log') is not null then
    -- BUDDICA：今日（JST）の failed だけ、その種類の送信を1時間おきに2回までやり直す（bt-mail-cron は呼んだ時点の日付で対象を選び直すため、日をまたいだ分はやり直さず知らせるだけ）
    for r in select kind, count(*) n, max(left(error, 80)) e, max(sent_at) last,
                    bool_and((sent_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date) today
             from bt_mail_log where status <> 'sent' and sent_at > now() - interval '20 hours' group by 1 loop
      _k := 'mail:bt:' || r.kind; _job := 'bt-mail-' || r.kind;
      update private.watch_notes set retries = 0 where key = _k and retried_at < now() - interval '20 hours';  -- 前の事故の回数を持ち越さない
      if r.today and exists (select 1 from private.cron_jobs where job = _job)
         and coalesce((select retries from private.watch_notes where key = _k), 0) < 2
         and coalesce((select retried_at from private.watch_notes where key = _k), 'epoch') < now() - interval '1 hour' then
        perform private.cron_call(_job, 2, null);
        insert into private.watch_notes (key, last_seen, retried_at, retries) values (_k, now(), now(), 1)
          on conflict (key) do update set retried_at = now(), retries = private.watch_notes.retries + 1, last_seen = now();
        n_retry := n_retry + 1;
      elsif not r.today or coalesce((select retries from private.watch_notes where key = _k), 0) >= 2 then
        if private.watch_say(p_ch, p_sys, _k, 'お客様へのメールが送れていません：' || private.cron_label(_job) || '（' || r.n || '件）',
             'メール会社（Resend）が受け付けなかった：' || coalesce(r.e, '理由なし'),
             case when r.today then '同じ送信を1時間おきに2回やり直した → まだ失敗' else 'やり直しはしていません（日をまたいだため、今やり直すと別のお客様向けの送信になる）' end,
             'BUDDICA 管理画面で対象のお客様を確認し、必要ならマイページの案内を送ってください', r.n || '@' || r.last) then n_note := n_note + 1; end if;
      end if;
    end loop;
  end if;
  for r in select * from (values ('hdm_notifications', '札幌・那覇 HANDYMAN の案内メール', false), ('keydrop_notifications', 'KEYDROP の案内メール', true), ('hdm_tkm_notifications', '高松 HANDYMAN の案内メール', true)) v(t, label, auto) loop
    if to_regclass('public.' || r.t) is null then continue; end if;
    -- keydrop・高松 HANDYMAN は毎分の送信がエラーの行もやり直す。札幌・那覇 HANDYMAN はエラーが付いた行をやり直さない（送信側が error is null だけ拾う）
    execute format('select count(*), max(created_at)::text from public.%I where not sent and created_at between now() - interval ''1 day'' and now() - interval ''30 minutes''', r.t) into _n, _mark;
    if _n > 0 then
      if private.watch_say(p_ch, p_sys, 'mail:' || r.t, 'お客様へのメールが30分以上送れていません：' || r.label || '（' || _n || '件）',
           'メールの送信が失敗し続けている（送り先・メール会社・送信の仕組みのどれか）',
           case when r.auto then '毎分の送信で自動でやり直しています → 30分たっても送れていない' else '自動のやり直しはありません（エラーが付いた行は送信の対象から外れる仕組み）' end,
           '本部（オムニ）が原因を調べて送り直します。急ぐお客様は電話かマイページで連絡してください', _n || '@' || _mark) then n_note := n_note + 1; end if;
    end if;
  end loop;
  exception when others then perform private.watch_say(p_ch, p_sys, 'watch:C', '送信の見張り（C）が止まりました', left(sqlerrm, 150), 'なし', '本部（オムニ）が直します。現場の対応は不要です'); end;

  begin
  -- D) LINE の送信失敗（skipped・no_userid は正常の見送りなので数えない）
  for r in select * from (values ('nha_line_sends', '那覇'), ('spk_line_sends', '札幌'), ('bt_line_sends', '高松')) v(t, label) loop
    if to_regclass('public.' || r.t) is null then continue; end if;
    execute format('select count(*) from public.%I where sent_at > now() - interval ''1 hour'' and status in (''failed'', ''error'')', r.t) into _n;
    if _n > 0 then
      if private.watch_say(p_ch, p_sys, 'line:' || r.t, 'LINE の送信が失敗しました（' || r.label || '・直近1時間 ' || _n || '件）',
           'LINE 側が受け付けなかった', 'やり直しはしていません',
           '本部（オムニ）が原因を調べます。急ぐお客様にはメールかマイページで連絡してください', _n::text) then n_note := n_note + 1; end if;
    end if;
  end loop;
  exception when others then perform private.watch_say(p_ch, p_sys, 'watch:D', '送信の見張り（D）が止まりました', left(sqlerrm, 150), 'なし', '本部（オムニ）が直します。現場の対応は不要です'); end;
 exception when others then
  begin
    perform net.http_post(url := 'https://slack.com/api/chat.postMessage',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || private.slack_bot_token('slack_bot_token')),
      body := jsonb_build_object('channel', p_ch, 'text', '🚨【' || p_sys || '｜システム】送信の見張りが止まりました' || E'\n①原因：' || left(sqlerrm, 150) || E'\n②自動でやったこと：なし（5分後にもう一度動きます）\n③人がやること：本部（オムニ）が直します。現場の対応は不要です'),
      timeout_milliseconds := 30000);
  exception when others then null; end;
  return jsonb_build_object('error', sqlerrm);
 end;
  return jsonb_build_object('notified', n_note, 'retried', n_retry);
end $$;
revoke all on function private.watch_say(text, text, text, text, text, text, text, text), private.send_watch(text, text) from public, anon, authenticated;

select cron.schedule('send-watch', '2-59/5 * * * *', $q$select private.send_watch('C07B5G3PV7C', '本部')$q$);
