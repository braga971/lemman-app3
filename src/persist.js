// src/persist.js
import { supabase } from './supabaseClient'

// One shared key for your company/app environment
const KEY = 'lemman'

/**
 * Load the shared JSON state from Supabase. If missing, insert fallback and return it.
 * @param {object} fallback - local seed to use when remote state does not exist
 */
export async function loadRemoteDB(fallback) {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('state')
      .eq('key', KEY)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      // create row with fallback if not existing
      try { await supabase.from('app_state').insert({ key: KEY, state: fallback }) } catch (_) {}
      return fallback
    }
    return data.state ?? fallback
  } catch (e) {
    console.warn('[persist] loadRemoteDB fallback due to:', e?.message || e)
    return fallback
  }
}

let _saveTimer = null
/**
 * Debounced upsert of the full state to Supabase.
 */
export async function saveRemoteDB(db) {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    try {
      await supabase
        .from('app_state')
        .upsert({ key: KEY, state: db, updated_at: new Date().toISOString() })
    } catch (e) {
      console.warn('[persist] saveRemoteDB error:', e?.message || e)
    }
  }, 500)
}
