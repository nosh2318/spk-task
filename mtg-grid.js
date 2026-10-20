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
"#sum table.kqg tr td:is(.kq2,.kq3).zr{color:#111827!important}"
].join("\n");var st=document.createElement("style");st.id="mtgGridCss";st.textContent=css;document.head.appendChild(st);})();
