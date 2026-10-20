/* 2026-10-21 bt/spk/nha-mtg-2026h2.html 共通：KPIタブの表の縦軸そろえ＋サマリ見た目（オーナー「また縦軸がずれてます。KPI側もサマリ側に合わせたデザイン フォントに 稼働率の点滅などはそのまま」
   「どの数字がどの項目かわからない 枠なのでちゃんと可視化できるように」）。値・表の中身・並びは変えない（見た目と列幅だけ）。
   ① KPIタブ（#body）の全表：ラベル列 KPI_LW px＋1か月 KPI_MW px に固定（月の中の2〜3列は KPI_SUB の比率で月幅の中で分ける）・table-layout:fixed
      → 全表が同じ総幅・どの表でも ◯月 の左端が同じx。横スクロールは #body 1つで全表いっしょに動く（表ごとにずれない）
   ② 列グループ（KPI＝月／サマリ＝台数・売上・稼働率…）の境目に縦線 #9ca3af・グループ内の列の間は細線 #ece8e1・グループ背景は白／#faf9f7 の交互
   ③ 見た目はサマリ（138125b）に合わせる：白カード・角丸12px・枠 #e7e3dc・見出しはグレー文字（背景なし）・13px黒・tabular-nums・横線のみ・合計行はベージュ帯 #efebe5 の太字
      色はマイナスの赤だけ（点滅 blink/frblink・セル内の小さな補足は今のまま） */
