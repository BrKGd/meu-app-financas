import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Save, Calendar, ShoppingBag, Hash, Receipt, CreditCard, 
  User, Wallet, Tag, RefreshCcw, Clock, Target, TriangleAlert, CircleCheck
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Lancamento.css';

// --- Interfaces ---
interface Cartao {
  id: number;
  nome: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface Perfil {
  id: string;
  nome: string;
}

interface Categoria {
  id: string;
  nome: string;
}

interface PerfilLogado {
  id: string;
  tipo_usuario: string;
}

const Lancamento: React.FC = () => {
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [perfilLogado, setPerfilLogado] = useState<PerfilLogado | null>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [modal, setModal] = useState({
    isOpen: false,
    type: 'success' as 'success' | 'error' | 'warning' | 'danger',
    title: '',
    message: ''
  });

  const formasPagamento = ["Boleto", "Crédito", "Débito", "Dinheiro", "Pix", "Transferência"].sort();

  const frequenciasAceitas = [
    { value: 'mensal', label: 'Mensal' },
    { value: 'bimestral', label: 'Bimestral' },
    { value: 'trimestral', label: 'Trimestral' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' }
  ];

  const [form, setForm] = useState({
    descricao: '',
    valor_total: '',
    loja: '',
    pedido: '',
    nota_fiscal: '',
    user_id: '',
    forma_pagamento: 'Crédito',
    categoria_id: '',
    num_parcelas: 1,
    cartao: '',
    data_compra: new Date().toISOString().split('T')[0],
    tipo_lancamento: 'unico',
    intervalo_frequencia: 'mensal',
    data_limite: ''
  });

  useEffect(() => {
    if (form.num_parcelas > 1 && form.tipo_lancamento === 'unico') {
      setForm(prev => ({ ...prev, tipo_lancamento: 'parcelado' }));
    }
  }, [form.num_parcelas]);

  useEffect(() => {
    verificarAcessoEBucarDados();
  }, []);

  async function verificarAcessoEBucarDados() {
    try {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfil } = await supabase
        .from('profiles')
        .select('tipo_usuario')
        .eq('id', user.id)
        .single();

      const isMaster = user.email === 'gleidson.fig@gmail.com';
      const tipoFinal = isMaster ? 'proprietario' : ((perfil as any)?.tipo_usuario || 'comum');

      setPerfilLogado({ id: user.id, tipo_usuario: tipoFinal });

      const [dC, dU, dCat] = await Promise.all([
        supabase.from('cartoes').select('id,nome,dia_fechamento,dia_vencimento').order('nome'),
        supabase.from('profiles').select('id,nome').order('nome'),
        supabase.from('categorias').select('id,nome').in('tipo', ['despesa', 'pessoal']).order('nome')
      ]);

      setCartoes((dC.data as Cartao[]) || []);
      setUsuarios((dU.data as Perfil[]) || []);
      setCategorias((dCat.data as Categoria[]) || []);

      if (tipoFinal !== 'proprietario') {
        setForm(prev => ({ ...prev, user_id: user.id }));
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setFetching(false);
    }
  }

  const getBadgeInfo = () => {
    const cartaoSelecionado = cartoes.find(c => c.nome === form.cartao);
    if (!cartaoSelecionado || !form.data_compra || form.forma_pagamento !== 'Crédito') return null;

    const diaCompra = new Date(form.data_compra + 'T00:00:00').getDate();
    const fechado = diaCompra > cartaoSelecionado.dia_fechamento;

    return {
      text: fechado ? "Próxima Fatura" : "Fatura Atual",
      status: fechado ? "proxima" : "atual",
      icon: fechado ? <CircleCheck size={12} /> : <TriangleAlert size={12} />
    };
  };

  const formatarNF = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 9);
    return apenasNumeros.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2');
  };

  const completarNF = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (!apenasNumeros) return '';
    return apenasNumeros.padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const valorTotalNum = parseFloat(form.valor_total);
    if (valorTotalNum <= 0) {
      setModal({ isOpen: true, type: 'warning', title: 'Atenção', message: 'O valor deve ser maior que zero.' });
      setLoading(false);
      return;
    }

    const cartaoObjeto = cartoes.find(c => c.nome === form.cartao);
    const isCredito = form.forma_pagamento === 'Crédito';
    const isRecorrente = form.tipo_lancamento === 'fixo' || form.tipo_lancamento === 'parcelado';
    const tabelaAlvo = isRecorrente ? 'recorrencias' : 'compras';

