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
"#sum table.kqg tr.kqx td{background:#f3f4f6!important}",
/* 🏁通期タブ：#sum の中の .kqlife を通期タブの時だけ出し、月別サマリ（.kqm-w・月タブ）は隠す */
"body:not(.tab-life) #sum .kqlife{display:none}body.tab-life #sum .kqm-w,body.tab-life #sumMon{display:none!important}",
"#sum .kqlife table.kqg td.nxd{text-align:left;font-weight:700}",
/* アクションプラン（mtgPlan）：PC＝4列の表、スマホ＝.kqpm をまとめの直下にカードで（mtgMob） */
"#sum table.kqpt td,#sum table.kqpt th{text-align:left!important}#sum table.kqpt td.kq2,#sum table.kqpt th:last-child{text-align:right!important}",
"#sum table.kqpt{max-width:820px;width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px}#sum table.kqpt th{font-size:12px;color:#4b5563;font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid #9ca3af;background:#fff}#sum table.kqpt th:last-child{text-align:right}",
"#sum table.kqpt td{padding:7px 8px;border-bottom:1px solid #ece8e1;color:#111827}#sum table.kqpt td.kq2{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}#sum table.kqpt td.kq2.pos{color:#1d4ed8}#sum table.kqpt td.kq2.neg{color:#b91c1c}",
"#sum table.kqpt tr.kqs td{background:#efebe5;font-weight:700}#sum table.kqpt tbody tr[data-w]{cursor:pointer}#sum .kqm-w>.kqpm{display:none}"
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
      if(ti==0){var pm=box.querySelector(".kqpm");if(pm)h+=pm.innerHTML;}  /* アクションプラン（まとめの直下） */
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
/* 2026-10-23 オーナー「目標あります 見込み出ました → 目標未達予測の場合にはやはりアクションプランを出すべき」：サマリの月タブ（今月以降）で、まとめの着地見込みが目標未満の時だけ、まとめカードの直下に「アクションプラン」。
   P＝クラス行（高松は合算）の {lb,aa,ad,rd,ar,pk,L,cap(見込み後の空き日数),d(目標単価),uA(実績単価),jb(目標稼働率),mx(実績最高単価)}。1クラス1行。
   ①稼働を取る：着地稼働率<目標。今の単価のまま あと◯日（上限＝空き、かつ稼働率70%まで）。効果＝日数×実績単価（予約なしは目標単価）
   ③単価を下げて稼働を取る：①の条件で実績単価＞目標単価（AA以外）。単価を目標単価まで（最大−20%）下げて あと◯日。効果＝日数×新単価−見込み日数×値下げ分
   ②単価を上げる：着地稼働率≥目標で、見込み単価＜目標単価 または 売れ筋（着地稼働率≥60%）。残りの未予約（見込み日数）にだけ +¥◯（最大+20%・実績最高単価まで）。効果＝見込み日数×上げ幅
   ①で空きがあり稼働率も目標以上のクラスも上乗せ候補（①）。効果の大きい順に不足を埋めるまで取り、最後の1行は不足ちょうどまでに絞る。効果は千円単位に丸めてから合計（合計＝行の和） */
