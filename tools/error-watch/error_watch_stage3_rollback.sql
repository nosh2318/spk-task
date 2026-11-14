-- 第3段の戻し（main・BT それぞれに流す）。第1・2段は残る
select cron.unschedule('ops-watch') where exists (select 1 from cron.job where jobname = 'ops-watch');
do $$ begin
  if exists (select 1 from cron.job where jobname = 'import-stall-monitor') then
    perform cron.alter_job((select jobid from cron.job where jobname = 'import-stall-monitor'), command := 'select import_stall_monitor(true,false);');
  end if;
end $$;
drop function if exists private.ops_watch(text, text);
drop function if exists public.report_client_error(jsonb);   -- 画面は呼べなくなっても動きは変わらない（送るだけ・失敗は無視）
drop table if exists public.ops_watch_events;
drop table if exists private.client_errors;
-- Mac：launchctl bootout gui/$(id -u)/com.handyman.ops-beat && rm ~/Library/LaunchAgents/com.handyman.ops-beat.plist
delete from private.watch_notes where key ~ '^(screen|gas|mac|omni):' or key in ('watch:E', 'watch:F', 'watch:G');
do $$ begin if to_regclass('public.cli_heartbeat') is not null then delete from public.cli_heartbeat where id = 'ops_beat'; end if; end $$;
