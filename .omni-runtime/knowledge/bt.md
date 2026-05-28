# 🚐 BUDDICA TOURING 高松 実装詳細

## 🔴 BUDDICA TOURISM 価格戦略 import-prices.html + pricing.html 連携（2026-05-15 確立）

### 構成
| ファイル | 役割 | URL |
|---|---|---|
| `~/buddica-touring/app/pricing.html` | 価格カレンダー本体（pricing.html） | https://buddica-touring.github.io/app/pricing.html |
| `~/buddica-touring/app/import-prices.html` | 価格提案 一括インポート + 履歴管理 | https://buddica-touring.github.io/app/import-prices.html |

### 🔴 致命バグ: ymKey 形式不一致（修正済）
- **pricing.html の `ymKey(y,m)` は `${y}-${m}`（ゼロパディング**なし**）** → `"2026-8"`
- import-prices.html が `"2026-08"`（ゼロパディングあり）で書き込んでいた
- 結果: 8月以降の月別カスタムが見つからず、全月共通価格にフォールバック → 全月で 7月値が表示
- **絶対ルール**: pricing.html の `monthlyTierClassPrices` に書き込むキーは **必ず non-padded** (`"2026-8"`)
  ```js
  const toUnpaddedYm = (ym) => {
    const [y, m] = ym.split('-');
    return y + '-' + parseInt(m, 10);
  };
  ```

### 機能（import-prices.html）
1. **月別5バージョン履歴管理**
   - V1 = 原案（提案資料の値・削除不可・常に1番目）
   - V2-V5 = ユーザー保存スナップショット
   - 採用中バージョン: 緑枠 + ◎採用中 バッジ
   - チップクリックで読込・hoverで × 削除（V1除く）
2. **数字ごとの 💾 保存ボタン**
   - セル編集 → active version と差分発生 → 💾 出現
   - 💾 クリックで pricing.html localStorage に即時保存
   - active version スナップショットも該当セルだけ更新
3. **原案価格 常時表示**
   - 各セル下にうっすら「原案 ¥◯,◯◯◯」
   - 差分時に「↺ 戻す」赤バッジで原案復帰
4. **入力 UX**
   - oninput: 軽量更新（フォーカス保持・DOM再構築なし）
   - onchange: 全体再描画 + フォーカス位置復元
   - **renderAll() を oninput で呼ぶと数字直接入力不可になる**（バグ）

### 機能（pricing.html）
1. **数字ごとの 💾 保存ボタン**（編集時のみ出現）
2. **原案価格 常時表示**（淡いグレー・8.5pt）
3. **保存方式**
   - 旧: blur (onchange) で auto-save
   - 新: 💾 クリック または **Enter キー** で明示保存
   - blur では保存しない（編集途中の誤コミット防止）
4. **共通価格に戻す**: 月別カスタム化されたセルに「↺ 戻す」赤バッジ
5. **savePriceCell(t,c,v)** 統一処理
   - common price と一致 → 月別オーバーライド削除
   - 異なる → state.monthlyTierClassPrices に書込み
   - saveState() + renderCalendar() のみ（matrix再描画なし=フォーカス維持）

### Storage Keys
| Key | 内容 | サイズ |
|---|---|---|
| `bt_takamatsu_seasonal_v6` | pricing.html メインデータ（state全体） | ~10KB |
| `bt_import_history_v1` | 月別5バージョン履歴 | ~50KB |

### データ構造
```js
historyState[ym] = [
  {id:'v1', label:'原案', savedAt:'提案資料', protected:true, A:{}, B:{}, C:{}, special, specialLabel},
  {id:'v2', label:'値上げ案', savedAt:'5/15 19:00', A:{}, B:{}, C:{}, ...},
  ...最大5個
]
activeVersion[ym] = 'v2'  // 現在採用中
```

### 価格提案 2026/7-12月（PROPOSAL定数）
| 月 | B通常 タイプA | A繁忙 タイプA | C閑散 タイプA | 特別期間 |
|:-:|:-:|:-:|:-:|---|
| 7月 | ¥17,000 | ¥25,500（自動係数1.5） | ¥13,600 | ー |
| 8月 | ¥17,500 | **¥22,000**（お盆） | ¥14,000 | お盆 8/12-14 |
| 9月 | ¥17,000 | ¥25,500（自動係数1.5） | ¥13,600 | ー |
| 10月 | ¥17,000 | ¥25,500（自動係数1.5） | ¥13,600 | ー |
| 11月 | ¥16,000 | **¥24,000** | ¥12,800 | 紅葉 |
| 12月 | ¥13,500 | **¥20,000**（年末年始） | ¥10,800 | 年末年始 12/28-1/3 |
| 2027全月 | ¥0 | ¥0 | ¥0 | 全リセット |
| 2026/1-6月 | 触らず | 触らず | 触らず | ー |

