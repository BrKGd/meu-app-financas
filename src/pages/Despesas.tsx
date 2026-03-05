import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Calendar, Tag, Trash2, X, Save, 
  ShoppingCart, Loader2, Filter, CreditCard, Banknote, Landmark, ChevronLeft, ChevronRight 
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Despesas.css';

// --- Interfaces ---
interface Categoria {
  id: string;
  nome: string;
  cor: string;
}

interface Responsavel {
  id: string;
  nome: string;
}

interface Compra {
  id: string;
  user_id: string;
  descricao: string;
  loja?: string;
  valor_total: number;
  data_compra: string;
  categoria_id: string;
  forma_pagamento: string;
  cartao: string | null;
  num_parcelas: number;
  parcelado: boolean;
  nota_fiscal?: string;
  pedido?: string;
  // Campos calculados para a listagem
  parcela_atual?: number;
  valor_projetado?: number;
  categorias?: {
    nome: string;
    cor: string;
  } | null;
}

const Despesas: React.FC = () => {
  const [despesas, setDespesas] = useState<Compra[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dataFiltro, setDataFiltro] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoriaId, setFiltroCategoriaId] = useState(''); 
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemEditando, setItemEditando] = useState<any | null>(null);
  const navigate = useNavigate();

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'danger';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const alertar = (type: 'success' | 'error' | 'danger', title: string, message: string, onConfirm?: () => void) => {
    setFeedback({ isOpen: true, type, title, message, onConfirm });
  };

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Buscar dados auxiliares primeiro
      const [catRes, profRes, cartRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('tipo', 'despesa'),
        supabase.from('profiles').select('id, nome'),
        supabase.from('cartoes').select('*')
      ]);

      const listaCartoes = cartRes.data || [];
      setCategorias(catRes.data || []);
      setResponsaveis(profRes.data || []);
      setCartoes(listaCartoes);

      // 2. Buscar TODAS as compras (a projeção é feita no front-end como na sua Listagem)
      const { data: dataCompras, error } = await (supabase.from('compras') as any)
        .select(`*, categorias (nome, cor)`)
        .order('data_compra', { ascending: false });

      if (error) throw error;

      const mesAlvo = dataFiltro.getMonth();
      const anoAlvo = dataFiltro.getFullYear();
      const projetadas: Compra[] = [];

      (dataCompras as any[])?.forEach((item) => {
        const numParcelas = item.num_parcelas || 1;
        const [anoC, mesC, diaC] = item.data_compra.split('-').map(Number);
        
        let delayMes = 0;
        // Lógica de fechamento de cartão
        if (item.forma_pagamento === 'Crédito' && item.cartao) {
          const infoCartao = listaCartoes.find(c => c.nome === item.cartao);
          if (infoCartao && diaC > infoCartao.dia_fechamento) {
            delayMes = 1;
          }
        }

        // Projetar as parcelas e ver se alguma cai no mês selecionado
        for (let i = 0; i < numParcelas; i++) {
          const dataRefParcela = new Date(anoC, (mesC - 1) + delayMes + i, 15);
          
          if (dataRefParcela.getMonth() === mesAlvo && dataRefParcela.getFullYear() === anoAlvo) {
            projetadas.push({ 
              ...item, 
              parcela_atual: i + 1, 
              valor_projetado: Number(item.valor_total) / numParcelas 
            });
          }
        }
      });

      setDespesas(projetadas);
    } catch (error: any) {
      console.error("Erro técnico:", error.message);
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  const secoesAgrupadas = useMemo(() => {
    const filtradas = despesas.filter(d => {
      const matchSearch = d.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filtroCategoriaId ? d.categoria_id === filtroCategoriaId : true;
      const matchUser = filtroResponsavel ? d.user_id === filtroResponsavel : true;
      return matchSearch && matchCat && matchUser;
    });

    const grupos: Record<string, Compra[]> = {};
    filtradas.forEach(despesa => {
      const nomeSecao = despesa.categorias?.nome || 'Sem Categoria';
      if (!grupos[nomeSecao]) grupos[nomeSecao] = [];
      grupos[nomeSecao].push(despesa);
    });
    return grupos;
  }, [despesas, searchTerm, filtroCategoriaId, filtroResponsavel]);

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleAbrirModal = (item: Compra) => {
    // Para edição, usamos o valor total original
    setItemEditando({ 
        ...item, 
        valor_exibicao: formatarMoeda(item.valor_total) 
    });
    setIsModalOpen(true);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEditando?.id) return;
    try {
      const valorLimpo = typeof itemEditando.valor_exibicao === 'string' 
        ? Number(itemEditando.valor_exibicao.replace(/[^\d,]/g, '').replace(',', '.')) 
        : itemEditando.valor_total;

      const isCredito = itemEditando.forma_pagamento === 'Crédito';

      const { error } = await (supabase.from('compras') as any).update({
        descricao: itemEditando.descricao,
        loja: itemEditando.loja,
        user_id: itemEditando.user_id,
        categoria_id: itemEditando.categoria_id,
        valor_total: valorLimpo,
        forma_pagamento: itemEditando.forma_pagamento,
        cartao: isCredito ? itemEditando.cartao : null,
        data_compra: itemEditando.data_compra,
        num_parcelas: isCredito ? Number(itemEditando.num_parcelas) : 1,
        parcelado: isCredito && Number(itemEditando.num_parcelas) > 1,
        pedido: itemEditando.pedido,
        nota_fiscal: itemEditando.nota_fiscal
      }).eq('id', itemEditando.id);

      if (error) throw error;
      setIsModalOpen(false);
      buscarDados();
      alertar('success', 'Atualizado', 'Registro atualizado!');
    } catch (error: any) { alertar('error', 'Erro', error.message); }
  };

  const handleExcluir = () => {
    if (!itemEditando?.id) return;
    alertar('danger', 'Excluir?', `Apagar lançamento permanentemente?`, async () => {
      const { error } = await (supabase.from('compras') as any).delete().eq('id', itemEditando.id);
      if (!error) {
        setIsModalOpen(false);
        setFeedback(prev => ({ ...prev, isOpen: false }));
        buscarDados();
      }
    });
  };

  const getIconForSection = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('cartão')) return <CreditCard size={18} color="#ef4444" />;
    if (t.includes('fixa') || t.includes('moradia')) return <Landmark size={18} color="#3b82f6" />;
    return <Banknote size={18} color="#10b981" />;
  };

  return (
    <>
      <div className="desp-premium-wrapper theme-red">
        <div className="desp-top-layout">
          <header className="desp-panel desp-header-area">
            <div className="desp-title-area">
              <h1>Central de Dívidas</h1>
              <div className="mes-selector-premium" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px', background: '#f8fafc', padding: '5px 15px', borderRadius: '12px', width: 'fit-content' }}>
                <button onClick={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><ChevronLeft size={20} /></button>
                <span style={{ fontWeight: 900, fontSize: '0.85rem', color: '#ef4444' }}>{dataFiltro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
                <button onClick={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><ChevronRight size={20} /></button>
              </div>
            </div>
          </header>

          <div className="desp-panel desp-summary-card">
            <span className="summary-label">Total Projetado no Mês</span>
            <h2 className="summary-value">
                {formatarMoeda(despesas.reduce((acc, curr) => acc + (curr.valor_projetado || 0), 0))}
            </h2>
          </div>
        </div>

        {/* Filtros */}
        <div className="filter-container-premium" style={{ marginBottom: '20px' }}>
          <div className="search-wrapper" style={{ display: 'flex', gap: '10px', background: 'white', padding: '10px 15px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem' }} />
            <button onClick={() => setShowFilters(!showFilters)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: showFilters ? '#ef4444' : '#64748b' }}><Filter size={20} /></button>
          </div>
          {showFilters && (
            <div className="advanced-filters-row" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <select value={filtroCategoriaId} onChange={(e) => setFiltroCategoriaId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                <option value="">Todas as Categorias</option>
                {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
              </select>
              <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                <option value="">Todos Responsáveis</option>
                {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <main className="desp-panel desp-list-panel" style={{padding: 0, background: 'transparent', boxShadow: 'none'}}>
          {loading ? (
            <div className="desp-panel" style={{padding: '40px', textAlign: 'center'}}><Loader2 className="spinner" /></div>
          ) : (
            Object.entries(secoesAgrupadas).map(([titulo, itens]) => (
              <div key={titulo} className="desp-section-container" style={{marginBottom: '30px'}}>
                <div className="section-header" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 25px', background: '#ffffff', borderRadius: '16px 16px 0 0',
                  borderBottom: '2px solid #f1f5f9'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    {getIconForSection(titulo)}
                    <h3 style={{fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 900, color: '#1e293b', margin: 0}}>{titulo}</h3>
                  </div>
                  <span style={{fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '4px 10px', borderRadius: '8px'}}>
                    {formatarMoeda(itens.reduce((acc, curr) => acc + (curr.valor_projetado || 0), 0))}
                  </span>
                </div>

                <div className="desp-panel" style={{borderRadius: '0 0 16px 16px', borderTop: 'none'}}>
                  {itens.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="desp-item-row" onClick={() => handleAbrirModal(item)}>
                      <div className="desp-icon-column">
                        <div className="desp-icon-box" style={{ backgroundColor: `${item.categorias?.cor}15`, color: item.categorias?.cor || '#ef4444' }}>
                          <ShoppingCart size={20} />
                        </div>
                      </div>
                      <div className="desp-main-content">
                        <div className="desp-top-line">
                          <span className="desp-desc">
                            {item.descricao}
                            {item.parcelado && (
                                <span style={{fontSize: '0.7rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', color: '#475569', fontWeight: 800}}>
                                    {item.parcela_atual}/{item.num_parcelas}
                                </span>
                            )}
                          </span>
                          <span className="desp-value value-negative">{formatarMoeda(item.valor_projetado || 0)}</span>
                        </div>
                        <div className="desp-meta-line">
                          <span className="meta-tag"><Calendar size={12} /> {item.data_compra.split('-').reverse().slice(0,2).join('/')}</span>
                          <span className="meta-divider">•</span>
                          <span className="meta-tag"><Tag size={12} /> {item.loja || 'Loja não inf.'}</span>
                          <span className="meta-divider">•</span>
                          <span className="meta-tag">{item.forma_pagamento} {item.cartao ? `(${item.cartao})` : ''}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </main>

        {isModalOpen && itemEditando && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="edit-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h2 style={{margin: 0, fontWeight: 900}}>Detalhes</h2>
                <button onClick={() => setIsModalOpen(false)} className="close-btn-desp"><X size={20} /></button>
              </div>
              <form onSubmit={handleSalvarEdicao} className="edit-form-grid">
                <div className="form-group">
                  <label>DESCRIÇÃO</label>
                  <input type="text" value={itemEditando.descricao || ''} onChange={e => setItemEditando({...itemEditando, descricao: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>LOJA</label>
                  <input type="text" value={itemEditando.loja || ''} onChange={e => setItemEditando({...itemEditando, loja: e.target.value})} />
                </div>
                <div className="form-row">
                    <div className="form-group" style={{flex: 1}}>
                        <label>CATEGORIA</label>
                        <select value={itemEditando.categoria_id || ''} onChange={e => setItemEditando({...itemEditando, categoria_id: e.target.value})}>
                            {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>VALOR TOTAL</label>
                    <input type="text" value={itemEditando.valor_exibicao || ''} onChange={e => setItemEditando({...itemEditando, valor_exibicao: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>DATA COMPRA</label>
                    <input type="date" value={itemEditando.data_compra || ''} onChange={e => setItemEditando({...itemEditando, data_compra: e.target.value})} required />
                  </div>
                </div>

                <div className="form-row">
                   <div className="form-group">
                      <label>FORMA PAGAMENTO</label>
                      <select value={itemEditando.forma_pagamento} onChange={e => setItemEditando({...itemEditando, forma_pagamento: e.target.value})}>
                         <option value="Boleto">Boleto</option>
                         <option value="Crédito">Crédito</option>
                         <option value="Pix">Pix</option>
                         <option value="Débito">Débito</option>
                      </select>
                   </div>
                   {itemEditando.forma_pagamento === 'Crédito' && (
                     <div className="form-group">
                        <label>PARCELAS</label>
                        <input type="number" value={itemEditando.num_parcelas} onChange={e => setItemEditando({...itemEditando, num_parcelas: e.target.value})} />
                     </div>
                   )}
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-delete-full" onClick={handleExcluir}><Trash2 size={18} /> Excluir</button>
                  <button type="submit" className="btn-save-full"><Save size={18} /> Salvar Alterações</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ModalFeedback isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.message} onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))} onConfirm={feedback.onConfirm} />
      <button className="desp-fab" onClick={() => navigate('/lancamento')}><Plus size={30} /></button>
    </>
  );
};

export default Despesas;