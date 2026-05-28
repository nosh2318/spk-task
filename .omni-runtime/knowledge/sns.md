# 📣 HANDYMAN SNSマシン

## 🔴 HANDYMAN Creator SNSマシン（2026-05-18 更新）

### URL
**`https://handyman-sns.vercel.app/`**
- ローカル: `~/Desktop/SNS/handyman-sns-app/index.html`
- Vercel projectName: `handyman-sns`
- デプロイ: `cd ~/Desktop/SNS/handyman-sns-app && vercel --prod --yes`

### ステップ構成（現行）
| STEP | 内容 |
|---|---|
| 1 | エリア選択（那覹/札幌） |
| 2 | スタイル選択（S1縦割り / S2横割り） |
| 3 | テキスト選択 |
| 4 | 画像管理 |
| 5 | 動画生成 |
| 6 | キャプション+タグ |
| 7 | 投稿確認 |

### 状態管理
- `STATE_VER=3`: ステップ順変更時にバンプ → 旧localStorageを自動リセット
- localStorage key: `hc2_state`

### 動画デザイン（drawS1 / drawS2）

#### S1（縦割り）
- テキスト位置: 左パネル水平中央 (`cx=split/2`)、垂直50%位置 (`textCY1=H*0.50`)
- グラデーション: テキスト中心±26%の範囲のみ（上下フェードアウト型）
- `wrapDrawCenter(ctx,txt,split-80,split/2,textCY1,68,1.4)`

#### S2（横割り）
- テキスト位置: 全幅水平中央 (`cx=W/2`)、垂直50%位置 (`textCY2=H*0.50`)
- グラデーション①: 上段画像の**下層**（分割線に向かって暗くなる・H*22%分）
- グラデーション②: 下段画像の**上層**（分割線から下に向かって徐々に透明・H*22%分）
- テキストは分割線（split=H*0.48）の直下に位置

#### wrapDrawCenter（共通関数）
```javascript
// centerY = テキストブロックの垂直中心
function wrapDrawCenter(ctx,text,maxW,cx,centerY,fontSize,lineH){
  // 文字を折り返してブロック高さを計算
  const blockH=lines.length*fontSize*lineH;
  const startY=centerY-blockH/2; // ブロックを中心に垂直配置
  ctx.textAlign='center';ctx.textBaseline='top';
}
```

### 動画出力・音声（✅ 完成 2026-05-18）

#### 出力フォーマット選択ロジック（優先順）
1. **Safari/iOS**: `video/mp4;codecs=avc1,mp4a.40.2` が MediaRecorder でサポートされていれば → BGM付きMP4
2. **Chrome PC**: `Mp4Muxer` + `VideoEncoder` が両方定義されていれば → VideoEncoder MP4
   - codec: `avc1.42E032`（H.264 Baseline Profile Level 5.0）← QuickTime/Instagram互換
   - mp4-muxer バージョン: **`5.1.3` 固定**（`@latest` は使わない）
3. **フォールバック**: MediaRecorder WebM

#### 動画表示・保存アーキテクチャ（✅ 完成）
- **録画後**: `_lastVideoBlob` に Blob を保持 → `URL.createObjectURL()` で即座にBlob URL生成
- **表示**: `mountVideoEl(containerId)` で `<video>` をプログラム的に生成（innerHTML直埋め込み禁止）
  - Blob URL → 瞬時ロード。data URL直埋め込みは10〜50MBになり表示不可
- **IDB保存**: `idbSet('vid_blob', {data: ArrayBuffer, type: MIMEtype})` → ページリロード後も `initVideoDisplay()` で復元
- **ダウンロード**: `_vidBlobUrl`（Blob URL）を優先使用 → クリーンなファイル出力
- **v.play()**: `mountVideoEl` 内で明示的に呼ぶ（autoplay属性だけでは動かない環境の保険）

#### drawCover の iOS Safari 対応（✅ 完成・重要）
```
❌ 旧: 録画canvas に ctx.filter 直接適用
        → iOS SafariではGPU非同期処理のためcaptureStreamが空フレーム取得 → 黒動画

✅ 新: オフスクリーンcanvas (_fc/_fctx) でフィルター適用 → 録画canvasに ctx.drawImage で転写
        → フィルター済みピクセルが録画canvasに確定してから captureStream → 正しい映像
```
- モジュール変数 `let _fc=null,_fctx=null` でオフスクリーンcanvasを再利用
- `_fc` は描画領域 (w,h) が変わるたびに再生成

