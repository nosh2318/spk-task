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
const yen=(v:unknown)=>String(N(v)).replace(/\B(?=(\d{3})+(?!\d))/g,",");

// ★2026-10-01 じゃらんキャンセル時の決済処理（武山要望:キャンセル通知に決済状況/返金有無を出す）。
//   未入金→Square決済リンクを無効化(以後決済不可)＋pay_urlクリア／入金済→自動返金はせず「要返金確認」をSlack。bt_jalan_payments を refund/cancelled に見える化。
//   札幌/BUDDICA GAS handleBtCancelPayment_ 同型。square_link_id を保存していないのでURL照合で特定(旧BUDDICAリレーのid依存の穴を回避)。
const normSqUrl=(u:string)=>String(u||"").trim().replace(/\/+$/,"").toLowerCase();
async function deactivateSquareLinkByUrl(token:string,url:string):Promise<{ok:boolean;reason?:string;id?:string}>{
  if(!token)return{ok:false,reason:"SQUARE_ACCESS_TOKEN未設定"};
  if(!url)return{ok:false,reason:"URL無し"};
  const target=normSqUrl(url);let cursor="";let fetched=0;
  do{
    let api="https://connect.squareup.com/v2/online-checkout/payment-links?limit=100";if(cursor)api+="&cursor="+encodeURIComponent(cursor);
    const resp=await fetch(api,{headers:{"Square-Version":"2024-01-18",Authorization:"Bearer "+token}});
    if(resp.status!==200)return{ok:false,reason:"一覧取得"+resp.status};
    const data=await resp.json();const links=data.payment_links||[];
    for(const l of links){if(!l.id)continue;if((l.url&&normSqUrl(l.url)===target)||(l.long_url&&normSqUrl(l.long_url)===target)){
      const dr=await fetch("https://connect.squareup.com/v2/online-checkout/payment-links/"+l.id,{method:"DELETE",headers:{"Square-Version":"2024-01-18",Authorization:"Bearer "+token}});
      return (dr.status>=200&&dr.status<300)?{ok:true,id:l.id}:{ok:false,reason:"DELETE"+dr.status};
    }}
    fetched+=links.length;cursor=data.cursor||"";
  }while(cursor&&fetched<5000);
  return{ok:false,reason:"URLからID特定不可"};
}
// じゃらん(HDM)のみ対象。Slackへ要返金/決済リンク停止を通知し、キャンセル通知本文に載せる短いタグを返す。
async function handleCancelPayment(rno:string,ota:string):Promise<string>{
  if(ota!=="じゃらん")return"";
  const token=Deno.env.get("SQUARE_ACCESS_TOKEN")||"";
  const pr=await bget(`bt_jalan_payments?reservation_id=eq.${encodeURIComponent(rno)}&select=status,square_payment_url,amount,customer_name`);
  const p=pr&&pr.length?pr[0]:null;
  const rr=await bget(`bt_reservations?id=eq.${encodeURIComponent(rno)}&select=name,paid,pay_url,price`);
  const res=rr&&rr.length?rr[0]:{};
  const hasPay=(p&&(p.square_payment_url||p.status))||(res&&(res.pay_url||res.paid));
  if(!hasPay)return"";
  const isPaid=(p&&p.status==="paid")||(res&&res.paid===true);
  const nm=res.name||(p&&p.customer_name)||"";
  const money=yen((p&&p.amount)||res.price||0);
  const now=new Date().toISOString();
  if(isPaid){
    if(p)await bpatch(`bt_jalan_payments?reservation_id=eq.${encodeURIComponent(rno)}`,{status:"refund",cancelled_at:now,updated_at:now});
    await slack(`🔴 *要返金確認【じゃらん｜HANDYMAN高松空港店】* \`${rno}\` ${nm}様 ／ ¥${money}\nキャンセルされましたが *入金済* です。Squareにて返金対応をご確認ください。`);
    return `\n💰 決済状況: *入金済* → Squareで返金対応をご確認ください`;
  }
  const url=(p&&p.square_payment_url)||res.pay_url||"";
  const deact=await deactivateSquareLinkByUrl(token,url);
  if(deact.ok)await bpatch(`bt_reservations?id=eq.${encodeURIComponent(rno)}`,{pay_url:null});
  if(p)await bpatch(`bt_jalan_payments?reservation_id=eq.${encodeURIComponent(rno)}`,{status:"cancelled",cancelled_at:now,updated_at:now});
  await slack(`${deact.ok?"🚫":"⚠️"} *決済リンク停止【じゃらん｜HANDYMAN高松空港店】* \`${rno}\` ${nm}様 ／ キャンセルに伴いSquare決済リンクを${deact.ok?"無効化しました（以後決済不可）。":"無効化できませんでした（"+(deact.reason||"")+"）→ Square管理画面で手動停止してください。"}`);
  return deact.ok?`\n🚫 決済状況: *未入金* → 決済リンク無効化済（以後決済不可）`:`\n⚠️ 決済状況: *未入金* → 決済リンク無効化失敗（要手動停止: ${deact.reason||""}）`;
}

