// 資金計画の画面（2026-11-23 全面改修）。データ読込・支払日計算は fund-plan.js。
// 費用の流れ＝①費用発生（入庫日）→②業者への支払（hq_maint_pay・未登録は入庫日で仮）→③口座出金（AMEX 20日締め・翌月10日）。
// 表示のみ（書くのは「業者への支払日」＝hq_maint_pay の1行だけ・既存どおり）。金額＝実績(actual_cost)があれば確定・無ければ予算＝概算・どちらも0は「未入力」。
function vis(){return ITEMS.filter(i=>storeSel==='all'||i.store===storeSel);}
function storesIn(){return storeSel==='all'?STORES:[storeSel];}
// ③ 単価の基準：店×車検/点検×(Fクラス/それ以外)。今の予算と、実費の中央値（＝次の予算の候補）
function renderStd(){
  let h='<table class="pay"><tr><th>店・種別</th><th>クラス</th><th>今の予算</th><th>予算の出所</th><th>実費 件数</th><th>実費 中央値</th><th>平均</th><th>最小〜最大</th>'+(RESERVE?'<th>中央値＋余剰'+Math.round(RESERVE*100)+'%</th>':'')+'<th>判定</th></tr>';
  storesIn().forEach(s=>['sk','tk'].forEach(t=>[['F','Fクラス'],['x','F以外']].forEach(([f,fl])=>{
    const a=ITEMS.filter(i=>i.store===s&&i.ty===t&&(f==='F')===i.F),acts=a.filter(i=>i.act).map(i=>i.act);
    if(!a.length&&!acts.length)return;
    const cnt={};a.forEach(i=>{if(i.bud)cnt[i.bud+'|'+i.src]=(cnt[i.bud+'|'+i.src]||0)+1;});
    const top=Object.keys(cnt).sort((x,y)=>cnt[y]-cnt[x])[0],bud=top?+top.split('|')[0]:0,src=top?top.split('|')[1]:'';
    const md=median(acts),avg=acts.length?acts.reduce((x,y)=>x+y,0)/acts.length:0,sug=Math.round(md*(1+RESERVE)/1000)*1000;
    // 入力率が低いと「入れた分だけ」の偏った中央値になる → 出庫済みの8割以上に実費が入るまでは参考
    const done=a.filter(i=>i.end<today()).length,rate=done?acts.length/done:0;
    const j=!acts.length?'<span class="wtxt">実績なし</span>':acts.length<MIN_N?'<span class="wtxt">件数が少ない（参考）</span>':rate<0.8?'<span class="wtxt">入力率'+Math.round(rate*100)+'%（参考）</span>':'<span class="oktxt">使える</span>';
    h+='<tr><td>'+ST[s]+'　'+TY[t].l+'</td><td>'+fl+'</td><td>'+(bud?yen(bud):'—')+'</td><td>'+esc(src)+'</td><td>'+acts.length+' / '+a.length+'</td><td>'+(md?yen(md):'—')+'</td><td>'+(avg?yen(avg):'—')+'</td><td>'+(acts.length?yen(Math.min(...acts))+'〜'+yen(Math.max(...acts)):'—')+'</td>'+(RESERVE?'<td>'+(md?yen(sug):'—')+'</td>':'')+'<td>'+j+'</td></tr>';
  })));
  document.getElementById('std').innerHTML=h+'</table>';
}

// ④ 要確認：重複登録・予算未入力・実費未入力・次の車検/点検の登録漏れ
function gapList(){
  const td=today(),lim=dAddM(td,7),out=[];
  storesIn().forEach(s=>VEH[s].forEach(v=>{
    const a=ITEMS.filter(i=>i.store===s&&i.code===v.code&&(i.ty==='sk'||i.ty==='tk'));
    const pastSk=a.filter(i=>i.ty==='sk'&&i.start<td).map(i=>i.start).sort().pop()||'';
    const pastAny=a.filter(i=>i.start<td).map(i=>i.start).sort().pop()||'';
    const nextSk=a.filter(i=>i.ty==='sk'&&i.start>=td).map(i=>i.start).sort()[0]||'';
    const nextAny=a.filter(i=>i.start>=td).map(i=>i.start).sort()[0]||'';
    const noSk=!nextSk,noSoon=!nextAny||nextAny>lim;
    if(noSk||noSoon)out.push({store:s,v,pastSk,pastAny,nextSk,nextAny,noSk,noSoon,
      due:noSoon?(pastAny?dAddM(pastAny,6):''):(pastSk?dAddM(pastSk,12):'')});
  }));
  return out.sort((x,y)=>(x.due||'9999').localeCompare(y.due||'9999'));
}
function checks(){const td=today(),V=vis();return {
  dup:DUPS.filter(i=>storeSel==='all'||i.store===storeSel),
  nobud:V.filter(i=>(i.ty==='sk'||i.ty==='tk')&&!i.amt),
  noact:V.filter(i=>i.end<td&&(i.ty==='sk'||i.ty==='tk'||i.ty==='rp')&&!i.act),
  gap:gapList()};}
