import { supabase } from './supabaseClient.js'
const KEY = 'lemman'

export async function loadRemoteDB(fallback) {
  try {
    const { data, error } = await supabase.from('app_state').select('state').eq('key', KEY).maybeSingle()
    if (error) throw error
    if (!data) {
      const { data: ins, error: e2 } = await supabase.from('app_state').insert({ key: KEY, state: fallback }).select('state').single()
      if (e2) throw e2
      return ins.state
    }
    return data.state ?? fallback
  } catch (e) {
    console.warn('loadRemoteDB:', e?.message || e)
    return fallback
  }
}

let t=null, last=null
export function saveRemoteDB(getter){
  if (t) clearTimeout(t)
  last = typeof getter==='function' ? getter() : getter
  t=setTimeout(async ()=>{
    try {
      await supabase.from('app_state').upsert({ key: KEY, state: last }, { onConflict:'key' })
    } catch(e){ console.warn('saveRemoteDB:', e?.message||e)}
  }, 400)
}
