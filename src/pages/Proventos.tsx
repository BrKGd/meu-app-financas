import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Filter, X, Calendar, Tag, Landmark, Save, Trash2, User,
  ChevronLeft, ChevronRight, Loader2, Target, TrendingUp, Lock
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Proventos.css';

// --- Assets ---
import iconConfirme from '../assets/confirme.png';
import iconExcluir from '../assets/excluir.png';
import iconCancelar from '../assets/cancelar.png';
import iconFechar from '../assets/fechar.png';

interface Provento {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  responsavel_id: string;
  data_recebimento: string;
  user_id?: string;
}

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
}

interface Responsavel {
  id: string;
  nome: string;
}

interface Meta {
  valor_meta: string;
  tipo_meta: string;
}

const Proventos: React.FC = () => {
  const [lista, setLista] = useState<Provento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [tetoMetas, setTetoMetas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editandoItem, setEditandoItem] = useState<Provento | null>(null);
  
  const [userRole, setUserRole] = useState<'comum' | 'administrador' | 'proprietario'>('comum');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [dataFiltro, setDataFiltro] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'danger';
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, type: 'success', title: '', message: '', onConfirm: null });

  const [form, setForm] = useState({ 
    descricao: '', 
    valor_exibicao: 'R$ 0,00', 
    categoria_nome: '', 
    responsavel_id: '', 
    data: new Date().toISOString().split('T')[0] 
  });

  const alertar = (type: any, title: string, message: string, onConfirm: (() => void) | null = null) => {
    setFeedback({ isOpen: true, type, title, message, onConfirm });
  };

  const formatMoney = (v: number) => 
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('tipo_usuario')
        .eq('id', user.id)
        .single();
      
      const role = profile?.tipo_usuario || 'comum';
      setUserRole(role);

      const mesAlvo = dataFiltro.getMonth() + 1;
      const anoAlvo = dataFiltro.getFullYear();

      let queryProventos = (supabase.from('proventos') as any).select('*');
      
      if (role === 'comum') {
        queryProventos = queryProventos.eq('user_id', user.id);
      }

      const [resProvs, resCats, resProfs, resMetas] = await Promise.all([
        queryProventos.order('data_recebimento', { ascending: false }),
        (supabase.from('categorias') as any).select('*').eq('tipo', 'provento').order('nome'),
        (supabase.from('profiles') as any).select('id, nome').order('nome'),
        (supabase.from('metas') as any).select('valor_meta, tipo_meta').eq('mes_referencia', mesAlvo).eq('ano_referencia', anoAlvo)
      ]);

      setCategorias(resCats.data || []);
      setResponsaveis(resProfs.data || []);

      const somaMetas = (resMetas.data as Meta[] || [])
        .filter(m => m.tipo_meta === 'provento')
        .reduce((acc, cur) => acc + parseFloat(cur.valor_meta), 0);
      setTetoMetas(somaMetas);

      const filtradosPorData = (resProvs.data || []).filter((item: Provento) => {
        const data = new Date(item.data_recebimento + 'T12:00:00'); 
        return data.getMonth() === dataFiltro.getMonth() && data.getFullYear() === anoAlvo;
      });

      setLista(filtradosPorData);
    } catch (error: any) {
      console.error("Erro:", error.message);
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  const secoesAgrupadas = useMemo(() => {
    const filtradas = lista.filter(item => {
      const matchSearch = item.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      const matchResp = filtroResponsavel ? item.responsavel_id === filtroResponsavel : true;
      const matchCat = filtroCategoria ? item.categoria === filtroCategoria : true;
      return matchSearch && matchResp && matchCat;
    });

    const grupos: Record<string, Provento[]> = {};
    filtradas.forEach(item => {
      const chave = item.categoria || 'Outros';
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(item);
    });
    return grupos;
  }, [lista, searchTerm, filtroResponsavel, filtroCategoria]);

  const totalProventos = useMemo(() => 
    lista.reduce((acc, cur) => acc + (cur.valor || 0), 0), 
  [lista]);

  const porcentagemAtingida = useMemo(() => {
    if (tetoMetas === 0) return 0;
    return Math.round((totalProventos / tetoMetas) * 100);
  }, [totalProventos, tetoMetas]);

  const handleMascaraMoeda = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "");
    const valorNumerico = (Number(valor) / 100).toFixed(2);
    setForm({ ...form, valor_exibicao: formatMoney(Number(valorNumerico)) });
  };

  const abrirModalNovo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setEditandoItem(null);
    setForm({ 
      descricao: '', 
      valor_exibicao: 'R$ 0,00', 
      categoria_nome: categorias[0]?.nome || '', 
      responsavel_id: user?.id || (responsaveis[0]?.id || ''), 
      data: new Date().toISOString().split('T')[0] 
    });
    setShowModal(true);
  };

  const abrirModalEditar = (item: Provento) => {
    // NOVA TRAVA: Se for administrador mas não for o dono do registro, impede a edição
    const isOwner = item.user_id === currentUserId;
    if (userRole === 'administrador' && !isOwner) {
      alertar('warning', 'Acesso Negado', 'Administradores só podem editar seus próprios lançamentos.');
      return;
    }

    setEditandoItem(item);
    setForm({
      descricao: item.descricao,
      valor_exibicao: formatMoney(item.valor),
      categoria_nome: item.categoria,
      responsavel_id: item.responsavel_id || '',
      data: item.data_recebimento
    });
    setShowModal(true);
  };

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const valorLimpo = Number(form.valor_exibicao.replace(/\D/g, '')) / 100;

      const dadosProvento = {
        user_id: user.id,
        descricao: form.descricao,
        valor: valorLimpo,
        categoria: form.categoria_nome,
        responsavel_id: userRole === 'administrador' ? user.id : form.responsavel_id,
        data_recebimento: form.data
      };

      const { error } = editandoItem 
        ? await (supabase.from('proventos') as any).update(dadosProvento).eq('id', editandoItem.id)
        : await (supabase.from('proventos') as any).insert([dadosProvento]);

      if (error) throw error;
      setShowModal(false);
      buscarDados();
      alertar('success', 'Sucesso!', 'Dados salvos com sucesso.');
    } catch (error: any) { alertar('error', 'Erro ao salvar', error.message); }
  }

  const confirmarExclusao = () => {
    alertar('danger', 'Excluir Registro?', 'Esta ação não pode ser desfeita.', async () => {
      if (!editandoItem) return;
      const { error } = await (supabase.from('proventos') as any).delete().eq('id', editandoItem.id);
      if (!error) {
        setShowModal(false);
        setFeedback(prev => ({ ...prev, isOpen: false }));
        buscarDados();
      } else {
        alertar('error', 'Erro ao excluir', 'Você não tem permissão para excluir este registro.');
      }
    });
  };

  return (
    <>
      <style>{`
        .prov-edit-modal {
          width: 100%; max-width: 100%; max-height: 85vh; background: white;
          border-radius: 28px; padding: 20px 15px 10px 15px; position: relative;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); z-index: 1001;
          overflow-y: auto; display: flex; flex-direction: column; scrollbar-gutter: stable;
        }

        .prov-edit-modal::-webkit-scrollbar { width: 8px; }
        .prov-edit-modal::-webkit-scrollbar-track { background: transparent; margin: 20px; }
        .prov-edit-modal::-webkit-scrollbar-thumb { 
          background: #e2e8f0; border-radius: 10px; border: 2px solid white; 
        }

        .btn-png-action {
          background: none; border: none; cursor: pointer; padding: 0; transition: transform 0.2s;
        }
        .btn-png-action img { width: 38px; height: 38px; object-fit: contain; }
        .btn-png-action:hover { transform: scale(1.1); }

        .modal-header-actions {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
        }

        .modal-footer-btns {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9;
        }

        .prov-form-grid { display: flex; flex-direction: column; gap: 16px; }

        .form-group label {
          font-size: 0.65rem; font-weight: 800; color: #64748b;
          margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.5px;
        }

        .form-group input, .form-group select {
          width: 100%; padding: 12px; border: 1.5px solid #e2e8f0;
          border-radius: 12px; font-size: 0.95rem; outline: none; background: #f8fafc;
        }

        .form-group input:focus, .form-group select:focus {
          border-color: #10b981; background: white;
        }
        
        .form-group select:disabled {
          cursor: not-allowed; opacity: 0.7; background: #f1f5f9;
        }

        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .card-progresso-container {
            background: #10b981;
            color: white;
            padding: 24px;
            border-radius: 24px;
            box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2);
            position: relative;
            overflow: hidden;
        }

        /* Estilo para itens bloqueados */
        .prov-item-row.locked {
          cursor: not-allowed;
          opacity: 0.8;
        }
        .prov-item-row.locked:hover {
          background: #f8fafc;
          transform: none;
        }

        @media (max-width: 480px) {
          .prov-edit-modal { width: 100%; border-radius: 24px 24px 0 0; position: fixed; bottom: 0; max-height: 90vh; }
          .modal-overlay { align-items: flex-end; }
          .form-row-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="proventos-premium-wrapper">
        <div className="prov-top-layout">
          <header className="prov-panel prov-header-area">
            <div className="prov-title-area">
              <h1>Central de Proventos</h1>
              <p>{userRole === 'comum' ? 'Meus Recebimentos' : 'Gestão Geral de Entradas'}</p>
            </div>
          </header>

          <section className="card-progresso-container">
            <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Total {userRole === 'comum' ? 'Meu' : 'Lançado'} no Mês
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0' }}>
                <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0 }}>
                    {formatMoney(totalProventos).split(',')[0]}
                    <span style={{ fontSize: '1.2rem', opacity: 0.9 }}>,{formatMoney(totalProventos).split(',')[1]}</span>
                </h2>
                <span style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.8 }}>
                    / {formatMoney(tetoMetas)}
                </span>
            </div>
            
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                {porcentagemAtingida}% do planejado já recebido.
            </p>
          </section>
        </div>

        <div className="filter-container-premium" style={{ margin: '20px 0' }}>
          <div className="search-wrapper" style={{ display: 'flex', gap: '10px', background: 'white', padding: '10px 15px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <input type="text" placeholder="Pesquisar provento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem' }} />
            <button onClick={() => setShowFilters(!showFilters)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: showFilters ? '#10b981' : '#64748b' }}><Filter size={20} /></button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <div className="mes-selector-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 14px', borderRadius: '100px', border: '1px solid #e2e8f0' }}>
              <button onClick={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><ChevronLeft size={16} /></button>
              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#1e293b', textTransform: 'uppercase', minWidth: '90px', textAlign: 'center' }}>
                {dataFiltro.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}
              </span>
              <button onClick={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><ChevronRight size={16} /></button>
            </div>
          </div>

          {showFilters && (
            <div className="advanced-filters-row" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.85rem' }}>
                <option value="">Todas Categorias</option>
                {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.85rem' }}>
                <option value="">Todos Responsáveis</option>
                {responsaveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <main className="prov-panel" style={{padding: 0, background: 'transparent', boxShadow: 'none'}}>
          {loading ? (
            <div className="prov-panel" style={{padding: '40px', textAlign: 'center', background: 'white', borderRadius: '24px'}}>
              <Loader2 className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            Object.entries(secoesAgrupadas).map(([titulo, itens]) => (
              <div key={titulo} className="prov-section-container" style={{marginBottom: '25px'}}>
                <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#ffffff', borderRadius: '16px 16px 0 0', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800, color: '#475569', margin: 0}}>{titulo}</h3>
                  <span style={{fontSize: '0.85rem', fontWeight: 800, color: '#10b981'}}>{formatMoney(itens.reduce((acc, curr) => acc + (curr.valor || 0), 0))}</span>
                </div>
                <div className="prov-panel-list" style={{borderRadius: '0 0 16px 16px', background: 'white'}}>
                  {itens.map((item, idx) => {
                    const isOwner = item.user_id === currentUserId;
                    const canEdit = userRole !== 'administrador' || isOwner;

                    return (
                      <div 
                        key={`${item.id}-${idx}`} 
                        className={`prov-item-row ${!canEdit ? 'locked' : ''}`}
                        onClick={() => canEdit ? abrirModalEditar(item) : abrirModalEditar(item)} // O alert interno lidará com o aviso
                      >
                        <div className="prov-icon-column">
                          <div className="prov-icon-box" style={{ background: isOwner ? '#10b98115' : '#f1f5f9', color: isOwner ? '#10b981' : '#94a3b8' }}>
                            {canEdit ? <Landmark size={20} /> : <Lock size={18} />}
                          </div>
                        </div>
                        <div className="prov-main-content">
                          <div className="prov-top-line">
                            <span className="prov-desc">{item.descricao}</span>
                            <span className="prov-value value-positive" style={{ color: '#10b981' }}>{formatMoney(item.valor)}</span>
                          </div>
                          <div className="prov-meta-line">
                            <span className="meta-tag"><Calendar size={12} /> {item.data_recebimento.split('-').reverse().slice(0,2).join('/')}</span>
                            <span className="meta-divider">•</span>
                            <span className="meta-tag"><Tag size={12} /> {item.categoria}</span>
                            <span className="meta-divider">•</span>
                            <span className="meta-tag"><User size={12} /> {responsaveis.find(r => r.id === item.responsavel_id)?.nome.split(' ')[0] || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </main>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <form className="prov-edit-modal" onClick={e => e.stopPropagation()} onSubmit={handleSalvar}>
              <div className="modal-header-actions">
                <h2 style={{margin: 0, fontWeight: 900, fontSize: '1.2rem'}}>{editandoItem ? 'Editar Provento' : 'Novo Recebimento'}</h2>
                <button type="button" onClick={() => setShowModal(false)} className="btn-png-action">
                  <img src={iconFechar} alt="Fechar" />
                </button>
              </div>

              <div className="prov-form-grid">
                <div className="form-group">
                  <label>Descrição do Recebimento</label>
                  <input type="text" required value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Valor</label>
                    <input type="text" required value={form.valor_exibicao} onChange={handleMascaraMoeda} />
                  </div>
                  <div className="form-group">
                    <label>Data de Recebimento</label>
                    <input type="date" required value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Categoria</label>
                    <select value={form.categoria_nome} onChange={e => setForm({...form, categoria_nome: e.target.value})} required>
                      {categorias.map(cat => <option key={cat.id} value={cat.nome}>{cat.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Responsável</label>
                    <select 
                      value={form.responsavel_id} 
                      onChange={e => setForm({...form, responsavel_id: e.target.value})} 
                      required
                      disabled={userRole === 'administrador'}
                    >
                      {userRole === 'administrador' ? (
                        <option value={currentUserId || ''}>
                          {responsaveis.find(r => r.id === currentUserId)?.nome || 'Eu mesmo'}
                        </option>
                      ) : (
                        <>
                          <option value="">Selecione...</option>
                          {responsaveis.map(resp => <option key={resp.id} value={resp.id}>{resp.nome}</option>)}
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer-btns">
                {/* Botão de excluir só aparece se for o dono do registro */}
                <button 
                  type="button" 
                  className="btn-png-action" 
                  onClick={confirmarExclusao} 
                  style={{ visibility: (editandoItem && editandoItem.user_id === currentUserId) ? 'visible' : 'hidden' }}
                >
                  <img src={iconExcluir} alt="Excluir" />
                </button>
                <div style={{display: 'flex', gap: '20px'}}>
                  <button type="button" className="btn-png-action" onClick={() => setShowModal(false)}>
                    <img src={iconCancelar} alt="Cancelar" />
                  </button>
                  <button type="submit" className="btn-png-action">
                    <img src={iconConfirme} alt="Confirmar" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      <ModalFeedback isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.message} onClose={() => setFeedback({ ...feedback, isOpen: false })} onConfirm={feedback.onConfirm || undefined} />
      <button className="prov-fab" onClick={abrirModalNovo} style={{ background: '#10b981' }}><Plus size={30} /></button>
    </>
  );
};

export default Proventos;