import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Save, Calendar, ShoppingBag, Hash, Receipt, CreditCard, 
  User, Lock, Wallet, Info, Tag 
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Lancamento.css';

// --- Interfaces para garantir a tipagem correta ---
interface Cartao {
  id: number;
  nome: string;
  dia_fechamento: number;
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

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'danger';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const formasPagamento = ["Boleto", "Crédito", "Débito", "Dinheiro", "Pix", "Transferência"].sort();

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
    data_compra: new Date().toISOString().split('T')[0]
  });

  // Cálculo inteligente da fatura
  const infoFechamento = useMemo(() => {
    if (form.forma_pagamento !== 'Crédito' || !form.cartao || !form.data_compra) return null;
    const cartaoSelecionado = cartoes.find(c => c.nome === form.cartao);
    if (!cartaoSelecionado) return null;

    const [ano, mes, dia] = form.data_compra.split('-').map(Number);
    const diaFechamento = cartaoSelecionado.dia_fechamento;
    const vaiParaProximoMes = dia > diaFechamento;
    
    let dataVencimento = new Date(ano, mes - 1, 15);
    if (vaiParaProximoMes) dataVencimento.setMonth(dataVencimento.getMonth() + 1);

    const nomeMes = dataVencimento.toLocaleString('pt-BR', { month: 'long' });
    return { 
      vaiParaProximoMes, 
      mesCobranca: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1), 
      diaFechamento,
      dataBaseVencimento: dataVencimento 
    };
  }, [form.cartao, form.data_compra, form.forma_pagamento, cartoes]);

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

      // Agora buscamos os dados para todos os níveis de acesso
      const [dC, dU, dCat] = await Promise.all([
        supabase.from('cartoes').select('id, nome, dia_fechamento').order('nome'),
        supabase.from('profiles').select('id, nome').order('nome'),
        supabase.from('categorias').select('id, nome').eq('tipo', 'despesa').order('nome')
      ]);
      
      setCartoes((dC.data as Cartao[]) || []);
      setUsuarios((dU.data as Perfil[]) || []);
      setCategorias((dCat.data as Categoria[]) || []);

      // Se não for proprietário, trava o responsável como sendo o próprio usuário logado
      if (tipoFinal !== 'proprietario') {
        setForm(prev => ({ ...prev, user_id: user.id }));
      }

    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setFetching(false);
    }
  }

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

    const isCredito = form.forma_pagamento === 'Crédito';
    const numP = isCredito ? Number(form.num_parcelas) : 1;
    const isEfetivamenteParcelado = numP > 1;

    if (parseFloat(form.valor_total) <= 0) {
      setModal({ isOpen: true, type: 'warning', title: 'Atenção', message: 'O valor total deve ser maior que zero.' });
      setLoading(false); return;
    }

    let dataVencimentoFinal = form.data_compra;
    if (isCredito && infoFechamento) {
      dataVencimentoFinal = infoFechamento.dataBaseVencimento.toISOString().split('T')[0];
    }

    const cartaoObjeto = cartoes.find(c => c.nome === form.cartao);
    
    const payload: any = {
      user_id: form.user_id,
      usuario_criacao: perfilLogado?.id, // Define quem criou o registro
      descricao: form.descricao,
      loja: form.loja,
      pedido: form.pedido,
      nota_fiscal: completarNF(form.nota_fiscal),
      valor_total: parseFloat(form.valor_total),
      parcelado: isEfetivamenteParcelado,
      num_parcelas: numP,
      data_compra: form.data_compra,
      forma_pagamento: form.forma_pagamento,
      cartao: isCredito ? form.cartao : null,
      cartao_id: isCredito && cartaoObjeto ? cartaoObjeto.id : null,
      categoria_id: form.categoria_id,
      tipo_despesa: isCredito ? 'Compra no Crédito' : 'Gastos Variáveis',
      data_vencimento: dataVencimentoFinal
    };

    const { data: compraCriada, error: errorCompra } = await (supabase.from('compras') as any)
      .insert([payload])
      .select()
      .single();

    if (errorCompra) {
      setModal({ isOpen: true, type: 'error', title: 'Erro ao salvar compra', message: errorCompra.message });
      setLoading(false);
      return;
    }

    try {
      if (isEfetivamenteParcelado && infoFechamento) {
        const valorParcela = (payload.valor_total / numP);
        const parcelasParaInserir = [];

        for (let i = 1; i <= numP; i++) {
          let d = new Date(infoFechamento.dataBaseVencimento);
          d.setMonth(d.getMonth() + (i - 1));

          parcelasParaInserir.push({
            compra_id: (compraCriada as any).id,
            valor_parcela: valorParcela,
            numero_sequencial: i,
            data_vencimento: d.toISOString().split('T')[0],
            pago: false
          });
        }
        
        const { error: errorParcelas } = await (supabase.from('parcelas') as any).insert(parcelasParaInserir);
        if (errorParcelas) throw errorParcelas;
      }

      setModal({ 
        isOpen: true, 
        type: 'success', 
        title: 'Sucesso!', 
        message: isEfetivamenteParcelado ? `Gasto e ${numP} parcelas registradas.` : `Gasto registrado com sucesso.` 
      });
      
      // Reseta o form mantendo o user_id se não for proprietário
      setForm({ 
        ...form, 
        descricao: '', 
        valor_total: '', 
        loja: '', 
        pedido: '', 
        nota_fiscal: '', 
        num_parcelas: 1, 
        cartao: '', 
        categoria_id: '',
        user_id: perfilLogado?.tipo_usuario !== 'proprietario' ? (perfilLogado?.id || '') : ''
      });

    } catch (err: any) {
      setModal({ isOpen: true, type: 'error', title: 'Erro nas parcelas', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="loading-state">CARREGANDO...</div>;
  
  return (
    <div className="lancamento-container fade-in">
      <header className="lancamento-header">
        <h2>Novo Lançamento</h2>
        <p>Registre um gasto para a unidade</p>
      </header>
      
      <div className="card lancamento-card">
        <form onSubmit={handleSubmit}>
          <div className="form-row-top">
            <div className="input-group">
              <label className="input-label"><Calendar size={14} /> Data da Compra</label>
              <input type="date" className="form-control" value={form.data_compra} required onChange={e => setForm({...form, data_compra: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><ShoppingBag size={14} /> Loja</label>
              <input placeholder="Ex: Amazon" className="form-control" value={form.loja} onChange={e => setForm({...form, loja: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><User size={14} /> Responsável</label>
              <select 
                className="form-control" 
                required 
                value={form.user_id} 
                disabled={perfilLogado?.tipo_usuario !== 'proprietario'}
                onChange={e => setForm({...form, user_id: e.target.value})}
              >
                <option value="">Quem comprou?</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              {perfilLogado?.tipo_usuario !== 'proprietario' && (
                <span style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={10} /> Travado para seu perfil
                </span>
              )}
            </div>
          </div>

          <div className="form-grid-desc-cat">
            <div className="input-group">
              <label className="input-label">Descrição</label>
              <input placeholder="O que foi comprado?" className="form-control" required value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><Tag size={14} /> Categoria</label>
              <select className="form-control select-categoria" required value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}>
                <option value="">Selecione...</option>
                {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-top" style={{ marginTop: '20px' }}>
            <div className="input-group">
              <label className="input-label"><Hash size={14} /> Pedido</label>
              <input placeholder="Opcional" className="form-control" value={form.pedido} onChange={e => setForm({...form, pedido: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label"><Receipt size={14} /> Nota Fiscal</label>
              <input 
                placeholder="000.000.000" 
                className="form-control" 
                value={form.nota_fiscal} 
                onChange={e => setForm({...form, nota_fiscal: formatarNF(e.target.value)})}
                onBlur={e => setForm({...form, nota_fiscal: completarNF(e.target.value)})}
              />
            </div>
          </div>

          <div className="form-row-bottom">
            <div className="input-group flex-item-valor">
              <label className="input-label">Valor Total</label>
              <div className="input-with-prefix">
                <span className="prefix-icon">R$</span>
                <input type="number" step="0.01" placeholder="0,00" className="form-control" required value={form.valor_total} onChange={e => setForm({...form, valor_total: e.target.value})} />
              </div>
            </div>
            <div className="input-group flex-item-forma">
              <label className="input-label"><Wallet size={14} /> Pagamento</label>
              <select className="form-control select-pagamento" value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})}>
                {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {form.forma_pagamento === 'Crédito' && (
            <div className="form-row-credito animate-in">
              <div className="input-group flex-item-cartao">
                <label className="input-label"><CreditCard size={14} /> Cartão</label>
                <select className="form-control" required value={form.cartao} onChange={e => setForm({...form, cartao: e.target.value})}>
                  <option value="">Qual?</option>
                  {cartoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div className="input-group flex-item-parcela">
                <label className="input-label">Parc.</label>
                <input type="number" min="1" className="form-control" required value={form.num_parcelas} onChange={e => setForm({...form, num_parcelas: Number(e.target.value)})} style={{ textAlign: 'center', fontWeight: '800' }} />
              </div>
            </div>
          )}

          {infoFechamento && (
            <div className={`info-fechamento-badge animate-in ${infoFechamento.vaiParaProximoMes ? 'next-month' : 'current-month'}`}>
              <Info size={16} />
              <span>
                {infoFechamento.vaiParaProximoMes 
                  ? `Fatura fechada (dia ${infoFechamento.diaFechamento}). 1ª parcela/vencimento em ${infoFechamento.mesCobranca}.`
                  : `Compra antes do fechamento. Vencimento em ${infoFechamento.mesCobranca}.`}
              </span>
            </div>
          )}

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Salvando...' : <><Save size={20} style={{ marginRight: '10px' }} /> Confirmar Lançamento</>}
          </button>
        </form>
      </div>

      <ModalFeedback 
        isOpen={modal.isOpen} type={modal.type} title={modal.title} message={modal.message}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
};

export default Lancamento;