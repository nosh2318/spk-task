# 🚨 HANDYMAN 障害履歴・再発防止の正本

## 🔴 車両ランキング 未来予約フィルタ撤去（2026-05-16 / 3店舗統一実装済）

### 背景
TOP > 🏆 車両ランキング タブが「今日より lend_date が未来の予約」を除外する仕様だった
（`if(r.lendDate>todayStr)return false;`）。結果として以下が集計から漏れていた：
- 9月以降の予約（ELD37044 = 井澤様 9/20 等）
- 翌日以降が出発日の予約（今日 5/16 から見て 5/16〜出発の予約）

オーナー指示「9月予約も含めるべき」→ **未来予約フィルタを撤去**。

### 修正内容
```diff
- if(r.lendDate<PERIOD_START+"-01"||r.lendDate>todayStr)return false;
+ if(r.lendDate<PERIOD_START+"-01")return false;
```
PERIOD_START 起点（SPK=2026-02 / NHA=2026-04 / BT=最初の予約月）以降の **全予約**（未来含む）を集計対象に。

### 3店舗統一実装済（コミット）
| 店舗 | バージョン | コミット |
|---|---|---|
| SPK | v4.7.149 / spk-v698 | `5e85ab7` |
| NHA | v3.5.42-NHA / app.js?v=3542 | `28fe328` |
| BT | v1.0.44-BT / app.js?v=1413 | `a9437b5` |

### 検証結果（SPK HP予約・全期間 13件）
| 順位 | クラス | 車両 | ナンバー | 件数 | 売上 |
|---:|:---:|---|:---:|---:|---:|
| 🥇 | F | ソリオ | 8529 | 4件 | ¥33,300 |
| 🥈 | H | アクセラ | 8403 | 3件 | ¥46,950 |
| 🥉 | S | ハリアー | 5512 | 2件 | ¥43,200 |
| 4 | A | ヴェルファイア | 7673 | 1件 | ¥63,250 |
| 5 | C | ロッキー | 299 | 1件 | ¥16,300 |
| 6 | S | CX-5 | 8065 | 1件 | ¥5,650 |
| 7 | C | CX-3 | 4576 | 1件 | ¥5,150 |

**合計: 13件 / ¥213,800** ← APP表示と完全一致

### 教訓
1. **「実績ベース集計」と「未来予約含む」は別概念**: 売上計上は実績のみ（return_date 経過後）だが、車両人気ランキングは予約ベース（lend_date 起点）で未来予約も含めるのが自然
2. **PERIOD_START 起点の集計ロジックは「終点フィルタを設けない」がデフォルト**: 終点フィルタを設ける必要があるのは月別売上計算等の「期間限定集計」のみ
3. **APP表示の集計範囲を質問された時は、まず該当タブのコードを `grep` で直接読みに行く**（オーナーの「自分で確認してよ」指示）

### 修正ファイル
- SPK: `~/spk-task/index.src.html` L17672
- NHA: `~/Desktop/naha-project/index.html.bak` L20720
- BT: `~/buddica-touring/app/index.html.bak` L20514

### 関連: オーナー11件リスト ≠ APP表示13件 の差分
オーナー手動リストには未来2件（NFJ19443 7/24・BZX87787 8/29）が含まれず、APP正しく13件表示。
APP > 手動リスト の場合は **APP が正解**（実績データを完全に網羅している）。

---

## Square端末決済 失敗時の手動起票システム（2026-04-22 NHA完了 / 2026-04-23 SPK完了）
- **DB**: `sq_terminal_failed` テーブル（NHA/SPK共有・プレフィックスなし）
  - カラム: id(PK=Square payment_id) / payment_at / amount / note / item_name / reason / raw_data / resolved / resolved_at / resolved_by / resolved_store / resolved_accounting_id / resolved_memo
  - RLS: `FOR ALL USING (true) WITH CHECK (true)` 許可ポリシー設定済み
- **GAS（那覇店 予約取込 GAS のみ）**:
  - `saveFailedSqPayment_(payment, reason, itemName)`: Supabase INSERT ヘルパー（Code.gs 末尾、SUPABASE_URL/KEY 自己完結）
  - `testSaveFailedSqPayment()`: 動作確認用
  - `cleanupTestSqFailed()`: TEST_* データ一括削除
  - `extractItemName_(orderInfo)`: line_items.name 結合ヘルパー（SquareTerminal.js）
  - SquareTerminal.js の3失敗パスから自動DB記録: ①店舗コード不明 ②科目不明 ③Supabase INSERT失敗
- **APP UI**:
  - TOPに赤バー「Square自動取込失敗」表示（件数・合計金額・タップでモーダル）
  - モーダル: 店舗(NHA/SPK)・科目(立替/予約外売上)・摘要を明示選択して nha_accounting / spk_accounting へ起票
  - 科目はデフォルト値なし。未選択時は起票ボタン無効（赤枠警告）
  - 起票後は sq_terminal_failed.resolved=true で自動クローズ
- **バージョン**: NHA v3.2.66-NHA / SPK v4.6.60

---

## 🔴 GAS detectOtaDelivery_ が「オプション」1行目しか見ていなかった（2026-04-23 NHA v3.2.95-NHA）
- **症状**: OTA予約のデリバリ判定が常に 0 件。GAS が「デリバリー（お届け）」を拾えていない
- **真因**: `extractField_(body, 'オプション')` は `(.+)` で**現在行の続き**しか返さない（multiline flag だが . は改行に非マッチ）。OTAメールのオプションは複数行で:
  ```
  オプション： カーナビx1
  チャイルドシートx1
  デリバリー（お届け）※エリア限定x1   ← ここまで届かない
  デリバリー（回収）※エリア限定x1
  ```
  → optionsStr に「デリバリー」が含まれず、検出が常に false
- **ユーザー指摘**: 「OTAに関しては予約メールのオプションにデリバリーで拾ってないのかと。DEL COL の表記ではない（DEL COLは社内ワード）」
- **修正**:
  - `detectOtaDelivery_` の引数を optionsStr → text に変更（仕様化）
  - 4 OTA パーサー（じゃらん/楽天/skyticket/エアトリ）全てで `body` 全体を渡す
  - 副次: TOPウィジェット `LeadTimeWidget` の判定に snake_case フォールバック (`r.delPlace || r.del_place`)
- **GAS デプロイ**: pbcopy 済み（3556行）→ ユーザーが GAS エディタへ貼付けて保存
- **コミット**: 50e5d32
- **バージョン**: v3.2.94-NHA → v3.2.95-NHA / nha-v95→v96 / sw.js?v=74→75 / app.js?v=3294→3295
- **Lesson**: GAS extractField_ は単行抽出仕様。複数行に渡る情報を検出したい時は、抽出済み文字列に頼らず body 全体を渡してパターン検索する

## 🔴 Supabase ページネーション 重複バグ修正（2026-04-23 NHA v3.2.94-NHA）
- **症状**: D構成分析 OTA別 件数が実数の ~2倍 (4月 246件のはずが503件)。OTA別 デリバリ利用率も全体的におかしい
- **真因①（件数膨張）**: `fetchAllRows`/`loadDbAll` が `range(0,999)→range(1000,1999)→...` でページネーションするのに **ORDER BY 指定なし**。Supabase/PostgREST は order句なしだとページ間で順序が不定になり、行が **重複したり欠損したり** する。1000件超のテーブル（nha_reservations）で発生
- **真因②（TOP判定不発）**: `LeadTimeWidget` (TOPウィジェット) の `isDeliveryRes` が `r.del_place`/`r.col_place`（snake_case）を参照していた。が、`data` は `DB._fromDbRes` を通って camelCase化済み (`delPlace`/`colPlace`) → 全件 false 判定 → 当月デリバリ利用率も誤った値を表示
- **修正**:
  1. `fetchAllRows` に `.order("id",{ascending:true})` 追加 + 最終 id ベース dedup
  2. `loadDbAll` に同様の修正
  3. `LeadTimeWidget` の判定を `r.delPlace`/`r.colPlace` に修正
  4. D構成分析 OTA別 の fallback `"その他"` → `"その他売上"` に統一
- **コミット**: 431038e
- **バージョン**: v3.2.93-NHA → v3.2.94-NHA / nha-v94→v95 / sw.js?v=73→74 / app.js?v=3293→3294
- **残課題（データ）**: 過去のOTA予約は `del_place`/`col_place` が空（GAS の `detectOtaDelivery_` 追加が v3.2.92 = 2026-04-23 のため、それ以前にメール取込された 4月予約のOTA分は判定対象外）。新規取込分から正常に集計される。必要なら過去メールのバックフィル関数を実装する
- **Lesson**: Supabase で1000件超のテーブルを paginate するなら必ず ORDER BY 指定。これがないと「気づきにくい重複」が発生して集計が静かに壊れる

## 🔴 HGU20355 / NUI44639 取り込み失敗障害対応（2026-04-30）
- **症状**: 那覇店HP予約2件 (工藤 祐也様 / 5/7-5/11 / アルファードM + プリウスα) が DB未登録 = 取り込み失敗
- **真因**: 札幌GAS / 那覇GAS 両方の `processNewEmails` の Gmail 検索クエリが `newer_than:2d` だったため、何らかの理由で2日以上空いた予約メールは永久にスキップされる構造的バグ。`processedMsgIds` にも記録されないため一切リカバリされない
- **切り分け過程**:
  1. Supabase直接照会 (curl) → SPK reservations / NHA nha_reservations 両方に不在
  2. ID形式 `[A-Z]{3}\d{5}` = HP予約フォーマット（例: ELD37044, ZDP77030）と判明
  3. 札幌GASに `backfillSpecificReservations` 関数を追加 → 実行 → 2件とも `[Official] Store detected: 那覇` で `Skipping non-Sapporo` 判定（札幌GASは正しい挙動）
  4. 那覇GASにも同等関数追加 → 実行 → 2件とも `success` 取り込み + 自動配車 (ALM02 / PRA02)
- **恒久対策**:
  - **両店GAS** の `processNewEmails` 検索クエリを `newer_than:2d` → **`newer_than:7d`** に拡張
  - **両店GAS** に `backfillSpecificReservations(TARGET_IDS)` 救済関数を追加（30日遡り検索 + dryRun=false 強制取込 + 結果Slack通知）
  - 札幌GAS: `~/spk-task/gas-email-import-v2.gs` (Script ID: `1qz36XX367kzqL4orWMdQ5zl3KsTpQ73onN82k3HzYb7AtfoZsEuDtt6d`)
  - 那覇GAS: `~/Desktop/naha-project/gas/Code.gs` (Script ID: `1Z1Vb6BzZAdzB_ZEvcR66K0h1W8zG-hirGJPLOj7RvubblYyYLPjxuLsX`)