### 教訓
1. **localStorage キー形式は書込側と読込側で完全一致必須**: `"2026-8"` ≠ `"2026-08"`
2. **oninput で DOM全体を rebuild するとフォーカス消失** → 数字直接入力不可になる
3. **auto-save (blur) は誤確定の温床**: 明示的 💾 クリック or Enter キーが安全
4. **履歴ベースの状態管理**: V1=原案を不変・最大5バージョン・採用中バージョン明示

### 関連コミット
- `afe64de` ymKey 形式不一致修正（padded→non-padded）
- `1c74fc9` セル単位の保存・原案表示・dirty可視化
- `55e253d` 月別5バージョン履歴管理
- `a42ee4d` 数字直接入力できないバグ修正
- `e220fac` 数字ごと💾保存ボタン復活（履歴と並存）
- `b3329b5` pricing.html にも💾保存ボタン追加
- `570dfe9` no-cache メタタグ追加
- `0e870b6` 原案価格を見やすく強調

---

## 🔴 BUDDICA TOURISM pricing.html 完全 read-only 化（2026-05-16 確立）

### オーナー指示
> 「価格戦略は 価格インポート確認 で設定したものを表示するだけのページにします」
> 「編集不可にしてください。必要情報だけ表示する仕様に」
> 「価格のマスターデータの場所に」
> 「カレンダーが主役」

### 役割分離の確定
| ファイル | 役割 |
|---|---|
| `pricing.html` (価格戦略) | **マスターデータの表示専用ビュアー**（編集不可） |
| `import-prices.html` (価格インポート確認) | **マスターデータの編集 + 5バージョン履歴管理** |

### pricing.html の変更内容
**🚫 削除した編集機能（全部 import-prices.html へ移管）:**
- 価格セル `<input>` → 表示テキスト `<div>`
- クラス名 `<input>` → 表示 `<span>`
- 💾 保存ボタン
- ↺ 戻すボタン
- 📋 この月を全月に適用
- 日付クリック→モーダル編集
- ティア係数/重み/閾値 入力（readOnly + グレー背景）
- exportJSON / importJSON / resetAll ボタン
- `openModal()` 早期return + toast案内のみ

**✅ 残した機能（read-only）:**
- 月/年タブ切替（ナビゲーションのみ）
- カレンダー/方法論タブ切替
- シーズナル判定ロジック表示
- 月別カスタム/共通の視覚区別
- プロパー/AAセグメント切替

**📐 カレンダー主役の再設計:**
| 要素 | 旧 | 新 | 倍率 |
|---|---:|---:|:-:|
| カレンダーセル高さ | 88px | **120px** | ↑36% |
| 日付フォント | 10pt | **12.5pt** | ↑25% |
| ティアバッジ | 8pt | **9pt** | ↑12% |
| イベント文字 | 7.5pt | **8.5pt** | ↑13% |
| 価格行（クラス別） | 7.2pt | **8.5pt 太字 Menlo** | ↑18% |
| 月タイトル | 10.5pt | **13pt** | ↑24% |
| 価格マトリクスセル | 12pt | 10.5pt（コンパクト化） | ↓ |
| container max-width | 1500px | 1700px | ↑ |

**🎨 UI構成（縦並び・上から）:**
1. ヘッダー（タイトル + [📝 編集する] グリーンボタン）
2. 🟡 表示専用バナー +「価格インポート確認」リンク
3. ▼ 💰 価格マトリクス（`<details>` で折りたたみ可・デフォルト展開）
4. [2026年/2027年] [1月〜12月] タブ
5. **📅 カレンダー本体（主役・大きめセル）**

### 絶対ルール
1. **pricing.html に編集機能を戻さない**: 全ての編集権限は import-prices.html
2. **localStorage キーは両者で共有**: `bt_takamatsu_seasonal_v6`
3. **`ymKey` 形式は non-padded で統一**: `"2026-8"`（読込側 pricing.html の仕様）

### 関連コミット
- `5edd46f` 完全 read-only ビュアー化
- `5b439ee` カレンダー主役・全体リサイズ最適化