function renderCheck(){const c=checks();
  const row=(k,t,n,d)=>'<tr class="r'+(sel==='k|'+k?' sel':'')+'" onclick="pick(\'k\',\''+k+'\')"><td>'+t+'</td><td><b class="'+(n?'wtxt':'oktxt')+'">'+n+'</b></td><td>'+d+'</td></tr>';
  document.getElementById('chk').innerHTML='<table class="pay"><tr><th>項目</th><th>件数</th><th>直し方（行を押すと右に一覧）</th></tr>'+
    row('gap','次の車検・点検が未登録の車',c.gap.length,'配車表に次の車検（前回＋1年）・半年点検（前回＋6か月）の整備ブロックを入れる')+
    row('noact','実費が未入力（出庫済みの車検・点検・修理）',c.noact.length,'請求書が来たら配車表の「確定入力」で実費（税込・法定費用込みの請求総額）を入れる')+
    row('nobud','予算が入っていない車検・点検',c.nobud.length,'配車表の予算か車両マスタの車検費用・点検費用を入れる')+
    row('dup','重複登録の疑い（同じ車・種別・入庫日）',c.dup.length,'配車表で片方を削除（合計には1件だけ入れて表示中）')+'</table>';
}

function gapHTML(a){return a.length?a.map(x=>'<div class="it"><div class="h">'+(storeSel==='all'?'<span class="stg">'+ST[x.store]+'</span>':'')+'<span class="nm">'+esc(x.v.name)+'</span><span class="pl">'+esc(x.v.plate||'')+'</span>'+(x.v.cls?'<span class="stg">'+esc(x.v.cls)+'</span>':'')+'</div><div class="kv">'+
  '<span>前回車検</span><span>'+(x.pastSk?x.pastSk.replace(/-/g,'/'):'記録なし（14か月以内）')+'</span>'+
  '<span>前回(車検/点検)</span><span>'+(x.pastAny?x.pastAny.replace(/-/g,'/'):'記録なし')+'</span>'+
  '<span>登録済み</span><span>'+(x.nextAny?'次 '+x.nextAny.replace(/-/g,'/')+(x.nextSk?'／次の車検 '+x.nextSk.replace(/-/g,'/'):'／次の車検なし'):'今後の予定なし')+'</span>'+
  '<span>入れるもの</span><span class="wtxt">'+(x.noSoon?'7か月以内の点検/車検':'次の車検')+(x.due?'（目安 '+x.due.replace(/-/g,'/')+'）':'')+'</span></div></div>').join(''):'<div class="msg">なし</div>';}


// ===== 状態（店・集計軸・選択）。ブラウザの戻るで戻っても維持する =====
let axis='wd',tscope='future',vscope='future',OP={};
try{OP=JSON.parse(sessionStorage.getItem('fp_op')||'{}');}catch(e){}
(function restore(){try{const q=new URLSearchParams(location.hash.slice(1));
  if(q.get('s')&&(q.get('s')==='all'||ST[q.get('s')]))storeSel=q.get('s');
  if(q.get('a')==='st'||q.get('a')==='wd')axis=q.get('a');
  if(q.get('k'))sel=q.get('k');}catch(e){}})();
function saveState(){try{history.replaceState(null,'','#'+new URLSearchParams({s:storeSel,a:axis,k:sel||''}).toString());}catch(e){}}
function setOP(k,v){OP[k]=v;try{sessionStorage.setItem('fp_op',JSON.stringify(OP));}catch(e){}}
const LINK={nha:'https://nosh2318.github.io/naha-project/?tab=fleet',spk:'index.html?tab=fleet',bt:'https://buddica-touring.github.io/app/?tab=fleet'};

// ===== 集計（全画面で同じ関数・同じ明細から作る＝合計が必ず一致） =====
const AX={wd:'口座から出る月（出金月）',st:'費用が発生した月（入庫月）'};
function fd(d){return d?(+d.slice(5,7))+'/'+(+d.slice(8,10)):'';}
function fdl(d){return d?d.replace(/-/g,'/'):'';}
function vehN(a){return new Set(a.map(i=>i.store+'|'+i.code)).size;}
// 金額の意味：確定＝実費(act)／概算＝実費が無い分の予算(bud)／未入力＝どちらも0（0円とは別・合計に入らない）
function agg(a){const td=today(),o={n:0,veh:vehN(a),amt:0,conf:0,nConf:0,est:0,nEst:0,nNo:0,bud:0,act:0,budAct:0,wdK:0,wdN:0,wdPast:0,bk:0};
  a.forEach(i=>{o.n++;o.amt+=i.amt;o.bud+=i.bud;
    if(i.act){o.conf+=i.act;o.nConf++;o.act+=i.act;o.budAct+=i.bud;}
    else if(i.bud){o.est+=i.bud;o.nEst++;if(i.bkari)o.bk++;}
    else o.nNo++;
    if(i.wdS==='kari')o.wdK++;
    if(i.wdS==='none')o.wdN++;
    if(i.wd&&i.wd<td)o.wdPast++;});return o;}
const isPast=i=>!!(i.wd&&i.wd<today());
function pkey(i){if(axis==='st')return i.start.slice(0,7);if(!i.wd)return 'none';const ym=i.wd.slice(0,7);return ym<today().slice(0,7)?'past':ym;}
function plab(k){return k==='past'?'出金日が過ぎた分':k==='none'?'出金日を算出できない分':ymJ(k);}
function pkeys(V){const cur=today().slice(0,7),s=new Set(V.map(pkey));
  if(axis==='wd')[0,1,2].forEach(n=>s.add(ymAdd(cur,n)));
  const m=[...s].filter(k=>/^\d/.test(k)).sort();
  return axis==='wd'?(s.has('past')?['past']:[]).concat(m,s.has('none')?['none']:[]):m;}
