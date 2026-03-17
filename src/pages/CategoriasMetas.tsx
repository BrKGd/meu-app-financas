import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Edit2, Target, Loader2, ChevronLeft, ChevronRight, TrendingDown, 
  DollarSign, Star, Settings2, Lock, Wallet, ShoppingBag, Utensils, Car, 
  Heart, Home, Gamepad2, Smartphone, Dumbbell, Plane, Music, GraduationCap,
  Coffee, ShoppingCart, Zap, Fuel, Stethoscope, Briefcase, Gift, Tv, 
  Wifi, ShieldCheck, PiggyBank, Landmark, Baby, PawPrint, Hammer, HardHat,
  Cpu, Camera, Globe, Users, Receipt, Ticket, Bike, Bus
} from 'lucide-react';

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

const ICON_OPTIONS = [
  { name: 'Wallet', icon: Wallet },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'Utensils', icon: Utensils },
  { name: 'Coffee', icon: Coffee },
  { name: 'Car', icon: Car },
  { name: 'Bus', icon: Bus },
  { name: 'Bike', icon: Bike },
  { name: 'Fuel', icon: Fuel },
  { name: 'Zap', icon: Zap },
  { name: 'Home', icon: Home },
  { name: 'Wifi', icon: Wifi },
  { name: 'Heart', icon: Heart },
  { name: 'Stethoscope', icon: Stethoscope },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'Baby', icon: Baby },
  { name: 'PawPrint', icon: PawPrint },
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Tv', icon: Tv },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Cpu', icon: Cpu },
  { name: 'Camera', icon: Camera },
  { name: 'Music', icon: Music },
  { name: 'Ticket', icon: Ticket },
  { name: 'Plane', icon: Plane },
  { name: 'Globe', icon: Globe },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Hammer', icon: Hammer },
  { name: 'HardHat', icon: HardHat },
  { name: 'PiggyBank', icon: PiggyBank },
  { name: 'Landmark', icon: Landmark },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'Receipt', icon: Receipt },
  { name: 'Gift', icon: Gift },
  { name: 'Star', icon: Star },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'Users', icon: Users },
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
        supabase.from('metas')
          .select('*')
          .eq('mes_referencia', mes)
          .eq('ano_referencia', ano)
      ]);

      if (resCats.error) throw resCats.error;
      if (resMetas.error) throw resMetas.error;

      setCategorias((resCats.data as Categoria[]) || []);
      const metasFormatadas = (resMetas.data || []).map((m: any) => ({
        ...m,
        valor_meta: parseFloat(m.valor_meta) || 0
      }));
      setMetasMes(metasFormatadas);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error.message);
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const cardsParaExibir = useMemo(() => {
    return categorias
      .filter(c => c.tipo === activeTab)
      .map(cat => {
        const metaEncontrada = metasMes.find(m => m.categoria_id === cat.id);
        return {
          categoria_id: cat.id,
          user_id: cat.user_id,
          id_meta: metaEncontrada?.id || null,
          nome: cat.nome,
          cor: cat.cor,
          icone: cat.icone || 'Wallet',
          valor_meta: metaEncontrada?.valor_meta || 0,
          existe_meta: !!metaEncontrada
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
    if (perfil.tipo_usuario === 'administrador') {
      return !item || item.user_id === perfil.id;
    }
    return false;
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

  async function handleSalvar(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!podeEditar(selectedItem)) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let currentCatId = selectedItem?.categoria_id;

      // Se estiver criando ou editando configurações da categoria
      if (!currentCatId || isEditing) {
        const catPayload = { 
          nome: form.nome, 
          tipo: activeTab, 
          cor: form.cor, 
          icone: form.icone,
          user_id: user.id 
        };
        if (currentCatId) {
          const { error: errUp } = await supabase.from('categorias').update(catPayload).eq('id', currentCatId);
          if (errUp) throw errUp;
        } else {
          const { data: newCat, error: catErr } = await (supabase.from('categorias') as any).insert(catPayload).select().single();
          if (catErr) throw catErr;
          currentCatId = newCat.id;
        }
      }

      // Upsert na Meta
      const metaPayload: any = {
        user_id: user.id,
        categoria_id: currentCatId,
        valor_meta: parseFloat(form.valor_meta.toString()) || 0,
        tipo_meta: activeTab,
        mes_referencia: mes,
        ano_referencia: ano,
        nome_meta: form.nome,
        cor_meta: form.cor
      };

      if (selectedItem?.id_meta) metaPayload.id = selectedItem.id_meta;

      const { error: metaErr } = await (supabase.from('metas') as any).upsert(metaPayload);
      if (metaErr) throw metaErr;

      setIsModalOpen(false);
      await buscarDados();
      alertar('success', 'Sucesso!', 'Planejamento atualizado.');
    } catch (error: any) {
      alertar('error', 'Ops!', error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleExcluirCascata = () => {
    if (!selectedItem?.categoria_id) return;
    alertar('danger', 'Confirmar Exclusão', `Isso apagará "${selectedItem.nome}" e todas as metas associadas.`, async () => {
      setLoading(true);
      try {
        await supabase.from('metas').delete().eq('categoria_id', selectedItem.categoria_id);
        const { error: catErr } = await supabase.from('categorias').delete().eq('id', selectedItem.categoria_id);
        if (catErr) throw catErr;
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
              <Target size={28} color="#4361ee" />
              <h1>Planejamento</h1>
            </div>
            <p className="subtitulo-metas">Orçamento mensal e objetivos</p>
          </div>

          <div className="header-controls">
            <div className="seletor-periodo">
              <button onClick={() => setMes(m => m === 1 ? 12 : m - 1)}><ChevronLeft size={20}/></button>
              <span className="periodo-display">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(ano, mes - 1))} {ano}
              </span>
              <button onClick={() => setMes(m => m === 12 ? 1 : m + 1)}><ChevronRight size={20}/></button>
            </div>

            <div className="badge-planejado-modern">
                <div className={`badge-icon-wrapper ${activeTab === 'despesa' ? 'bg-red' : 'bg-green'}`}>
                  {activeTab === 'despesa' ? <TrendingDown size={14} color="#ef4444" /> : <Wallet size={14} color="#22c55e" />}
                </div>
                <span className="badge-text">
                  Total {activeTab === 'despesa' ? 'Planejado' : 'Esperado'}: 
                  <strong> {totalPlanejado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </span>
            </div>
          </div>
        </header>

        <nav className="metas-tabs">
          <button className={activeTab === 'despesa' ? 'active' : ''} onClick={() => setActiveTab('despesa')}><TrendingDown size={18} /> Gastos</button>
          <button className={activeTab === 'provento' ? 'active' : ''} onClick={() => setActiveTab('provento')}><DollarSign size={18} /> Receitas</button>
          <button className={activeTab === 'pessoal' ? 'active' : ''} onClick={() => setActiveTab('pessoal')}><Star size={18} /> Objetivos</button>
        </nav>

        {loading ? (
          <div className="cat-status"><Loader2 className="spinner" /></div>
        ) : (
          <div className="grid-metas-modern">
            {cardsParaExibir.map((item) => (
              <div 
                key={item.categoria_id} 
                className="card-financeiro-flux" 
                style={{ '--card-color': item.cor } as any}
                onClick={() => openModal(item)}
              >
                <div className="card-bg-icon">
                  {React.createElement(ICON_OPTIONS.find(i => i.name === item.icone)?.icon || Wallet)}
                </div>
                
                <div className="card-content-top">
                  <div className="card-icon-small">
                    {React.createElement(ICON_OPTIONS.find(i => i.name === item.icone)?.icon || Wallet, { size: 18 })}
                  </div>
                  <span className="card-label-top">{item.nome}</span>
                </div>

                <div className="card-main-info">
                  <h2 className="card-value-display">
                    {item.existe_meta 
                      ? item.valor_meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'R$ 0,00'}
                  </h2>
                  <p className="card-subtitle-bottom">
                    {item.existe_meta ? 'Planejado para o mês' : 'Clique para planejar'}
                  </p>
                </div>
                
                <div className="card-edit-indicator">
                  {podeEditar(item) ? <Edit2 size={14} /> : <Lock size={12} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal-content modal-expanded fade-in" onClick={(e) => e.stopPropagation()}>
              
              <div className="modal-details-header" style={{ background: isEditing ? '#1e293b' : `linear-gradient(135deg, ${form.cor} 0%, #1e293b 100%)` }}>
                <div className="modal-header-top">
                  <h2 className="modal-title-text" style={{ color: !isEditing ? getContrastColor(form.cor) : '#fff' }}>
                    {React.createElement(ICON_OPTIONS.find(i => i.name === form.icone)?.icon || Target, { size: 24 })}
                    {!selectedItem ? 'Nova Categoria' : isEditing ? 'Configurar Categoria' : form.nome}
                  </h2>
                  <div className="modal-header-actions">
                    {selectedItem && !isEditing && podeEditar(selectedItem) && (
                      <button type="button" className="btn-icon-action" onClick={() => setIsEditing(true)}>
                        <Settings2 size={32} color={getContrastColor(form.cor)} />
                      </button>
                    )}
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-icon-action">
                      <img src={iconFechar} alt="Fechar" className="icon-32" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-body-padding">
                <form id="meta-form" onSubmit={handleSalvar} className="form-flex-column">
                  <div className="form-group">
                    <label className="form-label-custom">Nome da Categoria</label>
                    <input 
                      className="form-control"
                      value={form.nome} 
                      disabled={!isEditing} 
                      onChange={e => setForm({...form, nome: e.target.value})} 
                      required 
                      placeholder="Ex: Alimentação, Lazer..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label-custom">Valor do Planejamento (R$)</label>
                    <input 
                      className="form-control"
                      type="number" 
                      step="0.01" 
                      value={form.valor_meta} 
                      disabled={!podeEditar(selectedItem)}
                      onChange={e => setForm({...form, valor_meta: e.target.value})} 
                      required 
                      placeholder="0,00"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label-custom">Ícone Representativo</label>
                    <div className="icon-grid-selector">
                      {ICON_OPTIONS.map((opt) => (
                        <button
                          key={opt.name}
                          type="button"
                          className={`icon-option-btn ${form.icone === opt.name ? 'selected' : ''}`}
                          onClick={() => isEditing && setForm({...form, icone: opt.name})}
                          style={{ '--active-color': form.cor } as any}
                          disabled={!isEditing}
                        >
                          <opt.icon size={20} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label-custom">Cor Visual</label>
                    <div className="color-picker-wrapper">
                      <input 
                        type="color" 
                        value={form.cor} 
                        disabled={!isEditing}
                        onChange={e => setForm({...form, cor: e.target.value})} 
                        className="input-color-square"
                      />
                      <input 
                        type="text" 
                        value={form.cor.toUpperCase()} 
                        disabled={!isEditing}
                        onChange={e => setForm({...form, cor: e.target.value})}
                        maxLength={7}
                        className="form-control hex-input"
                      />
                    </div>
                  </div>
                </form>
              </div>

              <div className="modal-footer-icons-container">
                {selectedItem && isEditing && podeEditar(selectedItem) ? (
                  <button type="button" className="btn-icon-action" onClick={handleExcluirCascata}>
                    <img src={iconExcluir} alt="Excluir" className="icon-38" />
                  </button>
                ) : <div />}
                
                <div className="footer-right-actions">
                  <button type="button" className="btn-icon-action" onClick={() => isEditing && selectedItem ? setIsEditing(false) : setIsModalOpen(false)}>
                    <img src={iconCancelar} alt="Cancelar" className="icon-38" />
                  </button>
                  {podeEditar(selectedItem) && (
                    <button type="submit" form="meta-form" className="btn-icon-action">
                      <img src={iconConfirme} alt="Confirmar" className="icon-38" />
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
          <Plus size={30} />
        </button>
      )}
    </>
  );
};

export default CategoriasMetas;