### 教訓
- **編集と表示のページ分離は明確な役割定義をもたらす**: 1つのページで両方やろうとすると UI 肥大化
- **読み取り専用化は「input → span/div」だけでなく、イベントハンドラも全削除する**: 中途半端な削除は混乱の元
- **`<details>` 要素は補助情報の折りたたみに最適**: ユーザーが必要時に開ける
- **カレンダーは縦長セルで価格＋イベント＋ティアを同時表示するため、高さ120px + フォント大きめが見やすい**

### 未着手（次セッション持ち越し）
- import-prices.html に **日別編集機能** 追加（pricing.html から移管した「日別ティア override + 日別クラス価格 override」UI）
  - スクショ 2026-05-15_20.42.16.png 参照: 日付モーダル形式
  - シーズナルティア選択（A繁忙/B通常/C閑散/自動）
  - クラス別価格個別変更（6クラス × 数値入力 + ↺自動値に戻す）
  - 「保存」「キャンセル」ボタン
- pricing.html カレンダー日付クリックで「import-prices.html?date=YYYY-MM-DD」リンクへ誘導

---

## 🔴 BUDDICA TOURISM 高松空港店 セットアップ作業メモ（2026-05-14）

### 完了した作業（v1.0.0-BT → v1.0.40-BT / damage v2.6.7）
- GitHub Org `buddica-touring` 作成・3リポジトリ push・Pages 公開
- Supabase Auth 5アカウント（oshita/toshima/takeyama/saito/member・4桁パスコード）
- ログイン画面ユーザー名方式化（メール非表示）
- 旧URL → 新Org URL置換（vercel/nosh2318 → buddica-touring.github.io）
- Claude APIキー漏洩除去（buddica-touring/damage + handyman-damage）
- 二重ログイン廃止（旧チームパスワード画面撤去）
- 価格戦略を TOP データ・分析へ移動
- bt_classes を BT仕様7クラス(AA/A/B/C/S/H/F)に再構築
- 価格戦略プロパー → bt_classesと統一(A/B/C/H/S/F)
- 価格戦略 AA見出し「タイプAA」表示
- pricing.html クラス名を bt_classes から動的取得
- マスター・配車表のクラス順序を BT 仕様統一
- inquiry/damage の STAFF_LIST 更新
- 整備管理から NHA固有送迎車(ハイエース・コースター)撤去
- damage スタッフ選択撤去・「チェックする」1ボタン化
- inquiry スタッフ選択撤去・直接受信箱表示
- damage → bt_vehicles (管理APP共通) 参照
- damage クラス定義 → bt_classes 動的取得
- bt_vehicles 不足カラム追加(active/brand/year/equip/ins_price)

### 🔴 全BUDDICA TOURISM標準HTMLファイルに HANDYMAN(NHA) anon key 残骸あり

```
正しいキー ref: ggqugvyskyiblxiycpci（BUDDICA TOURISM）
誤ったキー ref: ckrxttbnawkclshczsia（HANDYMAN/那覇）
```

#### 修正済み
- damage/index.html ✅ v2.6.5
- app/index.html.bak（メインAPP）✅ 元から正常

#### 修正必要（未着手・5/14 14:00時点）
| ファイル | 用途 | 推測される影響 |
|---|---|---|
| **costmatrix.html** | コスト内訳マトリックス | **「数字が保存されない」** ← オーナー指摘済 |
| **monthly.html** | 月次PL/CF | 保存失敗の可能性 |
| **monitor.html** | 監視ダッシュボード | 表示できない可能性 |
| **kintai.html** | 勤怠管理 | 保存失敗の可能性 |
| **pricing.html** | 価格戦略 | localStorage動くがDB保存なし設計・将来問題 |
| **bus.html / license.html / punch.html / seasonal.html** | 各種 | 影響度低 |

### 📌 オーナーからの叱責（再発防止のため明記）
- **「いやーこれほんと勉強しないな」「何回同じこと繰り返してんだ」**
- **同じバグパターン(誤anon key)を別ファイルで発見してその都度1つずつ修正していた**
- **根本原因(全HTML共通の Supabase 設定ミス)に気づくのが遅れた**

### 🔴 教訓・再発防止（同じ過ちを繰り返さない）
1. **新プロジェクトをコピーで作成するときは、最初に全HTMLの SUPA_KEY を一括 grep + 全置換**
   ```bash
   grep -rl "ckrxttbnawkclshczsia" ~/buddica-touring/ | xargs sed -i '' 's|<NHA-anon>|<BT-anon>|g'
   ```
