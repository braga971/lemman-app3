import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'
import Login from './Login.jsx'
import { mergeDB } from './utils.js'
import { loadRemoteDB, saveRemoteDB } from './persist.js'
import { listCommesse, createCommessa, deleteCommessa } from './api/commesse.js'
import { listPosizioni, createPosizione, deletePosizione } from './api/posizioni.js'
import { listRapportini, createRapportino, updateRapportino, deleteRapportino } from './api/rapportini.js'
import { exportCSV } from './utils.js'
import './styles.css'

const SEED = { commesse:[], posizioni:[], reports:[] }

export default function App(){
  const [user, setUser] = useState(null)
  const [db, setDb] = useState(SEED)
  const applyingRemote = useRef(false)

  // auth
  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>setUser(data.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session)=> setUser(session?.user ?? null))
    return ()=> sub.subscription.unsubscribe()
  }, [])

  // initial load & realtime
  useEffect(()=>{
    (async()=>{
      const remote = await loadRemoteDB(SEED)
      applyingRemote.current = TrueFixFalse(false) // helper inline to avoid lints
      setDb(prev=>mergeDB(remote, prev ?? SEED))
      applyingRemote.current = false
      await refetchAll()
    })()

    const chState = supabase.channel('app_state_watch')
      .on('postgres_changes', { event:'*', schema:'public', table:'app_state', filter:'key=eq.lemman' }, p => {
        const remote = p.new?.state; if (!remote) return
        applyingRemote.current = true
        setDb(prev=>mergeDB(remote, prev ?? SEED))
        applyingRemote.current = false
      }).subscribe()

    const chData = supabase.channel('data_watch')
      .on('postgres_changes', { event:'*', schema:'public', table:'commesse' }, ()=>refetchAll())
      .on('postgres_changes', { event:'*', schema:'public', table:'posizioni' }, ()=>refetchAll())
      .on('postgres_changes', { event:'*', schema:'public', table:'rapportini' }, ()=>refetchAll())
      .subscribe()

    async function refetchAll(){
      const [C,P,R] = await Promise.all([listCommesse(), listPosizioni(), listRapportini()])
      setDb(prev => ({ ...prev, commesse:C, posizioni:P, reports:R }))
    }

    return ()=>{
      supabase.removeChannel(chState)
      supabase.removeChannel(chData)
    }
  }, [])

  // persist app_state when db changes
  const dbRef = useRef(db)
  useEffect(()=>{ dbRef.current = db }, [db])
  useEffect(()=>{
    if (applyingRemote.current) return
    saveRemoteDB(()=>dbRef.current)
  }, [db])

  if (!user) return <Login />

  return (
    <div className="grid" style={{ padding:16 }}>
      <Header user={user} onExport={()=>exportCSV(db.reports, db)} />
      <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', alignItems:'start' }}>
        <section className="card">
          <h3>Commesse</h3>
          <Commesse db={db} />
        </section>
        <section className="card">
          <h3>Posizioni</h3>
          <Posizioni db={db} />
        </section>
        <section className="card" style={{ gridColumn:'1 / span 2' }}>
          <h3>Rapportini</h3>
          <Rapportini db={db} user={user} />
        </section>
      </div>
    </div>
  )
}

// tiny inline helper to keep earlier comment intact
function TrueFixFalse(v){ return v }

function Header({ user, onExport }){
  return (
    <div className="row" style={{ justifyContent:'space-between' }}>
      <h1>Lemman • Gestionale</h1>
      <div className="row">
        <button className="badge" onClick={onExport} title="Esporta CSV">Export CSV</button>
        <span className="small">{user?.email}</span>
        <button onClick={()=>supabase.auth.signOut()}>Logout</button>
      </div>
    </div>
  )
}

