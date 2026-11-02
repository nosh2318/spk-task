-- OTA設定の初期行（名前とURLのみ。ID・パスは画面から入力する）
insert into private.ota_account(grp, label, url, sort) values
 ('HANDYMAN','オフィシャル_新：予約','https://rent-handyman.jp/',10),
 ('HANDYMAN','オフィシャル_新：管理','https://admin.rent-handyman.jp/',20),
 ('HANDYMAN','リニューアルサイト','https://rent-handyman.com/',30),
 ('HANDYMAN','リニューアル最新サイト','https://hdm-rentacar.jp/',40),
 ('HANDYMAN','スカイチケット','https://skyticket.jp/rentacar/client/users/login',50),
 ('HANDYMAN','じゃらん','https://admin.rentacar.jalan.net/',60),
 ('HANDYMAN','楽天','https://admin.cars.travel.rakuten.co.jp/rax/loginForm.do',70),
 ('HANDYMAN','レンタカードットコム','https://www2.web-rentacar.com/admin2/index.asp',80),
 ('HANDYMAN','エアトリ','https://airtrip-rentacar-br-admin.airtrip.jp/login',90),
 ('HANDYMAN','GoGoout','https://gogoout.com/ja/storeAdmin/login',100),
 ('BUDDICA','エアトリ','https://airtrip-rentacar-br-admin.airtrip.jp/login',110),
 ('BUDDICA','たびらい','https://car-cloud.tabirai.net/App_Supplier/SupplierLogin.aspx',120),
 ('BUDDICA','レンタカードットコム','https://www2.web-rentacar.com/admin2/index.asp',130);