2. **migrate.py に Supabase キー置換を必ず含める**（`~/buddica-touring/_credentials/migrate.py` を要更新）
3. **damage アプリの SUPA_KEY バグで気付いたら、その時点で全ファイル監査する**（今回は怠った）
4. **「保存できない」報告は anon key / RLS / auth セッション の3点セットを真っ先に疑う**
5. **動作確認 = 自分でも操作してみる**（オーナー報告だけに頼らない）

### 🎯 次セッション開始時の最優先タスク
1. **全HTML一括置換**: `costmatrix.html / monthly.html / monitor.html / kintai.html / pricing.html / bus.html / license.html / punch.html / seasonal.html` の SUPA_KEY を BT 正しい anon key に置換
2. **commit & push 一発で全部解決**（個別ファイル修正の繰り返しを終わらせる）
3. **costmatrix.html 保存動作確認**（オーナー指摘の本丸）

### BUDDICA TOURISM 正しい anon key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18
```

### 関連ファイル
- メモ: `~/.claude/projects/-Users-noritakaoshita/memory/project_buddica_touring.md`
- 認証情報: `~/buddica-touring/_credentials/supabase.txt`
- マイグレーションスクリプト: `~/buddica-touring/_credentials/migrate.py`（要更新）

---

## 💳 BUDDICA TOURISM Square API 設定（2026-05-20 / Phase 2 進行中）

### Square 加盟店ステータス
- ✅ Square アカウント開設済み（株式会社 BUDDICA 加盟店）
- ✅ Square Developer Application 作成済み（App名: `BUDDICA TOURISM Payment`）
- ✅ Production Application ID 取得済み
- ✅ Production Access Token 取得済み（GAS ScriptProperties 保管予定・機密）
- ✅ Location ID 取得済み
- ⏳ Webhook 設定 未着手（Phase 3 GAS構築後）

### Square API 識別情報
| 項目 | 値 |
|---|---|
| Square 加盟店アカウント | 株式会社 BUDDICA |
| Developer App 名 | `BUDDICA TOURISM Payment` |
| **Production Application ID** | `sq0idp-nuhBWtbywgSd7DlxUYiNBQ` |
| **Sandbox Application ID** | `sandbox-sq0idb-iRGZeveuGWASo_zrOC...` |
| **Production Access Token** | （機密・GAS ScriptProperties保管予定 `SQUARE_ACCESS_TOKEN`） |
| **Sandbox Access Token** | （テスト用・後で確認） |
| **Production Location ID** | `L4RWQWN579CFW` |
| Location 名 | （株）BUDDICA (Main) |
| MCC | 8999 (Services-Not Elsewhere Classified) |
| **Webhook Signature Key** | （未取得・Phase 3後に設定） |

### ⚠️ MCC コードについて（注意点）
現在の MCC は **8999**（その他サービス業）。レンタカー業の標準MCCは **7512** (Automobile Rental Agency)。
- 業種ミスマッチがあると一部の決済チャネルで制限される可能性あり
- Square加盟店申請時の入力が反映されているため、変更には Square サポートへ申請必要
- 当面は 8999 で運用可能。後日サポートに変更依頼するのが理想

### Square API Token 取得手順（オーナー作業）

#### Step 1: Square Developer Dashboard にアクセス
1. https://developer.squareup.com/apps にアクセス
2. **Square加盟店と同じアカウント** でログイン（自動ログインされる場合あり）

#### Step 2: Application 作成
1. **+ Create your first application**（または **+ Create application**）
2. App Name: `BUDDICA TOURISM Payment` （任意）
3. **Save** → アプリ作成完了

#### Step 3: 取得すべき5つの値
作成したアプリの画面で以下5つをコピー：

| 値 | 場所 | 用途 |
|---|---|---|
| **Application ID** | Credentials タブ | アプリ識別子 |
| **Production Access Token** | Credentials タブ → Production | 本番決済API（`EAAAl...`） |
| **Sandbox Access Token** | Credentials タブ → Sandbox | テスト決済用（任意） |
| **Location ID** | Locations タブ | 店舗ID（高松店） |
| **Webhook Signature Key** | Webhook Subscriptions（後で設定） | Webhook 検証用 |

#### Step 4: Webhook Subscription 作成（GAS構築時に設定）
1. 左メニュー **Webhooks** → **Subscriptions**
2. **Add Subscription**
3. Subscription Name: `Payment Updates`
4. URL: GAS Web App URL（Phase 3 で取得後に設定）
5. Event Types で **`payment.updated`** にチェック
6. **Save** → Signature Key 取得

### 🔴 HANDYMAN 教訓（再発防止）
1. **`syncPayments` ポーリングはクォータ枯渇の原因** → Webhook 推奨（HANDYMAN 2026-05-03 障害）
2. **ポーリングを使うなら 5分以下に絶対設定しない**（30分以上を厳守）
3. **Production / Sandbox Token は別管理**（取り違えると本番決済が動かない）
4. **Access Token は ScriptProperties に保存**（ハードコード禁止）

### Phase 2 残作業
- [ ] Square Developer Dashboard で Application 作成（オーナー作業 5分）
- [ ] **5つの値**（Application ID / Production Access Token / Location ID 等）を共有
- [ ] CLAUDE.md / GAS スクリプトプロパティに登録
- [ ] Webhook Subscription は Phase 3（GAS構築）完了後に設定

---

## 💬 BUDDICA TOURISM Slackチャンネル登録（2026-05-20 / Phase 1 進行中）

### 🔴 重要: 完全独立Workspace
**BUDDICA TOURISM は HANDYMAN とは別の Slack Workspace を使用**
- Workspace: BUDDICA TOURISM 専用（新規・独立）
- Bot Token: 新規取得必須（HANDYMAN Bot Token とは別物）
- HANDYMAN（沖縄/札幌の `gl-oke5175` 等）とは API レベルで完全分離
- 設計思想: Supabase独立 / GitHub Org独立（`buddica-touring`）と同じく **すべて分離**
- 運用主体: BUDDICA 本社（HANDYMAN は Global Lines）

### 5つのチャンネル（GASからの自動通知先）
| 用途 | チャンネル名 | チャンネルID | 主な用途 |
|---|---|---|---|
| 予約通知 | `#reservation_notification` | `C0B4WHEUTJR` | OTAメール取込・新規予約・キャンセル通知 |
| 登録通知 | `#registration_notification` | `C0B4JG4SCTZ` | OTA自動登録（じゃらん/楽天/skyticket/エアトリ/RC）完了通知 |
| 入金通知 | `#payment_notification` | `C0B4ZUVFU90` | Square入金検知・じゃらん事前決済・立替金関連 |
| 運営 | `#operation` | `C0B4THT54DR` | 運営チーム日常やりとり・問い合わせ未対応アラート |
| 開発 | `#development` | `C0B4XSZC678` | デプロイ通知・heartbeat・GASエラー通知 |

