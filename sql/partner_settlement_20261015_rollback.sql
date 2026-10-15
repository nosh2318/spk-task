-- 戻し（作成した表と関数を外す。既存テーブルは触っていないので戻す対象なし）
-- ※ 本番で請求書を作った後は、表の削除＝記録の消失になる。その場合は先に中身を退避すること。
drop function if exists public.partner_settlement_void(bigint);
drop function if exists public.partner_settlement_confirm(bigint);
drop function if exists public.partner_settlement_create(text,text[],text,text);
drop table if exists public.partner_settlement_items;
drop table if exists public.partner_settlements;
drop function if exists private.partner_settle_owner();
