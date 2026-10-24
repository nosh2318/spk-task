# spk-task
- お客様情報ガード：commit/push 時にお客様メール・予約番号を検知すると止まります（伏せ字にして再実行）。誤検知の時だけ `PII_GUARD=off git push`（恒久除外はリポ直下 `.pii-allow` に正規表現を1行）。
