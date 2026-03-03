import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, X, Tag, Palette, Edit2, Target, Loader2, Save,
  ChevronLeft, ChevronRight, TrendingDown, DollarSign, Star, Trash2 
} from 'lucide-react';
import '../styles/CategoriasMetas.css';

const CategoriasMetas = () => {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState([]);
  const [metasMes, setMetasMes] = useState([]);
  const [activeTab, setActiveTab] = useState('despesa'); // 'despesa', 'provento', 'pessoal'
  
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [form, setForm] = useState({ 
    nome: '', 
    cor: '#4361ee', 
    valor_meta: ''
  });

  useEffect(() => {
    buscarDados();
  }, [mes, ano]);

  async function buscarDados() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [resCats, resMetas] = await Promise.all([
        supabase.from('categorias').select('*').order('nome'),
        supabase.from('metas')
          .select('*')
          .eq('mes_referencia', mes)
          .eq('ano_referencia', ano)
      ]);

      setCategorias(resCats.data || []);
      setMetasMes(resMetas.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filtragem estrita baseada no tipo da meta e na nova coluna nome_meta
  const itemsFiltrados = useMemo(() => {
    return metasMes.filter(m => m.tipo_meta === activeTab);
  }, [metasMes, activeTab]);

  const openModal = (meta = null) => {
    if (meta) {
      setEditMode(true);
      setSelectedItem(meta);
      setForm({
        nome: meta.nome_meta || '',
        cor: meta.cor_meta || (activeTab === 'pessoal' ? '#8b5cf6' : '#4361ee'),
        valor_meta: meta.valor_meta
      });
    } else {
      setEditMode(false);
      setSelectedItem(null);
      setForm({ 
        nome: '', 
        cor: activeTab === 'pessoal' ? '#8b5cf6' : '#4361ee', 
        valor_meta: ''
      });
    }
    setShowModal(true);
  };

  async function handleSalvar(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let categoriaId = selectedItem?.categoria_id;

      // 1. Verificar se já existe uma categoria com este nome para este usuário e tipo
      // Se estiver editando e o nome mudou, ou se for novo, buscamos/criamos a categoria
      if (!editMode || (editMode && form.nome !== selectedItem.nome_meta)) {
        const { data: catExistente } = await supabase
          .from('categorias')
          .select('id')
          .eq('user_id', user.id)
          .eq('nome', form.nome)
          .eq('tipo', activeTab === 'pessoal' ? 'despesa' : activeTab)
          .maybeSingle();

        if (catExistente) {
          categoriaId = catExistente.id;
        } else {
          // Criar nova categoria se não existir
          const { data: newCat, error: catErr } = await supabase
            .from('categorias')
            .insert({ 
              nome: form.nome, 
              tipo: activeTab === 'pessoal' ? 'despesa' : activeTab, 
              cor: form.cor, 
              user_id: user.id 
            })
            .select().single();
          if (catErr) throw catErr;
          categoriaId = newCat.id;
        }
      }

      // 2. Salvar a Meta usando a nova coluna nome_meta
      const metaPayload = {
        user_id: user.id,
        categoria_id: categoriaId,
        valor_meta: parseFloat(form.valor_meta) || 0,
        tipo_meta: activeTab,
        mes_referencia: mes,
        ano_referencia: ano,
        nome_meta: form.nome,
        cor_meta: form.cor
      };

      // Se for editMode, incluímos o ID para o upsert reconhecer a linha correta
      if (editMode && selectedItem?.id) {
        metaPayload.id = selectedItem.id;
      }

      const { error: metaErr } = await supabase.from('metas').upsert(metaPayload);
      if (metaErr) throw metaErr;

      setShowModal(false);
      buscarDados();
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function excluirMeta() {
    if (window.confirm("Deseja remover este planejamento do mês?")) {
      try {
        await supabase.from('metas').delete().eq('id', selectedItem.id);
        setShowModal(false);
        buscarDados();
      } catch (error) {
        console.error("Erro ao excluir:", error);
      }
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="cat-page-wrapper metas-container">
      <button className="cat-fab" onClick={() => openModal()} title="Novo Planejamento">
        <Plus size={30} />
      </button>

      <header className="metas-header">
        <div className="cat-title-area">
          <div className="titulo-secao">
            <Target size={28} color="#4361ee" />
            <h1>Planejamento</h1>
          </div>
          <p>Gerencie metas de {activeTab === 'despesa' ? 'Gastos' : activeTab === 'provento' ? 'Receitas' : 'Objetivos'}</p>
        </div>
        
        <div className="seletor-periodo">
          <button onClick={() => setMes(m => m === 1 ? 12 : m - 1)}><ChevronLeft size={20}/></button>
          <span>
            {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(ano, mes - 1))} {ano}
          </span>
          <button onClick={() => setMes(m => m === 12 ? 1 : m + 1)}><ChevronRight size={20}/></button>
        </div>
      </header>

      <nav className="metas-tabs">
        <button className={activeTab === 'despesa' ? 'active' : ''} onClick={() => setActiveTab('despesa')}>
          <TrendingDown size={18} /> Gastos
        </button>
        <button className={activeTab === 'provento' ? 'active' : ''} onClick={() => setActiveTab('provento')}>
          <DollarSign size={18} /> Receitas
        </button>
        <button className={activeTab === 'pessoal' ? 'active' : ''} onClick={() => setActiveTab('pessoal')}>
          <Star size={18} /> Objetivos
        </button>
      </nav>

      <div className="cat-list-container metas-content">
        {loading ? (
          <div className="cat-status"><Loader2 className="spinner" /> Sincronizando dados...</div>
        ) : itemsFiltrados.length > 0 ? (
          <div className="grid-metas-cats">
            {itemsFiltrados.map(meta => {
              const cor = meta.cor_meta || '#4361ee';
              const nome = meta.nome_meta || 'Sem nome';

              return (
                <div key={meta.id} className="cat-item-row" onClick={() => openModal(meta)}>
                  <div className="cat-item-main">
                    <div className="cat-status-dot" style={{ backgroundColor: cor }}></div>
                    <div className="cat-info-text">
                      <span className="cat-item-name" style={{ color: cor }}>{nome}</span>
                      <span className="cat-item-meta">
                        Meta: <strong>{formatCurrency(meta.valor_meta)}</strong>
                      </span>
                    </div>
                  </div>
                  <Edit2 size={16} className="cat-edit-icon" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cat-empty">Nenhuma meta de {activeTab} definida para este mês.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cat-modal fade-in" onClick={e => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h3>{editMode ? 'Editar' : 'Nova'} Meta</h3>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>

            <form onSubmit={handleSalvar} className="cat-modal-form">
              <div className="cat-input-box">
                <label><Tag size={14}/> Nome</label>
                <input 
                  type="text" required value={form.nome} 
                  onChange={e => setForm({...form, nome: e.target.value})} 
                  placeholder="Ex: Alimentação, Viagem, Reserva..."
                />
              </div>

              <div className="cat-input-box">
                <label><Target size={14}/> Valor da Meta</label>
                <div className="cat-money-input-wrapper">
                  <span className="prefix">R$</span>
                  <input 
                    type="number" step="0.01" required
                    value={form.valor_meta} 
                    onChange={e => setForm({...form, valor_meta: e.target.value})} 
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              <div className="cat-input-box">
                <label><Palette size={14}/> Cor de Identificação</label>
                <div className="cat-color-picker-container">
                  <input 
                    type="color" 
                    className="cat-color-input" 
                    value={form.cor} 
                    onChange={e => setForm({...form, cor: e.target.value})} 
                  />
                  <input 
                    type="text" 
                    className="cat-hex-input" 
                    value={form.cor.toUpperCase()} 
                    onChange={e => setForm({...form, cor: e.target.value})} 
                    maxLength={7} 
                  />
                </div>
              </div>

              <div className="cat-modal-actions">
                {editMode && (
                  <button type="button" className="btn-cat-delete" onClick={excluirMeta}>
                    <Trash2 size={20} /> Excluir
                  </button>
                )}
                <button type="submit" className="btn-cat-save" disabled={loading}><Save size={18} />
                  {loading ? 'Processando...' : editMode ? 'Salvar' : 'Criar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriasMetas;