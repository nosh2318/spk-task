-- ★2026-11-09 nosh「メールがないことなんてない」：高松の楽天・じゃらん・公式の名前を、受信箱の予約通知メールで確かめて対応表にした（BT プロジェクト ggqugvyskyiblxiycpci）。
--  楽天の書き方「乗用車 / コンパクト コンパクト_G_TAK」から最後の名前だけを取る。
--  順番：①その予約のメール（クラス記号が今のクラスと同じとき）②店×媒体×クラスの対応表 hdm_class_names ③店のクラス名 bt_classes.name
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
  m := regexp_match(p_body, E'【ご予約車両クラス】\\s*([^\\n]+)');
  if m is null then m := regexp_match(p_body, E'ご予約車両クラス[^\\n]*\\n\\s*([^\\n]+)'); end if;
  if m is not null then v := m[1];
  else
    m := regexp_match(p_body, E'料金プラン\\s*[：:]\\s*([^\\n]+)');
    if m is null then m := regexp_match(p_body, E'プラン名\\s*[：:]\\s*([^\\n]+)'); end if;
    if m is null then m := regexp_match(p_body, E'詳細車両クラス\\s*[：:]\\s*([^\\n]+)'); end if;
    if m is null then m := regexp_match(p_body, E'車種\\s*[：:]\\s*([^\\n]+)'); end if;
    if m is null then return null; end if;
    v := m[1];
    m := regexp_match(v, '[☆★]([^☆★]+)[☆★]');
    if m is not null then v := m[1]; end if;
    m := regexp_match(v, '/.*\s(\S+_[A-Z0-9]+_[A-Z]+)\s*$');  -- 楽天「乗用車 / コンパクト コンパクト_G_TAK」→ 最後の名前
    if m is not null then v := m[1]; end if;
    m := regexp_match(v, '["”“]([^"”“]+)["”“]\s*(_[A-Z0-9]+_[A-Z]+)?');
    if m is not null then v := m[1] || coalesce(m[2], ''); end if;
  end if;
  v := replace(v, '【高年式】', '高年式');
  v := regexp_replace(v, '【[^】]*】', '', 'g');
  v := regexp_replace(v, '[☆★"”“]', '', 'g');
  v := regexp_replace(v, '\s*デリバリーコミコミ価格\s*$', '');
  v := regexp_replace(v, '^\s*\((.*)\)\s*$', '\1');          -- たびらい「(ミニバン (ノア/ヴォクシー))」
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  if v = '' then return null; end if;
  return v;
end $$;

create or replace function public.hdm_class_name_of(p_store text, p_res text)
returns text language plpgsql stable security definer set search_path = public as $$
declare c text; b text; v text; o text; br text;
begin
  if p_store <> 'tkm' then return null; end if;
  select upper(btrim(coalesce(vehicle_class,''))), ota, brand into c, o, br from bt_reservations where id::text = p_res;
  select raw_body into b from bt_reservation_emails where reservation_id::text = p_res order by received_at asc nulls last limit 1;
  v := hdm_ota_class_from_mail(b);
  if v is not null and v ~ '_[A-Z0-9]+_[A-Z]+$' and v !~ ('_' || c || '_[A-Z]+$') then v := null; end if;
  if v is null and br = 'HDM' then select name into v from hdm_class_names where store = 'tkm' and ota_key = hdm_ota_key(o) and cls = c; end if;
  if v is null then select name into v from bt_classes where id = c limit 1; end if;
  return v;
end $$;
revoke all on function public.hdm_class_name_of(text,text) from public, anon, authenticated;

-- 対応表：11/9 受信箱の予約通知メール（じゃらん・楽天）と公式サイトの表示で確かめた名前。見ていないクラスは入れない（店のクラス名になる）
insert into public.hdm_class_names(store, ota_key, cls, name, note) values
 ('tkm','jalan','A','ラグジュアリーミニバンプラン_A_TAK','mail'),('tkm','jalan','C','ミニバンプラン_C_TAK','mail'),
 ('tkm','jalan','D','SUVプラン_D_TAK','mail'),('tkm','jalan','E','エコカー・ハイブリッドプラン_E_TAK','mail'),('tkm','jalan','I','軽ハイトワゴンプラン_I_TAK','mail'),('tkm','jalan','F','コンパクトSUVプラン_F_TAK','mail'),
 ('tkm','jalan','G','コンパクトプラン_G_TAK','mail'),('tkm','jalan','H','コンパクトハイトワゴンプラン_H_TAK','mail'),
 ('tkm','jalan','J','軽・コンパクトプラン_J_TAK','mail'),('tkm','jalan','K','コンパクトミニバンプラン_K_TAK','mail'),
 ('tkm','rakuten','C','ミニバン_C_TAK','mail'),('tkm','rakuten','D','SUV_D_TAK','mail'),('tkm','rakuten','I','軽ハイトワゴン_I_TAK','mail'),('tkm','rakuten','E','エコカー・ハイブリッド_E_TAK','mail'),
 ('tkm','rakuten','F','コンパクトSUV_F_TAK','mail'),('tkm','rakuten','G','コンパクト_G_TAK','mail'),
 ('tkm','rakuten','H','コンパクトハイトワゴン_H_TAK','mail'),('tkm','rakuten','J','軽・コンパクト_J_TAK','mail'),
 ('tkm','rakuten','K','コンパクトミニバン_K_TAK','mail'),
 ('tkm','official','C','Cクラス（ミニバン）','site'),('tkm','official','D','Dクラス（SUV）','site'),
 ('tkm','official','E','Eクラス（セダン／ハイブリッド）','site'),('tkm','official','F','Fクラス（コンパクトSUV）','site'),
 ('tkm','official','G','Gクラス（コンパクト）','site'),('tkm','official','H','Hクラス（コンパクトハイトワゴン）','site'),
 ('tkm','official','I','Iクラス（軽ハイトワゴン）','site'),('tkm','official','J','Jクラス（軽・コンパクト）','site'),
 ('tkm','official','K','Kクラス（コンパクトワゴン）','site')
on conflict (store, ota_key, cls) do update set name = excluded.name, note = excluded.note, updated_at = now();
notify pgrst, 'reload schema';
