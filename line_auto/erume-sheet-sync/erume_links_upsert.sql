-- エルメ回答（スプレッドシート自動連携）→ {store}_line_links へ upsert する RPC。
-- import_erume_auto.py（OMNIが手動CSVで実行していた取込）と同じ上書きルール：
--   空欄は既存値を保持（coalesce）／LINEユーザーID・名前・回答IDは新しい回答で更新。
-- 那覇は新規/現地の2フォームが同じ表に入るため、回答IDでの上書き拒否はしない（Python版と同じ）。
-- 呼び出し元は EF erume-sheet-sync（service_role）のみ。anon/authenticated には権限なし。
create or replace function public.erume_links_upsert(p_store text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl text;
  n integer;
begin
  if p_store not in ('spk','nha') then raise exception 'bad store %', p_store; end if;
  tbl := p_store || '_line_links';
  execute format($f$
    with src as (
      select * from jsonb_to_recordset($1) as x(
        resv_no text, line_user_id text, line_name text, cust_name text, media text,
        del_date text, del_time text, del_place text, col_date text, col_time text, col_place text,
        answer_id bigint, answered_at timestamptz)
      where coalesce(resv_no,'') <> '' and coalesce(line_user_id,'') <> ''
    ), up as (
      insert into %1$I as t (resv_no,line_user_id,line_name,cust_name,media,del_date,del_time,del_place,
                             col_date,col_time,col_place,answer_id,answered_at,source,updated_at)
      select resv_no,line_user_id,nullif(line_name,''),nullif(cust_name,''),nullif(media,''),
             nullif(del_date,''),nullif(del_time,''),nullif(del_place,''),
             nullif(col_date,''),nullif(col_time,''),nullif(col_place,''),
             answer_id,answered_at,'erume_sheet',now()
      from src
      on conflict (resv_no) do update set
        line_user_id = excluded.line_user_id,
        line_name   = coalesce(excluded.line_name, t.line_name),
        cust_name   = coalesce(excluded.cust_name, t.cust_name),
        media       = coalesce(excluded.media, t.media),
        del_date    = coalesce(excluded.del_date, t.del_date),
        del_time    = coalesce(excluded.del_time, t.del_time),
        del_place   = coalesce(excluded.del_place, t.del_place),
        col_date    = coalesce(excluded.col_date, t.col_date),
        col_time    = coalesce(excluded.col_time, t.col_time),
        col_place   = coalesce(excluded.col_place, t.col_place),
        answer_id   = greatest(excluded.answer_id, t.answer_id),
        answered_at = coalesce(excluded.answered_at, t.answered_at),
        source      = 'erume_sheet',
        updated_at  = now()
      returning 1
    ) select count(*) from up $f$, tbl)
  into n using p_rows;
  return n;
end $$;

revoke all on function public.erume_links_upsert(text, jsonb) from public, anon, authenticated;
grant execute on function public.erume_links_upsert(text, jsonb) to service_role;
