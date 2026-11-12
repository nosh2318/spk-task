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
window.landX0=function(D,pace,cur){var o=D.data||{},h={},hc={};
  (D.months||[]).forEach(function(m){if(m<"2026-03"||m>=cur)return;var x=o[m]||{},u=x.util||{},rd=0,ad=0;Object.keys(u).forEach(function(c){rd+=u[c].rd||0;ad+=u[c].ad||0;});
    hc[m]={};Object.keys(u).forEach(function(c){hc[m][c]=u[c].n||0;});h[m]={t:(typeof hasT=="function"?hasT(m):true)&&typeof revT=="function"?revT(m):0,a:x.tot_r||0,r:x.resv_r||0,x:x.ext_r||0,c:x.tot_c||0,rd:rd,ad:ad,n:x.nveh||0};});
  /* 2026-11-12 平均泊数（クラス別・直近3か月＝貸出日数÷返却件数）と予約ペースの日別予約台数（fut）：空きの実数と「平均泊数で取れるか」の検証用 */
  var an={},ms3=(D.months||[]).filter(function(m){return m<=cur;}).slice(-3);ms3.forEach(function(m){var x=o[m]||{},u=x.util||{},c=x.cls||{};Object.keys(u).forEach(function(k){var a=an[k]=an[k]||{rd:0,c:0};a.rd+=u[k].rd||0;a.c+=(c[k]&&c[k].c)||0;});});
  var PC=window.DSG_PACE||null;
  window.LAND_X={st:selfKey(),gen:D.generated||"",pace:!!pace,cur:cur,hist:h,mon:{},ts:Date.now(),hc:hc,an:an,an3:ms3,fut:PC&&PC.fut||null,today:PC&&PC.today||null};};
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
var FR={};
function loadFree(){STORES.filter(function(s){return s.k==(selfKey()||"spk");}).forEach(function(s){var c=sbOf(s.k);if(!c){setTimeout(loadFree,1500);return;}
  fetch(c[0]+"/rest/v1/rpc/"+s.k+"_mtg_free",{method:"POST",headers:{apikey:c[1],Authorization:"Bearer "+c[1],"Content-Type":"application/json"},body:"{}"}).then(function(r){return r.ok?r.json():null;}).then(function(j){FR[s.k]=j&&j.cls?j:{err:1};landSoon();}).catch(function(){FR[s.k]={err:1};landSoon();});});}
var FC={};  /* 2026-11-12 mtg_fc：指標・複数の予測式の答え合わせ・毎日の予測の記録（docs/sql/mtg_fc_20261112_*.sql） */
function loadFc(){STORES.filter(function(s){return s.k==(selfKey()||"spk");}).forEach(function(s){var c=sbOf(s.k);if(!c)return;
  if(window.LAND_FC_TEST){FC[s.k]=window.LAND_FC_TEST;landSoon();return;}
  fetch(c[0]+"/rest/v1/rpc/mtg_fc",{method:"POST",headers:{apikey:c[1],Authorization:"Bearer "+c[1],"Content-Type":"application/json"},body:JSON.stringify({p_store:s.k})}).then(function(r){return r.ok?r.json():null;}).then(function(j){FC[s.k]=j&&j.months?j:{err:1};landSoon();}).catch(function(){FC[s.k]={err:1};landSoon();});});}
var FN={};  /* 2026-11-12 mtg_fc_next：翌月・翌々月を日別の埋まり方×リードタイム×直近の入り方で読む（docs/sql/mtg_fc_next_20261112.sql） */
function loadNext(){STORES.filter(function(s){return s.k==(selfKey()||"spk");}).forEach(function(s){var c=sbOf(s.k);if(!c)return;
  if(window.LAND_FN_TEST){FN[s.k]=window.LAND_FN_TEST;landSoon();return;}
  fetch(c[0]+"/rest/v1/rpc/mtg_fc_next",{method:"POST",headers:{apikey:c[1],Authorization:"Bearer "+c[1],"Content-Type":"application/json"},body:JSON.stringify({p_store:s.k})}).then(function(r){return r.ok?r.json():null;}).then(function(j){FN[s.k]=j&&j.k?j:{err:1};landSoon();}).catch(function(){FN[s.k]={err:1};landSoon();});});}
function loadTrend(){loadFree();loadFc();loadNext();STORES.filter(function(s){return s.k==(selfKey()||"spk");}).forEach(function(s){var c=sbOf(s.k);if(!c){setTimeout(loadTrend,1500);return;}
  fetch(c[0]+"/rest/v1/rpc/"+s.rpc,{method:"POST",headers:{apikey:c[1],Authorization:"Bearer "+c[1],"Content-Type":"application/json"},body:"{}"}).then(function(r){return r.ok?r.json():null;}).then(function(j){TR[s.k]=j&&j.mon?j:{err:1};landSoon();}).catch(function(){TR[s.k]={err:1};landSoon();});});}
var started=0,poll=null;
window.landOpen=function(){if(!started){started=1;setTimeout(loadTrend,300);}
  clearInterval(poll);poll=setInterval(function(){draw();var sk=selfKey()||"spk";if(ready(sk)&&TR[sk])clearInterval(poll);},700);draw();};
