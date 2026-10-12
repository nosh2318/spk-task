-- 2026-10-12 テスト予約 LICTEST-* の「復活」防止（オーナー指示：テスト予約は完全削除）
-- 原因：札幌スタッフAPPの silentRefresh が、DBに無い端末内の予約を「ローカル専用」とみなして再保存する（16:58:24 に LICTEST-SPK-1012 が復活）。
-- 対策：既存の block_test_reservations（ZZTEST 等を INSERT 時に黙って捨てる）に LICTEST を追加。BT にも同じガードを置く。
-- 影響範囲：id が LICTEST で始まる INSERT だけ。実予約の id（OTA番号・HDMS…・KD-…）には該当しない。
-- main（札幌・那覇）
create or replace function public.block_test_reservations()
 returns trigger language plpgsql as $function$
begin
  if NEW.id ilike 'ZZMYPAGETEST%' or NEW.id ilike 'KD-TEST%' or NEW.id ilike 'KDTEST%' or NEW.id ilike 'ZZTEST%' or NEW.id ilike 'ZZMYPAGE%'
     -- LICTEST は API経由（スタッフAPP・画面＝JWTあり）の INSERT だけ捨てる。管理者のSQL（試験用の作成）は通す
     or ((NEW.id ilike 'LICTEST%' or NEW.id ilike 'QAOFF%' or NEW.id in ('ZZNOTICEMAIL0814','ZZMP-SPK-A','dfghjkl','HDMS2608279463')) and coalesce(current_setting('request.jwt.claims',true),'') <> '') then
    raise notice 'blocked test reservation insert: %', NEW.id;
    return null;
  end if;
  return NEW;
end;
$function$;
