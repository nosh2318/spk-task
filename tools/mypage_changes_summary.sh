#!/bin/bash
# マイページ 受付期限＋差額決済 変更まとめ（2026-07-06）
# 使い方: bash ~/spk-task/tools/mypage_changes_summary.sh
set -e
echo "=================================================="
echo " マイページ変更まとめ（受付期限 + 差額決済）"
echo "=================================================="
echo
echo "■ 概要"
cat <<'TXT'
1) 受付期限をシステムで自動ブロック
   ・オプション（チャイルド/ジュニアシート）… 貸出前日19:00まで
   ・補償プラン … 貸出前まで（貸出開始後は変更不可）
   期限を過ぎると依頼できず「公式LINEにて」と表示。

2) 差額決済（追加オプション/補償）の自動化
   ・承認すると差額を自動計算
       オプション = 単価×増減台数（チャイルド¥1,000/ジュニア¥500・1レンタル）
       補償      = (新−旧)/日 × 暦日数（免責¥1,100/日・NOC¥550/日・暦日で丸め）
   ・追加(プラス) → Square決済リンクを自動発行しLINE送信、入金は10分ごと自動検知
   ・減額(マイナス) → 返金額をSlack表示（返金のみ手動）
   ・OPシートの決済バッジを「通常決済(OTA/JLN)」と「追加未/追加済(追加分)」で分離表示
TXT
echo
echo "■ SPKリポ（受付期限UI・OPシートバッジ・EF正本）: 直近コミット"
git -C ~/spk-task log --oneline -6 -- my.html my-admin.html index.src.html line_auto/handyman-mypage/index.ts
echo
echo "■ hdm-car-deliveryリポ（追加決済テーブルSQL・EFデプロイ実体）: 直近コミット"
git -C ~/hdm-car-delivery log --oneline -4 -- sql/050_mypage_extra_payments.sql supabase/functions/handyman-mypage/index.ts 2>/dev/null || echo "(なし)"
echo
echo "■ バージョン"
grep -m1 'const VER' ~/spk-task/my.html
grep -m1 'const ADMIN_VER' ~/spk-task/my-admin.html
grep -m1 'APP_VERSION=' ~/spk-task/index.src.html
echo
echo "■ 稼働状態（要オーナー作業＝なし・全自動）"
echo "  ・追加決済テーブル mypage_extra_payments … 作成済(RUN済)"
echo "  ・Edge Function handyman-mypage … デプロイ済(受付期限ブロック/差額発行/入金検知)"
echo "  ・入金検知cron mypage-extra-check … 10分ごと稼働"
echo
echo "=================================================="
echo " 公開URL: https://nosh2318.github.io/spk-task/my.html (顧客) / my-admin.html (管理)"
echo "=================================================="
