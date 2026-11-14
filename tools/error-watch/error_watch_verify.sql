-- 入れた後の確認（main・BT それぞれ・読むだけ）
select count(*) jobs, count(*) filter (where retry_ok) retry_ok, count(*) filter (where frequent) frequent from private.cron_jobs;
select count(*) migrated from cron.job where command like 'select private.cron_call(%';
select job, attempt, result, to_char(at at time zone 'Asia/Tokyo','HH24:MI') t from private.cron_calls order by at desc limit 20;
select result, count(*) from private.cron_calls where at > now() - interval '1 hour' group by 1;
select status, left(return_message,80) from cron.job_run_details d join cron.job j using (jobid) where j.jobname='cron-watch' order by start_time desc limit 3;