- **残課題（解消済 2026-04-30）**: 那覇GAS `parseOfficial_` が古いバージョン → 札幌GAS版の店舗判定ロジック（【ご利用店舗】抽出 + 本文「那覇店/沖縄店/札幌店」テキスト + 住所県名 fallback）を移植。`_store: ''` 固定 → `_store: hpStore` に変更。`testParseOfficialStoreDetection()` を追加して実メールで動作確認可能
- **Lesson**: `newer_than:Nd` でメール取り込みする GAS は **必ずN日分の余裕を持たせる**（最低7日推奨）。GAS停止・ScriptProperties初期化・コード書き換え中の停止など2日以上空く事象は普通に発生する

## 🔴 走行距離・オイル交換 保存時 通信エラー無音バグ SPK 横展開（2026-04-30 SPK v4.7.45）
- **背景**: NHA v3.3.85-NHA で修正した「catch なし → Safari `Load failed` 無音」バグが SPK 側 `SpkOdometerManager.saveMileage` / `saveOil` (index.src.html L2129/2130) にも残存していたため横展開
- **同型修正**:
  - `const{error}=await sb.from("car_data").insert(...)` で REST エラーを受け取り `dbLog` + `alert("⚠️ 保存失敗...")`
  - `catch(e){...}` で通信エラーを `dbLog("saveMileage/saveOil",false,msg)` + `alert("⚠️ 保存失敗（通信エラー）...")`
  - 成功時 `alert("✅ 走行距離 N,NNN km を保存しました")` で iPhone Safari でも視認可能に
- **対象外（既に catch 済み）**: 同 index.src.html L2298/2299 の旧 var 版 saveMileage/saveOil は `save()` ラッパー (L2277) 経由で `.catch().showMsg(...)` 済み
- **コミット**: `4b99a19`
- **バージョン**: SPK v4.7.44 → v4.7.45 / spk-v597 → spk-v604（CV と CACHE_NAME を同期）/ sw.js?v=522 → 523
- **Lesson 再確認**: async関数で `await fetch` 系を呼ぶ箇所は **必ず catch を付ける**。`{error}` は REST エラー専用、ネットワーク失敗は throw する。Safari は `Load failed` というメッセージで throw するので Safari ユーザーが先に踏みやすい

## 🔴 走行距離・オイル交換 保存時 通信エラー無音バグ修正（2026-04-27 NHA v3.3.85-NHA）
- **症状**: iPhone Safari から距離管理タブで走行距離/オイル交換を入力 → 「保存」ボタンを押しても何も起きない・エラーも出ない。PCで開いている同APPでは右上の `⚠️ DBエラー XX件` バッジが連続発生（fetchStaff/fetchVehicles/fetchAll/nha_fleet/fetchAll/nha_reservations 等が `TypeError: Load failed`）
- **真因**: `OdometerManager` の `saveOdo` / `saveOil` (index.html.bak L5451/L5463) が `try { ... } finally { setSaving(false) }` 構造で **catch ブロックが無かった**。Supabase fetch が `TypeError: Load failed`（Safariのネットワーク失敗）を throw すると await が reject → finally だけ走り、`alert("保存失敗: " + error.message)` は `error` プロパティ経路の場合のみで通信エラー時は通らない → **ユーザーには無音**。「ボタン押した→何も起きない→もう一度押す→未保存のまま離脱」のループに陥っていた
- **背景確認**:
  - Supabase 本体は正常稼働中（`curl https://ckrxttbnawkclshczsia.supabase.co/rest/v1/` で HTTP 401応答, ping 0%loss, 32ms）
  - `sw.js` は 0 bytes（空ファイル）= Service Worker 非アクティブ → キャッシュ問題ではない
  - → 純粋にクライアント側のネットワーク瞬断（iPhoneでWi-Fi/モバイル切替・PCも一時不安定）が原因で fetch 失敗が連発した
- **修正内容**:
  - `saveOdo` / `saveOil` 両方に `catch(e){...}` を追加し、通信エラーを `dbLog("saveOdo",false,msg)` で右上バッジに反映 + `alert("⚠️ 保存失敗（通信エラー）\n\n"+msg+"\n\n• Wi-Fi/モバイル回線を確認\n• ページを再読込\n• それでも改善しなければ管理者に連絡")` でユーザーに表示
  - 成功時にも `dbLog("saveOdo",true,vc+" "+km+"km")` + `alert("✅ 走行距離 XX,XXX km を保存しました")` を表示（iPhoneでも保存完了を必ず認識できるようにする）
  - 同様に error 経路にも `dbLog` を追加して赤バッジに集約
- **コミット**: `41293df`
- **バージョン**: NHA v3.3.84-NHA → v3.3.85-NHA / sw.js?v=154→155 / app.js?v=3384→3385
- **未対応（横展開候補）**: SPK 側の同等関数 `saveMileage` / `saveOil` (index.src.html L5711/L5712) は `showMsg` ベースで catch なしの可能性あり → SPK にも catch + 成功通知を統一すべき
- **Lesson**: async関数で `await fetch` 系を呼ぶ箇所は **必ず catch を付ける**。`{error}` パターンは Supabase が正常応答を返した時のRESTエラーしか拾えない。**ネットワーク自体が失敗した場合は throw されるため catch がないと UI に何も出ない**。iPhone Safari は Chrome と違い `Failed to fetch` でなく `Load failed` というメッセージで throw するので、Safari ユーザーが先に踏みやすい

## 🔴 nha_places キャッシュ同期バグ修正 (2026-05-02 NHA v3.4.31-NHA)

### 症状
GAS や直接DB編集で `nha_reservations.del_place` / `col_place` を空にしても、APP のデータタブ DEL場所 / COL場所 セルが古い値を表示し続ける。Cmd+Shift+R 強制リロードでも消えない。

### 真因（3層キャッシュ問題）
APP の DEL場所セル表示は3段階フォールバック:
```js
表示値 = sheetPlaces[id]              // 最優先 = localStorage.nha_sheet_places
       || nha_places.del_place         // DB別テーブル
       || nha_reservations.del_place   // reservations本体（GAS が更新する）
```

GAS は `nha_reservations` のみ更新するため、上位2層（`nha_places` テーブル + localStorage）が古い値を持っていると永久に上書き表示される。

特に APP 起動時の sheetPlaces 初期化:
```js
// 旧コード（バグ）: merge → DB に無いキーは localStorage に永久残存
setSheetPlaces(prev=>{const merged={...prev,...plDB};...});
```

### 修正
1. **APP `index.html.bak` L17320**: `merge → 置換` に変更
   ```js
   if(plDB){
     setSheetPlaces(plDB);
     try{localStorage.setItem("nha_sheet_places",JSON.stringify(plDB));}catch(e){}
   }
   ```
   → DB の `nha_places` を唯一の真実とする。削除も反映される。

2. **GAS `Code.gs`**: `syncNhaPlaces_(reservationId, changes, currentRow)` ヘルパー追加
   - 両方空 → `nha_places` 行を **DELETE**
   - 片方値あり → `UPSERT`（staff 編集を保護しつつ片方だけクリア）

3. **GAS `backfillHpVisitReturn`**: `del_place`/`col_place` クリア時に自動で `syncNhaPlaces_` 呼出し
4. **空文字判定バグ修正**: `if(changes.del_place)` は '' を見逃す → `if(changes.hasOwnProperty('del_place'))` に変更。ログ表示は「空」と明示

### 実行結果（2026-05-02）
- HP予約 90件中 53件更新成功 / 35件保護で変更不要 / 2件Gmail未検出 / 0件エラー
- 主な補正パターン:
  - 旧バグ残骸（PUB/BDB なのに del_place="那覇空港..."）を10件以上クリア
  - 「沖縄空港」入力ミス（NEC43186/GMT79520）クリア
  - 手動値（PU/BD/来店/返却）11件は完全保護
  - Staff 編集の場所（旭駅前の東横のホテル, ワイズキャビン国際通り, Hotel Sun Queen, サウスゲートホテル, 泊港 北岸船客待合所, サウスゲートホテル沖縄）は片方クリアで維持

### 教訓
- **キャッシュ階層を最初に把握する**: 表示値が複数ソースから決定される場合、最上位レイヤだけ修正しても下位層が見えていないと「直したのに直らない」現象に陥る
- **APP の sheetPlaces 同期方針**: DB を唯一の真実、localStorage は単純ミラー（merge ではなく置換）
- **GAS バックフィルは関連テーブルも同期**: `nha_reservations` だけでなく `nha_places` も並行更新する
- **コミット**: `3d08e8d`（v3.4.31-NHA / sw.js?v=197 / app.js?v=3431 / GAS 5713行）

### 残課題
- 「赤嶺駅」を場所指定する常連客（GMZ24001/IWT94880等）が DEL→来店 に降格された件は、parser の `checkWants_` が「希望する」を見逃した可能性あり。1件メール目視確認推奨

---

## 🔴 2026-05-02 大規模障害・データ汚染 + マスタースプシパトロール導入

### 当日の出来事（時系列）
1. **早朝**: NHA APP 白画面・スピナー固まる障害発生
2. **GitHub Pages 移行** (Vercel `handyman-fleet.vercel.app` が自動bot防御で 403 → GitHub Pages へ)
3. **APP復旧**: app.js を v3.4.34 → v3.4.29 (3b8547a) まで全巻き戻し (3層防御 useEffect が無限ループ)
4. **HP予約 visit_type=来店 誤判定発覚**: parseOfficial_ checkWants_ のスコープが 120文字固定で隣接フィールドの「希望しない」を巻き込んでいた → 80文字 or 次の【まで に修正
5. **OTA予約 種別空白発覚**: inferVisitReturnType_ が del_place ベースのみ → del_flight ベース推論を追加 (※ 後に撤廃)
6. **parseRentacarDC_ 固定値バグ発覚**: `var visitType='来店'; var returnType='返却';` 固定 → CLAUDE.mdルール違反 → 空に修正後、新仕様で PUB/BDB or DEL/COL に
7. **🚨 私の重大ミス**: DB値だけ見て自動推論で 90件以上を勝手に書換え → オーナーから「95%間違っている」「予約メールから判断以外に手段はない」と指摘
8. **155件 visit_type/return_type=NULL ロールバック**
9. **方針確定**: マスター値は **PUB/BDB or DEL/COL のどちらか必ず**、来店/PU/BD/返却 はスタッフ手動のみ
10. **マスタースプシパトロール 実装** (15分間隔・公開URL CSV取得)
11. **全OTAメール再パース機能 実装** (Gmail から再パースで全予約を統一)
12. **Gmail API 1日クォータ超過** で再パース実行不可 → 明日に持ち越し

### 🔴 オーナー確定方針（visit_type / return_type / 場所 / 便名）

