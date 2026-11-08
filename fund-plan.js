// 資金計画（hq 車両 > 資金計画）
// 2026-10-24 新設：正本＝配車表の整備ブロック（maintenance / nha_maintenance / bt_maintenance）を開くたびに読む。
// 2026-11-08 改修：予算と実費（予実）を分けて表示・予算の基準（那覇 オーナー確定）・余剰・単価の中央値・登録漏れ一覧。
// 書くのは「カードで払う日」だけ（hq_maint_pay・1整備＝1行）。他は読むだけ。設計メモ docs/設計_資金計画_車検点検修理_2026-10-24.md
// 引き継ぎ ~/Desktop/HANDYMAN/引き継ぎ_資金計画_車検点検_2026-11-08.md
const MAIN_URL='https://ckrxttbnawkclshczsia.supabase.co',MAIN_ANON='sb_publishable_aTVhlY0YD-5BBfI03ZNnsg_MzO_vsIe';
const BT_URL='https://ggqugvyskyiblxiycpci.supabase.co',BT_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18';
const ST={nha:'那覇',spk:'札幌',bt:'高松'},STORES=['nha','spk','bt'];
// 種別＝配車表のラベルどおり（メンテナンスは修理と分ける・オーナー確定 2026-10-24）
const TY={sk:{l:'車検',s:'車検',c:'var(--sk)'},tk:{l:'点検',s:'点検',c:'var(--tk)'},rp:{l:'修理',s:'修理',c:'var(--rp)'},mt:{l:'メンテナンス',s:'メンテ',c:'var(--mt)'},ot:{l:'その他',s:'その他',c:'var(--ot)'}},TYS=['sk','tk','rp','mt','ot'];

// ===== 予算の基準 =====
// 配車表の予算（cost）＞ 車両マスタ（shaken_cost / tenken_cost）＞ 下の店舗基準 の順で使う。実費が入ればそれが優先。
// 那覇＝オーナー確定 2026-11-08（車検 85,000・Fのみ 75,000／半年点検 30,000・Fのみ 25,000）。
// 札幌＝仮（車両マスタに入っている値）。高松＝実績なし・仮（那覇基準）。決まったらここを書き換える。
const STD={
  nha:{sk:{F:75000,x:85000},tk:{F:25000,x:30000},kari:false,src:'那覇基準'},
  spk:{sk:{F:120000,x:120000},tk:{F:25000,x:25000},kari:true,src:'仮（札幌マスタ値）'},
  bt :{sk:{F:75000,x:85000},tk:{F:25000,x:30000},kari:true,src:'仮（那覇基準）'}
};
const RESERVE=0.05;           // 余剰見積もり（年数による修理増）。仮値 5%・オーナー確認待ち（2026-11-08）
const EXCL_LABEL=['清掃','安全在庫']; // 費用の対象外（安全在庫＝在庫止めのブロックで整備ではない）
const MIN_N=10;               // 中央値を予算に使ってよい目安の件数（かつ出庫済みの8割以上に実費）

