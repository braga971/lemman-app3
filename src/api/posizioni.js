import { supabase } from '../supabaseClient.js'

export async function listPosizioni(){
  return (await supabase.from('posizioni').select('*').order('created_at',{ascending:false})).data || []
}
export async function createPosizione({ commessa_id, name, valore }){
  const { error } = await supabase.from('posizioni').insert({ commessa_id, name, valore: valore? Number(valore): null })
  if (error) throw error
}
export async function deletePosizione(id){
  const { error } = await supabase.from('posizioni').delete().eq('id', id)
  if (error) throw error
}