#### 値体系（再確認）
| 値 | 意味 | セット経路 |
|---|---|---|
| `PUB` / `BDB` | 空港バス送迎（基本運用） | GAS自動 + 手動 |
| `DEL` / `COL` | デリバリーオプション | GAS自動 + 手動 |
| `PU` / `BD` | ハイエース送迎（バス満員時の例外） | **APP手動入力のみ** |
| `来店` / `返却` | 送迎を希望しない自力来店顧客 | **HPフォーム + OTA「便名なし＋デリバリーなし」で GAS自動許可** + 手動 |

#### 絶対ルール（GAS）
- **マスター値は PUB/BDB / DEL/COL / 来店/返却 のいずれか**。PU/BD はGAS出力禁止。
- **全ては予約メール (Gmail) から判断する**。DB値・便名・場所文字列から推論しない。
- **「来店/返却」は以下の場合 GAS 出力可**（2026-05-02 オーナー再再確定）:
  1. **HPフォーム**で「デリバリー希望しない＋送迎希望しない」が明示選択された場合
  2. **OTA予約（J/R/S/O）でも 送迎なし（便名なし）＋ デリバリーなし** の場合 → 来店/返却
     - 楽天: 「ご利用便名」が「航空便利用なし」「なし」「空」等
     - じゃらん/skyticket/エアトリ: 「到着便」「出発便」が空または「なし」
     - + オプションに「デリバリー（お届け/回収）」記載なし
- 「PU/BD」は **スタッフが APP で手動上書きする値** → GAS は絶対に出力しない。
- 既存値が「PU/BD」 → 手動値として保護対象（バックフィル禁止）。
- 既存値が「来店/返却」→ 手動値 or 上記GAS出力ルールに合致した自動値。バックフィルでは保護対象（上書きしない）。

#### 場所ロジック（del_place / col_place）
| visit_type / return_type | メール場所記載 | 場所欄 |
|---|---|---|
| **DEL / COL** | あり (ホテル名/住所等) | そのまま転記 |
| **DEL / COL** | なし | **「場所未確定」** |
| **PUB / BDB** | あり (**那覇空港 or 赤嶺駅 のみ**) | 那覇空港 or 赤嶺駅 を転記 |
| **PUB / BDB** | なし | 空 (ブランク) |

PUB/BDB で選択可能な場所は **「那覇空港」と「赤嶺駅」の2つだけ**。HP予約はメール本文から `extractShuttlePlace_` で抽出。OTA予約 (J/R/S/O) は送迎場所選択不可 → 空。

#### 便名ロジック（del_flight / col_flight）
- **メール記載をそのまま転記** (cleanFlightNumber_ の正規化はしない方針 / オーナー C案)
- 記載なし → 空

### 🔴 マスタースプシパトロール（2026-05-02 新設）

#### スプレッドシート
- 公開URL: `https://docs.google.com/spreadsheets/d/e/2PACX-1vSBbORCPCGuadh3deGcfP1jFxO4aYJkxUnD5M0SH7Uu6-JCACjAE0Lg2fBdF39LGZvQNXOJ5JElP2ND/pubhtml?gid=914474197&single=true`
- データソース階層:
  - **1次情報 = 予約メール (Gmail)** → GAS processNewEmails (15分) → DB
  - **2次情報 = マスタースプレッドシート** → スタッフが変更/修正のみ更新 → GAS パトロール (15分) → DB上書き
  - APP データタブ → スタッフ手動編集 → DB

#### 列マッピング（1-indexed）
| スプシ列 | 内容 | DB カラム |
|---|---|---|
| C(3) | 時間 | start_time |
| D(4) | 内容 (visit_type) | visit_type |
| H(8) | 場所 | del_place |
| W(23) | 返却時間 | end_time |
| X(24) | 返却種別 | return_type |
| Y(25) | 返却・送迎場所 | col_place |
| AC(29) | 予約番号 | id (照合キー) |

#### 動作
- 公開URL CSV取得 → 予約番号 (AC列) で照合
- 6項目を比較 → 差分があれば **DBをスプシ値で上書き**
- スプシ非空セルのみ反映 (空セルは DB を変更しない)
- キャンセル済みはスキップ
- del_place/col_place 更新時は nha_places も自動同期 (syncNhaPlaces_)

#### GAS関数
- `patrolReservationMaster()`: 本番実行 (15分トリガー)
- `patrolReservationMasterDryRun()`: 確認用 (DB変更なし)
- `setupMasterPatrolTrigger()`: 15分間隔トリガー設定 (1回実行)

### 🔴 全OTAメール再パース（backfillAllOtaVisitReturn）

#### 対象
- 全予約 (HP/J/R/S/O/RC/G) を Gmail から再パース
- visit_type/return_type/del_place/col_place を最新値で上書き
- 既存「来店/PU/BD/返却」 → スタッフ手動値として保護
- 既存 PUB/BDB/DEL/COL/空 → メール再パース値で上書き

#### GAS関数
- `backfillAllOtaVisitReturn()`: 本番実行
- `backfillAllOtaVisitReturnDryRun()`: 確認用
- 6分タイムアウト → 残りは再実行で続きから

### 🔴 GAS パーサー修正サマリ（2026-05-02 / マスター値統一）
| パーサー | 修正内容 |
|---|---|
| parseJalan_ | デリバリーなし → PUB/BDB（旧: 空） |
| parseRakuten_ | 同上 + return_type 追加 |
| parseSkyticket_ | 同上 + return_type 追加 |
| parseAirtrip_ | 同上 + return_type 追加 |
| **parseOfficial_ (HP)** | checkWants_ スコープ修正 + extractShuttlePlace_ 追加 (那覇空港/赤嶺駅) ※「両方とも希望しない」→ 来店/返却 を出力（HPフォームのみ許可・5/2再確定） |
| **parseRentacarDC_** | 固定値「来店/返却」バグ修正 → デリバリー検出ベース PUB/BDB or DEL/COL |
| parseGogoout_ | delPlace 内容で振り分け (那覇空港 → PUB / それ以外 → DEL) |
| parseSlackReservation_ | デフォルト '' → PUB/BDB |

### 🔴 私の今日の重大ミス（再発防止）
- ❌ DB値だけ見て自動推論で 90件以上を勝手に書換えた
- ❌ 元メール (Gmail) を確認せずに判定した
- ❌ 「来店」を勝手に「PUB」に上書きした (手動値保護違反)
- ❌ CLAUDE.md を都度確認しなかった
- ❌ 件数集計サマリーなど頼まれていない情報を出した
- ❌ 「具体的に何が違うか教えて」と何度も質問返した

→ **二度と DB値ベースの自動推論で大量補正しない。元メールが唯一の真実。**

---

## 📋 2026-05-03 朝にやるべきこと（前日5/2終了時点 残タスク）

### ✅ 完了
- HP予約 保険値 33件 自動修正完了（DRY RUN→直接PATCH 2026-05-03 早朝）
- 石黒様 (TBP38418) del_flight `SKY` → `SKY 553` 訂正済
- TOP空車ウィジェット 両店追加（NHA v3.4.45 / SPK v4.7.62）
- **`setupMasterPatrolTrigger` 起動済**（スプシ→DB 15分自動同期 稼働開始）
- 阿部様 (RC12461163411187000) 「免責→フル」訂正済（楽天「免責補償別 1」+「NOC補償 1」両方加入）
- detectInsurance_ #2 fix（楽天形式パターン認識追加）→ GAS反映済
- バックフィル関数 `auditFutureRakutenInsurance_` 追加（Gmailクォータ超過で5/3は未実行）

### 🔴 5/4 朝 持ち越しタスク
**`auditFutureRakutenInsuranceDryRun` 実行**
- 5/3 14:18 に Gmail API 1日クォータ超過で実行不可
- JST 9:00 リセット後に GAS で実行
- 対象: 楽天 未来予約 97件（うち 96件が修正候補、insurance≠フル）
- 期待結果: NOC 52件 / 免責 20件 / なし 24件 のうち真の「フル」を抽出
- DRY RUN → 結果確認 → `auditFutureRakutenInsuranceRun` 本実行

### ❌ 中止: `backfillAllOtaVisitReturn` 実行
**理由**: 1次情報（メール）で2次情報（スプシ編集後の値）を上書きする動作のため。
DRY RUN で 75件中 約20件が「ホテル名 → 場所未確定」となり、
スタッフがスプシで顧客と確認して入れた場所情報を破壊することが判明。

**正しい運用**: スプシパトロール（15分間隔・本日起動済）で継続的に
2次情報を DB に反映する。メールベース一括バックフィルは不要。

### 🔴 データソース階層 絶対ルール（2026-05-03 オーナー確定）
- **1次情報 = 予約メール = 初動登録**（GAS が DB に投入する初期値）
- **2次情報 = マスタースプシ = 編集/変更後の最新値**
- **これが全て**

優先度: 2次情報 > 1次情報。
スプシで編集された値を、メール由来の値で上書きしてはいけない（破壊行為）。
バックフィル系の関数は **2次情報を保護できる設計** でないと実行禁止。

### 🔴 マスタースプシ ↔ DB 同期 正式マッピング（2026-05-03 オーナー確定）

**スプレッドシートで見に行く列**（公開URL CSV取得）:
| スプシ列 | 内容 | DB カラム | 用途 |
|:------:|---|---|---|
| C(3) | 時間 | `start_time` | PUB/DEL 開始時刻 |
| D(4) | 内容 | `visit_type` | PUB/DEL/PU/来店 |
| H(8) | 場所 | `del_place` | お届け場所 / 送迎迎え場所 |
| W(23) | 返却時間 | `end_time` | BDB/COL 終了時刻 |
| X(24) | 返却種別 | `return_type` | BDB/COL/BD/返却 |
| Y(25) | 返却・送迎場所 | `col_place` | 返却場所 |
| AC(29) | 予約番号 | `id` | **照合キー** |

**動作**:
- 定期的（15分間隔）にスプシ公開URL から CSV 取得
- 同一予約番号 (AC列 = id) で DB と照合
- 各項目の最新値をスプシから取って **DB に同じ内容を書く**
- スプシ非空セルのみ反映（空セルは DB を変更しない）
- キャンセル済みはスキップ
- del_place / col_place 更新時は nha_places も自動同期（syncNhaPlaces_）

**実装**: `gas/Code.gs` の `patrolReservationMaster()`
**トリガー**: `setupMasterPatrolTrigger()` で 15分間隔（2026-05-03 起動済み）
**スプシ公開URL**: https://docs.google.com/spreadsheets/d/e/2PACX-1vSBbORCPCGuadh3deGcfP1jFxO4aYJkxUnD5M0SH7Uu6-JCACjAE0Lg2fBdF39LGZvQNXOJ5JElP2ND/pubhtml?gid=914474197&single=true

