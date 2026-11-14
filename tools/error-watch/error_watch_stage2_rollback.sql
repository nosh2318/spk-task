-- 第2段の戻し方（main・BT それぞれ）：送信の見張りを止めて、関数と表を消す（記録だけで業務データなし）
select cron.unschedule('send-watch');
drop function if exists private.send_watch(text, text);
drop function if exists private.watch_say(text, text, text, text, text, text, text, text);
drop table if exists private.watch_notes;
