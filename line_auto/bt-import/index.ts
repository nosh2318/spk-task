// 高松HDM OTA取込EF: 札幌GASが「高松(本文に_TAK/高松空港店)」を判別してparse済みreservationをPOST→BT(bt_reservations/fleet/tasks)取込+Slack(#app予約取込-高松)
// 転送/buddicatourism/reserve_inboxを使わず、稼働中の札幌GAS(reserve受信箱を30分毎パトロール)から直接BTへ。ota=楽天/じゃらん/skyticket/エアトリ→brandトリガーでHDM。
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const BT_URL=Deno.env.get("BT_URL")!, BT_SR=Deno.env.get("BT_SERVICE_KEY")!;
const SLACK=Deno.env.get("BT_SLACK_TOKEN")!, CH="C0BFDJ1HRC3"; // #app予約取込-高松
const SECRET=Deno.env.get("BT_IMPORT_SECRET")||"";
const h=(k:string)=>({apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json"});
async function bget(p:string){const r=await fetch(BT_URL+"/rest/v1/"+p,{headers:h(BT_SR)});return r.ok?await r.json():[];}
async function bpost(p:string,b:unknown){return fetch(BT_URL+"/rest/v1/"+p,{method:"POST",headers:{...h(BT_SR),Prefer:"return=minimal"},body:JSON.stringify(b)});}
async function bpatch(p:string,b:unknown){return fetch(BT_URL+"/rest/v1/"+p,{method:"PATCH",headers:{...h(BT_SR),Prefer:"return=minimal"},body:JSON.stringify(b)});}
async function slack(t:string){try{await fetch("https://slack.com/api/chat.postMessage",{method:"POST",headers:{Authorization:"Bearer "+SLACK,"Content-Type":"application/json; charset=utf-8"},body:JSON.stringify({channel:CH,text:t})});}catch(_){/**/}}
const OTANAME:Record<string,string>={R:"楽天",J:"じゃらん",S:"スカイチケット",O:"エアトリ",楽天:"楽天","じゃらん":"じゃらん"};
const N=(v:unknown)=>{const n=parseInt(String(v??"").replace(/[^\d-]/g,""),10);return isNaN(n)?0:n;};

async function assign(cls:string,s:string,e:string){
  const cars=await bget(`bt_vehicles?type=eq.${encodeURIComponent(cls)}&brand=eq.HDM&active=eq.true&select=code,name,plate_no`);
  if(!cars.length)return null;
  const fleet=await bget("bt_fleet?select=reservation_id,vehicle_code");
  const res=await bget("bt_reservations?select=id,start_date,end_date,status");
  const rmap:Record<string,any>={};for(const r of res)rmap[r.id]=r;
  for(const c of cars){let busy=false;
    for(const f of fleet){if(f.vehicle_code!==c.code)continue;const rr=rmap[f.reservation_id];
      if(rr&&rr.status!=="キャンセル"&&!(rr.end_date<s||rr.start_date>e)){busy=true;break;}}
    if(!busy)return c;}
  return null;
}

// クラス解決（高松HDM C/D/E/F/G/H/I/J/K）: ①プラン内 _X_TAK ②単一コード(E_TAK→E) ③車種/クラス名キーワード
function deriveCls(r:any):string{
  const raw=[r._rawClass,r.vehicle,r.plan,r.plan_name,r.detail].map((x:any)=>String(x||"")).join(" ");
  const m=raw.match(/_([A-K])_TAK/i); if(m)return m[1].toUpperCase();
  const v=String(r.vehicle||r._rawClass||"").replace(/[_].*$/,"").trim(); if(/^[A-K]$/i.test(v))return v.toUpperCase();
  if(/軽ハイトワゴン|タント/.test(raw))return "I";
  if(/パッソ/.test(raw))return "J";
  if(/シエンタ|コンパクトミニバン/.test(raw))return "K";
  if(/アクア|ヴィッツ|ヤリス/.test(raw))return "G";
  if(/ルーミー|タンク/.test(raw))return "H";
  if(/ライズ/.test(raw))return "F";
  if(/プリウス/.test(raw))return "E";
  if(/ハリアー/.test(raw))return "D";
  if(/ヴォクシー|ノア/.test(raw))return "C";
  return v;
}

serve(async(req)=>{
  let body:any={};try{body=await req.json();}catch(_){}
  if(SECRET && body.secret!==SECRET)return new Response("forbidden",{status:403});
  const r=body.reservation||{};
  const rno=r.id; if(!rno)return new Response(JSON.stringify({err:"no id"}),{status:400});
  const ota=OTANAME[body.otaCode]||OTANAME[r.ota]||r.ota||"楽天";
  const cls=deriveCls(r); // E_TAK→E / 軽ハイトワゴン→I 等（高松HDM I/J/K対応）

  // キャンセル
  if(body.isCancel){
    const ex=await bget(`bt_reservations?id=eq.${encodeURIComponent(rno)}&select=id,status,name`);
    if(!ex.length)return new Response(JSON.stringify({skip:"cancel_not_found",rno}));
    await bpatch(`bt_reservations?id=eq.${encodeURIComponent(rno)}`,{status:"キャンセル"});
    await fetch(BT_URL+"/rest/v1/bt_fleet?reservation_id=eq."+encodeURIComponent(rno),{method:"DELETE",headers:h(BT_SR)});
    await slack(`🔴 楽天HDM キャンセル【${ota} | HANDYMAN高松空港店】${rno}\n${ex[0].name||""} 様の予約をキャンセルしました`);
    return new Response(JSON.stringify({ok:true,cancelled:rno}));
  }

  // 重複
  const ex=await bget(`bt_reservations?id=eq.${encodeURIComponent(rno)}&select=id`);
  if(ex.length)return new Response(JSON.stringify({skip:"exists",rno}));

  const s=r.lend_date, e=r.return_date;
  const car=await assign(cls,s,e);
  const price=N(r.price)||(N(r.base_price)+N(r.option_price)-N(r.discount));
  // ★2026-09-25 訂正(武山さん): OTA予約(楽天/じゃらん等)は便名の有無に関わらず「貸出/返却」で統一(中立)。
  //   PU/BDはオフィシャル/ご利用ガイドで"送迎あり"を選んだ時だけ(=マイページでpickup設定時)反映。
  //   → visit_type/return_type/場所を空(中立)にする。deriveLendType/deriveRetTypeが空+場所空→"貸出"/"返却待"を導出。
  // ★2026-09-25 mail/tel を必ず書く（hdm-tkm-enqueueがmail必須＝空だと初動メール/決済リンクが発行されない致命バグの根治）。
  //   じゃらんはSquare事前決済(顧客が後で支払う)＝paid:false・payment=じゃらん事前決済。楽天/skyticket/エアトリはOTA事前カード決済済。
  const _isJalan = ota==="じゃらん";
  const row={id:rno,name:r.name||"",kana:r.kana||"",mail:r.mail||"",tel:r.tel||"",start_date:s,end_date:e,start_time:r.lend_time||"",end_time:r.return_time||"",
    vehicle_class:cls,vehicle_name:car?car.name:"",plate_no:car?car.plate_no:"",assigned_vehicle:car?car.code:"",
    source:"ota",status:"確定",ota,booking_no:rno,people:N(r.people)||1,insurance:r.insurance||"",
    del_place:"",col_place:"",del_flight:r.flight||"",col_flight:"",
    car_seat:"0",junior_seat:"0",opt_b:N(r.opt_b),opt_c:N(r.opt_c),opt_j:N(r.opt_j),opt_usb:0,
    amount:price,price,base_price:N(r.base_price),option_price:N(r.option_price),discount:N(r.discount),final_price:price,
    payment:_isJalan?"じゃらん事前決済(Square)":"事前カード決済(支払済)",paid:false,visit_type:"",return_type:"",
    changed_json:JSON.stringify({_src:"system"})};
  const ins=await bpost("bt_reservations",row);
  if(!ins.ok)return new Response(JSON.stringify({err:"insert "+ins.status+" "+(await ins.text()).slice(0,150),rno}),{status:500});
  // 注: 高松HDM(楽天/じゃらん)の生メール台帳は札幌GAS側の reserve_inbox_mirror(=予約受信BOX .com高松HDMタブ)が担当。bt_reservation_emails(BUDDICAタブ)には入れない(二重表示回避)。
  if(car){
    await bpost("bt_fleet",{reservation_id:rno,vehicle_code:car.code});
    const tc:any={"予約者":r.name||"","人数":String(N(r.people)||1),"クラス":cls,"車種":car.name,"No":car.plate_no,"確定":r.insurance||"","OTA":ota,"予約番号":rno,"class":cls,"vehicle_code":car.code,"assigned_vehicle":car.code};
    await bpost("bt_tasks",[{_id:"d-"+rno,date:s,sort_order:1,"内容":"貸出","便名":r.flight||"",...tc},{_id:"c-"+rno,date:e,sort_order:1,"内容":"返却待","便名":"",...tc}]);
  }
  await slack(`✅ 楽天HDM 自動取込【${ota} | HANDYMAN高松空港店】${rno}\n${r.name||""} 様／${s} 〜 ${e}\n🚗 ${cls}クラス ${car?car.name+"("+car.plate_no+")":"未配車(手動配車が必要)"}／補償${r.insurance||"-"}／¥${price.toLocaleString()}(事前カード決済)`);
  return new Response(JSON.stringify({ok:true,rno,cls,car:car?car.name:"未配車",price}));
});
