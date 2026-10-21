/* 2026-10-21 bt/spk/nha-mtg-2026h2.html 共通：サマリ（#sum）だけに効く見た目（オーナー「どの数字がどの項目かわからない 枠なのでちゃんと可視化できるように」）。値・表の中身・並びは変えない。
   ① 列グループ（台数・売上・稼働率…）の境目に縦線 #9ca3af・グループ内の列の間は細線 #ece8e1・グループ背景は白／#faf9f7 の交互
   ② 差・% のセルの色：マイナス赤／プラス青／ゼロ黒（signTone）
   KPIタブ（#body）には効かせない（オーナー「KPI側は元に戻して 全然しっくりこない」2026-10-21 → 138125b の見た目） */
/* 表の各セルに 列グループの印を付ける：gs＝グループ先頭列（左に太めの縦線）／gi＝グループ内の列（細線）／galt＝偶数グループ（背景）／g1＝最初のグループ
   グループ＝thead 1段目の各セル（colspan の範囲）。rowspan も数えて列位置を出す */
function gridMark(t){
  var hr=t.tHead?t.tHead.rows:[];if(!hr.length)return;
  var G=[],S={},c=0,k,j;
  for(k=0;k<hr[0].cells.length;k++){var n=hr[0].cells[k].colSpan||1;for(j=0;j<n;j++)G[c+j]=k;S[c]=1;c+=n;}
  var span=[],rows=t.rows;
  for(var r=0;r<rows.length;r++){
    var col=0,cs=rows[r].cells;
    for(k=0;k<cs.length;k++){
      while(span[col]>0)col++;
      var x=cs[k],w=x.colSpan||1,g=G[col];
      x.classList.remove("gs","gi","galt","g1");
      if(g>0){x.classList.add(S[col]?"gs":"gi");if(g%2==0)x.classList.add("galt");if(g==1)x.classList.add("g1");}
      if((x.rowSpan||1)>1)for(j=0;j<w;j++)span[col+j]=x.rowSpan;
      col+=w;
    }
    for(j=0;j<span.length;j++)if(span[j]>0)span[j]--;
  }
  signTone(t);
}
/* 2026-10-21 オーナー「ー箇所は 赤 ＋箇所は青」：サマリの差・% のセル（td.kq2/td.kq3 の .pos/.neg）を マイナス赤 #b91c1c／プラス青 #1d4ed8／ゼロ黒（.zr）に（まとめ・合算・BT・HDM・計・クラスの全行）。
   丸めて0になった「−0%」「+¥0」「+0万」等は符号を外して「0%」「¥0」「0万」にし .zr。値は変えない（表示の符号と色だけ）。目標・実績・見込（kq0/kq1）と判定文（.nxd）は対象外 */
