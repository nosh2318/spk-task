/* HANDYMAN 公式サイト 共有 多言語エンジン（KEYDROP方式・ja/en/zh/ko）
   使い方: <script src="official-i18n.js"></script> を読み込み、
   ・テキスト: <span data-i18n="key">…</span>（innerHTML置換。<br>可）
   ・プレースホルダ: <input data-i18n-ph="key">
   ・属性/JS側: hdmT('key') で取得。言語変更時に window.hdmOnLang があれば呼ぶ（JS生成部の再描画用）。*/
(function(){
  var DICT={
    ja:{
      nav_cars:'車種一覧', nav_price:'車両と料金', nav_news:'お知らせ', nav_book:'予約する',
      hero_copy:'旅は、目的地に着く前から<br>始まっている。',
      s_store:'📍 店舗を選択', s_store_ph:'店舗を選択', s_naha:'🌺 那覇空港店（沖縄）', s_sapporo:'❄️ 札幌店（北海道）',
      s_method:'🚗 受取方法を選択', m_delivery:'🚗 デリバリー', m_airport:'✈️ 無料送迎（空港/駅）', m_store:'🏠 来店',
      spk_msg:'<b>❄️ 札幌はデリバリー専門</b>　お届け先を地図で指定して予約します。「検索する」で予約画面へ進みます。',
      s_pick:'📅 出発 日時', s_ret:'📅 返却 日時', s_time:'時間',
      avail_msg:'🚙 ご利用日程に提供できる空車を次の画面にすべて表示します。',
      s_btn:'空車を検索する',
      cars_en:'CAR TYPE', cars_jp:'取扱車種・料金',
      tab_naha:'🌺 那覇空港店', tab_sapporo:'❄️ 札幌店',
      car_more:'全車種・料金を見る →',
      news_en:'NEWS', news_jp:'運営からのお知らせ',
      f_news:'お知らせ', f_company:'会社概要', f_terms:'貸渡約款', f_privacy:'プライバシー', f_law:'特定商取引法',
      note_naha:'🌺 那覇店：デリバリー・無料送迎（空港/駅）・来店に対応。',
      note_sapporo:'❄️ 札幌店：デリバリー専門。札幌市・北広島市へお届け／回収します。',
      seats:'名', perday:'〜 / 1日', azukari:'預かり'
    },
    en:{
      nav_cars:'Car Types', nav_price:'Cars & Rates', nav_news:'News', nav_book:'Book Now',
      hero_copy:'The journey begins<br>before you arrive.',
      s_store:'📍 Select store', s_store_ph:'Select store', s_naha:'🌺 Naha Airport (Okinawa)', s_sapporo:'❄️ Sapporo (Hokkaido)',
      s_method:'🚗 Pickup method', m_delivery:'🚗 Delivery', m_airport:'✈️ Free shuttle (airport/station)', m_store:'🏠 In-store',
      spk_msg:'<b>❄️ Sapporo is delivery-only.</b>  Set your delivery spot on the map. Tap “Search” to continue.',
      s_pick:'📅 Pick-up', s_ret:'📅 Return', s_time:'Time',
      avail_msg:'🚙 All cars available for your dates will be shown on the next screen.',
      s_btn:'Search available cars',
      cars_en:'CAR TYPE', cars_jp:'Cars & Rates',
      tab_naha:'🌺 Naha Airport', tab_sapporo:'❄️ Sapporo',
      car_more:'See all cars & rates →',
      news_en:'NEWS', news_jp:'Announcements',
      f_news:'News', f_company:'Company', f_terms:'Rental Terms', f_privacy:'Privacy', f_law:'Legal Notice',
      note_naha:'🌺 Naha: delivery, free shuttle (airport/station) & in-store pickup.',
      note_sapporo:'❄️ Sapporo: delivery-only. We deliver/collect in Sapporo & Kitahiroshima.',
      seats:'pax', perday:'~ / day', azukari:'Consignment'
    },
    zh:{
      nav_cars:'車型一覽', nav_price:'車輛與費用', nav_news:'公告', nav_book:'立即預約',
      hero_copy:'旅程，早在抵達之前<br>就已開始。',
      s_store:'📍 選擇門市', s_store_ph:'選擇門市', s_naha:'🌺 那覇機場店（沖繩）', s_sapporo:'❄️ 札幌店（北海道）',
      s_method:'🚗 選擇取車方式', m_delivery:'🚗 送車', m_airport:'✈️ 免費接送（機場/車站）', m_store:'🏠 到店',
      spk_msg:'<b>❄️ 札幌僅提供送車服務。</b>  請於地圖指定送車地點，點「搜尋」進入預約。',
      s_pick:'📅 取車 日期時間', s_ret:'📅 還車 日期時間', s_time:'時間',
      avail_msg:'🚙 符合您日期的所有可預約車輛將顯示於下一頁。',
      s_btn:'搜尋可預約車輛',
      cars_en:'CAR TYPE', cars_jp:'車型與費用',
      tab_naha:'🌺 那覇機場店', tab_sapporo:'❄️ 札幌店',
      car_more:'查看所有車型與費用 →',
      news_en:'NEWS', news_jp:'營運公告',
      f_news:'公告', f_company:'公司簡介', f_terms:'租賃條款', f_privacy:'隱私權', f_law:'特定商業交易法',
      note_naha:'🌺 那覇店：提供送車・免費接送（機場/車站）・到店取車。',
      note_sapporo:'❄️ 札幌店：僅送車。於札幌市・北廣島市送車／收車。',
      seats:'人', perday:'～ / 每日', azukari:'寄放車'
    },
    ko:{
      nav_cars:'차종 목록', nav_price:'차량 및 요금', nav_news:'공지', nav_book:'예약하기',
      hero_copy:'여행은 목적지에 도착하기 전부터<br>시작됩니다.',
      s_store:'📍 매장 선택', s_store_ph:'매장 선택', s_naha:'🌺 나하공항점(오키나와)', s_sapporo:'❄️ 삿포로점(홋카이도)',
      s_method:'🚗 수령 방법 선택', m_delivery:'🚗 배달', m_airport:'✈️ 무료 셔틀(공항/역)', m_store:'🏠 방문',
      spk_msg:'<b>❄️ 삿포로는 배달 전용입니다.</b>  지도에서 배달 장소를 지정하고 「검색」으로 진행하세요.',
      s_pick:'📅 대여 일시', s_ret:'📅 반납 일시', s_time:'시간',
      avail_msg:'🚙 선택하신 일정에 예약 가능한 모든 차량을 다음 화면에 표시합니다.',
      s_btn:'빈 차량 검색',
      cars_en:'CAR TYPE', cars_jp:'차량 및 요금',
      tab_naha:'🌺 나하공항점', tab_sapporo:'❄️ 삿포로점',
      car_more:'전체 차종·요금 보기 →',
      news_en:'NEWS', news_jp:'운영 공지',
      f_news:'공지', f_company:'회사 소개', f_terms:'대여 약관', f_privacy:'개인정보', f_law:'특정상거래법',
      note_naha:'🌺 나하점: 배달·무료 셔틀(공항/역)·방문 수령 가능.',
      note_sapporo:'❄️ 삿포로점: 배달 전용. 삿포로시·기타히로시마시로 배달/회수.',
      seats:'명', perday:'~ / 1일', azukari:'위탁'
    }
  };
  var SHORT={ja:'日本語',en:'EN',zh:'繁中',ko:'한국어'};
  var NAMES={ja:'日本語',en:'English',zh:'繁體中文',ko:'한국어'};
  function detect(){try{var s=localStorage.getItem('hdm_lang');if(s&&DICT[s])return s;var n=(navigator.language||'ja').toLowerCase();if(n.indexOf('ko')===0)return 'ko';if(n.indexOf('zh')===0)return 'zh';if(n.indexOf('en')===0)return 'en';}catch(e){}return 'ja';}
  var LANG=detect();
  window.hdmLang=function(){return LANG;};
  window.hdmT=function(k){var d=DICT[LANG]||DICT.ja;return (d[k]!=null?d[k]:(DICT.ja[k]!=null?DICT.ja[k]:k));};
  window.hdmApplyLang=function(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){el.innerHTML=window.hdmT(el.getAttribute('data-i18n'));});
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el){el.setAttribute('placeholder',window.hdmT(el.getAttribute('data-i18n-ph')));});
    document.querySelectorAll('option[data-i18n-opt]').forEach(function(el){el.textContent=window.hdmT(el.getAttribute('data-i18n-opt'));});
    try{document.documentElement.lang=LANG;}catch(e){}
    if(typeof window.hdmOnLang==='function'){try{window.hdmOnLang(LANG);}catch(e){}}
  };
  window.hdmSetLang=function(l){if(!DICT[l])return;LANG=l;try{localStorage.setItem('hdm_lang',l);}catch(e){}renderBtn();window.hdmApplyLang();};
  var wrap;
  function renderBtn(){if(!wrap)return;wrap.querySelector('.hdmlang-cur').textContent=SHORT[LANG];
    wrap.querySelectorAll('.hdmlang-menu button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-l')===LANG);});}
  function build(){
    var st=document.createElement('style');
    st.textContent='.hdmlang{position:fixed;top:10px;right:12px;z-index:9999;font-family:inherit}'+
      '.hdmlang-btn{display:flex;align-items:center;gap:6px;background:rgba(0,32,99,.92);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:800;cursor:pointer}'+
      '.hdmlang-menu{position:absolute;top:calc(100% + 6px);right:0;background:#fff;border:1px solid #d8e0ee;border-radius:12px;box-shadow:0 10px 30px rgba(0,16,48,.18);overflow:hidden;display:none;min-width:150px}'+
      '.hdmlang.open .hdmlang-menu{display:block}'+
      '.hdmlang-menu button{display:block;width:100%;text-align:left;background:#fff;border:0;padding:11px 15px;font-size:13px;font-weight:700;color:#0a1f44;cursor:pointer;font-family:inherit}'+
      '.hdmlang-menu button:hover{background:#f2f6fc}.hdmlang-menu button.on{background:#002063;color:#fff}';
    document.head.appendChild(st);
    wrap=document.createElement('div');wrap.className='hdmlang';
    wrap.innerHTML='<button type="button" class="hdmlang-btn">🌐 <span class="hdmlang-cur"></span> ▾</button>'+
      '<div class="hdmlang-menu">'+['ja','en','zh','ko'].map(function(l){return '<button type="button" data-l="'+l+'">'+NAMES[l]+'</button>';}).join('')+'</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('.hdmlang-btn').addEventListener('click',function(e){e.stopPropagation();wrap.classList.toggle('open');});
    wrap.querySelectorAll('.hdmlang-menu button').forEach(function(b){b.addEventListener('click',function(){window.hdmSetLang(b.getAttribute('data-l'));wrap.classList.remove('open');});});
    document.addEventListener('click',function(){wrap.classList.remove('open');});
    renderBtn();
  }
  function init(){build();window.hdmApplyLang();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
