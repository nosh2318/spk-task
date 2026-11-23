// 資金計画（hq 車両 > 資金計画）
// 2026-10-24 新設：正本＝配車表の整備ブロック（maintenance / nha_maintenance / bt_maintenance）を開くたびに読む。
// 2026-11-08 改修：予算と実費（予実）を分けて表示・予算の基準（那覇 オーナー確定）・余剰・単価の中央値・登録漏れ一覧。
// 2026-11-15：札幌・高松の基準をオーナー確定値に（車検 120,000／点検 30,000）・余剰は保留（RESERVE=0 で非表示）。
// 書くのは「カードで払う日」だけ（hq_maint_pay・1整備＝1行）。他は読むだけ。設計メモ docs/設計_資金計画_車検点検修理_2026-10-24.md
// 引き継ぎ ~/Desktop/HANDYMAN/引き継ぎ_資金計画_車検点検_2026-11-08.md
const MAIN_URL='https://ckrxttbnawkclshczsia.supabase.co',MAIN_ANON='sb_publishable_aTVhlY0YD-5BBfI03ZNnsg_MzO_vsIe';
const BT_URL='https://ggqugvyskyiblxiycpci.supabase.co',BT_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXVndnlza3lpYmx4aXljcGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDc3NjksImV4cCI6MjA5MzY4Mzc2OX0.uNhWcBd_Dl5nzemZDQfJ8mQV6iY73MwystGGpTRPC18';
const ST={nha:'那覇',spk:'札幌',bt:'高松'},STORES=['nha','spk','bt'];
// 種別＝配車表のラベルどおり（メンテナンスは修理と分ける・オーナー確定 2026-10-24）
const TY={sk:{l:'車検',s:'車検',c:'var(--sk)'},tk:{l:'点検',s:'点検',c:'var(--tk)'},rp:{l:'修理',s:'修理',c:'var(--rp)'},mt:{l:'メンテナンス',s:'メンテ',c:'var(--mt)'},ot:{l:'その他',s:'その他',c:'var(--ot)'}},TYS=['sk','tk','rp','mt','ot'];

// ===== 予算の基準 =====
// 配車表の予算（cost）＞ 車両マスタ（shaken_cost / tenken_cost）＞ 下の店舗基準 の順で使う。実費が入ればそれが優先。
// over:true の店は 店舗基準 を 車両マスタ より優先（配車表の予算は常に最優先）。
// 那覇＝オーナー確定 2026-11-08（車検 85,000・Fのみ 75,000／半年点検 30,000・Fのみ 25,000）。
// 札幌・高松＝オーナー確定 2026-11-15（車検 120,000／点検 30,000・F区別なし）。札幌の車両マスタ点検 25,000 より優先。
const STD={
  nha:{sk:{F:75000,x:85000},tk:{F:25000,x:30000},kari:false,src:'那覇基準'},
  spk:{sk:{F:120000,x:120000},tk:{F:30000,x:30000},kari:false,over:true,src:'札幌基準'},
  bt :{sk:{F:120000,x:120000},tk:{F:30000,x:30000},kari:false,over:true,src:'高松基準'}
};
const RESERVE=0;              // 余剰見積もり（年数による修理増）。オーナー判断 2026-11-15「ややこしくなるので一旦保留」→0＝余剰の表示を出さない。再開時は率を入れる
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
    if(m>0&&!STD[store].over){bud=m;src='車両マスタ';}
    else{const s=STD[store];bud=s[ty][F?'F':'x'];src=s.src;bkari=s.kari;}
  }
  return {store,id:String(r.id),key:store+':'+r.id,code:r.vehicle_code,name:r.name||v.name||r.vehicle_code||'（車両不明）',plate:r.plate||v.plate_no||'',cls,F,
    start:String(r.start_date||'').slice(0,10),end:String(r.end_date||r.start_date||'').slice(0,10),label:r.label||'',ty,
    bud,src,bkari,act,fixed:act>0,amt:act>0?act:bud,cost,workshop:r.workshop||'',status:r.status||'',detail:r.work_detail||'',cause:r.repair_cause||'',memo:r.maint_notes||'',inv:r.invoice_no||'',outd:String(r.actual_out_date||'').slice(0,10)};}
function withPay(it){const p=PAY[it.key];const pd=p&&p.pay_date?p.pay_date:null;const b=bill(pd||it.start);return Object.assign(it,{pay:pd,kari:!pd,close:b?b.close:'',wd:b?b.wd:'',wdS:pd?'fix':(b?'kari':'none')});}

async function load(){
  if(!(await tok())){document.getElementById('map').innerHTML='<div class="msg">ログインが必要です（ダッシュボードでログインしてから開いてください）</div>';return;}
  const from=ymAdd(today().slice(0,7),-14)+'-01';
  const cols='id,vehicle_code,start_date,end_date,label,cost,actual_cost,workshop,status,work_detail,maint_notes,invoice_no,actual_out_date';
  try{
    const [spk,nha,vs,vn,bt,btv,pay]=await Promise.all([
      sbAll('maintenance?select='+cols+',repair_cause&block_type=eq.maintenance&start_date=gte.'+from+'&order=start_date.asc,id.asc'),
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