**列構造変更禁止**: コード側の列インデックス（r[2]/r[3]/r[7]/r[22]/r[23]/r[24]/r[28]）と直結。スプシで列順を入れ替えると同期が壊れる。

### 🔴 Gmail API クォータ消費 絶対禁止ルール（2026-05-03 オーナー確定）
**Gmail を大量検索するバックフィル関数を作らない / 実行しない。**

理由:
- GAS の Gmail API は **1日 ~1500回** で枯渇
- 枯渇すると `processNewEmails`（15分間隔・新規予約取り込み）も **Gmail を使えなくなり停止**
- = レンタカー予約が DB に入らない = サービス停止級の障害

過去の失敗:
- 2026-05-02: `backfillAllOtaVisitReturn` で枯渇
- 2026-05-03 朝: `auditFutureHpReservationsDryRun` (HP 93件) で大量消費
- 2026-05-03 午後: `auditFutureRakutenInsuranceDryRun` (楽天 97件) で **再枯渇**

絶対ルール:
1. Gmail検索を伴うバックフィル関数の **新規作成禁止**
2. 既存の backfill* / audit* 系関数の **実行は1日1関数まで・100件以下**
3. 100件超のバックフィルが必要なら、**メール本文をオーナーが私(Claude)に貼り付け** → 私が判定 → 個別 PATCH で対応
4. 個別予約の修正は Gmail 検索なしで DB 直接 PATCH（オーナーから予約番号指示時のみ）

### 🔴 GAS パーサー出力ルール（2026-05-03 オーナー確定）
**メール解析時に visit_type / return_type は必ず以下のどれかを出力**：
- `PUB` / `BDB` … 空港バス送迎
- `DEL` / `COL` … デリバリーオプション
- `来店` / `返却` … 自力来店（HPフォームで「両方希望しない」明示 + OTA「便名なし＋デリバリーなし」）

**「空」を出してはいけない**。空のまま DB登録するのは GAS バグ。

**対象パーサー**: parseJalan_ / parseRakuten_ / parseSkyticket_ / parseAirtrip_ / parseOfficial_ / parseGogoout_ / parseRentacarDC_ / parseSlackReservation_

**「空」予約のリカバリ**: 既に DB に空のまま登録された予約は、メール再パースで初期値を埋める（2次情報がないので破壊しない＝1次情報の取り直し）。これは「2次情報保護」原則に違反しない。

### 🔴 visit_type / return_type データフロー全体像（2026-05-03 オーナー確定）

```
[STEP 1] 予約メール受信
   ↓ (GAS processNewEmails / 15分間隔)
[STEP 2] パーサーで visit_type/return_type を必ず判定
         必ず PUB/BDB/DEL/COL/来店/返却 のどれかを出力（空禁止）
   ↓
[STEP 3] DB nha_reservations に初動登録 = 1次情報
   ↓
[STEP 4] スタッフがマスタースプシで編集（必要時のみ）
   ↓ (patrolReservationMaster / 15分間隔)
[STEP 5] スプシをパトロール、同一予約番号で変化検知
         変化があれば DB に取得して上書き = 2次情報で更新
```

**両方とも既に稼働中**（NHA Code.gs / 2026-05-03 起動）。
1次情報と2次情報の役割が明確に分離されているので、スプシ編集が GAS 取込で潰されることはない。

### 🟡 業務開始後

### 🟡 業務開始後
```
4. ✅ 5/3 タナカコウスケ3件 → 正常（予約番号が全て別 = 別予約）
   (RC52461076742200585 / RC52461076744080698 / RC52461076745920717)

5. 5/3 visit_type=空 の 6件 を APP データタブで手動入力
   - RC72461099469153407 (コシバミホ R)
   - C260200938 (モチヅキ タカコ O)
   - C260200104 (タクヤ アラカワ O)
   - C260201344 (サクライ エリコ O)
   - C260201160 (シュウヘイ ムラタ O)
   - C260300349 (カバキノ ユカリ O)

6. 配車表で全体確認

7. HP予約バックフィル 残件 手動確認:
   - WJC91615 / QTY73402 (坂本 純一・Gmail未検出 / 予約変更で別IDに紐づきの可能性)
   - MUK30937 (野田 和孝・del_flight DB=JTA51 / メール=ANA1201 / お客様便名変更でスタッフ手動更新の可能性)
```

### 🟢 余裕あれば
```
8. backfillVisitReturnType 実行（場所ベース推論補完）
9. CLAUDE.md 追記漏れチェック
```

### 業務継続性チェック
| 項目 | 状態 |
|---|---|
| 新規予約取込 (15分 GAS) | ✅ 動作中 (新パーサー: PUB/BDB or DEL/COL + 保険判定修正済) |
| じゃらん事前決済自動化 | ✅ 動作中 |
| Square入金確認 | ✅ 動作中 |
| HP予約 保険判定 | ✅ 修正完了 (detectInsurance_ + 便名抽出) |
| スプシ→DB自動同期 | ❌ **トリガー未設定** → setupMasterPatrolTrigger で起動 |
| メール再パース | ⏳ Gmail クォータ復活待ち |

---

## 🔴 R0J7YIGY 古い予約メール再取込→キャンセル予約「再有効化」誤発火（2026-05-02 当日修正）

### 症状
キャンセル済みの予約 R0J7YIGY (じゃらん・キム テムン・2026-07-26〜08-01・Aクラス) が、
今日 5/2 16:57 JST に GAS によって再取込され、ALF11 (アルファード⑪) が再配車されてしまった。
Slack には「✅ 那覇店新規予約取込完了通知」が届いた。

### 真因（3層バグ）
1. **msgId保持期間 (3日) < Gmail検索ウィンドウ (7d)** = 「窓」が3〜7日前に発生
   - 4/29 booking → msgId記録（保持3日）
   - 5/2 起動時に msgId プルーン
   - `newer_than:7d` 検索で 4/29 メールが再ヒット → msgId 未記録 → 再処理
2. **再有効化ロジックが「古いメールの再処理」を区別できない**
   - L410 `if (existing.status === 'cancelled')` → 即 reactivateReservation_
   - 古い予約メール（4/29発信）でも、キャンセル済み行を勝手に復活させていた
3. **Slack通知が「再有効化」と「新規取込」を区別していない**
   - 両方「✅ 取込完了」で通知されるためオーナーが気づきにくい

### 修正
- `THREE_DAYS_MS` (3日) → `MSG_RETENTION_MS` (10日)
  - newer_than:7d より長い保持で、検索ウィンドウ内のメールは確実にスキップされる
- 再有効化分岐に**メール日付ガード**追加
  - `message.getDate() <= existing.created_at + 1分` → 古いメールの再処理 → スキップ
  - 真の再予約（キャンセル後の再取得）は新しい予約メール = 日付が created_at より後 → ガード通過
- `reservationExists_` に `created_at` カラム取得を追加

### DB訂正
- R0J7YIGY: status 'confirmed' → 'cancelled'（誤って復活していた）
- ALF11配車削除（fleet 解放）
- 私の初動ミス: `'canceled'` (US) で1度UPDATE → `'cancelled'` (UK) に再修正
  - GASは `'cancelled'`（UK）を使用。表記揺れ厳禁

### 教訓
- **メールID保持期間 ≥ メール検索範囲 + 余裕** が鉄則。窓ができると古メールが再処理される
- DB の status は **'cancelled'（UK綴り）統一**。'canceled'（US）混入禁止
- 「再有効化」分岐を作る時は、必ず **メール日付 vs DB既存日付** の整合性ガードを入れる

### コミット予定
gas/Code.gs に修正適用済み。GASエディタへの貼り直し+保存で稼働中GASにも反映必要。

---

## 🔴 GASクォータ枯渇障害（2026-05-03）

### 原因
**Payment Bot v1 の `syncPayments` が5分毎に約60回のSquare API呼び出し → 1日17,000回 → 20,000上限を超過**

毎朝16:00（JST）にリセットされるが、4時間で再枯渇していた。

### 実施した対処
1. **syncPayments トリガーを完全削除**（消費90%停止）
2. **Square Webhook を有効化**（ポーリング不要・リアルタイム入金確認）
   - Webhook名: HANDYMAN 入金確認
   - URL: `https://script.google.com/macros/s/AKfycbwTzr2Z_w6H99dQCFqICh7EhYvx5fRErCyN1_qxSIYNo7f7QaRMnMWXzhjNA2Pp5ncA/exec`
   - Event: `payment.updated`
   - Status: Enabled ✅
3. **syncPayments コード最適化**（最大20行・直近30日のみ）← 万が一再設定時のため

### クォータリセット後（翌日16:00 JST）の見込み消費量
- 残存GAS合計: 約1,600回/日（上限20,000の8%）
- 枯渇しない

### 今夜の手動対応
- `reserve@rent-handyman.jp` で新規予約を手動確認
- Square Dashboardで入金状況を手動確認

### 絶対ルール（再発防止）
- **syncPayments は絶対に5分以下に設定しない**（30分以上を厳守）
- **新GASプロジェクトを作る前に必ずクォータ影響を計算する**
- **GASトリガー変更後は必ず実行ログで確認する**（変更が効いたか）

---

## 🔴 2026-05-03 NHA HP予約 保険値・便名 致命バグ修正

### 症状
- 石黒様（TBP38418）の予約データ：
  - メール本文：「免責補償制度(CDW): あり / レンタカー安心パック: なし」「飛行機便名: SKY 553」
  - DB登録値：「insurance: NOC」「del_flight: SKY」 → 完全に誤り

### 真因 ① detectInsurance_ 致命バグ（gas/Code.gs L575-580）
```js
// 旧コード
if (/安心パック|NOC|ノンオペレーション|ノンオペ/i.test(text)) {
  if (/NOC[補償]*[：:\s]*(なし|未加入|無し|加入しない)/i.test(text)) {
    // 空ブロック
  } else {
    return 'NOC';  // ★ 「安心パック」という単語が登場するだけでNOCを返す
  }
}
```
- メール本文「レンタカー安心パック: なし」 → 「安心パック」が含まれる → 即 NOC を返す
- 内側の `NOC: なし` チェックは「NOC」という別表記しか見ていない → 「安心パック なし」を素通り
- → **HP予約全891件中、これに引っかかった可能性のあるレコードが多数**

### 真因 ② parseOfficial_ 便名抽出バグ
```js
// 旧コード
body.match(/【\s*飛行機便名\s*[（(][^）)]*[）)]\s*】\s*\n\s*(\S+)/)
//                                                          ^^^^
// (\S+) は空白で止まる → 「SKY 553」が「SKY」のみで切れる
```

### 修正
両方とも `~/Desktop/naha-project/gas/Code.gs` で修正：
- `detectInsurance_`: 各オプションの「: あり」を明示確認する形に書き換え
- 便名抽出: `(\S+)` → `([^\n]+)` に変更（改行までの全文字取得）
- バックフィル関数 `auditFutureHpReservations_(dryRun)` 追加（未来HP予約のみ対象、手動値保護）