window.landRefresh=function(){TR={};setTimeout(loadTrend,800);clearInterval(poll);poll=setInterval(function(){draw();var sk=selfKey()||"spk";if(ready(sk)&&TR[sk])clearInterval(poll);},700);};
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
/* 2026-11-12 オーナー「店舗別」：各店のページではその店の着地見込みだけを出す（他店の iframe は開かない） */
function draw(){var el=document.getElementById("land");if(!el||!landVisible())return;css();
  var sk=selfKey()||"spk",S0=STORES.filter(function(s){return s.k==sk;})[0]||STORES[0],x=getX(S0.k),rdy=ready(S0.k);
  var cur=jstNow().toISOString().slice(0,7),today=jstNow().toISOString().slice(0,10),day=+today.slice(8),dim=dimOf(cur);
  var H='<div class="lh">📈 着地見込み（'+S0.nm+'）</div>';
  H+='<div class="lsub">現在実績＝今入っている予約の売上（返却月で計上・キャンセル/テスト除外）＋予約外売上。着地見込み＝現在実績＋これから入る見込みの売上（今月・来月・再来月＝下の試算根拠の計算。過去月で答え合わせして外れが一番小さい式を採用／それより先＝サマリの「まとめ 着地」と同じ値）。確定月は実績＝着地。DBライブ（開いている間は5分ごとに更新）。'+(x&&x.gen?' 最終取得 '+x.gen.slice(5):'')+'</div>';
  if(!rdy)H+='<div class="wait">⏳ 計算を読み込み中…（設計・予約ペースを読み込んで計算しています）</div>';
  var v=mv(x,cur);
  // ① 今月
  H+='<div class="lh">🗓 今月（'+MN(cur)+'）　'+day+'日目／'+dim+'日・経過 '+(day-1)+'日・残り '+(dim-day+1)+'日（今日を含む）</div>';
  var SC=v?fc(x,cur):null,FX=v?fx(x,SC):null;
  if(v){var z=v.z,cap=0,pk=0;z.cls.forEach(function(c){cap+=c.cap;pk+=c.pk;});if(SC){cap=SC.free;pk=SC.pk;v={st:1,t:v.t,a:v.a,L:SC.L,rd:v.rd,ad:v.ad,f:v.rd+SC.pk,n:v.n,z:v.z};}if(FX)v={st:1,t:v.t,a:v.a,L:FX.L,rd:v.rd,ad:v.ad,f:v.f,n:v.n,z:v.z};
    H+='<div class="lcards" style="grid-template-columns:minmax(0,320px)">'+card(S0.nm,S0.col,v.t,v.a,v.L,v.rd,v.f,v.ad,cap,"")+'</div>';
    H+='<div class="lh">📋 今月の進み具合（日数・進捗・空き）</div><div class="lw"><table><thead><tr><th class="l">店</th><th>台数</th><th>稼働可能<br>日数</th><th>予約済み<br>日数</th><th>予約<br>稼働率</th><th>残りの<br>空き日数</th><th>これから入る<br>見込み日数</th><th>着地<br>稼働率</th><th class="g">目標</th><th class="g">現在実績</th><th class="g">見込み<br>追加</th><th class="g">着地見込み</th><th class="g">着地−目標</th><th class="g">達成<br>見込み</th><th>目標まで<br>あと</th><th>あと1日<br>あたり</th></tr></thead><tbody>'
      +prow(S0.nm,v.n,v.ad,v.rd,cap,pk,v.f,v.t,v.a,v.L,z.left,"")+'</tbody></table></div>';
    H+='<div class="lsub">予約済み日数＝今月の貸出日数（今日より前の分を含む）／残りの空き日数＝明日〜月末の（配車表の台数−整備−貸出中）の合計（実数）／見込み日数・着地見込み＝下の「試算根拠」の計算／あと1日あたり＝（目標−現在実績）÷残り日数。</div>';}
  else H+='<div class="muted">読み込み中…</div>';
  // ② 月別推移
  if(x){var ms=Object.keys(x.hist).concat(Object.keys(x.mon)).sort();
    H+='<div class="lh">📊 月別 現在実績／着地見込み</div><div class="lw"><table><thead><tr><th class="l">月</th><th class="l">状態</th><th>台数</th><th>稼働可能日数</th><th>予約済み日数</th><th>稼働率</th><th>見込み日数</th><th>着地稼働率</th><th>1日単価</th><th class="g">目標</th><th class="g">現在実績</th><th class="g">着地見込み</th><th class="g">差</th><th class="g">達成</th></tr></thead><tbody>';
    ms.forEach(function(m){var w=mv(x,m);if(!w)return;if(SC&&m==cur){w.L=SC.L;w.f=w.rd+SC.pk;}if(FX&&m==cur)w.L=FX.L;var NX=m>cur?nx(x,m):null;if(NX){w.L=NX.L;w.f=w.rd+Math.max(0,NX.fd-NX.ob);}var pk=w.st?w.f-w.rd:0,ur=w.st?(w.z.ar&&w.rd?w.z.ar/w.rd:0):(w.h.r&&w.rd?w.h.r/w.rd:0);
      H+='<tr class="clk'+(w.st==1?' cur':'')+(MSEL==m?' sel':'')+'" onclick="landMon(\''+m+'\')"><td class="l"><b>'+MNy(m)+'</b></td><td class="l">'+stl(w.st)+'</td><td>'+w.n+'台</td><td>'+k(w.ad)+'</td><td>'+k(w.rd)+'</td><td>'+P(w.rd,w.ad)+'</td><td>'+(w.st?'+'+k(pk):'<span class="muted">–</span>')+'</td><td>'+P(w.f,w.ad)+'</td><td>'+(ur?y(ur):'–')+'</td><td>'+(w.t?y(w.t):'–')+'</td><td>'+y(w.a)+'</td><td><b>'+y(w.L)+'</b></td><td>'+(w.t?sg(w.L-w.t,y):'')+'</td><td class="'+(w.L>=w.t?'lpos':'lneg')+'">'+(w.t?P(w.L,w.t):'–')+'</td></tr>';});
    H+='</tbody></table></div><div class="lsub">確定＝過去の月（実績で確定）／進行中＝今月／受付中＝来月以降（今の予約＋これから入る見込み）。月の行をクリックで、その月の試算根拠（クラス別）。</div>';
    var mm=MSEL&&mv(x,MSEL)?MSEL:cur;var NM=mm>cur?nx(x,mm):null;H+='<div id="landDet"></div>'+(mm==cur&&SC?'':(NM?nxHtml(S0,x,NM):'')+why(S0,x,mm));
    if(mm==cur&&FX)H+=fxHtml(S0,x,FX);
    if(mm==cur)H+=SC?fcHtml(S0,x,SC,FX):'<div class="wait">今月の試算に使う実績データ（DB関数 '+S0.k+'_mtg_free）を読み込み中、または読めませんでした。それまでは上の数字はサマリの着地（リードタイム式）です。</div>';
    H+=trend(S0,x);}
  // ⑤ 計算方法
  H+='<div class="lh">📐 計算方法（3店共通）</div><div class="lsub" style="font-size:12px;color:#334155">'
   +'<b>現在実績</b>＝返却日がその月の予約の売上合計（基本料金＋オプション−割引。キャンセル・テスト除外）＋予約外売上（会計の予約外）。KPIタブ・サマリと同じ。<br>'
   +'<b>今月の着地見込み</b>＝現在実績−キャンセル見込み＋これから入る見込み。式は1つに決め打ちしない：複数の予測式を、過去の全部の月の「同じ日付時点」で答え合わせし、平均誤差が一番小さい式をその店で自動採用（毎日やり直す）。前提（進捗率・キャンセル率・後から入る率・単価）は確定した月が増えるたびに自動で更新。毎日23:55にその日の予測と前提を記録し、月が締まったら「どの指標が外れたか」を分解して表示。提供できる上限（下のクラス別の表の②）を超える分は見込まない。<br>'
   +'<b>クラス別の積み上げ（参考・供給の確認）</b>＝現在実績＋Σクラス（見込み日数×見込み単価）。見込み日数＝①需要（過去3か月の「同じ日付より後に入った率」×残り枠×受付件数のトレンド）と ②提供できる上限（配車表の日別の空きに平均泊数の予約が入る日数）の小さい方。空きがあるだけでは見込まない。<br>'
   +'<b>来月・再来月の着地見込み</b>＝現在実績＋（着地の予約売上−今の予約売上）。着地の予約売上は、その月の1日ごとに「今の予約×（1−キャンセル率）＋これから入る台数」を積み、台数の95%を上限にして、単価を掛けたもの＝稼働可能日数×着地稼働率×単価。これから入る台数は、過去の同じリードタイム（何日前か）・平日/土日での入り方（台数あたり／空き台数あたり）に、直近28日の入り方の強さを掛ける。前月の同じ日付時点からの伸び率の式も並べ、過去の月を同じ日付時点に戻して全部の式を答え合わせし、外れが一番小さい式を店ごとに採用。幅＝その式の過去の平均の外れ。<br>'
   +'<b>それより先の月</b>＝サマリと同じリードタイム式：Σクラス別着地＋予約外・未配車（その月の実績）。クラス別着地＝今の予約売上＋これから入る見込み日数×見込み単価。<br>'
   +'<b>これから入る見込み日数</b>＝今日〜月末の各日について「その日の今の予約台数 ÷ 過去（3〜9月）の予約で、貸出日の◯日前までに入っていた割合」で最終予約台数を推計し、今の予約を引いたもの（空き台数が上限）。まだ半分も入っていない遠い日は、今の予約＋（まだ入っていない割合×目標稼働率）で控えめに見込む。<br>'
   +'<b>見込み単価</b>＝予約済みの1日単価と内訳（目標）単価を、予約済み日数：見込み日数で加重平均。<br>'
   +'<b>目標</b>＝このページの月目標（高松は10月から）。クラス別の目標は🎯設計比較タブと同じ配分。<br>'
   +'<b>当月推移</b>＝今入っている予約を受付日の順に積み上げた売上（キャンセル済みは除く）。前の月と同じ日付時点の比較で、今月の予約の入り方が早いか遅いかを見る。</div>';
  el.innerHTML=H;
  /* 2026-11-12 オーナー「TOURISM進行管理のサマリに着地予測を・直近3ヶ月同じ数値を出す」：?landpost=1 で開かれた時（高松アプリのサマリが隠し iframe で開く）、このタブと同じ着地の数字を親ページへ渡す */
  if(POST_O&&x){try{var out={};Object.keys(x.hist).concat(Object.keys(x.mon)).forEach(function(m){var w=mv(x,m);if(!w)return;var L=w.L;if(m==cur&&SC)L=SC.L;if(m==cur&&FX)L=FX.L;var o={st:w.st,t:Math.round(w.t||0),a:Math.round(w.a||0),L:Math.round(L||0)};var N=m>cur?nx(x,m):null;if(N){o.L=Math.round(N.L);o.lo=Math.round(N.lo);o.hi=Math.round(N.hi);o.nx=1;o.thin=N.thin?1:0;}if(m==cur&&FX){o.lo=Math.round(FX.lo);o.hi=Math.round(FX.hi);}out[m]=o;});
    window.parent.postMessage({type:"hdm-land",store:S0.k,cur:cur,ready:!!(rdy&&(FX||(FC[S0.k]&&FR[S0.k]))&&FN[S0.k]),fx:!!FX,lo:FX?Math.round(FX.lo):null,hi:FX?Math.round(FX.hi):null,mae:FX?+FX.bm.mae:null,mon:out},POST_O);}catch(e){}}}
