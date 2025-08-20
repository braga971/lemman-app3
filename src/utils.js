export function mergeDB(remote, local) {
  const base = { ...(local || {}) }
  for (const k of Object.keys(remote || {})) {
    if (Array.isArray(remote[k])) base[k] = remote[k]
    else if (remote[k] && typeof remote[k] === 'object') base[k] = { ...(base[k]||{}), ...remote[k] }
    else base[k] = remote[k]
  }
  return base
}

export function exportCSV(rows, db){
  const header = ['Data','Dipendente','Commessa','Posizione','Ore','Descrizione','Stato']
  const commName = (id)=>{ const c=(db.commesse||[]).find(x=>x.id===id); return c? c.code : '' }
  const posName  = (id)=>{ const p=(db.posizioni||[]).find(x=>x.id===id); return p? p.name : '' }
  const toCSV = v => (''+v).replaceAll('"','""')
  const lines = [header.join(';')]
  for (const r of rows||[]) {
    lines.push([
      r.data ?? '', r.user_id ?? '', commName(r.commessa_id), posName(r.posizione_id),
      r.ore ?? '', r.descrizione ?? '', r.stato ?? ''
    ].map(v => `"${toCSV(v)}"`).join(';'))
  }
  const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rapportini_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
