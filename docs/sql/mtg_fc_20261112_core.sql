/* 2026-11-12 📈着地見込みタブ「指標を決めて追い続け、精度を上げる仕組み」（3店共通・main と BT の両方に同じものを作る）。
   mtg_fc(店, 基準日)＝読み取り専用。開始月（札幌・那覇 2026-04／高松 2026-08）〜今月の各月について、同じ日付（基準日の「日」）時点の
     受付済み[件数 an, 売上 a]・そのうち後でキャンセル[cn, c]・後から入った[pn, p]・最終[fn, f]・平均リードタイム lt を、全体／クラス／経路(OTA・公式・その他)／国内・海外 で返す。
     売上＝返却月計上（*_mtg_h2 と同じ）。受付日＝created_at(JST)。キャンセル日＝キャンセル台帳(cancel)の日、無ければ updated_at（台帳は 2026-09-17 から。それより前の月は更新日で代用＝不正確なので、キャンセル率の前提 chat は台帳がそろった月（同じ日付が 9/18 以降）だけで計算し、無ければ全月）。
     予測式（fc）＝その月より前の月だけを使って計算（＝過去月は答え合わせができる）。methods＝式ごとの過去月の誤差。best＝誤差が最小の式。
   mtg_fc_log＝毎日の予測の記録（その日に見えていた受付済み・前提・全式の予測）。mtg_fc_snap が pg_cron で毎日 23:55 JST に書く。月末締め後の振り返りに使う。 */
create table if not exists public.mtg_fc_log (store text not null, ym text not null, snap_date date not null, d jsonb not null, created_at timestamptz not null default now(), primary key (store, ym, snap_date));
alter table public.mtg_fc_log enable row level security;

create or replace function public.mtg_fc(p_store text, p_td date default null)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
with t as (select coalesce(p_td,(now() at time zone 'Asia/Tokyo')::date) td, (case p_store when 'bt' then date '2026-08-01' else date '2026-04-01' end) s0, date '2026-09-18' s1),
pm as (select to_char(g,'YYYY-MM') ym, g::date ms, (g+interval '1 month'-interval '1 day')::date me,
    least((g+interval '1 month'-interval '1 day')::date, g::date+(extract(day from t.td)::int-1)) dm,
    to_char(g-interval '3 month','YYYY-MM') ym3, to_char(g-interval '12 month','YYYY-MM') ymy, t.s0, t.s1,
    (g::date=date_trunc('month',t.td)::date) cur
  from t, generate_series(t.s0::timestamp, date_trunc('month',t.td)::timestamp, interval '1 month') g),
r as (select * from mtg_fc_res(p_store)),
cp as (select ym, cls, n from mtg_fc_cap(p_store)),
x as (select pm.ym, s.dim, s.key,
    count(*) filter (where r.cd<=pm.dm and (r.xd is null or r.xd>pm.dm)) an,
    coalesce(sum(r.rev) filter (where r.cd<=pm.dm and (r.xd is null or r.xd>pm.dm)),0) a,
    count(*) filter (where r.cd<=pm.dm and r.xd>pm.dm) cn,
    coalesce(sum(r.rev) filter (where r.cd<=pm.dm and r.xd>pm.dm),0) c,
    count(*) filter (where r.cd>pm.dm and r.xd is null) pn,
    coalesce(sum(r.rev) filter (where r.cd>pm.dm and r.xd is null),0) p,
    count(*) filter (where r.xd is null) fn,
    coalesce(sum(r.rev) filter (where r.xd is null),0) f,
    round(avg(r.sd-r.cd) filter (where r.xd is null and r.cd>=pm.s0),1) lt
  from pm join r on r.ed between pm.ms and pm.me
  cross join lateral (values ('all','all'),('cls',r.cls),('ch',r.ch),('io',r.io)) s(dim,key) group by 1,2,3),
tr as (select pm.ym, s.dim, s.key, count(*) filter (where r.cd>pm.dm-28) ta, count(*) filter (where r.cd<=pm.dm-28) tb
  from pm join r on r.cd>pm.dm-56 and r.cd<=pm.dm and (r.xd is null or r.xd>pm.dm)
  cross join lateral (values ('all','all'),('cls',r.cls),('ch',r.ch),('io',r.io)) s(dim,key) group by 1,2,3),
