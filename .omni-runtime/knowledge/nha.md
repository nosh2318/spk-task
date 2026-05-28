# 🏝 NHA 那覇 実装詳細

## 会計UI改善（2026-04-23 NHA v3.2.79-NHA）
- **問題**: 会計の「予約外」タブの編集（鉛筆マーク）を押しても反応しなかった（立替タブは動作OK）
- **真因**: クリックハンドラのバグではなく、**インラインフォームがテーブル下に開く** → Square自動エントリが多い予約外タブではフォームが画面外に出て見えなかった（立替は件数が少なくフォームが見えた）
- **修正**:
  - インラインフォーム → モーダルオーバーレイ化（`position:fixed;inset:0;background:rgba(15,23,42,.55);zIndex:9000`）
  - 科目フォールバック: 既存値がプリセットにない場合（例: Square自動の「予約外売上」）自動的にテキスト入力に切替
  - 入力者・支払方法・スタッフ名のselectでも保持値を維持
- **コミット**: c566a05

## 予約物理削除機能（2026-04-23 NHA v3.2.80-NHA）
- **要件**: データタブ・配車表から予約を物理削除できるようにする（既存のソフトCXLとは別の新機能）
- **App.deleteReservation**:
  - `DB.deleteReservations([id])` で nha_reservations 物理削除
  - `DB.deleteFleetOne(id)` で nha_fleet 削除
  - 関連タスク（lendDate/returnDate/dOff(lendDate,-1) の3日分）削除
  - ローカル state 即時更新（data, fleet）
- **データタブ**:
  - 1列目を 44→64px に拡張、sticky offset も併せて更新（44→64, 74→94）
  - CXL/復元 ボタンの下に **削除** ボタン（濃赤 `#7f1d1d`）を縦並び追加
  - キャンセル済み予約からも削除可能
- **配車表**:
  - 予約バーtooltipに **キャンセル**（赤系・ソフト）と **削除**（濃赤・物理）を追加
  - 旧「※キャンセル処理はデータタブから行えます」の注記を置換
- **二重確認**: `window.confirm`（詳細表示）→ `window.prompt`（"削除"文字入力必須）
- **コミット**: 505d459

## 解析タブ UX改善（2026-04-23 NHA v3.2.81-NHA）
- **問題**: 経営管理→解析タブを開くとA/B/C/Dの4セクションが全展開で縦に長すぎて操作しづらい
- **修正**: `secOpen` 初期値を `{A:true,B:true,C:true,D:true}` → `{A:false,B:false,C:false,D:false}` に変更
- **対象セクション**:
  - A. 稼働率
  - B. 予約・売上
  - C. リードタイム・予約パターン
  - D. 構成分析
- **動作**: タブを開くとサマリー（稼働率・売上・件数・1台あたり売上）と期間フィルタのみ表示。各セクションは手動で「開く」をタップ
- **場所**: `ManagementTab` コンポーネント index.html.bak 5200行目
- **コミット**: dd7337f

## 会計 集計タブ 再設計（2026-04-23 NHA v3.2.82-NHA）
- **問題**: 会計→集計タブが情報過多で使いづらい・見づらい
- **要望**: 「各支出項目の合計が整理され表示されるのを希望」
- **再設計方針**: 支出項目別合計表を画面の主役に据え、それ以外は折り畳み格納
- **上段サマリ（常時表示）**:
  - 3枚のKPIカード（売上/支出/純収支）
  - 4項目サブサマリ: 現金入金 / 現金出金 / 現金残高 / 立替(未回収)
- **中段（主役・常時表示）**: 💸 支出項目別 合計表
  - 科目 / 現金 / カード / 立替 / 合計 / 件数 / 構成比
  - Top3 にランクバッジ（🥇🥈🥉）と黄色帯（#fffbeb）
  - 構成比にプログレスバー、最終行に総合計（濃紺 #1e293b 反転）
  - 上部に支払方法別チップ（現金出金/カード支払い/個人立替）
- **折り畳み格納（既定は閉）**:
  - 📈 月別推移（年次のみ）
  - 💰 収入 科目別 合計
  - ⏰ 未回収・未精算
- **state追加**: `sumOpen={monthly,expense,income,unpaid,extra}` + `toggleSum`
- **場所**: `AccountingPanel` index.html.bak 1103/1374/1553 行
- **コミット**: cd72df4

## ダッシュボード 年間推移 追加（2026-04-23 NHA v3.2.84-NHA）
- **要望**: 経営管理→ダッシュボードに年間推移を追加。月別データは現在表示中のダッシュボードKPIと同一ロジックで計算
- **実装**: `dashYearly` useMemo で `dashYm` の年（1〜12月）を月毎に再計算
- **state追加**: `dashYearlyExtra`（YYYY-MM→予約外売上合計）を `nha_accounting`/`spk_accounting` から年一括取得
- **UI**: チャネル別構成の下に「📈 年間推移 (YYYY年)」テーブル
  - 列: 月 / 売上計上 / 予約外 / 合計売上 / 入金CF / 件数 / 客単価 / 平均泊数 / 泊単価 / 稼働率 / 売上バーチャート
  - 稼働率は信号色バッジ（70%以上=緑, 40%以上=黄, 未満=赤）
  - 選択中月は青背景ハイライト、月セルクリックで `setDashYm(ym)`
  - 年計の合計行（濃紺反転）