var POST_O=(function(){if((location.search.indexOf("landpost=1")<0&&!window.LAND_POST_FORCE)||window.parent===window)return "";var OK=["https://buddica-touring.github.io","https://nosh2318.github.io"],o="";try{o=location.ancestorOrigins&&location.ancestorOrigins.length?location.ancestorOrigins[0]:new URL(document.referrer).origin;}catch(e){}return OK.indexOf(o)>=0?o:"";})();
var MT={share:"進捗率式",add:"積み上げ式",blend:"進捗率式と積み上げ式の平均",addtr:"積み上げ式×受付トレンド",free:"積み上げ式（空き枠あたり＝稼働率を加味）",cls:"クラス別の積み上げ",ch:"経路別（OTA・公式）の積み上げ×経路のトレンド",io:"国内・海外別の積み上げ×トレンド",share3:"進捗率式（直近3か月だけ）",yoy:"前年同月の進捗率"};
var MTd={share:"受付済み売上 ÷ 過去の同じ日付時点の進捗率",add:"受付済み×（1−キャンセル率）＋ 後から入る売上（過去の実績：台数×残り日数あたり）",blend:"上の2つの平均",addtr:"積み上げ式の「後から入る」に、受付件数の直近28日÷前28日（0.7〜1.3倍）を掛ける",free:"後から入る売上を、空き枠（台数×残り日数−予約済み）あたりで見る",cls:"後から入る売上をクラスごとの率×クラスの残り枠で積む（人気クラス・動かないクラスを分ける）",ch:"後から入る売上を OTA・公式・その他に分け、経路ごとの受付トレンドを掛ける",io:"後から入る売上を国内・海外に分け、それぞれの受付トレンドを掛ける",share3:"進捗率式を直近3か月の実績だけで",yoy:"前年の同じ月の進捗率を使う（データが1年分たまると自動で候補に入る）"};
/* 今月の着地（mtg_fc）：採用式＝過去月の答え合わせで平均誤差が最小の式。着地＝現在実績（サマリと同じ）−キャンセル見込み＋これから入る見込み。提供できる上限（fc() の②）を超える分は切る */
function fx(x,SC){var G=FC[selfKey()||"spk"],z=x&&x.mon[x.cur];if(!G||G.err||!G.best||!z)return null;var M=G.months[x.cur];if(!M||!M.cur||!M.fc||M.fc[G.best]==null)return null;
  var bm=null;(G.methods||[]).forEach(function(m){if(m.k==G.best)bm=m;});if(!bm)return null;
  var A=M.all[1],F=M.fc[G.best],as=M.as||{},canc=-A*(as.chat||0),pick=Math.max(0,F-A-canc),pick0=pick,ud=z.rd&&z.ar>0?z.ar/z.rd:0,need=ud?pick/ud:0,cut=1;
  if(SC&&need>0&&SC.sup<need){cut=SC.sup/need;pick=pick*cut;}
  var L=z.a+canc+pick,e=+bm.mae||0,lo=z.a+Math.min(canc+pick,F*(1-e)-A),hi=cut<1?L:z.a+Math.max(canc+pick,F*(1+e)-A);
  return {G:G,M:M,bm:bm,A:A,F:F,as:as,canc:canc,pick:pick,pick0:pick0,ud:ud,need:need,cut:cut,sup:SC?SC.sup:null,L:L,lo:lo,hi:hi,a:z.a,ar:z.ar,t:z.t,Lsum:z.L};}
function pcs(v){return v===null||v===undefined||!isFinite(v)?'–':(v>0?'+':v<0?'−':'')+(Math.round(Math.abs(v)*1000)/10).toFixed(1)+'%';}
/* 確定した月の振り返り：予測（記録があれば記録・無ければ今のデータで再現）と実際の差を、キャンセル／後から入った件数／単価／式の差 に分解 */
function review(G,m){var act=G.months[m],lg=(G.logd||{})[m],D=lg||act;if(!act||act.cur||!D||!D.fc)return null;var bk=lg&&lg.best?lg.best:G.best,Fb=D.fc[bk];if(Fb==null||D.fc.add==null)return null;
  var as=D.as||{},A=D.all[1],R=act.all[7],pn=act.all[4],Pv=act.all[5],u=as.u||0,nh=as.nhat||0;
  var o={m:m,log:!!lg,snap:lg&&lg.snap,bk:bk,F:Fb,R:R,diff:R-Fb,canc:(R-Pv)-A*(1-(as.chat||0)),cnt:(pn-nh)*u,unit:Pv-pn*u,meth:D.fc.add-Fb,pn:pn,nh:nh,u:u,ua:pn?Pv/pn:0,ext0:lg&&lg.ext!=null?+lg.ext:null,ext1:+act.ext||0,chat:as.chat||0,ca:A?1-(R-Pv)/A:0,seg:null};
  var best=0,nm={cls:"クラス",ch:"経路",io:""};Object.keys(D.seg||{}).forEach(function(d){Object.keys(D.seg[d]).forEach(function(kk){var h=+D.seg[d][kk][9]||0,a2=((act.seg||{})[d]||{})[kk],av=a2?a2[4]:0,df=av-h;if(Math.abs(df)>Math.abs(best)){best=df;o.seg=nm[d]+kk+'：見込み'+d1(h)+'件→実際'+av+'件';}});});
  var f=[["キャンセル",o.canc],["後から入った件数",o.cnt],["後から入った予約の単価",o.unit],["式の差",o.meth]].sort(function(a,b){return Math.abs(b[1])-Math.abs(a[1]);});o.main=f[0][0];return o;}
