-- 高松（buddica-touring）: 前日・返却日朝・返却3時間前のメール文面（札幌・那覇と統一）
-- hdm-tkm-enqueue が同じキーで送る。文面に時間・場所は書かない（答えはマイページ1か所）。
insert into hdm_tkm_templates (key, ico, label, trig, subject, body, sort) values
('daybefore','🚗','前日のご案内（未了なし）','出発前日 9:00〜',
 '【HANDYMAN 高松空港店】明日はご出発日です',
 E'{name} 様\n\nHANDYMAN 高松空港店 です。\n明日がご出発日です。お受け取りの流れはマイページでご確認ください。\n\n▼ マイページ\n{mypage}\n\nよろしくお願いいたします。', 10),
('returnday','🏁','返却日のご案内','返却日 朝9:00',
 '【HANDYMAN 高松空港店】本日はご返却日です',
 E'{name} 様\n\nHANDYMAN 高松空港店 です。\n本日がご返却日です。返却の場所・時間・給油はマイページでご確認ください。\n\n▼ マイページ\n{mypage}\n\nよろしくお願いいたします。', 11),
('return3h','⏰','返却3時間前','返却の約3時間前',
 '【HANDYMAN 高松空港店】まもなくご返却のお時間です',
 E'{name} 様\n\nHANDYMAN 高松空港店 です。\nまもなくご返却のお時間です（約3時間後）。返却の流れはマイページでご確認ください。\n\n▼ マイページ\n{mypage}\n\nよろしくお願いいたします。', 12)
on conflict (key) do nothing;