- **場所**: `ManagementTab` index.html.bak 5813/6415 行付近
- **コミット**: b08185c

## ダッシュボード チャネル別構成 月/年トグル（2026-04-23 NHA v3.2.85-NHA）
- **要望**: チャネル別構成にも年間推移を作る。月/年でページ切替がベスト
- **実装**:
  - state追加: `dashChView` ("month" | "year")
  - トグル: [月][年] ボタン（チャネル別構成ヘッダー右側）
  - 月ビュー: 既存の単月バーチャート（変更なし）
  - 年ビュー: チャネル × 1〜12月のマトリクス表（年計・構成比・選択月ハイライト・固定左端列）
  - `dashYearly.yearByCh = {channel:{1:rev,2:rev,...,total:rev}}` を同時計算
- **同時修正**: 年間推移KPIテーブルから「入金CF」列を削除（不要）
- **コミット**: e47ad91

## ダッシュボード 順序入替＋SPKへ同仕様適用（2026-04-23 NHA v3.2.86-NHA / SPK v4.6.72）
- **要望**: チャネル別構成を下段・年間推移を2段目に配置。完了後SPKも同仕様に
- **新ブロック順序**: KPIカード → 📈 年間推移 → チャネル別構成（月/年トグル）
- **NHA**: index.html.bak の該当ブロックを入替 → v3.2.86-NHA / sw nha-v87 / ?v=66 / app.js?v=3286 / コミット 4d2ed40
- **SPK**: index.src.html に以下を移植
  - `dashChView` state + `dashYearlyExtra` useState + `dashYearly` useMemo（yearByCh込み）
  - ダッシュボードレンダリング部を「年間推移→チャネル別（月/年トグル）」に入替
  - バージョン: v4.6.71 → v4.6.72 / sw spk-v532 → spk-v533
  - コミット: b993d82（index.html/app.js/sw.jsのみ先行、メッセージ誤記）+ 58e8642（index.src.html/index2.html補完）
  - 両コミットをまとめたい場合は今後まとめる

## デリバリ利用率 SPK非表示（2026-04-23 NHA v3.2.91-NHA / SPK v4.6.77）
- **理由**: SPKは100%固定で表示する意味がない（ユーザー指摘）
- **実装**: D構成分析セクション内のデリバリ利用率カードを `!isSpk &&` で条件レンダリング
- **副作用整理**: 内部の `if(isSpk)return true;` 分岐を削除して NHA 専用ロジックに簡素化
- **コミット**: f10a0bf (NHA), 7f99b2f (SPK)

## デリバリ利用率 判定ロジック確定（2026-04-23 NHA v3.2.90-NHA / SPK v4.6.76）
- **ユーザー方針**:
  - 判定基準は **「予約メールから解読する」に絞る**
  - 「那覇空港受け渡し」は指定不可なのでカウントしない（=デリバリではない）
  - 札幌は100%固定で良い（むしろ非表示でも可）
- **最終ロジック**:
  ```js
  const NON_DELIVERY_PLACE=/(那覇空港|空港|来店|店舗|店頭|ヤード|営業所|HANDYMAN)/;
  const isDeliveryPlace=(p)=>{const s=String(p||"").trim();return s&&!NON_DELIVERY_PLACE.test(s);};
  const isDeliveryRes=(r)=>{
    if(isSpk)return true;
    return isDeliveryPlace(r.del_place)||isDeliveryPlace(r.col_place);
  };
  ```
- **既知の制約（GAS拡張で解決予定）**:
  - GASの OTAパーサー（じゃらん/楽天/skyticket/エアトリ）は **全部 `del_place: ''` 固定**でデリバリ場所を抽出していない（Code.gs L594/648/696/748）
  - GoGoOut（G）/ HPフォーム / Slack入力 のみ del_place 抽出済み
  - → 現状はOTA予約が全部「通常」扱いとなり過小カウント
  - **Step2**: GAS の各OTAパーサーに「お届け○○/デリバリーサービス/送迎」等のパターン抽出を追加して del_place に格納する必要あり
- **コミット**: 69adfe5 (NHA), b42057c (SPK)
- **Lesson**: 集計UIの裏側のデータパス全体を最初に把握する。GASがフィールドを埋めているか確認せず、APP側だけで判定ロジックを書くと、データソース欠損が見えない誤算につながる

## デリバリ利用率 判定ロジック改善（2026-04-23 NHA v3.2.89-NHA / SPK v4.6.75）
- **ユーザー指摘**: 「4月のデリバリ利用率43.1%は高すぎる」「1予約に DEL または COL のどちらか/両方が入っていればデリバリ利用」「メールから解析すべき」「札幌は100%になるはず」
- **真因**: 初版（v3.2.87）の `del_place&&trim()` フォールバックが OTAインポート時の「那覇空港」自動入力を拾い、PU/BD予約まで誤検知
- **最終ロジック**:
  ```js
  const NON_DELIVERY_PLACE=/(那覇空港|空港|来店|店舗|店頭|ヤード|営業所|HANDYMAN)/;
  const isRealDelPlace=(p)=>{const s=String(p||"").trim();return s&&!NON_DELIVERY_PLACE.test(s);};
  const isDeliveryRes=(r)=>{
    if(isSpk)return true;  // 札幌=デリバリー専門→100%
    const vt=(r.visit_type||"").toUpperCase();
    const rt=(r.return_type||"").toUpperCase();
    if(vt.includes("DEL")||vt==="L"||vt.includes("配達"))return true;
    if(rt.includes("COL")||rt.includes("回収"))return true;
    if(isRealDelPlace(r.del_place))return true;  // メール由来の救済
    if(isRealDelPlace(r.col_place))return true;
    return false;
  };
  ```
