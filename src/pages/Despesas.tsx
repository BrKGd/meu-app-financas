import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Plus, Calendar, Tag, Trash2, X, Save, User, ShoppingCart, Loader2 } from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Despesas.css';

// --- Interfaces Alinhadas ao Schema ---
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
  user_id: string | null;
  descricao: string;
  valor_total: number;
  data_compra: string;
  categoria_id: string | null;
  tipo_despesa: string | null;
  categorias?: {
    nome: string;
    cor: string;
  } | null;
}

interface ItemEditando extends Partial<Compra> {
  valor_exibicao: string;
}

const Despesas: React.FC = () => {
  const [despesas, setDespesas] = useState<Compra[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemEditando, setItemEditando] = useState<ItemEditando | null>(null);
  const navigate = useNavigate();

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'danger';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const alertar = (type: 'success' | 'error' | 'danger', title: string, message: string, onConfirm?: () => void) => {
    setFeedback({ isOpen: true, type, title, message, onConfirm });
  };

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dataCompras, error } = await (supabase.from('compras') as any)
        .select(`*, categorias (nome, cor)`)
        .eq('tipo_despesa', 'Gastos Variáveis')
        .order('data_compra', { ascending: false });

      const { data: dataCat } = await supabase.from('categorias').select('id, nome, cor');
      const { data: dataProf } = await supabase.from('profiles').select('id, nome');

      if (error) throw error;

      setDespesas((dataCompras as unknown as Compra[]) || []);
      setCategorias((dataCat as Categoria[]) || []);
      setResponsaveis((dataProf as Responsavel[]) || []);
    } catch (error: any) {
      console.error("Erro técnico:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  const formatarMoeda = (valor: number | string) => {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleMascaraMoeda = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "");
    const valorNumerico = (Number(valor) / 100).toFixed(2);
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(valorNumerico));
    
    if (itemEditando) {
      setItemEditando({ ...itemEditando, valor_exibicao: valorFormatado });
    }
  };

  const handleAbrirModal = (item: Compra) => {
    setItemEditando({ 
      ...item, 
      valor_exibicao: formatarMoeda(item.valor_total),
    });
    setIsModalOpen(true);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEditando?.id) return;

    try {
      const valorLimpo = Number(itemEditando.valor_exibicao?.replace(/[^\d,]/g, '').replace(',', '.') || 0);
      
      const payload = {
        descricao: itemEditando.descricao,
        valor_total: valorLimpo,
        data_compra: itemEditando.data_compra,
        categoria_id: itemEditando.categoria_id,
        user_id: itemEditando.user_id
      };

      const { error } = await (supabase.from('compras') as any)
        .update(payload)
        .eq('id', itemEditando.id);

      if (error) throw error;
      setIsModalOpen(false);
      buscarDados();
      alertar('success', 'Atualizado', 'Despesa atualizada com sucesso!');
    } catch (error: any) {
      alertar('error', 'Erro', error.message);
    }
  };

  const handleExcluir = () => {
    if (!itemEditando?.id) return;
    alertar('danger', 'Excluir?', `Deseja apagar "${itemEditando.descricao}"?`, async () => {
      const { error } = await (supabase.from('compras') as any).delete().eq('id', itemEditando.id);
      if (!error) {
        setIsModalOpen(false);
        setFeedback(prev => ({ ...prev, isOpen: false }));
        buscarDados();
      }
    });
  };

  const listaFiltrada = despesas.filter(d => d.descricao.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
      <div className="desp-premium-wrapper theme-red">
        <div className="desp-top-layout">
          <header className="desp-panel desp-header-area">
            <div className="desp-title-area">
              <h1>Despesas</h1>
              <p>Pagamentos à vista e variáveis</p>
            </div>
          </header>

          <div className="desp-panel desp-summary-card">
            <span className="summary-label">Total do Período</span>
            <h2 className="summary-value">
                {formatarMoeda(listaFiltrada.reduce((acc, curr) => acc + Number(curr.valor_total), 0))}
            </h2>
          </div>
        </div>

        <main className="desp-panel desp-list-panel" style={{padding: 0, overflow: 'hidden'}}>
          <div className="list-header" style={{padding: '25px 30px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h3 style={{fontWeight: 800, color: '#475569', margin: 0}}>Movimentações</h3>
            <input 
              type="text" 
              placeholder="Filtrar..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="desp-search-mini"
            />
          </div>

          <div className="desp-list">
            {loading ? (
              <div style={{padding: '40px', textAlign: 'center'}}><Loader2 className="spinner" /></div>
            ) : listaFiltrada.map((item) => (
              <div key={item.id} className="desp-item-row" onClick={() => handleAbrirModal(item)}>
                <div className="desp-icon-column">
                  <div className="desp-icon-box" style={{ backgroundColor: `${item.categorias?.cor}15`, color: item.categorias?.cor || '#ef4444' }}>
                    <ShoppingCart size={20} />
                  </div>
                </div>

                <div className="desp-main-content">
                  <div className="desp-top-line">
                    <span className="desp-desc">{item.descricao}</span>
                    <span className="desp-value value-negative">{formatarMoeda(item.valor_total)}</span>
                  </div>
                  
                  <div className="desp-meta-line">
                    <span className="meta-tag">
                      <Calendar size={12} /> {item.data_compra ? new Date(item.data_compra).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--/--/--'}
                    </span>
                    <span className="meta-divider">•</span>
                    <span className="meta-tag">
                      <Tag size={12} /> {item.categorias?.nome || 'Sem Categoria'}
                    </span>
                    
                    {/* SOLUÇÃO FINAL DO ERRO 2345 NO FIND (LINHA 148) */}
                    {(() => {
                      const uid = item.user_id;
                      if (!uid) return null;

                      // Forçamos o tipo para string para que o find não aceite 'undefined'
                      const resp = responsaveis.find((r: Responsavel) => r.id === (uid as string));
                      
                      return (
                        <>
                          <span className="meta-divider">•</span>
                          <span className="meta-tag">
                            <User size={12} /> {resp?.nome ? resp.nome.split(' ')[0] : 'Usuário'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {isModalOpen && itemEditando && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="edit-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h2 style={{margin: 0, fontWeight: 900, color: '#0f172a'}}>Detalhes</h2>
                <button onClick={() => setIsModalOpen(false)} className="close-btn-desp"><X size={20} /></button>
              </div>

              <form onSubmit={handleSalvarEdicao} className="edit-form-grid">
                <div className="form-group">
                  <label>O QUE FOI COMPRADO?</label>
                  <input 
                    type="text" 
                    value={itemEditando.descricao || ''} 
                    onChange={e => setItemEditando({...itemEditando, descricao: e.target.value})} 
                    required 
                  />
                </div>

                <div className="form-row">
                    <div className="form-group" style={{flex: 1}}>
                        <label>CATEGORIA</label>
                        <select 
                            value={itemEditando.categoria_id || ''} 
                            onChange={e => setItemEditando({...itemEditando, categoria_id: e.target.value})}
                        >
                            <option value="">Selecione...</option>
                            {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                        </select>
                    </div>

                    <div className="form-group" style={{flex: 1}}>
                        <label>RESPONSÁVEL</label>
                        <select 
                            value={itemEditando.user_id || ''} 
                            onChange={e => setItemEditando({...itemEditando, user_id: e.target.value})}
                        >
                            <option value="">Selecione...</option>
                            {responsaveis.map(resp => <option key={resp.id} value={resp.id}>{resp.nome}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>VALOR</label>
                    <input type="text" value={itemEditando.valor_exibicao || ''} onChange={handleMascaraMoeda} required />
                  </div>
                  <div className="form-group">
                    <label>DATA</label>
                    <input type="date" value={itemEditando.data_compra || ''} onChange={e => setItemEditando({...itemEditando, data_compra: e.target.value})} required />
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button type="button" className="btn-delete-full" onClick={handleExcluir}><Trash2 size={18} /> Excluir</button>
                  <button type="submit" className="btn-save-full"><Save size={18} /> Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ModalFeedback 
        isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.message}
        onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
        onConfirm={feedback.onConfirm}
      />
      
      <button className="desp-fab" onClick={() => navigate('/lancamento')}>
        <Plus size={30} />
      </button>
    </>
  );
};

export default Despesas;