bd as (select pm.ym, s.dim, s.key,
    coalesce(sum(greatest(0,least(r.ed,pm.me)-greatest(r.sd,pm.dm+1)+1)) filter (where r.cd<=pm.dm and (r.xd is null or r.xd>pm.dm)),0) br,
    coalesce(sum(least(r.ed,pm.me)-greatest(r.sd,pm.ms)+1) filter (where r.cd<=pm.dm and (r.xd is null or r.xd>pm.dm)),0) ba,
    coalesce(sum(least(r.ed,pm.me)-greatest(r.sd,pm.ms)+1) filter (where r.xd is null),0) bf
  from pm join r on r.sd<=pm.me and r.ed>=pm.ms
  cross join lateral (values ('all','all'),('cls',r.cls),('ch',r.ch),('io',r.io)) s(dim,key) group by 1,2,3),
cc as (select ym, 'all' dim, 'all' key, sum(n)::int n from cp group by 1 union all select ym, 'cls', cls, n from cp),
ks as (select dim, key from x union select dim, key from cc),
b as (select pm.ym, pm.cur, pm.ym3, pm.ymy, ks.dim, ks.key, (pm.me-pm.dm) rest, (pm.me-pm.ms+1) days,
    coalesce(x.an,0) an, coalesce(x.a,0)::numeric a, coalesce(x.cn,0) cn, coalesce(x.c,0)::numeric c, coalesce(x.pn,0) pn, coalesce(x.p,0)::numeric p, coalesce(x.fn,0) fn, coalesce(x.f,0)::numeric f, x.lt,
    coalesce(cc.n,0) n, (coalesce(cc.n,0)*(pm.me-pm.dm))::numeric cap, (ca.n*(pm.me-pm.dm))::numeric scap,
    greatest(0, coalesce(cc.n,0)*(pm.me-pm.dm)-coalesce(bd.br,0))::numeric free,
    coalesce(bd.br,0) br, coalesce(bd.ba,0) ba, coalesce(bd.bf,0) bf,
    coalesce(tr.ta,0) ta, coalesce(tr.tb,0) tb, (pm.dm-56>=pm.s0) tv, (pm.dm>=pm.s1) ck
  from pm cross join ks
  left join x on x.ym=pm.ym and x.dim=ks.dim and x.key=ks.key
  left join tr on tr.ym=pm.ym and tr.dim=ks.dim and tr.key=ks.key
  left join bd on bd.ym=pm.ym and bd.dim=ks.dim and bd.key=ks.key
  left join cc on cc.ym=pm.ym and cc.dim=ks.dim and cc.key=ks.key
  left join cc ca on ca.ym=pm.ym and ca.dim='all'),
/* その月より前の月の実績（hh）＝予測の前提。scap＝店全体の（台数×残り日数） */
hh as (select m.ym, h.dim, h.key, count(*) hn, sum(h.a) ha, sum(h.c) hc, sum(h.a) filter (where h.ck) hca, sum(h.c) filter (where h.ck) hcc, sum(h.pn)::numeric hpn, sum(h.p) hp, sum(h.f) hf, sum(h.cap) hcap, sum(h.scap) hscap, sum(h.free) hfree,
    sum(h.a) filter (where h.ym>=m.ym3) ha3, sum(h.f) filter (where h.ym>=m.ym3) hf3,
    sum(h.a) filter (where h.ym=m.ymy) hay, sum(h.f) filter (where h.ym=m.ymy) hfy
  from pm m join b h on h.ym<m.ym group by 1,2,3),
s as (select b.ym, b.cur, b.a, b.f, b.cap, b.free, b.rest, coalesce(hh.hn,0) hn,
    coalesce(hh.hcc/nullif(hh.hca,0), hh.hc/nullif(hh.ha,0),0) chat, coalesce(hh.hpn/nullif(hh.hcap,0),0) rate, hh.hp/nullif(hh.hpn,0) u,
    coalesce(hh.hp/nullif(hh.hcap,0),0) rr, coalesce(hh.hp/nullif(hh.hfree,0),0) rf,
    hh.hf/nullif(hh.ha,0) sh, hh.hf3/nullif(hh.ha3,0) sh3, hh.hfy/nullif(hh.hay,0) shy,
    (case when b.tv and b.tb>=20 then least(1.3,greatest(0.7,b.ta::numeric/b.tb)) else 1 end)::numeric tm
  from b left join hh on hh.ym=b.ym and hh.dim='all' and hh.key='all' where b.dim='all'),
