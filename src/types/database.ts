// Tipos auxiliares para facilitar a leitura
export type TipoUsuario = 'comum' | 'administrador' | 'proprietario';
export type TipoCategoria = 'provento' | 'despesa';
export type TipoMeta = 'despesa' | 'provento' | 'pessoal';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: TipoUsuario;
  created_at: string;
}

export interface Cartao {
  id: number;
  nome: string;
  limite: number;
  dia_fechamento?: number;
  dia_vencimento?: number;
  cor: string;
  created_at?: string;
}

export interface Categoria {
  id: string;
  user_id?: string;
  nome: string;
  tipo: TipoCategoria;
  cor: string;
}

export interface Compra {
  id: string;
  user_id: string;
  descricao: string;
  loja?: string;
  nota_fiscal?: string;
  pedido?: string;
  valor_total: number;
  parcelado: boolean;
  num_parcelas: number;
  data_compra: string;
  cartao?: string;
  forma_pagamento: string;
  cartao_id?: number;
  categoria_id?: string;
  tipo_despesa?: string;
  data_vencimento?: string;
}

export interface Parcela {
  id: string;
  compra_id: string;
  valor_parcela: number;
  numero_sequencial: number;
  data_vencimento: string;
  pago: boolean;
}

export interface Provento {
  id: string;
  user_id: string;
  descricao: string;
  valor: number;
  categoria?: string;
  data_recebimento: string;
  responsavel_id?: string;
  created_at?: string;
}

export interface Meta {
  id: string;
  user_id?: string;
  categoria_id?: string;
  nome_meta?: string;
  valor_meta: number;
  tipo_meta?: TipoMeta;
  mes_referencia: number;
  ano_referencia: number;
  cor_meta?: string;
  created_at?: string;
}