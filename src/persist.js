// src/persist.js
import { supabase } from './supabaseClient.js'

const KEY = 'lemman'

// Carica lo stato remoto; se manca crea la riga con il fallback (SEED)
export async function loadRemoteDB(fallback) {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('state, updated_at')
      .eq('key', KEY)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      await supabase.from('app_state').insert({ key: KEY, state: fallback })
      return fallback
    }
    return data.state ?? fallback
  } catch (e) {
    console.warn('[persist] loadRemoteDB fallback:', e?.message || e)
    return fallback
  }
}

let _timer
export async function saveRemoteDB(db) {
  if (_timer) clearTimeout(_timer)
  _timer = setTimeout(async () => {
    try {
      const { data, error } = await supabase
        .from('app_state')
        .upsert(
          { key: KEY, state: db, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        .select('updated_at') // ritorna la riga per confermare la write

      if (error) {
        console.warn('[persist] saveRemoteDB error:', error.message)
      } else {
        console.log('[persist] saved at:', data?.[0]?.updated_at)
      }
    } catch (e) {
      console.warn('[persist] saveRemoteDB exception:', e?.message || e)
    }
  }, 400)
}