var KPI_LW=170,KPI_MW=256,KPI_SUB={1:[1],2:[.4,.6],3:[.2,.37,.43]};
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
}
/* KPIタブの表をカードに入れて、列幅を全表共通の格子にする（render の直後・月の折りたたみより前に呼ぶ） */
function kpiGrid(){
  var b=document.getElementById("body");if(!b)return;
  var tws=b.querySelectorAll(".tw");
  for(var q=0;q<tws.length;q++){
    var tw=tws[q],t=tw.querySelector("table");if(!t)continue;
    var h=tw.previousElementSibling,card=document.createElement("div");card.className="kc";
    if(h&&h.classList.contains("h2")){if(h.id){card.id=h.id;h.removeAttribute("id");}tw.parentNode.insertBefore(card,h);card.appendChild(h);}else tw.parentNode.insertBefore(card,tw);
    card.appendChild(tw);
    t.classList.add("kg");
    var cols=t.querySelectorAll("colgroup col"),N=t.querySelectorAll("thead tr:first-child th.mh").length;
    if(N&&cols.length>1){
      var sub=Math.max(1,Math.round((cols.length-1)/N)),R=KPI_SUB[sub]||[];
      cols[0].style.width=KPI_LW+"px";cols[0].setAttribute("data-w",KPI_LW);
      for(var i=0;i<N;i++){var u=0;for(var s=0;s<sub;s++){var cl=cols[1+i*sub+s];if(!cl)continue;var w=s==sub-1?KPI_MW-u:Math.round(KPI_MW*(R[s]||1/sub));u+=w;cl.style.width=w+"px";cl.setAttribute("data-w",w);}}
      t.style.width=(KPI_LW+N*KPI_MW)+"px";t.setAttribute("data-kg","1");
    }
    gridMark(t);
  }
}
/* 月の折りたたみ（setupMonthCollapse）から呼ぶ：折りたたみ後の列幅の合計を表の幅にする（全表で同じ月をたたむので縦軸はそろったまま） */
function kpiGridWidth(t){if(!t.hasAttribute("data-kg"))return;var cs=t.querySelectorAll("colgroup col"),s=0;for(var i=0;i<cs.length;i++)s+=parseFloat(cs[i].style.width)||0;t.style.width=s+"px";}
(function(){var css=[
/* ── KPIタブ（#body） ── */
"@media screen{body.tab-kpi{background:#f5f3ef}#body{overflow-x:auto}#body .tw{overflow:visible!important;margin:0!important;padding:0!important}}",
"#body .kc{background:#fff;border:1px solid #e7e3dc;border-radius:12px;box-shadow:0 1px 2px rgba(17,24,39,.04);padding:10px 10px 6px;margin:0 0 14px;width:max-content;min-width:100%}",
"#body .kc .h2{font-size:15px;font-weight:700;color:#111827;border:0;padding:0;margin:0 0 6px}",
"#body table.kg{table-layout:fixed;min-width:0;border-collapse:collapse;font-family:\"Hiragino Sans\",\"Noto Sans JP\",system-ui,sans-serif;font-variant-numeric:tabular-nums;color:#111827;background:#fff}",
"#body table.kg th,#body table.kg td{border:0;border-bottom:1px solid #ece8e1;font-size:13px;line-height:1.3;padding:0 4px;height:32px;color:#111827;font-weight:400;background:#fff;overflow:hidden;text-overflow:clip}",
"#body table.kg thead th{color:#6b7280;font-size:12px;font-weight:400;text-align:right;white-space:nowrap;height:26px}",
"#body table.kg thead tr:first-child th.mh{color:#111827;font-weight:700;font-size:13px;text-align:center;border-bottom:1px solid #9ca3af}",
"#body table.kg thead tr+tr th{color:#4b5563;font-size:12px;text-align:right}",
"#body table.kg th.l{text-align:left;color:#6b7280;font-weight:400}",
"#body table.kg td.l{font-weight:600;text-align:left;white-space:normal;overflow:visible}",
"#body table.kg th.l,#body table.kg td.l{box-shadow:inset -1px 0 0 #9ca3af}",
"#body table.kg td.l{overflow:hidden!important}#body table.kg td.l .cn{font-size:12px;font-weight:400;color:#374151;display:inline-block;max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}",
"#body table.kg td.cnt{font-size:13px;color:#111827}#body table.kg td.rev{font-weight:600}",
"#body table.kg .gs,#body table.kg .ms:not(.blink){border-left:1px solid #9ca3af!important}#body table.kg .gi{border-left:1px solid #ece8e1}#body table.kg .gs.g1:not(.blink){border-left:0!important}",
"#body table.kg td.galt,#body table.kg th.galt{background:#faf9f7}",
/* 行の色分け（目標/進捗/差分・稼働台数・AA除く）はやめて白／グループ背景だけ。合計行（総合計・グロス・ブランド計）はベージュ帯の太字 */
"#body table.kg tr:is(.gr,.gp,.gt2,.act,.exaa,.brutil) td:not(.blink){background:#fff!important;font-weight:400;color:#111827;font-size:13px;border-top:0}",
"#body table.kg tr:is(.gr,.gp,.gt2,.act,.exaa,.brutil) td.galt:not(.blink){background:#faf9f7!important}",
"#body table.kg tr.exaa td:not(.blink){color:#6b7280!important;font-size:12px}#body table.kg tr.exaa td.l{font-style:italic;font-weight:600}",
"#body table.kg tr:is(.foot,.uf,.brow) td:not(.blink){background:#efebe5!important;font-weight:700;color:#111827;border-top:0;border-bottom:1px solid #e2ddd5}",
"#body table.kg .pos{color:#111827;font-weight:inherit}#body table.kg .neg{color:#b91c1c;font-weight:inherit}#body table.kg .z{color:#9ca3af}",
"#body table.kg td:not(.blink) b[style]{color:#111827!important}#body table.kg td[style*=\"color:#0f766e\"]:not(.blink){color:#111827!important}",
"#body table.kg th.mh.mcol{background:#efebe5!important;color:#111827!important}",
/* 印刷・PDF：今までどおり用紙幅に収める（固定幅・カード・横スクロールを外す） */
"@media print{#body{overflow:visible!important}#body .kc{width:auto!important;min-width:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;margin:0!important}#body table.kg{table-layout:auto!important;width:auto!important;min-width:100%!important}#body table.kg col:not(:first-child){width:auto!important}#body table.kg th,#body table.kg td{height:auto!important;overflow:visible!important}#body table.kg th.l,#body table.kg td.l{position:static}}",
/* ── サマリ（#sum）：列グループの枠・見出しはグループの真上で中央の太字＋下に線・2段目は右寄せ・見出し固定 ── */
"#sum table.kqg .gs{border-left:1px solid #9ca3af!important}#sum table.kqg .gi{border-left:1px solid #ece8e1!important}",
"#sum table.kqg td.galt{background:#faf9f7}",
"#sum table.kqg thead{position:sticky;top:0;z-index:3}",
"#sum table.kqg thead tr th{background:#fff!important}#sum table.kqg thead tr th.galt{background:#faf9f7!important}",
"#sum table.kqg thead tr:first-child th.gs{color:#111827;font-weight:700;font-size:13px;text-align:center;border-bottom:1px solid #9ca3af}",
"#sum table.kqg thead tr+tr th{color:#4b5563;font-size:12px;text-align:right}"
].join("\n");var st=document.createElement("style");st.id="mtgGridCss";st.textContent=css;document.head.appendChild(st);})();
