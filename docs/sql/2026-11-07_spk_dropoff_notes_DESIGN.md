# 設計メモ：札幌 乗り捨て回収専用メモ（2026-11-07）
- 何を：乗捨回収タスク専用の自由記述メモ。新表 public.spk_dropoff_notes（SQL=同フォルダ）。
- なぜ別表：既存 DEL・COL 引継＝spk_handover_notes（予約番号キー・複数記録・anon 全開・物理削除）。乗捨回収タスクは reservation_id が空（自動生成 dr-+元_id）なので予約番号では引けず、仕様上も「完全に独立」が必須。tasks.changed_json に入れる案は、他端末の古い写しでの保存で消える恐れ（§3）があるため不採用。
- キー：tasks._id（PK・一意）。翌日対応オーバーレイも同じ _id。担当を乗り捨て→他→乗り捨てで墓標→再生成されても _id 同じ＝メモは残る。
- 書込：APP（ログイン済み authenticated）のみ。1操作＝1行（新規 insert／更新は _id＋読込時の updated_at 一致で update＝他人の更新を上書きしない）。削除＝deleted=true（墓標）。物理削除権限なし。
- 読込：APP の 乗捨回収 行のボタン表示用に _id 一覧（deleted=false かつ note<>''）をページング取得／モーダルで1件取得。
- 影響元：書込＝新表のみ（APP index.src.html の新部品 DropMemoBtn）。読込＝同部品のみ。既存表・関数・GAS・EF・cron・staff.html・spk_handover_notes は無変更。audit_log に新表の行が増える（既存トリガ関数 _audit_row を付けるだけ）。
- 範囲外：staff.html（バイト個別URL・anon）には出さない（必要ならトークン付き RPC を別途提案）。
- 戻し方：APP は git revert＋再ビルド。DB は drop table（新表のみ）。