// ★2026-09-27 配車ルール徹底(予約RPC/表示RPCと統一)＝空車判定は必ず ①同クラス/HDM ②月別kpi稼働(coalesce・グローバルactiveは弱) ③予約重複なし ④メンテ/点検/車検の重複なし。
//   旧版は active=eq.true だけ＝(a)kpi稼働でもグローバルactive=OFFの車を拾えず未配車(コサカ) (b)点検中の車に配車(ナガマチ) の横展開漏れがあった。
async function assign(cls:string,s:string,e:string){
  const cars=await bget(`bt_vehicles?type=eq.${encodeURIComponent(cls)}&brand=eq.HDM&select=code,name,plate_no,active`);
  if(!cars.length)return null;
  const ym=(s||"").slice(0,7); // 貸出月
  const kpiRows=await bget(`bt_vehicle_monthly_kpi?year_month=eq.${encodeURIComponent(ym)}&select=vehicle_code,active`);
  const kpi:Record<string,boolean>={};for(const k of kpiRows)kpi[k.vehicle_code]=k.active;
  const fleet=await bget("bt_fleet?select=reservation_id,vehicle_code");
  const res=await bget("bt_reservations?select=id,start_date,end_date,status");
  const rmap:Record<string,any>={};for(const r of res)rmap[r.id]=r;
  const maint=await bget("bt_maintenance?select=vehicle_code,start_date,end_date");
  const mmap:Record<string,any[]>={};for(const m of maint){(mmap[m.vehicle_code]=mmap[m.vehicle_code]||[]).push(m);}
  for(const c of cars){
    // ②稼働: 月別kpi優先（kpi行が無ければグローバルactive）
    const act=(kpi[c.code]!==undefined)?kpi[c.code]:(c.active!==false);
    if(!act)continue;
    let busy=false;
    // ③予約重複
    for(const f of fleet){if(f.vehicle_code!==c.code)continue;const rr=rmap[f.reservation_id];
      if(rr&&rr.status!=="キャンセル"&&!(rr.end_date<s||rr.start_date>e)){busy=true;break;}}
    // ④メンテ/点検/車検 重複(bt_maintenance)
    if(!busy)for(const m of (mmap[c.code]||[])){const me=m.end_date||m.start_date;
      if(m.start_date&&!(me<s||m.start_date>e)){busy=true;break;}}
    if(!busy)return c;
  }
  return null;
}