function fxHtml(S0,x,X){var G=X.G,cur=x.cur,M=X.M,as=X.as,ms=Object.keys(G.months).sort(),past=ms.filter(function(m){return m<cur;}),tested=past.filter(function(m){return G.months[m].fc&&G.months[m].fc[G.best]!=null;}),dd=G.d;
  var H='<div class="why" id="landFx"><h5>🎯 '+S0.nm+' '+MN(cur)+'の着地 試算根拠（指標を追い、過去月で答え合わせした式で予測）</h5>';
  H+='<div class="eq"><b>着地見込み '+y(X.L)+'</b> ＝ 現在実績 '+y(X.a)+'（うち予約外売上 '+y(M.ext||0)+'） − キャンセル見込み '+y(-X.canc)+' ＋ これから入る見込み '+y(X.pick)+'　目標 '+y(X.t)+' に対して '+sg(X.L-X.t,y)+'（'+P(X.L,X.t)+'）</div>';
  H+='<div class="eq">採用した式：<b>'+MT[G.best]+'</b>（'+MTd[G.best]+'）。過去'+X.bm.n+'か月の同じ日付（'+dd+'日）時点で答え合わせした平均誤差 <b>±'+pc1(+X.bm.mae)+'</b>（最大 '+pc1(+X.bm.mx)+'）→ 幅 '+y(X.lo)+' 〜 '+y(X.hi)+(X.bm.n<3?'　<span class="lneg">※答え合わせできる月がまだ'+X.bm.n+'か月だけ＝精度は月を重ねて上がる</span>':'')+'　<span class="muted">参考：サマリの着地（リードタイム式） '+y(X.Lsum)+'</span></div>';
  if(X.need>0&&X.sup!==null)H+='<div class="eq">供給の確認：これから入る見込み '+y(X.pick0)+' ÷ 今月の予約済み1日単価 '+y(X.ud)+' ＝ 約'+k(X.need)+'日分。平均泊数で提供できる上限は '+k(X.sup)+'日（下の表の②）→ '+(X.cut<1?'<b class="lneg">空きが足りないので '+y(X.pick)+' までに抑えた</b>':'<b class="lpos">提供できる</b>')+'。</div>';
  // ① 追う指標
  function td(v){return '<td>'+v+'</td>';}
  function row(lb,f,asv,cv){return '<tr><td class="l">'+lb+'</td>'+past.map(function(m){return td(f(G.months[m],m));}).join('')+'<td style="background:#f0fdfa"><b>'+asv+'</b></td><td style="background:#fefce8"><b>'+cv+'</b></td></tr>';}
  H+='<div class="lh" style="font-size:13px">① 追う指標（毎月・同じ日付＝'+dd+'日時点でそろえて比較）</div><div class="lw"><table><thead><tr><th class="l">指標</th>'+past.map(function(m){return '<th>'+MNy(m)+'</th>';}).join('')+'<th class="g">過去まとめ<br>＝今月の前提</th><th class="g">'+MN(cur)+'<br>（今）</th></tr></thead><tbody>'
   +row('台数',function(q){return q.n+'台';},'',M.n+'台')
   +row('受付済みの予約売上（'+dd+'日時点）',function(q){return y(q.all[1]);},'',y(X.A))
   +row('予約外売上（会計の予約外・今の値）',function(q){return y(q.ext||0);},'',y(M.ext||0))
   +row('最終の予約売上',function(q){return y(q.all[7]);},'','予測 '+y(X.F))
   +row('<b>予約の進捗率</b>（受付済み÷最終）',function(q){return P(q.all[1],q.all[7]);},as.sh?pc1(+as.sh):'–',P(X.A,X.F))
   +row('<b>その後のキャンセル率</b>（売上）',function(q){return q.all[1]?pc1(q.all[3]/q.all[1]):'–';},pc1(+as.chat),'見込み '+y(-X.canc))
   +row('<b>後から入った件数</b>（当月内の予約）',function(q){return q.all[4]+'件';},'',' 見込み '+d1(+as.nhat||0)+'件')
   +row('後から入った率（件数÷台数×残り日数）',function(q){return q.cap?pc1(q.all[4]/q.cap):'–';},pc1(+as.rate),'残り枠 '+k(M.cap))
   +row('<b>後から入った予約の単価</b>（1件）',function(q){return q.all[4]?y(q.all[5]/q.all[4]):'–';},as.u?y(+as.u):'–','')
   +row('<b>受付トレンド</b>（直近28日÷前28日の受付件数）',function(q){return q.tr[2]&&q.tr[1]?'×'+(q.tr[0]/q.tr[1]).toFixed(2):'–';},'',M.tr[2]&&M.tr[1]?'×'+(M.tr[0]/M.tr[1]).toFixed(2)+'（'+M.tr[0]+'／'+M.tr[1]+'件）':'–')
   +row('<b>稼働率</b>（'+dd+'日時点→最終）',function(q){return P(q.occ[0],q.occ[2])+'→'+P(q.occ[1],q.occ[2]);},'',P(M.occ[0],M.occ[2]))
   +row('残りの空き枠（台数×残り日数−予約済み）',function(q){return k(q.free)+'日';},'',k(M.free)+'日')
   +row('<b>平均リードタイム</b>（受付→貸出）',function(q){return q.all[8]!==null?q.all[8]+'日':'–';},'',M.all[8]!==null?M.all[8]+'日':'–')
   +'</tbody></table></div>';
  H+='<div class="lsub">売上＝返却月で計上する予約売上（キャンセル・テスト除外。サマリと同じ）。受付日＝予約が登録された日。「過去まとめ」＝確定した全部の月を合算した率で、月が確定するたびに自動で更新（直近3か月に限らない）。'+(G.start?'データは '+MNy(G.start)+' から（それ以前は受付日が一括取込で正しくないので使わない）。':'')+'前年同月のデータが貯まると「前年同月の進捗率」式（季節性）が自動で候補に入る。</div>';
  // ② 切り口
  var DN=[["cls","クラス"],["ch","経路"],["io","国内・海外"]];
  H+='<div class="lh" style="font-size:13px">② 切り口別（人気クラス・動かないクラス／OTA・公式／国内・海外）</div><div class="lw"><table><thead><tr><th class="l">切り口</th><th>台数</th><th>'+MN(cur)+' 受付済み<br>件数</th><th>売上</th><th>構成比</th><th>受付件数<br>直近28日／前28日</th><th>平均<br>リードタイム</th>'+past.map(function(m){return '<th>'+MNy(m)+'<br>後から</th>';}).join('')+'<th class="g">'+MN(cur)+' 後から入る<br>見込み件数</th><th class="g">見込み売上</th></tr></thead><tbody>';
  DN.forEach(function(dn){var S=(M.seg||{})[dn[0]]||{},ks=Object.keys(S).sort(function(a,b){return S[b][1]-S[a][1];});
    ks.forEach(function(kk,i){var q=S[kk];if(!q[0]&&!q[8]&&!q[9]&&!past.some(function(m){var z=((G.months[m].seg||{})[dn[0]]||{})[kk];return z&&z[6];}))return;
      var slow=dn[0]=='cls'&&q[8]>0&&(+q[9]||0)<0.5;
      H+='<tr><td class="l"><span class="muted">'+dn[1]+'</span> <b>'+kk+'</b>'+(slow?' <small class="lneg">動きが少ない</small>':'')+'</td><td>'+(dn[0]=='cls'?q[8]+'台':'')+'</td><td>'+q[0]+'件</td><td>'+y(q[1])+'</td><td>'+P(q[1],X.A)+'</td><td>'+q[11]+'／'+q[12]+'</td><td>'+(q[15]!==null?q[15]+'日':'–')+'</td>'
        +past.map(function(m){var z=((G.months[m].seg||{})[dn[0]]||{})[kk];return '<td>'+(z?z[4]+'件':'–')+'</td>';}).join('')+'<td><b>'+d1(+q[9]||0)+'件</b></td><td>'+y(+q[10]||0)+'</td></tr>';});});
  H+='</tbody></table></div><div class="lsub">後から＝その月の'+dd+'日より後に受付されて、その月に返却された予約の件数。見込み件数＝過去の月の「後から入った件数÷（台数×残り日数）」×今月の残り枠（切り口ごと）。クラス＝配車表の車両のクラス。海外＝電話番号が国内形式でない予約。</div>';
  // ③ 式の答え合わせ
  H+='<div class="lh" style="font-size:13px">③ 予測式の答え合わせ（過去の各月を、その月より前のデータだけで'+dd+'日時点に予測→最終実績との誤差）</div><div class="lw"><table><thead><tr><th class="l">予測式</th>'+tested.map(function(m){return '<th>'+MNy(m)+'</th>';}).join('')+'<th class="g">平均誤差</th><th class="g">偏り</th><th class="g">'+MN(cur)+'の予測<br>（予約売上）</th></tr></thead><tbody>';
  H+='<tr><td class="l muted">最終実績（予約売上）</td>'+tested.map(function(m){return '<td class="muted">'+y(G.months[m].all[7])+'</td>';}).join('')+'<td></td><td></td><td></td></tr>';
  (G.methods||[]).slice().sort(function(a,b){return a.mae-b.mae;}).forEach(function(mt){var on=mt.k==G.best;
    H+='<tr'+(on?' class="sel"':'')+'><td class="l">'+(on?'✅ ':'')+'<b>'+MT[mt.k]+'</b>'+(on?' <small>採用</small>':'')+'<br><small class="muted">'+MTd[mt.k]+'</small></td>'+tested.map(function(m){var q=G.months[m],v=q.fc[mt.k];return '<td>'+(v==null||!q.all[7]?'–':pcs(v/q.all[7]-1))+'</td>';}).join('')+'<td><b>±'+pc1(+mt.mae)+'</b></td><td>'+pcs(+mt.bias)+'</td><td>'+(M.fc[mt.k]!=null?y(M.fc[mt.k]):'–')+'</td></tr>';});
  H+='</tbody></table></div><div class="lsub">＋＝予測が実績より多かった／−＝少なかった。平均誤差が一番小さい式を自動で採用（月が確定するたび・毎日やり直すので、当たらなくなった式は自動で外れる）。偏り＝いつも多め（＋）か少なめ（−）か。</div>';
  // ④ 月末の振り返り
  var rv=past.map(function(m){return review(G,m);}).filter(Boolean).reverse();
  if(rv.length){H+='<div class="lh" style="font-size:13px">④ 月末の振り返り（'+dd+'日時点の予測と実際の差を、どの指標が外れたかに分解）</div><div class="lw"><table><thead><tr><th class="l">月</th><th class="l">予測の出どころ</th><th>予測</th><th>実際</th><th>差（実際−予測）</th><th class="g">キャンセル<br>の外れ</th><th class="g">後から入った<br>件数の外れ</th><th class="g">単価<br>の外れ</th><th class="g">式の差</th><th>予約外売上<br>の変化</th><th class="l">一番外れた指標</th><th class="l">一番外れた切り口</th></tr></thead><tbody>';
    rv.forEach(function(o){H+='<tr><td class="l"><b>'+MNy(o.m)+'</b></td><td class="l">'+(o.log?'記録（'+o.snap.slice(5)+'）':'<span class="muted">再現</span>')+'<br><small class="muted">'+MT[o.bk]+'</small></td><td>'+y(o.F)+'</td><td>'+y(o.R)+'</td><td>'+sg(o.diff,y)+'（'+pcs(o.F?o.diff/o.F:0)+'）</td>'
      +'<td>'+sg(o.canc,y)+'<br><small class="muted">見込み'+pc1(o.chat)+'→実際'+pc1(o.ca)+'</small></td><td>'+sg(o.cnt,y)+'<br><small class="muted">見込み'+d1(o.nh)+'件→実際'+o.pn+'件</small></td><td>'+sg(o.unit,y)+'<br><small class="muted">見込み'+y(o.u)+'→実際'+(o.ua?y(o.ua):'–')+'</small></td><td>'+sg(o.meth,y)+'</td><td>'+(o.ext0===null?'<span class="muted">記録なし<br>最終 '+y(o.ext1)+'</span>':sg(o.ext1-o.ext0,y)+'<br><small class="muted">記録'+y(o.ext0)+'→最終'+y(o.ext1)+'</small>')+'</td><td class="l"><b>'+o.main+'</b></td><td class="l">'+(o.seg||'–')+'</td></tr>';});
    H+='</tbody></table></div><div class="lsub">差＝予約売上の差＝キャンセルの外れ＋件数の外れ＋単価の外れ＋式の差（積み上げ式と採用式の違い）。予約外売上の変化＝記録した日の予約外売上と最終の差（あとから修正・追加された分）。記録＝その日に実際に出した予測（毎日23:55に保存）。再現＝記録を始める前の月を、今のデータからその日時点に戻して計算（金額変更・削除された予約は戻せない）。外れた指標は、次の月の「前提」に自動で反映される（確定月を全部合算し直すため）。</div>';}
  // ⑤ 毎日の記録
  var lg=((G.log||{})[cur]||[]).slice(-31);
  H+='<div class="lh" style="font-size:13px">⑤ 毎日の記録（'+MN(cur)+'・その日の予測と試算根拠＝月末の答え合わせの元）</div>'+(lg.length?'<div class="lw"><table><thead><tr><th class="l">記録日</th><th class="l">採用式</th><th class="g">着地見込み<br>（予約＋予約外）</th><th>予約売上<br>の予測</th><th>受付済み<br>予約売上</th><th>予約外<br>売上</th><th>進捗率<br>の前提</th><th>キャンセル率<br>の前提</th><th>後から入る<br>件数の見込み</th><th>後から入る<br>単価の前提</th><th>受付トレンド<br>係数</th><th>残りの<br>空き枠</th></tr></thead><tbody>'+lg.map(function(r){var has=r.length>4&&r[4]!=null;return '<tr><td class="l">'+r[0].slice(5)+'</td><td class="l">'+(MT[r[1]]||r[1]||'–')+'</td><td><b>'+(r[2]!=null&&has?y(+r[2]+(+r[4])):'–')+'</b></td><td>'+(r[2]!=null?y(r[2]):'–')+'</td><td>'+y(r[3])+'</td><td>'+(has?y(r[4]):'–')+'</td><td>'+(r[9]!=null?pc1(+r[9]):'–')+'</td><td>'+(r[5]!=null?pc1(+r[5]):'–')+'</td><td>'+(r[6]!=null?d1(+r[6])+'件':'–')+'</td><td>'+(r[7]!=null?y(r[7]):'–')+'</td><td>'+(r[8]!=null?'×'+(+r[8]).toFixed(2):'–')+'</td><td>'+(r[10]!=null?k(r[10])+'日':'–')+'</td></tr>';}).join('')+'</tbody></table></div>':'<div class="lsub">まだ記録がありません（毎日23:55に自動で1行ずつ貯まります）。</div>')
   +'<div class="lsub">各行＝その日（23:55）に保存した予測と前提。このほかクラス別・経路別・国内海外別の見込み件数と、全部の式の予測値も一緒に保存している（④の振り返りで使う）。着地見込み（予約＋予約外）＝予約売上の予測＋その日の予約外売上（画面上部の着地は、提供できる上限の確認後の値）。</div>'
   +'<div class="lsub">仕組み：毎日その日の予測・前提・全式の値を記録 → 月が締まったら④で答え合わせ（どの指標が外れたか）→ 確定月が前提と③の採用式に自動で入る＝修正と学習が同時に回る。</div>';
  return H+'</div>';}
/* 2026-11-12 オーナー「読めないのをどう読み切るか」「設定単価と稼働率で読むべき」「前月の今ぐらいで翌月がどのくらい本数・売上あったかのパターン」「当月予約率も合わせる」：
   来月・再来月の着地（mtg_fc_next）。式の候補＝日別の積み上げ5案（p＝台数あたり／f＝空き台数あたり × 直近28日の入り方を 0・半分・全部 反映）＋同じ時点からの伸び率（中央値）＋直前の確定月と同じ伸び率＋全部の中央値。
   過去の月を同じ日付時点に戻した予測と実績の差（平均）が最小の式を採用。確定月が2か月に満たない店は「空き台数あたり×半分反映」を仮採用し、幅は式の間の最小〜最大 */
var NT={"p0":"台数あたりの入り方","p0.5":"台数あたりの入り方×直近の入り方（半分反映）","f0":"空き台数が埋まる率","f0.5":"空き台数が埋まる率×直近の入り方（半分反映）","f1":"空き台数が埋まる率×直近の入り方（全部反映）",ratio:"同じ時点からの伸び率（過去月の中央値）",ana:"直前の確定月と同じ伸び率",ens:"全部の式の中央値"};
function avgA(a){var s=0;a.forEach(function(v){s+=v;});return a.length?s/a.length:0;}
function medA(a){var b=a.slice().sort(function(p,q){return p-q;}),n=b.length;return n?(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2):0;}
function nx(x,m){var G=FN[selfKey()||"spk"],z=x&&x.mon[m];if(!G||G.err||!G.k||!z||m<=x.cur)return null;
  var kk=null;Object.keys(G.k).forEach(function(q){if(G.k[q]&&G.k[q].ym==m)kk=q;});if(!kk)return null;
  var rows=G.k[kk].rows||[],T=null,past=[];rows.forEach(function(r){if(r[0]==m)T=r;else if(r[0]<x.cur&&+r[4]>0&&+r[6]>0)past.push(r);});
  if(!T||!T[8])return null;
  var cap=+T[2],ob=+T[3],obr=+T[4];
  function pv(r,key){var o=null;(r[8]||[]).forEach(function(v){if(v[0]==key)o=v;});return o;}
  function mk(key,F,pr,fd){var e=[],b=0;pr.forEach(function(p,i){if(p===null)return;var d=(p-+past[i][6])/+past[i][6];e.push(Math.abs(d));b+=d;});return {k:key,F:F,fd:fd,pr:pr,n:e.length,mae:e.length?avgA(e):null,bias:e.length?b/e.length:null};}
  var M=[];T[8].forEach(function(v){M.push(mk(v[0],+v[4],past.map(function(r){var q=pv(r,v[0]);return q?+q[4]:null;}),+v[3]));});
  var rt=past.map(function(r){return +r[6]/+r[4];});
  if(rt.length>=2){M.push(mk("ratio",obr*medA(rt),past.map(function(r,i){return +r[4]*medA(rt.filter(function(_,j){return j!=i;}));})));
    M.push(mk("ana",obr*rt[rt.length-1],past.map(function(r,i){return i?+r[4]*rt[i-1]:null;})));}
  M.push(mk("ens",medA(M.map(function(q){return q.F;})),past.map(function(r,i){var a=[];M.forEach(function(q){if(q.pr[i]!==null)a.push(q.pr[i]);});return a.length?medA(a):null;})));
  var cand=M.filter(function(q){return q.mae!==null&&q.n>=2;}).sort(function(a,b){return a.mae-b.mae;});
  var thin=!cand.length,best=cand[0]||M.filter(function(q){return q.k=="f0.5";})[0]||M[0],F=best.F,lo,hi;
  if(!thin){lo=F*(1-best.mae);hi=F*(1+best.mae);}else{var Fs=M.map(function(q){return q.F;});lo=Math.min.apply(null,Fs);hi=Math.max.apply(null,Fs);}
  var ref=pv(T,"f0.5")||T[8][0],ru=(+ref[3]-ob)>0?(+ref[4]-obr)/(+ref[3]-ob):(ob?obr/ob:0),fd=best.fd||(ru>0?Math.max(ob*0.9,ob+(F-obr)/ru):+ref[3]);
  return {m:m,kk:+kk,T:T,past:past,M:M,cand:cand,best:best,thin:thin,F:F,L:z.a+(F-obr),lo:z.a+(lo-obr),hi:z.a+(hi-obr),cap:cap,ob:ob,obr:obr,fd:Math.min(fd,cap),c:+T[7],seg:G.k[kk].seg||[],s:T[1],z:z};}
