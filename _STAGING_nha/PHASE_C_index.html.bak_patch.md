# Phase C — NHA本体 index.html.bak への追加パッチ（那覇マイページ内部カルテ導線）

対象ファイル: `~/Desktop/AI/naha-project/index.html.bak`
サンドボックス制約で omni から直接書けなかったため、この手順でオーナー/非サンドボックスCLIが適用する。
すべて**追加のみ**（既存機能に触れない）。適用後 `node build.js` → `index.html` の `BASE_V`＋`APP_VERSION` を+1 → `node --check app.js` → commit/push。

⚠️ コミット前に必ず `cd ~/Desktop/AI/naha-project && git fetch && git log --oneline -5 && git status`（並行Slack omniがNHAを編集中の恐れ→上に積む）。

---

## パッチ1: マイページtokenマップ useEffect を追加（札幌 index.src.html L20301 の写し）

`window._lineLinkMap` を生成している useEffect（`fetchLinks` 付近＝L21700前後、`window.addEventListener("lineLinkUpdate",update)` を持つコンポーネント App スコープ）の**近く**に、下記 useEffect をそのまま追加する。App スコープ（sb が見える場所）ならどこでもよい。`nha_reservations` を1000件ページネーションで読む。

```jsx
  // ★ 2026-07-08: マイページtokenマップ（nha_reservations.mypage_token）→ OPシート/タスクサマリからカルテ(閲覧専用)を開く
  useEffect(()=>{
    if(!sb)return;
    const fetchTokens=async()=>{
      try{
        let all=[],from=0;
        while(true){
          const{data,error}=await sb.from("nha_reservations").select("id,mypage_token").not("mypage_token","is",null).range(from,from+999);
          if(error){console.warn("[mypageTok] fetch error:",error.message);break;}
          (data||[]).forEach(r=>{if(r.id&&r.mypage_token)all.push([r.id,r.mypage_token]);});
          if(!data||data.length<1000)break; from+=1000;
        }
        const m={}; all.forEach(([id,tk])=>{ m[id]=tk; });
        window._mypageTokenMap=m;
        window.dispatchEvent(new Event("mypageTokenUpdate"));
      }catch(e){console.warn("[mypageTok] exception:",e.message);}
    };
    fetchTokens();
    const t=setInterval(()=>{ if(document.visibilityState==="visible")fetchTokens(); }, 10*60*1000);
    return ()=>clearInterval(t);
  },[]);
```

---

## パッチ2: タスク行(rT)に「🪪カルテ」リンクを追加（2箇所・現状 L22710 / L22838）

この文字列は**2箇所に完全一致で存在する**（rT レンダラの末尾＝免許証🪪リンク）。両方に同じ挿入をする（＝免許証リンクの直前に🪪カルテを挿入）。

### 検索する行（old — この行が2つある。両方対象）:
```jsx
                    {t.reservationId&&<a href={"license.html?id="+encodeURIComponent(t.reservationId)+"&name="+encodeURIComponent(t.name||"")} target="_blank" rel="noopener" onClick={function(_e){_e.stopPropagation();}} title="免許証アップロード" style={{textDecoration:"none",fontSize:13,marginLeft:"auto",lineHeight:1,cursor:"pointer"}}>🪪</a>}
                  </div>;
```

### 置換後（new — 免許証リンクの直前に🪪カルテを1行挿入）:
```jsx
                    {t.reservationId&&(()=>{const _tk=(window._mypageTokenMap||{})[t.reservationId];if(!_tk)return null;return <a href={"my-nha.html?t="+_tk+"&ro=1"} target="_blank" rel="noopener" onClick={function(_e){_e.stopPropagation();}} title="お客様カルテ（閲覧専用）" style={{fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:4,background:"#0e7a6b",color:"#fff",textDecoration:"none",whiteSpace:"nowrap",lineHeight:1.6}}>🪪カルテ</a>;})()}
                    {t.reservationId&&<a href={"license.html?id="+encodeURIComponent(t.reservationId)+"&name="+encodeURIComponent(t.name||"")} target="_blank" rel="noopener" onClick={function(_e){_e.stopPropagation();}} title="免許証アップロード" style={{textDecoration:"none",fontSize:13,marginLeft:"auto",lineHeight:1,cursor:"pointer"}}>🪪</a>}
                  </div>;
```

（Edit ツールなら `replace_all:true` で一発。sed だと免許証リンクは長いので Edit/手動が安全。）

---

## パッチ3（任意・OP表があれば）: OPマスター表の予約番号セルにも同リンク
札幌は L15956 の予約番号セル（license.html リンクの隣）に🪪マイページを付けている。NHA の OP表マスターに同等の「予約番号セル＋license.htmlリンク」があれば、そこにも上記 `_tk` パターンでカルテリンクを追加してよい（任意）。現状は rT（タスクサマリ/スケジュールの個人別行）2箇所で最低目標を満たす。

---

## 適用後の手順
```
cd ~/Desktop/AI/naha-project
node build.js
# index.html の BASE_V を +1、index.html.bak の APP_VERSION を +1（マニュアル対象外の内部機能だが版は上げる）
node --check app.js   # 構文OK確認
git add index.html.bak index.html app.js my-nha.html
git commit -m "feat(NHA): マイページ内部カルテ閲覧(my-nha.html+lookup EF連動)。OPシート/タスクサマリに🪪カルテ(ro=1)導線"
git push origin main
```
本番確認: `https://nosh2318.github.io/naha-project/my-nha.html?t=<実token>&ro=1`
実token例（DEL/場所あり）: `57c5abbe-8c7a-4520-a1fd-03e1af3d6e39`（サクガワ様・DEL 赤嶺駅南口 16:00）
実token例（PUB/バス）: `1ee801bc-51c7-4d3e-b678-4be918dafe53`（オオウチ様・PUB→バス表示になるか確認）
