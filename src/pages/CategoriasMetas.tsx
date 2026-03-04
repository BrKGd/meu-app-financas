import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, X, Tag, Palette, Edit2, Target, Loader2, Save,
  ChevronLeft, ChevronRight, TrendingDown, DollarSign, Star, Trash2 
} from 'lucide-react';
import '../styles/CategoriasMetas.css';

// --- Interfaces ---
interface Categoria {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  cor: string;
}

interface Meta {
  id: string;
  user_id: string;
  categoria_id: string;
  nome_meta: string;
  valor_meta: string | number;
  tipo_meta: string;
  mes_referencia: number;
  ano_referencia: number;
  cor_meta: string | null;
}

const CategoriasMetas: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [metasMes, setMetasMes] = useState<Meta[]>([]);
  const [activeTab, setActiveTab] = useState<'despesa' | 'provento' | 'pessoal'>('despesa');
  
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  
  // Tipagem explícita para o estado
  const [selectedItem, setSelectedItem] = useState<Meta | null>(null);
  
  const [form, setForm] = useState({ 
    nome: '', 
    cor: '#4361ee', 
    valor_meta: '' as string | number
  });

  const buscarDados = useCallback(async () => {
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

      setCategorias((resCats.data as Categoria[]) || []);
      setMetasMes((resMetas.data as Meta[]) || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const itemsFiltrados = useMemo(() => {
    return metasMes.filter(m => m.tipo_meta === activeTab);
  }, [metasMes, activeTab]);

  const openModal = (meta: Meta | null = null) => {
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

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Usamos uma variável auxiliar para evitar problemas de escopo/tipo
      let categoriaId = '';
      
      // Criamos uma referência tipada para o selectedItem
      const itemAtual = selectedItem as Meta | null;

      if (!editMode || (editMode && itemAtual && form.nome !== itemAtual.nome_meta)) {
        const { data: catExistente } = await supabase
          .from('categorias')
          .select('id')
          .eq('user_id', user.id)
          .eq('nome', form.nome)
          .eq('tipo', activeTab === 'pessoal' ? 'despesa' : activeTab)
          .maybeSingle() as { data: { id: string } | null };

        if (catExistente) {
          categoriaId = catExistente.id;
        } else {
          const { data: newCat, error: catErr } = await (supabase.from('categorias') as any)
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
      } else if (itemAtual) {
        categoriaId = itemAtual.categoria_id;
      }

      const metaPayload: any = {
        user_id: user.id,
        categoria_id: categoriaId,
        valor_meta: parseFloat(form.valor_meta.toString()) || 0,
        tipo_meta: activeTab,
        mes_referencia: mes,
        ano_referencia: ano,
        nome_meta: form.nome,
        cor_meta: form.cor
      };

      // CORREÇÃO DEFINITIVA DO ERRO NA LINHA 122
      // Forçamos o TypeScript a entender que itemAtual tem a propriedade id
      if (editMode && itemAtual && (itemAtual as any).id) {
        metaPayload.id = (itemAtual as any).id;
      }

      const { error: metaErr } = await (supabase.from('metas') as any).upsert(metaPayload);
      if (metaErr) throw metaErr;

      setShowModal(false);
      buscarDados();
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function excluirMeta() {
    const itemParaExcluir = selectedItem as Meta | null;
    if (itemParaExcluir?.id && window.confirm("Deseja remover este planejamento do mês?")) {
      try {
        await (supabase.from('metas') as any).delete().eq('id', itemParaExcluir.id);
        setShowModal(false);
        buscarDados();
      } catch (error) {
        console.error("Erro ao excluir:", error);
      }
    }
  }

  const formatCurrency = (val: number | string) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
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
              return (
                <div key={meta.id} className="cat-item-row" onClick={() => openModal(meta)}>
                  <div className="cat-item-main">
                    <div className="cat-status-dot" style={{ backgroundColor: cor }}></div>
                    <div className="cat-info-text">
                      <span className="cat-item-name" style={{ color: cor }}>{meta.nome_meta}</span>
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
          <div className="cat-empty">Nenhuma meta definida para este mês.</div>
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
                </div>
              </div>

              <div className="cat-modal-actions">
                {editMode && (
                  <button type="button" className="btn-cat-delete" onClick={excluirMeta}>
                    <Trash2 size={20} /> Excluir
                  </button>
                )}
                <button type="submit" className="btn-cat-save" disabled={loading}>
                  <Save size={18} />
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