/* 出発前点検「やり方」の説明欄に、写真・動画を足す（札幌 APP 専用・2026-11-05 追加）
   - insp-howto.js（既存の説明文・図・ボタン）には一切手を入れない。開いた説明欄の一番下に「写真・動画」枠を足すだけ。
   - 保存先：表 spk_insp_howto_media（1枚＝1行）＋ 非公開バケット spk-howto-media（<登録者uid>/<項目>/<時刻>.<拡張子>）。
   - 権限：見る＝ログイン中のスタッフ全員／足す＝誰でも（自分の名前で残る）／説明を直す・消す＝登録した本人だけ（DB の RLS で強制）。
   - 消す＝墓標（deleted=true）。ファイルは残す（物理削除しない）。 */
(function(){
  if(window.InspHowtoMedia)return;
  var BUCKET="spk-howto-media", TABLE="spk_insp_howto_media";
  var MAX_VIDEO=50*1024*1024, IMG_MAX_EDGE=1600;
  var SB=null, ME=null, CACHE={}, URLS={}, BUSY={}, LOADING={};

  function css(){
    if(document.getElementById("ihm-css"))return;
    var st=document.createElement("style");st.id="ihm-css";
    st.textContent=".ihm{margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px}"+
      ".ihm-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:900;color:#0f172a}"+
      ".ihm-add{border:1px solid #2563eb;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap}"+
      ".ihm-add[disabled]{opacity:.5}"+
      ".ihm-list{display:flex;flex-direction:column;gap:10px;margin-top:8px}"+
      ".ihm-it{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:6px}"+
      ".ihm-it img,.ihm-it video{width:100%;max-width:360px;max-height:420px;object-fit:contain;border-radius:8px;display:block;background:#0f172a0d}"+
      ".ihm-cap{font-size:13px;color:#1e293b;margin-top:4px;white-space:pre-wrap;word-break:break-word}"+
      ".ihm-by{font-size:11px;color:#64748b;margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}"+
      ".ihm-ed{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}"+
      ".ihm-ed.del{color:#b91c1c;border-color:#fca5a5}"+
      ".ihm-msg{font-size:12px;color:#64748b;margin-top:6px}"+
      ".ihm-zoom{position:fixed;inset:0;z-index:20000;background:rgba(15,23,42,.92);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}"+
      ".ihm-zoom img{max-width:100%;max-height:100%;object-fit:contain}";
    (document.head||document.documentElement).appendChild(st);
  }
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
  function fmt(at){if(!at)return "";var d=new Date(at);return (d.getMonth()+1)+"/"+d.getDate();}

  function me(){
    if(ME)return Promise.resolve(ME);
    return SB.auth.getSession().then(function(r){var u=r&&r.data&&r.data.session&&r.data.session.user;ME=u?u.id:null;return ME;}).catch(function(){return null;});
  }
  function load(k,force){
    if(!force&&CACHE[k])return Promise.resolve(CACHE[k]);
    if(LOADING[k]&&!force)return LOADING[k];
    var p=me().then(function(){
      return SB.from(TABLE).select("id,item_key,media_type,path,caption,created_by,created_by_name,created_at").eq("item_key",k).eq("deleted",false).order("created_at",{ascending:true});
    }).then(function(r){
      if(r.error)throw r.error;
      var rows=r.data||[], need=rows.map(function(x){return x.path;}).filter(function(p){return !URLS[p]||URLS[p].exp<Date.now();});
      if(!need.length)return rows;
      return SB.storage.from(BUCKET).createSignedUrls(need,6*3600).then(function(s){
        (s.data||[]).forEach(function(x){if(x&&x.signedUrl)URLS[x.path]={u:x.signedUrl,exp:Date.now()+5*3600e3};});
        return rows;
      });
    }).then(function(rows){CACHE[k]=rows;delete LOADING[k];return rows;},function(e){delete LOADING[k];throw e;});
    LOADING[k]=p;return p;
  }

  function html(k,rows,msg){
    var busy=BUSY[k];
    var h='<div class="ihm-h"><span>📷 写真・動画'+(rows&&rows.length?"（"+rows.length+"）":"")+'</span>'+
      '<button type="button" class="ihm-add" data-ihm-add="'+k+'"'+(busy?" disabled":"")+'>'+(busy?esc(busy):"＋ 追加")+'</button></div>';
    if(msg)h+='<div class="ihm-msg">'+esc(msg)+'</div>';
    if(rows&&rows.length){
      h+='<div class="ihm-list">'+rows.map(function(x){
        var u=URLS[x.path]&&URLS[x.path].u||"", mine=ME&&x.created_by===ME;
        var media=!u?'<div class="ihm-msg">表示できませんでした</div>':
          x.media_type==="video"?'<video src="'+esc(u)+'#t=0.1" controls playsinline preload="metadata"></video>':
          '<img src="'+esc(u)+'" alt="" loading="lazy" data-ihm-zoom="1">';
        return '<div class="ihm-it">'+media+(x.caption?'<div class="ihm-cap">'+esc(x.caption)+'</div>':"")+
          '<div class="ihm-by"><span>登録 '+esc(x.created_by_name||"")+' '+fmt(x.created_at)+'</span>'+
          (mine?'<button type="button" class="ihm-ed" data-ihm-cap="'+x.id+'" data-k="'+k+'">説明を書く</button><button type="button" class="ihm-ed del" data-ihm-del="'+x.id+'" data-k="'+k+'">削除</button>':"")+
          '</div></div>';
      }).join("")+'</div>';
    }
    return h;
  }
  function paint(k,msg){
    var boxes=document.querySelectorAll('.ihm[data-k="'+k+'"]');
    for(var i=0;i<boxes.length;i++)boxes[i].innerHTML=html(k,CACHE[k],msg);
  }
  function refresh(k,force){
    return load(k,force).then(function(){paint(k);}).catch(function(e){paint(k,"読み込めませんでした（電波を確認してください）");console.warn("[ihm]",e);});
  }

  /* ---------- 追加 ---------- */
  function shrink(file){
    return new Promise(function(res){
      if(!/^image\//.test(file.type)||/gif$/.test(file.type)){res({blob:file,type:file.type||"image/jpeg",ext:(file.name.split(".").pop()||"jpg").toLowerCase()});return;}
      var url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){
        var w=img.naturalWidth,h=img.naturalHeight,s=Math.min(1,IMG_MAX_EDGE/Math.max(w,h));
        var c=document.createElement("canvas");c.width=Math.round(w*s);c.height=Math.round(h*s);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
        c.toBlob(function(b){res(b?{blob:b,type:"image/jpeg",ext:"jpg"}:{blob:file,type:file.type,ext:"jpg"});},"image/jpeg",0.85);
      };
      img.onerror=function(){URL.revokeObjectURL(url);res({blob:file,type:file.type||"image/jpeg",ext:"jpg"});};
      img.src=url;
    });
  }
  function upOne(k,file,uid){
    var isVid=/^video\//.test(file.type)||/\.(mov|mp4|m4v|webm)$/i.test(file.name||"");
    if(isVid&&file.size>MAX_VIDEO)return Promise.reject(new Error("動画が大きすぎます（50MBまで）。短く撮り直してください"));
    return (isVid?Promise.resolve({blob:file,type:file.type||"video/quicktime",ext:((file.name||"").split(".").pop()||"mov").toLowerCase()}):shrink(file)).then(function(f){
      var path=uid+"/"+k+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"."+f.ext.replace(/[^a-z0-9]/g,"");
      return SB.storage.from(BUCKET).upload(path,f.blob,{contentType:f.type,upsert:false}).then(function(r){
        if(r.error)throw r.error;
        return SB.from(TABLE).insert({item_key:k,media_type:isVid?"video":"image",path:path,mime:f.type});
      }).then(function(r){if(r.error)throw r.error;});
    });
  }
  function pick(k){
    var inp=document.createElement("input");inp.type="file";inp.accept="image/*,video/*";inp.multiple=true;inp.style.display="none";
    inp.onchange=function(){
      var files=[].slice.call(inp.files||[]);inp.remove();if(!files.length)return;
      me().then(function(uid){
        if(!uid){alert("ログインが切れています。もう一度ログインしてください。");return;}
        var i=0,errs=[];
        var next=function(){
          if(i>=files.length){delete BUSY[k];CACHE[k]=null;refresh(k,true);if(errs.length)alert("登録できなかったものがあります：\n"+errs.join("\n"));return;}
          BUSY[k]="送信中 "+(i+1)+"/"+files.length;paint(k);
          var f=files[i++];
          upOne(k,f,uid).catch(function(e){errs.push((f.name||"ファイル")+"："+((e&&e.message)||e));}).then(next);
        };
        next();
      });
    };
    document.body.appendChild(inp);inp.click();
  }

  /* ---------- 本人だけ：説明・削除（RLS で本人以外は0件更新） ---------- */
  function upd(k,id,patch){
    return SB.from(TABLE).update(patch).eq("id",id).select("id").then(function(r){
      if(r.error)throw r.error;if(!r.data||!r.data.length)throw new Error("登録した本人だけが変更できます");
    }).then(function(){return refresh(k,true);}).catch(function(e){alert("保存できませんでした："+((e&&e.message)||e));});
  }
  function find(k,id){return (CACHE[k]||[]).filter(function(x){return x.id===id;})[0];}

  document.addEventListener("click",function(e){
    var t=e.target&&e.target.closest&&e.target.closest("[data-ihm-add],[data-ihm-cap],[data-ihm-del],[data-ihm-zoom],.ihm-zoom");
    if(!t||!SB)return;
    e.preventDefault();e.stopPropagation();
    if(t.classList.contains("ihm-zoom")){t.remove();return;}
    if(t.hasAttribute("data-ihm-zoom")){var z=document.createElement("div");z.className="ihm-zoom";z.innerHTML='<img src="'+esc(t.getAttribute("src"))+'" alt="">';document.body.appendChild(z);return;}
    if(t.hasAttribute("data-ihm-add")){if(!t.disabled)pick(t.getAttribute("data-ihm-add"));return;}
    var k=t.getAttribute("data-k"),id=t.getAttribute("data-ihm-cap")||t.getAttribute("data-ihm-del"),x=find(k,id);if(!x)return;
    if(t.hasAttribute("data-ihm-cap")){var v=prompt("説明（空にすると消えます）",x.caption||"");if(v===null)return;upd(k,id,{caption:String(v).trim().slice(0,200)||null});return;}
    if(confirm("この"+(x.media_type==="video"?"動画":"写真")+"を削除しますか？"))upd(k,id,{deleted:true});
  },true);

  /* ---------- 開いた「やり方」の説明欄に枠を付ける（既存の中身はそのまま・末尾に足すだけ） ---------- */
  var queued=false;
  function scan(){
    queued=false;
    var ps=document.querySelectorAll(".ih-p[data-ihp]:not([hidden])");
    for(var i=0;i<ps.length;i++){
      var p=ps[i],k=p.getAttribute("data-ihp");
      if(!k||!p.innerHTML||p.querySelector(".ihm"))continue;
      var d=document.createElement("div");d.className="ihm";d.setAttribute("data-k",k);
      d.innerHTML=html(k,CACHE[k],CACHE[k]?"":"読み込み中…");p.appendChild(d);
      refresh(k,false);
    }
  }
  function init(client){
    if(SB||!client)return;SB=client;css();
    try{SB.auth.onAuthStateChange(function(){ME=null;});}catch(_e){}
    new MutationObserver(function(){if(!queued){queued=true;requestAnimationFrame(scan);}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
  }
  window.InspHowtoMedia={init:init};
})();
