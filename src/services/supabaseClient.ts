import { createClient } from '@supabase/supabase-js';
import { 
  Cartao, Categoria, Compra, Profile, 
  Provento, Meta, Parcela 
} from '../types/database';

// Definição do Schema do Banco para o Supabase
export interface Database {
  public: {
    Tables: {
      cartoes: { Row: Cartao };
      categorias: { Row: Categoria };
      compras: { Row: Compra };
      profiles: { Row: Profile };
      proventos: { Row: Provento };
      metas: { Row: Meta };
      parcelas: { Row: Parcela };
    }
  }
}

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);