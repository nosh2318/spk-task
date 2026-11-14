-- 2026-11-14 オムニ（Mac mini cs_autoreply v2）が案と一緒に「スタッフがすること」を残す。本部のチャットカードに出す
alter table public.cs_chat_drafts add column if not exists omni_action text;
