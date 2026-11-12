/* 2026-11-12 翌月・翌々月の着地見込み用（読み取り専用）。日別に「今の予約＋これから入る分」を積み上げる。
   これから入る分＝過去の同じリードタイム（何日前か）・平日/土日での入り方。p＝台数あたりの率、f＝空き台数が埋まる率。
   直近28日の入り方が過去の同じ時期より強い/弱い分を c（0.4〜2.5）として 0乗・0.5乗・1乗で掛けた案を全部返す（採用は画面側で過去月の外れが最小の案）。
   キャンセル率＝台帳（2026-09-18〜）以降の実績。単価＝その日の今の予約単価×（後から入る予約の単価÷先に入った予約の単価）。上限＝台数の95%。
   rows＝[対象月, 基準日, 稼働可能日数, 今の貸出日数, 今の売上, 最終の貸出日数, 最終の売上, c, [[案, キャンセル見込み日数, これから入る日数, 着地日数, 着地売上]…], 直近28日に入った貸出日数]（売上＝貸出日で日割り）。
   過去月は同じ日付時点に戻して同じ計算をした結果（その月自身の日は率の計算から除く）。seg＝対象月の上旬/中旬/21〜26日/27日〜の[区分, 稼働可能日数, 今, 着地（f0）] */
create or replace function public.mtg_fc_next(p_store text, p_td date default null)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
with t as (select coalesce(p_td,(now() at time zone 'Asia/Tokyo')::date) td),
r as (select * from mtg_fc_res(p_store)),
rd as (select g::date d, r.cd, r.xd, r.rev/(r.ed-r.sd+1) dr from r, generate_series(greatest(r.sd,date '2026-04-01'), r.ed, interval '1 day') g),
cm as (select ym, sum(n)::numeric n from mtg_fc_cap(p_store) group by 1),
cal as (select g::date d, to_char(g,'YYYY-MM') ym, case when extract(dow from g) in (0,6) then 'e' else 'w' end ty,
    coalesce((select n from cm where cm.ym=to_char(g,'YYYY-MM')), (select n from cm order by ym desc limit 1)) cap
  from t, generate_series(date '2026-04-01', (date_trunc('month',t.td)+interval '3 month'-interval '1 day')::date, interval '1 day') g),
ls as (select generate_series(10,85) l),
/* 過去の日 d'・リードタイム l ごとの材料（月・曜日区分で集計）。l 日前の時点が 2026-04-01 以降の日だけ（それ以前は受付日が使えない） */
hraw as (select ls.l, cal.ym, cal.ty,
    count(*) filter (where rd.xd is null and rd.d-rd.cd < ls.l) nw,
    coalesce(sum(rd.dr) filter (where rd.xd is null and rd.d-rd.cd < ls.l),0) nwr,
    count(*) filter (where rd.d-rd.cd >= ls.l and rd.d-rd.cd < ls.l+28 and (rd.xd is null or rd.xd > rd.d-ls.l)) g28,
    count(*) filter (where rd.xd is null and rd.d-rd.cd >= ls.l) okn,
    count(*) filter (where rd.d-rd.cd >= ls.l and (rd.xd is null or rd.xd > rd.d-ls.l)) oba,
    coalesce(sum(rd.dr) filter (where rd.xd is null and rd.d-rd.cd >= ls.l),0) okr,
    count(*) filter (where rd.d-ls.l >= date '2026-09-18' and rd.d-rd.cd >= ls.l and (rd.xd is null or rd.xd > rd.d-ls.l)) obn,
    count(*) filter (where rd.d-ls.l >= date '2026-09-18' and rd.d-rd.cd >= ls.l and rd.xd > rd.d-ls.l) obc
  from t, ls join cal on cal.d - ls.l >= date '2026-04-01' join rd on rd.d=cal.d where cal.d < t.td group by 1,2,3),
hcap as (select ls.l, cal.ym, cal.ty, sum(cal.cap) cap from t, ls join cal on cal.d - ls.l >= date '2026-04-01' where cal.d < t.td group by 1,2,3),
h as (select c.l, c.ym, c.ty, c.cap, coalesce(x.nw,0) nw, coalesce(x.nwr,0) nwr, coalesce(x.g28,0) g28, coalesce(x.okn,0) okn, coalesce(x.oba,0) oba, coalesce(x.okr,0) okr, coalesce(x.obn,0) obn, coalesce(x.obc,0) obc
  from hcap c left join hraw x on x.l=c.l and x.ym=c.ym and x.ty=c.ty),
call as (select coalesce(sum(obc)::numeric/nullif(sum(obn),0),0) c0 from h where l between 15 and 50),
ks as (select generate_series(1,2) k),
ctx as (select ks.k, g::date ms, (g+interval '1 month'-interval '1 day')::date me, to_char(g,'YYYY-MM') ym,
    least((g-(ks.k||' month')::interval)::date + (extract(day from t.td)::int-1), (g-((ks.k-1)||' month')::interval-interval '1 day')::date) s,
    (g = date_trunc('month',t.td)+(ks.k||' month')::interval) tgt
  from t, ks, generate_series(date '2026-06-01', date_trunc('month',t.td)+interval '2 month', interval '1 month') g
  where g <= date_trunc('month',t.td)+(ks.k||' month')::interval),