### GAS設定時の定数（参考）
```javascript
// 那覇/札幌のチャンネルマッピングを参考に、高松用は以下を使用
var SLACK_CH_RESV    = 'C0B4WHEUTJR';  // 予約通知
var SLACK_CH_REGIST  = 'C0B4JG4SCTZ';  // 登録通知（OTA自動登録）
var SLACK_CH_PAYMENT = 'C0B4ZUVFU90';  // 入金通知
var SLACK_CH_OPS     = 'C0B4THT54DR';  // 運営チーム
var SLACK_CH_DEV     = 'C0B4XSZC678';  // 開発・モニタリング
```

### TODO（Phase 3 GAS構築前に必須）
- [ ] **新規 Slack App 作成**（BUDDICA TOURISM Workspace 内で完全新規）
- [ ] Bot Token 取得（`xoxb-...` 新規取得、HANDYMAN とは別物）
- [ ] Bot Token Scopes 設定（`chat:write` / `files:write` / `chat:write.public` / `reactions:write` / `users:read` / `channels:read` 最低限）
- [ ] 各チャンネルへ Bot ユーザー招待（`/invite @bot_name`）
- [ ] チャンネルメールアドレス取得（GAS から MailApp 送信用フォールバック）
- [ ] Slack App OAuth Redirect URL 設定（Webhook用・必要なら）
- [ ] テスト投稿で疎通確認

### HANDYMAN との対応関係（参考のみ・実体は完全分離）
| HANDYMAN (Workspace: gl-oke5175) | BUDDICA TOURISM高松 (別Workspace) |
|---|---|
| `#okinawa_reservation_notification` (NHA) / `#sapporo_reservation` (SPK) | `#reservation_notification` (TKM) |
| `#payment_naha` (NHA) / `JALAN_PAY_CHANNEL` (SPK) | `#payment_notification` (TKM) |
| `#okinawa_operations-team` | `#operation` (TKM) |
| OTA自動登録通知（HANDYMAN単一チャンネル） | `#registration_notification` (TKM) |
| `#sns_google_運用全般` 等 | `#development` (TKM) ← 開発・運用基盤用 |

