import { useState } from 'react'
import { supabase } from './supabaseClient.js'

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  async function signIn(e) {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErr(error.message); return }
    onSuccess?.()
  }

  return (
    <div className="grid" style={{placeItems:'center', minHeight:'60vh'}}>
      <form onSubmit={signIn} className="grid" style={{ width:360 }}>
        <h2>Accedi</h2>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <div style={{ color:'crimson' }}>{err}</div>}
        <button type="submit">Entra</button>
      </form>
    </div>
  )
}
