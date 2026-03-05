import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Tag, Edit2, Target, Loader2,
  ChevronLeft, ChevronRight, TrendingDown, DollarSign, Star
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
  valor_meta: number;
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

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [form, setForm] = useState({ 
    nome: '', 
    cor: '#4361ee', 
    valor_meta: '' as string | number
  });

  // --- ESTADO PARA O MODAL FEEDBACK ---
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  // Função auxiliar para disparar o feedback
  const alertar = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
    setFeedback({ isOpen: true, type, title, message, onConfirm });
  };

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

  const cardsParaExibir = useMemo(() => {
    const categoriasFiltradas = categorias.filter(c => c.tipo === activeTab);
    return categoriasFiltradas.map(cat => {
      const metaEncontrada = metasMes.find(m => m.categoria_id === cat.id);
      return {
        categoria_id: cat.id,
        id_meta: metaEncontrada?.id || null,
        nome: cat.nome,
        cor: cat.cor,
        valor_meta: metaEncontrada?.valor_meta || 0,
        existe_meta: !!metaEncontrada
      };
    });
  }, [categorias, metasMes, activeTab]);

  const openModal = (item: any = null) => {
    if (item) {
      setSelectedItem(item);
      setForm({
        nome: item.nome,
        cor: item.cor,
        valor_meta: item.existe_meta ? item.valor_meta : ''
      });
    } else {
      setSelectedItem(null);
      const corPadrao = activeTab === 'provento' ? '#00AB59' : activeTab === 'pessoal' ? '#8b5cf6' : '#4361ee';
      setForm({ nome: '', cor: corPadrao, valor_meta: '' });
    }
    setIsModalOpen(true);
  };

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let currentCatId = selectedItem?.categoria_id;

      if (!currentCatId) {
        const { data: newCat, error: catErr } = await (supabase.from('categorias') as any)
          .insert({ nome: form.nome, tipo: activeTab, cor: form.cor, user_id: user.id })
          .select().single();
        if (catErr) throw catErr;
        currentCatId = newCat.id;
      }

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
      buscarDados();
      // Feedback de Sucesso ao salvar
      alertar('success', 'Tudo pronto!', 'Seu planejamento foi atualizado com sucesso.');
    } catch (error: any) {
      alertar('error', 'Ops!', 'Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleExcluirCascata = () => {
    if (!selectedItem?.categoria_id) return;

    // Uso do ModalFeedback para confirmação de exclusão (Danger)
    alertar(
      'danger', 
      'Confirmar Exclusão', 
      `Isso apagará permanentemente a categoria "${selectedItem.nome}" e todas as metas relacionadas a ela. Deseja continuar?`,
      async () => {
        setLoading(true);
        try {
          // Exclui metas primeiro (integridade referencial)
          await supabase.from('metas').delete().eq('categoria_id', selectedItem.categoria_id);
          // Exclui a categoria
          const { error: catErr } = await supabase.from('categorias').delete().eq('id', selectedItem.categoria_id);
          
          if (catErr) throw catErr;

          setIsModalOpen(false);
          buscarDados();
          // Alerta opcional de sucesso após excluir
          alertar('success', 'Excluído', 'A categoria e seus dados foram removidos.');
        } catch (error: any) {
          alertar('error', 'Erro', 'Não foi possível excluir: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  return (
    <>
      <style>{`
        .edit-modal {
          width: 95%; max-width: 500px; background: white; border-radius: 28px;
          padding: 24px; position: relative; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
          z-index: 1001; display: flex; flex-direction: column;
        }
        .edit-form-grid { display: flex; flex-direction: column; gap: 16px; }
        .form-group label {
          font-size: 0.65rem; font-weight: 800; color: #64748b;
          margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .form-group input {
          width: 100%; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 12px;
          font-size: 0.95rem; outline: none; background: #f8fafc; transition: all 0.2s;
        }
        .form-group input:focus { border-color: #4361ee; background: white; }
        .modal-header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .modal-footer-btns {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9;
        }
        .btn-png-action { background: none; border: none; cursor: pointer; padding: 0; transition: transform 0.2s; }
        .btn-png-action img { width: 38px; height: 38px; object-fit: contain; }
        .btn-png-action:hover { transform: scale(1.1); }
        .color-preview-wrapper {
          display: flex; align-items: center; gap: 12px; background: #f8fafc;
          padding: 8px 12px; border-radius: 12px; border: 1.5px solid #e2e8f0;
        }
        .input-color-circle { width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; }
        @media (max-width: 480px) {
          .edit-modal { width: 100%; border-radius: 24px 24px 0 0; position: fixed; bottom: 0; }
          .modal-overlay { align-items: flex-end; }
        }
      `}</style>

      <div className="cat-page-wrapper metas-container">
        <button className="cat-fab" onClick={() => openModal()} title="Nova Categoria"><Plus size={30} /></button>

        <header className="metas-header">
          <div className="cat-title-area">
            <div className="titulo-secao"><Target size={28} color="#4361ee" /><h1>Planejamento</h1></div>
            <p>Gerencie suas metas de {activeTab === 'despesa' ? 'gastos' : activeTab === 'provento' ? 'receitas' : 'objetivos'}</p>
          </div>
          <div className="seletor-periodo">
            <button onClick={() => setMes(m => m === 1 ? 12 : m - 1)}><ChevronLeft size={20}/></button>
            <span>{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(ano, mes - 1))} {ano}</span>
            <button onClick={() => setMes(m => m === 12 ? 1 : m + 1)}><ChevronRight size={20}/></button>
          </div>
        </header>

        <nav className="metas-tabs">
          <button className={activeTab === 'despesa' ? 'active' : ''} onClick={() => setActiveTab('despesa')}><TrendingDown size={18} /> Gastos</button>
          <button className={activeTab === 'provento' ? 'active' : ''} onClick={() => setActiveTab('provento')}><DollarSign size={18} /> Receitas</button>
          <button className={activeTab === 'pessoal' ? 'active' : ''} onClick={() => setActiveTab('pessoal')}><Star size={18} /> Objetivos</button>
        </nav>

        <div className="cat-list-container metas-content">
          {loading ? (
            <div className="cat-status"><Loader2 className="spinner" /> Carregando...</div>
          ) : (
            <div className="grid-metas-cats">
              {cardsParaExibir.map((item) => (
                <div key={item.categoria_id} className="cat-item-row" onClick={() => openModal(item)}>
                  <div className="cat-item-main">
                    <div className="cat-status-dot" style={{ backgroundColor: item.cor }}></div>
                    <div className="cat-info-text">
                      <span className="cat-item-name" style={{ color: item.cor }}>{item.nome}</span>
                      <span className="cat-item-meta">
                        {item.existe_meta 
                          ? <strong>{Number(item.valor_meta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                          : <span className="txt-pendente">Definir meta</span>
                        }
                      </span>
                    </div>
                  </div>
                  <Edit2 size={16} className="cat-edit-icon" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Edição */}
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <form className="edit-modal" onClick={e => e.stopPropagation()} onSubmit={handleSalvar}>
              <div className="modal-header-actions">
                <h2 style={{margin: 0, fontWeight: 900, fontSize: '1.2rem'}}>
                  {selectedItem?.categoria_id ? 'Editar Detalhes' : 'Novo Registro'}
                </h2>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-png-action"><img src={iconFechar} alt="Fechar" /></button>
              </div>

              <div className="edit-form-grid">
                <div className="form-group">
                  <label>Nome / Categoria</label>
                  <input type="text" value={form.nome} disabled={!!selectedItem?.categoria_id} onChange={e => setForm({...form, nome: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Valor da Meta</label>
                  <input type="number" step="0.01" value={form.valor_meta} onChange={e => setForm({...form, valor_meta: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Cor</label>
                  <div className="color-preview-wrapper">
                    <input type="color" className="input-color-circle" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} />
                    <span style={{fontSize: '0.85rem', color: '#64748b', fontWeight: 600}}>{form.cor.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer-btns">
                {selectedItem?.categoria_id ? (
                  <button type="button" className="btn-png-action" onClick={handleExcluirCascata}><img src={iconExcluir} alt="Excluir" /></button>
                ) : <div />}
                <div style={{display: 'flex', gap: '20px'}}>
                  <button type="button" className="btn-png-action" onClick={() => setIsModalOpen(false)}><img src={iconCancelar} alt="Cancelar" /></button>
                  <button type="submit" className="btn-png-action"><img src={iconConfirme} alt="Confirmar" /></button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Modal de Feedback (Sucesso/Erro/Exclusão) */}
        <ModalFeedback 
          isOpen={feedback.isOpen} 
          type={feedback.type} 
          title={feedback.title} 
          message={feedback.message} 
          onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))} 
          onConfirm={feedback.onConfirm} 
        />
      </div>
    </>
  );
};

export default CategoriasMetas;