- **修正経緯**: v3.2.87(初版) → v3.2.88(visit_type only) → v3.2.89(visit_type+return_type+メール由来 del/col_place、空港/店舗除外)
- **コミット**: 2afbf7a (NHA), 5333581 (SPK)
- **Lesson**: 似た既存ロジック（line 5540 のNHA isDel）が canonical な場合は最初からそれに揃える。新規判定ロジックを推測で追加するな

## TOP LeadTimeWidget 売上表示を最適化（2026-04-24 NHA v3.3.1-NHA / SPK v4.6.79 同時適用）
- **要望**: 「売上を正確にg表示させて。 基本料金＋付帯＝合計＋予約外 あと情報量が多いので既存のデザイン（アイコンスタイル）に合わせて修正 最適化してください 那覇も一緒に」
- **Before**: TOP黄色カードに「予約売上¥XX.X万 ＋ 予約外¥X.X万 ＝ 合計¥XX.X万」が大きく3段横並びで、基本料金/付帯の内訳が見えなかった
- **After**: 既存アイコンスタイル（`予約率 60%` `稼働率 44%`）と同じ「ラベル＋大きな数値＋小さな補足」パターンに統一
  - 見出し: `💰 売上 ¥XX.X万`（大きな緑、合計＋予約外の grand total）
  - 補足グレー: `基本¥XX.X万＋付帯¥X.X万＝合計¥XX.X万 ＋予約外¥X.X万`
- **数式定義**（方程式が厳密に閉じる）:
  - `基本料金 = Σ((bp>0||op>0) ? base_price : price) − Σ discount` （旧レコードで bp/op 両方0なら price を基本料金扱い。discount は基本料金側から控除）
  - `付帯 = Σ option_price`
  - `合計 = 基本料金 + 付帯 = 既存の totalRevenue`（一致）
  - `総計 = 合計 + 予約外`
- **NHA 修正箇所 (`index.html.bak` LeadTimeWidget)**:
  - L2300 付近 `totalRevenue` 再計算 forEach ループ内で `totalBase/totalOption/totalDiscount` を同時集計
  - L2312 付近 utilStats return に `totalBase, totalOption` 追加
  - L2382-2393 表示ブロック書換
- **SPK 修正箇所 (`index.src.html` LeadTimeWidget)**: 同等の修正（utilStats useMemo / return / display）
- **バージョン**:
  - NHA: v3.3.0-NHA → v3.3.1-NHA / nha-v101→v102 / sw.js?v=80→81 / app.js?v=3300→3301
  - SPK: v4.6.78 → v4.6.79 / spk-v539 → spk-v540 / CV=spk-v532→spk-v540 / sw.js?v=460→461

## 当月デリバリ利用率 TOPサマリー追加（2026-04-23 NHA v3.2.93-NHA）
- **要望**: スクショで指示された TOP の黄色サマリーカード（4月 返却 / 当月予約率 / 稼働率 / RevPACD / 売上 / 台あたり）に「当月デリバリ利用率」を追加
- **実装**: `LeadTimeWidget` (index.html.bak L2202〜) の `stats` useMemo に `tmDelCnt`/`tmDelPct` を追加。判定は D構成分析と同じ NON_DELIVERY_PLACE 正規表現
  ```js
  const NON_DELIVERY_PLACE=/(那覇空港|空港|来店|店舗|店頭|ヤード|営業所|HANDYMAN)/;
  const isDeliveryPlace=(p)=>{const s=String(p||"").trim();return s&&!NON_DELIVERY_PLACE.test(s);};
  const isDeliveryRes=(r)=>isDeliveryPlace(r.del_place)||isDeliveryPlace(r.col_place);
  const tmDelCnt=tmRet.filter(isDeliveryRes).length;
  ```