const money=g=>g.n?(g.amt?yen(g.amt):'¥0'):'—';
function cellHTML(a,onclick,cls){if(!a.length)return '<td class="'+(cls||'')+'"><span class="mut">予定なし</span></td>';const g=agg(a);
  return '<td class="c '+(cls||'')+'" onclick="'+onclick+'"><b>'+(g.amt?yen(g.amt):'¥0')+'</b>'+(g.nNo?'<small class="wtxt">金額未入力 '+g.nNo+'件</small>':'')+'<small class="mut">'+g.n+'件・'+g.veh+'台</small></td>';}

// ===== 店舗タブ・集計軸 =====
function renderStores(){document.getElementById('stores').innerHTML=[['all','全店']].concat(STORES.map(s=>[s,ST[s]])).map(([k,l])=>'<button class="'+(storeSel===k?'on':'')+'" onclick="setStore(\''+k+'\')">'+l+'</button>').join('')+
  '<span class="sep"></span><span class="mut" style="font-size:11px">月の集計：</span>'+[['wd','口座から出る月'],['st','費用が発生した月']].map(([k,l])=>'<button class="ax '+(axis===k?'on':'')+'" onclick="setAxis(\''+k+'\')">'+l+'</button>').join('');}
function setStore(k){storeSel=k;sel=null;render();}
function setAxis(k){axis=k;if(sel&&/^[mcx]\|/.test(sel))sel=null;render();}

// ===== ① 全体の資金判断（上段） =====
function renderSum(){
  const td=today(),cur=td.slice(0,7),V=vis(),all=storeSel==='all';
  const fut=V.filter(i=>!isPast(i)),past=V.filter(isPast),gF=agg(fut);
  // 直近の出金日（今日以降で最も近い日）
  const nx=fut.filter(i=>i.wd).map(i=>i.wd).sort()[0],nxA=nx?V.filter(i=>i.wd===nx):[],gN=agg(nxA);
  const brk=a=>all?STORES.map(s=>{const x=a.filter(i=>i.store===s);return x.length?'<div class="br"><span>'+ST[s]+'</span><b>'+yen(agg(x).amt)+'</b></div>':'';}).join('')
    :TYS.map(t=>{const x=a.filter(i=>i.ty===t);return x.length?'<div class="br"><span>'+TY[t].l+'</span><b>'+yen(agg(x).amt)+'</b></div>':'';}).join('');
  const nxT='<div class="tile big" style="--c:#f59e0b" onclick="'+(nx?"pick('d','"+nx+"')":'')+'"><div class="t">直近の出金日</div>'+(nx?'<div class="v">'+fdl(nx)+'</div><div class="v2">'+yen(gN.amt)+'</div><div class="n">'+gN.n+'件・'+gN.veh+'台'+(gN.nNo?'・<span class="wtxt">金額未入力 '+gN.nNo+'件</span>':'')+'</div><div class="n">'+(gN.wdK?'<span class="kari">出金日は仮算出</span>':'出金日 確定')+'</div>'+brk(nxA):'<div class="v">予定なし</div>')+'</div>';
  const mT=[0,1,2].map(n=>{const ym=ymAdd(cur,n),a=V.filter(i=>i.wd&&i.wd.slice(0,7)===ym),g=agg(a),pa=a.filter(isPast);
    return '<div class="tile big" style="--c:#38bdf8" onclick="pick(\'w\',\''+ym+'\')"><div class="t">'+['今月','来月','再来月'][n]+'（'+ymJ(ym)+'）の出金</div>'+(a.length?'<div class="v2">'+yen(g.amt)+'</div><div class="n">'+g.n+'件・'+g.veh+'台'+(g.nNo?'・<span class="wtxt">金額未入力 '+g.nNo+'件</span>':'')+'</div>'+(pa.length?'<div class="n mut">うち日付経過 '+yen(agg(pa).amt)+'（支払確認なし）</div>':'')+brk(a):'<div class="v2">¥0</div><div class="n mut">出金予定なし</div>')+'</div>';}).join('');
  const ex=(c,t,v,n,f,w)=>'<div class="tile" style="--c:'+c+'"'+(f?' onclick="pick(\'f\',\''+f+'\')"':'')+'><div class="t">'+t+'</div><div class="v">'+v+'</div><div class="n'+(w?' wtxt':'')+'">'+n+'</div></div>';
  const gP=agg(past);
  document.getElementById('sum').innerHTML=
    '<h2>いつ・いくら用意するか <small>'+(all?'全店':ST[storeSel])+'・口座から出る日（出金日）で集計。カード払いの日（業者への支払日）ではありません</small></h2>'+
    '<div class="tiles">'+nxT+mT+'</div>'+
    '<h2>今後の出金予定の内訳 <small>出金日が今日以降の分。タイルを押すと明細</small></h2>'+
    '<div class="tiles">'+
      ex('#e2e8f0','今後の出金予定 合計',yen(gF.amt),gF.n+'件・'+gF.veh+'台'+(gF.nNo?'（金額未入力 '+gF.nNo+'件は合計に含まず）':''),'future',false)+
      ex('#34d399','確定額（実費が入った分）',yen(gF.conf),gF.nConf+'件・'+(gF.nConf?'請求どおり':'まだありません'),'conf',false)+
      ex('#60a5fa','概算額（実費待ちの予算）',yen(gF.est),gF.nEst+'件'+(gF.bk?'・うち仮予算 '+gF.bk+'件':''),'est',false)+
      ex('#fbbf24','金額が未入力',gF.nNo+'件','表示の合計に入っていません（0円ではありません）','no',gF.nNo>0)+
      ex('#fbbf24','出金日が仮の費用',gF.wdK+'件','業者への支払日が未登録。入庫日から仮に計算','kari',gF.wdK>0)+
      (gF.wdN?ex('#f87171','出金日を算出できない',gF.wdN+'件','入庫日が未入力','none',true):'')+
    '</div>'+
    (past.length?'<div class="pastbox" onclick="pick(\'f\',\'past\')"><b>出金日が過ぎた分 '+gP.n+'件・'+yen(gP.amt)+'</b><span>支払済みかどうかの記録がないため、「今後の出金予定」には入れていません。押すと明細</span></div>':'');
}

