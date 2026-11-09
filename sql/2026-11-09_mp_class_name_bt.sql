-- ★2026-11-09 高松（BT プロジェクト ggqugvyskyiblxiycpci）用。考え方は 01 と同じ。
--  ① 予約確認メール（bt_reservation_emails）の名前。名前にクラス記号（…_D_TAK）があるときは今のクラスと同じときだけ使う
--  ② なければ店のクラス名（bt_classes.name。公式サイトと同じ呼び名）
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
declare c text; b text; v text;
begin
  if p_store <> 'tkm' then return null; end if;
  select upper(btrim(coalesce(vehicle_class,''))) into c from bt_reservations where id::text = p_res;
  select raw_body into b from bt_reservation_emails where reservation_id::text = p_res order by received_at asc nulls last limit 1;
  v := hdm_ota_class_from_mail(b);
  if v is not null and v ~ '_[A-Z0-9]+_[A-Z]+$' and v !~ ('_' || c || '_[A-Z]+$') then v := null; end if;
  if v is null then select name into v from bt_classes where id = c limit 1; end if;
  return v;
end $$;

create or replace function public.mp_class_name(p_store text, p_token text)
returns text language plpgsql stable security definer set search_path = public as $$
declare rid text;
begin
  if coalesce(p_token,'') = '' or p_store <> 'tkm' then return null; end if;
  if p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;  -- mypage_token は uuid 型
  select id::text into rid from bt_reservations where mypage_token = p_token::uuid limit 1;
  if rid is null then return null; end if;
  return hdm_class_name_of('tkm', rid);
end $$;
revoke all on function public.hdm_class_name_of(text,text) from public, anon, authenticated;
revoke all on function public.mp_class_name(text,text) from public;
grant execute on function public.mp_class_name(text,text) to anon, authenticated;