function nxHtml(S0,x,N){var z=N.z,m=N.m,b=N.best,pm=N.past.map(function(r){return r[0];}),SG=["","1〜10日","11〜20日","21〜26日","27日〜月末"];
  var H='<div class="why" id="landNx"><h5>🧮 '+S0.nm+' '+MN(m)+'の着地見込み（'+(N.kk==1?'来月':'再来月')+'）— 稼働率 × 単価で読む</h5>';
  H+='<div class="eq">着地見込み <b>'+y(N.L)+'</b>（幅 '+y(N.lo)+'〜'+y(N.hi)+'）＝ 現在実績 '+y(z.a)+' ＋ これから増える見込み '+sg(N.F-N.obr,y)+'</div>';
  H+='<div class="eq">予約売上の着地 '+y(N.F)+' ＝ 稼働可能 '+k(N.cap)+'日 × 着地稼働率 '+P(N.fd,N.cap)+'（'+k(N.fd)+'日）× 1日単価 '+(N.fd?y(N.F/N.fd):'–')+'</div>';
  H+='<div>今（'+N.s.slice(5).replace("-","/")+'時点）：貸出 '+k(N.ob)+'日＝稼働率 '+P(N.ob,N.cap)+'・1日単価 '+(N.ob?y(N.obr/N.ob):'–')+'・予約売上 '+y(N.obr)+'（貸出日で日割り）。これから +'+k(Math.max(0,N.fd-N.ob))+'日。'+(z.t?'目標 '+y(z.t)+' に対して '+sg(N.L-z.t,y)+'（'+P(N.L,z.t)+'）。':'')+'</div>';
  H+='<div>直近28日の入り方＝過去の同じ時期（同じ何日前）の <b>'+(Math.round(N.c*100)/100).toFixed(2)+'倍</b>'+(N.c>=1.15?'（強い）':N.c<=0.85?'（弱い）':'（ほぼ同じ）')+'。採用した式＝<b>'+(NT[b.k]||b.k)+'</b>'+(N.thin?'（仮採用：確定月が足りず答え合わせ前。幅は式の間の最小〜最大）':'（過去'+b.n+'か月の答え合わせで平均の外れ '+pcs(b.mae).replace(/^[+−]/,'')+'・偏り '+pcs(b.bias)+'）')+'</div>';
  if(N.seg.length){H+='<div class="lw" style="margin-top:6px"><table><thead><tr><th class="l">月内の区間</th><th>稼働可能</th><th>今の予約</th><th>今の稼働率</th><th>着地の見込み</th><th>着地稼働率</th><th>これから</th></tr></thead><tbody>';
    N.seg.forEach(function(g){H+='<tr><td class="l">'+SG[g[0]]+'</td><td>'+k(g[1])+'日</td><td>'+k(g[2])+'日</td><td>'+P(g[2],g[1])+'</td><td>'+k(g[3])+'日</td><td>'+P(g[3],g[1])+'</td><td>+'+k(Math.max(0,g[3]-g[2]))+'日</td></tr>';});
    H+='</tbody></table></div><div class="lsub">区間別は「空き台数が埋まる率」の式での内訳（どこが埋まっていて、どこに伸びしろがあるか）。</div>';}
  H+='<div class="lw" style="margin-top:6px"><table><thead><tr><th class="l">式（過去月を同じ日付時点に戻して答え合わせ）</th>'+pm.map(function(q){return '<th>'+MNy(q)+'<br><small>予測→実績との差</small></th>';}).join('')+'<th>平均の外れ</th><th>偏り</th><th class="g">'+MN(m)+'の予約売上</th><th class="g">着地見込み</th></tr></thead><tbody>';
  N.M.slice().sort(function(p,q){return (p.mae===null?9:p.mae)-(q.mae===null?9:q.mae);}).forEach(function(q){
    H+='<tr'+(q===b?' class="cur"':'')+'><td class="l">'+(q===b?'✅ ':'')+(NT[q.k]||q.k)+'</td>'+q.pr.map(function(p,i){return '<td>'+(p===null?'–':man(p)+' <small>'+pcs((p-+N.past[i][6])/+N.past[i][6])+'</small>')+'</td>';}).join('')+'<td>'+(q.mae===null?'–':pcs(q.mae).replace(/^[+−]/,''))+'</td><td>'+(q.bias===null?'–':pcs(q.bias))+'</td><td>'+y(q.F)+'</td><td><b>'+y(z.a+q.F-N.obr)+'</b></td></tr>';});
  H+='<tr class="tot"><td class="l">その時点の予約売上 → 実績</td>'+N.past.map(function(r){return '<td>'+man(+r[4])+' → '+man(+r[6])+' <small>×'+(Math.round(+r[6]/+r[4]*100)/100).toFixed(2)+'</small></td>';}).join('')+'<td></td><td></td><td>今 '+y(N.obr)+'</td><td></td></tr></tbody></table></div>';
  H+='<div class="lsub">各式は、その月自身のデータを使わずに予測しています。月が締まるたびに答え合わせの月が1つ増え、採用する式と幅が自動で更新されます。前年の同じ月のデータが無いため、季節の違い（年末年始・冬）は「直近28日の入り方」と「今の予約の位置」からしか読めていません。下は参考：以前のリードタイム式（サマリの「まとめ 着地」）の内訳です。</div>';
  return H+'</div>';}
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

