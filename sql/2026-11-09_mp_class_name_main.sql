-- ★2026-11-09 nosh「車種ではありません ご予約クラスです」「クラス名は正確な名称を」「媒体ごとです」
-- ご予約クラスの名前＝お客様が予約した媒体での名前。
--  ① その予約の予約確認メール（nha_reservation_emails / spk_reservation_emails）に書かれた名前
--  ② メールが保存されていない予約は、店×媒体×クラス記号の対応表 hdm_class_names（実際のメールで確かめた名前だけを入れる）
--  ③ どちらもなければ null（画面は車名だけを出す）
-- セール等の飾り（【…】・☆★・"”・「デリバリーコミコミ価格」・BUDDICA の前置き）は外す。【高年式】は中身なので残す。
-- 領収書など他の画面も hdm_class_name_of(store, reservation_id) を読めば同じ名前になる。

create table if not exists public.hdm_class_names(
  store text not null, ota_key text not null, cls text not null, name text not null,
  note text, updated_at timestamptz not null default now(),
  primary key(store, ota_key, cls));
alter table public.hdm_class_names enable row level security;

create or replace function public.hdm_ota_key(p_ota text) returns text language sql immutable as $$
  select case
    when p_ota in ('J','じゃらん','JLN') then 'jalan'
    when p_ota in ('R','楽天','RKT') then 'rakuten'
    when p_ota in ('S','スカイチケット','SKT') then 'skyticket'
    when p_ota in ('O','エアトリ','ART') then 'airtrip'
    when p_ota in ('RC','レンタカードットコム','RDC') then 'rentacar_com'
    when p_ota in ('HP','HANDYMAN','SP','KEYDROP','direct','直予約','') or p_ota is null then 'official'
    else lower(p_ota) end $$;

create or replace function public.hdm_ota_class_from_mail(p_body text)
returns text language plpgsql immutable as $$
declare v text; m text[];
begin
  if p_body is null then return null; end if;
  p_body := replace(p_body, E'\r', '');
  m := regexp_match(p_body, E'【ご予約車両クラス】\\s*([^\\n]+)');                    -- 高松の公式
  if m is null then m := regexp_match(p_body, E'ご予約車両クラス[^\\n]*\\n\\s*([^\\n]+)'); end if; -- 那覇・札幌の公式
  if m is not null then v := m[1];
  else
    m := regexp_match(p_body, E'料金プラン\\s*[：:]\\s*([^\\n]+)');                       -- じゃらん
    if m is null then m := regexp_match(p_body, E'プラン名\\s*[：:]\\s*([^\\n]+)'); end if;  -- スカイチケット・エアトリ・レンタカードットコム
    if m is null then m := regexp_match(p_body, E'詳細車両クラス\\s*[：:]\\s*([^\\n]+)'); end if; -- 楽天
    if m is null then m := regexp_match(p_body, E'車種\\s*[：:]\\s*([^\\n]+)'); end if;
    if m is null then return null; end if;
    v := m[1];
    m := regexp_match(v, '[☆★]([^☆★]+)[☆★]');            -- ☆ミニバン_B_SPK☆
    if m is not null then v := m[1]; end if;
    m := regexp_match(v, '["”“]([^"”“]+)["”“]\s*(_[A-Z0-9]+_[A-Z]+)?');   -- "ラグジュアリーミニバンプラン"_A_TAK ／ ”SUV” プラン
    if m is not null then v := m[1] || coalesce(m[2], ''); end if;
  end if;
  v := replace(v, '【高年式】', '高年式');
  v := regexp_replace(v, '【[^】]*】', '', 'g');
  v := regexp_replace(v, '[☆★"”“]', '', 'g');
  v := regexp_replace(v, '\s*デリバリーコミコミ価格\s*$', '');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  if v = '' then return null; end if;
  return v;
end $$;