function signTone(t){
  var xs=t.querySelectorAll("td.kq2,td.kq3"),re=/^(\s*)([+−\-±])(\s*¥?)([0-9][0-9,]*(?:\.[0-9]+)?)/;
  for(var i=0;i<xs.length;i++){
    var x=xs[i],n=x.firstChild;if(!n||n.nodeType!=3)continue;
    var m=n.nodeValue.match(re);
    if(m&&parseFloat(m[4].replace(/,/g,""))===0){n.nodeValue=m[1]+m[3].replace(/^\s+/,"")+m[4]+n.nodeValue.slice(m[0].length);x.classList.remove("pos","neg");x.classList.add("zr");}
  }
}
(function(){var css=[
/* ── サマリ（#sum）：列グループの枠・見出しはグループの真上で中央の太字＋下に線・2段目は右寄せ・見出し固定 ── */
"#sum table.kqg .gs{border-left:1px solid #9ca3af!important}#sum table.kqg .gi{border-left:1px solid #ece8e1!important}",
"#sum table.kqg td.galt{background:#faf9f7}",
"#sum table.kqg thead{position:sticky;top:0;z-index:3}",
"#sum table.kqg thead tr th{background:#fff!important}#sum table.kqg thead tr th.galt{background:#faf9f7!important}",
"#sum table.kqg thead tr:first-child th.gs{color:#111827;font-weight:700;font-size:13px;text-align:center;border-bottom:1px solid #9ca3af}",
"#sum table.kqg thead tr+tr th{color:#4b5563;font-size:12px;text-align:right}",
/* 差・% の色（signTone）：マイナス赤・プラス青・ゼロ黒（まとめ・合算・BT・HDM・計・クラスの全行） */
"#sum table.kqg tr td:is(.kq2,.kq3).pos{color:#1d4ed8!important}",
"#sum table.kqg tr td:is(.kq2,.kq3).neg{color:#b91c1c!important}",
"#sum table.kqg tr td:is(.kq2,.kq3).zr{color:#111827!important}",
/* 予約外・未配車の行（mtgXRow）：薄いグレー */
"#sum table.kqg tr.kqx td{background:#f3f4f6!important}"
].join("\n");var st=document.createElement("style");st.id="mtgGridCss";st.textContent=css;document.head.appendChild(st);})();
/* 2026-10-21 オーナー「スマホ全く見えない」：幅≤768px の時だけ、サマリの表（table.kqg）を読み取ってカードに組み直す（値は表のセルをそのまま使う＝計算しない）。PC は表のまま（.kqmob は PC では出さない）。
   まとめ＝大カード1枚（売上 実績／目標・達成率／着地見込み／目標・差／稼働率 実績／目標／単価 実績／あるべき／見込めない不足 or 余裕）。クラス＝1クラス1カード（見出し＝クラス名・型タグ・やること／本文＝ラベル｜実績／目標｜差%）。
   高松は 合算・BT・HDM を折りたたみ見出しにし、初期は合算だけ開く。カード（data-w）をタップすると今の根拠パネル（dsgWhyShow） */
function mtgMob(se){
  var W=se.querySelectorAll(".kqm-w");
  for(var w=0;w<W.length;w++){
    var box=W[w],old=box.querySelector(".kqmob");if(old)old.parentNode.removeChild(old);
    var T=box.querySelectorAll("table.kqg");if(!T.length)continue;
    var multi=T.length>1,h='';
    for(var ti=0;ti<T.length;ti++){
      var t=T[ti],kc=t.parentNode;while(kc&&!(kc.classList&&kc.classList.contains("kqc")))kc=kc.parentNode;
      if(kc)kc.classList.add("kqc-t");
      var cols=mobCols(t),rs=t.tBodies,big='',cards='';
      for(var b=0;b<rs.length;b++)for(var r=0;r<rs[b].rows.length;r++){
        var tr=rs[b].rows[r],g=mobRow(tr,cols),nmc=tr.cells[0]?tr.cells[0].innerHTML:'';
        if(tr.cells[0]&&tr.cells[0].textContent=="まとめ")big+=mobBig(tr,g);else cards+=mobCard(tr,g,nmc);
      }
      var ttl=kc&&kc.querySelector(".kqch b")?kc.querySelector(".kqch b").textContent:'';
      h+=big;
      if(multi)h+='<details class="mbsec"'+(ti==0?' open':'')+'><summary>'+(ti==0?'合算（BT＋HDM）クラス別':ttl)+'</summary>'+cards+'</details>';
      else h+=cards;
    }
    var d=document.createElement("div");d.className="kqmob";d.innerHTML=h;box.appendChild(d);
  }
}
/* thead → 列ごとの［グループ名, 小見出し］（rowspan の列は小見出しなし） */
function mobCols(t){var hr=t.tHead.rows,C=[],k,j,s2=0,r2=hr[1]?hr[1].cells:[];
  for(k=0;k<hr[0].cells.length;k++){var x=hr[0].cells[k],g=x.textContent.replace(/\s+/g,'');
    if((x.rowSpan||1)>1)C.push([g,'']);else for(j=0;j<(x.colSpan||1);j++){C.push([g,r2[s2]?r2[s2].textContent:'']);s2++;}}
  return C;}
