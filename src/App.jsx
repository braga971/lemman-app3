import React, { useMemo, useState, useEffect, useRef } from 'react'

// === Supabase sync ===
import { loadRemoteDB, saveRemoteDB } from './persist.js'
import { supabase } from './supabaseClient.js'

// ---------- Helpers ----------
function isoWeekInfo(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return { year: date.getUTCFullYear(), week: weekNo }
}
const weekStr = ({ year, week }) => `${year}-W${String(week).padStart(2, '0')}`
const weekNum = (ws) => { const m = /^(\d{4})-W(\d{2})$/.exec(ws || ""); if (!m) return 0; return Number(m[1]) * 100 + Number(m[2]); }
function nextWeek(ws) {
  const m = /^(\d{4})-W(\d{2})$/.exec(ws); if (!m) return ws
  let y = +m[1], w = +m[2]; w += 1; if (w > 53) { y += 1; w = 1 }
  return `${y}-W${String(w).padStart(2, '0')}`
}
const uid = () => Math.random().toString(36).slice(2)
const today = () => new Date().toISOString().slice(0, 10)

// Safe-merge remote DB with local SEED (prevents blank screen on incomplete state)
function mergeDB(remote, fallback) {
  try {
    if (!remote || typeof remote !== 'object') return fallback
    const merged = { ...fallback, ...remote }
    const arrKeys = ['commesse','cantieri','weeklyShifts','tasks','reports','notifications','posts']
    for (const k of arrKeys) {
      if (!Array.isArray(merged[k])) merged[k] = fallback[k]
    }
    return merged
  } catch { return fallback }
}

// Local persistence (offline-first light)
const STORAGE_KEY = 'lemman-db-v6.2'
function loadDB(fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function saveDB(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)) } catch {}
}

async function readImageAsDataURL(file) {
  return await new Promise((resolve, reject) => {
    try {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => reject(new Error('Lettura immagine fallita'))
      fr.readAsDataURL(file)
    } catch (e) { reject(e) }
  })
}

// ---------- Utenti demo ----------
const USERS = [
  { username: 'mario.rossi', pwd: 'lemman', role: 'Dipendente', name: 'Mario Rossi' },
  { username: 'anna.verdi', pwd: 'lemman', role: 'Dipendente', name: 'Anna Verdi' },
  { username: 'responsabile', pwd: 'lemman', role: 'Responsabile', name: 'Responsabile' },
]

// ---------- Seed ----------
const SEED = (() => {
  const curW = weekStr(isoWeekInfo())
  return {
    commesse: [
      { id: uid(), code: 'C-2405-ALFA', desc: 'Reattore multilayer – ALFA', active: true, boundSite: 'Officina Padova', lockSite: true, posizioni: [{ id: uid(), name: 'SALDATURA' }, { id: uid(), name: 'MONTAGGIO' }] },
      { id: uid(), code: 'C-2406-BETA', desc: 'Scambiatore – BETA', active: true, boundSite: '', lockSite: false, posizioni: [{ id: uid(), name: 'CARPENTERIA' }] },
    ],
    cantieri: [{ id: uid(), name: 'Officina Padova' }, { id: uid(), name: 'Cantiere Mestre' }],
    weeklyShifts: [
      { id: uid(), dip: 'Mario Rossi', week: curW, hours: '08:00–17:00', site: 'Officina Padova' },
      { id: uid(), dip: 'Mario Rossi', week: nextWeek(curW), hours: '08:00–17:00', site: 'Cantiere Mestre' },
    ],
    tasks: [
      { id: uid(), dip: 'Mario Rossi', date: today(), title: 'Verifica DPI', photo: '', done: false },
      { id: uid(), dip: 'Mario Rossi', date: today(), title: 'Montaggio supporti linea A', photo: '', done: false },
    ],
    reports: [
      { id: uid(), date: today(), dip: 'Mario Rossi', commessaId: '', posizioneId: '', ore: 8, site: 'Officina Padova', descr: 'Attività iniziali', stato: 'Inviato', noteResp: '', photos: [] }
    ],
    notifications: [],
    posts: [{ id: uid(), title: 'Benvenuti nella nuova app LEMMAN', body: 'Gestione turni/rapportini/attività.', author: 'Responsabile', ts: Date.now() }],
  }
})()

// ---------- Styles ----------
const styles = `
:root{--bg:#f6f6f7;--ink:#111;--muted:#666;--card:#fff;--line:#e5e5e5;--brand:#111}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Arial}
nav{background:var(--brand);color:#fff;display:flex;gap:10px;padding:10px 12px;position:sticky;top:0;z-index:10;overflow:auto}
nav a,nav button{color:#fff;text-decoration:none;padding:6px 10px;border-radius:8px;border:0;background:transparent;white-space:nowrap}
nav a:hover{background:rgba(255,255,255,.1)}.active{background:rgba(255,255,255,.12)}
.container{padding:14px;max-width:1200px;margin:0 auto}
.grid{display:grid;gap:14px}@media(min-width:1000px){.cols-2{grid-template-columns:1fr 1fr}.cols-3{grid-template-columns:1fr 1fr 1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 0 #00000008;overflow:hidden}
.card h3{margin:0;padding:12px 14px 0;font-size:16px}.card .body{padding:10px 14px 14px}
table{width:100%;border-collapse:collapse}th,td{border-top:1px solid var(--line);padding:8px;text-align:left}
th{font-weight:600;color:var(--muted);background:#fafafa;position:sticky;top:0}
input,select,textarea{padding:8px;border:1px solid var(--line);border-radius:10px;outline:none;max-width:100%}
textarea{min-height:80px;width:100%}button{padding:8px 12px;border:0;border-radius:10px;background:#111;color:#fff;cursor:pointer}
button.ghost{background:#fff;color:#111;border:1px solid var(--line)}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.muted{color:var(--muted);font-size:12px}.pill{padding:2px 8px;border-radius:10px;border:1px solid var(--line);font-size:12px}
.pill.ok{border-color:#0a0;}
.badge{padding:2px 6px;border-radius:6px;font-size:12px}
.badge.sent{background:#fff;border:1px solid var(--line)}.badge.appr{background:#e8f5e9;color:#2e7d32}
.badge.mod{background:#fff3e0;color:#e65100}.badge.rej{background:#ffebee;color:#c62828}
ul{margin:0;padding-left:18px}.right{margin-left:auto}
small.code{font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background:#f0f0f0; padding:0 6px; border-radius:6px}
img.preview{max-width:120px;max-height:120px;border:1px solid var(--line);border-radius:8px}
`