→ **Bot Token / API Key は完全別物**。HANDYMAN の Bot Token を BUDDICA TOURISM で使い回し不可

---

## 🚐 BUDDICA TOURISM バス送迎オペレーション廃止（2026-05-20 / v1.0.45-BT）

### 背景・オーナー指示
> 「オペレーションのパターンから バス を削除します。関連を修正して」
> 「基本は全て ハイエース運用 が当面のメイン」
> 「PU BD がハイエースのタスクに変更はなし」

→ 高松店は **空港送迎バス（コースター等）の運用を行わず、ハイエース2台（7062 / 1713）に一本化**。
NHAコピーで構築したため残存していたバス（PUB/BDB）関連コードを全削除。

### 削除した要素
| 種別 | 内容 |
|---|---|
| タスクタイプ | `PUB`(バス空港発) / `BDB`(バスヤード発) を全UI・統計から削除 |
| 関数 | `isBusRequired()` を常に `false` 返却に → バス昇格ロジック完全無効化 |
| 定数 | `BUS_CAPACITY=20` / `BUS_PU_HOURS` / `BUS_BD_HOURS` / `NO_BUS_RE` は後方互換のため残存（参照箇所が到達不能ブロックのみのため動作影響なし） |
| 配車表タブ | `🚌バス` タブ廃止（`hia`タブに統合） |
| サマリー表示 | バス便別乗車人数表 / 便名未登録アラート 削除 |
| 編集メニュー | 「🚌 PUB/BDB(バス)に変更」ボタン削除 |
| TOPナビ | 「🚌 バス運行表」アイコン削除（`onOpenBus` も noop 化） |
| ファイル | `bus.html`（お客様向けシャトルバス時刻表）削除 |
| 場所オプション | NHA固有「ヤードから空港までの無料バス送迎」「赤嶺駅から…」等を全削除し、高松店仕様（**来店 / 高松空港 / DEL / COL** の4択）に再定義 |

### 変更したロジック（重要）
| 箇所 | 変更内容 |
|---|---|
| `loadTasks` (index.html.bak L15889付近) | 旧PUB/BDB データは自動的に `PU`/`BD` に降格して DB に保存（`autoDemoted`カウンター付き） |
| ハイエース運行表 (`hia`タブ) | バス溢れ予約のみ → **PU/BD タスク全件** 表示に拡張。判定: `(type==="PU"||"BD"||"PUB"||"BDB") && !来店系場所` |
| サマリータブ カテゴリ | PUB/BDB カード削除、PU/BD カードを「ハイエース空港送迎」「ハイエースヤード送迎」に改称（旧PUB/BDBデータは PU/BD に統合フィルタ） |
| じゃらん決済バッジ | `(type==="DEL"||PU||PUB)` → `(type==="DEL"||PU)` に簡素化 |

### DB マイグレーション実行済み（curl PATCH）
| テーブル | カラム | 変更件数 |
|---|---|---:|
| `bt_tasks` | `内容` PUB→PU | 19件 |
| `bt_tasks` | `内容` BDB→BD | 18件 |
| `bt_reservations` | `visit_type` PUB→PU | 19件 |
| `bt_reservations` | `return_type` BDB→BD | 19件 |
| **合計** | | **75件** |

### 残存コード（意図的・互換性のため）
以下は **旧データ互換**として残置。動作には影響しない：
- `loadTasks` の旧PUB/BDB → PU/BD 自動降格処理
- `LEND_TYPES = ["PUB","DEL","PU","来店"]` 等、重複削除の優先順位判定で受け入れ
- `monthTasks` の `byDate[d] = {…PUB:0, BDB:0,…}` キー
- `typeStyle()` の PUB/BDB エントリ（PU/BD と同色にフォールバック）
- 到達不能になった `opView==="bus"` ブロック（line 16604-16780付近・将来コード整理で削除可能）

### 教訓（NHAコピーで新店舗を作る時の注意）
1. **NHA固有のオペレーション（バス・赤嶺駅・那覇空港の場所オプション等）が新店舗仕様と一致するかは初期にチェック必須**
2. **空港送迎の運用形態（バス vs ハイエース vs DEL/COL のみ）は各店舗で異なる** → 立ち上げ前に確定すべき要件
3. **`isBusRequired()` のような業務判定関数は「常時false」フォールバックで安全に無効化できる** → 削除よりリスク低
4. **旧データ互換コードは残す** → DBに旧値が残存しても新コードがクラッシュしない設計

