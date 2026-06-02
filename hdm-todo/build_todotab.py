#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hdm-todo/index.html（検証済み単独アプリ）から、本体APP統合用の
TodoTab バンドル(todo-tab.gen.js)を生成する。
  - CSS: 全セレクタを .hdmtodo 配下にスコープ（ホストTailwind/既存CSSと衝突回避）
         ページchrome(.app/.rail/.landing/.bnav/.topbar/.main/.content/html,body/#root/*)は除外
  - JS : constants/helpers/seed/コンポーネント(Donut〜TaskEditser) を verbatim 抽出
         App/Landing/persistence/multi-store は除外（TodoTab ルートで置換）
  - 末尾に TodoTab({store, sb, label}) ルート（per-entity + Realtime + 認証sb）を付与
再実行可能（omniがhdm-todoを更新したら再生成）。
"""
import re, io

SRC = "index.html"
OUT = "todo-tab.gen.js"

raw = io.open(SRC, encoding="utf-8").read()
lines = raw.split("\n")  # 1-indexed access via lines[i-1]

# ---------- 1) CSS 抽出 ----------
css = re.search(r"<style>(.*?)</style>", raw, re.S).group(1)

# ページchrome・グローバルに効くセレクタは捨てる（タブ埋め込みでは不要/有害）
DROP_PREFIXES = ("*", "html", "body", "#root", ".app", ".rail", ".landing",
                 ".land-", ".bnav", ".topbar", ".main", ".content", ".store-switch")

def scope_selector(sel):
    sel = sel.strip()
    if not sel:
        return None
    if sel.startswith("@"):
        return sel  # handled by caller
    parts = [s.strip() for s in sel.split(",")]
    out = []
    for p in parts:
        low = p.lstrip()
        if low.startswith(":root"):
            out.append(p)  # CSS変数はグローバル維持（無害）
            continue
        if any(low == d or low.startswith(d) for d in DROP_PREFIXES):
            continue  # ページchromeは破棄
        out.append(".hdmtodo " + p)
    return ", ".join(out) if out else None

def scope_block(block):
    """ '@media(...){ rules }' or top-level rules の塊を受け取りスコープ化して返す """
    res = []
    i = 0
    n = len(block)
    while i < n:
        # 空白送り
        m = re.match(r"\s+", block[i:])
        if m:
            i += m.end(); continue
        if block[i] == "@":
            # @media 等：ヘッダ { ... } を取り出し中身を再帰スコープ
            hdr_end = block.index("{", i)
            header = block[i:hdr_end].strip()
            # 対応する閉じ } を深さ管理で探す
            depth = 0; j = hdr_end
            while j < n:
                if block[j] == "{": depth += 1
                elif block[j] == "}":
                    depth -= 1
                    if depth == 0: break
                j += 1
            inner = block[hdr_end+1:j]
            res.append(header + "{\n" + scope_block(inner) + "\n}")
            i = j + 1
        else:
            # 通常ルール sel { body }
            brace = block.index("{", i)
            sel = block[i:brace]
            depth = 0; j = brace
            while j < n:
                if block[j] == "{": depth += 1
                elif block[j] == "}":
                    depth -= 1
                    if depth == 0: break
                j += 1
            body = block[brace+1:j].strip()
            scoped = scope_selector(sel)
            if scoped:
                res.append(scoped + "{" + body + "}")
            i = j + 1
    return "\n".join(res)

scoped_css = scope_block(css)
# .hdmtodo 自体にベースのフォント/色（html,body相当）を付与
scoped_css = (".hdmtodo{font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP','Segoe UI',sans-serif;"
              "color:var(--ink);font-size:15px;line-height:1.5;-webkit-text-size-adjust:100%}\n"
              ".hdmtodo *{box-sizing:border-box}\n" + scoped_css)

# ---------- 2) JS verbatim 抽出（マーカー基準・行ズレに強い）----------
def between(start_marker, end_marker):
    i = raw.index(start_marker)
    j = raw.index(end_marker, i + len(start_marker))
    return raw[i:j]

# constants + hierarchy + date utils（APP_VERSION行は除去）
constants = between("/* ===== constants", "/* ===== persistence")
constants = "\n".join(l for l in constants.split("\n") if "const APP_VERSION" not in l)
seed       = between("/* ===== seed", "/* ===== multi-store")
# Donut 〜 TaskEditor（Landing直前まで・全コンポーネント）
components = between("/* ===== small components", "function Landing(")

# ---------- 3) TodoTab ルート（新規）----------
root = r"""
/* ===== 本体統合ルート：TodoTab（per-entity + Realtime + 認証sb） ===== */
function _todoTaskToRow(t){return {id:t.id,area:t.area||null,title:t.title||"",assignee:t.assignee||"全員",parent_id:t.parentId||null,priority:t.priority||"中",status:t.status||"未着手",progress:t.progress||0,start_date:t.start||null,due_date:t.due||null,description:t.description||"",logs:t.logs||[],attachments:t.attachments||[],admin_confirmed:!!t.adminConfirmed,completed_at:t.completedAt||null,created_at:t.createdAt||TODAY,deleted:false,updated_at:new Date().toISOString()};}
function _todoRowToTask(r){return {id:r.id,area:r.area,title:r.title,assignee:r.assignee,parentId:r.parent_id,priority:r.priority,status:r.status,progress:r.progress||0,start:r.start_date,due:r.due_date,description:r.description||"",logs:r.logs||[],attachments:r.attachments||[],adminConfirmed:!!r.admin_confirmed,completedAt:r.completed_at,createdAt:r.created_at};}

function TodoTab({store, sb, label, hostStaff, hostShifts}){
  const PFX=store; // 'nha' | 'spk' | 'bt'
  const T_TBL=PFX+"_todo_tasks", M_TBL=PFX+"_todo_meta";
  const ME_KEY="hdm_todo_me_"+PFX;
  const [tasks,setTasks0]=useState([]);
  const [goals,setGoals0]=useState({annual:"",month:TODAY.slice(0,7),months:{}});
  const [staff,setStaff0]=useState(DEFAULT_STAFF.map(p=>({...p})));
  const [me,setMe]=useState(()=>{try{return localStorage.getItem(ME_KEY)||DEFAULT_STAFF[0].name;}catch(e){return DEFAULT_STAFF[0].name;}});
  const [tab,setTab]=useState("areas");
  const [editor,setEditor]=useState(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [sync,setSync]=useState("connecting");
  // メンバーは本体APPのスタッフ/シフト名簿から自動表示（+タスク割当済の名前も補完）
  const hostPeople = useMemo(()=>{
    const m=new Map();
    (hostStaff||[]).forEach((s,i)=>{ if(s&&s.name) m.set(s.name,{name:s.name,role:s.role||(s.admin?"管理者":"現場"),color:s.color||STAFF_COLORS[i%STAFF_COLORS.length],admin:!!s.admin}); });
    tasks.forEach(t=>{ if(t.assignee&&t.assignee!=="全員"&&!m.has(t.assignee)) m.set(t.assignee,{name:t.assignee,role:"現場",color:STAFF_COLORS[m.size%STAFF_COLORS.length]}); });
    return [...m.values()];
  },[hostStaff,tasks]);
  PEOPLE = hostPeople.length?hostPeople:((staff&&staff.length)?staff:DEFAULT_STAFF);

  // ---- DB helpers ----
  const reloadAll=async()=>{
    if(!sb) return;
    try{
      const tq=await sb.from(T_TBL).select("*").eq("deleted",false);
      if(tq.error) throw tq.error;
      setTasks0((tq.data||[]).map(_todoRowToTask));
      const mq=await sb.from(M_TBL).select("*").in("id",[store+":goals",store+":staff"]);
      if(!mq.error&&mq.data){
        const g=mq.data.find(r=>r.id===store+":goals"); if(g&&g.data&&Object.keys(g.data).length) setGoals0(x=>({...x,...g.data}));
        const s=mq.data.find(r=>r.id===store+":staff"); if(s&&Array.isArray(s.data)&&s.data.length) setStaff0(s.data);
      }
      setSync("cloud");
    }catch(e){ setSync("off"); }
  };
  const dbUpsertTask=async(t)=>{ try{ await sb.from(T_TBL).upsert(_todoTaskToRow(t)); }catch(e){ setSync("off"); } };
  const dbSoftDelete=async(ids)=>{ try{ await sb.from(T_TBL).update({deleted:true,updated_at:new Date().toISOString()}).in("id",ids); }catch(e){ setSync("off"); } };
  const dbSaveMeta=async(kind,data)=>{ try{ await sb.from(M_TBL).upsert({id:store+":"+kind,data,updated_at:new Date().toISOString()}); }catch(e){ setSync("off"); } };

  // 初回ロード + Realtime購読
  useEffect(()=>{
    let ch=null;
    reloadAll();
    if(sb&&sb.channel){
      try{
        ch=sb.channel("todo-"+PFX)
          .on("postgres_changes",{event:"*",schema:"public",table:T_TBL},()=>reloadAll())
          .on("postgres_changes",{event:"*",schema:"public",table:M_TBL},()=>reloadAll())
          .subscribe();
      }catch(e){}
    }
    return ()=>{ if(ch&&sb) try{sb.removeChannel(ch);}catch(e){} };
  },[]);

  // ---- mutations（local即時 + DB反映）----
  const setTasks=fn=>setTasks0(ts=>typeof fn==="function"?fn(ts):fn);
  const updTask=(id,patch)=>{ setTasks(ts=>ts.map(t=>t.id===id?{...t,...patch}:t)); const cur=tasks.find(t=>t.id===id); if(cur) dbUpsertTask({...cur,...patch}); };
  const saveStaffFn=(origName,next)=>{
    let nextStaff, reassigned=[];
    if(origName){
      nextStaff=PEOPLE.map(p=>p.name===origName?next:p);
      if(next.name!==origName){ tasks.forEach(t=>{ if(t.assignee===origName){reassigned.push({...t,assignee:next.name});} }); if(me===origName){setMe(next.name);try{localStorage.setItem(ME_KEY,next.name);}catch(e){}} }
    }else{
      if(PEOPLE.some(p=>p.name===next.name)) return;
      nextStaff=[...PEOPLE,next];
    }
    setStaff0(nextStaff); dbSaveMeta("staff",nextStaff);
    if(reassigned.length){ setTasks(ts=>ts.map(t=>{const r=reassigned.find(x=>x.id===t.id);return r?r:t;})); reassigned.forEach(dbUpsertTask); }
  };
  const removeStaffFn=name=>{
    if(PEOPLE.length<=1) return;
    const nextStaff=PEOPLE.filter(p=>p.name!==name); setStaff0(nextStaff); dbSaveMeta("staff",nextStaff);
    const aff=tasks.filter(t=>t.assignee===name).map(t=>({...t,assignee:"全員"}));
    if(aff.length){ setTasks(ts=>ts.map(t=>t.assignee===name?{...t,assignee:"全員"}:t)); aff.forEach(dbUpsertTask); }
    if(me===name){setMe(nextStaff[0].name);try{localStorage.setItem(ME_KEY,nextStaff[0].name);}catch(e){}}
  };
  const onOpen=t=>setEditor({task:t});
  const onNew=initial=>setEditor({initial:initial||{}});
  const onAddChild=parent=>setEditor({initial:{parentId:parent.id,area:parent.area,assignee:parent.assignee,start:parent.start,due:parent.due}});
  const onAddTop=area=>setEditor({initial:{area}});
  const onProgress=(t,p)=>{const patch={progress:p,status:p>=100?"完了":(t.status==="未着手"?"進行中":t.status)};if(p>=100&&!t.completedAt)patch.completedAt=TODAY;if(p<100&&t.status==="完了")patch.completedAt=null;updTask(t.id,patch);};
  const onComplete=t=>updTask(t.id,{status:"完了",progress:100,completedAt:t.completedAt||TODAY});
  const onSetStatus=(id,status)=>updTask(id, status==="完了"?{status,progress:100,completedAt:TODAY}:{status,completedAt:null});
  const onLog=t=>setEditor({task:t});
  const saveTask=f=>{
    const patch={...f};
    if(patch.status==="完了"&&!patch.completedAt)patch.completedAt=TODAY;
    if(patch.status!=="完了")patch.completedAt=null;
    if(patch.id){ updTask(patch.id,patch); }
    else{ const nt={...patch,id:uid(),createdAt:TODAY}; setTasks(ts=>[nt,...ts]); dbUpsertTask(nt); }
    setEditor(null);
  };
  const delTask=f=>{
    const desc=descendantIds(tasks,f.id);
    const msg=desc.length?("このタスクと子タスク"+desc.length+"件をすべて削除しますか？"):"このタスクを削除しますか？";
    if(confirm(msg)){ const kill=[f.id,...desc]; setTasks(ts=>ts.filter(t=>!kill.includes(t.id))); dbSoftDelete(kill); setEditor(null); }
  };
  const setGoals=g=>{ setGoals0(g); dbSaveMeta("goals",g); };
  const changeMe=v=>{ setMe(v); try{localStorage.setItem(ME_KEY,v);}catch(e){} };

  const overdue=tasks.filter(t=>t.status!=="完了"&&t.due&&diffDays(TODAY,t.due)<0).length;
  const cur=TODO_TABS.find(t=>t.k===tab)||TODO_TABS[0];
  const h={onOpen,onProgress,onComplete,onLog,onAddChild,onSetStatus};
  const syncTxt=sync==="cloud"?"☁ 全員と同期":sync==="off"?"⚠ オフライン(再接続待ち)":"⏳ 接続中…";
  const syncColor=sync==="cloud"?"#14a44d":sync==="off"?"#e8384f":"#f59e0b";

  const body=(
    tab==="areas"   ? <AreaTree tasks={tasks} onOpen={onOpen} onAddChild={onAddChild} onAddTop={onAddTop} onComplete={onComplete}/> :
    tab==="timeline"? <Timeline tasks={tasks} goals={goals} onOpen={onOpen} onCreate={onNew} shifts={hostShifts}/> :
    tab==="list"    ? <TaskList tasks={tasks} {...h}/> :
    tab==="dash"    ? <Dashboard tasks={tasks} goals={goals} go={setTab}/> :
    tab==="ai"      ? <AIManager tasks={tasks} goals={goals}/> :
    tab==="logs"    ? <Logs tasks={tasks} onOpen={onOpen}/> :
    tab==="staff"   ? <StaffManager staff={PEOPLE} tasks={tasks} onSave={saveStaffFn} onRemove={removeStaffFn} shifts={hostShifts}/> :
                      <Goals goals={goals} setGoals={setGoals} tasks={tasks}/>
  );

  return (
    <div className="hdmtodo">
      <div className="todo-bar">
        <div className="todo-tabs">
          {TODO_TABS.map(t=>(
            <button key={t.k} className={"todo-tabbtn"+(tab===t.k?" on":"")} onClick={()=>setTab(t.k)}>
              <span>{t.ic}</span>{t.label}{t.k==="list"&&overdue>0&&<span className="todo-badge">{overdue}</span>}
            </button>
          ))}
        </div>
        <div className="todo-bar-r">
          <span style={{color:syncColor,fontWeight:700,fontSize:12}}>{syncTxt}</span>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:"var(--sub)"}}>👤
            <select value={me} onChange={e=>changeMe(e.target.value)} style={{border:"1px solid var(--line)",borderRadius:9,padding:"6px 9px",fontWeight:700}}>
              {PEOPLE.map(p=><option key={p.name}>{p.name}</option>)}
            </select>
          </label>
          <button className="btn pri" onClick={()=>onNew({})}>＋ タスク</button>
        </div>
      </div>
      <div className="todo-body">{body}</div>
      {editor && <TaskEditor task={editor.task} initial={editor.initial} tasks={tasks} me={me} onSave={saveTask} onClose={()=>setEditor(null)} onDelete={delTask}/>}
    </div>
  );
}
const TODO_TABS=[
  {k:"areas",ic:"🗂",label:"担当領域"},{k:"timeline",ic:"🗓",label:"タイムライン"},
  {k:"list",ic:"≣",label:"一覧"},{k:"dash",ic:"📊",label:"ダッシュ"},
  {k:"ai",ic:"🤖",label:"AI管理"},{k:"logs",ic:"📜",label:"ログ"},
  {k:"staff",ic:"👥",label:"スタッフ"},{k:"goals",ic:"🎯",label:"目標"},
];
window.TodoTab = TodoTab;
"""

# 埋め込みタブ専用の追加CSS（横タブバー）
extra_css = """
.hdmtodo .todo-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:4px 0 12px;border-bottom:1px solid var(--line);margin-bottom:14px}
.hdmtodo .todo-tabs{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0}
.hdmtodo .todo-tabbtn{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:9px;font-size:13px;font-weight:700;color:var(--sub);background:#f1f2f4;border:none;position:relative}
.hdmtodo .todo-tabbtn.on{background:var(--accent);color:#fff}
.hdmtodo .todo-badge{background:#e8384f;color:#fff;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.hdmtodo .todo-bar-r{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
/* 出勤日セル（タイムライン） */
.hdmtodo .tl-cell.work{background:#e9f2ff;box-shadow:inset 0 0 0 1px #d3e6ff}
.hdmtodo .tl-cell.work.we{background:#e0ecfb}
.hdmtodo .tl-cell.work.sel{background:#cbe0fb}
/* ===== スマホ最適化（タブ＝横スクロール1行 / 操作＝下の全幅行）===== */
@media(max-width:759px){
  .hdmtodo .todo-bar{flex-direction:column;align-items:stretch;gap:8px;padding-bottom:10px}
  .hdmtodo .todo-tabs{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none;width:100%}
  .hdmtodo .todo-tabs::-webkit-scrollbar{display:none}
  .hdmtodo .todo-tabbtn{font-size:12px;padding:8px 12px;flex-shrink:0}
  .hdmtodo .todo-bar-r{width:100%;justify-content:space-between;flex-wrap:nowrap;gap:8px}
  .hdmtodo .todo-bar-r select{flex:1;min-width:0}
  .hdmtodo .todo-bar-r .btn.pri{flex-shrink:0;justify-content:center;white-space:nowrap}
  .hdmtodo .todo-body{width:100%}
  .hdmtodo .kgrid{grid-template-columns:repeat(2,1fr);gap:8px}
  .hdmtodo .eval-grid,.hdmtodo .board,.hdmtodo .goal-grid{grid-template-columns:1fr}
  .hdmtodo .card{border-radius:12px}
  .hdmtodo .tl-wrap{margin:0 -2px}
  .hdmtodo .tl{min-width:540px}
  .hdmtodo .sheet{max-height:94vh}
  .hdmtodo .sec-h{margin:16px 2px 9px}
  .hdmtodo .sec-h h2{font-size:13px}
  .hdmtodo .filters{gap:7px}
  .hdmtodo .tcard .acts{gap:6px}
  .hdmtodo .tcard .acts .btn{flex:1;justify-content:center}
}
"""

bundle = (
"/* === AUTO-GENERATED by build_todotab.py — 直接編集しない。hdm-todo/index.html を直して再生成 === */\n"
"/* 名前衝突回避: 全内部名をIIFEに隔離し window.TodoTab のみ公開（ホストAPPと共存） */\n"
"(function(){\n"
"if(window.__hdmTodoLoaded)return; window.__hdmTodoLoaded=true;\n"
"var _css=" + repr(scoped_css + "\n" + extra_css) + ";\n"
"var _s=document.createElement('style'); _s.textContent=_css; document.head.appendChild(_s);\n"
"})();\n\n"
"(function(){\n"
"const {useState,useMemo,useEffect,useRef}=React;\n"
"/* ===== constants / helpers ===== */\n" + constants + "\n\n"
"/* ===== seed ===== */\n" + seed + "\n\n"
"/* ===== components (verbatim from hdm-todo) ===== */\n" + components + "\n"
+ root +
"\n})();\n"
)

io.open(OUT, "w", encoding="utf-8").write(bundle)
print("generated", OUT, "bytes=", len(bundle))
print("css scoped bytes=", len(scoped_css))