cx as (select * from ctx where s >= date '2026-04-20'),
/* 対象月の各日：その時点の予約（ob）・直近28日に入った分（a28）・最終（fin） */
td as (select cx.k, cx.ym, cx.s, cx.tgt, cal.d, cal.ty, cal.cap, (cal.d-cx.s) l,
    count(rd.d) filter (where rd.cd<=cx.s and (rd.xd is null or rd.xd>cx.s)) ob,
    coalesce(sum(rd.dr) filter (where rd.cd<=cx.s and (rd.xd is null or rd.xd>cx.s)),0) obr,
    count(rd.d) filter (where rd.cd<=cx.s and rd.cd>cx.s-28 and (rd.xd is null or rd.xd>cx.s)) a28,
    count(rd.d) filter (where rd.xd is null) fin,
    coalesce(sum(rd.dr) filter (where rd.xd is null),0) finr
  from cx join cal on cal.d between cx.ms and cx.me left join rd on rd.d=cal.d group by cx.k, cx.ym, cx.s, cx.tgt, cal.d, cal.ty, cal.cap),
/* 各日のリードタイムに対応する過去の率（対象月自身の日は除く） */
tp as (select td.*, hh.pn, hh.q, hh.g, hh.rho, coalesce(hh.cr, (select c0 from call)) cr
  from td left join lateral (select sum(h.nw)/nullif(sum(h.cap),0) pn, sum(h.nw)/nullif(sum(h.cap-h.oba),0) q, sum(h.g28)/nullif(sum(h.cap),0) g,
      (sum(h.nwr)/nullif(sum(h.nw),0))/nullif(sum(h.okr)/nullif(sum(h.okn),0),0) rho,
      case when sum(h.obn)>=150 then sum(h.obc)::numeric/sum(h.obn) end cr
    from h where h.l=least(greatest(td.l,10),85) and h.ty=td.ty and h.ym<>td.ym) hh on true),
mc as (select k, ym, greatest(0.4, least(2.5, coalesce(sum(a28)/nullif(sum(cap*g),0),1))) c, sum(obr)/nullif(sum(ob),0) mu from tp group by 1,2),
fc as (select tp.k, tp.ym, tp.s, tp.tgt, tp.d, tp.cap, tp.ob, tp.obr, tp.fin, tp.finr, tp.a28, tp.cr, mc.c, a.al, a.mt,
    least((case a.mt when 'p' then coalesce(tp.cap*tp.pn,0) else coalesce(greatest(0,tp.cap-tp.ob)*tp.q,0) end)*power(mc.c,a.al), greatest(0, tp.cap*0.95 - tp.ob*(1-tp.cr))) nw,
    coalesce(tp.rho,1) * (case when tp.ob>=3 then tp.obr/tp.ob else coalesce(mc.mu,0) end) up
  from tp join mc on mc.k=tp.k and mc.ym=tp.ym cross join (values ('p',0::numeric),('p',0.5),('f',0),('f',0.5),('f',1)) a(mt,al)),
ms as (select k, ym, s, tgt, mt||al::text al, sum(cap) cap, sum(ob) ob, round(sum(obr)) obr, sum(fin) fin, round(sum(finr)) finr, sum(a28) a28, max(c) c,
    round(sum(ob*cr),1) cx, round(sum(nw),1) nw, round(sum(ob*(1-cr)+nw),1) fd, round(sum(obr*(1-cr)+nw*up)) fr
  from fc group by 1,2,3,4,5),
sg as (select k, ym, case when extract(day from d)<=10 then 1 when extract(day from d)<=20 then 2 when extract(day from d)<=26 then 3 else 4 end sgn,
    sum(cap) cap, sum(ob) ob, round(sum(ob*(1-cr)+nw),1) fd from fc where tgt and mt='f' and al=0 group by 1,2,3)
select jsonb_build_object('today',(select to_char(td,'YYYY-MM-DD') from t),
  'k', (select jsonb_object_agg(k, jsonb_build_object(
      'ym', (select max(ym) from ms m2 where m2.k=z.k and m2.tgt),
      'rows', (select jsonb_agg(jsonb_build_array(m.ym, to_char(m.s,'YYYY-MM-DD'), m.cap, m.ob, m.obr, m.fin, m.finr, round(m.c,3),
          (select jsonb_agg(jsonb_build_array(q.al, q.cx, q.nw, q.fd, q.fr) order by q.al) from ms q where q.k=m.k and q.ym=m.ym), m.a28) order by m.ym)
        from ms m where m.k=z.k and m.al='p0'),
      'seg', (select jsonb_agg(jsonb_build_array(sgn, cap, ob, fd) order by sgn) from sg where sg.k=z.k))) from ks z));
$function$;
grant execute on function public.mtg_fc_next(text, date) to anon, authenticated;