let ITEMS=[],DUPS=[],VEH={nha:[],spk:[],bt:[]},PAY={},storeSel='all',sel=null;

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function yen(n){return '¥'+Math.round(n||0).toLocaleString();}
function man(n){return n>=10000?(Math.round(n/1000)/10).toLocaleString()+'万':yen(n);}
function sgn(n){return (n>0?'+':n<0?'−':'')+yen(Math.abs(n));}
// ログインは管理APPと共有（同じ保存キー）。期限切れは supabase-js が自動更新（mkt.html と同じ方式）
const SBC=window.supabase.createClient(MAIN_URL,MAIN_ANON);
async function tok(){try{const {data}=await SBC.auth.getSession();return data&&data.session?data.session.access_token:null;}catch(e){return null;}}
async function sb(path,method,body,prefer){const t=await tok();if(!t)throw new Error('LOGIN');const r=await fetch(MAIN_URL+'/rest/v1/'+path,{method:method||'GET',headers:{apikey:MAIN_ANON,Authorization:'Bearer '+t,'Content-Type':'application/json',Prefer:prefer||'return=representation'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,160));const x=await r.text();return x?JSON.parse(x):null;}
async function sbAll(path){let all=[];for(let off=0;off<100000;off+=1000){const p=await sb(path+(path.includes('?')?'&':'?')+'limit=1000&offset='+off);all=all.concat(p||[]);if(!p||p.length<1000)break;}return all;}
async function btRpc(fn){const r=await fetch(BT_URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:BT_ANON,Authorization:'Bearer '+BT_ANON,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error('高松 HTTP '+r.status);return r.json();}
function today(){const d=new Date(Date.now()+9*3600e3);return d.toISOString().slice(0,10);}
function ymAdd(ym,n){let y=+ym.slice(0,4),m=+ym.slice(5,7)-1+n;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+'-'+String(m+1).padStart(2,'0');}
function dAddM(d,n){return d?ymAdd(d.slice(0,7),n)+d.slice(7,10):'';}
function days(a,b){return (Date.parse(b)-Date.parse(a))/864e5;}
function typeOf(l){l=String(l||'');return l.includes('車検')?'sk':l.includes('点検')?'tk':l.includes('修理')?'rp':l.includes('メンテ')?'mt':'ot';}
function median(a){if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y),h=s.length>>1;return s.length%2?s[h]:(s[h-1]+s[h])/2;}
function ymJ(ym){return ym.replace('-','年').replace(/年0?/,'年')+'月';}
// AMEX：1〜19日→当月20日締め・翌月10日引落／20日以降→翌月20日締め・翌々月10日引落（オーナー確定 2026-10-24）
function bill(d){if(!/^\d{4}-\d{2}-\d{2}/.test(d||''))return null;const ym=d.slice(0,7),day=+d.slice(8,10);const cm=day>=20?ymAdd(ym,1):ym;return {close:cm+'-20',wd:ymAdd(cm,1)+'-10'};}

// 1整備 → 表示用。予算(bud)と実費(act)を分けて持つ。資金の見込み(amt)＝実費があれば実費、無ければ予算。
function norm(store,r,v){v=v||{};const act=+r.actual_cost||0,cost=+r.cost||0,ty=typeOf(r.label),cls=v.type||'',F=cls==='F';
  let bud=cost,src=cost>0?'配車表':'',bkari=false;
  if(!bud&&(ty==='sk'||ty==='tk')){
    const m=ty==='sk'?(+v.shaken_cost||0):(+v.tenken_cost||0);
    if(m>0){bud=m;src='車両マスタ';}
    else{const s=STD[store];bud=s[ty][F?'F':'x'];src=s.src;bkari=s.kari;}
  }
  return {store,id:String(r.id),key:store+':'+r.id,code:r.vehicle_code,name:r.name||v.name||r.vehicle_code||'（車両不明）',plate:r.plate||v.plate_no||'',cls,F,
    start:String(r.start_date||'').slice(0,10),end:String(r.end_date||r.start_date||'').slice(0,10),label:r.label||'',ty,
    bud,src,bkari,act,fixed:act>0,amt:act>0?act:bud,cost,workshop:r.workshop||'',status:r.status||'',detail:r.work_detail||''};}
function withPay(it){const p=PAY[it.key];const pd=p&&p.pay_date?p.pay_date:null;const b=bill(pd||it.start);return Object.assign(it,{pay:pd,kari:!pd,close:b?b.close:'',wd:b?b.wd:''});}

async function load(){
  if(!(await tok())){document.getElementById('map').innerHTML='<div class="msg">ログインが必要です（ダッシュボードでログインしてから開いてください）</div>';return;}
  const from=ymAdd(today().slice(0,7),-14)+'-01';
  const cols='id,vehicle_code,start_date,end_date,label,cost,actual_cost,workshop,status,work_detail';
  try{
    const [spk,nha,vs,vn,bt,btv,pay]=await Promise.all([
      sbAll('maintenance?select='+cols+'&block_type=eq.maintenance&start_date=gte.'+from+'&order=start_date.asc,id.asc'),
      sbAll('nha_maintenance?select='+cols+'&start_date=gte.'+from+'&order=start_date.asc,id.asc'),
      sbAll('vehicles?select=code,name,plate_no,type,active,owner_company,shaken_cost,tenken_cost&order=code.asc'),
      sbAll('nha_vehicles?select=code,name,plate_no,type,active,shaken_cost,tenken_cost&order=code.asc'),
      btRpc('bt_company_maint_plan'),
      btRpc('bt_company_vehicles').catch(()=>[]),
      sbAll('hq_maint_pay?select=key,pay_date,updated_at&order=key.asc')
    ]);
    const mp=a=>{const o={};a.forEach(v=>o[v.code]=v);return o;};
    PAY={};pay.forEach(p=>PAY[p.key]=p);
    // 高松：整備の関数は車両コード・ナンバー、車両の関数はナンバー・クラス → ナンバーで突き合わせ
    const btByPlate={};(btv||[]).forEach(v=>{if(v.plate)btByPlate[v.plate]=v;});
    const btRows=(bt||[]).filter(r=>String(r.start||'')>=from).map(r=>({id:r.id,vehicle_code:r.code,name:r.name,plate:r.plate,start_date:r.start,end_date:r.end,label:r.label,cost:r.cost,actual_cost:r.actual,workshop:r.workshop,status:r.status,work_detail:r.detail}));
    const btVm={};btRows.forEach(r=>{const v=btByPlate[r.plate]||{};btVm[r.vehicle_code]={name:r.name,plate_no:r.plate,type:v.cls||''};});
    // 札幌の協力会社所有車（vehicles.owner_company≠HANDYMAN）の整備は自社カード精算の対象外（オーナー確定 2026-10-24）
    const vsm=mp(vs),vnm=mp(vn),ownS=c=>{const v=vsm[c];return !v||!v.owner_company||v.owner_company==='HANDYMAN';};
    const raw=[].concat(spk.filter(r=>ownS(r.vehicle_code)).map(r=>norm('spk',r,vsm[r.vehicle_code])),nha.map(r=>norm('nha',r,vnm[r.vehicle_code])),btRows.map(r=>norm('bt',r,btVm[r.vehicle_code])));
    // 対象外：清掃・安全在庫／費用が入っていない31日超のメンテ・その他（引退・リリース前などの長期ブロックで整備費ではない）
    const keep=raw.filter(i=>!EXCL_LABEL.includes(i.label)&&!((i.ty==='mt'||i.ty==='ot')&&!i.cost&&!i.act&&days(i.start,i.end)>31));
    // 重複登録の疑い：同じ店・同じ車・同じ種別・同じ入庫日は1件だけ数える（データは消さない。要確認に出す）
    const seen={};ITEMS=[];DUPS=[];
    keep.forEach(i=>{const k=i.store+'|'+i.code+'|'+i.label+'|'+i.start;if(seen[k]){DUPS.push(i);}else{seen[k]=1;ITEMS.push(i);}});
    ITEMS.forEach(withPay);DUPS.forEach(withPay);
    VEH.nha=vn.filter(v=>v.active!==false).map(v=>({code:v.code,name:v.name,plate:v.plate_no,cls:v.type}));
    VEH.spk=vs.filter(v=>v.active!==false&&ownS(v.code)).map(v=>({code:v.code,name:v.name,plate:v.plate_no,cls:v.type}));
    // 高松：車両一覧はナンバーで整備と結びつける（整備側の車両コードを引く）
    const plate2code={};btRows.forEach(r=>{if(r.plate)plate2code[r.plate]=r.vehicle_code;});
    VEH.bt=(btv||[]).map(v=>({code:plate2code[v.plate]||('plate:'+v.plate),name:v.name,plate:v.plate,cls:v.cls}));
    render();
  }catch(e){document.getElementById('map').innerHTML='<div class="msg">'+(e.message==='LOGIN'?'ログインが必要です':'読み込めませんでした：'+esc(e.message))+'</div>';}
}

function vis(){return ITEMS.filter(i=>storeSel==='all'||i.store===storeSel);}
function storesIn(){return storeSel==='all'?STORES:[storeSel];}
function agg(a){const o={n:0,amt:0,bud:0,act:0,nAct:0,budAct:0,no:0,kari:0,bk:0};TYS.forEach(t=>o[t]={n:0,amt:0,bud:0,act:0,nAct:0,no:0,bk:0});
  a.forEach(i=>{const x=o[i.ty];o.n++;x.n++;o.amt+=i.amt;x.amt+=i.amt;o.bud+=i.bud;x.bud+=i.bud;
    if(i.act){o.act+=i.act;x.act+=i.act;o.nAct++;x.nAct++;o.budAct+=i.bud;}
    if(!i.amt&&(i.ty==='sk'||i.ty==='tk')){o.no++;x.no++;}
    if(i.bkari&&!i.act){o.bk++;x.bk++;}
    if(i.kari)o.kari++;});return o;}
// 余剰＝実費が未確定の分の予算×RESERVE
function reserveOf(a){return Math.round(a.filter(i=>!i.act).reduce((s,i)=>s+i.bud,0)*RESERVE);}

function renderStores(){document.getElementById('stores').innerHTML=[['all','全店']].concat(STORES.map(s=>[s,ST[s]])).map(([k,l])=>'<button class="'+(storeSel===k?'on':'')+'" onclick="setStore(\''+k+'\')">'+l+'</button>').join('');}
function setStore(k){storeSel=k;sel=null;render();}

// ① これから払う分（予算ベースの見込み）
function renderSum(){
  const td=today(),a=vis().filter(i=>i.wd>=td),g=agg(a),rs=reserveOf(a);
  const tile=(c,t,x,extra)=>'<div class="tile" style="--c:'+c+'"><div class="t">'+t+'</div><div class="v">'+yen(x.amt)+'</div><div class="n">'+x.n+'件'+(x.nAct?'・うち実費確定 '+x.nAct+'件':'')+'</div>'+
    (x.no?'<div class="w">予算未入力 '+x.no+'件</div>':'')+(x.bk?'<div class="w">うち仮予算 '+x.bk+'件</div>':'')+(extra||'')+'</div>';
  document.getElementById('sum').innerHTML='<h2>これから払う分 <small>'+(storeSel==='all'?'全店':ST[storeSel])+'・引落日が今日以降。金額＝実費があれば実費、無ければ予算</small></h2><div class="tiles">'+
    TYS.map(t=>tile(TY[t].c,TY[t].l,g[t])).join('')+
    '<div class="tile" style="--c:#fbbf24"><div class="t">余剰（予算の'+Math.round(RESERVE*100)+'%）</div><div class="v">'+yen(rs)+'</div><div class="n">年数による修理増への備え</div><div class="w">'+Math.round(RESERVE*100)+'%は仮値</div></div>'+
    '<div class="tile" style="--c:#e2e8f0"><div class="t">合計（余剰込み）</div><div class="v">'+yen(g.amt+rs)+'</div><div class="n">'+g.n+'件・余剰なし '+yen(g.amt)+'</div></div></div>';
}

// ② 予実：入庫月ごとに「予算」と「実費」を分ける（今日までに入庫したもの）
function renderYJ(){
  const td=today(),cur=td.slice(0,7),months=Array.from({length:12},(_,i)=>ymAdd(cur,i-11)),V=vis().filter(i=>i.start<=td);
  let h='<table class="pay"><tr><th>入庫月</th><th>件数</th><th>予算</th><th>実費入力</th><th>実費</th><th>実費が入った分の予算</th><th>差異（実費−予算）</th><th>実費待ち（予算）</th></tr>',T=agg([]),Tw=0;
  months.forEach(ym=>{const a=V.filter(i=>i.start.slice(0,7)===ym);if(!a.length)return;const g=agg(a),w=g.bud-g.budAct,k='m|'+ym,d=g.act-g.budAct;Tw+=w;
    ['n','bud','act','nAct','budAct'].forEach(f=>T[f]+=g[f]);
    h+='<tr class="r'+(sel===k?' sel':'')+'" onclick="pick(\'m\',\''+ym+'\')"><td>'+ymJ(ym)+'</td><td>'+g.n+'</td><td>'+yen(g.bud)+'</td><td>'+g.nAct+'/'+g.n+(g.nAct<g.n?' <span class="wtxt">未'+(g.n-g.nAct)+'</span>':'')+'</td><td>'+(g.act?yen(g.act):'—')+'</td><td>'+(g.nAct?yen(g.budAct):'—')+'</td><td class="'+(d>0?'neg':d<0?'pos':'')+'">'+(g.nAct?sgn(d):'—')+'</td><td>'+(w?yen(w):'—')+'</td></tr>';});
  const d=T.act-T.budAct;
  h+='<tr class="tot"><td>12か月計</td><td>'+T.n+'</td><td>'+yen(T.bud)+'</td><td>'+T.nAct+'/'+T.n+'</td><td>'+yen(T.act)+'</td><td>'+yen(T.budAct)+'</td><td class="'+(d>0?'neg':d<0?'pos':'')+'">'+(T.nAct?sgn(d):'—')+'</td><td>'+yen(Tw)+'</td></tr></table>';
  document.getElementById('yj').innerHTML=T.n?h:'<div class="msg">対象なし</div>';
}

// ③ 単価の基準：店×車検/点検×(Fクラス/それ以外)。今の予算と、実費の中央値（＝次の予算の候補）
function renderStd(){
  let h='<table class="pay"><tr><th>店・種別</th><th>クラス</th><th>今の予算</th><th>予算の出所</th><th>実費 件数</th><th>実費 中央値</th><th>平均</th><th>最小〜最大</th><th>中央値＋余剰'+Math.round(RESERVE*100)+'%</th><th>判定</th></tr>';
  storesIn().forEach(s=>['sk','tk'].forEach(t=>[['F','Fクラス'],['x','F以外']].forEach(([f,fl])=>{
    const a=ITEMS.filter(i=>i.store===s&&i.ty===t&&(f==='F')===i.F),acts=a.filter(i=>i.act).map(i=>i.act);
    if(!a.length&&!acts.length)return;
    const cnt={};a.forEach(i=>{if(i.bud)cnt[i.bud+'|'+i.src]=(cnt[i.bud+'|'+i.src]||0)+1;});
    const top=Object.keys(cnt).sort((x,y)=>cnt[y]-cnt[x])[0],bud=top?+top.split('|')[0]:0,src=top?top.split('|')[1]:'';
    const md=median(acts),avg=acts.length?acts.reduce((x,y)=>x+y,0)/acts.length:0,sug=Math.round(md*(1+RESERVE)/1000)*1000;
    // 入力率が低いと「入れた分だけ」の偏った中央値になる → 出庫済みの8割以上に実費が入るまでは参考
    const done=a.filter(i=>i.end<today()).length,rate=done?acts.length/done:0;
    const j=!acts.length?'<span class="wtxt">実績なし</span>':acts.length<MIN_N?'<span class="wtxt">件数が少ない（参考）</span>':rate<0.8?'<span class="wtxt">入力率'+Math.round(rate*100)+'%（参考）</span>':'<span class="oktxt">使える</span>';
    h+='<tr><td>'+ST[s]+'　'+TY[t].l+'</td><td>'+fl+'</td><td>'+(bud?yen(bud):'—')+'</td><td>'+esc(src)+'</td><td>'+acts.length+' / '+a.length+'</td><td>'+(md?yen(md):'—')+'</td><td>'+(avg?yen(avg):'—')+'</td><td>'+(acts.length?yen(Math.min(...acts))+'〜'+yen(Math.max(...acts)):'—')+'</td><td>'+(md?yen(sug):'—')+'</td><td>'+j+'</td></tr>';
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

function renderMap(){
  const cur=today().slice(0,7),m0=ymAdd(cur,-2),V=vis();
  const last=V.map(i=>i.start.slice(0,7)).sort().pop()||cur;let n=14;while(ymAdd(m0,n-1)<last&&n<36)n++;
  const months=Array.from({length:n},(_,i)=>ymAdd(m0,i)),rows=storesIn();
  const cellOf=(s,ym)=>V.filter(i=>i.store===s&&i.start.slice(0,7)===ym);
  let max=1;rows.forEach(s=>months.forEach(ym=>{max=Math.max(max,cellOf(s,ym).reduce((x,i)=>x+i.amt,0));}));
  let h='<table><tr><th></th>'+months.map(ym=>'<th class="'+(ym===cur?'now':'')+'" onclick="pick(\'m\',\''+ym+'\')">'+(+ym.slice(5))+'月'+(ym.slice(5)==='01'||ym===m0?'<br><small>'+ym.slice(0,4)+'</small>':'')+'</th>').join('')+'</tr>';
  rows.forEach(s=>{h+='<tr><td class="st">'+ST[s]+'</td>'+months.map(ym=>{const a=cellOf(s,ym);if(!a.length)return '<td><div class="cell empty"></div></td>';
    const g=agg(a),k='c|'+s+'|'+ym,al=.08+.5*Math.sqrt(g.amt/max);
    return '<td><div class="cell'+(sel===k?' sel':'')+'" style="background:rgba(59,130,246,'+al.toFixed(2)+')" onclick="pick(\'c\',\''+s+'\',\''+ym+'\')">'+TYS.filter(t=>g[t].n).map(t=>'<div class="ln"><i style="--c:'+TY[t].c+'"></i>'+TY[t].s+' '+g[t].n+'台<b>'+(g[t].amt?man(g[t].amt):'未定')+'</b></div>').join('')+
      '<div class="amt">予 '+(g.bud?man(g.bud):'—')+(g.nAct?'<br><span class="act">実 '+man(g.act)+'（'+g.nAct+'/'+g.n+'）</span>':'')+'</div></div></td>';}).join('')+'</tr>';});
  document.getElementById('map').innerHTML=h+'</table>';
}

function renderPay(){
  const td=today(),V=vis(),wds=[...new Set(V.map(i=>i.wd).filter(Boolean))].sort().filter(w=>w>=ymAdd(td.slice(0,7),-2));
  const fut=V.filter(i=>i.wd>=td),tot=agg(fut),rs=reserveOf(fut);
  let h='<table class="pay"><tr><th>引落日</th><th>締め</th><th>件数</th>'+TYS.map(t=>'<th>'+TY[t].l+'</th>').join('')+'<th>合計</th><th>うち実費確定</th><th>払う日 仮</th></tr>';
  wds.forEach(w=>{const a=V.filter(i=>i.wd===w),g=agg(a),k='w|'+w;
    h+='<tr class="r'+(w<td?' past':'')+(sel===k?' sel':'')+'" onclick="pick(\'w\',\''+w+'\')"><td>'+w.replace(/-/g,'/')+(w<td?' 済':'')+'</td><td>'+a[0].close.slice(5).replace('-','/')+'</td><td>'+g.n+'</td>'+TYS.map(t=>'<td>'+(g[t].amt?yen(g[t].amt):'—')+'</td>').join('')+'<td><b>'+yen(g.amt)+'</b></td><td>'+(g.nAct?yen(g.act)+'（'+g.nAct+'件）':'')+'</td><td>'+(g.kari||'')+'</td></tr>';});
  h+='<tr class="tot"><td>今後の合計</td><td></td><td>'+tot.n+'</td>'+TYS.map(t=>'<td>'+yen(tot[t].amt)+'</td>').join('')+'<td>'+yen(tot.amt)+'</td><td>'+(tot.nAct?yen(tot.act):'')+'</td><td>'+(tot.kari||'')+'</td></tr>'+
    '<tr class="tot"><td>＋余剰 '+Math.round(RESERVE*100)+'%</td><td></td><td></td>'+TYS.map(()=>'<td></td>').join('')+'<td>'+yen(tot.amt+rs)+'</td><td colspan="2" style="text-align:left;font-weight:600">余剰 '+yen(rs)+'</td></tr></table>';
  document.getElementById('pay').innerHTML=wds.length?h:'<div class="msg">対象なし</div>';
}

function pick(kind,a,b){sel=kind==='c'?'c|'+a+'|'+b:kind+'|'+a;renderMap();renderPay();renderYJ();renderCheck();renderPanel();if(innerWidth<=900)document.getElementById('panel').scrollIntoView({behavior:'smooth'});}
function curItems(){if(!sel)return null;const p=sel.split('|'),V=vis();
  if(p[0]==='c')return {t:ST[p[1]]+'　'+ymJ(p[2])+' 入庫',a:V.filter(i=>i.store===p[1]&&i.start.slice(0,7)===p[2])};
  if(p[0]==='m')return {t:(storeSel==='all'?'全店':ST[storeSel])+'　'+ymJ(p[1])+' 入庫',a:V.filter(i=>i.start.slice(0,7)===p[1])};
  if(p[0]==='k'){const c=checks();return {t:{gap:'次の車検・点検が未登録の車',noact:'実費が未入力',nobud:'予算が入っていない車検・点検',dup:'重複登録の疑い'}[p[1]],a:c[p[1]],k:p[1]};}
  return {t:p[1].replace(/-/g,'/')+' 引落',a:V.filter(i=>i.wd===p[1])};}
function gapHTML(a){return a.length?a.map(x=>'<div class="it"><div class="h">'+(storeSel==='all'?'<span class="stg">'+ST[x.store]+'</span>':'')+'<span class="nm">'+esc(x.v.name)+'</span><span class="pl">'+esc(x.v.plate||'')+'</span>'+(x.v.cls?'<span class="stg">'+esc(x.v.cls)+'</span>':'')+'</div><div class="kv">'+
  '<span>前回車検</span><span>'+(x.pastSk?x.pastSk.replace(/-/g,'/'):'記録なし（14か月以内）')+'</span>'+
  '<span>前回(車検/点検)</span><span>'+(x.pastAny?x.pastAny.replace(/-/g,'/'):'記録なし')+'</span>'+
  '<span>登録済み</span><span>'+(x.nextAny?'次 '+x.nextAny.replace(/-/g,'/')+(x.nextSk?'／次の車検 '+x.nextSk.replace(/-/g,'/'):'／次の車検なし'):'今後の予定なし')+'</span>'+
  '<span>入れるもの</span><span class="wtxt">'+(x.noSoon?'7か月以内の点検/車検':'次の車検')+(x.due?'（目安 '+x.due.replace(/-/g,'/')+'）':'')+'</span></div></div>').join(''):'<div class="msg">なし</div>';}
function renderPanel(){const c=curItems(),el=document.getElementById('panel');if(!c){el.innerHTML='<div class="msg">表の行・マップのマスを押すと明細が出ます</div>';return;}
  if(c.k==='gap'){el.innerHTML='<div class="ph"><b>'+esc(c.t)+'</b><div class="s">'+c.a.length+'台。目安＝前回の車検＋1年・前回の車検/点検＋6か月（14か月以内の記録から）</div></div>'+gapHTML(c.a);return;}
  const a=c.a.slice().sort((x,y)=>(x.start+x.store).localeCompare(y.start+y.store)),g=agg(a);
  el.innerHTML='<div class="ph"><b>'+esc(c.t)+'</b><div class="s">'+g.n+'件・予算 '+yen(g.bud)+'・実費 '+(g.nAct?yen(g.act)+'（'+g.nAct+'件）':'—')+'</div><div class="s">'+TYS.filter(t=>g[t].n).map(t=>TY[t].l+' '+g[t].n+'件 '+yen(g[t].amt)).join('／')+'</div></div>'+
   (a.length?a.map(it=>'<div class="it"><div class="h"><span class="tag" style="--c:'+TY[it.ty].c+'">'+esc(it.label||TY[it.ty].l)+'</span>'+(storeSel==='all'?'<span class="stg">'+ST[it.store]+'</span>':'')+'<span class="nm">'+esc(it.name)+'</span><span class="pl">'+esc(it.plate)+'</span>'+(it.cls?'<span class="stg">'+esc(it.cls)+'</span>':'')+
     (it.amt?'<span class="am">'+yen(it.amt)+'</span>':'<span class="am no">'+((it.ty==='sk'||it.ty==='tk')?'予算未入力':'未定')+'</span>')+'</div><div class="kv">'+
     '<span>日程</span><span>'+esc(it.start.replace(/-/g,'/'))+(it.end&&it.end!==it.start?' 〜 '+esc(it.end.replace(/-/g,'/')):'')+'</span>'+
     '<span>予算</span><span>'+(it.bud?yen(it.bud)+' <small class="mut">'+esc(it.src)+'</small>'+(it.bkari?' <span class="kari">仮</span>':''):'—')+'</span>'+
     '<span>実費</span><span>'+(it.act?'<b>'+yen(it.act)+'</b>　差異 <span class="'+(it.act>it.bud?'neg':'pos')+'">'+sgn(it.act-it.bud)+'</span>':'<span class="mut">未入力</span>')+'</span>'+
     (it.workshop?'<span>工場</span><span>'+esc(it.workshop)+'</span>':'')+
     (it.status?'<span>状態</span><span>'+esc({approved:'承認済',pending:'承認待ち'}[it.status]||it.status)+'</span>':'')+
     (it.detail?'<span>作業内容</span><span>'+esc(it.detail)+'</span>':'')+
     '<span>払う日</span><span class="pd"><input type="date" value="'+(it.pay||'')+'" onchange="savePay(\''+esc(it.key)+'\',this.value,this)">'+(it.kari?'<span class="kari">未入力（入庫日で仮計算）</span>':'')+'</span>'+
     '<span>締め/引落</span><span>'+esc(it.close.replace(/-/g,'/'))+' 締め → <b>'+esc(it.wd.replace(/-/g,'/'))+'</b> 引落'+(it.kari?'（仮）':'')+'</span>'+
     '</div></div>').join(''):'<div class="msg">この範囲の整備はありません</div>');}

async function savePay(key,val,el){const it=ITEMS.find(i=>i.key===key)||DUPS.find(i=>i.key===key);if(!it)return;el.disabled=true;
  try{const r=await sb('hq_maint_pay?on_conflict=key','POST',{key,store:it.store,maint_id:it.id,pay_date:val||null},'return=representation,resolution=merge-duplicates');
    if(!r||!r.length||(r[0].pay_date||'')!==(val||''))throw new Error('保存の確認ができませんでした');
    PAY[key]=r[0];withPay(it);render();
  }catch(e){alert(e.message==='LOGIN'?'ログインが切れています。ダッシュボードで再ログインしてください':'保存できませんでした：'+e.message);el.disabled=false;}}

function render(){renderStores();renderSum();renderCheck();renderYJ();renderStd();renderMap();renderPay();renderPanel();}
renderStores();load();