### 関連コミット・バージョン
- BT app: **v1.0.45-BT** / BASE_V 1414 / コミット `cb226c6`
- URL: https://buddica-touring.github.io/app/

---

## 🔴 BUDDICA TOURISM 高松空港店 進捗メモ（2026-05-15 続き）

### 本セッション完了項目（2026-05-15）

#### コスト内訳 マスター連動（v1.0.40-BT）
- リース/ローン合計: 各車両ごとに sub 動的生成 + クラス別グルーピング
- 保険: SUM(insurance_annual)
- 車検: SUM(shaken_cost) ÷ 24
- 半年点検: SUM(tenken_cost) ÷ 6
- 自動車税: SUM(car_tax) ÷ 12（s11 税金 sub）
- 🗑️ 完全リセットボタン追加

#### SPK costmatrix にも同仕様適用
- SPK index.src.html に同じマスター連動ロジック移植
- store==='spk' ガード付き（NHA は変更なし）

#### OPシート「📌その他」タブ追加（v1.0.41-BT）
- SPK v4.6.5 完全コピー
- OTHER_TASK_TYPES: DEL/COL/事前駐車/乗捨回収/送迎/入庫/引取/その他 (8種)
- 旧タイプ車検/整備/小タスクは後方互換のみ
- 手動タスク追加・完了チェック・インライン編集・削除
- 種類別グルーピング表示

#### テスト予約 50件投入
- 5月17件 / 6月17件 / 7月16件
- クラス別ばらつき・OTA混在・送迎パターン3種
- 46件配車成功 / 138タスク生成
- source='test_reservation_2026_05_14' で一括削除可能

#### 引き継ぎパッケージ作成
- `~/Desktop/BUDDICA_TOURISM_handover/` フォルダ
- `~/Desktop/BUDDICA_TOURISM_handover_20260514.tar.gz` (4.4MB)
- 内容: README / USER_MANUAL / FEATURES / CREDENTIALS_TEMPLATE / docs/ / source/
- PDF版も生成: 使い方マニュアル / 全機能カタログ / README

#### 連携作業ステップ表（v3・最終版）
- `~/Desktop/BUDDICA_TOURISM_連携作業ステップ表.md` (32KB / 852行)
- `~/Desktop/BUDDICA_TOURISM_連携作業ステップ表.pdf` (3.1MB)
- `~/buddica-touring/docs/INTEGRATION_PLAN.md`
- `~/Desktop/BUDDICA_TOURISM_handover/docs/06_INTEGRATION_PLAN.md`

### 📋 連携作業 Phase 構成

| Phase | 内容 | 時間 | 状態 |
|:-:|---|:-:|:-:|
| 0 | 準備 | — | ✅完了 |
| 1 | Slack整備（Workspace+Bot+5チャンネル） | 1h | 🟡進行中 — チャンネル✅ / Bot Token⏳ (2026-05-20) |
| 2 | Square API（加盟店+API Token） | 2h | 🟢ほぼ完了 — 加盟店✅ / App✅ / Token✅ / Location✅ / Webhook⏳ (2026-05-20) |
| 3 | GAS構築（メール取込・自動配車） | 3-4h | ⏳未着手 |
| 4 | OTA連携（じゃらん/楽天/skyticket/エアトリ/RC/HP） | 5h | ⏳未着手 |
| 4.5 | 支払い管理スプシ（14列・公開URL・CSV取得） | 1h | ⏳未着手 |
| 5 | Slack拡張4機能（領収書/Payment/自動返信/問い合わせ） | 4-5h | ⏳未着手 |
| 5.5 | マスタースケジュールスプシ等 | 1h | ⏳未着手 |
| 5.9 | 細かい連携11項目（Webhook/Realtime/Heartbeat等） | 3-4h | ⏳未着手 |
| 6 | モニタリング・運用基盤 | 2h | ⏳未着手 |
| 7 | お客様接点（LINE/Instagram/Google） | 各2-3h | ⏳任意 |
| **必須計** | | **22-25h** | |

### 🎯 推奨着手順
```
Day1: Phase 1 (Slack) → Phase 2 (Square申請)
Day2: Phase 4.5 (スプシ) → Phase 3 (GAS)
Day3: Phase 4 (OTA 5社)
Day4: Phase 5 (Slack拡張 4Bot)
Day5: Phase 5.5 + 5.9 + 6
本番後: Phase 7
```

### 🔴 Phase 5 重要教訓（HANDYMAN障害から）