    const payload: any = {
      user_id: form.user_id,
      descricao: form.descricao,
      loja: form.loja,
      categoria_id: form.categoria_id,
      forma_pagamento: form.forma_pagamento,
      tipo_lancamento: form.tipo_lancamento,
      pedido: form.pedido || null,
      nota_fiscal: completarNF(form.nota_fiscal) || null,
      usuario_criacao: perfilLogado?.id
    };

    if (isRecorrente) {
      payload.valor = valorTotalNum;
      payload.data_inicio = form.data_compra;
      payload.parcelas_total = Number(form.num_parcelas);
      payload.intervalo_frequencia = form.intervalo_frequencia;
      payload.tipo_despesa = form.tipo_lancamento === 'fixo' ? 'Gastos Fixos' : (isCredito ? 'Compra no Crédito' : 'Gastos Variáveis');
      payload.cartao_id = isCredito && cartaoObjeto ? cartaoObjeto.id : null;
      payload.dia_vencimento = isCredito && cartaoObjeto ? cartaoObjeto.dia_vencimento : new Date(form.data_compra + 'T00:00:00').getDate();
    } else {
      payload.valor_total = valorTotalNum;
      payload.data_compra = form.data_compra;
      payload.status_pagamento = 'pendente';
      payload.parcelado = false;
      payload.parcelas_total = 1;
      payload.parcela_numero = 1;
      payload.usuario_criacao = perfilLogado?.id;
      payload.cartao_id = isCredito && cartaoObjeto ? cartaoObjeto.id : null;
      payload.tipo_despesa = isCredito ? 'Compra no Crédito' : 'Gastos Variáveis';

      if (isCredito && cartaoObjeto) {
        const dataCompraObj = new Date(form.data_compra + 'T00:00:00');
        const diaCompra = dataCompraObj.getDate();
        let dataVenc = new Date(dataCompraObj);
        if (diaCompra > cartaoObjeto.dia_fechamento) dataVenc.setMonth(dataVenc.getMonth() + 1);
        dataVenc.setDate(cartaoObjeto.dia_vencimento);
        payload.data_vencimento = dataVenc.toISOString().split('T')[0];
        payload.periodo_referencia = dataVenc.toISOString().slice(0, 7) + "-01";
      } else {
        payload.data_vencimento = form.data_compra;
        payload.periodo_referencia = form.data_compra.slice(0, 7) + "-01";
      }
    }

    const { error } = await supabase.from(tabelaAlvo).insert([payload]);