// ===== ② 月別（店舗別／区分別）・日付別・区分別台数 =====
function renderMon(){
  const V=vis(),all=storeSel==='all',keys=pkeys(V),cols=all?STORES.map(s=>({k:s,l:ST[s],f:i=>i.store===s})):TYS.map(t=>({k:t,l:TY[t].l,f:i=>i.ty===t}));
  const cur=today().slice(0,7);
  let h='<table class="pay mat"><tr><th>'+(axis==='wd'?'出金月':'発生月（入庫月）')+'</th>'+cols.map(c=>'<th>'+c.l+'</th>').join('')+'<th>合計</th><th>確定</th><th>概算</th></tr>';
  keys.forEach(k=>{const a=V.filter(i=>pkey(i)===k),g=agg(a),isP=k==='past'||k==='none';
    h+='<tr class="'+(k===cur?'now':'')+(isP?' flag':'')+'"><td class="lab" onclick="pick(\'m\',\''+k+'\')">'+plab(k)+(k==='past'?'<small class="mut">支払済みか未確認</small>':'')+(k===cur&&axis==='wd'?'<small class="wtxt">今月</small>':'')+'</td>'+
      cols.map(c=>cellHTML(a.filter(c.f),all?"pick('c','"+c.k+"','"+k+"')":"pick('x','"+c.k+"','"+k+"')")).join('')+
      cellHTML(a,"pick('m','"+k+"')",'tot')+'<td>'+(g.conf?yen(g.conf):'—')+'</td><td>'+(g.est?yen(g.est):'—')+'</td></tr>';});
  const T=agg(V);
  h+='<tr class="tot"><td>全期間の合計</td>'+cols.map(c=>{const a=V.filter(c.f),g=agg(a);return '<td><b>'+yen(g.amt)+'</b><small class="mut">'+g.n+'件・'+g.veh+'台</small></td>';}).join('')+'<td><b>'+yen(T.amt)+'</b><small class="mut">'+T.n+'件・'+T.veh+'台</small></td><td>'+yen(T.conf)+'</td><td>'+yen(T.est)+'</td></tr></table>';
  document.getElementById('mon').innerHTML='<h2>月別'+(all?'・店舗別':'・区分別')+' <small>集計の基準＝'+AX[axis]+'。金額を押すと明細</small></h2><div class="paywrap">'+(V.length?h:'<div class="msg">対象なし</div>')+'</div>'+
    (V.some(i=>!i.amt)?'<div class="note wtxt">金額が未入力の費用があります。表示の金額には入っていません（セルに「金額未入力 N件」と出しています）。</div>':'');
}
function renderDay(){
  const V=vis(),all=storeSel==='all',td=today(),cols=all?STORES.map(s=>({l:ST[s],f:i=>i.store===s})):TYS.map(t=>({l:TY[t].l,f:i=>i.ty===t}));
  const ds=[...new Set(V.filter(i=>i.wd&&i.wd>=td).map(i=>i.wd))].sort();
  const row=(lab,a,oc,flag)=>{const g=agg(a);return '<tr class="r'+(flag?' flag':'')+'" onclick="'+oc+'"><td>'+lab+'</td><td>'+(g.wdK?'<span class="kari">仮'+(g.wdK<g.n?' '+g.wdK+'/'+g.n:'')+'</span>':'<span class="oktxt">確定</span>')+'</td><td>'+g.n+'件・'+g.veh+'台</td>'+cols.map(c=>{const x=a.filter(c.f);return '<td>'+(x.length?(agg(x).amt?yen(agg(x).amt):'¥0'):'—')+'</td>';}).join('')+'<td><b>'+yen(g.amt)+'</b>'+(g.nNo?'<small class="wtxt">未入力'+g.nNo+'件</small>':'')+'</td></tr>';};
  let h='<table class="pay"><tr><th>口座出金日</th><th>日付</th><th>対象</th>'+cols.map(c=>'<th>'+c.l+'</th>').join('')+'<th>合計</th></tr>';
  ds.forEach(d=>{h+=row(fdl(d),V.filter(i=>i.wd===d),"pick('d','"+d+"')",false);});
  const past=V.filter(isPast),none=V.filter(i=>!i.wd);
  if(past.length)h+=row('日付が過ぎた分（支払確認なし）',past,"pick('f','past')",true);
  if(none.length)h+=row('出金日を算出できない分',none,"pick('f','none')",true);
  const T=agg(V);
  h+='<tr class="tot"><td>合計</td><td></td><td>'+T.n+'件・'+T.veh+'台</td>'+cols.map(c=>'<td>'+yen(agg(V.filter(c.f)).amt)+'</td>').join('')+'<td>'+yen(T.amt)+'</td></tr></table>';
  document.getElementById('day').innerHTML='<h2>日付別の出金 <small>口座から出る日ごと。「仮」＝業者への支払日が未登録で、入庫日から仮に計算した日</small></h2><div class="paywrap">'+(V.length?h:'<div class="msg">対象なし</div>')+'</div>';
}
function renderTyp(){
  const V=vis().filter(i=>tscope==='all'||!isPast(i));
  let h='<table class="pay"><tr><th>区分</th><th>件数</th><th>対象台数</th><th>金額</th><th>確定</th><th>概算</th><th>金額未入力</th></tr>';
  TYS.forEach(t=>{const a=V.filter(i=>i.ty===t),g=agg(a);h+='<tr class="r" onclick="pick(\'t\',\''+t+'\')"><td><i class="dot" style="--c:'+TY[t].c+'"></i>'+TY[t].l+'</td><td>'+g.n+'</td><td>'+g.veh+'</td><td><b>'+(g.n?yen(g.amt):'—')+'</b></td><td>'+(g.conf?yen(g.conf):'—')+'</td><td>'+(g.est?yen(g.est):'—')+'</td><td class="'+(g.nNo?'wtxt':'')+'">'+(g.nNo?g.nNo+'件':'—')+'</td></tr>';});
  const T=agg(V);h+='<tr class="tot"><td>合計</td><td>'+T.n+'</td><td>'+T.veh+'<small class="mut">（延べでなく実台数）</small></td><td>'+yen(T.amt)+'</td><td>'+yen(T.conf)+'</td><td>'+yen(T.est)+'</td><td>'+(T.nNo?T.nNo+'件':'—')+'</td></tr></table>';
  document.getElementById('typ').innerHTML='<h2>費用区分別 <small>件数と車両台数は別に数えます（同じ車の2件＝2件・1台）</small></h2><div class="seg"><button class="'+(tscope==='future'?'on':'')+'" onclick="setTscope(\'future\')">今後の出金（日付が過ぎていない分）</button><button class="'+(tscope==='all'?'on':'')+'" onclick="setTscope(\'all\')">読み込んだ全期間</button></div><div class="paywrap">'+h+'</div>';
}
function setTscope(k){tscope=k;renderTyp();}