#### 問い合わせ管理 EXCLUDE 設定
**❌ NG**:
- `EXCLUDE_SENDERS` に `'noreply'` → HP問い合わせ送信元が除外される
- `EXCLUDE_SUBJECTS` に「キャンセル」 → お客様の正規問い合わせ除外
- OTA通知を SUBJECTS で除外 → SENDERS で除外する

**✅ 正解**:
- `EXCLUDE_SENDERS` = OTA送信元の具体的なアドレス
- `EXCLUDE_SUBJECTS` = システム自動通知のみ

#### Payment Bot syncPayments トリガー
**絶対ルール**: 5分以下に設定しない（30分以上）
理由: GAS Square API 呼び出し1日17,000回 → クォータ枯渇 → 全GAS停止
HANDYMAN 2026-05-03 障害教訓

#### スプシ列構造変更禁止
- `COL` 定数と直結（A〜N の14列固定）
- ステータス文字列: 「⏳ 未払い」「✅ 入金済み」「❌ キャンセル」「⚠️ 発行取消」のみ
- 行物理削除禁止（# 連番がズレる）→ 論理削除（発行取消）

### 関連ファイル
| ファイル | パス |
|---|---|
| 連携作業ステップ表 MD | `~/Desktop/BUDDICA_TOURISM_連携作業ステップ表.md` |
| 連携作業ステップ表 PDF | `~/Desktop/BUDDICA_TOURISM_連携作業ステップ表.pdf` |
| 引き継ぎパッケージ | `~/Desktop/BUDDICA_TOURISM_handover_20260514.tar.gz` |
| 使い方マニュアル PDF | `~/Desktop/BUDDICA_TOURISM_使い方マニュアル.pdf` |
| 全機能カタログ PDF | `~/Desktop/BUDDICA_TOURISM_全機能カタログ.pdf` |
| BTローカルリポジトリ | `~/buddica-touring/app/` |

### 現在の APP_VERSION
- BT管理APP: **v1.0.41-BT**（その他タブ追加・最新）
- BT車両チェック: v2.6.7（クラス定義マスター連動）
- BT問い合わせ: 22cd628（スタッフ選択撤去）

### bt_classes（7クラス・確定）
| ID | 名前 | sort_order |
|:-:|---|:-:|
| AA | ハイエンド車両 | 1 |
| A | 高級系MV | 2 |
| B | 一般MV | 3 |
| C | コンパクトSUV | 4 |
| S | SUV | 5 |
| H | セダン | 6 |
| F | コンパクト | 7 |

### bt_vehicles 状態
- 25台登録済（AA=5, A=6, B=4, C=4, F=3, H=3）
- ロッキー299 (RKY) は lease_monthly=0 → SPK 側で要入力
- アクティブ全台

---

## 💰 import-prices.html マスター化（2026-05-16）

### アーキテクチャ確定
- **`import-prices.html`** = 全データのマスター（価格 + シーズナルtier設定）
- **`pricing.html`** = 鏡（読み取り専用・import-prices.htmlが書いたデータを表示するだけ）
- 両者は同じ `STORAGE_KEY = 'bt_takamatsu_seasonal_v6'` を共有

### import-prices.html 実装済み機能
1. **プロパー/CP タブ**: 同じ価格データを両セグメントに同時反映
2. **カレンダービュー**: pricing.htmlと完全同仕様
   - 全6クラス（A/B/C/H/S/F）表示
   - 2カラムgrid・白半透明背景・紺文字・monospace
   - tier カラー: A=赤(#fee2e2)/B=黄(#fef3c7)/C=青(#dbeafe)
   - tier バッジ: A=#991b1b / B=#92400e / C=#1e40af
   - 価格: ¥17,000 形式（k省略なし・toLocaleString()）
3. **日付クリック tier上書きモーダル**
   - A/B/C選択 → localStorage即保存 → pricing.htmlに自動反映
   - 手動設定日: ✎マーク + 緑色価格 + 紫枠（.has-ov）
4. **masterState管理**: loadMasterState/saveMasterState で STORAGE_KEY共有

### doImport/applyActive/saveCellNow
- プロパー と CP 両方のセグメントに同時書き込み
- `state.segments.proper.monthlyTierClassPrices` + `state.segments.cp.monthlyTierClassPrices`

### ファイル
- `~/buddica-touring/app/import-prices.html`
- `~/buddica-touring/app/pricing.html`（鏡・read-only・黄色バナー表示済み）

---

