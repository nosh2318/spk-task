-- 第1段の戻し方（main・BT それぞれで流す）：cron の文を元に戻し、見張りを止める。表と関数は記録だけなので消してよい
select cron.alter_job(j.jobid, command := c.orig_command) from cron.job j join private.cron_jobs c on c.job = j.jobname;
select cron.unschedule('cron-watch');
drop function if exists private.cron_watch(text, text);
drop function if exists private.cron_call(text, int, bigint);
drop function if exists private.cron_label(text);
drop table if exists private.cron_calls;
drop table if exists private.cron_jobs;
