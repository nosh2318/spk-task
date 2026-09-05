# 引き継ぎ：札幌 Gクラス「デミオ優先」配車 GAS修正（2026-09-03）

## 何のための修正か
札幌のGクラス（コンパクト＝デミオ6864／ノート6906）で、**デミオが空いているのにノートに自動配車される**不具合を直す。
原因：GASの車両割り当て関数が「空いてる車を車両の登録順（＝ノートが先）で上から拾う」だけで、デミオ優先の並べ替えが無かった。

## 対象
- GASプロジェクト：**札幌予約メール自動配車**
- ファイル：**gas-email-import-v2.gs**
- 関数：**`autoAssignVehicle_`**

## 貼る場所
`autoAssignVehicle_` 関数の中、**`var busyVehicleCodes = {};` という行の直前**に、下記ブロックをそのまま挿入する。

## 挿入するコード（これをコピペ）
```js
  // ★ 2026-09-03 車両優先順(オーナー指示): Gクラスはデミオ優先で埋める。
  //   取得は登録順(≒ノートが先)で ORDER BY 無し → 空車を先頭から拾うためデミオが空いていてもノートに入る問題を是正。
  //   name部分一致で優先車を先頭へ並べ替えてから空車探索する（HP車種指定=preferredModel時は既に絞込済みで無影響）。
  var CLASS_ASSIGN_PRIORITY = { 'G': ['デミオ'] };
  if (CLASS_ASSIGN_PRIORITY[vehicleClass]) {
    var _prio = CLASS_ASSIGN_PRIORITY[vehicleClass];
    vehicles.sort(function(a, b) {
      function _rank(v) { for (var pi = 0; pi < _prio.length; pi++) { if ((v.name || '').indexOf(_prio[pi]) >= 0) return pi; } return _prio.length; }
      return _rank(a) - _rank(b);
    });
  }
```

## 挿入後の並び（この形になればOK）
```js
    }
  }

  // ★ 2026-09-03 車両優先順(オーナー指示): Gクラスはデミオ優先で埋める。
  ...(上のブロック)...
  }

  var busyVehicleCodes = {};
  var overlappingFleet = getOverlappingFleetVehicles_(lendDate, returnDate);
```

## 手順
1. Apps Scriptで「札幌予約メール自動配車」を開く
2. `gas-email-import-v2.gs` の `autoAssignVehicle_` を探す
3. `var busyVehicleCodes = {};` の直前に上のブロックを貼る
4. 保存（Cmd+S）

## 大事な注意
- **この修正を入れても、既に入っている予約（明日の分・準備済みの分すべて）は1件も動きません。** GASは「これから新しく取り込む予約」の配車先を決めるだけです。
- 効果：貼付後の"次の新規G予約"から、デミオが空いていればデミオ、埋まっていればノート、になる。
- 挙動：デミオ優先はGクラスだけ。他クラスは従来どおり。

## リポジトリ側
- 修正済みの全文は `~/spk-task/gas-email-import-v2.gs`（node構文チェック通過済）にある。手元でファイルごと差し替えてもよい。

## 検証
貼付後、次に取り込まれるGクラス予約（じゃらん/エアトリ等「☆コンパクトカー_G_SPK☆」）が、デミオ空きのときデミオに配車されるかを配車表で確認する。それを確認して初めて「直った」とする。
