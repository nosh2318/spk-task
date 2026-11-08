-- 高松（buddica-touring）: お客様に問い合わせを求める一文を外す（全店点検③・2026-11-08）
update hdm_tkm_templates
   set body = replace(replace(body, E'ご不明な点がございましたらお気軽にお問い合わせくださいませ。\n', ''), E'ご不明な点はお気軽にお問い合わせくださいませ。\n', ''),
       updated_at = now()
 where key not like '\_%' and (body like '%お気軽にお問い合わせくださいませ%');
update hdm_tkm_templates
   set body = replace(body, E'ご不明な点がございましたらお気軽にお問い合わせくださいませ。\nよろしくお願いいたします。', E'ご予約の確認・変更はマイページからお願いいたします。\nよろしくお願いいたします。'),
       updated_at = now()
 where key = '_footer';