function mtgPlan(P,gap,o,wh,mk){
  var R=function(v){return Math.round(v/1e3)*1e3;},g=R(gap);window.DSG_CHK_P=window.DSG_CHK_P||{};if(g<=0){window.DSG_CHK_P[mk]={m:mk,gap:g,none:1};return '';}
  var Y=function(v){return '¥'+Math.round(v).toLocaleString();},M=function(v){return (v/1e4).toFixed(1)+'万';},C=[];
  P.forEach(function(p){if(!p.ad)return;var f=p.rd+p.pk,fr=f/p.ad,p0=p.uA>0?p.uA:p.d,upf=p.pk?(p.L-p.ar)/p.pk:p0,lo=fr<p.jb-1e-9,E=Math.max(0,Math.min(Math.floor(p.cap),Math.floor(p.ad*(lo?Math.min(p.jb,o.CAP):o.CAP)+1e-9)-Math.ceil(f-1e-9))),z=null;
    /* 追加日数の上限：目標未満のクラスは目標稼働率まで（AA 3%のクラスに70%までは現実的でない）、目標以上のクラスは稼働率70%まで。どちらも残りの空き日数以内 */
    var bs='着地稼働率 '+Math.round(fr*100)+'%（目標 '+Math.round(p.jb*100)+'%）・追加できる日数 '+E+'日（'+(lo?'目標稼働率':'稼働率'+Math.round(o.CAP*100)+'%')+'まで・残りの空き以内）・実績単価 '+(p.uA>0?Y(p.uA):'予約なし')+'・目標単価 '+Y(p.d);
    function one(){if(!E||!p0)return null;return {k:1,mx:E*p0,q:function(r){var n=Math.min(E,Math.ceil(r/p0-1e-9));return {n:n,e:n*p0,t:'あと'+n+'日の貸出',w:n+'日 × '+Y(p0)+' ＝ '+Y(n*p0)};}};}
    if(fr<p.jb-1e-9){
      if(!p.aa&&p.uA>p.d*1.005&&E>0){var np=Math.round(Math.max(p.d,p.uA*(1-o.PDN))),ls=p.pk*Math.max(0,upf-np),cut=Math.round(p.uA-np);
        if(E*np-ls>0)z={k:3,mx:E*np-ls,q:function(r){var n=Math.min(E,Math.ceil((r+ls)/np-1e-9));return {n:n,e:n*np-ls,t:'単価 −¥'+cut.toLocaleString()+'で、あと'+n+'日',w:n+'日 × '+Y(np)+' − 見込み'+Math.round(p.pk)+'日の値下げ分 '+Y(ls)+' ＝ '+Y(n*np-ls)};}};}
      if(!z)z=one();}
    else if(p.pk>0&&(upf<p.d*0.995||fr>=o.SELL-1e-9)){var r=upf<p.d*0.995?Math.min(o.PUP,p.d/upf-1):o.PUP;if(p.mx)r=Math.min(r,p.mx/upf-1);var ad=Math.floor(upf*r);
      if(ad>=1)z={k:2,mx:p.pk*ad,q:function(rm){var a2=Math.min(ad,Math.ceil(rm/p.pk-1e-9));return {n:a2,e:p.pk*a2,t:'単価 +¥'+a2.toLocaleString(),w:'残りの見込み '+Math.round(p.pk)+'日 × +'+Y(a2)+'（'+Y(upf)+'→'+Y(upf+a2)+'）＝ '+Y(p.pk*a2)};}};
      else z=one();}
    else if(!p.aa)z=one();  /* 目標以上のクラスの上乗せ（AA＝高級の別枠は目標以上なら出さない） */
    if(z&&z.mx>=5e3){  /* 効果0.5万未満の行は出さない */z.p=p;z.bs=bs;C.push(z);}});
  C.sort(function(a,b){return b.mx-a.mx;});
  var rem=g,rows=[];C.forEach(function(z){if(rem<=0)return;var x=z.q(z.mx>rem?rem:z.mx),e=R(x.e);if(e<=0)return;rows.push({z:z,x:x,e:e});rem-=e;});
  rows.sort(function(a,b){return b.e-a.e;});
  var tot=rows.reduce(function(s,r){return s+r.e;},0),lf=g-tot,KN={1:'稼働を取る',2:'単価を上げる',3:'単価を下げて稼働を取る'};
  (window.DSG_CHK_P=window.DSG_CHK_P||{})[mk]=({m:mk,gap:g,rows:rows.map(function(r){return r.e;}),tot:tot,left:lf});
  var tr='',mb='';
  rows.forEach(function(r){var w=wh('<b>'+r.z.p.lb.replace(/<[^>]+>/g,'')+' '+KN[r.z.k]+'</b><br>'+r.z.bs+'<br>効果 '+r.x.w+'（千円単位で表示）');
    tr+='<tr'+w+'><td class="kqn">'+r.z.p.lb+'</td><td class="kpa">'+KN[r.z.k]+'</td><td class="kpn">'+r.x.t+'</td><td class="kq2 pos">+'+M(r.e)+'</td></tr>';
    mb+='<div class="mcd"'+w+'><div class="mch"><b>'+r.z.p.lb+'</b><span class="mpos">+'+M(r.e)+'</span></div><table class="mtb"><tbody><tr><th>やること</th><td>'+KN[r.z.k]+'</td><td></td></tr><tr><th>必要量</th><td>'+r.x.t+'</td><td></td></tr></tbody></table></div>';});
  if(!rows.length){tr+='<tr><td class="kqn" colspan="4">打ち手なし（空き・単価の余地がない）</td></tr>';}
  var ft='<tr class="kqs"><td class="kqn">合計効果</td><td></td><td></td><td class="kq2 pos">+'+M(tot)+'</td></tr><tr><td class="kqn">店の不足（着地差）</td><td></td><td></td><td class="kq2 neg">−'+M(g)+'</td></tr>'
    +'<tr class="kqs"><td class="kqn">'+(lf<=0?'届く':'残り不足')+'</td><td></td><td></td><td class="kq2 '+(lf<=0?'pos':'neg')+'">'+(lf<=0?'+'+M(-lf):'−'+M(lf))+'</td></tr>';
  var mf='<div class="mbig"><div class="mbh"><b>アクションプラン</b><span class="'+(lf<=0?'mpos':'mneg')+'">'+(lf<=0?'届く':'残り不足 −'+M(lf))+'</span></div><div class="mbl"><span class="mlb">合計効果</span><span class="mvl">+'+M(tot)+'</span><span class="mex"></span></div><div class="mbl"><span class="mlb">不足</span><span class="mvl mneg">−'+M(g)+'</span><span class="mex"></span></div></div>';
  return '<div class="kqc kqp"><div class="kqch"><b>アクションプラン（着地見込み −'+M(g)+' を埋める）</b><span>行をクリックで計算根拠</span></div><div class="tw"><table class="kqpt"><colgroup><col style="width:22%"><col style="width:26%"><col style="width:34%"><col style="width:18%"></colgroup><thead><tr><th>クラス</th><th>やること</th><th>必要量</th><th>効果(万)</th></tr></thead><tbody>'+tr+ft+'</tbody></table></div></div>'
    +'<div class="kqpm">'+mf+mb+'</div>';}