/* 2026-11-12 オーナー「空いているから売れるじゃない／傾向と実績だろ」「過去の当月予約率・リードタイム・残日数・トレンド・稼働率・単価 全ての要素」「試算根拠の精度が重要」：
   今月の着地は、このタブ独自にデータから組む（サマリの計算は変えない）。DB関数 *_mtg_free（配車表ベース）を使う。
   ① 需要＝過去3か月の同じ日付より後に受付されて残り期間（翌日〜月末）に入った貸出日数 ÷（台数×残り日数）＝「後から入った率」（クラス別・3か月をまとめて計算。台数×日が30未満のクラスは店全体の率）
        × 今月の残り枠（明日〜月末の 台数−整備）× トレンド（受付件数 直近28日÷その前28日・0.5〜1.5倍・件数20未満のクラスは店全体）
   ② 提供できる上限＝配車表の日別の空き（台数−整備−貸出中）に、平均泊数（直近3か月・四捨五入）の予約を左から詰めて入る本数×泊数（月末を越える予約は翌月の売上なので入れない）
   見込み日数＝①と②の小さい方。単価＝今月の予約済み1日単価 ×（過去3か月の 後から入った予約の日割り単価 ÷ 先に入っていた予約の日割り単価・店全体・0.7〜1.3倍）
   着地＝現在実績＋Σ見込み日数×単価。幅＝後から入った率を「過去3か月で一番低い月／高い月」に置き換えた場合 */
function clip(v,a,b){return Math.max(a,Math.min(b,v));}
function fc(x,m){var F=FR[selfKey()||"spk"],z=x.mon[m];if(!F||F.err||!F.cls||!z||!x.hc)return null;if((F.today||"").slice(0,7)!=m)return null;
  var pms=Object.keys(F.past||{}).sort(),PM=[],sPu=0,sCap=0,sPr=0,sBr=0,sBk=0,tA=0,tB=0;
  pms.forEach(function(pm){var P=F.past[pm],hc=x.hc[pm]||{},cap=0,pu=0;Object.keys(hc).forEach(function(c){cap+=hc[c]*P.rest;});Object.keys(P.cls||{}).forEach(function(c){var q=P.cls[c];pu+=q[0];sPr+=q[3];sBr+=q[4];sBk+=q[1];});
    PM.push({m:pm,rest:P.rest,cap:cap,pu:pu,rate:cap?pu/cap:null});sPu+=pu;sCap+=cap;});
  Object.keys(F.tr||{}).forEach(function(c){tA+=F.tr[c][0];tB+=F.tr[c][1];});
  var sRate=sCap?sPu/sCap:0,sTr=tB?clip(tA/tB,.5,1.5):1,uR=(sPu>=5&&sBk>=5&&sBr>0)?clip((sPr/sPu)/(sBr/sBk),.7,1.3):1;
  var rs=PM.filter(function(p){return p.rate!==null;}).map(function(p){return p.rate;}),lowF=sRate&&rs.length?Math.min.apply(null,rs)/sRate:1,highF=sRate&&rs.length?Math.max.apply(null,rs)/sRate:1;
  var zc={};z.cls.forEach(function(c){zc[c.c]=c;});
  var keys=z.cls.map(function(c){return c.c;});Object.keys(F.cls).sort().forEach(function(c){if(keys.indexOf(c)<0&&c!="未配車"&&(F.cls[c].n||[]).some(function(v){return v>0;}))keys.push(c);});
  var R={rows:[],PM:PM,sRate:sRate,sTr:sTr,tA:tA,tB:tB,uR:uR,lowF:lowF,highF:highF,free:0,cap:0,bk:0,dem:0,sup:0,pk:0,add:0,lo:0,hi:0,lead:0,rest:0};
  keys.forEach(function(c){var A=F.cls[c]||{n:[],m:[],b:[]},days=[],cap=0,bk=0,fr=0;
    for(var i=0;i<A.n.length;i++){var f=Math.max(0,A.n[i]-A.m[i]-A.b[i]);days.push(f);if(i){cap+=Math.max(0,A.n[i]-A.m[i]);bk+=A.b[i];fr+=f;}}
    R.rest=Math.max(R.rest,A.n.length-1);
    var num=0,den=0,pr=0,pu=0,per=[];pms.forEach(function(pm){var P=F.past[pm],q=(P.cls||{})[c]||[0,0,0,0,0],n=(x.hc[pm]||{})[c]||0;if(n){num+=q[0];den+=n*P.rest;}pr+=q[3];pu+=q[0];per.push(n?q[0]/(n*P.rest):null);});
    var own=den>=30,rate=own?num/den:sRate,t=(F.tr||{})[c]||[0,0],tOwn=t[0]+t[1]>=20&&t[1]>0,tr=tOwn?clip(t[0]/t[1],.5,1.5):sTr;
    var dem=rate*cap*tr,av=(F.avg||{})[c],avg=av?+av[0]:0,L=Math.max(1,Math.round(avg||2)),f2=days.slice(1),nb=0,j=0;
    while(j<=f2.length-L){var ok=1;for(var q2=j;q2<j+L;q2++)if(f2[q2]<1){ok=0;break;}if(ok){for(q2=j;q2<j+L;q2++)f2[q2]--;nb++;}else j++;}
    var sup=nb*L,pk=Math.min(dem,sup),cz=zc[c],u0=cz&&cz.u?cz.u:(pu?pr/pu:0),unit=u0*uR,n0=A.n.length?A.n[A.n.length-1]:0;
    var row={c:c,lb:cz?cz.lb:c,n:n0,days:days,cap:cap,bk:bk,fr:fr,per:per,rate:rate,own:own,t:t,tr:tr,tOwn:tOwn,dem:dem,avg:avg,L:L,nb:nb,sup:sup,pk:pk,u0:u0,unit:unit,add:pk*unit,lead:cz?cz.pk:0,
      lo:Math.min(dem*lowF,sup)*unit,hi:Math.min(dem*highF,sup)*unit};
    R.rows.push(row);R.free+=fr;R.cap+=cap;R.bk+=bk;R.dem+=dem;R.sup+=sup;R.pk+=pk;R.add+=row.add;R.lo+=row.lo;R.hi+=row.hi;R.lead+=row.lead;});
  R.a=z.a;R.t=z.t;R.L=z.a+R.add;R.Llo=z.a+R.lo;R.Lhi=z.a+R.hi;R.Lsum=z.L;return R;}
