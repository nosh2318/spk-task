/* 2026-11-12 オーナー「全店 着地見込みのタブを追加して欲しい／過去実績および当月推移（日数や進捗・空き状況など）／試算根拠を明確に／リアルタイムで各月見れる状況を／現在実績・着地見込み」
   bt/spk/nha-mtg-2026h2.html 共通：📈 着地見込みタブ（#land）。
   ・数字の正本＝各店のサマリ（設計比較タブと同じ renderDesign の計算）。各ページは renderDesign の中で landX0/landX を呼び、window.LAND_X に月ごとの値を書く。
     このタブは自店の LAND_X と、他の2店のページを隠し iframe（?embed=1&landsrc=1）で開いてその LAND_X を読む＝どの店のページで見ても同じ数字・各店サマリの「まとめ 着地」と一致。
   ・当月推移＝RPC *_mtg_trend（返却月ごとの予約売上を受付日で積み上げ）。
   ・landsrc=1 のページ（iframe の中）はタブを描かない（無限に iframe を開かない）。 */
(function(){
var SRC=location.search.indexOf("landsrc=1")>=0||!!window.LAND_SRC_FORCE;  /* LAND_SRC_FORCE／LAND_PG＝検証用（blob で開く時） */
var STORES=[{k:"spk",nm:"札幌",pg:"spk-mtg-2026h2.html",rpc:"spk_mtg_trend",col:"#2563eb"},{k:"nha",nm:"那覇",pg:"nha-mtg-2026h2.html",rpc:"nha_mtg_trend",col:"#dc2626"},{k:"bt",nm:"高松",pg:"bt-mtg-2026h2.html",rpc:"bt_mtg_trend",col:"#7c3aed"}];
function selfKey(){if(window.LAND_SELF)return window.LAND_SELF;var p=location.pathname;for(var i=0;i<STORES.length;i++)if(p.indexOf(STORES[i].pg)>=0)return STORES[i].k;return "";}
function dimOf(m){return new Date(+m.slice(0,4),+m.slice(5,7),0).getDate();}
function jstNow(){return new Date(Date.now()+9*3600000);}
/* ── 各ページの renderDesign から呼ばれる（値を書くだけ。描画しない） ── */
window.landX0=function(D,pace,cur){var o=D.data||{},h={};
  (D.months||[]).forEach(function(m){if(m<"2026-03"||m>=cur)return;var x=o[m]||{},u=x.util||{},rd=0,ad=0;Object.keys(u).forEach(function(c){rd+=u[c].rd||0;ad+=u[c].ad||0;});
    h[m]={t:(typeof hasT=="function"?hasT(m):true)&&typeof revT=="function"?revT(m):0,a:x.tot_r||0,r:x.resv_r||0,x:x.ext_r||0,c:x.tot_c||0,rd:rd,ad:ad,n:x.nveh||0};});
  window.LAND_X={st:selfKey(),gen:D.generated||"",pace:!!pace,cur:cur,hist:h,mon:{},ts:Date.now()};};
window.landX=function(m,X,A,dcl,TG,OX,EX,labS){var L=window.LAND_X;if(!L)return;var cl=[];
  dcl.forEach(function(c){var q=X.C[c],a=A[c];if(!q)return;var x=q.x;if(!x.n&&!x.rd&&!x.ar)return;var on=!!(a&&x.td);
    cl.push({c:c,lb:String(labS(c)).replace(/<[^>]+>/g,""),n:x.n,ad:x.ad,rd:x.rd,ar:x.ar,td:x.td,tg:on?q.tg:0,pk:on?a.pk:0,cap:on?a.cap:Math.max(0,x.ad-x.rd),L:on?a.L:x.ar,on:on,u:x.rd&&x.ar>0?x.ar/x.rd:0});});
  L.mon[m]={t:X.t,a:X.a,OX:OX,EX:EX,ar:TG.ar,Lc:TG.L,L:TG.L+OX,tg:TG.tg,n:TG.n,ad:TG.ad,rd:TG.rd,f:TG.f,td:TG.td,left:X.left,dim:dimOf(m),cls:cl};
  if(!SRC&&window.landVisible&&landVisible())landSoon();};
if(SRC)return;
/* ── タブ（親ページ） ── */
var IF={},TR={},SEL=null,MSEL=null,timer=null;
window.landVisible=function(){var e=document.getElementById("land");return !!e&&e.style.display!="none";};
function landSoon(){clearTimeout(timer);timer=setTimeout(draw,250);}
function getX(k){if(k==selfKey())return window.LAND_X||null;var f=IF[k];try{return f&&f.contentWindow&&f.contentWindow.LAND_X||null;}catch(e){return null;}}
function ready(k){var x=getX(k);if(!x||!x.mon||!Object.keys(x.mon).length)return false;if(x.pace)return true;return Date.now()-(IF[k]&&IF[k]._t0||0)>15000;}
function ensureIframes(reload){STORES.forEach(function(s){if(s.k==selfKey())return;var f=IF[s.k];
  if(!f){f=document.createElement("iframe");f.style.cssText="position:absolute;width:1200px;height:800px;left:-99999px;top:0;border:0;visibility:hidden";f.setAttribute("aria-hidden","true");f.tabIndex=-1;IF[s.k]=f;f._t0=Date.now();f.src=(window.LAND_PG&&LAND_PG[s.k])||s.pg+"?embed=1&landsrc=1&t="+Date.now();f.onload=function(){landSoon();};document.body.appendChild(f);}
  else if(reload){f._t0=Date.now();try{f.contentWindow.load();}catch(e){f.src=s.pg+"?embed=1&landsrc=1&t="+Date.now();}}});}
function sbOf(k){var w=k==selfKey()?window:(IF[k]&&IF[k].contentWindow);try{return w&&w.SB?[w.SB,w.ANON]:null;}catch(e){return null;}}
function loadTrend(){STORES.forEach(function(s){var c=sbOf(s.k);if(!c){setTimeout(loadTrend,1500);return;}
  fetch(c[0]+"/rest/v1/rpc/"+s.rpc,{method:"POST",headers:{apikey:c[1],Authorization:"Bearer "+c[1],"Content-Type":"application/json"},body:"{}"}).then(function(r){return r.ok?r.json():null;}).then(function(j){TR[s.k]=j&&j.mon?j:{err:1};landSoon();}).catch(function(){TR[s.k]={err:1};landSoon();});});}
var started=0,poll=null;
window.landOpen=function(){if(!started){started=1;ensureIframes(false);setTimeout(loadTrend,600);}
  clearInterval(poll);poll=setInterval(function(){draw();if(STORES.every(function(s){return ready(s.k);})&&STORES.every(function(s){return TR[s.k];}))clearInterval(poll);},700);draw();};
window.landRefresh=function(){ensureIframes(true);TR={};setTimeout(loadTrend,800);clearInterval(poll);poll=setInterval(function(){draw();if(STORES.every(function(s){return ready(s.k);})&&STORES.every(function(s){return TR[s.k];}))clearInterval(poll);},700);};
/* ── 表示 ── */
function k(v){return Math.round(v||0).toLocaleString();}
function y(v){return "¥"+k(v);}
function man(v){var a=Math.abs(v||0);return (a>=1e6?Math.round(v/1e4):Math.round(v/1e3)/10).toLocaleString()+"万";}
function P(a,b){return b?Math.round(a/b*100)+"%":"–";}
function sg(v,f){v=Math.round(v||0);return '<span class="'+(v>0?"lpos":v<0?"lneg":"")+'">'+(v>0?"+":v<0?"−":"")+f(Math.abs(v))+"</span>";}
function MN(m){return (+m.slice(5))+"月";}
function MNy(m){return m.slice(2,4)+"/"+(+m.slice(5));}
var CSS='#land{font-size:13px}#land .lh{font-size:15px;font-weight:800;margin:10px 0 6px;color:#0f172a}#land .lsub{font-size:11px;color:#64748b;line-height:1.6}'
 +'#land .lcards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0}@media(max-width:820px){#land .lcards{grid-template-columns:repeat(2,minmax(0,1fr))}}'
 +'#land .lc{border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;background:#fff;border-top:4px solid var(--c,#0f766e)}#land .lc.all{background:#f0fdfa}#land .lc h4{margin:0 0 4px;font-size:13px}'
 +'#land .lc .big{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15}#land .lc .row{display:flex;justify-content:space-between;font-size:12px;color:#334155;font-variant-numeric:tabular-nums}'
 +'#land .bar2{position:relative;height:10px;background:#e2e8f0;border-radius:5px;margin:6px 0 4px;overflow:hidden}#land .bar2 i{position:absolute;left:0;top:0;bottom:0;background:#0f766e;border-radius:5px}#land .bar2 b{position:absolute;left:0;top:0;bottom:0;background:#5eead4;border-radius:5px}#land .bar2 s{position:absolute;top:-2px;bottom:-2px;width:2px;background:#0f172a}'
 +'#land .lw{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e2e8f0;border-radius:8px;margin:4px 0 8px}#land table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}'
 +'#land th,#land td{padding:5px 7px;border-bottom:1px solid #eef2f7;text-align:right;white-space:nowrap}#land th{background:#134e4a;color:#fff;font-size:11px;font-weight:700;position:sticky;top:0}#land th.g{background:#0f766e}#land td.l,#land th.l{text-align:left}'
 +'#land tr.cur td{background:#fefce8}#land tr.tot td{font-weight:800;border-top:2px solid #94a3b8}#land tr.clk{cursor:pointer}#land tr.clk:hover td{background:#f1f5f9}#land tr.sel td{background:#ccfbf1!important}'
 +'#land .lpos{color:#1d4ed8;font-weight:700}#land .lneg{color:#b91c1c;font-weight:700}#land .st{font-size:10px;border-radius:4px;padding:1px 5px;font-weight:700}#land .st0{background:#e2e8f0;color:#334155}#land .st1{background:#fde68a;color:#78350f}#land .st2{background:#dbeafe;color:#1e3a8a}'
 +'#land .chips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}#land .chips button{border:1px solid #cbd5e1;background:#fff;border-radius:16px;padding:4px 12px;font-size:12px;cursor:pointer;font-weight:700}#land .chips button.on{background:#0f766e;color:#fff;border-color:#0f766e}'
 +'#land .why{border:2px solid #0f766e;border-radius:10px;padding:10px 12px;background:#fff;margin:6px 0 10px;line-height:1.75}#land .why h5{margin:0 0 4px;font-size:14px}#land .eq{font-family:inherit;background:#f8fafc;border-radius:6px;padding:6px 8px;margin:4px 0}'
 +'#land .muted{color:#94a3b8}#land .wait{padding:6px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:12px;color:#9a3412;margin:6px 0}'
 +'#land svg text{font-size:10px;fill:#475569}#land .lg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#475569;margin:2px 0 6px}#land .lg i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:4px}'
 +'@media print{#land .chips,#land .wait{display:none}}';
function css(){if(document.getElementById("landCss"))return;var s=document.createElement("style");s.id="landCss";s.textContent=CSS;document.head.appendChild(s);}
/* 月の値（店）：確定月＝実績、今月以降＝サマリの着地 */
function mv(x,m){if(!x)return null;var cur=x.cur;if(m<cur){var h=x.hist[m];if(!h)return null;return {st:0,t:h.t,a:h.a,L:h.a,rd:h.rd,ad:h.ad,f:h.rd,n:h.n,h:h};}
  var z=x.mon[m];if(!z)return null;return {st:m==cur?1:2,t:z.t,a:z.a,L:z.L,rd:z.rd,ad:z.ad,f:z.f,n:z.n,z:z};}
function allMonths(){var s={};STORES.forEach(function(st){var x=getX(st.k);if(!x)return;Object.keys(x.hist).forEach(function(m){s[m]=1;});Object.keys(x.mon).forEach(function(m){s[m]=1;});});return Object.keys(s).sort();}
function stl(st){return st==0?'<span class="st st0">確定</span>':st==1?'<span class="st st1">進行中</span>':'<span class="st st2">受付中</span>';}
function draw(){var el=document.getElementById("land");if(!el||!landVisible())return;css();
  var X={},miss=[];STORES.forEach(function(s){X[s.k]=getX(s.k);if(!ready(s.k))miss.push(s.nm);});
  var cur=jstNow().toISOString().slice(0,7),today=jstNow().toISOString().slice(0,10),day=+today.slice(8),dim=dimOf(cur);
  var H='<div class="lh">📈 着地見込み（全店：札幌・那覇・高松）</div>';
  H+='<div class="lsub">現在実績＝今入っている予約の売上（返却月で計上・キャンセル/テスト除外）＋予約外売上。着地見込み＝現在実績＋これから入る見込みの売上（各店サマリの「まとめ 着地」と同じ値）。確定月は実績＝着地。DBライブ（開いている間は5分ごとに更新）。'+(miss.length?'':' 最終取得 '+STORES.map(function(s){var x=X[s.k];return s.nm+' '+(x&&x.gen?x.gen.slice(5):'–');}).join('・'))+'</div>';
  if(miss.length)H+='<div class="wait">⏳ '+miss.join('・')+' の計算を読み込み中…（各店ページの設計・ペースを読み込んで計算しています）</div>';
  // ① 今月のカード
  var tot={t:0,a:0,L:0,rd:0,ad:0,f:0,cap:0,pk:0},cards='';
  STORES.forEach(function(s){var v=mv(X[s.k],cur);if(!v){cards+='<div class="lc" style="--c:'+s.col+'"><h4>'+s.nm+'</h4><div class="muted">読み込み中…</div></div>';return;}
    var z=v.z,cap=0,pk=0;(z.cls||[]).forEach(function(c){cap+=c.cap;pk+=c.pk;});tot.t+=v.t;tot.a+=v.a;tot.L+=v.L;tot.rd+=v.rd;tot.ad+=v.ad;tot.f+=v.f;tot.cap+=cap;tot.pk+=pk;
    cards+=card(s.nm,s.col,v.t,v.a,v.L,v.rd,v.f,v.ad,cap,"");});
  H+='<div class="lh">🗓 今月（'+MN(cur)+'）　'+day+'日目／'+dim+'日・経過 '+(day-1)+'日・残り '+(dim-day+1)+'日（今日を含む）</div><div class="lcards">'+card("全店",'#0f766e',tot.t,tot.a,tot.L,tot.rd,tot.f,tot.ad,tot.cap,"all")+cards+'</div>';
  // ② 今月の進み具合（日数・空き）
  H+='<div class="lh">📋 今月の進み具合（日数・進捗・空き）</div><div class="lw"><table><thead><tr><th class="l">店</th><th>台数</th><th>稼働可能<br>日数</th><th>予約済み<br>日数</th><th>予約<br>稼働率</th><th>残りの<br>空き日数</th><th>これから入る<br>見込み日数</th><th>着地<br>稼働率</th><th class="g">目標</th><th class="g">現在実績</th><th class="g">見込み<br>追加</th><th class="g">着地見込み</th><th class="g">着地−目標</th><th class="g">達成<br>見込み</th><th>目標まで<br>あと</th><th>あと1日<br>あたり</th></tr></thead><tbody>';
  var T2={n:0,ad:0,rd:0,cap:0,pk:0,f:0,t:0,a:0,L:0};
  STORES.forEach(function(s){var v=mv(X[s.k],cur);if(!v)return;var z=v.z,cap=0,pk=0;z.cls.forEach(function(c){cap+=c.cap;pk+=c.pk;});
    T2.n+=v.n;T2.ad+=v.ad;T2.rd+=v.rd;T2.cap+=cap;T2.pk+=pk;T2.f+=v.f;T2.t+=v.t;T2.a+=v.a;T2.L+=v.L;H+=prow(s.nm,v.n,v.ad,v.rd,cap,pk,v.f,v.t,v.a,v.L,z.left,s.k);});
  H+=prow("全店",T2.n,T2.ad,T2.rd,T2.cap,T2.pk,T2.f,T2.t,T2.a,T2.L,dim-day+1,"",1)+'</tbody></table></div>';
  H+='<div class="lsub">予約済み日数＝今月の貸出日数（今日より前の分を含む）／残りの空き日数＝今日以降の空き（台数×残り日数−今日以降の予約）／見込み日数＝残りの各日の「今の予約÷例年その日までに入っている割合」から今の予約を引いた分（空きが上限）／あと1日あたり＝（目標−現在実績）÷残り日数。行をクリックで店のクラス別根拠。</div>';
  // ③ 月別一覧（全店）
  var ms=allMonths();
  H+='<div class="lh">📊 月別 現在実績／着地見込み（全店）</div><div class="lw"><table><thead><tr><th class="l" rowspan="2">月</th><th class="l" rowspan="2">状態</th>'+STORES.map(function(s){return '<th colspan="3" class="g">'+s.nm+'</th>';}).join('')+'<th colspan="5">全店</th></tr><tr>'+STORES.map(function(){return '<th class="g">目標</th><th class="g">実績</th><th class="g">着地</th>';}).join('')+'<th>目標</th><th>現在実績</th><th>着地見込み</th><th>差</th><th>達成</th></tr></thead><tbody>';
  var GT={t:0,a:0,L:0};
  ms.forEach(function(m){var st=m<cur?0:m==cur?1:2,s3={t:0,a:0,L:0},ok=1,cells='';
    STORES.forEach(function(s){var v=mv(X[s.k],m);if(!v){cells+='<td class="muted" colspan="3">–</td>';if(X[s.k]&&!(m<X[s.k].cur))ok=0;return;}s3.t+=v.t;s3.a+=v.a;s3.L+=v.L;
      cells+='<td>'+(v.t?man(v.t):'<span class="muted">–</span>')+'</td><td>'+man(v.a)+'</td><td><b>'+man(v.L)+'</b>'+(v.t?' <small class="'+(v.L>=v.t?'lpos':'lneg')+'">'+P(v.L,v.t)+'</small>':'')+'</td>';});
    GT.t+=s3.t;GT.a+=s3.a;GT.L+=s3.L;
    H+='<tr class="clk'+(st==1?' cur':'')+(MSEL==m?' sel':'')+'" onclick="landMon(\''+m+'\')"><td class="l"><b>'+MNy(m)+'</b></td><td class="l">'+stl(st)+'</td>'+cells+'<td>'+man(s3.t)+'</td><td>'+man(s3.a)+'</td><td><b>'+man(s3.L)+'</b></td><td>'+sg(s3.L-s3.t,man)+'</td><td class="'+(s3.L>=s3.t?'lpos':'lneg')+'">'+P(s3.L,s3.t)+'</td></tr>';});
  H+='<tr class="tot"><td class="l" colspan="2">計（表示月）</td>'+STORES.map(function(s){var a=0,L=0,t=0;ms.forEach(function(m){var v=mv(X[s.k],m);if(v){a+=v.a;L+=v.L;t+=v.t;}});return '<td>'+man(t)+'</td><td>'+man(a)+'</td><td>'+man(L)+'</td>';}).join('')+'<td>'+man(GT.t)+'</td><td>'+man(GT.a)+'</td><td>'+man(GT.L)+'</td><td>'+sg(GT.L-GT.t,man)+'</td><td>'+P(GT.L,GT.t)+'</td></tr></tbody></table></div>';
  H+='<div class="lsub">目標＝各店ページの月目標（高松は10月から）。確定＝過去の月（実績で確定）／進行中＝今月／受付中＝来月以降（今の予約＋これから入る見込み）。月の行をクリックで店別の詳細。</div>';
  // ④ 店別の詳細（月別推移＋根拠）
  var sk=SEL||selfKey()||"spk",S0=STORES.filter(function(s){return s.k==sk;})[0]||STORES[0],x=X[S0.k];
  H+='<div class="lh" id="landDet">🔎 店別の月別推移と試算根拠</div><div class="chips">'+STORES.map(function(s){return '<button class="'+(s.k==S0.k?'on':'')+'" onclick="landSel(\''+s.k+'\')">'+s.nm+'</button>';}).join('')+'</div>';
  if(!x)H+='<div class="muted">読み込み中…</div>';
  else{H+='<div class="lw"><table><thead><tr><th class="l">月</th><th class="l">状態</th><th>台数</th><th>稼働可能日数</th><th>予約済み日数</th><th>稼働率</th><th>見込み日数</th><th>着地稼働率</th><th>1日単価</th><th class="g">目標</th><th class="g">現在実績</th><th class="g">着地見込み</th><th class="g">差</th><th class="g">達成</th></tr></thead><tbody>';
    ms.forEach(function(m){var v=mv(x,m);if(!v)return;var pk=v.st?v.f-v.rd:0,ur=v.st?(v.z.ar&&v.rd?v.z.ar/v.rd:0):(v.h.r&&v.rd?v.h.r/v.rd:0);
      H+='<tr class="clk'+(v.st==1?' cur':'')+(MSEL==m?' sel':'')+'" onclick="landMon(\''+m+'\')"><td class="l"><b>'+MNy(m)+'</b></td><td class="l">'+stl(v.st)+'</td><td>'+v.n+'台</td><td>'+k(v.ad)+'</td><td>'+k(v.rd)+'</td><td>'+P(v.rd,v.ad)+'</td><td>'+(v.st?'+'+k(pk):'<span class="muted">–</span>')+'</td><td>'+P(v.f,v.ad)+'</td><td>'+(ur?y(ur):'–')+'</td><td>'+(v.t?y(v.t):'–')+'</td><td>'+y(v.a)+'</td><td><b>'+y(v.L)+'</b></td><td>'+(v.t?sg(v.L-v.t,y):'')+'</td><td class="'+(v.L>=v.t?'lpos':'lneg')+'">'+(v.t?P(v.L,v.t):'–')+'</td></tr>';});
    H+='</tbody></table></div>';
    var mm=MSEL&&mv(x,MSEL)?MSEL:cur;H+=why(S0,x,mm);
    H+=trend(S0,x);}
  // ⑤ 計算方法
  H+='<div class="lh">📐 計算方法（全店共通）</div><div class="lsub" style="font-size:12px;color:#334155">'
   +'<b>現在実績</b>＝返却日がその月の予約の売上合計（基本料金＋オプション−割引。キャンセル・テスト除外）＋予約外売上（会計の予約外）。KPIタブ・サマリと同じ。<br>'
   +'<b>着地見込み</b>＝Σクラス別着地＋予約外・未配車（その月の実績）。クラス別着地＝今の予約売上＋これから入る見込み日数×見込み単価。<br>'
   +'<b>これから入る見込み日数</b>＝今日〜月末の各日について「その日の今の予約台数 ÷ 過去（3〜9月）の予約で、貸出日の◯日前までに入っていた割合」で最終予約台数を推計し、今の予約を引いたもの（空き台数が上限）。まだ半分も入っていない遠い日は、今の予約＋（まだ入っていない割合×目標稼働率）で控えめに見込む。<br>'
   +'<b>見込み単価</b>＝予約済みの1日単価と内訳（目標）単価を、予約済み日数：見込み日数で加重平均。<br>'
   +'<b>目標</b>＝各店ページの月目標（札幌'+'・那覇・高松の各ページの定数）。クラス別の目標は🎯設計比較タブと同じ配分。<br>'
   +'<b>当月推移</b>＝今入っている予約を受付日の順に積み上げた売上（キャンセル済みは除く）。前の月と同じ日付時点の比較で、今月の予約の入り方が早いか遅いかを見る。</div>';
  el.innerHTML=H;}
function card(nm,col,t,a,L,rd,f,ad,cap,cls){var pa=t?Math.min(100,a/t*100):0,pl=t?Math.min(100,L/t*100):0;
  return '<div class="lc '+cls+'" style="--c:'+col+'"><h4>'+nm+'</h4><div class="row"><span>着地見込み</span><span class="'+(L>=t?'lpos':'lneg')+'">'+P(L,t)+'</span></div><div class="big">'+man(L)+'</div>'
   +'<div class="bar2" title="濃い＝現在実績・薄い＝着地見込み・線＝目標"><b style="width:'+pl+'%"></b><i style="width:'+pa+'%"></i><s style="left:calc(100% - 2px)"></s></div>'
   +'<div class="row"><span>現在実績</span><span>'+man(a)+'（'+P(a,t)+'）</span></div><div class="row"><span>目標</span><span>'+man(t)+'</span></div><div class="row"><span>着地−目標</span>'+sg(L-t,man)+'</div>'
   +'<div class="row"><span>稼働率 予約/着地</span><span>'+P(rd,ad)+' → '+P(f,ad)+'</span></div><div class="row"><span>残りの空き</span><span>'+k(cap)+'日</span></div></div>';}
function prow(nm,n,ad,rd,cap,pk,f,t,a,L,left,sk,tt){var need=Math.max(0,t-a);
  return '<tr class="'+(tt?'tot':'clk')+'"'+(sk?' onclick="landSel(\''+sk+'\',1)"':'')+'><td class="l"><b>'+nm+'</b></td><td>'+n+'台</td><td>'+k(ad)+'日</td><td>'+k(rd)+'日</td><td>'+P(rd,ad)+'</td><td>'+k(cap)+'日</td><td>+'+k(pk)+'日</td><td>'+P(f,ad)+'</td><td>'+y(t)+'</td><td>'+y(a)+'</td><td>+'+y(L-a)+'</td><td><b>'+y(L)+'</b></td><td>'+sg(L-t,y)+'</td><td class="'+(L>=t?'lpos':'lneg')+'">'+P(L,t)+'</td><td>'+(need?y(need):'<span class="lpos">達成</span>')+'</td><td>'+(need&&left?y(need/left):'–')+'</td></tr>';}
function why(S0,x,m){var v=mv(x,m);if(!v)return '';var H='<div class="why"><h5>🧮 '+S0.nm+' '+MN(m)+'の試算根拠 '+stl(v.st)+'</h5>';
  if(v.st==0){var h=v.h;H+='<div class="eq">確定実績 '+y(h.a)+' ＝ 予約売上 '+y(h.r)+'（'+k(h.c)+'件・貸出 '+k(h.rd)+'日）＋ 予約外 '+y(h.x)+'</div><div>稼働率 '+P(h.rd,h.ad)+'（貸出 '+k(h.rd)+'日 ÷ 稼働可能 '+k(h.ad)+'日・'+h.n+'台）'+(h.rd?'／1日単価 '+y(h.r/h.rd):'')+(h.t?'／目標 '+y(h.t)+' に対して '+sg(h.a-h.t,y)+'（'+P(h.a,h.t)+'）':'')+'</div></div>';return H;}
  var z=v.z,sc=0,sp=0,sl=0;z.cls.forEach(function(c){sc+=c.ar;sp+=c.L-c.ar;sl+=c.L;});
  H+='<div class="eq">着地見込み '+y(z.L)+' ＝ 現在実績 '+y(z.a)+' ＋ これから入る見込み '+y(z.L-z.a)+'</div>';
  H+='<div class="eq">現在実績 '+y(z.a)+' ＝ クラス行の予約 '+y(z.ar)+' ＋ 予約外・未配車 '+y(z.OX)+'</div>';
  H+='<div class="eq">見込み '+y(z.L-z.a)+' ＝ Σクラス（見込み日数 × 見込み単価）'+(v.st==1?'　残り '+z.left+'日／'+z.dim+'日':'　'+z.dim+'日分')+'</div>';
  H+='<div>目標 '+y(z.t)+' → 着地 '+sg(z.L-z.t,y)+'（'+P(z.L,z.t)+'）</div>';
  H+='<div class="lw" style="margin-top:6px"><table><thead><tr><th class="l">クラス</th><th>台数</th><th>稼働可能</th><th>予約済み</th><th>空き(残り)</th><th>見込み日数</th><th>着地稼働率</th><th>予約済み単価</th><th>見込み単価</th><th class="g">目標</th><th class="g">現在実績</th><th class="g">＋見込み</th><th class="g">＝着地</th><th class="g">差</th></tr></thead><tbody>';
  z.cls.forEach(function(c){var add=c.L-c.ar,up=c.pk?add/c.pk:0;
    H+='<tr><td class="l"><b>'+c.c+'</b> <small class="muted">'+c.lb.replace(/^\S+\s*/,'')+'</small></td><td>'+c.n+'台</td><td>'+k(c.ad)+'日</td><td>'+k(c.rd)+'日</td><td>'+k(c.cap)+'日</td><td>+'+k(c.pk)+'日</td><td>'+P(c.rd+c.pk,c.ad)+'</td><td>'+(c.u?y(c.u):'<span class="muted">予約なし</span>')+'</td><td>'+(up?y(up):'–')+'</td><td>'+(c.on?y(c.tg):'<span class="muted">内訳なし</span>')+'</td><td>'+y(c.ar)+'</td><td>+'+y(add)+'</td><td><b>'+y(c.L)+'</b></td><td>'+(c.on?sg(c.L-c.tg,y):'')+'</td></tr>';});
  H+='<tr><td class="l">予約外・未配車</td><td colspan="8" class="l muted">その月に入っている実績をそのまま着地に入れる（見込みは足さない）</td><td>'+y(z.EX)+'</td><td>'+y(z.OX)+'</td><td>+¥0</td><td><b>'+y(z.OX)+'</b></td><td></td></tr>';
  H+='<tr class="tot"><td class="l">計</td><td>'+z.n+'台</td><td>'+k(z.ad)+'日</td><td>'+k(z.rd)+'日</td><td></td><td>+'+k(z.f-z.rd)+'日</td><td>'+P(z.f,z.ad)+'</td><td>'+(z.rd?y(z.ar/z.rd):'–')+'</td><td></td><td>'+y(z.t)+'</td><td>'+y(z.a)+'</td><td>+'+y(z.L-z.a)+'</td><td><b>'+y(z.L)+'</b></td><td>'+sg(z.L-z.t,y)+'</td></tr></tbody></table></div>';
  if(!x.pace)H+='<div class="wait">予約ペースが読めなかったため、見込み日数は目標日数までの仮置きです。</div>';
  return H+'</div>';}
/* 当月推移：返却月ごとの予約売上を受付日で積み上げ（今月＋前3か月を同じ日付軸で重ねる） */
function trend(S0,x){var T=TR[S0.k],cur=x.cur;var H='<div class="lh">📈 '+S0.nm+' 当月推移（予約売上の積み上がり）</div>';
  if(!T)return H+'<div class="muted">読み込み中…</div>';if(T.err)return H+'<div class="wait">推移データ（'+S0.rpc+'）を読めませんでした。</div>';
  var td=T.today||jstNow().toISOString().slice(0,10),dm=dimOf(cur),tOff=Math.round((new Date(td+"T00:00:00Z")-new Date(cur+"-01T00:00:00Z"))/864e5);
  function addM(m,n){var d=new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1+n,1));return d.toISOString().slice(0,7);}
  var list=[addM(cur,-3),addM(cur,-2),addM(cur,-1),cur],cols=["#cbd5e1","#94a3b8","#64748b",S0.col],X0=-45,X1=31;
  function cum(m){var a=(T.mon||{})[m]||[],out=[],s=0,i=0;for(var o=X0;o<=X1;o++){while(i<a.length&&a[i][0]<=o){s+=a[i][1];i++;}out.push([o,s]);}var pre=0;a.forEach(function(e){if(e[0]<X0)pre+=e[1];});return out.map(function(p){return [p[0],p[1]+(p[0]>=X0?pre:0)];});}
  var z=x.mon[cur],tg=z?z.t:0,L=z?z.L:0,S={},mx=Math.max(tg,L);list.forEach(function(m){S[m]=cum(m);S[m].forEach(function(p){if(m!=cur||p[0]<=tOff)mx=Math.max(mx,p[1]);});});
  // 予約外は受付日が無いので推移には入れない（予約売上だけ）。着地・目標の線は予約外を含む店の値
  var W=760,Hh=230,pl=56,pr=10,pt=10,pb=26,iw=W-pl-pr,ih=Hh-pt-pb;function sx(o){return pl+(o-X0)/(X1-X0)*iw;}function sy(v){return pt+ih-(mx?v/mx*ih:0);}
  var g='<svg viewBox="0 0 '+W+' '+Hh+'" style="width:100%;max-width:'+W+'px;height:auto;display:block">';
  for(var i=0;i<=4;i++){var v=mx*i/4;g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+sy(v)+'" y2="'+sy(v)+'" stroke="#eef2f7"/><text x="'+(pl-4)+'" y="'+(sy(v)+3)+'" text-anchor="end">'+man(v)+'</text>';}
  [-45,-30,-15,0,10,20,30].forEach(function(o){g+='<line x1="'+sx(o)+'" x2="'+sx(o)+'" y1="'+pt+'" y2="'+(pt+ih)+'" stroke="'+(o==0?'#94a3b8':'#f1f5f9')+'"/><text x="'+sx(o)+'" y="'+(Hh-8)+'" text-anchor="middle">'+(o<0?o+'日':o==0?'1日':(o+1)+'日')+'</text>';});
  if(tg)g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+sy(tg)+'" y2="'+sy(tg)+'" stroke="#0f172a" stroke-dasharray="5 4"/><text x="'+(W-pr-2)+'" y="'+(sy(tg)-4)+'" text-anchor="end" style="fill:#0f172a;font-weight:700">目標 '+man(tg)+'</text>';
  list.forEach(function(m,ix){var pts=S[m].filter(function(p){return m!=cur||p[0]<=tOff;}).map(function(p){return sx(p[0]).toFixed(1)+','+sy(p[1]).toFixed(1);}).join(' ');g+='<polyline fill="none" stroke="'+cols[ix]+'" stroke-width="'+(m==cur?3:1.6)+'" points="'+pts+'"/>';});
  var now=S[cur].filter(function(p){return p[0]<=tOff;}).pop();
  if(now){g+='<circle cx="'+sx(now[0])+'" cy="'+sy(now[1])+'" r="4" fill="'+S0.col+'"/>';if(L){g+='<line x1="'+sx(now[0])+'" y1="'+sy(now[1])+'" x2="'+sx(dm-1)+'" y2="'+sy(L)+'" stroke="'+S0.col+'" stroke-width="2" stroke-dasharray="3 3"/><circle cx="'+sx(dm-1)+'" cy="'+sy(L)+'" r="4" fill="#fff" stroke="'+S0.col+'" stroke-width="2"/><text x="'+(sx(dm-1)-6)+'" y="'+(sy(L)+14)+'" text-anchor="end" style="fill:'+S0.col+';font-weight:700">着地 '+man(L)+'</text>';}}
  g+='</svg>';
  H+='<div class="lg">'+list.map(function(m,ix){return '<span><i style="background:'+cols[ix]+'"></i>'+MN(m)+(m==cur?'（今月）':'')+'</span>';}).join('')+'<span><i style="background:#0f172a"></i>目標</span><span><i style="background:'+S0.col+';opacity:.6"></i>今→着地見込み（予約外含む）</span></div>'+g;
  // 同じ日付時点の比較表
  var rows='';list.forEach(function(m,ix){var s=S[m],at=s.filter(function(p){return p[0]<=tOff;}).pop(),fin=s[s.length-1];var h=x.hist[m];var fm=h?h.r:(m==cur&&z?z.ar+0:fin[1]);
    rows+='<tr'+(m==cur?' class="cur"':'')+'><td class="l"><i style="display:inline-block;width:10px;height:10px;background:'+cols[ix]+';border-radius:2px"></i> '+MN(m)+'</td><td>'+y(at?at[1]:0)+'</td><td>'+(m==cur?'<span class="muted">進行中</span>':y(fin[1]))+'</td><td>'+(m==cur||!fin[1]?'–':P(at?at[1]:0,fin[1]))+'</td></tr>';});
  H+='<div class="lw" style="max-width:560px"><table><thead><tr><th class="l">返却月</th><th>同じ日付時点（月の'+(tOff+1)+'日目）の予約売上</th><th>最終の予約売上</th><th>その時点で入っていた割合</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  H+='<div class="lsub">線＝その返却月の予約売上を受付日の順に積み上げたもの（今残っている予約だけ・キャンセル済みは除く・予約外売上は含まない）。横軸＝月初からの日数（マイナス＝前月までに受付）。前の月と同じ日付時点で比べると、今月の入り方が早いか遅いかが分かる。</div>';
  return H;}
window.landSel=function(k,scroll){SEL=k;draw();if(scroll){var e=document.getElementById("landDet");if(e)e.scrollIntoView({behavior:"smooth",block:"start"});}};
window.landMon=function(m){MSEL=m;if(!SEL)SEL=selfKey()||"spk";draw();var e=document.getElementById("landDet");if(e)e.scrollIntoView({behavior:"smooth",block:"start"});};
})();