    if (error) {
      setModal({ isOpen: true, type: 'error', title: 'Erro ao Salvar', message: error.message });
    } else {
      setModal({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Lançamento registrado com sucesso.' });
      
      setForm({
        descricao: '',
        valor_total: '',
        loja: '',
        pedido: '',
        nota_fiscal: '',
        user_id: perfilLogado?.tipo_usuario !== 'proprietario' ? (perfilLogado?.id || '') : '',
        forma_pagamento: 'Crédito',
        categoria_id: '',
        num_parcelas: 1,
        cartao: '',
        data_compra: new Date().toISOString().split('T')[0],
        tipo_lancamento: 'unico',
        intervalo_frequencia: 'mensal',
        data_limite: ''
      });
    }
    setLoading(false);
  };

  const isCredito = form.forma_pagamento === 'Crédito';
  const badge = getBadgeInfo();

  return (
    <div className="lancamento-container fade-in">
      <header className="lancamento-header">
        <h2>Novo Lançamento</h2>
        <p>Registre um gasto de forma rápida e organizada</p>
      </header>

      <div className="card lancamento-card">
        <form onSubmit={handleSubmit}>
          
          <div className="form-row-top">
            <div className="input-group">
              <label className="input-label"><Clock size={14} /> Tipo de Lançamento</label>
              <select className="form-control" value={form.tipo_lancamento} onChange={e => setForm({...form, tipo_lancamento: e.target.value})} disabled={form.num_parcelas > 1 && form.tipo_lancamento === 'parcelado'}>
                <option value="unico">Pagamento Único</option>
                <option value="parcelado">Parcelado</option>
                <option value="fixo">Fixo / Mensalidade</option>
              </select>
            </div>
            {form.tipo_lancamento === 'fixo' ? (
              <>
                <div className="input-group animate-in">
                  <label className="input-label"><RefreshCcw size={14} /> Periodicidade</label>
                  <select className="form-control" value={form.intervalo_frequencia} onChange={e => setForm({...form, intervalo_frequencia: e.target.value})}>
                    {frequenciasAceitas.map(freq => <option key={freq.value} value={freq.value}>{freq.label}</option>)}
                  </select>
                </div>
                <div className="input-group animate-in">
                  <label className="input-label"><Target size={14} /> Quantidade de Meses</label>
                  <input type="number" min="1" className="form-control" required value={form.num_parcelas} onChange={e => setForm({...form, num_parcelas: Number(e.target.value)})} />
                </div>
              </>
            ) : (
              <>
                <div className="input-group hidden-tablet"></div>
                <div className="input-group hidden-tablet"></div>
              </>
            )}
          </div>

          <div className="form-row-top section-gap">
            <div className="input-group">
              <label className="input-label"><Calendar size={14} /> {form.tipo_lancamento === 'unico' ? 'Data do Gasto' : 'Início da Cobrança'}</label>
              <input type="date" className="form-control" value={form.data_compra} required onChange={e => setForm({...form, data_compra: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><ShoppingBag size={14} /> Loja</label>
              <input placeholder="Ex: Mercado Livre, Amazon..." className="form-control" value={form.loja} onChange={e => setForm({...form, loja: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><User size={14} /> Responsável</label>
              <select className="form-control" required value={form.user_id} disabled={perfilLogado?.tipo_usuario !== 'proprietario'} onChange={e => setForm({...form, user_id: e.target.value})}>
                <option value="">Selecione o responsável...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-top section-gap">
            <div className="input-group">
              <label className="input-label">Descrição da Compra</label>
              <input placeholder="Ex: Lâmpadas para a sala" className="form-control" required value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><Tag size={14} /> Categoria</label>
              <select className="form-control select-categoria" required value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}>
                <option value="">Selecione a categoria...</option>
                {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
              </select>
            </div>
            {!isCredito ? (
              <div className="input-group animate-in">
                <label className="input-label"><Wallet size={14} /> Forma de Pagamento</label>
                <select className="form-control" value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})}>
                  {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ) : (
              <div className="input-group hidden-tablet"></div>
            )}
          </div>

          {isCredito && (
            <div className="form-row-top animate-in section-gap">
              <div className="input-group">
                <label className="input-label"><Wallet size={14} /> Forma de Pagamento</label>
                <select className="form-control" value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})}>
                  {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              
              <div className="input-group group-relative">
                {badge && (
                  <div className={`badge-fatura badge-${badge.status}`}>
                    {badge.icon}
                    {badge.text}
                  </div>
                )}
                <label className="input-label"><CreditCard size={14} /> Escolha o Cartão</label>
                <select className="form-control" required={isCredito} value={form.cartao} onChange={e => setForm({...form, cartao: e.target.value})}>
                  <option value="">Selecione o cartão...</option>
                  {cartoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>

              {form.tipo_lancamento === 'parcelado' ? (
                <div className="input-group animate-in">
                  <label className="input-label">N° de Parcelas</label>
                  <input type="number" min="1" className="form-control text-bold-center" required value={form.num_parcelas} onChange={e => setForm({...form, num_parcelas: Number(e.target.value)})} />
                </div>
              ) : (
                <div className="input-group hidden-tablet"></div>
              )}
            </div>
          )}

          <div className="form-row-top section-gap">
            <div className="input-group">
              <label className="input-label"><Hash size={14} /> N° do Pedido</label>
              <input placeholder="Opcional" className="form-control" value={form.pedido} onChange={e => setForm({...form, pedido: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><Receipt size={14} /> Nota Fiscal</label>
              <input placeholder="000.000.000" className="form-control" value={form.nota_fiscal} onChange={e => setForm({...form, nota_fiscal: formatarNF(e.target.value)})} onBlur={e => setForm({...form, nota_fiscal: completarNF(e.target.value)})} />
            </div>
            <div className="input-group">
              <label className="input-label">{form.tipo_lancamento === 'fixo' ? 'Mensalidade' : 'Valor Total'}</label>
              <div className="input-with-prefix">
                <span className="prefix-icon">R$</span>
                <input type="number" step="0.01" className="form-control" required value={form.valor_total} onChange={e => setForm({...form, valor_total: e.target.value})} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-submit btn-gap-top" disabled={loading}>
            {loading ? 'Processando...' : <><Save size={20} className="icon-margin" /> Finalizar Lançamento</>}
          </button>
        </form>
      </div>

      <ModalFeedback 
        isOpen={modal.isOpen} 
        type={modal.type} 
        title={modal.title} 
        message={modal.message} 
        onClose={() => setModal({ ...modal, isOpen: false })} 
      />
    </div>
  );
};

export default Lancamento;