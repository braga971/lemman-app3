// src/persist.js
import { supabase } from './supabaseClient'

// Chiave condivisa per l’ambiente/azienda
const KEY = 'lemman'

// carica dallo stato remoto; se non esiste, crea con il fallback
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

let _saveTimer = null
export async function saveRemoteDB(db) {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    try {
      // upsert esplicita con onConflict sulla PK
      const { error } = await supabase
        .from('app_state')
        .upsert(
          { key: KEY, state: db, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      if (error) console.warn('[persist] saveRemoteDB error:', error.message)
    } catch (e) {
      console.warn('[persist] saveRemoteDB exception:', e?.message || e)
    }
  }, 400)
}
