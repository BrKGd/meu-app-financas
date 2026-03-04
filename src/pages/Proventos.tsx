import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Filter, X, Calendar, Tag, Landmark, Save, Trash2, User 
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Proventos.css';

// --- Interfaces ---
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

const Proventos: React.FC = () => {
  const [lista, setLista] = useState<Provento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'danger';
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null
  });

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

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [resProvs, resCats, resProfs] = await Promise.all([
        (supabase.from('proventos') as any).select('*').order('data_recebimento', { ascending: false }),
        (supabase.from('categorias') as any).select('*').eq('tipo', 'provento').order('nome', { ascending: true }),
        (supabase.from('profiles') as any).select('id, nome').order('nome', { ascending: true })
      ]);

      if (resProfs.error) throw resProfs.error;

      setLista(resProvs.data || []);
      setCategorias(resCats.data || []);
      setResponsaveis(resProfs.data || []);

      if (resCats.data?.length > 0 && !form.categoria_nome) {
        setForm(prev => ({ ...prev, categoria_nome: resCats.data[0].nome }));
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error.message);
    } finally {
      setLoading(false);
    }
  }, [form.categoria_nome]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const formatMoney = (v: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const handleMascaraMoeda = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "");
    const valorNumerico = (Number(valor) / 100).toFixed(2);
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(valorNumerico));
    setForm({ ...form, valor_exibicao: valorFormatado });
  };

  const abrirModalNovo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setEditandoId(null);
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
    setEditandoId(item.id);
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

      const valorLimpo = Number(form.valor_exibicao.replace(/[^\d,]/g, '').replace(',', '.'));

      const dadosProvento = {
        user_id: user.id,
        descricao: form.descricao,
        valor: valorLimpo,
        categoria: form.categoria_nome,
        responsavel_id: form.responsavel_id,
        data_recebimento: form.data
      };

      const { error } = editandoId 
        ? await (supabase.from('proventos') as any).update(dadosProvento).eq('id', editandoId)
        : await (supabase.from('proventos') as any).insert([dadosProvento]);

      if (error) throw error;
      
      setShowModal(false);
      buscarDados();
      alertar('success', 'Sucesso!', 'Dados salvos com sucesso.');
    } catch (error: any) {
      alertar('error', 'Erro ao salvar', error.message);
    }
  }

  const confirmarExclusao = () => {
    alertar('danger', 'Excluir Registro?', 'Esta ação não pode ser desfeita.', async () => {
      if (!editandoId) return;
      const { error } = await (supabase.from('proventos') as any).delete().eq('id', editandoId);
      if (!error) {
        setShowModal(false);
        setFeedback(prev => ({ ...prev, isOpen: false }));
        buscarDados();
      }
    });
  };

  return (
    <>
      <div className="proventos-premium-wrapper">
        <div className="prov-top-layout">
          <header className="prov-panel prov-header-area">
            <div className="prov-title-area">
              <h1>Proventos</h1>
              <p>Gerenciamento de Entradas</p>
            </div>
          </header>
          <div className="prov-panel prov-summary-card">
            <span className="summary-label">Total Recebido</span>
            <h2 className="summary-value">
              {formatMoney(lista.reduce((acc, cur) => acc + (cur.valor || 0), 0))}
            </h2>
          </div>
        </div>

        <main className="prov-panel" style={{padding: 0, overflow: 'hidden'}}>
          <div className="list-header" style={{padding: '25px 30px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h3 style={{margin: 0, fontWeight: 800, color: '#475569'}}>Movimentações</h3>
            <div className="list-actions">
                <button className="btn-filter-icon" style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                    <Filter size={18} color="#10b981" />
                </button>
            </div>
          </div>

          <div className="prov-list">
            {loading ? (
              <div style={{padding: '40px', textAlign: 'center'}}>Carregando...</div>
            ) : lista.map(item => (
              <div key={item.id} className="prov-item-row" onClick={() => abrirModalEditar(item)}>
                <div className="prov-icon-column">
                  <div className="prov-icon-box">
                    <Landmark size={20} />
                  </div>
                </div>

                <div className="prov-main-content">
                  <div className="prov-top-line">
                    <span className="prov-desc">{item.descricao}</span>
                    <span className="prov-value value-positive">{formatMoney(item.valor)}</span>
                  </div>
                  
                  <div className="prov-meta-line">
                    <span className="meta-tag">
                      <Calendar size={12} /> {new Date(item.data_recebimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                    </span>
                    <span className="meta-divider">•</span>
                    <span className="meta-tag">
                      <Tag size={12} /> {item.categoria}
                    </span>
                    {responsaveis.find(r => r.id === item.responsavel_id) && (
                      <>
                        <span className="meta-divider">•</span>
                        <span className="meta-tag">
                          <User size={12} />
                          {responsaveis.find(r => r.id === item.responsavel_id)?.nome.split(' ')[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="prov-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h2 style={{margin: 0, fontWeight: 900}}>Detalhes</h2>
                <button onClick={() => setShowModal(false)} className="close-modal-btn"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleSalvar}>
                <div className="form-group">
                  <label>O QUE FOI RECEBIDO?</label>
                  <input type="text" required value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Ex: Salário" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>VALOR</label>
                    <input type="text" required value={form.valor_exibicao} onChange={handleMascaraMoeda} />
                  </div>
                  <div className="form-group">
                    <label>DATA</label>
                    <input type="date" required value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                    <div className="form-group" style={{flex: 1}}>
                      <label>CATEGORIA</label>
                      <select value={form.categoria_nome} onChange={e => setForm({...form, categoria_nome: e.target.value})} required>
                        {categorias.map(cat => <option key={cat.id} value={cat.nome}>{cat.nome}</option>)}
                      </select>
                    </div>

                    <div className="form-group" style={{flex: 1}}>
                      <label>RESPONSÁVEL</label>
                      <select 
                        value={form.responsavel_id} 
                        onChange={e => setForm({...form, responsavel_id: e.target.value})} 
                        required
                      >
                        <option value="">Selecione...</option>
                        {responsaveis.map(resp => (
                          <option key={resp.id} value={resp.id}>{resp.nome}</option>
                        ))}
                      </select>
                    </div>
                </div>
                <div className='btn-grid-50-50'>       
                <button type="submit" className="btn-save-prov">
                   <Save size={18} /> Salvar
                </button>

                {editandoId && (
                  <button type="button" onClick={confirmarExclusao} className="btn-delete-prov">
                    <Trash2 size={18} /> Excluir
                  </button>
                )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ModalFeedback 
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
        onConfirm={feedback.onConfirm || undefined}
      />

      <button className="prov-fab" onClick={abrirModalNovo}><Plus size={30} /></button>
    </>
  );
};

export default Proventos;