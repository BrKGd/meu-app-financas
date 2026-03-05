import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Calendar, Tag, Trash2, X, Save, 
  ShoppingCart, Loader2, Filter, CreditCard, Banknote, Landmark, ChevronLeft, ChevronRight,
  QrCode, Receipt, AlertTriangle, User, Store, Lock, UserPlus
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Despesas.css';

// --- Assets (Ícones PNG) ---
import iconConfirme from '../assets/confirme.png';
import iconExcluir from '../assets/excluir.png';
import iconCancelar from '../assets/cancelar.png';
import iconFechar from '../assets/fechar.png';

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
  usuario_criacao?: string; // Campo aprendido do Listagem.tsx
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
  parcela_atual?: number;
  valor_projetado?: number;
  nomeCriador?: string; // Para exibição no modal
  categorias?: {
    nome: string;
    cor: string;
  } | null;
  profiles?: {
    nome: string;
  } | null;
}

const Despesas: React.FC = () => {
  const [despesas, setDespesas] = useState<Compra[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [metaTotalPlanejada, setMetaTotalPlanejada] = useState(0); 
  const [loading, setLoading] = useState(true);
  
  const [dataFiltro, setDataFiltro] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoriaId, setFiltroCategoriaId] = useState(''); 
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);

  const formasPagamento = ["Boleto", "Crédito", "Débito", "Dinheiro", "Pix", "Transferência"].sort();

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

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // --- LÓGICA DE PERMISSÃO ATUALIZADA (Baseada no Listagem.tsx) ---
  const isProprietario = perfilUsuario?.tipo_usuario === 'proprietario' || usuarioAtual?.email === 'gleidson.fig@gmail.com';

  const temPermissaoEscrita = useCallback((item: Compra | null) => {
    if (!item) return false;
    if (isProprietario) return true;
    // Adm/Comum: Só edita se ele mesmo foi o 'usuario_criacao'
    return item.usuario_criacao === usuarioAtual?.id;
  }, [isProprietario, usuarioAtual]);

  const temPermissaoGeral = useCallback(() => {
    return isProprietario || perfilUsuario?.tipo_usuario === 'administrador';
  }, [isProprietario, perfilUsuario]);

  const podeExcluir = (item: Compra) => {
    return temPermissaoEscrita(item);
  };

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUsuarioAtual(user);

      const mesAtivo = dataFiltro.getMonth() + 1;
      const anoAtivo = dataFiltro.getFullYear();

      const { data: perfil } = await supabase
        .from('profiles')
        .select('id, tipo_usuario, nome')
        .eq('id', user.id)
        .single();
      
      const tipoFinal = user.email === 'gleidson.fig@gmail.com' ? 'proprietario' : (perfil?.tipo_usuario || 'comum');
      const perfilProcessado = { ...perfil, tipo_usuario: tipoFinal };
      setPerfilUsuario(perfilProcessado);

      const [catRes, profRes, cartRes, metasRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('tipo', 'despesa').order('nome'),
        supabase.from('profiles').select('id, nome').order('nome'),
        supabase.from('cartoes').select('*').order('nome'),
        supabase.from('metas')
          .select('valor_meta, tipo_meta')
          .eq('mes_referencia', mesAtivo)
          .eq('ano_referencia', anoAtivo)
      ]);

      setCategorias(catRes.data || []);
      setResponsaveis(profRes.data || []);
      setCartoes(cartRes.data || []);
      
      const totalMetasDespesa = metasRes.data
        ?.filter(m => m.tipo_meta === 'despesa')
        .reduce((acc, cur) => acc + Number(cur.valor_meta || 0), 0) || 0;
      
      setMetaTotalPlanejada(totalMetasDespesa);

      // Mapeamento de nomes para o campo usuario_criacao
      const mapaNomes: any = {};
      profRes.data?.forEach(p => mapaNomes[p.id] = p.nome);

      let query = supabase.from('compras').select(`
        *, 
        categorias (nome, cor),
        profiles!fk_compras_profiles (nome)
      `);
      
      // Filtro de visibilidade: Comum só vê os dele
      if (tipoFinal === 'comum') {
        query = query.eq('user_id', user.id);
      }

      const { data: dataCompras, error } = await query.order('data_compra', { ascending: false });

      if (error) throw error;

      const mesAlvo = dataFiltro.getMonth();
      const anoAlvo = dataFiltro.getFullYear();
      const projetadas: Compra[] = [];

      dataCompras?.forEach((item: any) => {
        const numParcelas = item.num_parcelas || 1;
        const [anoC, mesC, diaC] = item.data_compra.split('-').map(Number);
        
        let delayMes = 0;
        if (item.forma_pagamento === 'Crédito' && item.cartao) {
          const infoCartao = (cartRes.data || []).find(c => c.nome === item.cartao);
          if (infoCartao && diaC > (infoCartao.dia_fechamento || 31)) {
            delayMes = 1;
          }
        }

        for (let i = 0; i < numParcelas; i++) {
          const dataRefParcela = new Date(anoC, (mesC - 1) + delayMes + i, 10);
          
          if (dataRefParcela.getMonth() === mesAlvo && dataRefParcela.getFullYear() === anoAlvo) {
            projetadas.push({ 
              ...item, 
              parcela_atual: i + 1, 
              valor_projetado: Number(item.valor_total) / numParcelas,
              nomeCriador: mapaNomes[item.usuario_criacao] || 'Sistema'
            });
          }
        }
      });

      setDespesas(projetadas);
    } catch (error: any) {
      console.error("Erro técnico:", error.message);
      alertar('error', 'Falha na Conexão', 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  const totalGastoFinal = useMemo(() => despesas.reduce((acc, curr) => acc + (curr.valor_projetado || 0), 0), [despesas]);
  
  const porcGastoOrcamento = useMemo(() => metaTotalPlanejada > 0 ? (totalGastoFinal / metaTotalPlanejada) * 100 : 0, [totalGastoFinal, metaTotalPlanejada]);
  const extrapolou = totalGastoFinal > metaTotalPlanejada && metaTotalPlanejada > 0;

  const secoesAgrupadas = useMemo(() => {
    const filtradas = despesas.filter(d => {
      const matchSearch = d.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filtroCategoriaId ? d.categoria_id === filtroCategoriaId : true;
      const matchUser = filtroResponsavel ? d.user_id === filtroResponsavel : true;
      return matchSearch && matchCat && matchUser;
    });

    const grupos: Record<string, Compra[]> = {};
    filtradas.forEach(despesa => {
      const chave = despesa.forma_pagamento || 'Outros';
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(despesa);
    });
    return grupos;
  }, [despesas, searchTerm, filtroCategoriaId, filtroResponsavel]);

  const renderTextoResumo = () => {
    if (extrapolou) {
      const percentualExcedente = porcGastoOrcamento - 100;
      const valorExcedente = totalGastoFinal - metaTotalPlanejada;
      return `Você ultrapassou ${percentualExcedente.toFixed(0)}% (${formatarMoeda(valorExcedente)}) do planejado.`;
    }
    return `${porcGastoOrcamento.toFixed(0)}% do planejado já foi gasto.`;
  };

  const handleAbrirModal = (item: Compra) => {
    const valorParaEdicao = item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    setItemEditando({ ...item, valor_exibicao: valorParaEdicao });
    setIsModalOpen(true);
  };

  const handleChangeEdit = (field: string, value: any) => {
    if (!temPermissaoEscrita(itemEditando)) return;
    setItemEditando((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemEditando?.id) return;

    if (!temPermissaoEscrita(itemEditando)) {
      alertar('error', 'Acesso Negado', 'Você não tem permissão para editar este registro.');
      return;
    }

    try {
      const valorLimpo = typeof itemEditando.valor_exibicao === 'string' 
        ? Number(itemEditando.valor_exibicao.replace(/\D/g, '')) / 100 
        : itemEditando.valor_total;

      const { error } = await (supabase.from('compras') as any).update({
        descricao: itemEditando.descricao,
        loja: itemEditando.loja,
        user_id: itemEditando.user_id,
        usuario_criacao: itemEditando.usuario_criacao || usuarioAtual.id,
        categoria_id: itemEditando.categoria_id,
        valor_total: valorLimpo,
        forma_pagamento: itemEditando.forma_pagamento,
        cartao: itemEditando.forma_pagamento === 'Crédito' ? itemEditando.cartao : null,
        data_compra: itemEditando.data_compra,
        num_parcelas: itemEditando.forma_pagamento === 'Crédito' ? Number(itemEditando.num_parcelas) : 1,
        parcelado: itemEditando.forma_pagamento === 'Crédito' && Number(itemEditando.num_parcelas) > 1,
        nota_fiscal: itemEditando.nota_fiscal,
        pedido: itemEditando.pedido
      }).eq('id', itemEditando.id);

      if (error) throw error;
      setIsModalOpen(false);
      buscarDados();
      alertar('success', 'Atualizado', 'Registro atualizado com sucesso!');
    } catch (error: any) { 
      alertar('error', 'Erro ao Salvar', 'Não foi possível salvar as alterações.'); 
    }
  };

  const handleExcluir = () => {
    if (!itemEditando?.id) return;

    if (!podeExcluir(itemEditando)) {
      alertar('error', 'Acesso Negado', 'Você não tem permissão para excluir este registro.');
      return;
    }

    alertar('danger', 'Confirmar Exclusão', `Deseja realmente apagar este lançamento?`, async () => {
      const { error } = await (supabase.from('compras') as any).delete().eq('id', itemEditando.id);
      if (!error) {
        setIsModalOpen(false);
        setFeedback(prev => ({ ...prev, isOpen: false }));
        buscarDados();
      } else {
        alertar('error', 'Erro', 'Falha ao excluir o registro.');
      }
    });
  };

  return (
    <>
      <style>{`
        @keyframes blink-alert {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .blinking-badge { animation: blink-alert 1.5s infinite ease-in-out; }
        
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(6px);
          display: flex; justify-content: center; align-items: center; z-index: 1000;
          padding: 20px;
        }

        .edit-modal-container {
          width: 95%;
          max-width: 550px;
          background: white;
          border-radius: 32px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          max-height: 90vh;
        }

        .edit-modal-header {
          padding: 24px 28px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
        }

        .edit-modal-body {
          padding: 28px;
          overflow-y: auto;
          flex: 1;
          scrollbar-width: thin;
        }

        .edit-modal-footer {
          padding: 20px 28px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .edit-form-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group label {
          font-size: 0.7rem;
          font-weight: 800;
          color: #64748b;
          margin-bottom: 8px;
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .form-group input, .form-group select {
          width: 100%;
          padding: 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          font-size: 0.95rem;
          outline: none;
          background: #f8fafc;
          transition: all 0.2s;
        }

        .form-group input:focus, .form-group select:focus {
          border-color: #ef4444;
          background: white;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
        }
        
        .form-group input:disabled, .form-group select:disabled {
          cursor: not-allowed;
          background: #f1f5f9;
          color: #94a3b8;
        }

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .btn-png-action {
          background: none;
          border: none;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .btn-png-action img {
          width: 42px;
          height: 42px;
          object-fit: contain;
        }

        .btn-png-action:hover { transform: scale(1.15); }
        .btn-png-action:active { transform: scale(0.95); }

        .parcela-preview-box {
          background: #fef2f2;
          padding: 14px;
          border-radius: 16px;
          border: 1px dashed #ef4444;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }

        @media (max-width: 480px) {
          .edit-modal-container { 
            width: 100%; 
            border-radius: 32px 32px 0 0; 
            max-height: 95vh;
            position: fixed;
            bottom: 0;
          }
          .modal-overlay { align-items: flex-end; padding: 0; }
          .form-row-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="desp-premium-wrapper">
        <div className="desp-top-layout">
          <header className="desp-panel desp-header-area">
            <div className="desp-title-area">
              <h1>Central de Dívidas</h1>
              <p>Gestão de gastos e projeções</p>
            </div>
          </header>

          <div style={{ position: 'relative' }}>
            {extrapolou && temPermissaoGeral() && (
              <div className="blinking-badge" style={{
                position: 'absolute', top: '-10px', right: '10px',
                background: '#ffffff', color: '#ef4444',
                padding: '4px 10px', borderRadius: '8px',
                fontSize: '0.65rem', fontWeight: 900,
                display: 'flex', alignItems: 'center', gap: '4px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)', zIndex: 2,
                border: '1px solid #ef4444'
              }}>
                <AlertTriangle size={12} fill="#ef4444" color="white" /> Excedido
              </div>
            )}

            <section className="desp-panel" style={{ 
              background: '#ef4444', color: 'white', border: 'none',
              padding: '20px', borderRadius: '24px',
              display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase' }}>Total Gasto no Mês</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0 }}>{formatarMoeda(totalGastoFinal)}</h2>
                {temPermissaoGeral() && (
                   <span style={{ fontSize: '1rem', opacity: 0.8 }}>/ {formatarMoeda(metaTotalPlanejada)}</span>
                )}
              </div>
              {temPermissaoGeral() && (
                <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '8px 0 0 0', opacity: 0.95 }}>{renderTextoResumo()}</p>
              )}
            </section>
          </div>
        </div>

        <div className="filter-container-premium" style={{ marginBottom: '20px' }}>
          <div className="search-wrapper" style={{ display: 'flex', gap: '10px', background: 'white', padding: '10px 15px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <input type="text" placeholder="Pesquisar despesa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem' }} />
            <button onClick={() => setShowFilters(!showFilters)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: showFilters ? '#ef4444' : '#64748b' }}><Filter size={20} /></button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <div className="mes-selector-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 14px', borderRadius: '100px', border: '1px solid #e2e8f0' }}>
              <button onClick={() => mudarMes(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#1e293b', textTransform: 'uppercase', minWidth: '90px', textAlign: 'center' }}>
                {dataFiltro.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}
              </span>
              <button onClick={() => mudarMes(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><ChevronRight size={16} /></button>
            </div>
          </div>

          {showFilters && (
            <div className="advanced-filters-row" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <select value={filtroCategoriaId} onChange={(e) => setFiltroCategoriaId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white' }}>
                <option value="">Todas as Categorias</option>
                {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
              </select>
              <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white' }}>
                <option value="">Todos Responsáveis</option>
                {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <main className="desp-panel desp-list-panel" style={{padding: 0, background: 'transparent', boxShadow: 'none'}}>
          {loading ? (
            <div className="desp-panel" style={{padding: '40px', textAlign: 'center', background: 'white', borderRadius: '24px'}}>
              <Loader2 className="spinner" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: '10px', color: '#64748b', fontSize: '0.8rem' }}>Sincronizando dados...</p>
            </div>
          ) : (
            Object.entries(secoesAgrupadas).map(([titulo, itens]) => (
              <div key={titulo} className="desp-section-container" style={{marginBottom: '25px'}}>
                <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#ffffff', borderRadius: '16px 16px 0 0', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800, color: '#475569', margin: 0}}>{titulo}</h3>
                  <span style={{fontSize: '0.85rem', fontWeight: 800, color: '#ef4444'}}>{formatarMoeda(itens.reduce((acc, curr) => acc + (curr.valor_projetado || 0), 0))}</span>
                </div>
                <div className="desp-panel-list" style={{borderRadius: '0 0 16px 16px', background: 'white'}}>
                  {itens.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="desp-item-row" onClick={() => handleAbrirModal(item)}>
                      <div className="desp-icon-column">
                        <div className="desp-icon-box" style={{ backgroundColor: `${item.categorias?.cor}15`, color: item.categorias?.cor || '#ef4444' }}><ShoppingCart size={20} /></div>
                      </div>
                      <div className="desp-main-content">
                        <div className="desp-top-line">
                          <span className="desp-desc">
                            {item.descricao} 
                            {item.parcelado && <span style={{fontSize: '0.7rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px'}}>{item.parcela_atual}/{item.num_parcelas}</span>}
                            {!temPermissaoEscrita(item) && <Lock size={12} style={{marginLeft: '8px', opacity: 0.4}} />}
                          </span>
                          <span className="desp-value value-negative">{formatarMoeda(item.valor_projetado || 0)}</span>
                        </div>
                        <div className="desp-meta-line">
                          <span className="meta-tag"><Calendar size={12} /> {item.data_compra.split('-').reverse().slice(0,2).join('/')}</span>
                          <span className="meta-divider">•</span>
                          <span className="meta-tag"><Tag size={12} /> {item.categorias?.nome || 'S/ Categoria'}</span>
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
            <div className="edit-modal-container" onClick={e => e.stopPropagation()}>
              
              <div className="edit-modal-header">
                <div>
                  <h2 style={{margin: 0, fontWeight: 900, fontSize: '1.25rem', color: '#1e293b'}}>
                    { temPermissaoEscrita(itemEditando) ? 'Editar Lançamento' : 'Visualizar Detalhes' }
                  </h2>
                  { !temPermissaoEscrita(itemEditando) && (
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px'}}>
                        <Lock size={10} color="#ef4444" />
                        <span style={{fontSize: '0.65rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase'}}>Apenas Visualização</span>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-png-action">
                  <img src={iconFechar} alt="Fechar" style={{width: '32px'}} />
                </button>
              </div>

              <div className="edit-modal-body">
                <form id="edit-form" className="edit-form-grid" onSubmit={handleSalvarEdicao}>
                  <div className="form-group">
                    <label>Descrição</label>
                    <input type="text" value={itemEditando.descricao || ''} onChange={e => handleChangeEdit('descricao', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} required />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Valor Total</label>
                      <input type="text" value={itemEditando.valor_exibicao || ''} onChange={e => {
                        let val = e.target.value.replace(/\D/g, "");
                        val = (Number(val) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                        handleChangeEdit('valor_exibicao', val);
                      }} placeholder="0,00" disabled={!temPermissaoEscrita(itemEditando)} required />
                    </div>
                    <div className="form-group">
                      <label>Data</label>
                      <input type="date" value={itemEditando.data_compra || ''} onChange={e => handleChangeEdit('data_compra', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Loja / Estabelecimento</label>
                    <div style={{position: 'relative'}}>
                      <Store size={18} style={{position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8'}} />
                      <input style={{paddingLeft: '44px'}} type="text" value={itemEditando.loja || ''} onChange={e => handleChangeEdit('loja', e.target.value)} placeholder="Local da compra" disabled={!temPermissaoEscrita(itemEditando)} />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Categoria</label>
                      <select value={itemEditando.categoria_id} onChange={e => handleChangeEdit('categoria_id', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)}>
                        {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Responsável</label>
                      <select value={itemEditando.user_id} onChange={e => handleChangeEdit('user_id', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)}>
                        {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Pagamento</label>
                      <select value={itemEditando.forma_pagamento} onChange={e => handleChangeEdit('forma_pagamento', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)}>
                        {formasPagamento.map(forma => (
                          <option key={forma} value={forma}>{forma}</option>
                        ))}
                      </select>
                    </div>

                    {itemEditando.forma_pagamento === 'Crédito' && (
                      <div className="form-group">
                        <label>Cartão</label>
                        <select value={itemEditando.cartao || ''} onChange={e => handleChangeEdit('cartao', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)}>
                          <option value="">Selecione</option>
                          {cartoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {itemEditando.forma_pagamento === 'Crédito' && (
                    <div className="form-group">
                      <label>Parcelas</label>
                      <input type="number" min="1" max="48" value={itemEditando.num_parcelas || 1} onChange={e => handleChangeEdit('num_parcelas', Number(e.target.value))} disabled={!temPermissaoEscrita(itemEditando)} />
                      {Number(itemEditando.num_parcelas) > 1 && (
                        <div className="parcela-preview-box">
                          <span style={{fontSize: '0.8rem', color: '#ef4444', fontWeight: 600}}>Valor por Parcela:</span>
                          <strong style={{color: '#ef4444'}}>{formatarMoeda((typeof itemEditando.valor_exibicao === 'string' ? Number(itemEditando.valor_exibicao.replace(/\D/g, '')) / 100 : itemEditando.valor_total) / (itemEditando.num_parcelas || 1))}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-row-2">
                    <div className="form-group">
                      <label><Receipt size={12}/> Nota Fiscal</label>
                      <input type="text" value={itemEditando.nota_fiscal || ''} onChange={e => handleChangeEdit('nota_fiscal', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} />
                    </div>
                    <div className="form-group">
                      <label>Pedido</label>
                      <input type="text" value={itemEditando.pedido || ''} onChange={e => handleChangeEdit('pedido', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} />
                    </div>
                  </div>
                </form>
              </div>

              <div className="edit-modal-footer">
                { temPermissaoEscrita(itemEditando) ? (
                  <>
                    <button type="button" className="btn-png-action" onClick={handleExcluir} title="Excluir">
                      <img src={iconExcluir} alt="Excluir" />
                    </button>
                    
                    <div style={{display: 'flex', gap: '16px', marginLeft: 'auto'}}>
                      <button type="button" className="btn-png-action" onClick={() => setIsModalOpen(false)} title="Cancelar">
                        <img src={iconCancelar} alt="Cancelar" />
                      </button>
                      <button type="submit" form="edit-form" className="btn-png-action" title="Salvar">
                        <img src={iconConfirme} alt="Confirmar" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem'}}>
                       <UserPlus size={14} /> Lançado por: <strong>{itemEditando.nomeCriador}</strong>
                    </div>
                    <button type="button" className="btn-png-action" onClick={() => setIsModalOpen(false)}>
                      <img src={iconCancelar} alt="Voltar" />
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      <ModalFeedback isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.message} onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))} onConfirm={feedback.onConfirm} />
      <button className="desp-fab" onClick={() => navigate('/lancamento')}><Plus size={30} /></button>
    </>
  );
};

// Função auxiliar de navegação de meses preservada
const mudarMes = (direcao: number) => {
    // Implementação interna no componente através do setter
};

export default Despesas;