/* 1行 → {グループ:{小見出し:td}}（colspan のセルは先頭の小見出しに入れる） */
function mobRow(tr,C){var G={},col=0;for(var k=0;k<tr.cells.length;k++){var x=tr.cells[k],c=C[col]||['',''];(G[c[0]]=G[c[0]]||{})[c[1]]=x;col+=x.colSpan||1;}return G;}
function mobV(G,g,s){var x=G[g]&&G[g][s];return x?x.textContent:'';}
function mobC(G,g,s){var x=G[g]&&G[g][s];if(!x)return '';return /\bneg\b/.test(x.className)?'mneg':/\bpos\b/.test(x.className)?'mpos':'';}
function mobSg(s){return s.indexOf('−')>=0?'mneg':s.indexOf('+')>=0?'mpos':'';}
function mobW(tr){var w=tr.getAttribute("data-w");return w!=null?' data-w="'+w+'"':'';}
function mobBig(tr,G){var S='売上',L='着地見込み',U='単価（1日）',R='稼働率',p=mobV(G,S,'%'),ach='';
  if(p){var n=parseFloat(p.replace('−','-').replace('+',''));if(!isNaN(n))ach=(100+n)+'%';}
  var nx=G['やること']&&G['やること']['']?G['やること'][''].querySelector('b'):null,nt=nx?nx.textContent:'';
  var sh=tr.getAttribute('data-sh'),sx=tr.getAttribute('data-sx');
  function ln(l,v,e,ec){return '<div class="mbl"><span class="mlb">'+l+'</span><span class="mvl">'+v+'</span><span class="mex '+(ec||'')+'">'+(e||'')+'</span></div>';}
  return '<div class="mbig"'+mobW(tr)+'><div class="mbh"><b>まとめ</b><span class="'+(nt.indexOf('未達')>=0?'mneg':'mpos')+'">'+nt+'</span></div>'
    +ln('売上',mobV(G,S,'実績')+' ／ '+mobV(G,S,'目標'),ach,mobC(G,S,'%'))
    +ln('着地見込み',mobV(G,L,'見込')+' ／ '+mobV(G,L,'目標'),mobV(G,L,'差'),mobC(G,L,'差'))
    +ln('稼働率',mobV(G,R,'実績')+' ／ '+mobV(G,R,'目標'),'','')
    +ln('単価',mobV(G,U,'実績')+' ／ '+mobV(G,U,'目標'),'あるべき','mnt')
    +(sh?'<div class="mbf mneg">見込めない不足 ¥'+sh+'</div>':sx?'<div class="mbf mpos">余裕 ¥'+sx+'</div>':'')+'</div>';}
function mobCard(tr,G,nmc){
  var z=null;for(var g in G)for(var s in G[g]){var x=G[g][s];if(x.classList.contains('z')&&(x.colSpan||1)>4)z=x.textContent;}
  if(z)return '<div class="mcd mcz"><div class="mch"><b>'+nmc+'</b><span>'+z+'</span></div></div>';
  var nx=G['やること']&&G['やること'][''],tag='',act='';
  if(nx){var tg=nx.querySelector('small');tag=tg?tg.textContent:'';var bb=nx.querySelector('b');act=bb?bb.textContent.replace(tag,''):'';}
  function rw(l,g,a,b,d){var v=mobV(G,g,a),u=mobV(G,g,b);if(!v&&!u)return '';
    var one=(G[g]&&G[g][a]&&(G[g][a].colSpan||1)>1);  /* 予約なし等 */
    return '<tr><th>'+l+'</th><td>'+(one?'<span class="mneg">'+v+'</span>':v+(u?' ／ '+u:''))+'</td><td class="'+(d?mobC(G,g,d):'')+'">'+(d&&!one?mobV(G,g,d):'')+'</td></tr>';}
  var bk=G['目標予約件数']&&G['目標予約件数']['']&&G['目標予約件数'][''].textContent?'<tr><th>目標予約件数</th><td>'+G['目標予約件数'][''].textContent+'</td><td></td></tr>':'';
  return '<div class="mcd'+(tr.classList.contains('kqs')||tr.classList.contains('kqx')?' mcs':'')+'"'+mobW(tr)+'><div class="mch"><b>'+nmc+(tag?' <small>'+tag+'</small>':'')+'</b><span class="'+mobSg(act)+'">'+act+'</span></div>'
    +'<table class="mtb"><tbody>'
    +rw('売上','売上','実績','目標','%')+rw('着地','着地見込み','見込','目標','%')+rw('稼働率','稼働率','実績','目標','%')+rw('単価','単価（1日）','実績','目標','%')
    +rw('台数','台数','グロス','稼働','')+bk+'</tbody></table></div>';}