// ===== ③ 予算・実績・出金予定 =====
function renderBva(){
  const td=today(),V=vis(),done=V.filter(i=>i.start<=td),g=agg(done),fut=agg(V.filter(i=>!isPast(i)));
  const partial=g.n&&g.nConf<g.n;
  const tl=(c,t,v,n,w)=>'<div class="tile" style="--c:'+c+'"><div class="t">'+t+'</div><div class="v">'+v+'</div><div class="n'+(w?' wtxt':'')+'">'+n+'</div></div>';
  const d=g.act-g.budAct;
  let h='<div class="tiles">'+
    tl('#64748b','予算（入庫済みの全件）',yen(g.bud),g.n+'件')+
    tl('#34d399','実績が入った分',g.nConf?yen(g.act):'—','実績入力 '+g.nConf+' / '+g.n+'件',partial)+
    tl('#34d399','その実績に対応する予算',g.nConf?yen(g.budAct):'—',g.nConf?'差額 '+sgn(d)+(d>0?'（予算超過）':d<0?'（予算内）':''):'実績が入ると比較できます',false)+
    tl('#60a5fa','実績待ちの分の概算',yen(g.est),g.nEst+'件（実績が入ると置き換わる）',false)+
    tl('#e2e8f0','今後、口座から出る予定額',yen(fut.amt),fut.n+'件・出金日が今日以降',false)+'</div>';
  if(partial)h+='<div class="note wtxt">実績は '+g.nConf+' / '+g.n+'件しか入っていません。予算の総額と実績を比べて「予算内」とは判断できないため、差額は実績が入った分だけで出しています。</div>';
  const diff=V.filter(i=>i.act&&i.act!==i.bud);
  h+='<div class="note"><a class="lk" onclick="pick(\'f\',\'diff\')">差額が出ている明細：'+diff.length+'件</a>'+(diff.length?'':'（実績が入った明細がまだありません）')+'</div>';
  document.getElementById('bva').innerHTML='<h2>予算と実績 <small>費用が発生した（入庫した）分。実績が入ると、その分の概算は実績に置き換わり二重には数えません</small></h2>'+h;
}
// 予実（費用が発生した月＝入庫月ごと）
function renderYJ(){
  const td=today(),cur=td.slice(0,7),months=Array.from({length:12},(_,i)=>ymAdd(cur,i-11)),V=vis().filter(i=>i.start<=td);
  let h='<table class="pay"><tr><th>発生月（入庫月）</th><th>件数</th><th>予算</th><th>実績入力</th><th>実績</th><th>実績が入った分の予算</th><th>差額（実績−予算）</th><th>実績待ちの概算</th></tr>',T={n:0,bud:0,act:0,nConf:0,budAct:0},Tw=0;
  months.forEach(ym=>{const a=V.filter(i=>i.start.slice(0,7)===ym);if(!a.length)return;const g=agg(a),w=g.est,k='m|'+ym,d=g.act-g.budAct;Tw+=w;
    T.n+=g.n;T.bud+=g.bud;T.act+=g.act;T.nConf+=g.nConf;T.budAct+=g.budAct;
    h+='<tr class="r'+(sel===k?' sel':'')+'" onclick="pickSt(\''+ym+'\')"><td>'+ymJ(ym)+'</td><td>'+g.n+'</td><td>'+yen(g.bud)+'</td><td>'+g.nConf+'/'+g.n+(g.nConf<g.n?' <span class="wtxt">未'+(g.n-g.nConf)+'</span>':'')+'</td><td>'+(g.act?yen(g.act):'—')+'</td><td>'+(g.nConf?yen(g.budAct):'—')+'</td><td class="'+(d>0?'neg':d<0?'pos':'')+'">'+(g.nConf?sgn(d):'—')+'</td><td>'+(w?yen(w):'—')+'</td></tr>';});
  const d=T.act-T.budAct;
  h+='<tr class="tot"><td>12か月計</td><td>'+T.n+'</td><td>'+yen(T.bud)+'</td><td>'+T.nConf+'/'+T.n+'</td><td>'+yen(T.act)+'</td><td>'+yen(T.budAct)+'</td><td class="'+(d>0?'neg':d<0?'pos':'')+'">'+(T.nConf?sgn(d):'—')+'</td><td>'+yen(Tw)+'</td></tr></table>';
  document.getElementById('yj').innerHTML='<h2>予実（'+AX.st+'ごと） <small>今日までに入庫した分。行を押すと明細</small></h2><div class="paywrap">'+(T.n?h:'<div class="msg">対象なし</div>')+'</div>';
}
function pickSt(ym){axis='st';sel='m|'+ym;render();}