create or replace function public.hdm_class_name_of(p_store text, p_res text)
returns text language plpgsql stable security definer set search_path = public as $$
declare o text; c text; b text; v text;
begin
  if p_store = 'nha' then
    select ota, vehicle_class into o, c from nha_reservations where id = p_res;
    select raw_body into b from nha_reservation_emails where reservation_id = p_res order by received_at asc nulls last limit 1;
  elsif p_store = 'spk' then
    select ota, vehicle into o, c from reservations where id = p_res;
    select raw_body into b from spk_reservation_emails where reservation_id = p_res order by received_at asc nulls last limit 1;
  else return null; end if;
  c := upper(btrim(coalesce(c,'')));
  v := hdm_ota_class_from_mail(b);
  -- 予約後にクラスが変わった予約はメールの名前が古い → 名前の中のクラス記号（…_B_SPK／Bクラス（…））が今のクラスと同じときだけ使う
  if v is not null and not (v ~ ('_' || c || '(_[A-Z]+)?$') or v ~ ('^' || c || 'クラス')) then v := null; end if;
  if v is null then select name into v from hdm_class_names where store = p_store and ota_key = hdm_ota_key(o) and cls = c; end if;
  return v;
end $$;

-- マイページ用（トークンから。名前だけを返す）
create or replace function public.mp_class_name(p_store text, p_token text)
returns text language plpgsql stable security definer set search_path = public as $$
declare rid text;
begin
  if coalesce(p_token,'') = '' then return null; end if;
  if p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;  -- mypage_token は uuid 型
  if p_store = 'nha' then select id into rid from nha_reservations where mypage_token = p_token::uuid limit 1;
  elsif p_store = 'spk' then select id into rid from reservations where mypage_token = p_token::uuid limit 1;
  end if;
  if rid is null then return null; end if;
  return hdm_class_name_of(p_store, rid);
end $$;
revoke all on function public.hdm_class_name_of(text,text) from public, anon, authenticated;
revoke all on function public.mp_class_name(text,text) from public;
grant execute on function public.mp_class_name(text,text) to anon, authenticated;