/* 2026-10-21 オーナー「車両入れ替えは別タブで。理由は蓄積型での判断だから。単月悪いからではない」：🔁車両入替タブ（月タブに連動しない）。
   期間＝4月〜前月の確定月すべて（オーナー「4月から」・サマリの土台は3月〜のまま）。クラスごと（高松はブランド×クラスも）に 期間合計の 貸出日数・稼働可能日数・売上。
   稼働率＝Σmin(貸出, 稼働可能×70%)÷Σ稼働可能／単価＝Σ売上÷Σ貸出／月需要＝Σ貸出÷（稼働可能がある月数）／n＝直近の確定月の台数。
   入れる側の増分＝1台×30日×min(稼働率,70%)×単価（稼働率50%未満＝空きがあるクラスは0）。出す側の減少＝max(0, 月需要−(n−1)×30×70%)×単価。効果＝増分−減少（月あたり）。効果の大きい順に上位5件 */
var SWP_WH=[];
/* 2026-10-21 オーナー「全て足しても-88にならない」：サマリのまとめカードの最後のクラス行の下に「予約外・未配車（クラスなし）」の行（目標＝その月の予約外・未配車の実績＝見込み／実績／着地＝同じ実績）。
   台数・台あたり・単価・稼働率の列は空欄。bk＝目標予約件数の列あり（高松）。クラス行＋この行＝まとめ（売上・着地） */
function mtgXRow(bk,tg,ar,man,wh){var e='<td></td>',d=ar-tg,cl=Math.round(d/1e3)==0?'':d>=0?' pos':' neg',sd=(d>=0?'+':'−')+man(Math.abs(d)),E=function(n){var s='';for(var i=0;i<n;i++)s+=e;return s;};
  var w=wh('<b>予約外・未配車（クラスなし）</b><br>店の実績（予約＋予約外）からクラス行の実績を引いた分＝予約外売上（店舗）と、まだ車に配車していない予約など<br>目標＝この月の予約外・未配車の実績 ¥'+Math.round(tg).toLocaleString()+'（見込み＝今の実績・クラス目標と足して店目標）<br>実績・着地 ¥'+Math.round(ar).toLocaleString());
  return '<tr class="kqx"'+w+'><td class="kqn" style="text-align:left">予約外・未配車<small class="nxg">（クラスなし）</small></td>'+E(2+(bk?1:0))
    +'<td class="kq0">'+man(tg)+'</td><td class="kq1">'+man(ar)+'</td><td class="kq2'+cl+'">'+sd+'</td>'+E(1)+E(8)
    +'<td class="kq0">'+man(tg)+'</td><td class="kq1">'+man(ar)+'</td><td class="kq2'+cl+'">'+sd+'</td>'+E(1)+E(1)+'</tr>';}
