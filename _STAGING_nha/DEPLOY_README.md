# 那覇マイページ 内部カルテ閲覧 — 成果物と残オーナー手作業（2026-07-08 / omni CLI）

このセッションはサンドボックス制約で **`~/spk-task` 内しか書けず、`supabase` CLI と git も不可**だった。
コード3点は全て作成・実データ検証済み。下記の手作業で本番化できる（実質コピー＆デプロイ＆ビルドのみ）。

## できたもの（検証済み）
1. **Edge Function `handyman-mypage-nha`（lookupのみ・閲覧専用）**
   - 正本: `~/spk-task/line_auto/handyman-mypage-nha/index.ts`
   - デプロイ用コピー: `~/spk-task/supabase/functions/handyman-mypage-nha/index.ts`（同一内容）
   - 那覇の日本語列・受け渡し区分に対応。場所/時間は nha_reservations と nha_tasks の実値ある方を採用（札幌 resolveTask* と同思想）。
   - 実データで列名・解決式を全件検証済（例 d-RC62461196638743544 DEL 赤嶺駅南口 16:00 が正しく解決）。
   - mypage_changes は store/reservation_id 列あり確認済。
2. **お客様ページ（カルテ）`my-nha.html`（standalone・閲覧専用）**
   - 場所: `~/spk-task/_STAGING_nha/my-nha.html` → **`~/Desktop/AI/naha-project/my-nha.html` にコピー**
   - 常に閲覧専用（?ro=1バナー・変更UIなし）。受け渡し分岐：PUB/BDB→バス時刻表(bus.html)リンク / DEL・COL→場所+時間 / 来店・返却→時間のみ / PU・BD→個別=場所+時間。
   - NHA正しい anon キー埋込済（iat 1771878550）。EFエンドポイント= handyman-mypage-nha。
3. **本体 index.html.bak への導線パッチ**
   - 手順書: `~/spk-task/_STAGING_nha/PHASE_C_index.html.bak_patch.md`
   - tokenマップ useEffect 追加 ＋ タスク行(rT)2箇所に🪪カルテ(ro=1)リンク。

## 残オーナー手作業（順に）
### ① EFデプロイ
```
cd ~/spk-task
SUPABASE_ACCESS_TOKEN=$(cat ~/.config/keydrop/sb_token) ~/.local/share/supabase/supabase functions deploy handyman-mypage-nha --project-ref ckrxttbnawkclshczsia --no-verify-jwt
```
（`~/spk-task/supabase/functions/handyman-mypage-nha/` から拾う。sb_token 失効時は https://supabase.com/dashboard/account/tokens で再発行）
検証:
```
curl -s "https://ckrxttbnawkclshczsia.supabase.co/functions/v1/handyman-mypage-nha" \
 -H "apikey: <NHA anon>" -H "Authorization: Bearer <NHA anon>" -H "Content-Type: application/json" \
 --data '{"action":"lookup","token":"57c5abbe-8c7a-4520-a1fd-03e1af3d6e39"}'
```
→ reservation.delivery.place="赤嶺駅南口"、time="16:00" が返れば連動OK。
`--data '{"action":"ping"}'` は `{"ok":true,"warm":true,"store":"nha"}`。

### ② my-nha.html を naha-project へ配置
```
cp ~/spk-task/_STAGING_nha/my-nha.html ~/Desktop/AI/naha-project/my-nha.html
```

### ③ index.html.bak パッチ適用＋ビルド＋push
`PHASE_C_index.html.bak_patch.md` の通り（tokenマップ useEffect＋rT2箇所）。その後:
```
cd ~/Desktop/AI/naha-project
git fetch && git log --oneline -5 && git status   # 並行編集の確認（上に積む）
node build.js
# index.html の BASE_V を+1・index.html.bak の APP_VERSION を+1
node --check app.js
git add index.html.bak index.html app.js my-nha.html
git commit -m "feat(NHA): マイページ内部カルテ閲覧(my-nha.html+handyman-mypage-nha lookup連動)。OP/サマリに🪪カルテ(ro=1)導線"
git push origin main
```
本番確認: `https://nosh2318.github.io/naha-project/my-nha.html?t=57c5abbe-8c7a-4520-a1fd-03e1af3d6e39&ro=1`

## 検証用の実トークン（未キャンセル・実データ）
- DEL/場所あり: `57c5abbe-8c7a-4520-a1fd-03e1af3d6e39`（サクガワ様・DEL赤嶺駅南口16:00 / 回収BDB=バス）
- PUB/バス: `1ee801bc-51c7-4d3e-b678-4be918dafe53`（オオウチ様・PUB→バス表示 / BDB=バス）
- DEL/ホテル: `5d3db425-f6e4-4fd5-ab0e-1a9d6ba51273`（日下部様・DELシークレットハウス牧志 / 返却=店頭返却=時間のみ）

## 範囲外（今回のゴール外・将来）
- 顧客への通知/開示・書込系(update/request/decide/cancel)・my-admin那覇対応・LINE自動送信の那覇配線。