-- 対応表：11/9 時点の予約確認メールで確かめた名前（いちばん多い表記）
insert into public.hdm_class_names(store, ota_key, cls, name, note) values
 ('nha','jalan','A','アルファード確約プラン_A','mail'),('nha','jalan','A2','アルファード確約プラン_A2','mail'),
 ('nha','jalan','B','ワンボックスカー プラン_B','mail'),('nha','jalan','B2','ワンボックスカー プラン_B2','mail'),
 ('nha','jalan','D','ワンボックスカー プラン_D','mail'),('nha','jalan','F','コンパクトカー プラン_F','mail'),('nha','jalan','H','ハイブリッドカー プラン_H','mail'),
 ('nha','airtrip','A','アルファード指定プラン_A','mail'),('nha','airtrip','A2','アルファード確約プラン_A2','mail'),
 ('nha','airtrip','B','ワンボックスカー プラン_B','mail'),('nha','airtrip','B2','ワンボックスカー プラン_B2','mail'),
 ('nha','airtrip','D','ワンボックスカー プラン_D','mail'),('nha','airtrip','F','コンパクトカー プラン_F','mail'),('nha','airtrip','H','ハイブリッドカー プラン_H','mail'),
 ('nha','rakuten','A','アルファード指定プラン_A','mail'),('nha','rakuten','A2','アルファード確約プラン_A2','mail'),
 ('nha','rakuten','B','広々快適ワンボックスカープラン_B','mail'),('nha','rakuten','B2','ワンボックスカー ランダムプラン_B2','mail'),
 ('nha','rakuten','D','広々快適ワンボックスカープラン_D','mail'),('nha','rakuten','F','低燃費なコンパクトカープラン_F','mail'),
 ('nha','rakuten','H','低燃費でガソリン代も安心ハイブリッドカープラン_H','mail'),
 ('nha','skyticket','A','アルファード確約プラン_A','mail'),('nha','skyticket','A2','アルファード確約プラン_A2','mail'),
 ('nha','skyticket','B','ワンボックスカープラン_B','mail'),('nha','skyticket','B2','ワンボックスカープラン_B2','mail'),
 ('nha','skyticket','F','コンパクトカープラン_F','mail'),('nha','skyticket','H','ハイブリッドカープラン_H','mail'),
 ('spk','jalan','A','ハイクラスミニバン_A_SPK','mail'),('spk','jalan','A2','ハイクラスミニバン_A2_SPK','mail'),
 ('spk','jalan','B','ミニバン_B_SPK','mail'),('spk','jalan','B2','高年式ミニバン_B2_SPK','mail'),
 ('spk','jalan','C','コンパクトSUV_C_SPK','mail'),('spk','jalan','F','コンパクトハイトワゴン_F_SPK','mail'),
 ('spk','jalan','G','コンパクトカー_G_SPK','mail'),('spk','jalan','H','ミドル・セダン_H_SPK','mail'),('spk','jalan','S','SUV デリバリー_S_SPK','mail'),
 ('spk','rakuten','A','ハイクラスミニバン_A_SPK','mail'),('spk','rakuten','A2','高年式ハイクラスミニバン_A2_SPK','mail'),
 ('spk','rakuten','B','ミニバン_B_SPK','mail'),('spk','rakuten','B2','高年式ミニバン_B2_SPK','mail'),
 ('spk','rakuten','C','コンパクトSUV_C_SPK','mail'),('spk','rakuten','F','コンパクトハイトワゴン_F_SPK','mail'),
 ('spk','rakuten','G','コンパクトカー_G_SPK','mail'),('spk','rakuten','H','ミドル・セダン_H_SPK','mail'),('spk','rakuten','S','SUV_S_SPK','mail'),
 ('spk','skyticket','A','ハイクラスミニバン_A_SPK','mail'),('spk','skyticket','A2','高年式ハイクラスミニバン_A2_SPK','mail'),
 ('spk','skyticket','B','ミニバン_B_SPK','mail'),('spk','skyticket','B2','高年式ミニバン_B2_SPK','mail'),
 ('spk','skyticket','C','コンパクトSUV_C_SPK','mail'),('spk','skyticket','F','コンパクトハイトワゴン_F_SPK','mail'),
 ('spk','skyticket','G','コンパクトカー_G_SPK','mail'),('spk','skyticket','S','SUV_S_SPK','mail'),
 ('spk','rentacar_com','G','コンパクトカー_G_SPK','mail'),
 ('nha','official','A','Aクラス（プレミアムミニバン）','site'),('nha','official','A2','A2クラス（プレミアムミニバン 高年式）','site'),
 ('nha','official','B','Bクラス（ミニバン）','site'),('nha','official','B2','B2クラス（ミニバン 高年式）','site'),
 ('nha','official','C','Cクラス（コンパクトSUV）','site'),('nha','official','D','Dクラス（ミニバン）','site'),
 ('nha','official','F','Fクラス（コンパクト）','site'),('nha','official','H','Hクラス（セダン／ハイブリッド）','site'),('nha','official','S','Sクラス（SUV）','site'),
 ('spk','official','A','Aクラス（トヨタ アルファード/ヴェルファイア）','mail'),('spk','official','A2','A2クラス（トヨタ アルファード/ヴェルファイア 高年式）','site'),
 ('spk','official','B','Bクラス（トヨタ ノア/三菱 デリカD5）','mail'),('spk','official','B2','B2クラス（トヨタ ノア 高年式モデル）','mail'),
 ('spk','official','C','Cクラス（ダイハツ ロッキー/マツダ CX3）','mail'),('spk','official','F','Fクラス（トヨタ ルーミー/スズキ ソリオ）','mail'),
 ('spk','official','G','Gクラス（マツダ デミオ/日産 ノート）','mail'),('spk','official','S','Sクラス（トヨタ ハリアー/マツダ CX5）','mail'),('spk','official','H','Hクラス（セダン）','site')
on conflict (store, ota_key, cls) do update set name = excluded.name, note = excluded.note, updated_at = now();