function Commesse({ db }){
  const [code, setCode] = useState('')
  const [cliente, setCliente] = useState('')
  const [err, setErr] = useState('')

  async function crea(){
    try{
      await createCommessa({ code, cliente })
      setCode(''); setCliente('')
    }catch(e){ setErr(e.message) }
  }
  async function del(id){ await deleteCommessa(id) }

  return (
    <div className="grid">
      <div className="row">
        <input placeholder="Codice" value={code} onChange={e=>setCode(e.target.value)} />
        <input placeholder="Cliente" value={cliente} onChange={e=>setCliente(e.target.value)} />
        <button disabled={!code} onClick={crea}>Crea</button>
      </div>
      {err && <small style={{color:'crimson'}}>{err}</small>}
      <ul>
        {db.commesse?.map(c => (
          <li key={c.id} className="row" style={{ justifyContent:'space-between' }}>
            <span><strong>{c.code}</strong>{c.cliente ? ` • ${c.cliente}`:''}</span>
            <button onClick={()=>del(c.id)}>Elimina</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Posizioni({ db }){
  const [commessaId, setCommessaId] = useState('')
  const [name, setName] = useState('')
  const [valore, setValore] = useState('')

  async function crea(){
    await createPosizione({ commessa_id: commessaId, name, valore })
    setName(''); setValore('')
  }
  async function del(id){ await deletePosizione(id) }

  const posByC = useMemo(()=>{
    const m = {}
    for (const p of (db.posizioni||[])) { (m[p.commessa_id] ||= []).push(p) }
    return m
  }, [db.posizioni])

  return (
    <div className="grid">
      <div className="row">
        <select value={commessaId} onChange={e=>setCommessaId(e.target.value)}>
          <option value="">Commessa…</option>
          {db.commesse?.map(c=> <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <input placeholder="Posizione" value={name} onChange={e=>setName(e.target.value)} />
        <input placeholder="Valore (€)" value={valore} onChange={e=>setValore(e.target.value)} />
        <button disabled={!commessaId || !name} onClick={crea}>Aggiungi</button>
      </div>

      {db.commesse?.map(c => (
        <div key={c.id} style={{ borderTop:'1px solid #eee', paddingTop:6 }}>
          <strong>{c.code}</strong>
          <ul>
            {posByC[c.id]?.map(p => (
              <li key={p.id} className="row" style={{ justifyContent:'space-between' }}>
                <span>{p.name}{p.valore ? ` • €${p.valore}`:''}</span>
                <button onClick={()=>del(p.id)}>Rimuovi</button>
              </li>
            )) || <em>Nessuna posizione</em>}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Rapportini({ db, user }){
  const [commessa, setCommessa] = useState('')
  const [posizione, setPosizione] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0,10))
  const [ore, setOre] = useState('')
  const [descrizione, setDescrizione] = useState('')

  const posFilt = db.posizioni?.filter(p => p.commessa_id === commessa) ?? []

  async function crea(){
    await createRapportino({ data, commessa_id: commessa, posizione_id: posizione, ore, descrizione })
    setDescrizione(''); setOre('')
  }
  async function change(id, stato){ await updateRapportino(id, { stato }) }
  async function del(id){ await deleteRapportino(id) }

  return (
    <div className="grid">
      <div className="row" style={{ flexWrap:'wrap' }}>
        <input type="date" value={data} onChange={e=>setData(e.target.value)} />
        <select value={commessa} onChange={e=>{setCommessa(e.target.value); setPosizione('')}}>
          <option value="">Commessa…</option>
          {db.commesse?.map(c=> <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <select value={posizione} onChange={e=>setPosizione(e.target.value)} disabled={!commessa}>
          <option value="">{commessa ? 'Posizione…' : 'Seleziona commessa'}</option>
          {posFilt.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input placeholder="Ore" value={ore} onChange={e=>setOre(e.target.value)} />
      </div>
      <textarea placeholder="Descrizione" value={descrizione} onChange={e=>setDescrizione(e.target.value)} />
      <div className="row">
        <button onClick={crea} disabled={!ore}>Invia rapportino</button>
      </div>

      <ul>
        {db.reports?.map(r => (
          <li key={r.id} className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <span className="small">{new Date(r.data).toLocaleDateString()}</span>
            <span>{r.descrizione || '—'} • <strong>{r.ore}</strong> h • <span className="badge">{r.stato}</span></span>
            <span className="row">
              <select value={r.stato} onChange={e=>change(r.id, e.target.value)}>
                <option>inviato</option>
                <option>approvato</option>
                <option>rifiutato</option>
              </select>
              <button onClick={()=>del(r.id)}>Elimina</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
