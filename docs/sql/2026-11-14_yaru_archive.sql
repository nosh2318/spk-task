-- ★2026-11-14 nosh「確認済/アーカイブ機能を追加」「永遠にたまる」
-- 本部 やること（mypage-active.html）のカードを「確認済」にした記録。表示だけの記録で、予約・タスクの値は変えない。
-- 書き込みは EF mypage-active（action arch_set、ADMIN_PIN 必須）だけ。画面から直接は読めない・書けない（RLS・ポリシーなし）。
create table if not exists public.yaru_archive (
  key          text primary key,            -- カードの鍵（例 prep:hdm_nha:R078XN9Q:電話して聞く：じゃらん決済 / late:unconf:123:有本）
  bucket       text,                        -- hdm_nha / hdm_spk / hdm_tkm / but_tkm / key_nha / key_spk
  kind         text,                        -- omni / voice / late / prep / money
  rid          text,
  title        text,
  archived_by  text not null,               -- 押した人
  archived_at  timestamptz not null default now(),
  restored_by  text,                        -- 「戻す」を押した人（戻したら一覧に再表示）
  restored_at  timestamptz
);
create index if not exists yaru_archive_at_idx on public.yaru_archive (archived_at desc);
alter table public.yaru_archive enable row level security;
revoke all on public.yaru_archive from anon, authenticated;
