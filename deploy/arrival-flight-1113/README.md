# 到着便をマイページで登録できるように（2026-11-13）
陳様 HDMN2611128641（那覇・PUB）が「到着便を登録できない」。原因：マイページの「到着便」を押すとチャットに飛ぶだけで、入力欄が無かった。

## 本番に入れる順（Mac mini、noshの言葉「到着便の直しを本番に入れて」）
1. EF mypage-info（main ckrxttbnawkclshczsia）：最新を `supabase functions download mypage-info` → `python3 patch_mypage_info.py supabase/functions/mypage-info/index.ts` → `supabase functions deploy mypage-info --no-verify-jwt`
   戻し方：download した元の index.ts を deploy し直す
2. 画面：naha-project #146・spk-task #301 をマージ（EFの後）
3. AI回答案：`python3 patch_cs_rules_1113.py ~/omni_bot/cs_autoreply.py`（11/10 の facts パッチ済みのもの）→ launchd を再起動
   戻し方：cs_autoreply.py.bak_20261113_flight を戻して再起動
## 確かめ方
- 試験の予約で mypage-info set {flight_in:"JL911"} → 予約の del_flight の行き側だけ変わり、「行き / 帰り」の帰りが残ること
- 陳様の予約に便が入ったら d- タスク作成時に便名が入ること
