-- 戻し：表示RPCを元に戻す（台帳テーブルは残しても害なし。消すなら最後の2行）
do $$ declare r record; begin
  for r in select def from public._fn_backup_20261107 loop execute r.def; end loop;
end $$;
-- drop function if exists public.ota_pay_upsert(text,jsonb);
-- drop table if exists public.ota_pay_method;