/* 2026-10-21 オーナー「サマリのサマリが必要。クラスごとの生涯成績。月別ではなく過去から未来までの総評」：サマリの「通期」タブ（3店共通）。
   過去＝確定月（PM・土台と同じ 3月〜前月）の実績：売上（cls/cls_cb）・貸出日数・稼働可能日数（util/util_cb）。今期＝今月〜最終月（FM）の目標・着地見込み（月別サマリのクラス行の値をそのまま積む＝LF）。
   通期売上＝過去の実績＋今期の着地。台数＝期間（PM＋FM）の月平均。まとめ＝クラス行＋予約外・未配車（過去＝店の実績−クラス行の実績／今期＝目標・着地とも月別の予約外・未配車の合計）。比率は合計から再計算。
   総評（一語）：過去の稼働率 fr（貸出÷稼働可能）と今期の着地 vs 目標。過去なし＝新規。fr≥60%：届く→売れ筋／届かない→単価不足。fr<50%：届く→回復／届かない→不振。間：届く→順調／届かない→稼働不足 */
function mtgLife(o,PM,FM,dcl,CARDS,LF,lab,man,wh){
  var P=function(v){return Math.round(v*100)+'%';},Y=function(v){return '¥'+Math.round(v).toLocaleString();},K=function(v){return Math.round(v).toLocaleString();};
  var mn=function(m){return (+m.slice(5))+'月';},rg=function(a){return a.length?(+a[0].slice(5))+(a.length>1?'-'+(+a[a.length-1].slice(5)):'')+'月':'';},PL=rg(PM),FL=rg(FM),NM=FM.length||1;
  /* 2026-10-21 総評＝全行同じ基準：今期 着地÷目標 ≥100%→達成見込み／≥90%→あと少し／実績なし→新規／実績の稼働率<50%→稼働不足／それ以外→単価不足。台数＝今期の配車台数の平均 */
  function ev(r){var q=r.ft?r.fL/r.ft:1;return q>=1-1e-9?'達成見込み':q>=0.9-1e-9?'あと少し':!r.pad?'新規':r.prd/r.pad<0.5?'稼働不足':'単価不足';}
  function sg(v,f){return (v>=0?'+':'−')+f(Math.abs(v));}
  function row(r,cls,lb,ex){var d=r.fL-r.ft,c=Math.round(d/1e3)==0?'':d>=0?' pos':' neg',e='<td></td>';
    return '<tr'+(cls?' class="'+cls+'"':'')+wh(r.why)+'><td class="kqn"'+(cls=='kqx'?' style="text-align:left"':'')+'>'+lb+'</td>'
      +(ex?e:'<td class="kq1">'+(Math.round(r.n/NM*10)/10).toFixed(1)+'台</td>')
      +'<td class="kq1">'+man(r.pr)+'</td>'+(ex||!r.prd?e:'<td class="kq1">'+Y(r.pr/r.prd)+'</td>')+(ex||!r.pad?e:'<td class="kq1">'+P(r.prd/r.pad)+'</td>')
      +'<td class="kq0">'+man(r.ft)+'</td><td class="kq1">'+man(r.fL)+'</td><td class="kq2'+c+'">'+sg(d,man)+'</td><td class="kq3'+c+'">'+(ex||!r.ft?'':sg(Math.round((r.fL/r.ft-1)*100),function(x){return x+'%';}))+'</td>'
      +'<td class="kq1"><b>'+man(r.pr+r.fL)+'</b></td><td class="nxd"><b>'+(ex?'':ev(r))+'</b></td></tr>';}
  function mob(r,lb,ex,top){function ln(l,v,d,dc){return '<tr><th>'+l+'</th><td>'+v+'</td><td class="'+(dc||'')+'">'+(d||'')+'</td></tr>';}var d=r.fL-r.ft;
    return '<div class="'+(top?'mbig':'mcd'+(ex?' mcs':''))+'"'+wh(r.why)+'><div class="mch"><b>'+lb+'</b><span class="'+(d>=0?'mpos':'mneg')+'">'+(ex?'':ev(r))+'</span></div><table class="mtb"><tbody>'
      +ln('通期売上','<b>'+man(r.pr+r.fL)+'</b>')+ln('実績('+PL+')',man(r.pr),ex||!r.pad?'':P(r.prd/r.pad))+(ex||!r.prd?'':ln('実績単価',Y(r.pr/r.prd)))
      +ln('今期('+FL+')着地',man(r.fL)+' ／ '+man(r.ft),sg(d,man),d>=0?'mpos':'mneg')+(ex?'':ln('台数（'+FL+'平均）',(Math.round(r.n/NM*10)/10).toFixed(1)+'台'))+'</tbody></table></div>';}
  var TH='<colgroup>'+[130,60,70,70,60,70,70,70,55,80,80].map(function(x){return '<col style="width:'+(x/815*100).toFixed(2)+'%">';}).join('')+'</colgroup><thead><tr><th rowspan="2">クラス</th><th rowspan="2" class="kqh">台数<br>（'+FL+'平均）</th><th colspan="3" class="kqh">実績('+PL+')</th><th colspan="4" class="kqh">今期('+FL+')</th><th rowspan="2" class="kqh">通期<br>売上</th><th rowspan="2" class="kqh">総評</th></tr><tr><th class="kqh">売上</th><th>単価</th><th>稼働率</th><th class="kqh">目標</th><th>着地</th><th>差</th><th>%</th></tr></thead>';
  var H='',MB='',CHK=[];
  CARDS.forEach(function(cd,ci){var key=cd[0],br=cd[2],L=LF[key]||{cls:{},ext:null},S={n:0,pr:0,prd:0,pad:0,ft:0,fL:0},R='',M='',rows=[];
    dcl.forEach(function(c){var r={n:0,pr:0,prd:0,pad:0,ft:0,fL:0},ln=[];
      PM.forEach(function(m){var u=(br?(o[m].util_cb||{})[br+'|'+c]:(o[m].util||{})[c]),v=(br?(o[m].cls_cb||{})[br+'|'+c]:(o[m].cls||{})[c]);var rv=v?v.r||0:0;if(u){r.prd+=u.rd||0;r.pad+=u.ad||0;}r.pr+=rv;if(u||rv)ln.push(mn(m)+' 実績 ¥'+K(rv)+(u?'（貸出 '+K(u.rd)+'日／稼働可能 '+K(u.ad)+'日・'+(u.n||0)+'台）':''));});
      var f=L.cls[c];if(f){r.n+=f.n;r.ft=f.tg;r.fL=f.L;FM.forEach(function(m){var x=f.mon[m];if(x)ln.push(mn(m)+' 着地 ¥'+K(x[1])+'（目標 ¥'+K(x[0])+'・'+x[2]+'台）');});}
      if(!r.pr&&!r.pad&&!r.ft&&!r.fL)return;
      r.why='<b>'+lab(c).replace(/<[^>]+>/g,'')+(br?'（'+br+'）':'')+' 通期の月別</b><br>'+ln.join('<br>')+'<br>通期売上 ¥'+K(r.pr)+' ＋ ¥'+K(r.fL)+' ＝ ¥'+K(r.pr+r.fL);
      for(var k in S)S[k]+=r[k];r.c=c;r.ev=ev(r);rows.push(r);R+=row(r,'',lab(c));M+=mob(r,lab(c));});
    var X=null;if(L.ext){X={n:0,pr:Math.max(0,cd[3]-S.pr),prd:0,pad:0,ft:L.ext.t,fL:L.ext.L};X.pr=cd[3]-S.pr;
      X.why='<b>予約外・未配車（クラスなし） 通期</b><br>実績＝店の実績（予約＋予約外）−クラス行の実績 ¥'+K(X.pr)+'<br>今期＝各月の予約外・未配車 目標 ¥'+K(X.ft)+'／着地 ¥'+K(X.fL);}
    var T={n:S.n,pr:S.pr+(X?X.pr:0),prd:S.prd,pad:S.pad,ft:S.ft+(X?X.ft:0),fL:S.fL+(X?X.fL:0)};
    T.why='<b>'+cd[1]+' 通期</b><br>＝クラス行の合計'+(X?'＋予約外・未配車':'')+'<br>実績 ¥'+K(T.pr)+'（'+PL+'）・単価 '+(T.prd?Y(S.pr/T.prd):'–')+'（Σクラス売上÷Σ貸出）・稼働率 '+(T.pad?P(T.prd/T.pad):'–')+'<br>今期 目標 ¥'+K(T.ft)+(X?'（＝各月の店目標の合計）':'')+'／着地 ¥'+K(T.fL)+'<br>通期売上 ¥'+K(T.pr+T.fL);
    var T2={n:T.n,pr:T.pr,prd:T.prd,pad:T.pad,ft:T.ft,fL:T.fL,why:T.why};T.ev=ev(T);
    var top=row(T2,'kqs',br?br+' 計':'まとめ').replace('<td class="kq1">'+(T.prd?Y(T.pr/T.prd):''),'<td class="kq1">'+(T.prd?Y(S.pr/T.prd):''));
    var tb=br?'<tbody>'+R+top+'</tbody>':'<tbody class="kqsm">'+top+R+(X?row(X,'kqx','予約外・未配車<small class="nxg">（クラスなし）</small>',1):'')+'</tbody>';
    H+='<div class="kqc kqc-t"><div class="kqch"><b>'+cd[1]+'</b><span>行をクリックで月別の内訳</span></div><div class="tw"><table class="kqg">'+TH+tb+'</table></div></div>';
    var mb=(br?'':mob(T2,'まとめ',0,1))+'<details class="mbsec"'+(ci==0?' open':'')+'><summary>'+cd[1]+'</summary>'+M+(X?mob(X,'予約外・未配車',1):'')+(br?mob(T2,br+' 計'):'')+'</details>';MB+=mb;
    CHK.push({card:key,T:T,S:S,X:X,rows:rows,t:cd[3]});});
  window.DSG_CHK_L=CHK;
  return H+'<div class="kqmob">'+MB+'</div>';}
