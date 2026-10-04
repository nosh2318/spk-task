-- =====================================================================
-- 価格コントローラー（全店）新スキーマ  pc_*  （メインDB: ckrxttbnawkclshczsia）
-- フェーズ②（那覇 nha）着手版。札幌 spk / 高松 tkm は後続フェーズで seed。
-- 実行：オーナーが Supabase SQL Editor で。既存 app_settings 等には触れない。
-- 対象外：KEYDROP(hdm_price_master/hdm_keydrop_price/public_class_price_v) / BUDDICA(bt_*)
-- 高松(tkm)の classes・稼働率は BT側DBから読む（本DBには置かない）＝アプリ側で分岐。
-- =====================================================================

-- ---------- 1. 店舗 / OTA / 店×OTA ----------
create table if not exists pc_store (
  id        text primary key,          -- 'nha' / 'spk' / 'tkm'
  name      text not null,
  bt_source boolean not null default false,  -- true=クラス/稼働率/公式価格をBT側DBから読む(高松)
  sort      int  not null default 0,
  active    boolean not null default true
);

create table if not exists pc_ota (
  id    text primary key,              -- 'SKT','JLN','RKT','ART','RDC','GGO','OFFICIAL'
  name  text not null,
  sort  int not null default 0
);

create table if not exists pc_store_ota (
  store          text not null references pc_store(id),
  ota            text not null references pc_ota(id),
  start_date     date,                 -- 掲載開始
  end_date       date,                 -- 掲載終了（終了後は入力停止・価格/ログは残す）
  sort           int  not null default 0,
  incl_insurance boolean not null default false,  -- 免責込みで入力するOTAか
  active         boolean not null default true,
  primary key (store, ota)
);

-- 店×クラス：クラス一覧の正本は classes テーブル（tkmはBT側）。ここは表示順と売否のみ。
create table if not exists pc_store_class (
  store text not null references pc_store(id),
  class text not null,                 -- classes 由来。店が違えば同名でも別物
  sort  int  not null default 0,
  sell  jsonb not null default '{}'::jsonb,  -- {"JLN":true,"SKT":false,...} 未指定=売る
  primary key (store, class)
);

-- ---------- 2. 段（tier）定義 ＋ 月→L/R/H ----------
create table if not exists pc_tier (
  id    text primary key,              -- 'L','R','H' / 'L1'..'L9','LO','LN','LD' / 'HN','HG','HB','HS'
  kind  text not null check (kind in ('base','low','high')),
  name  text not null,
  sort  int  not null default 0
);

create table if not exists pc_month_tier (      -- 全店共通・画面から変更可
  month int primary key check (month between 1 and 12),
  tier  text not null references pc_tier(id)     -- 'L'/'R'/'H' のみ
);

-- ---------- 3. 金額（店×OTA×クラス×段） ----------
create table if not exists pc_price (
  store       text not null references pc_store(id),
  ota         text not null references pc_ota(id),
  class       text not null,
  tier        text not null references pc_tier(id),  -- base/low/high すべて
  amount      int,                      -- null/空=基本で売る（low/highが空なら目印のみ）
  prev_amount int,
  updated_at  timestamptz not null default now(),
  primary key (store, ota, class, tier)
);

-- ---------- 4. 安い日 / 高い日（店×日付×段）  重複不可 ----------
create table if not exists pc_special_day (
  store      text not null references pc_store(id),
  date       date not null,
  tier       text not null references pc_tier(id),  -- low or high の tier
  created_at timestamptz not null default now(),
  primary key (store, date)             -- 1日に高い/安いは同時付与不可
);

-- ---------- 5. 決め方ルール ＋ 下限 ----------
create table if not exists pc_rule (
  store     text not null references pc_store(id),
  class     text not null,
  method    text not null check (method in ('market','link','manual')),
  rank_base int,   -- market: 基本の狙い順位（初期5）
  rank_high int,   -- market: 高い日の狙い順位（初期5）
  rank_low  int,   -- market: 安い日の狙い順位（初期3）
  link_to   text,  -- link: 連動元クラス
  link_diff int,   -- link: ±円
  primary key (store, class)
);

create table if not exists pc_floor (    -- 下限ライン（未満は案に出さず手入力も保存不可）
  store  text not null references pc_store(id),
  ota    text not null references pc_ota(id),
  class  text not null,
  nights int  not null,                  -- 0=日帰り,1=1泊2日...（泊数）
  amount int  not null,
  primary key (store, ota, class, nights)
);

