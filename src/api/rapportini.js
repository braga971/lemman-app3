import { supabase } from '../supabaseClient.js'

export async function listRapportini(){
  return (await supabase.from('rapportini').select('*').order('created_at',{ascending:false})).data || []
}
export async function createRapportino({ data, commessa_id, posizione_id, ore, descrizione }){
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Utente non loggato')
  const { error } = await supabase.from('rapportini').insert({
    user_id: user.id, data, commessa_id: commessa_id||null, posizione_id: posizione_id||null,
    ore: Number(ore||0), descrizione, stato:'inviato'
  })
  if (error) throw error
}
export async function updateRapportino(id, patch){
  const { error } = await supabase.from('rapportini').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteRapportino(id){
  const { error } = await supabase.from('rapportini').delete().eq('id', id)
  if (error) throw error
}
