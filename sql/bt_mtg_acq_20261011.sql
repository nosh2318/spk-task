-- 2026-10-11 BT MTG: 受付(created_at JST)期間のブランド別 獲得件数・流通額。bt_mtg_h2 の f(流通) と同じ定義(キャンセル/テスト除外・rev式)。
-- rollback: drop function public.bt_mtg_acq(date,date);
create or replace function public.bt_mtg_acq(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(br, jsonb_build_object('c',c,'r',rr,'hp_c',hc,'hp_r',hr)),'{}'::jsonb)
  from (
    select coalesce(nullif(res.brand,''),'BUDDICA') br, count(*) c,
      sum(case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
        then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
        else coalesce(res.price,0) end) rr,
      count(*) filter (where nullif(res.ota,'') is null and coalesce(res.source,'') in ('site','')) hc,
      coalesce(sum(case when coalesce(res.base_price,0)>0 or coalesce(res.option_price,0)>0
        then coalesce(res.base_price,0)+coalesce(res.option_price,0)-coalesce(res.discount,0)
        else coalesce(res.price,0) end) filter (where nullif(res.ota,'') is null and coalesce(res.source,'') in ('site','')),0) hr
    from bt_reservations res
    where (res.created_at at time zone 'Asia/Tokyo')::date between p_from and p_to
      and coalesce(res.status,'') not in ('キャンセル','cancelled','canceled')
      and res.id !~ '^(ZZ|DEMO|KD-DEMO|TEST|DEMOMYPAGE)'
      and coalesce(res.name,'') !~ '(テスト|デモ|test|ZZPTEST|大下|おおした|オオシタ)'
      and coalesce(res.name,'') <> ''
    group by 1
  ) t
$$;
grant execute on function public.bt_mtg_acq(date,date) to anon, authenticated;
