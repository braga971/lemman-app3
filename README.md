# Lemman • Full Supabase App

## Setup rapido
1) `npm i`
2) Copia `.env.example` in `.env` e inserisci le chiavi Supabase
3) In Supabase esegui `supabase_sql.sql`
4) Abilita Realtime su: `commesse`, `posizioni`, `rapportini`, `app_state`
5) Crea utenti in Auth → Users
6) `npm run dev`

## Funzioni incluse
- CRUD **Commesse**, **Posizioni**, **Rapportini**
- Filtri "posizioni per commessa"
- Login email/password
- **Realtime** su tutte le tabelle
- **Persistenza** stato UI in `app_state` (chiave `lemman`)
- **Export CSV** rapportini