#### 音声
- BGM_PART1（5曲）+ BGM_PART2（6曲）+ BGM_PART3（1曲）= 計12曲をランダム
- ユーザー追加曲: ArrayBuffer（IndexedDB）で保存・優先使用

#### モジュール変数（完成系）
| 変数 | 役割 |
|---|---|
| `_vidBlobUrl` | 動画表示・ダウンロード用Blob URL |
| `_lastVideoBlob` | genVideo内で生成されたBlob（fetch回避・startGenで即使用） |
| `_fc`, `_fctx` | オフスクリーンcanvas（ctx.filter隔離用） |

#### 画像未設定チェック
- 動画生成時にスロットが空の場合 → `⚠️ 画像未設定スロットがN個あります` トースト表示

### テキスト色（緩急）
- `wrapDrawCenter` で視覚的行分割
- 1行のみ → 全白、2行以上 → 最後の行がゴールド (#F5A623)
- ただし最後の行が短すぎる（<40%幅）場合は最後の2行をゴールド

### 画像処理（シネマティック）
- `drawCover`: オフスクリーンcanvasで `brightness(0.82) contrast(1.35) saturate(1.40)` 適用後に録画canvasへ転写
- クールカラーグレード: `rgba(10,30,80,1)` 12%オーバーレイ
- ビネット: 四隅65%暗化

### 画像選択アルゴリズム（✅ 2026-05-19 更新）
**優先順位**: ① 使用回数が少ない → ② 使用回数が同数なら **初回登録が新しい画像（新着優先）**

#### localStorage キー
- `hc2_usage_${area}`: `{fileId: count}` 使用回数
- `hc2_first_seen_${area}`: `{fileId: timestamp}` 初回登録日時（Drive取得時に記録）

#### 関数
- `recordFirstSeen(area, images)`: Drive取得時に新規画像のtimestampを記録
- `pickLeastUsed(images, usedSet, area)`:
  1. 使用済みIDを除外
  2. 使用回数（昇順）→ 同数なら first_seen（降順 = 新着優先）でソート
  3. 先頭を返す
- `recordUsage(area, fileId)`: 画像使用時に count+1

#### Drive取得タイミング（recordFirstSeen を呼ぶ箇所）
1. `swapSlotImage` → sr.images 取得後
2. `fullRefreshSlots` → sr.images 取得後
3. `autoFetchDriveImages` → [scImgs, vcImgs] 取得後

Drive取得時: `count=30` で多めに取得→クライアント側フィルタ

### 入替ボタン（swapSlotImage）仕様
- ローカルに複数画像 → 次の画像にサイクル（即時）
- 最後の画像に到達 → DriveAPIから未使用画像を追加取得
- 全Drive画像を使い切ったらループに戻る
- 使用済みID管理: `S.slotFileIds[slotKey]` にカンマ区切りで累積保存
- クライアント側でも全使用済みIDを除外してフィルタリング
- GAS APIには `count=10&exclude=最後のID` で取得

---

## SNS運用ルール

### 撮影ルール
- 車全体50%以上 + ホテル名・建物が背景 + 横向き撮影
- NG: アップすぎ、壁だけ、暗い、縦撮影

### NGキーワード
- 沖縄: 「空港」使用不可（条例）
- 札幌: 千歳空港エリア非対応

### ハッシュタグ
- 沖縄: #沖縄 #沖縄旅行 #沖縄ドライブ #沖縄レンタカー #那覇 #北谷 #恩納村 #名護 #デリバリーレンタカー #レンタカー #レンタカー予約 #沖縄観光 #国内旅行 #車旅 #ホテルにレンタカー #HANDYMAN
- 札幌: #札幌 #北海道 #北海道旅行 #北海道ドライブ #札幌レンタカー #すすきの #札幌駅 #大通 #デリバリーレンタカー #レンタカー #レンタカー予約 #札幌観光 #国内旅行 #車旅 #ホテルにレンタカー #HANDYMAN

---

