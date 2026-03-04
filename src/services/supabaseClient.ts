import { createClient } from '@supabase/supabase-js'

// No Vite, usamos import.meta.env em vez de process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erro: Variáveis de ambiente do Supabase não encontradas!")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)