-- ---------- 6. 案（週次プログラムが書く受け皿） ----------
create table if not exists pc_proposal (
  id          bigserial primary key,
  store       text not null,
  ota         text not null,
  class       text not null,
  tier        text not null,
  amount      int,                       -- データ不足=null
  basis       text,                      -- 根拠
  survey_date date,
  mk_min  int, mk_3 int, mk_5 int, mk_10 int, mk_20 int,  -- 市場の目安
  flag        text,                      -- 'nodata' / 'gap'(今と1000円以上差) 等の目印
  status      text not null default 'open',  -- open/adopted/dismissed
  batch_id    text,
  created_at  timestamptz not null default now()
);

-- ---------- 7. 価格ログ（追記専用・誰が は記録しない） ----------
create table if not exists pc_log (
  id        bigserial primary key,
  ts        timestamptz not null default now(),   -- 表示はJST(+9)
  store text, ota text, class text, tier text,
  before    int,
  after     int,
  trigger   text,     -- manual/adopt/link/cp/deviation
  reason    text,
  batch_id  text
);

-- ---------- 8. 入力リスト（OTAへの反映待ち/済） ----------
create table if not exists pc_input_queue (
  id         bigserial primary key,
  store text, ota text, class text, tier text,
  before int, after int,
  nights_note text,   -- 1〜4泊の変更内容
  date_note   text,   -- 日付の付け替え
  status     text not null default 'waiting',  -- waiting/done/superseded(上書き取消)
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- 9. キャンペーン ----------
create table if not exists pc_campaign (
  id         bigserial primary key,
  otas       jsonb not null default '[]'::jsonb,     -- 複数OTA
  periods    jsonb not null default '[]'::jsonb,     -- 複数期間 [{from,to}]
  rate       numeric not null default 0.05,
  memo       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 10. 設定値（画面から変更可）＝追加A ----------
create table if not exists pc_setting (
  key   text primary key,
  value jsonb not null
);

-- =====================================================================
-- RLS：既存 app_settings と同じ思想（読取/書込とも authenticated）。
--   anon では書けない。pc_proposal への「案書込み専用アカウント」は
--   オーナーが Supabase でユーザー作成後、下部のテンプレ policy を有効化。
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'pc_store','pc_ota','pc_store_ota','pc_store_class','pc_tier','pc_month_tier',
    'pc_price','pc_special_day','pc_rule','pc_floor','pc_proposal','pc_log',
    'pc_input_queue','pc_campaign','pc_setting'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t||'_auth_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t||'_auth_all', t);
  end loop;
end $$;

-- 案書込み専用アカウント用（オーナーがアカウント作成後にUID差し替えて有効化）
-- create policy pc_proposal_bot_insert on pc_proposal
--   for insert to authenticated with check (auth.uid() = '<PROPOSAL_BOT_UID>');

-- =====================================================================
-- 初期値（SEED）  ※ ON CONFLICT DO NOTHING で再実行安全
-- =====================================================================
insert into pc_store(id,name,bt_source,sort,active) values
  ('nha','那覇空港店',false,1,true),
  ('spk','札幌店',    false,2,true),
  ('tkm','高松空港店(HANDYMAN)',true,3,true)
on conflict (id) do nothing;

insert into pc_ota(id,name,sort) values
  ('SKT','スカイチケット',1),('JLN','じゃらん',2),('RKT','楽天トラベル',3),
  ('ART','エアトリ',4),('RDC','レンタカードットコム',5),('GGO','gogoout',6),
  ('TBR','たびらい',7),   -- OTA一覧には登録。那覇の掲載(pc_store_ota)には初期では入れない
  ('OFFICIAL','公式HP',9)
on conflict (id) do nothing;

-- 那覇の掲載OTA（初期）：SKT JLN RKT ART RDC GGO 公式
insert into pc_store_ota(store,ota,sort) values
  ('nha','SKT',1),('nha','JLN',2),('nha','RKT',3),('nha','ART',4),
  ('nha','RDC',5),('nha','GGO',6),('nha','OFFICIAL',9)
on conflict (store,ota) do nothing;

-- 那覇の店×クラス表示順（クラス正本=classes の store_id='naha'。ここは順と売否のみ）
-- 決め方で使う A/A2/B/B2/D/F/H を必ず含める。A2・B2 は公式HPで売らない(sell.OFFICIAL=false)。
-- 実際のクラス一覧は画面が classes(store_id='naha') から読む＝ここは初期の順/売否のみ。
insert into pc_store_class(store,class,sort,sell) values
  ('nha','B', 1,'{}'::jsonb),
  ('nha','A', 2,'{}'::jsonb),
  ('nha','A2',3,'{"OFFICIAL":false}'::jsonb),
  ('nha','B2',4,'{"OFFICIAL":false}'::jsonb),
  ('nha','D', 5,'{}'::jsonb),
  ('nha','F', 6,'{}'::jsonb),
  ('nha','H', 7,'{}'::jsonb)
on conflict (store,class) do nothing;

-- 段：基本 L/R/H
insert into pc_tier(id,kind,name,sort) values
  ('L','base','閑散',1),('R','base','通常',2),('H','base','繁忙',3),
  -- 安い日：L1〜L9・LO(10月)・LN(11月)・LD(12月)
  ('L1','low','安い日1月',11),('L2','low','安い日2月',12),('L3','low','安い日3月',13),
  ('L4','low','安い日4月',14),('L5','low','安い日5月',15),('L6','low','安い日6月',16),
  ('L7','low','安い日7月',17),('L8','low','安い日8月',18),('L9','low','安い日9月',19),
  ('LO','low','安い日10月',20),('LN','low','安い日11月',21),('LD','low','安い日12月',22),
  -- 高い日：HN年末年始 / HG GW / HB お盆 / HS SW
  ('HN','high','年末年始',31),('HG','high','GW',32),('HB','high','お盆',33),('HS','high','SW',34)
on conflict (id) do nothing;

-- 月→L/R/H（全店共通・初期）：L=12,1,2,4 / R=10,11,5,6,7,9 / H=3,8
insert into pc_month_tier(month,tier) values
  (1,'L'),(2,'L'),(3,'H'),(4,'L'),(5,'R'),(6,'R'),
  (7,'R'),(8,'H'),(9,'R'),(10,'R'),(11,'R'),(12,'L')
on conflict (month) do nothing;

-- 那覇の決め方（初期値）：B=市場 / A=B+1500 / D=B-1000 / A2=A-500 / B2=B-500 / F,H=手入力
insert into pc_rule(store,class,method,rank_base,rank_high,rank_low,link_to,link_diff) values
  ('nha','B','market',5,5,3,null,null),
  ('nha','A','link',null,null,null,'B', 1500),
  ('nha','D','link',null,null,null,'B',-1000),
  ('nha','A2','link',null,null,null,'A',-500),
  ('nha','B2','link',null,null,null,'B',-500),
  ('nha','F','manual',null,null,null,null,null),
  ('nha','H','manual',null,null,null,null,null)
on conflict (store,class) do nothing;

-- 設定値（追加A）：画面から変更可
insert into pc_setting(key,value) values
  ('gap_threshold',        '1000'),            -- 案の「ズレ」目印（今と±円以上）
  ('low_cand_util',        '0.40'),            -- 安い日候補：稼働率しきい値
  ('low_cand_days',        '30'),              -- 安い日候補：何日以内
  ('cp_default_rate',      '0.05'),            -- キャンペーン初期割引率
  ('big_change',           '0.20'),            -- 大きな変更の確認（±20%）
  ('official_link_ota',    '{"nha":"JLN","spk":null,"tkm":null}'),  -- 公式HP連動先OTA
  ('deviation',            '{"min_amount":1000,"max_amount":100000,"ratio_low":0.3333,"ratio_high":3.0,"market_out":0.20,"other_ota":0.60,"prev_change":0.20}')
on conflict (key) do nothing;

-- =====================================================================
-- 【#7 既に旧版を流してしまった場合の訂正】通常は不要（本スキーマ未適用を確認済 2026-10-05）。
-- 旧版で C・S が入り A2・B2 が無い／TBR 無し のまま適用していた場合だけ、以下を実行。
-- （人手入力のある本番では流さない。pc_* は新規のため人手値はまだ無い＝安全）
-- --------------------------------------------------------------------
-- insert into pc_ota(id,name,sort) values ('TBR','たびらい',7) on conflict (id) do nothing;
-- delete from pc_store_class where store='nha' and class in ('C','S');  -- 誤初期値の除去（人手編集前のみ）
-- insert into pc_store_class(store,class,sort,sell) values
--   ('nha','B',1,'{}'::jsonb),('nha','A',2,'{}'::jsonb),
--   ('nha','A2',3,'{"OFFICIAL":false}'::jsonb),('nha','B2',4,'{"OFFICIAL":false}'::jsonb),
--   ('nha','D',5,'{}'::jsonb),('nha','F',6,'{}'::jsonb),('nha','H',7,'{}'::jsonb)
-- on conflict (store,class) do update set sort=excluded.sort, sell=excluded.sell;