// ===== 店舗タブ：車両ごとの費用明細 =====
function renderVeh(){
  const el=document.getElementById('veh');
  if(storeSel==='all'){el.innerHTML='';return;}
  let V=vis();if(vscope==='future')V=V.filter(i=>!isPast(i));
  const by={};V.forEach(i=>{(by[i.code]=by[i.code]||[]).push(i);});
  const rows=Object.keys(by).map(c=>({c,a:by[c],g:agg(by[c])})).sort((x,y)=>y.g.amt-x.g.amt||x.a[0].name.localeCompare(y.a[0].name));
  let h='<div class="seg"><button class="'+(vscope==='future'?'on':'')+'" onclick="setVscope(\'future\')">今後の出金分</button><button class="'+(vscope==='all'?'on':'')+'" onclick="setVscope(\'all\')">読み込んだ全期間</button></div>';
  h+=rows.length?rows.map(r=>{const f=r.a[0],k='veh:'+storeSel+':'+r.c,open=OP[k]===true;
    return '<details class="vh" data-k="'+esc(k)+'" '+(open?'open':'')+' ontoggle="setOP(this.dataset.k,this.open)"><summary><span class="nm">'+esc(f.name)+'</span><span class="pl">'+esc(f.plate)+'</span>'+(f.cls?'<span class="stg">'+esc(f.cls)+'</span>':'')+
      '<span class="mut sm">'+r.g.n+'件</span><span class="am">'+(r.g.n&&r.g.amt?yen(r.g.amt):'<span class="wtxt">金額未入力</span>')+(r.g.nNo&&r.g.amt?'<small class="wtxt">＋未入力'+r.g.nNo+'件</small>':'')+'</span></summary>'+
      r.a.slice().sort((x,y)=>x.start.localeCompare(y.start)).map(itemHTML).join('')+'</details>';}).join(''):'<div class="msg">対象なし</div>';
  const T=agg(V);
  el.innerHTML='<h2>車両ごとの費用明細 <small>'+ST[storeSel]+'・'+rows.length+'台。車を押すと明細、明細を押すと費用の流れと内容</small></h2>'+h+'<div class="note">合計 '+yen(T.amt)+'（'+T.n+'件・'+T.veh+'台）'+(T.nNo?'／金額未入力 '+T.nNo+'件は含まず':'')+'</div>';
}
function setVscope(k){vscope=k;renderVeh();}