### バックフィル実行結果（2026-05-03 早朝）
- 対象：未来HP予約（start_date >= 2026-05-03）93件
- **修正成功：33件**
- 内訳：
  | 修正パターン | 件数 | 備考 |
  |---|---:|---|
  | 安心パック → NOC | 14件 | 表記統一（NOC=安心パック相当） |
  | CDW → 免責 | 9件 | 表記統一 |
  | なし → 免責 | 7件 | バグ修正 |
  | NOC → 免責 | 3件 | **バグ本命**（補償格下げ） |
- TBP38418 (石黒様)：del_flight `SKY` → `SKY 553`、insurance `NOC` → `免責` 訂正済み
- 残件（手動確認推奨）：
  - Gmail未検出 2件: WJC91615 / QTY73402 (坂本 純一・予約変更で別ID紐づきの可能性)
  - del_flight 不一致 1件: MUK30937 (DB=JTA51 / メール=ANA1201、お客様便名変更でスタッフ手動更新の可能性)

### 教訓
- **正規表現の `(\S+)` は空白で止まる** → 複数語の値を取りたい時は `([^\n]+)` を使う
- **「キーワードが含まれる」だけで判定するな** → 「: あり」「: なし」を明示的に確認する
- **detectInsurance_ のような「優先度判定」関数は、各分岐に明示的な肯定確認が必要**
- 過去データのバックフィルは **未来予約のみ** に絞ると安全（過去予約は会計確定済みで触らない）

---

## 🔴 HP予約 ノアM/セレナM クラス誤判定バグ修正（2026-05-05 NHA gas/Code.gs）

### 症状
JZB48949（平野 斐子様 / 8/21-8/23 / vehicle_name="ノアM"）が **配車されない**。
DB上 `vehicle_class="B"` で登録 → Bクラスは ALM/NOH/SRH/VEL/VOX しかなく「ノアM」車種マッチで配車先が見つからず未配車。

### 真因（parseOfficial_ Tier1辞書バグ）
`gas/Code.gs` L1299 `modelToClass` 辞書に **「ノアM」「セレナM」のエントリ欠落**:
```js
'ノアHクラス': 'B', 'ノアH': 'B', 'ノア': 'B',  // ← 'ノア' 単体マッチが残っていた
// 'ノアM' のエントリなし
```
HP予約「ノアM」→ 長い順ソートでもマッチせず → 'ノア'(B) にフォールバックマッチ → **Bクラス誤判定**。

DBマスター上は **NOM01/NOM02 = D クラス**（コード接頭辞 NOM = ノアM）が正解。

### 修正内容（gas/Code.gs）
1. **`modelToClass` (Tier1)** に追加:
   - `'ノアMクラス': 'D'`, `'ノアM': 'D'`
   - `'セレナMクラス': 'D'`, `'セレナM': 'D'`
2. **`'ノア': 'B'` / `'セレナ': 'B'` 単体マッチを削除**（「ノアM」を取り違える危険）
   - 単体「ノア」「セレナ」だけのHP予約はあり得ない（フォーム選択式）
3. **`classNameToClass` (Tier2)** にも `'ノアMクラス': 'D'`, `'セレナMクラス': 'D'` を追加
4. **`extractModelName_` の classPatterns regex** を `/^(ノア|セレナ|ヴォクシー)Hクラス/` → `/^(ノア|セレナ|ヴォクシー)[HM]クラス/` に拡張
5. **`extractModelName_` の modelMap** に `'ノアM': 'ノアM'`, `'セレナM': 'セレナM'` を追加（長い順ソートで「ノアH」「ノア」より先にマッチ）

### DB復旧（JZB48949）
- `vehicle_class`: B → **D** に修正
- `assigned_vehicle`: '' → **NOM01**
- `nha_fleet` に `{reservation_id:"JZB48949", vehicle_code:"NOM01"}` INSERT
- 同型過去予約（HP予約 + ノアM/セレナM + Dクラス以外）は他に **0件**

### 横展開で確認した類似リスク
- アルファードM (B), アルファードH (A), セレナH (B), ノアH (B) は **既に Tier1 に登録済み**で正常動作
- M系（ガソリン）= Dクラス、H系（ハイブリッド）= Bクラス の対比を辞書で明示化

### GAS反映
- ローカル `~/Desktop/naha-project/gas/Code.gs` 修正済み（6338行）→ pbcopy 済み
- **GASエディタ（Script ID: 1Z1Vb6BzZAdzB_ZEvcR66K0h1W8zG-hirGJPLOj7RvubblYyYLPjxuLsX）への貼付け+保存が必要**

### Lesson
- **HP予約「車種指定」ルールでは、辞書に車種名が無ければ短い接頭辞にfallbackマッチする**。安易な単体マッチ（'ノア','セレナ'）は危険
- DBマスター（vehicle_code 接頭辞）と GAS辞書は **必ず1:1対応** を保つ。 NOM=D / NOH=B / SRM=D / SRH=B 等のクラス対応を辞書に明示する
- 新車種マスター追加時は **GAS パーサー辞書も同時更新する** チェックリスト化が必要

---

## 🔴 車検/半年点検アラート 過去レコード無視バグ（2026-05-06 NHA v3.4.65 / SPK v4.7.79）

### 症状
TOP運用サマリーの「🔴 車検未登録（12ヶ月以内）」「🟡 半年点検未登録（6ヶ月以内）」に
**実施済みの車両もアラートに表示される**。

事例:
- PRA01（プリウスα①）: 車検 2026-04-09〜04-13 実施済 → アラート ❌（誤）
- ALF01（アルファード①）: 車検 2026-02-16〜02-20 実施済 → アラート ❌（誤）

### 真因
NHA `index.html.bak` L5133 / SPK `index.src.html` L1469:
```js
(maintenance||[]).forEach(function(m){
  if(!m.startDate||m.startDate<today2)return;  // ← 過去レコードを完全除外
  if(m.label==="車検"){...nextShaken[m.vehicleCode]=m.startDate;}
});
// アラート: 「未来12ヶ月以内に予定なし」→ アラート
var shakenAlert=(vehicles||[]).filter(v=>!nextShaken[v.code]||nextShaken[v.code]>in12mStr);
```

問題: 過去に実施済みの車検レコードを `today2 < startDate` で除外しているため、
「今月実施完了 → 次回は2年後」の正常パターンも「未登録」と誤判定。

### 修正内容
両店共通:
- `latestShaken[code]` / `latestTenken[code]` を新設（過去含む最新日を保持）
- アラート判定基準を変更:
  - 車検: 直近実施から **24ヶ月超** OR 履歴なし → アラート
  - 半年点検: 直近実施から **6ヶ月超** OR 履歴なし → アラート
- `nextShaken` / `nextTenken` は次回予定日表示用に残す

### 業務ルール（オーナー）
- 車検 = **2年周期**（24ヶ月）
- 半年点検 = **6ヶ月周期**

### コミット
- NHA: `21e1ce8` / v3.4.65-NHA / app.js?v=3465
- SPK: `c356517` / v4.7.79 / spk-v636 / sw.js?v=548

### Lesson
- **「○○以内に登録なし」アラートは「過去履歴」と「未来予定」の両方を見るべき**
- 周期的なメンテ（車検2年・点検半年）は「直近実施から○ヶ月以内」で判定するのが業務実態に合う
- 旧コードのコメント「車検: 稼働中車両で今日〜12ヶ月以内に label=車検 のメンテブロックなし」は仕様自体が間違い

---

## 🔴 月別推移 月合計集計漏れバグ（2026-05-06 NHA v3.4.66 / SPK v4.7.80）

### 症状
車検/点検タブ「📊 月別推移」と整備管理タブ「📅 月別整備費」の **年合計が一致しない**。

事例:
- 月別整備費 2026年: ¥1,329,220
- 月別推移 2026年: ¥1,123,820
- 差額 ¥205,400 = 「その他」項目の年合計

### 真因
`monthCat3` 集計ロジック (NHA L5298 / SPK L1619):
```js
(hmLogs||[]).forEach(function(l){
  var t=l.type||"";
  if(t!=="inspection"&&t!=="semi_annual"&&t!=="repair")return;  // ← オイル/その他を除外
  ...
  monthCat3[ym].total+=amt;  // 3項目のみtotalに加算
});
```

「月合計」表示なのに**車検/半年点検/修理の3項目しか加算されておらず、オイル交換/その他が漏れていた**。

### 修正内容（NHA / SPK 共通）
- 早期return を `t==="repair"` の else if 化に変更
- 全タイプを `total` に加算（表示3列 kensaA/tenkenA/repair はそのまま）
- 結果: 「月合計」が全項目（オイル/その他含む）を反映 → 「月別整備費」と一致

### コミット
- NHA: `9d6a2f5` / v3.4.66-NHA / app.js?v=3466
- SPK: `93153e4` / v4.7.80 / spk-v637 / sw.js?v=549

### Lesson
- **「合計」ラベルが付いた数字は「全項目の合算」がデフォルト期待**
- 部分集計にする場合は「車検+点検+修理 計」のように **明示する必要がある**
- 似た集計が複数画面にある時、両者の年合計が一致しない＝どちらかにバグがある
- オーナー指摘「項目が違っても合算は同じなのでは？」は完全に正論

---

## 🔴 車検切れ車両貸出インシデント 再発防止 Phase 1（2026-05-07 NHA v3.4.67 / SPK v4.7.81）

### 背景（重大インシデント）
車検切れの車両を顧客に貸し出していた事実が発覚。
法令違反（道路運送車両法）+ 任意保険無効化リスク + 信用失墜の三重リスク。

### 既存機能の欠落（根本原因）
| 層 | 既存 | 欠落 |
|---|---|---|
| 表示アラート | ✅ TOPに「🔴車検未登録」あり | - |
| 整備記録 | ✅ 整備管理タブ | - |
| 車検費用 | ✅ shaken_cost あり | - |
| **車検満了日マスター** | ❌ DB に明示的カラムなし | 🚨 |
| **配車禁止ハードガード** | ❌ 表示のみで配車止められない | 🚨 |

→ 「車検履歴から +24ヶ月で推測」では不確実 + 表示しても見落とせば貸出される

### Phase 1 実装内容（2026-05-07 完了）

#### DB追加（両店）
```sql
ALTER TABLE nha_vehicles ADD COLUMN inspection_due_date DATE;
ALTER TABLE nha_vehicles ADD COLUMN inspection_next_date DATE;
ALTER TABLE nha_vehicles ADD COLUMN tenken_due_date DATE;
ALTER TABLE nha_vehicles ADD COLUMN tenken_next_date DATE;
-- SPK vehicles も同様
```

