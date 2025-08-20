import { supabase } from '../supabaseClient.js'

export async function listCommesse(){
  return (await supabase.from('commesse').select('*').order('created_at',{ascending:false})).data || []
}
export async function createCommessa({ code, cliente }){
  const user = (await supabase.auth.getUser()).data.user
  const { error } = await supabase.from('commesse').insert({ code, cliente, created_by: user?.id })
  if (error) throw error
}
export async function deleteCommessa(id){
  const { error } = await supabase.from('commesse').delete().eq('id', id)
  if (error) throw error
}