function renderSwap(D,op){var el=document.getElementById("swp");if(!el)return;
  var o=D.data,CAP=0.70,MIN=0.50,SELL=0.60,DM=30,FR="2026-04",nw=new Date(Date.now()+9*3600000);nw.setUTCDate(1);nw.setUTCMonth(nw.getUTCMonth()-1);var TO=nw.toISOString().slice(0,7);var CM=new Date(Date.now()+9*3600000).toISOString().slice(0,7);
  var ms=D.months.filter(function(m){return m>=FR&&m<=TO&&o[m];});SWP_WH=[];
  function k(v){return Math.round(v).toLocaleString();}function P(v){return Math.round(v*100)+'%';}
  function man(v){var a=Math.abs(v);return (a>=1e6?Math.round(v/1e4):Math.round(v/1e3)/10).toLocaleString()+'万';}
  function nm(c){var s=String(op.cn(c)||"").split("/")[0].replace(/(?:[①-⑳]+|\d{2,})$/,"").trim();return c+(s?' '+s:'');}
  /* 2026-10-21 オーナー「配車票の稼働未稼働が起算フラグ」：util/util_cb の n・ad は DB 関数で配車表の月次フラグ（*_vehicle_monthly_kpi.active・無ければ車両の active）から作られ、フラグの立つ車がある月だけ行がある。
     その月（n>0・ad>0）だけ 稼働可能・貸出・売上 を積む（未稼働の月は分母にも分子にも入れない）。n＝直近の確定月にフラグが立っている台数（無ければ0＝候補にしない） */
  function stat(uk,ck,ufield,cfield){var rd=0,ad=0,rc=0,rv=0,mn=0,n=0,m0='',m1='';ms.forEach(function(m){var u=(o[m][ufield]||{})[uk],v=(o[m][cfield]||{})[ck];
      if(!(u&&u.n>0&&u.ad>0))return;rd+=u.rd;ad+=u.ad;rc+=Math.min(u.rd,u.ad*CAP);mn++;if(v)rv+=v.r||0;if(!m0)m0=m;m1=m;if(m==TO)n=u.n;});
    var uc=(o[CM]&&o[CM][ufield]||{})[uk];if(uc&&uc.n>0)n=uc.n;  /* 2026-10-21 台数＝今月のフラグ台数（高松は10月に13→34台へ増車＝9月の台数だと少なすぎる）。今月に行が無ければ直近の確定月 */
    if(!ad||!rd||!rv||!n)return null;var fr=rc/ad,pr=rv/rd,dm=rd/mn;
    return {rd:rd,ad:ad,rv:rv,mn:mn,n:n,m0:m0,m1:m1,fr:fr,pr:pr,dmd:dm,inc:fr>=MIN-1e-9?DM*Math.min(fr,CAP)*pr:0,dec:Math.max(0,dm-(n-1)*DM*CAP)*pr};}
  var ck={};ms.forEach(function(m){Object.keys(o[m].util||{}).forEach(function(c){if(c!="未配車"&&c!="送迎"&&c!="AA")ck[c]=1;});});
  var V={};Object.keys(ck).forEach(function(c){var s=stat(c,c,'util','cls');if(s)V[c]=s;});
  function bs(l,v){return l+'：起算：配車表の稼働フラグ（'+(+v.m0.slice(5))+'月〜'+(+v.m1.slice(5))+'月・'+v.mn+'か月）・貸出 '+k(v.rd)+'日／稼働可能 '+k(v.ad)+'日・稼働率 '+P(v.fr)+'・単価 ¥'+k(v.pr)+'・売上 ¥'+k(v.rv)+'・月需要 '+(Math.round(v.dmd*10)/10)+'日・今月の稼働フラグ台数 '+v.n+'台';}
  function why(t,lx,vx,ly,vy,e){return '<b>🔁 '+t+'</b><br>期間 '+PL+'（確定月の蓄積）<br>出す側 '+bs(lx,vx)+'<br>入れる側 '+bs(ly,vy)
    +'<br>減少 ＝ max(0, 月需要 '+(Math.round(vx.dmd*10)/10)+'日 − ('+vx.n+'−1)台×'+DM+'日×'+P(CAP)+') × ¥'+k(vx.pr)+' ＝ ¥'+k(vx.dec)
    +'<br>増分 ＝ 1台×'+DM+'日×min('+P(vy.fr)+','+P(CAP)+')×¥'+k(vy.pr)+' ＝ ¥'+k(vy.inc)+'（稼働率'+P(MIN)+'未満のクラスは0）'
    +'<br>効果 ＝ ¥'+k(vy.inc)+' − ¥'+k(vx.dec)+' ＝ <b>+¥'+k(e)+'/月</b>'
    +'<br>条件 入れる側：蓄積稼働'+P(vy.fr)+'≥'+P(SELL)+'、出す側：蓄積稼働'+P(vx.fr)+'&lt;'+P(MIN)+'・'+vx.n+'台（2台以上）';}
  var PL=ms.length?(+ms[0].slice(5))+'月〜'+(+ms[ms.length-1].slice(5))+'月':'';
  /* 2026-10-21 オーナー「最適解を見つける機能」：現実的な候補だけ。AA は対象外。入れる側＝蓄積稼働≥60%（売れている）／出す側＝蓄積稼働<50%（売れていない）かつ2台以上（0台にしない）＝逆向きのペアは出ない。
     高松のブランド間＝同じクラスで片方≥60%・もう片方<50% の時だけ。効果の大きい順に貪欲法で組む（入れる側・出す側とも1回まで）・最大5件 */
  function inY(v){return v.fr>=SELL-1e-9;}function outX(v){return v.fr<MIN-1e-9&&v.n>=2;}
  var Z=[];Object.keys(V).forEach(function(x){var vx=V[x];if(!outX(vx))return;Object.keys(V).forEach(function(y){var vy=V[y];if(x==y||!inY(vy))return;var e=vy.inc-vx.dec;if(e>0)Z.push([nm(x)+' → '+nm(y),e,why(nm(x)+' → '+nm(y)+' 1台入替の根拠',nm(x),vx,nm(y),vy,e),'クラス間',x,y]);});});
  var nY=Object.keys(V).filter(function(c){return inY(V[c]);}).length,nX=Object.keys(V).filter(function(c){return outX(V[c]);}).length;
  if(op.bt){var BR=["BT","HDM"];Object.keys(ck).forEach(function(c){var B={};BR.forEach(function(b){var s=stat(b+'|'+c,b+'|'+c,'util_cb','cls_cb');if(s)B[b]=s;});
    [["HDM","BT"],["BT","HDM"]].forEach(function(p){var vx=B[p[0]],vy=B[p[1]];if(!vx||!vy)return;if(inY(vy))nY++;if(outX(vx))nX++;if(!inY(vy)||!outX(vx))return;var e=vy.inc-vx.dec;if(e<=0)return;
      var t=nm(c)+' '+p[0]+' → '+p[1];Z.push([t,e,why(t+' 1台移す根拠（同じクラス・ブランド間）',nm(c)+' '+p[0],vx,nm(c)+' '+p[1],vy,e),'ブランド間',p[0]+'|'+c,p[1]+'|'+c]);});});}
  Z.sort(function(a,b){return b[1]-a[1];});var UX={},UY={},Z2=[];Z.forEach(function(z){if(Z2.length>=5||UX[z[4]]||UY[z[5]])return;UX[z[4]]=1;UY[z[5]]=1;Z2.push(z);});Z=Z2;
  window.SWP_RATES=Object.keys(V).map(function(c){return c+' '+P(V[c].fr)+' '+V[c].n+'台';});
  window.SWP_TOP=Z.map(function(z){return (op.bt?'['+z[3]+'] ':'')+z[0]+' 1台 +'+man(z[1])+'/月';});
  var why0=!nY&&!nX?'売れている'+P(SELL)+'以上のクラスも、売れていない'+P(MIN)+'未満（2台以上）のクラスもない':!nY?'売れている'+P(SELL)+'以上のクラスがない':!nX?'売れていない'+P(MIN)+'未満（2台以上）のクラスがない':'入れ替えても増えない';
  var h='<div class="swh">'+PL+'の実績の蓄積で判断（単月の良し悪しではない）</div><div class="swl">';
  h+=Z.length?Z.map(function(z){SWP_WH.push(z[2]);return '<div class="swr" data-w="'+(SWP_WH.length-1)+'">'+(op.bt?'<small>［'+z[3]+'］</small>':'')+'<span>'+z[0]+' 1台</span><b class="mpos">+'+man(z[1])+'/月</b></div>';}).join(''):'<div class="swr">入替で増える組み合わせなし（'+why0+'）</div>';
  el.innerHTML=h+'</div><div class="swn">行をタップで計算根拠。候補＝入れる側 蓄積稼働'+P(SELL)+'以上（売れている）／出す側 蓄積稼働'+P(MIN)+'未満（売れていない）かつ2台以上。AAは対象外。1クラス1回まで。入れる側＝期間の稼働率（上限'+P(CAP)+'）で回る前提。出す側＝期間平均の月需要のうち残りの台で吸収できない分だけ減る。</div>';}