function StyleInjector(){
  useEffect(()=>{
    const el = document.createElement('style')
    el.innerHTML = styles
    document.head.appendChild(el)
    return ()=>{ document.head.removeChild(el) }
  },[])
  return null
}

// ---------- App ----------
export default function App(){
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState('home')

  const [db, setDb] = useState(()=> loadDB(SEED))
  const applyingRemote = useRef(false)

  // bootstrap: carica da Supabase e merge con SEED
  useEffect(() => {
    (async () => {
      const remote = await loadRemoteDB(SEED)
      const safe = mergeDB(remote, SEED)
      applyingRemote.current = true
      setDb(safe)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // salvataggio locale + remoto (con guardia anti ping-pong)
  useEffect(() => {
    if (applyingRemote.current) {
      applyingRemote.current = false
      saveDB(db)
      if (typeof window !== 'undefined') { window._setDb = setDb }
      return
    }
    saveDB(db)
    saveRemoteDB(db)
    if (typeof window !== 'undefined') { window._setDb = setDb }
  }, [db])

  // Realtime: sincronizza in tempo reale tra dispositivi
  useEffect(() => {
    const ch = supabase
      .channel('app_state_watch')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.lemman' },
        payload => {
          const remote = payload.new?.state
          if (!remote) return
          applyingRemote.current = true
          setDb(prev => mergeDB(remote, prev ?? SEED))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // pulizia turni vecchi
  useEffect(()=>{
    const cw = weekStr(isoWeekInfo())
    setDb(prev => ({...prev, weeklyShifts: prev.weeklyShifts.filter(s => weekNum(s.week) >= weekNum(cw))}))
    // eslint-disable-next-line
  },[])

  const curWeek = weekStr(isoWeekInfo())
  const nextWeekStr = nextWeek(curWeek)
  const todayStr = today()
  const tomorrowStr = new Date(Date.now()+24*60*60*1000).toISOString().slice(0,10)

  const isResp = user?.role === 'Responsabile'
  const myName = user?.name

  const myTasksToday = useMemo(()=> db.tasks.filter(t => t.dip===myName && t.date===today()), [db.tasks, myName])
  const toggleTask = (id) => setDb(p => ({...p, tasks: p.tasks.map(t => t.id===id? {...t, done:!t.done} : t)}))

  const myShifts = useMemo(()=>{
    const cw = db.weeklyShifts.filter(s => s.dip===myName && s.week===curWeek)
    const nw = db.weeklyShifts.filter(s => s.dip===myName && s.week===nextWeek(curWeek))
    return { current: cw, next: nw }
  }, [db.weeklyShifts, myName, curWeek])

  const myReportsWeek = useMemo(()=>{
    const rep = db.reports.filter(r => r.dip===myName)
    return rep.filter(r => {
      const [y,m,d] = r.date.split('-').map(Number)
      const ws = weekStr(isoWeekInfo(new Date(y, m-1, d)))
      return ws === curWeek
    })
  }, [db.reports, myName, curWeek])

  function login(u,p){
    const f = USERS.find(x => x.username===u && x.pwd===p)
    if(!f) { alert('Credenziali errate'); return }
    setUser(f)
  }

  function NavLink({to, children}){
    return <a href="#" className={route===to?'active':''} onClick={(e)=>{e.preventDefault(); setRoute(to);}}>{children}</a>
  }

  return <>
    <StyleInjector/>
    <nav>
      <NavLink to="home">Home</NavLink>
      <NavLink to="turni">Turni</NavLink>
      <NavLink to="attivita">Attività</NavLink>
      <NavLink to="rapportini">Rapportini</NavLink>
      <NavLink to="bacheca">Bacheca</NavLink>
      {user?.role==='Responsabile' && <NavLink to="admin">Amministrazione</NavLink>}
      {user?.role==='Responsabile' && <NavLink to="dashboard">Dashboard</NavLink>}
      {user?.role==='Responsabile' && <NavLink to="report">Report</NavLink>}
      <span className="right"></span>
      {user && <button className="ghost" onClick={()=>setUser(null)}>Esci</button>}
    </nav>

    {!user ? <Login onLogin={login}/> :
      <div className="container">
        {route==='home' && <Home user={user} shifts={isResp ? db.weeklyShifts.filter(s=>{const w = s.week || weekStr(isoWeekInfo(new Date((s.startDate||s.endDate||'').slice(0,10) || today())));return w===curWeek || w===nextWeekStr;}) : db.weeklyShifts.filter(s=>s.dip===myName) } tasks={isResp ? db.tasks.filter(t=> t.date===todayStr || t.date===tomorrowStr) : db.tasks.filter(t=>t.dip===myName && t.date===todayStr)} posts={db.posts} notifications={db.notifications.filter(n=>n.to===myName).sort((a,b)=>b.ts-a.ts)} />}
        {route==='turni' && <Turni myShifts={myShifts} curWeek={curWeek} />}
        {route==='attivita' && <Attivita tasks={myTasksToday} onToggle={toggleTask} />}
        {route==='rapportini' && <Rapportini user={user} db={db} setDb={setDb} myReports={myReportsWeek} />}
        {route==='bacheca' && <Bacheca posts={db.posts} isResp={isResp} addPost={(t,b)=>setDb(p=>({...p, posts:[{id:uid(),title:t,body:b,author:user.name,ts:Date.now()}, ...p.posts]}))} />}
        {route==='admin' && isResp && <Admin db={db} setDb={setDb} />}
        {route==='dashboard' && isResp && <Dashboard db={db} curWeek={curWeek} />}
        {route==='report' && isResp && <ReportOre db={db} curWeek={curWeek} />}
      </div>
    }
  </>
}

// ---------- Components ----------
function Login({ onLogin }){
  const [u,setU]=useState(''); const [p,setP]=useState('')
  return <div className="grid cols-2" style={{alignItems:'start'}}>
    <div className="card"><h3>Accedi</h3><div className="body">
      <div className="row"><input placeholder="Username (es. responsabile)" value={u} onChange={e=>setU(e.target.value)} /></div>
      <div className="row"><input placeholder="Password (lemman)" type="password" value={p} onChange={e=>setP(e.target.value)} /></div>
      <div className="row"><button onClick={()=>onLogin(u,p)}>Entra</button><span className="muted">Demo: responsabile / lemman — mario.rossi / lemman</span></div>
    </div></div>
    <div className="card"><h3>Info</h3><div className="body"><div className="muted">Demo in memoria con salvataggio locale (offline-first).</div></div></div>
  </div>
}

function Home({ user, shifts, tasks, posts, notifications }){
  const isResp = user.role==='Responsabile'
  return <div className="grid cols-2">
    <div className="card"><h3>{isResp?'📊 Turni settimanali assegnati':'📅 Il mio turno (settimana)'}</h3><div className="body">
      {shifts.length===0? <div className="muted">Nessun turno.</div> :
        <table><thead><tr><th>Dipendente</th><th>Settimana</th><th>Orario</th><th>Sede</th></tr></thead><tbody>
          {shifts.map(s=>(<tr key={s.id}><td>{s.dip}</td><td>{s.week}</td><td>{s.hours}</td><td>{s.site||'—'}</td></tr>))}
        </tbody></table>
      }
    </div></div>

    <div className="card"><h3>📝 Attività</h3><div className="body">
      {tasks.length===0? <div className="muted">Nessuna attività.</div> :
        <ul>
          {tasks.map(t=> (
            <li key={t.id}>
              <input type="checkbox" checked={!!t.done} readOnly style={{marginRight:6}}/>
              {t.title} ({t.date}) {(t.done? "✓ Completata" : "⏳ Da fare")} {t.photo? <a href={t.photo} target="_blank" rel="noreferrer">[foto]</a> : null}
            </li>
          ))}
        </ul>
      }
    </div></div>

    {notifications && notifications.length>0 &&
      <div className="card" style={{gridColumn:'1 / -1'}}><h3>🔔 Notifiche</h3><div className="body">
        <ul>{notifications.map(n=> <li key={n.id}><b>{new Date(n.ts).toLocaleString('it-IT')}</b> — {n.text}</li>)}</ul>
      </div></div>
    }

    <div className="card" style={{gridColumn:'1 / -1'}}><h3>📢 Bacheca</h3><div className="body">
      {posts.length===0? <div className="muted">Nessuna comunicazione.</div> :
        <ul>{posts.map(p=> <li key={p.id}><b>{p.title}</b> — {p.body} <span className="muted">({new Date(p.ts).toLocaleString('it-IT')})</span></li>)}</ul>
      }
    </div></div>
  </div>
}

function Turni({ myShifts }){
  return <div className="card"><h3>Turni</h3><div className="body">
      {myShifts.current.length===0 && myShifts.next.length===0 ? <div className="muted">Nessun turno.</div> :
        <>
          <h4>Settimana corrente</h4>
          <table><thead><tr><th>Periodo</th><th>Orario</th><th>Sede</th></tr></thead><tbody>
            {myShifts.current.map(s => {
              const period = s.startDate && s.endDate ? `${s.startDate} → ${s.endDate}` : (s.week || '—')
              return <tr key={s.id}><td>{period}</td><td>{s.hours}</td><td>{s.site||'—'}</td></tr>
            })}
          </tbody></table>
          <h4>Prossima settimana</h4>
          <table><thead><tr><th>Periodo</th><th>Orario</th><th>Sede</th></tr></thead><tbody>
            {myShifts.next.map(s => {
              const period = s.startDate && s.endDate ? `${s.startDate} → ${s.endDate}` : (s.week || '—')
              return <tr key={s.id}><td>{period}</td><td>{s.hours}</td><td>{s.site||'—'}</td></tr>
            })}
          </tbody></table>
        </>
      }
    </div></div>
}

function Attivita({ tasks, onToggle }){
  return <div className="card"><h3>Le mie attività di oggi</h3><div className="body">
    {tasks.length===0? <div className="muted">Nessuna attività.</div> :
      <ul>{tasks.filter(t=>!t.done).map(t=> <li key={t.id}>
        <label><input type="checkbox" checked={!!t.done} onChange={()=>onToggle(t.id)} /> {t.title} ({t.date})</label>
        {t.photo && <> <a href={t.photo} target="_blank" rel="noreferrer">[foto]</a></>}
      </li>)}</ul>}
  </div></div>
}

function Rapportini({ user, db, setDb, myReports }){
  const [date,setDate]=useState(today()),
        [commessaId,setCommessaId]=useState(''),
        [posizioneId,setPosizioneId]=useState(''),
        [ore,setOre]=useState(8),
        [site,setSite]=useState(''),
        [descr,setDescr]=useState(''),
        [photos,setPhotos]=useState([])

  const commessaSel = db.commesse.find(c=>c.id===commessaId) || null
  const posOpts = commessaSel?.posizioni || []
  const siteLocked = !!commessaSel?.boundSite && commessaSel.lockSite

  useEffect(()=>{ if (commessaSel?.boundSite) setSite(commessaSel.boundSite) }, [commessaId])

  async function onPickPhoto(e){
    const f = e.target.files && e.target.files[0]
    if (!f) return
    try {
      const dataUrl = await readImageAsDataURL(f)
      setPhotos(p => [...p, dataUrl])
    } catch { alert('Errore lettura foto') }
    e.target.value = ''
  }

  function send(){
    if(!commessaId || !posizioneId || !descr.trim() || (!site && !siteLocked))
      return alert('Compila commessa, posizione, cantiere e descrizione.')
    const payload = {
      id: uid(), date, dip: user.name, commessaId, posizioneId,
      ore: Number(ore)||0, site: siteLocked? (commessaSel.boundSite||'') : site,
      descr: descr.trim(), stato: 'Inviato', noteResp: '', photos: [...photos]
    }
    setDb(prev => ({...prev, reports: [payload, ...prev.reports]}))
    setOre(8); setSite(''); setDescr(''); setPhotos([])
  }

  return <div className="grid cols-2">
    <div className="card"><h3>Nuovo rapportino</h3><div className="body">
      <div className="row"><label>Data</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
      <div className="row"><label>Ore</label><input type="number" min="0" max="24" value={ore} onChange={e=>setOre(e.target.value)} /></div>
      <div className="row"><label>Commessa</label>
        <select value={commessaId} onChange={e=>{setCommessaId(e.target.value); setPosizioneId('')}}>
          <option value="">— seleziona —</option>
          {db.commesse.filter(c=>c.active).map(c=> <option key={c.id} value={c.id}>{c.code} — {c.desc}</option>)}
        </select>
      </div>
      <div className="row"><label>Posizione</label>
        <select value={posizioneId} onChange={e=>setPosizioneId(e.target.value)} disabled={!commessaId}>
          <option value="">— seleziona —</option>
          {posOpts.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="row"><label>Cantiere</label>
        <select value={site} onChange={e=>setSite(e.target.value)} disabled={siteLocked}>
          <option value="">— seleziona cantiere —</option>
          {db.cantieri.map(k=> <option key={k.id} value={k.name}>{k.name}</option>)}
        </select>
        {siteLocked && <span className="pill">vincolato da commessa</span>}
      </div>
      <div className="row" style={{flex:'1 1 100%'}}><label>Descrizione</label><textarea value={descr} onChange={e=>setDescr(e.target.value)} placeholder="Dettagli attività" /></div>
      <div className="row"><label>Foto (scatta o carica)</label>
        <input type="file" accept="image/*" capture="environment" onChange={onPickPhoto} />
        {photos.map((ph,i)=><img className="preview" src={ph} alt={"foto"+i} key={i} />)}
      </div>
      <div className="row"><button onClick={send}>Invia</button><span className="muted">Le foto restano nel rapportino.</span></div>
    </div></div>

    <div className="card"><h3>Storico miei rapportini (settimana corrente)</h3><div className="body">
      {myReports.length===0? <div className="muted">Ancora nessun rapportino per questa settimana.</div> :
        <div style={{overflowX:"auto"}}><table style={{minWidth:1200}}><thead><tr><th>Data</th><th>Commessa</th><th>Posizione</th><th>Cantiere</th><th>Ore</th><th>Stato</th><th>Foto</th></tr></thead><tbody>
          {myReports.map(r=>{
            const comm = db.commesse.find(c=>c.id===r.commessaId)?.code || '—'
            const pos = db.commesse.flatMap(c=>c.posizioni).find(p=>p.id===r.posizioneId)?.name || '—'
            const badge = r.stato==='Approvato'?'appr':r.stato==='Modificato'?'mod':r.stato==='Respinto'?'rej':'sent'
            return (<tr key={r.id}>
              <td>{r.date}</td><td>{comm}</td><td>{pos}</td><td>{r.site||'—'}</td><td>{r.ore}</td>
              <td><span className={'badge '+badge}>{r.stato}</span></td>
              <td>{(r.photos||[]).length? r.photos.map((p,i)=><img className="preview" src={p} alt={'p'+i} key={i}/>) : '—'}</td>
            </tr>)
          })}
        </tbody></table></div>
      }
    </div></div>
  </div>
}

function Bacheca({ posts, isResp, onAdd }){
  const [t,setT]=useState(''); const [b,setB]=useState('')
  const [editId,setEditId]=useState(null)
  const [eTitle,setETitle]=useState('')
  const [eBody,setEBody]=useState('')

  const canManage = isResp && typeof window !== 'undefined' && typeof window._setDb === 'function'

  function doAdd(){
    if(!t.trim() || !b.trim()) return
    onAdd(t,b); setT(''); setB('')
  }
  function delPost(id){
    if(!canManage) return
    window._setDb(p => ({...p, posts: p.posts.filter(x=>x.id!==id)}))
  }
  function startEdit(p){
    setEditId(p.id); setETitle(p.title); setEBody(p.body)
  }
  function saveEdit(){
    if(!canManage || !editId) return
    window._setDb(p => ({...p, posts: p.posts.map(x=> x.id===editId ? {...x, title:eTitle, body:eBody} : x)}))
    setEditId(null); setETitle(''); setEBody('')
  }

  return <div className="grid cols-2">
    {isResp && (<div className="card"><h3>Nuova comunicazione</h3><div className="body">
      <input placeholder="Titolo" value={t} onChange={e=>setT(e.target.value)} />
      <textarea placeholder="Testo" value={b} onChange={e=>setB(e.target.value)} />
      <button onClick={doAdd}>Pubblica</button>
    </div></div>)}

    <div className="card" style={{gridColumn:'1 / -1'}}><h3>Comunicazioni</h3><div className="body">
      {posts.length===0? <div className="muted">Nessuna comunicazione.</div> :
        <ul>
          {posts.map(p => <li key={p.id} style={{marginBottom:10}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
              <div>
                <b>{p.title}</b> <span className="muted">({new Date(p.ts).toLocaleString('it-IT')})</span>
                <div>{p.body}</div>
              </div>
              {canManage &&
                <div className="row">
                  <button className="ghost" onClick={()=>startEdit(p)}>Modifica</button>
                  <button onClick={()=>delPost(p.id)}>Elimina</button>
                </div>
              }
            </div>
          </li>)}
        </ul>
      }
      {canManage && editId &&
        <div style={{marginTop:12, padding:12, border:'1px solid var(--line)', borderRadius:10, background:'#fafafa'}}>
          <div className="row"><b>Modifica comunicazione</b></div>
          <input placeholder="Titolo" value={eTitle} onChange={e=>setETitle(e.target.value)} />
          <textarea placeholder="Testo" value={eBody} onChange={e=>setEBody(e.target.value)} />
          <div className="row">
            <button onClick={saveEdit}>Salva</button>
            <button className="ghost" onClick={()=>{setEditId(null); setETitle(''); setEBody('');}}>Annulla</button>
          </div>
        </div>
      }
    </div></div>
  </div>
}

// ---------------- Amministrazione ----------------
function Admin({ db, setDb }){
  // --- State: commesse ---
  const [newCommCode,setNewCommCode]=useState('')
  const [newCommDesc,setNewCommDesc]=useState('')
  const [newBoundSite,setNewBoundSite]=useState('')
  const [newLock,setNewLock]=useState(true)

  // --- State: posizioni ---
  const [posCommessaId,setPosCommessaId]=useState('')
  const [posName,setPosName]=useState('')

  // --- State: task/attività ---
  const [tDip,setTDip]=useState('')
  const [tDate,setTDate]=useState(today())
  const [tTitle,setTTitle]=useState('')
  const [tPhoto,setTPhoto]=useState('')

  // --- State: rapportini moderation ---
  const [rFilterDip,setRFilterDip]=useState('')
  const [rFilterState,setRFilterState]=useState('inviato') // tutti | inviati | approvati | respinti
  const [rNote,setRNote]=useState('') // richiesta motivazione quando respingi
  const [editId,setEditId]=useState(null)
  const [editHours,setEditHours]=useState('')
  const [editDesc,setEditDesc]=useState('')

  // --- State: turni ---
  const [wWeek,setWWeek]=useState(weekStr(isoWeekInfo()))
  const [wStart,setWStart]=useState('')
  const [wEnd,setWEnd]=useState('')
  const derivedWeek = useMemo(()=>{
    const d = wStart || wEnd || ''
    if(!d) return wWeek
    try { return weekStr(isoWeekInfo(new Date(d))) } catch(e){ return wWeek }
  }, [wStart, wEnd, wWeek])
  const [wDip,setWDip]=useState('')
  const [wHours,setWHours]=useState('08:00–17:00')
  const [wSite,setWSite]=useState('')

  const usersDip = USERS.filter(u=>u.role==='Dipendente')

  function addComm(){
    if(!newCommCode.trim()) return
    setDb(p => ({
      ...p,
      commesse: [...p.commesse, {
        id: uid(),
        code: newCommCode.trim(),
        desc: newCommDesc.trim(),
        boundSite: newBoundSite || '',
        lockSite: !!newLock,
        active: true,
        posizioni: []
      }]
    }))
    setNewCommCode(''); setNewCommDesc(''); setNewBoundSite(''); setNewLock(true)
  }
  function toggleCommessaActive(cid){
    setDb(p => ({ ...p, commesse: p.commesse.map(c => c.id===cid ? {...c, active: !c.active} : c) }))
  }
  function delCommessa(cid){
    if(!confirm('Eliminare la commessa? I rapportini collegati perderanno il riferimento.')) return
    setDb(p => ({
      ...p,
      commesse: p.commesse.filter(c => c.id!==cid),
      reports: p.reports.map(r => (r.commessaId===cid ? {...r, commessaId:'', posizioneId:''} : r))
    }))
  }
  function addPosizione(){
    if(!posCommessaId || !posName.trim()) return
    setDb(p => ({
      ...p,
      commesse: p.commesse.map(c => c.id===posCommessaId ? {
        ...c,
        posizioni: [...(c.posizioni||[]), { id: uid(), name: posName.trim() }]
      } : c)
    }))
    setPosName('')
  }
  function delPosizione(cid, pid){
    setDb(p => ({
      ...p,
      commesse: p.commesse.map(c => c.id===cid ? {...c, posizioni: c.posizioni.filter(pp => pp.id!==pid)} : c),
      reports: p.reports.map(r => (r.posizioneId===pid ? {...r, posizioneId:''} : r))
    }))
  }

  // Rapportini moderation
  function approveReport(id){
    setDb(p => ({...p, reports: p.reports.map(r => r.id===id ? {...r, state:'approvato', note:''} : r)}))
  }
  function rejectReport(id){
    const note = prompt('Motivo del rifiuto (obbligatorio):', rNote||'')
    if(!note || !note.trim()) return
    setDb(p => ({...p, reports: p.reports.map(r => r.id===id ? {...r, state:'respinto', note:note.trim()} : r)}))
    setRNote('')
  }
  function startEdit(r){
    setEditId(r.id); setEditHours(String(r.hours||r.ore||'8')); setEditDesc(r.desc||r.descr||'')
  }
  function saveEdit(id){
    setDb(p => ({...p, reports: p.reports.map(r => r.id===id ? {...r, hours: Number(editHours)||0, desc: editDesc} : r)}))
    setEditId(null); setEditHours(''); setEditDesc('')
  }

  const rapFiltered = db.reports
    .filter(r => !rFilterDip || r.dip===rFilterDip)
    .filter(r => rFilterState==='tutti' ? true : r.state===rFilterState)
    .sort((a,b)=> (a.date||'').localeCompare(b.date||''))

  function addShift(){
    if(!wDip || !wWeek) return
    setDb(p => ({...p, weeklyShifts: [{ id: uid(), dip: wDip, week: derivedWeek, startDate:wStart||undefined, endDate:wEnd||undefined, hours: wHours, site: wSite }, ...p.weeklyShifts]}))
    setWDip(''); setWSite('')
  }
  function delShift(id){
    setDb(p => ({...p, weeklyShifts: p.weeklyShifts.filter(s => s.id!==id)}))
  }
  const shiftsWeek = db.weeklyShifts.filter(s => s.week===wWeek)

  return <div className="grid cols-2">
    <div className="card">
      <h3>Nuova commessa</h3>
      <div className="body">
        <div className="row">
          <input placeholder="Codice" value={newCommCode} onChange={e=>setNewCommCode(e.target.value)} />
          <input placeholder="Descrizione" value={newCommDesc} onChange={e=>setNewCommDesc(e.target.value)} />
          <input placeholder="Cantiere vincolato (opz.)" value={newBoundSite} onChange={e=>setNewBoundSite(e.target.value)} />
          <label className="row"><input type="checkbox" checked={newLock} onChange={e=>setNewLock(e.target.checked)} />Blocca cantiere</label>
          <button onClick={addComm}>Aggiungi</button>
        </div>
      </div>
    </div>

    <div className="card">
      <h3>Gestione commesse</h3>
      <div className="body">
        {db.commesse.length===0 ? <div className="muted">Nessuna commessa.</div> :
          <table>
            <thead><tr><th>Codice</th><th>Descrizione</th><th>Cantiere</th><th>Blocco</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              {db.commesse.map(c => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>{c.desc||'—'}</td>
                  <td>{c.boundSite||'—'}</td>
                  <td>{c.lockSite?'bloccato':'—'}</td>
                  <td>{c.active? <span className="pill ok">attiva</span> : <span className="pill">disattiva</span>}</td>
                  <td>
                    <button className="ghost" onClick={()=>toggleCommessaActive(c.id)}>{c.active?'Disattiva':'Attiva'}</button>
                    <button onClick={()=>delCommessa(c.id)}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>

    <div className="card">
      <h3>Posizioni di commessa</h3>
      <div className="body">
        <div className="row">
          <select value={posCommessaId} onChange={e=>setPosCommessaId(e.target.value)}>
            <option value="">— seleziona commessa —</option>
            {db.commesse.map(c => <option key={c.id} value={c.id}>{c.code} — {c.desc}</option>)}
          </select>
          <input placeholder="Nome posizione" value={posName} onChange={e=>setPosName(e.target.value)} />
          <button onClick={addPosizione}>Aggiungi posizione</button>
        </div>
        {posCommessaId && (()=>{
          const c = db.commesse.find(x=>x.id===posCommessaId)
          return c && c.posizioni && c.posizioni.length>0 ?
            <table><thead><tr><th>Posizione</th><th>Azioni</th></tr></thead><tbody>
              {c.posizioni.map(p => <tr key={p.id}><td>{p.name}</td><td><button onClick={()=>delPosizione(c.id, p.id)}>Rimuovi</button></td></tr>)}
            </tbody></table>
            : <div className="muted">Nessuna posizione per questa commessa.</div>
        })()}
      </div>
    </div>

    <div className="card" style={{gridColumn:'1 / -1'}}>
      <h3>Rapportini dipendenti</h3>
      <div className="body">
        <div className="row">
          <select value={rFilterDip} onChange={e=>setRFilterDip(e.target.value)}>
            <option value="">Tutti i dipendenti</option>
            {usersDip.map(u=> <option key={u.username} value={u.name}>{u.name}</option>)}
          </select>
          <select value={rFilterState} onChange={e=>setRFilterState(e.target.value)}>
            <option value="tutti">Stato: tutti</option>
            <option value="inviato">Inviati</option>
            <option value="approvato">Approvati</option>
            <option value="respinto">Respinti</option>
          </select>
        </div>
        {rapFiltered.length===0? <div className="muted">Nessun rapportino trovato.</div> :
          <div style={{overflowX:"auto", overflowY:"hidden"}}><table style={{minWidth:1200}}><thead>
            <tr><th>Data</th><th>Dipendente</th><th>Commessa</th><th>Posizione</th><th>Ore</th><th>Descrizione</th><th>Stato</th><th>Azioni</th></tr>
          </thead><tbody>
            {rapFiltered.map(r => {
              const c = db.commesse.find(x=>x.id===r.commessaId)
              const pos = c?.posizioni?.find(p=>p.id===r.posizioneId)
              const isEditing = editId===r.id
              return <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.dip}</td>
                <td>{c? c.code : '—'}</td>
                <td>{pos? pos.name : '—'}</td>
                <td>{isEditing ? <input value={editHours} onChange={e=>setEditHours(e.target.value)} style={{width:60}}/> : (r.hours||r.ore||0)}</td>
                <td>{isEditing ? <input value={editDesc} onChange={e=>setEditDesc(e.target.value)} /> : (r.desc||r.descr||'')}</td>
                <td>{r.state||'inviato'}</td>
                <td className="row" style={{gap:6}}>
                  {!isEditing ? <button className="ghost" onClick={()=>startEdit(r)}>Modifica</button> : <button onClick={()=>saveEdit(r.id)}>Salva</button>}
                  <button className="ghost" onClick={()=>approveReport(r.id)}>Approva</button>
                  <button onClick={()=>rejectReport(r.id)}>Respingi</button>
                </td>
              </tr>
            })}
          </tbody></table></div>
        }
      </div>
    </div>

    <div className="card">
      <h3>Turni</h3>
      <div className="body">
        <div className="row">
          <span className="pill">Settimana: {derivedWeek}</span>
          <input type="date" value={wStart||""} onChange={e=>{const v=e.target.value; setWStart(v); try{ setWWeek(weekStr(isoWeekInfo(new Date(v)))); }catch(_){}}} placeholder="Inizio" />
          <input type="date" value={wEnd||""} onChange={e=>{const v=e.target.value; setWEnd(v); try{ setWWeek(weekStr(isoWeekInfo(new Date(v)))); }catch(_){}}} placeholder="Fine" />
          <select value={wDip} onChange={e=>setWDip(e.target.value)}>
            <option value="">— dipendente —</option>
            {usersDip.map(u=> <option key={u.username} value={u.name}>{u.name}</option>)}
          </select>
          <input value={wHours} onChange={e=>setWHours(e.target.value)} placeholder="08:00–17:00" />
          <input value={wSite} onChange={e=>setWSite(e.target.value)} placeholder="Sede/Cantiere" />
          <button onClick={addShift}>Aggiungi turno</button>
        </div>
        {shiftsWeek.length===0? <div className="muted">Nessun turno impostato per {wWeek}.</div> :
          <table><thead><tr><th>Dipendente</th><th>Settimana</th><th>Orario</th><th>Sede</th><th></th></tr></thead><tbody>
            {shiftsWeek.map(s => <tr key={s.id}><td>{s.dip}</td><td>{s.week}</td><td>{s.hours}</td><td>{s.site||'—'}</td><td><button onClick={()=>delShift(s.id)}>Rimuovi</button></td></tr>)}
          </tbody></table>
        }
      </div>
    </div>

    <div className="card">
      <h3>Assegna attività (opzionale)</h3>
      <div className="body">
        <div className="row">
          <select value={tDip} onChange={e=>setTDip(e.target.value)}>
            <option value="">— scegli dipendente —</option>
            {usersDip.map(u=> <option key={u.username} value={u.name}>{u.name}</option>)}
          </select>
          <input type="date" value={tDate} onChange={e=>setTDate(e.target.value)} />
          <input placeholder="Titolo attività" value={tTitle} onChange={e=>setTTitle(e.target.value)} />
          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files&&e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=ev=>setTPhoto(String(ev.target.result)); rd.readAsDataURL(f);}} />
          <button onClick={()=>{
            if(!tDip || !tTitle.trim()) return;
            setDb(p => ({...p, tasks: [{id:uid(), dip:tDip, date:tDate, title:tTitle.trim(), photo:tPhoto||'' , done:false}, ...p.tasks]}));
            setTDip(''); setTTitle(''); setTPhoto('');
          }}>Assegna</button>
        </div>
        <div className="muted">Le attività assegnate sono visibili nella Home del dipendente selezionato.</div>
      </div>
    </div>
  </div>
}

// ---------------- Dashboard (Responsabile) ----------------
function Dashboard({ db, curWeek }){
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7))
  const [fDip,setFDip]=useState('')
  const [fComm,setFComm]=useState('')
  const dips=[...new Set(db.reports.map(r=>r.dip))].filter(Boolean)
  const comms=db.commesse

  const filt = db.reports.filter(r=>{
    const [y,m,d]=r.date.split('-').map(Number)
    const ws = weekStr(isoWeekInfo(new Date(y, m-1, d)))
    return ws===curWeek && (!fDip || r.dip===fDip) && (!fComm || r.commessaId===fComm)
  })

  const sum = (arr,fn)=> arr.reduce((s,x)=> s+(fn(x)||0), 0)
  const oreTot = sum(filt, r=>Number(r.hours||r.ore||r.h||0)||0)

  const byDip = {}
  const byComm = {}
  filt.forEach(r=>{
    byDip[r.dip]=(byDip[r.dip]||0)+(Number(r.hours||r.ore||0)||0)
    byComm[r.commessaId]=(byComm[r.commessaId]||0)+(Number(r.hours||r.ore||0)||0)
  })
  const commName = id => {
    const c = comms.find(x=>x.id===id)
    return c ? (c.code + (c.desc? ' — '+c.desc : '')) : '—'
  }
  const maxDip = Math.max(1, ...Object.values(byDip))
  const maxComm = Math.max(1, ...Object.values(byComm))

  const Bar = ({value,max}) => <div style={{background:'#f2f2f2',border:'1px solid var(--line)',borderRadius:10}}>
    <div style={{height:10,width: `${Math.round((value/max)*100)}%`}} />
  </div>

  return <div className="grid cols-2">
    <div className="card"><h3>Filtri (settimana {curWeek})</h3><div className="body">
      <div className="row">
        <select value={fDip} onChange={e=>setFDip(e.target.value)}>
          <option value="">Tutti i dipendenti</option>
          {dips.map(d=> <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={fComm} onChange={e=>setFComm(e.target.value)}>
          <option value="">Tutte le commesse</option>
          {comms.map(c=> <option key={c.id} value={c.id}>{c.code} — {c.desc}</option>)}
        </select>
        <div className="muted">Totale ore: <b>{oreTot}</b></div>
      </div>
    </div></div>

    <div className="card"><h3>Ore per dipendente</h3><div className="body">
      {Object.keys(byDip).length===0? <div className="muted">Nessun dato.</div> :
        <table><thead><tr><th>Dipendente</th><th>Ore</th><th style={{width:220}}>Grafico</th></tr></thead><tbody>
          {Object.entries(byDip).map(([k,v])=> <tr key={k}><td>{k}</td><td>{v}</td><td><Bar value={v} max={maxDip} /></td></tr>)}
        </tbody></table>}
    </div></div>

    <div className="card"><h3>Ore per commessa</h3><div className="body">
      {Object.keys(byComm).length===0? <div className="muted">Nessun dato.</div> :
        <table><thead><tr><th>Commessa</th><th>Ore</th><th style={{width:220}}>Grafico</th></tr></thead><tbody>
          {Object.entries(byComm).map(([k,v])=> <tr key={k}><td>{commName(k)}</td><td>{v}</td><td><Bar value={v} max={maxComm} /></td></tr>)}
        </tbody></table>}
    </div></div>

    <div className="card"><h3>Ore per dipendente (mese {month})</h3><div className="body">{
      (()=>{
        const filt=db.reports.filter(r=>r.date && r.date.slice(0,7)===month)
        const agg={}; filt.forEach(r=>{agg[r.dip]=(agg[r.dip]||0)+(Number(r.hours||r.ore||0)||0)})
        const max=Math.max(1,...Object.values(agg))
        const Bar=({value,max})=> <div style={{background:'#f2f2f2',border:'1px solid var(--line)',borderRadius:10}}><div style={{height:10,width:`${Math.round((value/max)*100)}%`}}/></div>
        return Object.keys(agg).length===0? <div className="muted">Nessun dato nel mese selezionato.</div> :
          <><div className="row"><input type="month" value={month} onChange={e=>setMonth(e.target.value)} /></div>
          <table><thead><tr><th>Dipendente</th><th>Ore</th><th style={{width:220}}>Grafico</th></tr></thead><tbody>
            {Object.entries(agg).map(([k,v])=> <tr key={k}><td>{k}</td><td>{v}</td><td><Bar value={v} max={max} /></td></tr>)}
          </tbody></table></>
      )()
    }</div></div>
  </div>
}

// ---------------- ReportOre (Responsabile) ----------------
function ReportOre({ db, curWeek }){
  const [fComm,setFComm]=useState('')
  const [fPos,setFPos]=useState('')

  const comm = db.commesse
  const curCom = comm.find(c=>c.id===fComm)
  const posList = curCom?.posizioni||[]

  const rows = []
  for(const c of comm){
    const positions = c.posizioni || []
    if(positions.length===0){
      const tot = db.reports.filter(r => r.commessaId===c.id).filter(r=>{
        const [y,m,d] = r.date.split('-').map(Number)
        const ws = weekStr(isoWeekInfo(new Date(y, m-1, d)))
        return ws===curWeek
      }).reduce((s,r)=> s + (Number(r.hours||r.ore||r.h||0)||0), 0)
      rows.push({ key: c.id+'_none', commessa: c.code, posizione: '—', ore: tot })
    } else {
      for(const p of positions){
        const tot = db.reports.filter(r => r.commessaId===c.id && r.posizioneId===p.id).filter(r=>{
          const [y,m,d] = r.date.split('-').map(Number)
          const ws = weekStr(isoWeekInfo(new Date(y, m-1, d)))
          return ws===curWeek
        }).reduce((s,r)=> s + (Number(r.hours||r.ore||r.h||0)||0), 0)
        rows.push({ key: c.id+'_'+p.id, commessaId:c.id, posId:p.id, commessa: c.code, posizione: p.name, ore: tot })
      }
    }
  }
  rows.sort((a,b)=> a.commessa.localeCompare(b.commessa) || a.posizione.localeCompare(b.posizione))

  const details = db.reports
    .filter(r => !fComm || r.commessaId===fComm)
    .filter(r => !fPos || r.posizioneId===fPos)
    .sort((a,b)=> (a.date||'').localeCompare(b.date||''))

  return <div className="grid cols-2">
    <div className="card"><h3>Report ore (settimana {curWeek})</h3><div className="body">
      {rows.length===0? <div className="muted">Nessun dato.</div> :
        <table><thead><tr><th>Commessa</th><th>Posizione</th><th>Ore totali</th><th></th></tr></thead><tbody>
          {rows.map(r => <tr key={r.key}><td>{r.commessa}</td><td>{r.posizione}</td><td>{r.ore}</td>
            <td><button className="ghost" onClick={()=>{ setFComm(r.commessaId||''); setFPos(r.posId||''); }}>Dettagli</button></td></tr>)}
        </tbody></table>}
      <div className="row" style={{marginTop:8}}>
        <select value={fComm} onChange={e=>{setFComm(e.target.value); setFPos('')}}>
          <option value="">— commessa —</option>
          {comm.map(c=> <option key={c.id} value={c.id}>{c.code} — {c.desc}</option>)}
        </select>
        <select value={fPos} onChange={e=>setFPos(e.target.value)} disabled={!fComm}>
          <option value="">— posizione —</option>
          {posList.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </div></div>

    <div className="card"><h3>Dettaglio rapportini</h3><div className="body">
      {details.length===0? <div className="muted">Seleziona una commessa/posizione per vedere i rapportini in ordine giornaliero.</div> :
        <table><thead><tr><th>Data</th><th>Dipendente</th><th>Ore</th><th>Descrizione</th></tr></thead><tbody>
          {details.map(r => <tr key={r.id}><td>{r.date}</td><td>{r.dip}</td><td>{r.hours||r.ore||0}</td><td>{r.desc||r.descr||''}</td></tr>)}
        </tbody></table>}
    </div></div>
  </div>
}
