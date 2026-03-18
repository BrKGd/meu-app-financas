import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

// Importação total da Lucide
import * as LucideIcons from 'lucide-react';

// Componentes e Estilos
import ModalFeedback, { ModalType } from '../components/ModalFeedback';
import '../styles/CategoriasMetas.css';

// Assets PNG
import iconConfirme from '../assets/confirme.png';
import iconExcluir from '../assets/excluir.png';
import iconCancelar from '../assets/cancelar.png';
import iconFechar from '../assets/fechar.png';

// --- Interfaces ---
interface Perfil {
  id: string;
  tipo_usuario: 'proprietario' | 'administrador' | 'comum';
}

interface Categoria {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  cor: string;
  icone?: string;
}

interface Meta {
  id: string;
  user_id: string;
  categoria_id: string;
  nome_meta: string;
  valor_meta: number;
  tipo_meta: string;
  mes_referencia: number;
  ano_referencia: number;
  cor_meta: string | null;
}

// --- Definição das Categorias Lucide ---
const ICON_CATEGORIES = [
  {
    label: 'Finanças e Comércio',
    description: 'Ícones para dinheiro, moedas, cartões e transações.',
    icons: ['Wallet', 'PiggyBank', 'CreditCard', 'Coins', 'Banknote', 'CircleDollarSign', 'Landmark', 'Receipt', 'ShoppingCart', 'BadgeDollarSign']
  },
  {
    label: 'Gráficos e Análise',
    description: 'Visualização de dados, tendências e crescimento.',
    icons: ['TrendingUp', 'TrendingDown', 'BarChart3', 'PieChart', 'LineChart', 'Activity', 'ArrowUpRight', 'ArrowDownLeft', 'Target', 'Percent']
  },
  {
    label: 'Estilo de Vida',
    description: 'Saúde, alimentação, lazer e transporte.',
    icons: ['Utensils', 'Coffee', 'Car', 'Home', 'Plane', 'Dumbbell', 'Heart', 'Tv', 'Gamepad2', 'ShoppingBag', 'Briefcase', 'GraduationCap', 'Stethoscope']
  },
  {
    label: 'Interface e Ação',
    description: 'Ícones comuns para navegação e estados do sistema.',
    icons: ['Star', 'Bell', 'Settings', 'ShieldCheck', 'Calendar', 'Clock', 'Search', 'Filter', 'Plus', 'Pencil', 'Trash2', 'Flag', 'Info']
  },
  {
    label: 'Tecnologia',
    description: 'Dispositivos, rede e comunicação.',
    icons: ['Smartphone', 'Laptop', 'Wifi', 'Mail', 'MessageCircle', 'HardDrive', 'Cpu', 'Zap']
  }
];