function d1(v){return (Math.round(v*10)/10).toFixed(1);}
function pc1(v){return v===null||v===undefined?'–':(Math.round(v*1000)/10).toFixed(1)+'%';}
function fcHtml(S0,x,R,FX){var cur=x.cur,H='<div class="why" id="landFc"><h5>🧮 '+S0.nm+' '+MN(cur)+(FX?' クラス別の空きと、平均泊数で提供できる上限（供給の確認・明日〜月末 ':'の着地 試算根拠（実績と傾向から・明日〜月末 ')+R.rest+'日）</h5>';
  H+='<div class="eq"><b>'+(FX?'参考：クラス別に積み上げた場合の着地 ':'着地見込み ')+y(R.L)+'</b> ＝ 現在実績 '+y(R.a)+' ＋ これから入る見込み '+y(R.add)+'（'+d1(R.pk)+'日）　目標 '+y(R.t)+' に対して '+sg(R.L-R.t,y)+'（'+P(R.L,R.t)+'）</div>';
  H+='<div class="eq">幅 '+y(R.Llo)+' 〜 '+y(R.Lhi)+'（後から入った率が、過去3か月で一番低い月／高い月と同じだった場合）　<span class="muted">参考：サマリの着地（リードタイム式） '+y(R.Lsum)+'・見込み '+k(R.lead)+'日</span></div>';
  // 店全体の前提
  H+='<div class="lw" style="margin-top:6px;max-width:900px"><table><thead><tr><th class="l">過去の同じ日付（'+(+((FR[S0.k].today||'').slice(8)))+'日）時点</th>'+R.PM.map(function(p){return '<th>'+MN(p.m)+'</th>';}).join('')+'<th class="g">3か月まとめ</th></tr></thead><tbody>'
    +'<tr><td class="l">残り期間に、後から入った貸出日数</td>'+R.PM.map(function(p){return '<td>'+k(p.pu)+'日</td>';}).join('')+'<td>'+k(R.PM.reduce(function(a,p){return a+p.pu;},0))+'日</td></tr>'
    +'<tr><td class="l">残り枠（台数×残り日数）</td>'+R.PM.map(function(p){return '<td>'+k(p.cap)+'</td>';}).join('')+'<td>'+k(R.PM.reduce(function(a,p){return a+p.cap;},0))+'</td></tr>'
    +'<tr><td class="l"><b>後から入った率</b>（上÷下）</td>'+R.PM.map(function(p){return '<td>'+pc1(p.rate)+'</td>';}).join('')+'<td><b>'+pc1(R.sRate)+'</b></td></tr></tbody></table></div>';
  H+='<div class="lsub">トレンド（店全体）＝受付件数 直近28日 '+k(R.tA)+'件 ÷ その前の28日 '+k(R.tB)+'件 ＝ ×'+R.sTr.toFixed(2)+'（0.5〜1.5倍の範囲）。単価の補正＝過去3か月、後から入った予約の日割り単価は、先に入っていた予約の ×'+R.uR.toFixed(2)+'（0.7〜1.3倍の範囲）。</div>';
  // クラス別
  H+='<div class="lw" style="margin-top:6px"><table><thead><tr><th class="l" rowspan="2">クラス</th><th rowspan="2">台数</th><th colspan="3">稼働（明日〜月末）</th><th colspan="'+(R.PM.length+1)+'" class="g">後から入った率（過去の実績）</th><th colspan="2">トレンド</th><th rowspan="2" class="g">①需要<br>見込み日数</th><th colspan="2">平均泊数で提供できるか</th><th rowspan="2" class="g">見込み日数<br>（①と②の<br>小さい方）</th><th colspan="2">単価（1日）</th><th rowspan="2" class="g">見込み<br>売上</th><th rowspan="2">参考<br>サマリ式</th></tr><tr><th>残り枠</th><th>予約済み</th><th>空き</th>'+R.PM.map(function(p){return '<th class="g">'+MN(p.m)+'</th>';}).join('')+'<th class="g">採用</th><th>受付件数<br>直近28日／前28日</th><th>係数</th><th>平均泊数</th><th>②上限</th><th>予約済み</th><th>見込み</th></tr></thead><tbody>';
  R.rows.forEach(function(r){H+='<tr><td class="l"><b>'+r.c+'</b> <small class="muted">'+String(r.lb).replace(/^\S+\s*/,'')+'</small></td><td>'+r.n+'台</td><td>'+k(r.cap)+'</td><td>'+k(r.bk)+'日</td><td>'+k(r.fr)+'日</td>'
    +r.per.map(function(p){return '<td>'+pc1(p)+'</td>';}).join('')+'<td><b>'+pc1(r.rate)+'</b>'+(r.own?'':' <small class="muted">店</small>')+'</td><td>'+r.t[0]+'／'+r.t[1]+'</td><td>×'+r.tr.toFixed(2)+(r.tOwn?'':' <small class="muted">店</small>')+'</td><td>'+d1(r.dem)+'日</td><td>'+(r.avg?r.avg.toFixed(1)+'泊':'–')+'</td><td>'+r.nb+'本・'+k(r.sup)+'日</td>'
    +'<td class="'+(r.sup<r.dem?'lneg':'')+'"><b>'+d1(r.pk)+'日</b>'+(r.sup<r.dem?' <small>②</small>':'')+'</td><td>'+(r.u0?y(r.u0):'–')+'</td><td>'+(r.unit?y(r.unit):'–')+'</td><td>+'+y(r.add)+'</td><td class="muted">+'+k(r.lead)+'日</td></tr>';});
  H+='<tr class="tot"><td class="l">計</td><td></td><td>'+k(R.cap)+'</td><td>'+k(R.bk)+'日</td><td>'+k(R.free)+'日</td><td colspan="'+(R.PM.length+1)+'"></td><td>'+k(R.tA)+'／'+k(R.tB)+'</td><td></td><td>'+d1(R.dem)+'日</td><td></td><td>'+k(R.sup)+'日</td><td>'+d1(R.pk)+'日</td><td></td><td></td><td>+'+y(R.add)+'</td><td class="muted">+'+k(R.lead)+'日</td></tr></tbody></table></div>';
  H+='<div class="lsub">残り枠＝明日〜月末の（配車表の台数−整備）の合計。予約済み・空き＝配車表の実数。後から入った率＝過去の月の同じ日付より後に受付されて、その月の残り期間に入った貸出日数 ÷（その月の台数×残り日数）。採用＝3か月をまとめた率（「店」＝そのクラスの実績が少ないので店全体の率）。①需要＝採用の率×残り枠×トレンド係数。②上限＝日別の空きに平均泊数の予約を詰めて入る本数×泊数（赤＝空きが足りず②で頭打ち）。見込み単価＝今月の予約済み単価×補正。参考サマリ式＝サマリタブの見込み日数（リードタイム式）。当日分（今日これから入る今日の貸出）は見込まない。</div>';
  // 日別の空き
  H+='<div class="lw" style="margin-top:6px;max-width:700px"><table><thead><tr><th class="l">クラス</th><th class="l">日別の空き台数（今日→月末・配車表の実数）</th><th>空き計（明日〜）</th></tr></thead><tbody>'+R.rows.map(function(r){return '<tr><td class="l"><b>'+r.c+'</b></td><td class="l" style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:2px">'+r.days.map(function(d,i){return '<span style="color:'+(d?'#0f172a':'#cbd5e1')+(i==0?';text-decoration:underline':'')+'">'+d+'</span>';}).join('')+'</td><td>'+k(r.fr)+'日</td></tr>';}).join('')+'</tbody></table></div>';
  return H+'</div>';}
function trend(S0,x){var T=TR[S0.k],cur=x.cur;var H='<div class="lh">📈 '+S0.nm+' 当月推移（予約売上の積み上がり）</div>';
  if(!T)return H+'<div class="muted">読み込み中…</div>';if(T.err)return H+'<div class="wait">推移データ（DB関数 '+S0.rpc+'）を読めませんでした。</div>';
  var td=T.today||jstNow().toISOString().slice(0,10),dm=dimOf(cur),tOff=Math.round((new Date(td+"T00:00:00Z")-new Date(cur+"-01T00:00:00Z"))/864e5);
  function addM(m,n){var d=new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1+n,1));return d.toISOString().slice(0,7);}
  var list=[addM(cur,-3),addM(cur,-2),addM(cur,-1),cur],cols=["#cbd5e1","#94a3b8","#64748b",S0.col],X0=-45,X1=31;
  function cum(m){var a=(T.mon||{})[m]||[],out=[],s=0,i=0;for(var o=X0;o<=X1;o++){while(i<a.length&&a[i][0]<=o){s+=a[i][1];i++;}out.push([o,s]);}return out;}  /* X0(−45日)より前の受付分は最初の点に含める */
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
    rows+='<tr'+(m==cur?' class="cur"':'')+'><td class="l"><i style="display:inline-block;width:10px;height:10px;background:'+cols[ix]+';border-radius:2px"></i> '+MN(m)+'</td><td>'+y(at?at[1]:0)+'</td><td>'+(m==cur?'<span class="muted">進行中</span>':y(fin[1]))+'</td><td>'+(m==cur||!fin[1]?'–':P(at?at[1]:0,fin[1]))+'</td><td>'+(m==cur||!fin[1]||!at||!at[1]||!now||!z?'–':y(now[1]/(at[1]/fin[1])+(z.a-now[1])))+'</td></tr>';});
  H+='<div class="lw" style="max-width:760px"><table><thead><tr><th class="l">返却月</th><th>同じ日付時点（月の'+(tOff+1)+'日目）の予約売上</th><th>最終の予約売上</th><th>その時点で入っていた割合</th><th>今月が同じ割合なら着地</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  H+='<div class="lsub">線＝その返却月の予約売上を受付日の順に積み上げたもの（今残っている予約だけ・キャンセル済みは除く・予約外売上は含まない）。横軸＝月初からの日数（マイナス＝前月までに受付）。前の月と同じ日付時点で比べると、今月の入り方が早いか遅いかが分かる。</div>';
  return H;}
window.landSel=function(k,scroll){SEL=k;draw();if(scroll){var e=document.getElementById("landDet");if(e)e.scrollIntoView({behavior:"smooth",block:"start"});}};
window.landMon=function(m){MSEL=m;if(!SEL)SEL=selfKey()||"spk";draw();var e=document.getElementById("landDet");if(e)e.scrollIntoView({behavior:"smooth",block:"start"});};
})();
