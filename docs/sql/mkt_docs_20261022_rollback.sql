-- 戻し：mkt_docs_20261022.sql で新設したものだけを消す（既存の表・関数には触れない）
-- 注意：ステップ4（スタッフ操作をダッシュボードへ）以降に戻す場合は、先に mkt_read の結果を保存し、判断キーを集客ツールへ書き戻してから実行する
begin;
drop function if exists public.mkt_system_upsert(jsonb, text);
drop function if exists public.mkt_staff_add_seed(text, text, text, text);
drop function if exists public.mkt_staff_update(text, text, jsonb, int);
drop function if exists public.mkt_read(text[]);
drop table if exists public.mkt_docs;
commit;