// クラス解決（高松HDM C/D/E/F/G/H/I/J/K）: ①プラン内 _X_TAK ②単一コード(E_TAK→E) ③車種/クラス名キーワード
function deriveCls(r:any):string{
  // ★2026-10-16 全角「＿」を半角に正規化（楽天プラン名「エコカー・ハイブリッド＿E_TAK」でクラス空→未配車 RC***************03）
  const raw=[r._rawClass,r.vehicle,r.plan,r.plan_name,r.detail].map((x:any)=>String(x||"").replace(/＿/g,"_")).join(" ");
  const m=raw.match(/_([A-K])_TAK/i); if(m)return m[1].toUpperCase();
  const v=String(r.vehicle||r._rawClass||"").replace(/＿/g,"_").replace(/[_].*$/,"").trim(); if(/^[A-K]$/i.test(v))return v.toUpperCase();
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

// ★2026-10-15 キャンセルで空いた車の再配車。対象＝同クラス・期間重複・HDM・未キャンセル・未配車(assigned_vehicle空 かつ bt_fleet行なし かつ タスク無し)の予約のうち created_at が最も古い1件。
//   空車判定は取込と同じ assign()（クラス/HDM/月別稼働/予約重複/メンテ重複）。人が配車済みの予約(assigned_vehicle有)は触らない＝PATCHも空の時だけ。
async function reassignFreed(cls:string,s:string,e:string):Promise<string>{
  if(!cls||!s||!e)return "";
  const cands=await bget(`bt_reservations?vehicle_class=eq.${encodeURIComponent(cls)}&brand=eq.HDM&status=not.in.(${encodeURIComponent('"キャンセル",cancelled,cancel')})&or=(assigned_vehicle.is.null,assigned_vehicle.eq.)&start_date=lte.${e}&end_date=gte.${s}&select=id,name,start_date,end_date,people,insurance,ota,del_flight&order=created_at.asc`);
  const done:string[]=[];
  for(const c of cands){
    if((await bget(`bt_fleet?reservation_id=eq.${encodeURIComponent(c.id)}&select=vehicle_code`)).length)continue;
    // タスクが既にある(deleted問わず)＝人が配車→解除した等の予約は機械が覆さない（§3.2・タスクPK重複で配車表とOPシートがズレるのも防ぐ）
    if((await bget(`bt_tasks?_id=in.(${encodeURIComponent('"d-'+c.id+'","c-'+c.id+'"')})&select=_id`)).length)continue;
    const car=await assign(cls,c.start_date,c.end_date); if(!car)continue;
    const fr=await bpost("bt_fleet",{reservation_id:c.id,vehicle_code:car.code}); if(!fr.ok)continue;
    await bpatch(`bt_reservations?id=eq.${encodeURIComponent(c.id)}&or=(assigned_vehicle.is.null,assigned_vehicle.eq.)`,{assigned_vehicle:car.code,vehicle_name:car.name,plate_no:car.plate_no});
    const tc:any={"予約者":c.name||"","人数":String(N(c.people)||1),"クラス":cls,"車種":car.name,"No":car.plate_no,"確定":c.insurance||"","OTA":c.ota||"","予約番号":c.id,"class":cls,"vehicle_code":car.code,"assigned_vehicle":car.code};
    await bpost("bt_tasks",[{_id:"d-"+c.id,date:c.start_date,sort_order:1,"内容":"貸出","便名":c.del_flight||"",...tc},{_id:"c-"+c.id,date:c.end_date,sort_order:1,"内容":"返却待","便名":"",...tc}]);
    done.push(`${c.id} ${c.name||""}様→${car.name}(${car.plate_no})`);
    break; // 1キャンセル＝空く車は1台＝再配車も1件だけ（1アクション＝1件）
  }
  return done.length?`\n🔁 空いた車を未配車の予約へ再配車: ${done.join(" / ")}`:"";
}

serve(async(req)=>{
  let body:any={};try{body=await req.json();}catch(_){}
  if(SECRET && body.secret!==SECRET)return new Response("forbidden",{status:403});
  // ★2026-10-01 一回きり:既にキャンセル済なのに決済リンクが生きているじゃらん予約を一括で無効化+見える化(過去分クリーンアップ)。{voidCancelled:true} で起動。
  if(body.voidCancelled){
    const rows=await bget(`bt_reservations?ota=like.*${encodeURIComponent("じゃらん")}*&status=in.(${encodeURIComponent('"キャンセル",cancelled,cancel')})&paid=eq.false&pay_url=not.is.null&select=id,name,pay_url`);
    const out:any[]=[];
    for(const x of rows){try{const tag=await handleCancelPayment(x.id,"じゃらん");out.push({id:x.id,name:x.name,tag:tag.replace(/\n/g," ").trim()});}catch(e){out.push({id:x.id,err:String(e)});}}
    return new Response(JSON.stringify({voidCancelled:true,count:rows.length,out}),{headers:{"content-type":"application/json"}});
  }
  const r=body.reservation||{};
  const rno=r.id; if(!rno)return new Response(JSON.stringify({err:"no id"}),{status:400});
  const ota=OTANAME[body.otaCode]||OTANAME[r.ota]||r.ota||"楽天";
  const cls=deriveCls(r); // E_TAK→E / 軽ハイトワゴン→I 等（高松HDM I/J/K対応）

  // キャンセル
  if(body.isCancel){
    const ex=await bget(`bt_reservations?id=eq.${encodeURIComponent(rno)}&select=id,status,name,vehicle_class,start_date,end_date`);
    if(!ex.length)return new Response(JSON.stringify({skip:"cancel_not_found",rno}));
    const hadCar=(await bget(`bt_fleet?reservation_id=eq.${encodeURIComponent(rno)}&select=vehicle_code`)).length>0;
    await bpatch(`bt_reservations?id=eq.${encodeURIComponent(rno)}`,{status:"キャンセル"});
    await fetch(BT_URL+"/rest/v1/bt_fleet?reservation_id=eq."+encodeURIComponent(rno),{method:"DELETE",headers:h(BT_SR)});
    const payTag=await handleCancelPayment(rno,ota);  // ★2026-10-01 じゃらん=決済リンク停止/要返金+見える化。通知本文にも決済状況を載せる
    // ★2026-10-15 キャンセルで空いた車を、同クラス・期間重複の未配車HDM予約へ古い順に再配車（楽天の予約変更＝新番号取込→旧番号キャンセルの順で届き、新予約が未配車のまま残った RC***************76 の根治）
    const reTag=hadCar?await reassignFreed(ex[0].vehicle_class,ex[0].start_date,ex[0].end_date):"";
    await slack(`🔴 ${ota}HDM キャンセル【${ota} | HANDYMAN高松空港店】${rno}\n${ex[0].name||""} 様の予約をキャンセルしました${payTag}${reTag}`);
    return new Response(JSON.stringify({ok:true,cancelled:rno,pay:payTag,reassigned:reTag}));
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
  // ★2026-09-27 じゃらん高松=当店がSquareで事前集金→取込時に決済リンクを自動作成(旧BUDDICA GAS sendOtaGuidePayment_の移植・横展開漏れ根治)。
  //   pay_url/square_order_idを予約に反映＋bt_jalan_payments記録→hdm-tkm-enqueueのwelcomeに決済ブロックが載る/マイページに表示/payment-webhookで消し込み。作成失敗は取込を止めない。
  let payMsg="";
  if(_isJalan && price>0){
    try{
      const SQ_TOKEN=Deno.env.get("SQUARE_ACCESS_TOKEN")||"";
      const SQ_LOC=Deno.env.get("SQUARE_LOCATION_ID")||"L8N7J9RKPN3WH";
      if(SQ_TOKEN){
        const sqr=await fetch("https://connect.squareup.com/v2/online-checkout/payment-links",{
          method:"POST",headers:{"Square-Version":"2024-01-18",Authorization:"Bearer "+SQ_TOKEN,"Content-Type":"application/json"},
          body:JSON.stringify({idempotency_key:crypto.randomUUID(),quick_pay:{name:`高松空港店 ${r.name||""}様（${rno}） じゃらん決済`,price_money:{amount:price,currency:"JPY"},location_id:SQ_LOC}})});
        if(sqr.ok){const sj=await sqr.json();const pl=sj.payment_link||{};
          if(pl.url){
            await bpatch(`bt_reservations?id=eq.${encodeURIComponent(rno)}`,{pay_url:pl.url,square_order_id:pl.order_id});
            await bpost("bt_jalan_payments",{reservation_id:rno,status:"link_created",square_payment_url:pl.url,square_order_id:pl.order_id,amount:price,customer_email:r.mail||"",customer_name:r.name||"",lend_date:s,return_date:e,vehicle_class:cls,link_created_at:new Date().toISOString()});
            payMsg=`\n💳 事前決済リンク作成済 ${pl.url}`;
          }
        }else{payMsg=`\n⚠️決済リンク作成失敗(${sqr.status})=要手動`;}
      }else{payMsg="\n⚠️SQUARE_ACCESS_TOKEN未設定=決済リンク未作成";}
    }catch(_){payMsg="\n⚠️決済リンク作成エラー=要手動";}
  }
  // 2026-09-28 取込通知はDB cron bt_notify_new_site_reservations に一本化(両ch C0BFKEL4D1Q+C0BFDJ1HRC3・全OTA)。ここのSlackは経路依存で不安定(じゃらんは未発火)だったため撤去し重複も解消。
  return new Response(JSON.stringify({ok:true,rno,cls,car:car?car.name:"未配車",price}));
});
