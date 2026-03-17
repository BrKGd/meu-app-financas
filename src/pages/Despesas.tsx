import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Calendar, Tag, Trash2, X, Save, 
  ShoppingCart, Loader2, Filter, CreditCard, Banknote, Landmark, ChevronLeft, ChevronRight,
  QrCode, Receipt, AlertTriangle, User, Store, Lock, UserPlus, Repeat, CheckCircle2
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
  usuario_criacao?: string; 
  descricao: string;
  loja?: string;
  valor_total: number;
  data_compra: string;
  categoria_id: string;
  forma_pagamento: string;
  cartao: string | null;
  parcelas_total?: number; 
  parcela_numero?: number; 
  tipo_lancamento?: string;
  periodo_referencia?: string;
  recorrencia_id?: string; 
  nota_fiscal?: string;
  pedido?: string;
  valor_projetado?: number;
  nomeCriador?: string; 
  parcelado?: boolean;      
  parcela_atual?: number;   
  status_pagamento?: string;
  categorias?: {
    nome: string;
    cor: string;
  } | null;
  profiles?: {
    nome: string;
  } | null;
  recorrencias?: {
    valor: number;
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

  const isProprietario = perfilUsuario?.tipo_usuario === 'proprietario' || usuarioAtual?.email === 'gleidson.fig@gmail.com';

  const temPermissaoEscrita = useCallback((item: Compra | null) => {
    if (!item) return false;
    if (isProprietario) return true;
    return item.usuario_criacao === usuarioAtual?.id;
  }, [isProprietario, usuarioAtual]);

  const temPermissaoGeral = useCallback(() => {
    return isProprietario || perfilUsuario?.tipo_usuario === 'administrador';
  }, [isProprietario, perfilUsuario]);

  const podeExcluir = (item: Compra) => {
    return temPermissaoEscrita(item);
  };

  const mudarMes = (direcao: number) => {
    const novaData = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + direcao, 1);
    setDataFiltro(novaData);
  };

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUsuarioAtual(user);

      const mesAlvoNum = dataFiltro.getMonth() + 1;
      const anoAlvoNum = dataFiltro.getFullYear();
      const periodoAlvoStr = `${anoAlvoNum}-${mesAlvoNum.toString().padStart(2, '0')}-01`;

      const { data: perfil } = await supabase
        .from('profiles')
        .select('id, tipo_usuario, nome')
        .eq('id', user.id)
        .single();
      
      const tipoFinal = user.email === 'gleidson.fig@gmail.com' ? 'proprietario' : (perfil?.tipo_usuario || 'comum');
      setPerfilUsuario({ ...perfil, tipo_usuario: tipoFinal });

      if (tipoFinal === 'comum') setFiltroResponsavel(user.id);

      const [catRes, profRes, cartRes, metasRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('tipo', 'despesa').order('nome'),
        supabase.from('profiles').select('id, nome').order('nome'),
        supabase.from('cartoes').select('*').order('nome'),
        supabase.from('metas').select('valor_meta, tipo_meta').eq('mes_referencia', mesAlvoNum).eq('ano_referencia', anoAlvoNum)
      ]);

      setCategorias(catRes.data || []);
      setResponsaveis(profRes.data || []);
      setCartoes(cartRes.data || []);
      
      const totalMetasDespesa = metasRes.data?.filter(m => m.tipo_meta === 'despesa').reduce((acc, cur) => acc + Number(cur.valor_meta || 0), 0) || 0;
      setMetaTotalPlanejada(totalMetasDespesa);

      const mapaNomes: any = {};
      profRes.data?.forEach(p => mapaNomes[p.id] = p.nome);

      let query = supabase.from('compras').select(`
        *, 
        categorias (nome, cor), 
        profiles!fk_compras_profiles (nome),
        recorrencias (valor)
      `).eq('periodo_referencia', periodoAlvoStr);

      if (tipoFinal === 'comum') query = query.eq('user_id', user.id);

      const { data: dataCompras, error } = await query.order('data_compra', { ascending: false });
      if (error) throw error;

      setDespesas(dataCompras?.map((item: any) => ({
        ...item,
        valor_projetado: Number(item.valor_total),
        nomeCriador: mapaNomes[item.usuario_criacao] || 'Sistema',
        parcelado: item.tipo_lancamento === 'parcelado',
        parcela_atual: item.parcela_numero
      })) || []);
    } catch (error: any) {
      console.error("Erro técnico:", error.message);
      alertar('error', 'Falha na Conexão', 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  const totalGastoFinal = useMemo(() => despesas.reduce((acc, curr) => acc + (curr.valor_projetado || 0), 0), [despesas]);
  const extrapolou = totalGastoFinal > metaTotalPlanejada && metaTotalPlanejada > 0;
  
  const valorExcedente = totalGastoFinal - metaTotalPlanejada;
  const percentualExcedente = metaTotalPlanejada > 0 
    ? Math.round((valorExcedente / metaTotalPlanejada) * 100) 
    : 0;

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

  const handleAbrirModal = (item: Compra) => {
    const valorParaEdicao = item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    
    const valorPai = item.recorrencias?.valor || item.valor_total;
    const valorPaiExibicao = valorPai.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    setItemEditando({ 
      ...item, 
      valor_exibicao: valorParaEdicao,
      valor_pai_exibicao: valorPaiExibicao 
    });
    setIsModalOpen(true);
  };

  const handleChangeEdit = (field: string, value: any) => {
    if (!temPermissaoEscrita(itemEditando)) return;
    setItemEditando((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemEditando?.id || !temPermissaoEscrita(itemEditando)) return;
    
    setLoading(true);
    try {
      const valorParcelaLimpo = typeof itemEditando.valor_exibicao === 'string' 
        ? Number(itemEditando.valor_exibicao.replace(/\D/g, '')) / 100 
        : itemEditando.valor_total;
  
      if (itemEditando.recorrencia_id) {
        const valorPaiLimpo = typeof itemEditando.valor_pai_exibicao === 'string' 
          ? Number(itemEditando.valor_pai_exibicao.replace(/\D/g, '')) / 100 
          : itemEditando.recorrencias?.valor;
  
        const { error: errorRec } = await supabase.from('recorrencias').update({
          valor: valorPaiLimpo,
          descricao: itemEditando.descricao,
          loja: itemEditando.loja,
          categoria_id: itemEditando.categoria_id,
          forma_pagamento: itemEditando.forma_pagamento,
          user_id: itemEditando.user_id
        }).eq('id', itemEditando.recorrencia_id);
  
        if (errorRec) throw errorRec;
      }
  
      const dadosUpdate: any = {
        descricao: itemEditando.descricao, 
        loja: itemEditando.loja, 
        categoria_id: itemEditando.categoria_id, 
        forma_pagamento: itemEditando.forma_pagamento,
        cartao: itemEditando.forma_pagamento === 'Crédito' ? itemEditando.cartao : null,
        data_compra: itemEditando.data_compra, 
        nota_fiscal: itemEditando.nota_fiscal, 
        pedido: itemEditando.pedido
      };
  
      if (!itemEditando.recorrencia_id || itemEditando.status_pagamento === 'pago') {
        dadosUpdate.valor_total = valorParcelaLimpo;
      }
  
      const { error } = await (supabase.from('compras') as any)
        .update(dadosUpdate)
        .eq('id', itemEditando.id);
  
      if (error) throw error;
      
      setIsModalOpen(false);
      buscarDados();
      alertar('success', 'Atualizado', 'Registro atualizado e parcelas pendentes sincronizadas!');
    } catch (error: any) { 
      alertar('error', 'Erro ao Salvar', 'Não foi possível salvar as alterações.'); 
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = () => {
    if (!itemEditando?.id || !podeExcluir(itemEditando)) return;
    
    if (itemEditando.recorrencia_id) {
      alertar('danger', 'Excluir Recorrência', 'Este item faz parte de uma série. Deseja excluir apenas este registro ou TODA a série de parcelas pendentes?', async () => {
        setLoading(true);
        try {
          const { error } = await supabase.rpc('excluir_lancamento_recorrente', { 
            p_recorrencia_id: itemEditando.recorrencia_id 
          });
          if (error) throw error;
          
          setIsModalOpen(false);
          setFeedback(prev => ({ ...prev, isOpen: false }));
          buscarDados();
        } catch (err: any) {
          alertar('error', 'Erro ao excluir série', err.message);
        } finally {
          setLoading(false);
        }
      });
    } else {
      alertar('danger', 'Confirmar Exclusão', 'Deseja realmente apagar este registro?', async () => {
        const { error } = await (supabase.from('compras') as any).delete().eq('id', itemEditando.id);
        if (!error) {
          setIsModalOpen(false);
          setFeedback(prev => ({ ...prev, isOpen: false }));
          buscarDados();
        }
      });
    }
  };

  return (
    <>
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
              <div className="blinking-badge" style={{ position: 'absolute', top: '-10px', right: '10px', background: '#ffffff', color: '#ef4444', padding: '4px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', zIndex: 2, border: '1px solid #ef4444' }}>
                <AlertTriangle size={12} fill="#ef4444" color="white" /> Excedido
              </div>
            )}
            <section className={`desp-panel desp-summary-card ${extrapolou ? 'bg-danger' : ''}`}>
              <span className="summary-label">TOTAL GASTO NO MÊS</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h2 className="summary-value">{formatarMoeda(totalGastoFinal)}</h2>
                {temPermissaoGeral() && <span className="summary-goal">/ {formatarMoeda(metaTotalPlanejada)}</span>}
              </div>

              {extrapolou && temPermissaoGeral() && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Você ultrapassou o planejado em <strong>{percentualExcedente}%</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>({formatarMoeda(valorExcedente)})</p>
                </div>
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
              <button onClick={() => mudarMes(-1)} className="btn-png-action"><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#1e293b', textTransform: 'uppercase', minWidth: '90px', textAlign: 'center' }}>{dataFiltro.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}</span>
              <button onClick={() => mudarMes(1)} className="btn-png-action"><ChevronRight size={16} /></button>
            </div>
          </div>
          {showFilters && (
            <div className="advanced-filters-row" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <select value={filtroCategoriaId} onChange={(e) => setFiltroCategoriaId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <option value="">Todas as Categorias</option>
                {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
              </select>
              <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} disabled={!temPermissaoGeral()} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <option value="">Todos Responsáveis</option>
                {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <main className="desp-list-panel">
          {loading && <div style={{textAlign: 'center', padding: '20px'}}><Loader2 className="animate-spin" /></div>}
          {!loading && Object.entries(secoesAgrupadas).map(([titulo, itens]) => (
            <div key={titulo} style={{marginBottom: '25px'}}>
              <div className="list-header" style={{ background: '#ffffff', borderRadius: '16px 16px 0 0' }}>
                <h3 style={{fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800, color: '#475569', margin: 0}}>{titulo}</h3>
                <span style={{fontSize: '0.85rem', fontWeight: 800, color: '#ef4444'}}>{formatarMoeda(itens.reduce((acc, curr) => acc + (curr.valor_projetado || 0), 0))}</span>
              </div>
              <div className="desp-panel-list" style={{borderRadius: '0 0 16px 16px'}}>
                {itens.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="desp-item-row" onClick={() => handleAbrirModal(item)}>
                    <div className="desp-icon-column">
                      <div className="desp-icon-box" style={{ backgroundColor: `${item.categorias?.cor}15`, color: item.categorias?.cor || '#ef4444' }}><ShoppingCart size={20} /></div>
                    </div>
                    <div className="desp-main-content">
                      <div className="desp-top-line">
                        <span className="desp-desc">
                          {item.descricao} 
                          {item.parcelado && <span style={{fontSize: '0.7rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px'}}>{item.parcela_atual}/{item.parcelas_total}</span>}
                          {item.recorrencia_id && !item.parcelado && <Repeat size={12} style={{marginLeft: '6px', color: '#6366f1'}} />}
                          {!temPermissaoEscrita(item) && <Lock size={12} style={{opacity: 0.4, marginLeft: '6px'}} />}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.status_pagamento === 'pago' && <CheckCircle2 size={16} color="#10b981" />}
                          <span className={`desp-value ${item.status_pagamento === 'pago' ? 'value-paid' : 'value-negative'}`}>
                            {formatarMoeda(item.valor_projetado || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="desp-meta-line">
                        <span className="meta-tag"><Calendar size={12} /> {item.data_compra.split('-').reverse().slice(0,2).join('/')}</span>
                        <span className="meta-tag"><Tag size={12} /> {item.categorias?.nome || 'S/ Categoria'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </main>

        {isModalOpen && itemEditando && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="edit-modal-container" onClick={e => e.stopPropagation()}>
              <div className="edit-modal-header">
                <div>
                  <h2 style={{margin: 0, fontWeight: 900, fontSize: '1.25rem'}}>{ temPermissaoEscrita(itemEditando) ? 'Editar Lançamento' : 'Visualizar Detalhes' }</h2>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
                    {itemEditando.status_pagamento === 'pago' && (
                      <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <CheckCircle2 size={10} color="#10b981" />
                        <span style={{fontSize: '0.65rem', color: '#10b981', fontWeight: 700}}>PAGO</span>
                      </div>
                    )}
                    { itemEditando.recorrencia_id && <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}><Repeat size={10} color="#6366f1" /><span style={{fontSize: '0.65rem', color: '#6366f1', fontWeight: 700}}>RECORRENTE</span></div>}
                    { !temPermissaoEscrita(itemEditando) && <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}><Lock size={10} color="#ef4444" /><span style={{fontSize: '0.65rem', color: '#ef4444', fontWeight: 700}}>VISUALIZAÇÃO</span></div>}
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="btn-png-action"><img src={iconFechar} alt="Fechar" style={{width: '32px'}} /></button>
              </div>
              <div className="edit-modal-body">
                <form id="edit-form" className="edit-form-grid" onSubmit={handleSalvarEdicao}>
                  <div className="form-group"><label>Descrição</label><input type="text" value={itemEditando.descricao || ''} onChange={e => handleChangeEdit('descricao', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} required /></div>
                  
                  {itemEditando.recorrencia_id && (
                    <div className="form-group" style={{background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px dashed #6366f1', marginBottom: '10px'}}>
                      <label style={{color: '#6366f1', fontWeight: 800}}>{itemEditando.parcelado ? 'Ajustar Valor Total (Contrato)' : 'Valor Base da Recorrência'}</label>
                      <input 
                        type="text" 
                        style={{color: '#6366f1', fontWeight: 900, fontSize: '1.1rem', borderBottom: '2px solid #6366f1'}}
                        value={itemEditando.valor_pai_exibicao || ''} 
                        onChange={e => { 
                          let val = e.target.value.replace(/\D/g, ""); 
                          val = (Number(val) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); 
                          handleChangeEdit('valor_pai_exibicao', val); 
                        }} 
                        disabled={!temPermissaoEscrita(itemEditando) || itemEditando.status_pagamento === 'pago'} 
                        required 
                      />
                      <small style={{fontSize: '0.6rem', color: '#64748b'}}>
                        {itemEditando.status_pagamento === 'pago' 
                          ? 'Não é possível alterar o contrato de um item já pago.' 
                          : 'Ao alterar aqui, as DEMAIS parcelas serão atualizadas proporcionalmente.'}
                      </small>
                    </div>
                  )}

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Valor {itemEditando.parcelado ? 'da Parcela Atual' : 'Deste Registro'}</label>
                      <input 
                        type="text" 
                        value={itemEditando.valor_exibicao || ''} 
                        onChange={e => { 
                          let val = e.target.value.replace(/\D/g, ""); 
                          val = (Number(val) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); 
                          handleChangeEdit('valor_exibicao', val); 
                        }} 
                        disabled={!temPermissaoEscrita(itemEditando) || (itemEditando.recorrencia_id && itemEditando.status_pagamento !== 'pago')} 
                        required 
                      />
                      {itemEditando.recorrencia_id && (
                        <small style={{fontSize: '0.6rem', color: '#ef4444', fontWeight: 700}}>
                          {itemEditando.status_pagamento === 'pago' 
                            ? 'Parcela quitada: valor bloqueado.' 
                            : 'Para pendentes, altere o valor total acima para recalcular.'}
                        </small>
                      )}
                    </div>
                    <div className="form-group"><label>Data</label><input type="date" value={itemEditando.data_compra || ''} onChange={e => handleChangeEdit('data_compra', e.target.value)} disabled={!temPermissaoEscrita(itemEditando) || itemEditando.status_pagamento === 'pago'} required /></div>
                  </div>

                  <div className="form-group"><label>Loja</label><div style={{position: 'relative'}}><Store size={18} style={{position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8'}} /><input style={{paddingLeft: '44px'}} type="text" value={itemEditando.loja || ''} onChange={e => handleChangeEdit('loja', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} /></div></div>
                  <div className="form-row-2">
                    <div className="form-group"><label>Categoria</label><select value={itemEditando.categoria_id} onChange={e => handleChangeEdit('categoria_id', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)}>{categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}</select></div>
                    <div className="form-group"><label>Responsável</label><select value={itemEditando.user_id} onChange={e => handleChangeEdit('user_id', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)}>{responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group"><label>Pagamento</label><select value={itemEditando.forma_pagamento} onChange={e => handleChangeEdit('forma_pagamento', e.target.value)} disabled={!temPermissaoEscrita(itemEditando) || itemEditando.status_pagamento === 'pago'}>{formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                    {itemEditando.forma_pagamento === 'Crédito' && <div className="form-group"><label>Cartão</label><select value={itemEditando.cartao || ''} onChange={e => handleChangeEdit('cartao', e.target.value)} disabled={!temPermissaoEscrita(itemEditando) || itemEditando.status_pagamento === 'pago'}><option value="">Selecione</option>{cartoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>}
                  </div>
                  {itemEditando.parcelado && <div className="form-group"><label>Parcelas Totais</label><input type="number" value={itemEditando.parcelas_total || 1} disabled={true} /> <small style={{fontSize: '0.65rem', color: '#64748b'}}>Edite a recorrência para mudar o parcelamento</small></div>}
                  <div className="form-row-2">
                    <div className="form-group"><label>Nota Fiscal</label><input type="text" value={itemEditando.nota_fiscal || ''} onChange={e => handleChangeEdit('nota_fiscal', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} /></div>
                    <div className="form-group"><label>Pedido</label><input type="text" value={itemEditando.pedido || ''} onChange={e => handleChangeEdit('pedido', e.target.value)} disabled={!temPermissaoEscrita(itemEditando)} /></div>
                  </div>
                </form>
              </div>
              <div className="edit-modal-footer">
                { temPermissaoEscrita(itemEditando) ? (
                  <>
                    <button className="btn-png-action" onClick={handleExcluir}><img src={iconExcluir} alt="Excluir" /></button>
                    <div style={{display: 'flex', gap: '16px'}}>
                      <button className="btn-png-action" onClick={() => setIsModalOpen(false)}><img src={iconCancelar} alt="Cancelar" /></button>
                      <button type="submit" form="edit-form" className="btn-png-action"><img src={iconConfirme} alt="Salvar" /></button>
                    </div>
                  </>
                ) : (
                  <div style={{width: '100%', textAlign: 'center'}}><button className="btn-png-action" onClick={() => setIsModalOpen(false)}><img src={iconCancelar} alt="Voltar" /></button></div>
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

export default Despesas;