/* 2026-10-21 オーナー「全て足しても-88にならない」：サマリのまとめカードの最後のクラス行の下に「予約外・未配車（クラスなし）」の行（目標＝その月の予約外・未配車の実績＝見込み／実績／着地＝同じ実績）。
   台数・台あたり・単価・稼働率の列は空欄。bk＝目標予約件数の列あり（高松）。クラス行＋この行＝まとめ（売上・着地） */
function mtgXRow(bk,tg,ar,man,wh){var e='<td></td>',d=ar-tg,cl=Math.round(d/1e3)==0?'':d>=0?' pos':' neg',sd=(d>=0?'+':'−')+man(Math.abs(d)),E=function(n){var s='';for(var i=0;i<n;i++)s+=e;return s;};
  var w=wh('<b>予約外・未配車（クラスなし）</b><br>店の実績（予約＋予約外）からクラス行の実績を引いた分＝予約外売上（店舗）と、まだ車に配車していない予約など<br>目標＝この月の予約外・未配車の実績 ¥'+Math.round(tg).toLocaleString()+'（見込み＝今の実績・クラス目標と足して店目標）<br>実績・着地 ¥'+Math.round(ar).toLocaleString());
  return '<tr class="kqx"'+w+'><td class="kqn" style="text-align:left">予約外・未配車<small class="nxg">（クラスなし）</small></td>'+E(2+(bk?1:0))
    +'<td class="kq0">'+man(tg)+'</td><td class="kq1">'+man(ar)+'</td><td class="kq2'+cl+'">'+sd+'</td>'+E(1)+E(8)
    +'<td class="kq0">'+man(tg)+'</td><td class="kq1">'+man(ar)+'</td><td class="kq2'+cl+'">'+sd+'</td>'+E(1)+'</tr>';}
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
" #sum .kqc-t,#sum .kqp{display:none}#sum .kqmob{display:block}",
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