const CategoriasMetas: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [metasMes, setMetasMes] = useState<Meta[]>([]);
  const [activeTab, setActiveTab] = useState<'despesa' | 'provento' | 'pessoal'>('despesa');
  
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false); 
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [form, setForm] = useState({ 
    nome: '', 
    cor: '#4361ee', 
    icone: 'Wallet',
    valor_meta: '' as string | number
  });

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const RenderIcon = useCallback(({ name, size = 24, className = '' }: { name: string, size?: number, className?: string }) => {
    const IconComponent = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
    if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') {
      return <LucideIcons.HelpCircle size={size} className={className} />;
    }
    return <IconComponent size={size} className={className} />;
  }, []);

  const alertar = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setFeedback({ isOpen: true, type, title, message, onConfirm });
  };

  const getContrastColor = (hexcolor: string) => {
    if (!hexcolor) return '#ffffff';
    const hex = hexcolor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#1e293b' : '#ffffff';
  };

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('id, tipo_usuario').eq('id', user.id).single();
      setPerfil(profile);
      const [resCats, resMetas] = await Promise.all([
        supabase.from('categorias').select('*').order('nome'),
        supabase.from('metas').select('*').eq('mes_referencia', mes).eq('ano_referencia', ano)
      ]);
      setCategorias((resCats.data as Categoria[]) || []);
      setMetasMes((resMetas.data || []).map((m: any) => ({ ...m, valor_meta: parseFloat(m.valor_meta) || 0 })));
    } catch (error: any) {
      console.error("Erro:", error.message);
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  const cardsParaExibir = useMemo(() => {
    return categorias
      .filter(c => c.tipo === activeTab)
      .map(cat => {
        const meta = metasMes.find(m => m.categoria_id === cat.id);
        return {
          categoria_id: cat.id,
          user_id: cat.user_id,
          id_meta: meta?.id || null,
          nome: cat.nome,
          cor: cat.cor,
          icone: cat.icone || 'Wallet',
          valor_meta: meta?.valor_meta || 0,
          existe_meta: !!meta
        };
      });
  }, [categorias, metasMes, activeTab]);

  const totalPlanejado = useMemo(() => {
    return metasMes
      .filter(m => m.tipo_meta === activeTab)
      .reduce((acc, curr) => acc + (Number(curr.valor_meta) || 0), 0);
  }, [metasMes, activeTab]);

  const podeEditar = (item: any) => {
    if (!perfil) return false;
    if (perfil.tipo_usuario === 'proprietario') return true;
    return perfil.tipo_usuario === 'administrador' && (!item || item.user_id === perfil.id);
  };

  const openModal = (item: any = null) => {
    if (item) {
      setSelectedItem(item);
      setForm({
        nome: item.nome,
        cor: item.cor,
        icone: item.icone || 'Wallet',
        valor_meta: item.existe_meta ? item.valor_meta : ''
      });
      setIsEditing(false);
    } else {
      setSelectedItem(null);
      const corPadrao = activeTab === 'provento' ? '#00AB59' : activeTab === 'pessoal' ? '#8b5cf6' : '#4361ee';
      setForm({ nome: '', cor: corPadrao, icone: 'Wallet', valor_meta: '' });
      setIsEditing(true);
    }
    setIsModalOpen(true);
  };

  const handleCancelarEdicao = () => {
    if (selectedItem && isEditing) {
      setForm({
        nome: selectedItem.nome,
        cor: selectedItem.cor,
        icone: selectedItem.icone || 'Wallet',
        valor_meta: selectedItem.existe_meta ? selectedItem.valor_meta : ''
      });
      setIsEditing(false);
    } else {
      setIsModalOpen(false);
    }
  };

  async function handleSalvar(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let currentCatId = selectedItem?.categoria_id;
      if (!currentCatId || isEditing) {
        const catPayload = { nome: form.nome, tipo: activeTab, cor: form.cor, icone: form.icone, user_id: user.id };
        if (currentCatId) {
          await supabase.from('categorias').update(catPayload).eq('id', currentCatId);
        } else {
          const { data: newCat } = await (supabase.from('categorias') as any).insert(catPayload).select().single();
          currentCatId = newCat.id;
        }
      }
      const valorNum = typeof form.valor_meta === 'string' ? parseFloat(form.valor_meta.replace(',', '.')) : form.valor_meta;
      await (supabase.from('metas') as any).upsert({
        id: selectedItem?.id_meta || undefined,
        user_id: user.id,
        categoria_id: currentCatId,
        valor_meta: valorNum || 0,
        tipo_meta: activeTab,
        mes_referencia: mes,
        ano_referencia: ano,
        nome_meta: form.nome,
        cor_meta: form.cor
      });
      setIsModalOpen(false);
      buscarDados();
      alertar('success', 'Sucesso!', 'Dados salvos com sucesso.');
    } catch (error: any) {
      alertar('error', 'Erro', error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleExcluirCascata = () => {
    if (!selectedItem?.categoria_id) return;
    alertar('danger', 'Confirmar Exclusão', `Deseja excluir "${selectedItem.nome}"?`, async () => {
      setLoading(true);
      try {
        await supabase.from('metas').delete().eq('categoria_id', selectedItem.categoria_id);
        await supabase.from('categorias').delete().eq('id', selectedItem.categoria_id);
        setIsModalOpen(false);
        buscarDados();
      } catch (error: any) {
        alertar('error', 'Erro', error.message);
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <>
      <div className="cat-page-wrapper metas-container fade-in">
        <header className="metas-header">
          <div className="cat-title-area">
            <div className="titulo-secao">
              <LucideIcons.Flag className="w-7 h-7" />
              <h1>Planejamento</h1>
            </div>
            <p className="subtitulo-metas">Orçamento mensal e objetivos</p>
          </div>

          <div className="header-controls">
            <div className="seletor-periodo">
              <button onClick={() => setMes(m => m === 1 ? 12 : m - 1)}><LucideIcons.ChevronLeft /></button>
              <span className="periodo-display">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(ano, mes - 1))} {ano}
              </span>
              <button onClick={() => setMes(m => m === 12 ? 1 : m + 1)}><LucideIcons.ChevronRight /></button>
            </div>

            <div className="badge-planejado-modern">
                <div className={`badge-icon-wrapper ${activeTab === 'despesa' ? 'bg-red' : 'bg-green'}`}>
                  {activeTab === 'despesa' ? <LucideIcons.TrendingDown /> : <LucideIcons.Wallet />}
                </div>
                <span className="badge-text">
                  Total {activeTab === 'despesa' ? 'Planejado' : 'Esperado'}: 
                  <strong> {totalPlanejado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </span>
            </div>
          </div>
        </header>

        <nav className="metas-tabs">
          <button className={activeTab === 'despesa' ? 'active' : ''} onClick={() => setActiveTab('despesa')}><LucideIcons.TrendingDown /> Gastos</button>
          <button className={activeTab === 'provento' ? 'active' : ''} onClick={() => setActiveTab('provento')}><LucideIcons.DollarSign /> Receitas</button>
          <button className={activeTab === 'pessoal' ? 'active' : ''} onClick={() => setActiveTab('pessoal')}><LucideIcons.Star /> Objetivos</button>
        </nav>

        {loading ? (
          <div className="cat-status"><div className="spinner-loader"></div></div>
        ) : (
          <div className="grid-metas-modern">
            {cardsParaExibir.map((item) => (
              <div 
                key={item.categoria_id} 
                className="card-financeiro-flux" 
                style={{ '--card-color': item.cor } as React.CSSProperties} 
                onClick={() => openModal(item)}
              >
                <div className="card-bg-icon">
                  <RenderIcon name={item.icone} size={160} />
                </div>
                <div className="card-content-top">
                  <div className="card-icon-small">
                    <RenderIcon name={item.icone} size={20} />
                  </div>
                  <span className="card-label-top">{item.nome}</span>
                </div>
                <div className="card-main-info">
                  <h2 className="card-value-display">
                    {item.valor_meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h2>
                  <p className="card-subtitle-bottom">{item.existe_meta ? 'Planejado' : 'Não planejado'}</p>
                </div>
                <div className="card-edit-indicator">
                  {podeEditar(item) ? <LucideIcons.Pencil /> : <LucideIcons.Lock />}
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="modal-overlay" onClick={handleCancelarEdicao}>
            <div className="modal-content modal-expanded fade-in" onClick={(e) => e.stopPropagation()}>
              
              <div 
                className="modal-details-header" 
                style={{ 
                    background: isEditing ? '#1e293b' : `linear-gradient(135deg, ${form.cor} 0%, #1e293b 100%)`,
                    color: !isEditing ? getContrastColor(form.cor) : '#ffffff'
                }}
              >
                <div className="modal-header-top">
                  <div className="modal-title-text">
                    <RenderIcon name={form.icone} size={28} />
                    <h2>
                      {!selectedItem ? 'Nova Categoria' : isEditing ? 'Configurar Categoria' : form.nome}
                    </h2>
                  </div>

                  <div className="modal-header-actions">
                    {selectedItem && !isEditing && podeEditar(selectedItem) && (
                      <button type="button" className="btn-icon-action" onClick={() => setIsEditing(true)}>
                        <LucideIcons.Settings2 size={32} />
                      </button>
                    )}
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-icon-action">
                      <img src={iconFechar} className="icon-32" alt="Fechar" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-body-padding">
                <form id="meta-form" onSubmit={handleSalvar} className="form-flex-column">
                  <div className="form-group">
                    <label className="form-label-custom">Nome</label>
                    <input className="form-control" value={form.nome} disabled={!isEditing} onChange={e => setForm({...form, nome: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label-custom">Valor do Planejamento (R$)</label>
                    <input className="form-control" type="number" step="0.01" value={form.valor_meta} disabled={!isEditing} onChange={e => setForm({...form, valor_meta: e.target.value})} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label-custom">Ícone</label>
                    <div className="icon-picker-container">
                      {ICON_CATEGORIES.map((cat) => (
                        <div key={cat.label} className="icon-cat-section">
                          <h4>{cat.label}</h4>
                          <p>{cat.description}</p>
                          <div className="icon-grid-selector-inner">
                            {cat.icons.map((iconName) => (
                              <button
                                key={iconName}
                                type="button"
                                className={`icon-option-btn ${form.icone === iconName ? 'selected' : ''}`}
                                onClick={() => isEditing && setForm({...form, icone: iconName})}
                                disabled={!isEditing}
                                style={{ '--active-color': form.cor } as React.CSSProperties}
                              >
                                <RenderIcon name={iconName} size={24} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label-custom">Cor</label>
                    <div className="color-picker-wrapper">
                      <input type="color" className="input-color-square" value={form.cor} disabled={!isEditing} onChange={e => setForm({...form, cor: e.target.value})} />
                      <input type="text" className="form-control hex-input" value={form.cor.toUpperCase()} disabled={!isEditing} onChange={e => setForm({...form, cor: e.target.value})} maxLength={7} />
                    </div>
                  </div>
                </form>
              </div>

              <div className="modal-footer-icons-container">
                {selectedItem && isEditing && podeEditar(selectedItem) ? (
                  <button type="button" className="btn-icon-action" onClick={handleExcluirCascata}>
                    <img src={iconExcluir} className="icon-38" alt="Excluir" />
                  </button>
                ) : <div />}
                
                <div className="footer-right-actions">
                  <button type="button" className="btn-icon-action" onClick={handleCancelarEdicao}>
                    <img src={iconCancelar} className="icon-38" alt="Cancelar" />
                  </button>
                  {isEditing && (
                    <button type="submit" form="meta-form" className="btn-icon-action">
                      <img src={iconConfirme} className="icon-38" alt="Confirmar" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        <ModalFeedback 
          isOpen={feedback.isOpen} 
          type={feedback.type} 
          title={feedback.title} 
          message={feedback.message} 
          onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))} 
          onConfirm={feedback.onConfirm} 
        />
      </div>

      {perfil?.tipo_usuario !== 'comum' && (
        <button 
          className="cat-fab" 
          onClick={() => openModal()} 
          style={{ background: activeTab === 'provento' ? '#00AB59' : activeTab === 'pessoal' ? '#8b5cf6' : '#4361ee' }}
        >
          <LucideIcons.Plus size={32} />
        </button>
      )}
    </>
  );
};

export default CategoriasMetas;