- **UI**: 稼働率 / RevPACD の右隣に「デリバリ利用率 NN% (X/Y件)」を紫(#7c3aed)で追加
- **副次拡張**: `byOta` レコードに `delCnt`/`delPct` も同梱（後続でOTA別表示に拡張可）
- **コミット**: 7cd9cda
- **バージョン**: v3.2.92-NHA → v3.2.93-NHA / nha-v93→v94 / sw.js?v=72→73 / app.js?v=3292→3293
- **データソース連動**: del_place/col_place は v3.2.92 で追加した GAS の `detectOtaDelivery_` がOTAメール「オプション」欄を読んで埋める。過去予約は空のまま（必要なら別途バックフィル）

## デリバリ利用率 OTA別展開 + GASでOTAメールのデリバリOP抽出（2026-04-23 NHA v3.2.92-NHA）
- **要望**: デリバリ利用率を「① 全体（グロス）」「② OTA別」の2パターンで表示 + OTA予約メールからデリバリーオプションを抽出して del_place/col_place に反映
- **APP（index.html.bak D構成分析）**:
  - デリバリ利用率カードを ①全体（既存の3KPI+比較表） / ②OTA別テーブル に分割
  - OTA別列: OTA / 全件数 / デリバリ件数 / デリバリ利用率 / デリバリ売上 / 売上構成比 / 横棒
  - 利用率シグナル色: 50%以上=緑 / 20%以上=橙 / 未満=灰
  - 合計行（濃紺反転）
- **GAS（Code.gs）**:
  - `detectOtaDelivery_(optionsStr)` ヘルパー追加（Parsersセクション冒頭 L530付近）
    - 正規表現: `/デリバリー\s*[（(]\s*お届け\s*[）)]/` と `/デリバリー\s*[（(]\s*回収\s*[）)]/`
    - 全角・半角括弧両対応、スペース許容
    - 戻り値: `{has_del, has_col}`
  - 定数: `var OTA_DELIVERY_PLACEHOLDER = '★OTAデリバリー希望（場所未確定）';`
  - 4パーサーで適用: parseJalan_ / parseRakuten_ / parseSkyticket_ / parseAirtrip_
  - 各パーサーでオプション欄文字列から検出し、検出時に:
    - `del_place: '★OTAデリバリー希望（場所未確定）'`
    - `col_place: '★OTAデリバリー希望（場所未確定）'`
    - `visit_type: 'DEL'`
  - APP側 isDeliveryPlace は「那覇空港|空港|来店|店舗|店頭|ヤード|営業所|HANDYMAN」以外の非空文字列を delivery と判定するので、プレースホルダ文字列がそのまま拾われる
- **4 OTA サンプルメール検証済みパターン**:
  - じゃらん: `オプション： カーナビx1 ... デリバリー（お届け）※エリア限定x1 デリバリー（回収）※エリア限定x1`
  - 楽天: `・オプション/車両の特徴　：...デリバリー（お届け）※エリア限定 1 / デリバリー（回収）※エリア限定 1`
  - skyticket: `- オプション：...デリバリー（お届け） ※エリア限定×1 = 1,500円、デリバリー（回収） ※エリア限定×1 = 1,500円`
  - エアトリ（2パターン）:
    - DPプラン: `オプション：ジュニアシート x 1, デリバリー（お届け）※エリア限定 x 1, デリバリー（回収）※エリア限定 x 1`
    - 通常プラン: `オプション：デリバリー（お届け）※エリア限定、デリバリー（回収）※エリア限定`
- **GAS ID**: `1Z1Vb6BzZAdzB_ZEvcR66K0h1W8zG-hirGJPLOj7RvubblYyYLPjxuLsX`
- **GAS URL**: https://script.google.com/home/projects/1Z1Vb6BzZAdzB_ZEvcR66K0h1W8zG-hirGJPLOj7RvubblYyYLPjxuLsX/edit
- **GAS 名**: 那覇店 予約取込
- **コミット**: 6475b9c
- **バージョン**: v3.2.91-NHA → v3.2.92-NHA / nha-v92→v93 / ?v=71→72 / app.js?v=3291→3292
- **SPK**: `!isSpk&&` でカード自体を非表示のため SPK 側は対応不要（ユーザ指示「札幌は不要/100なので」）
- **注意**: 既存のOTA予約レコードは del_place が空のまま（GAS改修前に取込済み）。新規取込分から正常に判定される。過去分は必要なら SQL で visit_type='DEL', del_place/col_place='★OTAデリバリー希望（場所未確定）' をバックフィル

## デリバリ利用率 解析タブD構成分析に追加（2026-04-23 NHA v3.2.87-NHA / SPK v4.6.73）
- **要望**: 両店 デリバリ利用率を「D（解析タブ→D構成分析）」に追加。総予約数からデリバリーが関連する予約を抽出。通常予約 vs デリバリー予約の構図
- **判定ロジック**（store-agnostic 統一）:
  ```js
  const isDeliveryRes=(r)=>{
    const vt=(r.visit_type||"").toUpperCase();
    if(vt.includes("DEL")||vt==="L"||vt.includes("配達"))return true;
    const rt=(r.return_type||"").toUpperCase();
    if(rt.includes("COL")||rt.includes("回収"))return true;
    if(r.del_place&&String(r.del_place).trim())return true;
    if(r.col_place&&String(r.col_place).trim())return true;
    return false;
  };
  ```
- **UI構成**（D構成分析の最上段に配置）:
  - KPIカード3枚: デリバリ利用率 / 通常予約率 / デリバリ売上構成比
  - 比較表: 区分・件数・件数比・売上・客単価・横棒グラフ（緑=デリバリー / 青=通常）
  - 合計行（濃紺反転）
- **NHA**: index.html.bak L7802付近に挿入 / コミット 836c7f3 + ce3a033（app.js再ビルド）
- **SPK**: index.src.html L5386付近に挿入 / コミット a064b3c
- **障害メモ**: `node build.js` を絶対パス指定で実行すると CWD が変わらず別ディレクトリの index.html.bak を読みに行ってしまう（NHAでは存在しないと思われたが、実は別の場所にあるものを読んでいた可能性）。**必ず `cd <project-dir> && node build.js` の形で実行すること**。または明示的に `cwd` を指定する。

## バージョン管理 NHA APP デプロイ手順（再確認）
- **3箇所同時更新必須**:
  1. `index.html.bak` 末尾の `APP_VERSION="vX.Y.Z-NHA"`
  2. `sw.js` の `CACHE_NAME = 'nha-vN'`
  3. `index.html` の `?v=N`（sw.js）と `?v=NNNN`（app.js）
- **ビルド**: **`cd ~/Desktop/naha-project && node build.js`**（絶対パス起動だとCWD不一致でビルド対象を取り違える）
- **デプロイ**: git commit & push main → Vercel 自動デプロイ

## 解析タブ・ダッシュボード 月/年表示統一（2026-04-24 NHA v3.3.0-NHA / SPK v4.6.82）
- **要望**: 「両店ともに A〜D まで 月別 で表示されるデータを 年別 で表示が正解では？部分的に相違があります。全てにおいて月別年別で追うべきです。月別で見る数字と年別で見る数字が異なるのはおかしい。全て統一およびルール化してください」
- **確立したルール**:
  - ダッシュボードはヘッダーに月/年トグルを置き、全KPI/3分解/チャネル構成がそのトグルに連動
  - 解析タブは各セクションに月/年トグルがあり、A/B/C/D 全てで月・年両対応
  - 年値は基本的に Σ(月値)。ただし **加重平均例外**: 稼働率 = Σ稼働日数/Σ最大稼働日数、客単価 = Σ売上/Σ件数、平均泊数 = Σ泊数/Σ件数、泊単価 = Σ売上/Σ泊数
- **実装の主要ポイント**:
  - `dashPeriod` state ("month"|"year") と `dashKpi` useMemo で派生KPIを一元化
  - `dashYearly.yearByCh` に `cnt` フィールドを追加（チャネル別件数を年集計するため）
  - `mAgg` / `yearAgg` の初期化・集計に `base/opt/disc` + `otaBase/otaOpt/otaDisc` を追加（3分解を月・年・OTA別で使えるように）
  - 解析タブB年モードに「月別テーブル 3分解列＋合計行」「OTA別年間内訳テーブル」を新設
  - 解析タブA年モードに「年車両別 年間稼働率・売上テーブル（合計行付き）」を新設
  - 解析タブC年モードに「年サマリーカード」と月別テーブル合計行を追加
- **SPK特殊**: デリバリ利用率カードは `!isSpk&&` で非表示のまま維持（SPKは100%固定）
- **ハマった点（NHAで発生・SPKで回避）**:
  - B年モードに新sectionCardを複数追加する際、「車種別 台あたり売上」sectionCard を年divの外に出してしまい `),` で構文エラー → `,` に修正
  - 教訓: 新規sectionCardは既存sectionCardの **前** に挿入し、最後の新sectionCardから既存sectionCardへは comma 1つだけで繋ぐ。build.js のJSX行番号 = ファイル行番号 - 84
- **コミット**: NHA `d0285c2` / SPK `2cc52d1`
- **バージョン**: NHA v3.3.0-NHA (nha-v101 / ?v=80 / app.js?v=3300) / SPK v4.6.82 (spk-v543 / ?v=464)

---

## ダッシュボード 売上3分解 → 4分解（予約外追加）（2026-04-24 NHA v3.3.6-NHA / SPK v4.6.86）
- **要望**: ダッシュボードの「💰 売上3分解」カードに「予約外」を追加して 4分解 にしたい
- **修正**:
  - 4分解 = 基本料金 + 付帯売上 + 予約外 - 割引 = 合計売上
  - 予約外カード追加（紫 #7c3aed / 背景 #faf5ff / 枠 #e9d5ff）
  - 構成比の分母 gross = base + opt + extra（予約外も実効売上として含む）
  - 「売上計上額」→「合計売上」に改名、式表示も「基本+付帯+予約外-割引」に更新
  - グリッドの minWidth 170 → 160px に微調整（5カードでも auto-fit で並ぶ）
- **データソース**: `dashKpi.extraRev`（既存。dashboard useMemo で月/年共に対応済み）
- **対象**: ダッシュボードのみ。解析タブ B（月モード/年モード）の 売上3分解カードは未着手（mAgg/yearAgg に extra フィールドがないため別途対応が必要）
- **コミット**: NHA `e55d0a2` / SPK `5659729`
- **バージョン**: NHA v3.3.6-NHA (nha-v107 / sw.js?v=86 / app.js?v=3306) / SPK v4.6.86 (spk-v547 / sw.js?v=468)

---

## 解析タブ 売上3分解 → 4分解 全体統一（2026-04-24 NHA v3.3.7-NHA / SPK v4.6.87）
- **要望**: 「全て統一してください」(両店の解析タブ B も売上4分解にする。月別と年別で計算式が完全一致する状態を担保)
- **修正対象**: 解析タブ B（月モード/年モード）両方の「💰 売上3分解」カード
- **データレイヤ**:
  - `extraByM` state を ManagementTab 上部に追加（`dbStore` 切替で nha_accounting / spk_accounting を選択して `type='extra_sales'` を全期間ロード、じゃらん事前決済除外）
  - `mAgg[ym].extra` フィールドを追加。reliable.forEach 完了後に `Object.keys(mAgg).forEach(ym=>{mAgg[ym].extra=extraByM[ym]||0;})` でマージ
  - reliable に予約データが無い月でも extra があれば mAgg に新規エントリ（`if(ym<RELIABLE_FROM)return` でガード）→ ymList に取りこぼしなし
  - `yearAgg[yr].extra` フィールドを追加し `ya.extra+=(m.extra||0)` で加算
- **UIレイヤ**: 月モード/年モード両方の sectionCard を JSX 同形に書換
  - 5カード grid (minWidth 160px): 基本料金 / 付帯売上 / **予約外（紫 #7c3aed / 背景 #faf5ff）** / 割引 / 合計売上（濃紺反転）
  - タイトル「💰 売上3分解（XXX）」→「💰 売上4分解（XXX）」
  - 副題「売上 = 基本料金 + 付帯売上 - 割引」→「売上 = 基本料金 + 付帯売上 + 予約外 - 割引」
  - 合計セルの値: m.rev → m.rev+extra （= total）
  - 構成比 gross = base + opt + extra（予約外を分母に含めることでダッシュボード4分解と完全一致）
- **整合性**: ダッシュボード（v3.3.6/v4.6.86）の 4分解 と同じ計算式・同じ色・同じ並び順 → どの画面で見ても 4分解 の数字が一致する
- **構文上の注意**: 解析タブ B は React.createElement 記法（JSX ではない）。dashboard はネイティブ JSX。同じ4分解でも記法が異なるので両方コピペできない
- **コミット**: NHA `8eee7d1` / SPK `7866a34`
- **バージョン**:
  - NHA v3.3.7-NHA (nha-v108 / sw.js?v=87 / app.js?v=3307)
  - SPK v4.6.87 (spk-v548 / CV=spk-v548 / sw.js?v=469)
- **未着手の関連項目**: 「月別予約・売上（3分解）」テーブル（年モード末尾）はまだ列名が「3分解」のまま。次回もし統一するなら base/opt/extra/disc/合計 の5列構成に再設計する必要あり

---

## RELIABLE_FROM 統一: 2026-04 → 2026-01（2026-04-24 NHA v3.3.5-NHA / SPK v4.6.84）
- **要望**: 「解析の年別ですが起算はいつからですか？全ての起算月を出してください。データがしっかりとある月からのはず」「月別/年別で数字が異なるのは正常ではない」「返却が終わっていれば起算は可能」
- **データ調査結果**（Supabase 直接照会、price/3分解/OTA 完備率）:
  - NHA: 2025-05〜2026-06 の全月で 100%／95-100%／100% の完備
  - SPK: 2026-01〜2026-07 の全月で 100% 完備（最古は 2026-01、これより前は存在しない）
- **判定基準のミス（反省）**: 当初 2026-03 を提案したが、これはNHAが 282件と跳ねた最初の月をボリューム基準で選んでいた。オーナー指摘「なぜ 2026/1 じゃない？」を受けて訂正:
  - 正しい基準は **「データ完備＋返却確定」** で「ボリューム」ではない
  - 2026-01: NHA 187件 100%完備 / SPK 14件 100%完備 → 両店共通の最古完備月
- **修正箇所**:
  - NHA `index.html.bak`: L2043（KpiTab）/ L7552（解析タブ）の2箇所
  - SPK `index.src.html`: L4999（解析タブ）/ L6205（KpiTab）/ L6370（LeadTimeWidget）の3箇所
- **副次**: 同セッションで TOP `LeadTimeWidget` UI を 2カラムレイアウト（左:売上ヒーロー / 右:KPIリスト）に再設計（NHA v3.3.5）
- **コミット**: NHA `75ff514` / SPK `bd1cc07`
- **バージョン**:
  - NHA v3.3.5-NHA (nha-v106 / sw.js?v=85 / app.js?v=3305)
  - SPK v4.6.84 (spk-v546 / CV=spk-v546 / sw.js?v=467)
- **Lesson**: データ起算月を決めるとき「ボリュームの跳ね」を基準にするな。「完備＋確定」で最古を選ぶ。両店共通基準にできるなら共通化する

---

## 次タスク候補（2026-04-25 再開時点・未着手）
最終コミット（NHA f53fe31 / SPK d357870）後のTODO:

1. **Priority 4/5 の GAS 手動実行**（コードは実装済み・GASエディタ手動実行のみ）
   - `auditAllJalanOverbilling()` (gas-email-import-v2.gs L2928) — 全じゃらん予約を `price ≠ base+opt-disc` でスキャンし、jalan_payments と照合して「実害あり／DB不整合のみ」に分類、Slack `#jalan_payment` に報告
   - `setupWatchdogTrigger()` (gas-email-import-v2.gs L1815) — `watchdogJalanPayment` を毎時トリガー化（1回実行で設定完了）

2. **OTA自動登録GAS クラス誤判定の要注意リスト確認**（2026-04-23 DY00000000944 修正の波及確認）
   - 目視確認推奨の skyticket(S)/airtrip(O) 予約: DY00000000939 / DY00000000942 / DY00000000938 / KUI82098 / DY00000000930
   - 元メール本文で `プラン名` / `車両タイプ / クラス` を照合

3. **画像→解析方式の検証マトリクス継続**（現在 16パターン中 9パターン画像取得完了 = 56.25%）
   - 残り7パターン（コンパクト系旧スクリプト未検証分）
   - PDF照合は1パターンのみ完了 → マトリクス全完了で `market_top20_v3.py` として汎用化

4. **デリバリ利用率 バックフィル**（OTA旧予約 del_place 空欄対処）
   - GAS `detectOtaDelivery_` 追加が v3.2.92 (2026-04-23) のため、それ以前取込のOTA予約は `del_place`/`col_place` が空
   - 必要なら SQL で `visit_type='DEL', del_place/col_place='★OTAデリバリー希望（場所未確定）'` をバックフィル

5. **HANDYMAN Payment GAS 残件**（軽微・業務影響なし）
   - GAD40403 / PEB11304 / R0R8QVZR は Supabase会計に行が存在しない（過去の起票失敗残骸）
   - APP上で「済」表示になっているなら業務影響なし

---

## 🔐 NHA セキュリティ強化（2026-05-13 完了 / v3.5.31-NHA）

### 背景
2026-05 連続障害「勝手にキャンセル」「担当消失」「GoGoOut売上計上漏れ」を受け、
APP「URL知ってる人なら誰でもアクセス可」だった脆弱性を塞ぐ作業を実施。

### 完了内容
1. **APP コード: ログイン必須化**
   - 紺グラデ ログイン画面 (`linear-gradient(135deg,#1e3a8a,#1e40af)`)
   - `signInWithPassword()` → ログイン後 `location.reload()` で APP 全体に反映
   - `sb` クライアントは**同期作成**（APP useEffect が null 参照しないように）
   - `signInAnonymously()` を完全廃止
   - 仕様書 Phase 4 相当

2. **Supabase Auth ユーザー 6名作成**（Admin API 経由）

   | 用途 | Email | Password |
   |---|---|---|
   | オーナー | oshita@g-lines.jp | nosh2318 |
   | 井江さん | ie@g-lines.jp | 1111 |
   | 齋藤さん | saito@g-lines.jp | 2222 |
   | 廣瀬さん | hirose@g-lines.jp | 3333 |
   | 竹山さん | takeyama@g-lines.jp | 5555 |
   | アルバイト共用 | member@g-lines.jp | 8888 |

3. **RLS authenticated ポリシー追加（55テーブル）**
   - SQL: `CREATE POLICY "auth_full_access" ... FOR ALL TO authenticated USING (true) WITH CHECK (true)`
   - anon 用既存ポリシーは**触らず** → 札幌APP無影響

### 真因と教訓（重要）

#### 🔴 ハマったポイント
旧来の RLS ポリシーは **anon ロール限定**で設定されていた。
ログイン制を導入すると JWT が anon → authenticated にロール切替 → RLS で**空配列が返る**現象。
症状: ログインは成功するが、タスクサマリー・本日スケジュール等が**全部空**。

#### 検証方法（次回の同型バグ調査用）
```bash
# 1. anon キーで curl → データ取れる
curl "https://<proj>.supabase.co/rest/v1/<table>?limit=2" -H "apikey: <anon>"

# 2. ログイン後の access_token で curl
ACCESS=$(curl -s -X POST "https://<proj>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <anon>" -d '{"email":"...","password":"..."}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl "https://<proj>.supabase.co/rest/v1/<table>?limit=2" \
  -H "apikey: <anon>" -H "Authorization: Bearer $ACCESS"

# 結果が [] なら → authenticated用ポリシー欠落 → 追加SQL実行
```

#### 修正用 SQL（authenticated 用ポリシー一括追加・冪等）
```sql
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "auth_full_access" ON public.%I', t);
      EXECUTE format('CREATE POLICY "auth_full_access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
```

### 🔴 ハマった経緯（時系列・反省）
1. オーナーがビルド済みコードを朝6:48に push (`346c22b`) → 業務停止
2. 私が `service_role` キー受領 (`sb_secret_7049M...`) → Admin API で6名作成
3. ログイン画面に変更（赤→紺 `b40546c`）
4. 「タスクサマリー消えた」発覚 → curl テストで authenticated 空配列を確認
5. revert で復旧 (`af30075`) → 業務再開
6. オーナーが SQL Editor で `auth_full_access` ポリシー 55件追加
7. 再 push (`d399676`) → 完全動作

### ✅ anon/public ポリシー削除 完了（2026-05-13）
**NHA テーブル全25個から anon/public ロール用ポリシーを削除**

#### 削除内容
- anon ロール: 18件（各テーブルの `anon_all_xxx` + nha_wage_history の CRUD 4件）
- public ロール: 16件（nha_handover / nha_reservation_changes / nha_vmt の CRUD + ALL系）
- **計34件削除** → 残るは `auth_full_access` (authenticated) のみ

#### curl 直叩き検証結果
```
anon直叩き nha_reservations → []  (流出遮断)
anon直叩き nha_staff         → []  (流出遮断)
anon直叩き nha_tasks         → []  (流出遮断)
authenticated nha_reservations → データ取得OK
SPK reservations (anon)     → データ取得OK (札幌APP無影響)
```

#### 達成
**ソース漏えい・curl直叩きでの個人情報流出脆弱性 → 完全に塞いだ**
PostgRESTは RLS ブロックされたレコードを `[]` 空配列で返すため、401/403ではないが結果として取得不能。

### ✅ SPK セキュリティ強化 完了（2026-05-13 / v4.7.131）
- SPK index.src.html に NHA同様の修正適用:
  - `sb` クライアント**同期作成**
  - ログイン後 `location.reload()`
  - 紺ティールグラデ `linear-gradient(135deg,#1e40af,#0891b2)`
- SPK専用テーブル17件のポリシー削除完了（reservations/tasks/fleet/vehicles/staff/shifts/places/spk_attendance/spk_accounting/spk_memos/classes/car_data/logs/maintenance/vehicle_monthly_kpi/jalan_payments）
- curl 検証: 全 SPK 主要テーブル anon → `[]` 流出遮断
- 認証ユーザー追加: mikuni@g-lines.jp / 6666 (SPK 三國さん)
- member@g-lines.jp / **8888** に PW 設定（NHA/SPK共通）

#### 📌 Step 2 残課題（共有テーブル）
他APPが依然 anon で稼働中のため、それぞれ認証化してから anon ポリシー削除する:

| 共有テーブル | 使用システム | 認証化TODO |
|---|---|---|
| `inquiries` / `blocked_senders` / `reply_templates` | 問い合わせAPP (handyman-inquiry) | APP に signInWithPassword 追加 |
| `check_events` / `vehicle_twins` / `repair_records` | 傷チェックAPP (handyman-damage) | APP に signInWithPassword 追加 |
| `sns_app_state` | SNS自動投稿GAS | GAS を service_role キーに切替 |
| `store_events` / `monthly_snapshots` | 監視ダッシュボード / 経営管理 | NHAでは authHeader() 化済（monitor.html） |
| `app_settings` | GAS heartbeat / NHA SPK 共通設定 | GAS を service_role に・APP は authHeader() |
| `handyman_knowledge` / `sq_terminal_failed` | 共有 | 順次認証化 |

#### 🚨 個別緊急対応
- `app_settings` anon で `team_password: handyman2026` が露出（旧APP起動パスワード）
  - 今は未使用なので **不要レコード削除**で対応:
  ```sql
  DELETE FROM app_settings WHERE key='team_password';
  ```

### 🔴 残課題（将来 Phase）
- **共有テーブルの anon ポリシー削除**（上記表のシステムを順次認証化後）
- **エラー時の auth flow 検証**: ログイン失敗時の UX、セッション切れ時の自動再認証

### 残ポリシーの最終形（参照用）
全25テーブルが以下の状態:
```
nha_accounting          | auth_full_access | {authenticated}
nha_app_settings        | auth_full_access | {authenticated}
nha_attendance          | auth_full_access | {authenticated}
nha_car_data            | auth_full_access | {authenticated}
nha_cars                | auth_full_access | {authenticated}
nha_classes             | auth_full_access | {authenticated}
nha_edit_log            | auth_full_access | {authenticated}
nha_fleet               | auth_full_access | {authenticated}
nha_handover            | auth_full_access | {authenticated}
nha_jalan_payment       | auth_full_access | {authenticated}
nha_jalan_payments      | auth_full_access | {authenticated}
nha_logs                | auth_full_access | {authenticated}
nha_maintenance         | auth_full_access | {authenticated}
nha_memos               | auth_full_access | {authenticated}
nha_places              | auth_full_access | {authenticated}
nha_reservation_changes | auth_full_access | {authenticated}
nha_reservations        | auth_full_access | {authenticated}
nha_shifts              | auth_full_access | {authenticated}
nha_staff               | auth_full_access | {authenticated}
nha_tasks               | auth_full_access | {authenticated}
nha_vehicle_maintenance | auth_full_access | {authenticated}
nha_vehicle_monthly_kpi | auth_full_access | {authenticated}
nha_vehicles            | auth_full_access | {authenticated}
nha_vmt                 | auth_full_access | {authenticated}
nha_wage_history        | auth_full_access | {authenticated}
```

### 🔴 絶対ルール（今後の作業者へ）
1. **Supabase Auth 導入時は authenticated 用 RLS ポリシーを必ず先に整備する**。anon 用ポリシーだけでログイン制を有効化するとデータ取得不能になる
2. **`sb` クライアントは同期作成**。`async` ブロック内で `sb = createClient()` すると APP useEffect が null 参照する
3. **ログイン成功後は `location.reload()` を必ず入れる**。React state が認証前後で食い違うため
4. **SQL の直接実行は私から不可**。Supabase は service_role でも `pg-meta` / Management API を受け付けない。SQL は必ずオーナーに Dashboard で実行依頼（Cmd+V → Cmd+Enter）
5. **service_role キーは GitHub に絶対に上げない**。GAS のスクリプトプロパティ or 局所利用のみ
6. **両店共有 Supabase の anon ポリシーを変更する SQL は両店同時実施**。片方だけ実行すると相手 APP が壊れる

### コミット履歴（NHA）
- `346c22b` 2026-05-13 06:48: auth導入 (オーナーpush)
- `b40546c` 2026-05-13: 紺グラデ化 (v3.5.29)
- `e00f44e` 2026-05-13: sb同期作成 + reload (v3.5.30)
- `af30075` 2026-05-13: revert（業務復旧）
- `d399676` 2026-05-13: 再投入 + authenticated RLS対応済 (v3.5.31) ← **本番稼働中**

### 関連ファイル
- 仕様書: `~/Desktop/HANDYMAN_NHA_セキュリティ強化_仕様書.md`
- APP: `~/Desktop/naha-project/index.html.bak` L91-181（auth 部分）
- Supabase Dashboard: https://supabase.com/dashboard/project/ckrxttbnawkclshczsia/auth/users

---

