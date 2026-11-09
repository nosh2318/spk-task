-- 2026-11-09 nosh「押されてない＝スタッフが動いてない可能性として通知は必須」
-- 札幌の「出発／回収に向かう」押し忘れを Slack（スタッフだけ）に知らせる。那覇の見張りと同じ関数を store:"spk" で呼ぶ。
-- 秘密の値を書かないよう、那覇のジョブの中身をコピーして本文だけ差し替える。
select cron.schedule('spk-delivery-watch', '*/5 * * * *',
  replace((select command from cron.job where jobname = 'nha-delivery-watch'),
          '{"action":"watch"}', '{"action":"watch","store":"spk"}'));
-- 確認：store が入っていること
select jobname, schedule, command like '%"store":"spk"%' as ok from cron.job where jobname = 'spk-delivery-watch';
