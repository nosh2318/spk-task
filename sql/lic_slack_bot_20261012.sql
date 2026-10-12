-- 2026-10-12 免許「取得半年以内」通知を Webhook → Slackボット（chat.postMessage）＋チャンネルID に変更（main：札幌・那覇）
-- トークンは関数に直書きせず Vault（name='slack_bot_token'）から読む。spk_hp_cancel_notify の直書きも Vault 参照へ。
-- 影響範囲：lic_alert_cfg に channel 列追加・lic_report_acquired の通知部分・spk_hp_cancel_notify の Authorization の値の出どころのみ。
alter table public.lic_alert_cfg add column if not exists channel text;   -- Slack チャンネルID
update public.lic_alert_cfg set channel = case store when 'spk' then 'C0AS5K1JZNJ' when 'nha' then 'C06L91W6T08' end where store in ('spk','nha');
-- ※ Vault への登録（slack_bot_token）は既存関数に入っていた値を SQL 内で移す（値はファイルに書かない）