// ===== 明細（1件）＝要約行＋展開で「発生→業者支払→出金」の流れ =====
function stageOf(i){const td=today();return i.end<td?'実施済み':(i.start<=td?'入庫中':'予定');}
function summ(i){const t=i.detail||i.cause;return t?esc(t.length>40?t.slice(0,40)+'…':t):'<span class="mut">作業内容 未登録</span>';}
function itemHTML(it){const k='it:'+it.key,open=OP[k]===true,td=today();
  const amt=it.amt?yen(it.amt):'<span class="wtxt">金額未入力</span>';
  const flow='<div class="flow"><div class="stp"><small>① 費用発生</small><b>'+fd(it.start)+(it.end&&it.end!==it.start?'〜'+fd(it.end):'')+'</b><small>'+stageOf(it)+'</small></div><span class="ar">→</span>'+
    '<div class="stp'+(it.pay?'':' unk')+'"><small>② 業者への支払（カード）</small><b>'+(it.pay?fdl(it.pay):'未登録')+'</b><small>'+(it.pay?'登録済み':'入庫日 '+fd(it.start)+' で仮計算')+'</small></div><span class="ar">→</span>'+
    '<div class="stp'+(it.wdS==='fix'?'':' unk')+'"><small>③ 口座から出金</small><b>'+(it.wd?fdl(it.wd):'算出不可')+'</b><small>'+(it.wdS==='fix'?'確定（'+fd(it.close)+'締め）':it.wdS==='kari'?'仮算出（'+fd(it.close)+'締め）':'入庫日が未入力')+'</small></div></div>'+
    (it.wd?'<div class="need">資金を用意する月：<b>'+ymJ(it.wd.slice(0,7))+'</b>（'+fdl(it.wd)+' までに '+(it.amt?yen(it.amt):'金額未入力')+'）</div>':'');
  const dif=it.act?it.act-it.bud:null;
  return '<details class="itx" data-k="'+esc(k)+'" '+(open?'open':'')+' ontoggle="setOP(this.dataset.k,this.open)"><summary><span class="tag" style="--c:'+TY[it.ty].c+'">'+esc(it.label||TY[it.ty].l)+'</span><span class="sm">'+summ(it)+'</span><span class="dt">'+fd(it.start)+'</span><span class="am">'+amt+'</span></summary><div class="bd">'+flow+
    '<div class="kv"><span>車両</span><span><b>'+esc(it.name)+'</b> <span class="pl">'+esc(it.plate)+'</span>'+(it.cls?' <span class="stg">'+esc(it.cls)+'</span>':'')+'</span>'+
    '<span>作業内容</span><span>'+(it.detail?esc(it.detail):'<span class="mut">未登録</span>')+(it.cause?'（原因：'+esc(it.cause)+'）':'')+'</span>'+
    (it.memo?'<span>備考</span><span>'+esc(it.memo)+'</span>':'')+
    '<span>予算</span><span>'+(it.bud?yen(it.bud)+' <small class="mut">'+esc(it.src)+'</small>'+(it.bkari?' <span class="kari">仮</span>':''):'<span class="mut">未入力</span>')+'</span>'+
    '<span>実績</span><span>'+(it.act?'<b>'+yen(it.act)+'</b>　差額 <span class="'+(dif>0?'neg':'pos')+'">'+sgn(dif)+'</span>':'<span class="mut">未入力（予算を概算として使用）</span>')+'</span>'+
    '<span>状態</span><span>'+stageOf(it)+'／'+(it.wd&&it.wd<td?'出金予定日が過ぎています（支払済みの記録なし）':'支払前')+'</span>'+
    '<span>支払方法</span><span>'+(it.pay?'カード（AMEX）':'<span class="mut">未登録</span>（AMEX・20日締め翌月10日引落で仮計算）')+'</span>'+
    (it.workshop?'<span>支払先</span><span>'+esc(it.workshop)+'</span>':'')+
    (it.inv?'<span>請求書No</span><span>'+esc(it.inv)+'</span>':'')+
    '<span>支払日を入力</span><span class="pd"><input type="date" value="'+(it.pay||'')+'" onchange="savePay(\''+esc(it.key)+'\',this.value,this)"></span></div>'+
    '<div class="lnk"><a href="'+LINK[it.store]+'">配車表で実績・作業内容を入力 →</a><small class="mut">戻ると今の月・店舗の表示が残ります</small></div></div></details>';}