/* 切り口ごとの「後から入る」見込み：nhat 件数・phat 売上（店全体の台数×残り日数あたり）。pcls＝クラス自身の率（実績が少なければ店の率）。ptr＝経路・国内海外は受付トレンドを掛ける */
sg as (select b.ym, b.dim, b.key,
    coalesce(hh.hpn/nullif(hs.hscap,0),0)*b.scap nhat,
    coalesce(hh.hp/nullif(hs.hscap,0),0)*b.scap phat,
    (case when b.dim='cls' then (case when hh.hcap>=30 and hh.hpn>=5 then hh.hp/hh.hcap else coalesce(hs.hp/nullif(hs.hscap,0),0) end)*b.cap end) pcls,
    (case when b.dim in ('ch','io') then coalesce(hh.hp/nullif(hs.hscap,0),0)*b.scap*(case when b.tv and b.tb>=10 then least(1.3,greatest(0.7,b.ta::numeric/b.tb)) else 1 end) end) ptr
  from b left join hh on hh.ym=b.ym and hh.dim=b.dim and hh.key=b.key
  left join hh hs on hs.ym=b.ym and hs.dim='all' and hs.key='all' where b.dim<>'all'),
fc as (select s.ym, s.cur, s.f,
    s.a*s.sh v_share, s.a*s.sh3 v_share3, s.a*s.shy v_yoy,
    s.a*(1-s.chat)+s.rr*s.cap v_add,
    s.a*(1-s.chat)+s.rr*s.cap*s.tm v_addtr,
    s.a*(1-s.chat)+s.rf*s.free v_free,
    s.a*(1-s.chat)+coalesce((select sum(sg.pcls) from sg where sg.ym=s.ym and sg.dim='cls'),0) v_cls,
    s.a*(1-s.chat)+coalesce((select sum(sg.ptr) from sg where sg.ym=s.ym and sg.dim='ch'),0) v_ch,
    s.a*(1-s.chat)+coalesce((select sum(sg.ptr) from sg where sg.ym=s.ym and sg.dim='io'),0) v_io
  from s where s.hn>=1),
fl as (select fc.ym, fc.cur, fc.f, m.k, m.o, m.v from fc cross join lateral (values
    ('share',1,v_share),('add',2,v_add),('blend',3,(v_share+v_add)/2),('addtr',4,v_addtr),('free',5,v_free),('cls',6,v_cls),('ch',7,v_ch),('io',8,v_io),('share3',9,v_share3),('yoy',10,v_yoy)) m(k,o,v) where m.v is not null),
