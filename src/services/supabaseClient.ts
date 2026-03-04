import { createClient } from '@supabase/supabase-js'

// Substitua as strings abaixo pelos valores REAIS que estão no seu arquivo .env
const supabaseUrl = 'https://egoayzgmjvttshwiggaa.supabase.co'
const supabaseAnonKey = 'sb_publishable_Wlni1gs7jgN6DVy79l2Jig_OscvYzCX'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)