// ===== 右の明細パネル（月→店舗→区分→車両明細→流れ） =====
function pick(kind,a,b){sel=kind==='c'||kind==='x'?kind+'|'+a+'|'+b:kind+'|'+a;render();if(innerWidth<=900)document.getElementById('panel').scrollIntoView({behavior:'smooth'});}
function curItems(){if(!sel)return null;const p=sel.split('|'),V=vis(),L=axis==='wd'?'出金':'入庫';
  const lab=s=>(s==='all'?'全店':ST[s]);
  if(p[0]==='m')return {t:lab(storeSel)+'　'+plab(p[1]),sub:AX[axis]+'で集計',a:V.filter(i=>pkey(i)===p[1])};
  if(p[0]==='w'){return {t:lab(storeSel)+'　'+ymJ(p[1])+'の出金',sub:AX.wd,a:V.filter(i=>i.wd&&i.wd.slice(0,7)===p[1])};}
  if(p[0]==='c')return {t:ST[p[1]]+'　'+plab(p[2]),sub:AX[axis]+'で集計',a:V.filter(i=>i.store===p[1]&&pkey(i)===p[2])};
  if(p[0]==='x')return {t:ST[storeSel]+'　'+TY[p[1]].l+'　'+plab(p[2]),sub:AX[axis]+'で集計',a:V.filter(i=>i.ty===p[1]&&pkey(i)===p[2])};
  if(p[0]==='d')return {t:fdl(p[1])+' の口座出金',sub:'この日に口座から出る費用',a:V.filter(i=>i.wd===p[1])};
  if(p[0]==='t')return {t:lab(storeSel)+'　'+TY[p[1]].l+(tscope==='future'?'（今後の出金）':'（全期間）'),sub:'',a:V.filter(i=>i.ty===p[1]&&(tscope==='all'||!isPast(i)))};
  if(p[0]==='f'){const f={future:['今後の出金予定すべて',i=>!isPast(i)],conf:['確定額（実績が入った分）',i=>!isPast(i)&&i.act>0],est:['概算額（実績待ち・予算で見ている分）',i=>!isPast(i)&&!i.act&&i.bud>0],
      no:['金額が未入力の費用（合計に入っていません）',i=>!isPast(i)&&!i.amt],kari:['出金日が仮の費用（業者への支払日が未登録）',i=>!isPast(i)&&i.wdS==='kari'],none:['出金日を算出できない費用',i=>i.wdS==='none'],
      past:['出金日が過ぎた分（支払済みかの記録なし）',isPast],diff:['予算と実績に差額が出ている明細',i=>i.act&&i.act!==i.bud]}[p[1]];return {t:lab(storeSel)+'　'+f[0],sub:'',a:V.filter(f[1])};}
  if(p[0]==='k'){const c=checks();return {t:{gap:'次の車検・点検が未登録の車',noact:'実績が未入力',nobud:'予算が入っていない車検・点検',dup:'重複登録の疑い'}[p[1]],a:c[p[1]],k:p[1]};}
  return null;}
function renderPanel(){const c=curItems(),el=document.getElementById('panel');
  if(!c){el.innerHTML='<div class="msg">金額や行を押すと、ここに店舗別・区分別・車両別の明細が出ます</div>';return;}
  if(c.k==='gap'){el.innerHTML='<div class="ph"><b>'+esc(c.t)+'</b><div class="s">'+c.a.length+'台。目安＝前回の車検＋1年・前回の車検/点検＋6か月（14か月以内の記録から）</div></div>'+gapHTML(c.a);return;}
  const a=c.a.slice().sort((x,y)=>(x.start+x.store).localeCompare(y.start+y.store)),g=agg(a),all=storeSel==='all';
  let h='<div class="ph"><b>'+esc(c.t)+'</b><div class="big2">'+yen(g.amt)+'</div><div class="s">'+g.n+'件・'+g.veh+'台'+(c.sub?'・'+esc(c.sub):'')+'</div><div class="s">確定 '+yen(g.conf)+'（'+g.nConf+'件）／概算 '+yen(g.est)+'（'+g.nEst+'件）'+(g.nNo?'／<span class="wtxt">金額未入力 '+g.nNo+'件（合計に未計上）</span>':'')+'</div></div>';
  if(!a.length){el.innerHTML=h+'<div class="msg">この範囲の整備はありません</div>';return;}
  const many=a.length>12;
  const tyBlock=(arr,pk)=>TYS.filter(t=>arr.some(i=>i.ty===t)).map(t=>{const x=arr.filter(i=>i.ty===t),gx=agg(x),k=pk+':'+t,open=OP[k]!==undefined?OP[k]:!many;
    return '<details class="lv2" data-k="'+k+'" '+(open?'open':'')+' ontoggle="setOP(this.dataset.k,this.open)"><summary><i class="dot" style="--c:'+TY[t].c+'"></i>'+TY[t].l+'<span class="mut sm">'+gx.n+'件・'+gx.veh+'台</span><span class="am">'+(gx.amt?yen(gx.amt):'<span class="wtxt">未入力</span>')+'</span></summary>'+x.map(itemHTML).join('')+'</details>';}).join('');
  if(all){h+=STORES.filter(s=>a.some(i=>i.store===s)).map(s=>{const x=a.filter(i=>i.store===s),gx=agg(x),k='st:'+s;
    return '<details class="lv1" data-k="'+k+'" '+(OP[k]===false?'':'open')+' ontoggle="setOP(this.dataset.k,this.open)"><summary><b>'+ST[s]+'</b><span class="mut sm">'+gx.n+'件・'+gx.veh+'台</span><span class="am">'+yen(gx.amt)+'</span></summary>'+tyBlock(x,'pn:'+s)+'</details>';}).join('');}
  else h+=tyBlock(a,'pn:'+storeSel);
  el.innerHTML=h;}


async function savePay(key,val,el){const it=ITEMS.find(i=>i.key===key)||DUPS.find(i=>i.key===key);if(!it)return;el.disabled=true;
  try{const r=await sb('hq_maint_pay?on_conflict=key','POST',{key,store:it.store,maint_id:it.id,pay_date:val||null},'return=representation,resolution=merge-duplicates');
    if(!r||!r.length||(r[0].pay_date||'')!==(val||''))throw new Error('保存の確認ができませんでした');
    PAY[key]=r[0];withPay(it);render();
  }catch(e){alert(e.message==='LOGIN'?'ログインが切れています。ダッシュボードで再ログインしてください':'保存できませんでした：'+e.message);el.disabled=false;}}


function render(){renderStores();renderSum();renderMon();renderTyp();renderDay();renderVeh();renderBva();renderYJ();renderCheck();renderStd();renderPanel();saveState();}
renderStores();load();
