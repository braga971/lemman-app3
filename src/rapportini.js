import { supabase } from './supabaseClient'

// Login (email/password)
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

// Dati utente loggato
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Crea rapportino
export async function creaRapportino({ data, commessa_id, posizione_id, ore, descrizione }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('rapportini').insert({
    data, commessa_id, posizione_id, ore, descrizione,
    dipendente_id: user.id, stato: 'inviato'
  })
  if (error) throw error
}

// Lista rapportini (utente vede i suoi, manager vede tutti via RLS)
export async function listaRapportini() {
  const { data, error } = await supabase
    .from('rapportini')
    .select('id,data,ore,descrizione,stato,commessa_id,posizione_id,created_at')
    .order('data', { ascending: false })
  if (error) throw error
  return data
}