#### UI追加 1: 車両編集モーダルに「🚗 車検/点検」タブ追加
- 6つ目のタブとして追加（基本/保険/コスト/メンテ/整備/**車検点検**）
- 4フィールド入力:
  - 車検満了日（車検証記載・法的期限）
  - 次回車検予定日（業者予約日）
  - 半年点検期限（前回+6ヶ月）
  - 次回半年点検予定日（業者予約日）
- 各フィールドに残日数 + 信号色（🟢60日超/🟡60/🟠30/🔴14/⚫切れ）

#### UI追加 2: 経営管理 > 車検/点検 > 📅 スケジュール冒頭に「📋 全車両 次回予定」
- 全車両（active）を緊急度（残日数最小値）昇順でソート
- 緊急度サマリーバー: 切れ / 14日以内 / 30日以内 / 未登録 件数
- 信号色付きセル表示（編集モーダルで入力した日付を一覧化）

### 実装位置
| 場所 | NHA | SPK |
|---|---|---|
| DB.fetchVehicles マッピング | `index.html.bak` L380 | `index.src.html` L316-318 |
| DB.saveVehicles | L381 | L321 |
| EMPTY 定義 | L3986 | L1139 |
| openEdit setForm | L4024 | L1170 |
| saveVehicle row | L4049 | L1191 |
| タブボタン | L4184 | L1284 |
| inspect タブブロック | L4418〜 | L1414〜 |
| 📋 全車両 次回予定セクション | L4561〜 | L2026〜 |

### バージョン
- NHA: v3.4.67-NHA / app.js?v=3467 / コミット bc45b26
- SPK: v4.7.81 / spk-v639 / sw.js?v=551 / コミット 45b39f4

### 残タスク（Phase 2 以降・未実装）
1. **配車禁止ハードガード**: GAS自動配車 + APP手動配車 で「車検満了日 < 返却日」の車両を配車不可に
2. **既存予約スキャン**: 配車済みで車検切れ予約を一括検出 → Slack通知
3. **多段階リマインダー**: 60/30/14/7日前の段階的Slack通知
4. **整備記録 → 満了日自動更新**: 整備管理で「車検」入力時に DB 自動 +24ヶ月
5. **法令遵守ダッシュボード**: 経営管理タブに常設、毎朝Slack配信

### Lesson
- 「アラート表示」だけでは再発防止にならない。**配車を物理的に止める層が必要**
- データの真実性は「履歴ベース推測」より「明示的なマスター項目」を優先
- 車検証現物 → DBへ正確な日付を入れる運用フロー必須

---

## 🔴 解析タブ稼働率バグ — loadDbAll の pkCol 判定漏れ（2026-05-08 NHA v3.4.82-NHA）

### 症状
TOP稼働率と経営管理 > 解析タブ > A.稼働率 で値が違う:
- TOP: **43% (642/1488日 ・48台)** — 正しい
- 解析: **36% (624/1736日 ・56台)** — 8台多い

### 真因
`index.html.bak` L7152 `loadDbAll` 関数の pkCol 判定で
**`nha_vehicle_monthly_kpi` テーブルが漏れていた**:
```js
const pkCol=(table==="nha_tasks"||table==="tasks")?"_id"
  :(table==="nha_vehicles"||table==="vehicles")?"code"
  :(table==="nha_fleet"||table==="fleet")?"reservation_id"
  :"id";  // ← ここに落ちる
```

`nha_vehicle_monthly_kpi` は **`id` カラムが存在しない**（複合PK: `year_month + vehicle_code`）。
→ `order=id.asc` でクエリエラー: `column ... does not exist`
→ `error` で `break` → `all=[]` → **dbKpi=[] (空)**
→ `inactiveCodes=空Set` → KPI管理表で「稼働させない」と設定された 8台が除外されず → 全56台で計算

### TOPで起きなかった理由
TOPの `LeadTimeWidget` は別経路で `await sb.from("nha_vehicle_monthly_kpi").select("*").eq("year_month",nowYMForKpi)` で取得しており、order なしのため成功。8台 inactive を正しく反映 → 48台。

### 5月「稼働させない」8台
ALF17, ALF18, SRH01, SRH02, HAR01, RIZ/YRC01, RIZ/YRC02, RIZ/YRC03

### 修正
1. **pkCol 判定追加**: `nha_vehicle_monthly_kpi/vehicle_monthly_kpi` → `vehicle_code` でソート
2. **dedup ロジック分岐**: KPIテーブルは `(year_month + "|" + vehicle_code)` 合成キーで重複判定（同一車両の異月レコードを誤って統合しないため）

### コミット / バージョン
- コミット: `cb183d6` (NHA)
- v3.4.81-NHA → v3.4.82-NHA / app.js?v=3481→3482
- sw.js は0バイト（SW非アクティブ）のため変更不要

### Lesson
- **複合PKテーブルを `loadDbAll` で読む時はpkCol判定を必ず追加**。default `"id"` fallback は危険
- **`order(...)` でクエリエラーが起きると静かに空配列が返る**（while loop が break するだけ）→ 集計結果がゼロベースになるまで気付かない
- **同じ KPI を複数経路で取得している場合、片方だけ壊れる**: 比較したい数字が複数画面に出る場合は、必ず同じ取得関数を経由させる設計が安全
- **集計の食い違いは "車両数" "日数" "金額" のうち基礎構成要素を常に明示**: 今回も「48台 vs 56台」で台数差から原因特定できた

### SPK 同型バグ確認結果
SPK の `loadDbAll` (index.src.html L5154) は **order を指定していない単純版** のため、このバグは存在しない。ただし1000件超のテーブルで順序不定によるページ間 dedup ミスのリスクは別途あり（今回の話とは別軸）。

---

## 🔴 OPシート タスク重複表示の根本対応 — 3層防御（2026-05-09 NHA v3.5.13 / SPK v4.7.117）

> ⚠️ **この3層防御は撤去されました**。Layer 2（DB UNIQUE INDEX）が
> 「タスク消失・担当振り分けリセット」障害を引き起こしたため。
> **最終形は本ファイル末尾近くの「🔴 タスク重複対応 最終形（2026-05-09 案D 採用）」を参照**してください。
> 本セクションは経緯の記録として残しています。

### 症状
明日タスク（5/10）OPシートで同一予約・同日に複数の種別が重複表示:
- 野田和孝: PUB と DEL の2行
- カクショウ (RC42461075021905935): COL と BDB の2行
- PTY30026: BDB / 来店 / 返却 の3行

### 真因（APP側のバグ・スプシは無実）
`DB.upsertTasks` が `onConflict:"_id"` ベースで UPSERT していた:
```js
// バグ
await sb.from("nha_tasks").upsert(rows, {onConflict:"_id"});
```
- `_id` はランダム採番（`uid()`）
- タスク再生成のたびに新しい `_id` → 既存と衝突しない → INSERT され続ける
- 同じ予約・同じ日付・同じ種別でも、`_id` が異なれば DB は別行として受け入れる
- 結果: スプシ仕様変更で COL→BDB に書き換わった時、APP が再取込して古い COL を消さずに新 BDB を追加 → 重複が積み重なる

`patrolReservationMaster` GAS は **`nha_reservations` のみ更新**で `nha_tasks` には一切書き込まない。スプシ・GAS側に問題はない。

### 失敗した対症療法（v3.5.10〜v3.5.11、revert済）
- v3.5.10: APP の `sortedTasks` で表示時重複排除 → JSエラー `Identifier 'i' has already been declared` で APP 起動不能
- v3.5.11: localStorage `nha_tasks_*` 起動時クリア → 同じく v3.5.10 同梱で起動不能
- → 緊急 revert (v3.5.12-NHA / v4.7.116)
- 教訓: minified 後の identifier 衝突は予測困難。表示時パッチではなく根本原因に対処すべし

### 根本対応 — 3層防御（v3.5.13 / v4.7.117）

#### Layer 1: 既存重複の物理削除（DB クリーンアップ）
NHA `nha_tasks` から **計20件** の同カテゴリ重複を物理削除:
- 過去分11件: t2990,t2222,t2240(3/20) / t144,t141,t6,t136,t382(5/2) / t154,t5,t7(5/7)
- 未来分9件: t196(5/10),t304(5/10),t206(5/10),t305(5/10),t769(5/11),t767(5/11),t102(5/13),t347(5/17),t111(5/20)
- 削除中に再注入された2件: t876,t877(5/10)
- **SPK は重複0件**で削除不要

優先順位: PUB > DEL > PU > 来店 / BDB > COL > BD > 返却（同優先度なら sort_order 大きい方を残す）。新仕様 (PUB/BDB) を残し旧表記 (COL/返却/来店) を削除。

#### Layer 2: DB UNIQUE INDEX 追加（物理的に書込拒否）
両店の DB に計算列 + UNIQUE INDEX 追加:

```sql
-- NHA
ALTER TABLE nha_tasks ADD COLUMN IF NOT EXISTS task_category TEXT GENERATED ALWAYS AS (
  CASE WHEN "内容" IN ('PUB','DEL','PU','来店') THEN 'L'
       WHEN "内容" IN ('BDB','COL','BD','返却') THEN 'R'
       ELSE NULL END
) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nha_tasks_no_dup
  ON nha_tasks (date, "予約番号", task_category)
  WHERE task_category IS NOT NULL AND "予約番号" IS NOT NULL AND "予約番号" != '';

-- SPK
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_category TEXT GENERATED ALWAYS AS (
  CASE WHEN type IN ('PUB','DEL','PU','来店') THEN 'L'
       WHEN type IN ('BDB','COL','BD','返却') THEN 'R'
       ELSE NULL END
) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_no_dup
  ON tasks (date, reservation_id, task_category)
  WHERE task_category IS NOT NULL AND reservation_id IS NOT NULL AND reservation_id != '';
```

→ **DB レベルで「同一予約・同日・同カテゴリの行は2つ存在不可」が保証された**。何が起きても重複は物理的に書き込まれない。

#### Layer 3: APP `upsertTasks` の修正
DB UNIQUE 制約と整合させるため、保存前に既存同カテゴリ行の `_id` を新タスクに継承:

```js
async upsertTasks(tasks, date) {
  ...
  try {
    const _LEND_T = ["PUB","DEL","PU","来店"];
    const _RET_T = ["BDB","COL","BD","返却"];
    const _getCatU = function(typ){return _LEND_T.indexOf(typ)>=0?"L":_RET_T.indexOf(typ)>=0?"R":null;};
    const _resp = await sb.from("nha_tasks").select("_id,内容,予約番号").eq("date",date);
    const _exMap = new Map();
    (_resp.data||[]).forEach(function(_er){
      const _ec = _getCatU(_er["内容"]);
      const _erid = _er["予約番号"];
      if(_ec && _erid) _exMap.set(_erid+"|"+_ec, _er._id);
    });
    tasks.forEach(function(_tt){
      const _tc = _getCatU(_tt.type);
      if(!_tc || !_tt.reservationId) return;
      const _oldId = _exMap.get(_tt.reservationId+"|"+_tc);
      if(_oldId && _oldId !== _tt._id) _tt._id = _oldId;  // ★ 既存ID継承で UPDATE になる
    });
  } catch(_eUp) { console.warn("[upsertTasks] _id継承スキップ:",_eUp.message); }
  ...
}
```

ポイント:
- 全変数を `_` プレフィックスで unique 化 → minified後の identifier 衝突回避（v3.5.10失敗の教訓）
- 既存 `_id` を継承 → UPSERT が UPDATE 動作になり旧タスクが上書きされる
- DB UNIQUE 制約 と整合 → INSERT エラーも発生しない
- catch で例外を握りつぶす → 万一失敗してもタスク保存自体は続行

NHA L215 / SPK L218 の `upsertTasks` を両方修正。

### 最終確認結果
| 項目 | NHA | SPK |
|---|---|---|
| 全タスク件数 | 446件 | 407件 |
| 同カテゴリ重複 | **0件** ✅ | **0件** ✅ |
| `task_category` 計算列 | 動作中 | 動作中 |
| UNIQUE INDEX | 有効 | 有効 |

### コミット
- NHA cleanup: `7f979a8` (revert v3.5.10/v3.5.11) → `97bf773` (v3.5.13 upsertTasks _id継承)
- SPK: `1876b82` (revert v4.7.114/v4.7.115) → `6285b55` (v4.7.117 upsertTasks _id継承)

### Lesson
1. **`_id` ベースの UPSERT は重複を生む構造的バグ**: ランダム採番のIDは UPSERT のキーに使ってはいけない。業務的なユニークキー (date + 予約番号 + カテゴリ) で UPSERT すべき
2. **対症療法 (表示時排除) より根本原因 (DB制約 + UPSERT ロジック) に対処する**: 表示時パッチは別経路の流入を防げない
3. **JSエラーは minified 後に発生しやすい**: identifier 衝突回避のため、独自関数内のローカル変数は `_` プレフィックスで unique 化
4. **3層防御の有用性**: DB制約 (絶対防御) + UPSERT修正 (アプリ層) + 既存データ削除 (現状リセット) の組み合わせが完成形
5. **疑う前に DB を見る**: 「スプシのバグ」「GASのバグ」と疑う前に DB の実データ・コードフローを追跡すれば真因はすぐ判る。今回も APP 側のロジックの問題だった

### 関連ファイル
- DB: nha_tasks (NHA Supabase) / tasks (SPK Supabase)
- NHA: `~/Desktop/naha-project/index.html.bak` L215 (DB.upsertTasks)
- SPK: `~/spk-task/index.src.html` L218 (DB.upsertTasks)

---

---

## コスト内訳（costmatrix.html）小項目保存バグ修正（2026-05-09）

### 問題
- `init()` が毎回 `saveST()` を呼んで Supabase を localStorage で上書き
- 新しいブラウザ/端末で開くと DEFAULT 構造が Supabase に書き込まれてカスタム小項目が消える

### 修正
- `init()` 内で localStorage が空の場合のみ Supabase から読み込む
- `if(!localStorage.getItem(stKey())){...Supabase読込...}`
- NHA: `~/Desktop/naha-project/costmatrix.html`
- SPK: `~/spk-task/costmatrix.html`

---

## 🔴 タスク重複対応 最終形（2026-05-09 案D 採用）

### 経緯
1. 当初: 「OPシートに同一予約・同日に PUB+DEL 等が重複表示」障害
2. v3.5.10 表示時排除: `'i' identifier 衝突` JSエラー → revert
3. v3.5.13 + DB UNIQUE INDEX: 「タスク消失」障害（担当振り分けリセット） → revert + INDEX撤去
4. **最終: 案D（多層防御 = 表示時排除 + GAS日次クリーンアップ）採用**

### 採用した最終形（v3.5.16-NHA / v4.7.118）
| 層 | 内容 | 状態 |
|---|---|---|
| Layer 1 | APP `sortedTasks` 表示時排除 | コード残存・動作中 |
| Layer 2 | GAS `cleanupDuplicateTasksNha` 日次2:00 JST | 2026-05-09 トリガー有効化 |
| ❌Layer 3（廃止） | DB UNIQUE INDEX | タスク消失原因のため撤去 |
| ❌Layer 4（廃止） | APP `upsertTasks` `_id`継承 | UNIQUE INDEX前提のため撤去 |

### GAS関数（NHA Code.gs L6402-6590）
- `cleanupDuplicateTasksNha()`: 直近30日 + 未来分の同カテゴリ重複を物理削除
- `cleanupDuplicateTasksNhaDryRun()`: dryRun（ログのみ）
- `setupCleanupDupTrigger()`: 毎日 02:00 JST トリガー設定（1回実行で完了）
- 5件以上削除時に Slack 通知
- 優先順: PUB > DEL > PU > 来店 / BDB > COL > BD > 返却（同優先度なら sort_order 大）

### Layer 3/4 を採用しない理由
**DB UNIQUE INDEX + APP `_id`継承の組合せ** で以下の障害が発生：
- 担当振り分け保存時に UNIQUE 違反 → `nha_tasks` INSERT 失敗
- ローカル localStorage は更新されるが DB に保存されない
- リロードでローカル消失 → タスクが消える
- DBエラーバナー右上に表示

→ 業務継続性を優先して全撤去。「重複は表示時排除 + 日次バッチ削除」で実用上問題なし。

### Lesson
1. **DB制約は強力だが副作用も大きい**: UNIQUE INDEX を入れる前に UPSERT 経路全てを検証する
2. **対症療法が現実解になることもある**: 構造的バグでも、業務影響を考慮して「表示時排除＋バッチクリーンアップ」が安全
3. **JS minifier の identifier 衝突は予測困難**: 独自スコープ内のローカル変数は `_` プレフィックス + 業務固有名で完全 unique 化
4. **ローカルキャッシュは罠**: localStorage の `nha_tasks_*` は DB と整合しないことがある。表示重複の真因は実は localStorage キャッシュのことも

### 関連コミット
- `7c77e8d` (v3.5.16-NHA): upsertTasks _id継承を緊急撤去
- `1876b82` (v4.7.118): SPK 同等
- DB UNIQUE INDEX も撤去（DROP INDEX SQL 実行済み）
- GAS `cleanupDuplicateTasksNha` 追加 + トリガー有効化

### 確認方法
- 翌朝 02:00 以降、GAS実行ログ で `[cleanupDup] 重複なし` または削除件数を確認
- OPシートで重複表示されないことを確認
- APP側でタスク追加・担当振り分けが正常動作することを確認

---

## 🔴 2026-05-14 那覇GAS停止＋出勤簿欠損 障害対応

### 障害発生
- 5/13 セキュリティ強化（anonポリシー全削除）の副作用で **那覇GAS（anonキー使用）が DB書込み 401**
- 5/13 18時 〜 5/14 朝 に届いた予約 4件 が DB未登録:
  - ENF96208 (HP / SIAO SHENG YAN / 5/15-5/19 / ヴィッツF) ← 翌日出発の緊急
  - EHA84463 (HP / 西大吾 / 8/5-8/8 / アルファードA)
  - DY00000000964 (skyticket / ホシノユカリ / 8/24-8/27 / B2)
  - R0J7735D (jalan / カブキユウスケ / 8/29-8/31 / A2)

### 復旧手順（実行済み）
1. **4件 curl 直接 INSERT + 自動配車**（authenticated トークン経由）
   - ENF96208 → VTZ03 (ヴィッツ③)
   - EHA84463 → ALF02 (アルファード②)
   - DY00000000964 → VOX03 (ヴォクシー③)
   - R0J7735D → ALF12 (アルファード⑫)

2. **那覇GAS Code.gs を Legacy service_role JWT に切替**
   - 当初 `sb_secret_<REDACTED_FOR_PUBLIC_REPO>`（新形式）→ **GASで「Forbidden use of secret API key in browser」拒否**
   - **Legacy JWT** (`eyJhbGciOiJIUzI1NiIs...role:"service_role"...`) で復旧
   - ScriptProperties `SUPABASE_SERVICE_KEY` 設定 + Code.gs 修正
   - `nha_processed_msg_ids` を `{}` リセットで45スレッド再スキャン

3. **GAS タイムゾーン**: 米国東部時間 → 日本標準時（JST）に変更

### 🔴 重要発見: 新形式 sb_secret_ キーは GAS で使えない
- Supabase の Smart Detection が GAS の UrlFetchApp も「browser-like」と判定
- エラー: `Forbidden use of secret API key in browser`
- **GAS では Legacy JWT形式 (eyJ...) のみ使用可能**
- Supabase Dashboard > Settings > API Keys > **「Legacy anon, service_role API keys」タブ** から取得

### 🔴 派生障害①: 傷チェックAPP 認証化 (v2.7.1-DAMAGE)
- 5/13 RLS強化以降、check_events / vehicle_twins / repair_records 全て 401
- 起動時 自動ログイン（member@g-lines.jp / 8888）追加で復旧
- パターン: NHA/SPK と同じ signInWithPassword 自動 → location.reload
- コード位置: `~/handyman-damage/index.html` L1067-1098

### 🔴 派生障害②: NHA出勤簿 月別データ欠損 (v3.5.33-NHA)
- **真因**: `fetchShifts()` `fetchAttendance()` が `limit=5000` 指定だが Supabase **max-rows=1000 で打ち切り＋ORDER BY なし**
- nha_shifts 全1074件 → APP取得 1000件のみ → **74件欠損**
- 月別欠損: 3月-9, 4月-15, 5月-14, 7月-11, 8月-3, 9月-3, 10月-9, 11月-3, 12月-7
- 「6月以外で打ち込んでも反映されない」「4月分が消えている」現象
- データロスなし（DB全件残存・APP表示のみの問題）
- **修正**: `range(_off,_off+999)` ページネーション + `order=date.asc` でフル取得
- 同じパターン: CLAUDE.md 2026-04-23 で reservations でも発生済み

### 業務継続性チェック結果（5/14 09:00 JST時点）
| GAS / APP | 状態 |
|---|---|
| 那覇予約GAS | ✅ 復旧（Legacy JWT） |
| 札幌予約GAS | ✅ 動作中（2026-04-06 service_role化済み） |
| 問い合わせ管理GAS | ✅ 動作中（最近DB書込み確認） |
| SPK じゃらん決済GAS | ✅ 動作中 |
| 傷チェックAPP | ✅ 復旧（共通アカウント自動ログイン） |
| **NHA出勤簿** | ✅ 復旧（ページネーション化） |
| HANDYMAN Payment | 🟡 5/13 17:03 以降書込みなし → 該当イベントなしの可能性、要確認 |
| SNS自動投稿 | 🟡 4/29 以降書込みなし、要確認 |

### 残課題（業務影響なし）
1. **kintai.html (勤怠確認)** も同じ shifts データ使用 → ページネーション化必要の可能性
   - 「3月齋藤の出勤数→希望休」「公休が出勤日に」「1-3月に数値が入っている」現象
2. **NHA Code.gs 不要関数削除**（テスト/バックフィル系約30個 / プルダウン整理）
3. **HANDYMAN OTA自動登録 GAS** 点検（Cloudflare Worker経由のためDB書込み少だが要確認）

### 再発防止 / 教訓
1. **anonポリシー削除前に全GASを service_role化する** チェックリスト必須
2. **新形式 sb_secret_ は GAS では使用不可** → Legacy JWT のみ
3. **Supabase テーブル取得は必ずページネーション + ORDER BY**
   - `select("*").limit(N)` で N>1000 指定しても 1000で打ち切り
   - ORDER BY なしだとページ間で順序不定 → 重複/欠損
4. **「データ消失」報告は最初に DB を見る** → 多くは APP 表示問題（CLAUDE.md「DB問題は実構造を確認してから」）

### 関連コミット
- NHA app: `8ba750e` (v3.5.33-NHA / fetchShifts ページネーション化)
- handyman-damage: `20dc48f` (v2.7.1-DAMAGE / 認証化)
- 那覇GAS: ローカル `~/Desktop/naha-project/gas/Code.gs` 修正済 (バックアップ `Code.gs.bak.20260514`)

---

---

## 🔴 2026-05-15〜16 NHA OPシート その他タスク追加 → データ消失大障害

### 経緯（時系列）
1. **5/14 v3.5.34** OPシートに「その他タスク」タブ追加（札幌相当 移植）
2. **5/14 v3.5.35** マスター編集画面に「✏️氏名変更」ボタン追加（楽天インバウンド「ーー」対応）
3. **5/15 障害発覚** スタッフから「5/16 タスクが3倍量、担当が消えた」報告
4. **v3.5.36** addOtherTask の `DB.upsertTasks` 引数を `[newTask]` のみに修正
5. **v3.5.37** localStorage タスクキャッシュ自動クリア（フラグで1回限り）
6. **v3.5.38** 担当ありの未定洗車を「時間未定」カウントから除外 → 洗車表示完全消失バグ
7. **v3.5.39** v3.5.38 緊急 revert
8. **5/16 v3.5.40** タスクキャッシュ完全廃止（毎回起動時クリア）
9. **5/16 v3.5.41** upsertTasks 件数ガード追加 + ゴミタスク18件削除

### v3.5.34 真因コード
```js
// 旧（NG）
DB.upsertTasks([...sortedTasks, newTask], selDate);
//             ^^^^^^^^^^^^^ 既存全タスク含めて selDate で upsert
// → DB側で各タスクの date が一律 selDate に上書き
// → 他日タスクが selDate に複製される & 担当列が空で上書き

// 新（OK）
DB.upsertTasks([newTask], selDate);
```

### データ被害（実害）
- **5/16 担当データ約45件分消失**（復元不能・手動再入力必要）
- **18件のゴミタスク発見**:
  - 5/21 に 5/16 タスク 16件 誤コピー（担当空）
  - 5/15 に t277 (BDB 木之瀬・本来5/16・担当=齋藤) 誤コピー
  - 5/16 に t73 (PUB ウエハラ・本来5/17・担当=齋藤) 誤コピー
- 5/15 のタスクが 48件 → 14件に激減

### 修復済み（curl で _id=in.(...) 一括 DELETE）
- ゴミ18件 削除済
- 担当ありの2件は本来日のタスクに担当=齋藤を移行してから削除（CLAUDE.md「ユーザー入力データ絶対保全」遵守）
  - t277 → t109 (5/16 返却 WHB20426) に齋藤移行
  - t73  → t28 (5/17 PUB RC62461161554787226) に齋藤移行

### 3層防御コード（v3.5.41 完成）
1. **v3.5.36**: addOtherTask 引数 `[newTask]` のみ（誤拡散源 即遮断）
2. **v3.5.40**: localStorage タスクキャッシュ完全廃止（汚染データ再注入防止）
3. **v3.5.41 NEW**: `DB.upsertTasks` 入口で件数ガード
   ```js
   if(tasks.length>100){
     console.error('[upsertTasks GUARD] 異常件数 '+tasks.length+' → 拒否');
     alert('⚠️ タスク保存ガード\n件数異常を検出したため保存拒否');
     return;
   }
   ```

### 派生機能
- **v3.5.35** マスター編集画面 「✏️氏名変更」「✏️名」ボタン
  - 楽天インバウンド予約 (氏名カナ「ーー」表記) を手動修正
  - prompt → DB.updateReservationField で nha_reservations.name + nha_tasks.予約者 同期更新

### 5/16 別障害: 「ライブラリ読込中...」で止まる
- 真因: unpkg の Babel CDN (`https://unpkg.com/@babel/standalone/babel.min.js`) が一時的に HTTP 000（タイムアウト）
- 一過性。jsdelivr に切替検討（未実装）

### 「タスクが増減を繰り返し安定しない」「翌日タスク混入」
- 真因: localStorage キャッシュ汚染 + Realtime 接続不安定
- v3.5.40 で localStorage 廃止 → 解消（DBから毎回 fetch）
- 「アクセスできなくなる→戻る」 = Realtime切断の一時表示問題（データロストなし）

### 教訓・絶対ルール追加
1. **「札幌コードを那覇に流用」する時は機械コピペ禁止**
   - DBスキーマ差（テーブル名・カラム名 日本語/英語）
   - state名・関数名差
   - 必ず差分検証 + 動作確認後デプロイ
2. **「バッチupsert系は変更対象のみ渡す」原則を最優先**
   - `[...sortedTasks, newTask]` のような全部渡しは厳禁
   - 単一タスクなら `[newTask]`、N件なら明示的に絞る
3. **大規模変更前に必ず影響範囲をScanしてからEdit**
   - 「sortedTasks に何が含まれているか」を確認せず assume したのが今回の根本原因
4. **件数ベースのガードは万能の最終ライン**
   - 「異常な件数」=「設計上ありえない数」を拒否することで、論理ミスを物理的に阻止
5. **その日のタスクが特定件数を超えるはずがない**
   - NHA: 1日最大50件程度 → 100件超は混入確定 → ガード発動

### 関連コミット
- v3.5.34 (e3f5ced): その他タブ追加（バグ）
- v3.5.35 (492d52d): 氏名変更ボタン
- v3.5.36 (bb105c8): addOtherTask 修正
- v3.5.37 (476abc4): localStorage キャッシュクリア (1回限り)
- v3.5.38 (10e0f1e): 洗車表示バグ
- v3.5.39 (d103da2): revert
- v3.5.40 (61b066b): キャッシュ完全廃止
- v3.5.41 (1deb7bf): 件数ガード + ゴミ削除

### 残課題
- `cleanupDailyNha` (毎日2時) GAS が機能しているか確認
  - 機能していれば 18件の誤コピーは本来 GAS が自動削除で防げた
  - GASエディタの実行ログ確認・必要ならトリガー再設定
- TOPの「時間未定洗車 N件」表示が「対応中」なのか「未対応」なのか分かりにくい問題
  - v3.5.38 で除外しようとして洗車全消失 → revert
  - 設計し直し必要（クリックで展開 / 文言改善 等）

---

## 🔴 TOP Summary 白画面障害（2026-05-21 NHA v3.5.61-NHA）

### 症状
TOP画面の「📊 Summary」見出しをタップ → 展開しようとした瞬間に画面が真っ白。

### 真因（一発特定）
`LeadTimeWidget` (L2354) の props は `{data, vehicles, fleet, maintenance}` のみで **`store` を受け取っていない**。
にもかかわらず L2477 の useEffect 内で:
```js
const key=(store||"nha")+"_"+viewYM;  // ★ store 未定義参照
```
を実行 → `ReferenceError: store is not defined` → React描画ツリー死亡 → 白画面。

### 混入経緯
`60fee59` (v3.5.59) 「②クラス別売上をmonthly_snapshotsから取得（再計算なし・APPと完全一致）」追加時に、
**KpiTab (`function KpiTab({store,data,vehicles,fleet})`) の props 構造を参考に**新規 useEffect を書いた際、
KpiTab には `store` props があるが LeadTimeWidget には無い、という差分を見落とした。

### 修正
```diff
- const key=(store||"nha")+"_"+viewYM;
+ const key="nha_"+viewYM;
- },[utilStats,store,viewYM]);
+ },[utilStats,viewYM]);
```
NHA index.html.bak は NHA 専用なので `"nha"` リテラルで十分（SPK の LeadTimeWidget は別ファイル）。

### SPK 影響なし
SPK index.src.html を grep した結果、`window._kpi_byClass` の**書き込み側 useEffect が存在しない** → v3.5.59 の変更は NHA 単独適用で SPK 無傷。

### 検出が遅れた理由
- Summary は**閉じた状態がデフォルト** (`useState(false)`) → ユーザーが開くまで LeadTimeWidget が描画されない
- v3.5.59 以降の v3.5.60 まで誰も Summary を展開せず気付かなかった
- Summary を開いた瞬間に初めて useEffect 実行 → エラー → 白画面

### コミット / バージョン
- コミット: `f554e51`
- v3.5.45-NHA → **v3.5.61-NHA** / app.js?v=3561

### 教訓（再発防止）
1. **他コンポーネントから useEffect / hooks を移植する時は、必ず props 構造の差分を確認**
   - KpiTab の `{store,...}` を参考にする時、移植先 LeadTimeWidget の props に `store` があるかチェック
   - props にない変数を参照したら ReferenceError 確定
2. **「閉じた状態がデフォルト」のUIに新規ロジックを追加する時は、必ず展開して動作確認**
   - Summary / アコーディオン / モーダル等 → デフォルト非表示の中身にバグが入りやすい
   - デプロイ前に **「開いたところまで」を全て確認する**
3. **ReferenceError は React 描画を完全に止める**
   - try-catch では救えない（useEffect 外の式評価でも死ぬ）
   - エラーバウンダリ未導入の今、未定義参照 1個で全画面白画面
4. **JSXコンポーネントで props 以外の変数を参照する時は二重チェック**
   - props 分割代入になければグローバル / クロージャ依存 → 危険サイン

### 関連コミット
- `60fee59` (v3.5.59): バグ混入
- `9dfa8ef` (v3.5.60): 無関係修正（バグ発覚せず通過）
- `f554e51` (v3.5.61): バグ修正

---