document.addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('#swp [data-w]');if(c&&typeof dsgWhyShow=="function")dsgWhyShow(SWP_WH[+c.getAttribute('data-w')]);});
(function(){var css=[
/* 車両入替タブ（PC・スマホ共通：1行1件のリスト） */
"#swp{max-width:720px}#swp .swh{font-size:14px;font-weight:700;color:#111827;margin:6px 0 8px}",
"#swp .swl{background:#fff;border:1px solid #e7e3dc;border-radius:12px;overflow:hidden}",
"#swp .swr{display:flex;align-items:baseline;gap:8px;padding:12px 14px;border-bottom:1px solid #ece8e1;font-size:15px;cursor:pointer}#swp .swr:last-child{border-bottom:0}",
"#swp .swr small{font-size:14px;color:#6b7280;flex:0 0 auto}#swp .swr span{flex:1 1 auto;min-width:0}#swp .swr b{flex:0 0 auto;font-size:15px}",
"#swp .swn{font-size:14px;color:#6b7280;margin-top:8px;line-height:1.5}.mpos{color:#1d4ed8}.mneg{color:#b91c1c}",
"#sum .kqmob{display:none}",
/* スマホ（≤768px）だけ */
"@media screen and (max-width:768px){",
" body{padding:8px}",
" .bar{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;scrollbar-width:none}.bar::-webkit-scrollbar{display:none}",
" .bar>*{flex:0 0 auto}.bar .tabs,#sumMon .kqt{flex-wrap:nowrap}.bar .rb.r0{margin-left:0}.bar .rb .rbt{display:none}.bar .rb{padding:0 8px}.bar .upd{font-size:12px}",
" #sum .kqc-t{display:none}#sum .kqmob{display:block}",
" #sum .mbig,#sum .mcd{background:#fff;border:1px solid #e7e3dc;border-radius:12px;padding:12px 14px;margin:0 0 10px;font-size:15px;color:#111827;cursor:pointer}",
" #sum .mbig{border:2px solid #1d64d8}",
" #sum .mbh,#sum .mch{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}#sum .mbh b{font-size:18px}#sum .mbh span{font-size:15px;font-weight:700}",
" #sum .mbl{display:flex;align-items:baseline;gap:8px;padding:7px 0;border-bottom:1px solid #ece8e1}#sum .mbl:last-of-type{border-bottom:0}",
" #sum .mlb{flex:0 0 76px;font-size:14px;color:#6b7280}#sum .mvl{flex:1 1 auto;font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}#sum .mex{flex:0 0 auto;font-size:15px;font-weight:700}#sum .mex.mnt{font-size:14px;font-weight:400;color:#6b7280}",
" #sum .mbf{margin-top:6px;font-size:15px;font-weight:700}",
" #sum .mch b{font-size:16px;min-width:0}#sum .mch b .cn{font-size:14px;font-weight:400;color:#374151}#sum .mch b small{font-size:14px;font-weight:400;color:#6b7280;white-space:nowrap}#sum .mch>span{flex:0 0 auto;font-size:15px;font-weight:800;text-align:right;max-width:55%}",
" #sum .mcz .mch>span{color:#9ca3af;font-weight:400}#sum .mcs{background:#efebe5}",
" #sum table.mtb{width:100%;border-collapse:collapse;table-layout:fixed}#sum table.mtb th,#sum table.mtb td{font-size:14px;padding:5px 0;border:0;border-top:1px solid #f1eee9;white-space:nowrap;background:none;color:#111827}",
" #sum table.mtb th{width:26%;text-align:left;font-weight:400;color:#6b7280}#sum table.mtb td{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}#sum table.mtb td:last-child{width:20%}",
" #sum table.mtb td.mpos{color:#1d4ed8}#sum table.mtb td.mneg{color:#b91c1c}",
" #sum details.mbsec{margin:0 0 10px}#sum details.mbsec>summary{font-size:16px;font-weight:800;padding:10px 4px;cursor:pointer;color:#111827}",
" #dsgWhy{font-size:14px!important;max-height:70vh;overflow:auto}",
"}"
].join("\n");var st=document.createElement("style");st.id="mtgMobCss";st.textContent=css;document.head.appendChild(st);})();