sc as (select k, min(o) o, count(*) n, avg(abs(v/f-1)) mae, avg(v/f-1) bias, max(abs(v/f-1)) mx from fl where not cur and f>0 group by k),
best as (select k from sc where n=(select max(n) from sc) order by mae, o limit 1)
select jsonb_build_object(
  'store', p_store, 'today', (select to_char(td,'YYYY-MM-DD') from t), 'd', (select extract(day from td)::int from t), 'start', (select to_char(s0,'YYYY-MM') from t),
  'best', (select k from best),
  'methods', coalesce((select jsonb_agg(jsonb_build_object('k',k,'n',n,'mae',round(mae,4),'bias',round(bias,4),'mx',round(mx,4)) order by o) from sc),'[]'::jsonb),
  'months', coalesce((select jsonb_object_agg(b.ym, jsonb_build_object(
      'cur', b.cur, 'rest', b.rest, 'days', b.days, 'n', b.n, 'cap', b.cap, 'free', b.free, 'occ', jsonb_build_array(b.ba, b.bf, b.n*b.days, b.br),
      'ext', coalesce((select e.amt from mtg_fc_ext(p_store) e where e.ym=b.ym),0), 'tr', jsonb_build_array(b.ta, b.tb, b.tv),
      'all', jsonb_build_array(b.an, round(b.a), b.cn, round(b.c), b.pn, round(b.p), b.fn, round(b.f), b.lt),
      'as', (select jsonb_build_object('hn',s.hn,'chat',round(s.chat,4),'rate',round(s.rate,5),'u',round(s.u),'rr',round(s.rr,1),'tm',round(s.tm,3),'sh',round(1/nullif(s.sh,0),4),'nhat',round(s.rate*s.cap,2)) from s where s.ym=b.ym),
      'seg', (select jsonb_object_agg(z.dim, z.o) from (select q.dim, jsonb_object_agg(q.key, jsonb_build_array(q.an, round(q.a), q.cn, round(q.c), q.pn, round(q.p), q.fn, round(q.f), q.n, round(coalesce(g.nhat,0),2), round(coalesce(g.phat,0)), q.ta, q.tb, q.ba, q.bf, q.lt)) o
          from b q left join sg g on g.ym=q.ym and g.dim=q.dim and g.key=q.key where q.ym=b.ym and q.dim<>'all' group by q.dim) z),
      'fc', coalesce((select jsonb_object_agg(fl.k, round(fl.v)) from fl where fl.ym=b.ym),'{}'::jsonb)
    )) from b where b.dim='all'),'{}'::jsonb),
  /* 記録：log＝月ごとの［記録日, 採用式, 予測, 受付済み売上, 予約外売上, キャンセル率の前提, 後から入る件数の見込み, 単価の前提, トレンド係数, 進捗率の前提, 空き枠］。logd＝その月の同じ日付（以前で最も近い日）の記録の全体 */
  'log', coalesce((select jsonb_object_agg(ym, a) from (select l.ym, jsonb_agg(jsonb_build_array(to_char(l.snap_date,'YYYY-MM-DD'), l.d->>'best', (l.d->'fc'->>(l.d->>'best'))::numeric, (l.d->'all'->>1)::numeric, (l.d->>'ext')::numeric, (l.d->'as'->>'chat')::numeric, (l.d->'as'->>'nhat')::numeric, (l.d->'as'->>'u')::numeric, (l.d->'as'->>'tm')::numeric, (l.d->'as'->>'sh')::numeric, (l.d->>'free')::numeric) order by l.snap_date) a from mtg_fc_log l, t where l.store=p_store and l.snap_date<=t.td group by l.ym) z),'{}'::jsonb),
  'logd', coalesce((select jsonb_object_agg(pm.ym, (select l.d||jsonb_build_object('snap',to_char(l.snap_date,'YYYY-MM-DD')) from mtg_fc_log l where l.store=p_store and l.ym=pm.ym and l.snap_date<=pm.dm order by l.snap_date desc limit 1)) from pm
      where exists (select 1 from mtg_fc_log l where l.store=p_store and l.ym=pm.ym and l.snap_date<=pm.dm)),'{}'::jsonb)
);
$function$;
grant execute on function public.mtg_fc(text, date) to anon, authenticated;

/* 毎日の記録（pg_cron から呼ぶ。anon からは呼べない） */
create or replace function public.mtg_fc_snap(p_stores text[])
returns int language plpgsql security definer set search_path to 'public' as $function$
declare s text; j jsonb; v_ym text; v_td date; n int := 0; jn jsonb; kk text;
begin
  foreach s in array p_stores loop
    j := mtg_fc(s); v_td := (j->>'today')::date; v_ym := to_char(v_td,'YYYY-MM');
    if j->'months'->v_ym is null then continue; end if;
    insert into mtg_fc_log(store, ym, snap_date, d)
      values (s, v_ym, v_td, (j->'months'->v_ym) || jsonb_build_object('best', j->'best', 'methods', j->'methods'))
      on conflict (store, ym, snap_date) do update set d = excluded.d, created_at = now();
    n := n + 1;
    /* 来月・再来月の予測（mtg_fc_next）も記録。store に #n を付けて当月の記録と分ける。失敗しても当月の記録は残す */
    begin
      jn := mtg_fc_next(s);
      for kk in select jsonb_object_keys(jn->'k') loop
        if jn->'k'->kk->>'ym' is null then continue; end if;
        insert into mtg_fc_log(store, ym, snap_date, d)
          values (s||'#n', jn->'k'->kk->>'ym', v_td, jsonb_build_object('k', kk::int, 'next', (select r from jsonb_array_elements(jn->'k'->kk->'rows') r where r->>0 = jn->'k'->kk->>'ym' limit 1)))
          on conflict (store, ym, snap_date) do update set d = excluded.d, created_at = now();
      end loop;
    exception when others then null;
    end;
  end loop;
  return n;
end $function$;
revoke all on function public.mtg_fc_snap(text[]) from public, anon, authenticated;

/* 毎日 23:55 JST（14:55 UTC）に記録。main： */
-- select cron.schedule('mtg_fc_snap', '55 14 * * *', $$select public.mtg_fc_snap(array['spk','nha'])$$);
/* BT： */
-- select cron.schedule('mtg_fc_snap', '55 14 * * *', $$select public.mtg_fc_snap(array['bt'])$$);
