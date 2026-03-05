import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  Plus, Calendar, Tag, Trash2, X, Save, 
  User, ShoppingCart, Loader2, Filter, CreditCard, Banknote, Landmark 
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Despesas.css';

// --- Interfaces ---
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
  tipo_despesa: string | null; // Usado para agrupar as seções
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
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const alertar = (type: 'success' | 'error' | 'danger', title: string, message: string, onConfirm?: () => void) => {
    setFeedback({ isOpen: true, type, title, message, onConfirm });
  };

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Buscamos todas as compras (removido filtro de Gastos Variáveis)
      const { data: dataCompras, error } = await (supabase.from('compras') as any)
        .select(`*, categorias (nome, cor)`)
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

  // --- Agrupamento por Tipo de Pagamento ---
  const secoesAgrupadas = useMemo(() => {
    const filtradas = despesas.filter(d => 
      d.descricao.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grupos: Record<string, Compra[]> = {};
    
    filtradas.forEach(despesa => {
      const tipo = despesa.tipo_despesa || 'Outros Pagamentos';
      if (!grupos[tipo]) grupos[tipo] = [];
      grupos[tipo].push(despesa);
    });

    return grupos;
  }, [despesas, searchTerm]);

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
        user_id: itemEditando.user_id,
        tipo_despesa: itemEditando.tipo_despesa
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

  const getIconForSection = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('cartão')) return <CreditCard size={18} color="#ef4444" />;
    if (t.includes('fixa')) return <Landmark size={18} color="#3b82f6" />;
    return <Banknote size={18} color="#10b981" />;
  };

  return (
    <>
      <div className="desp-premium-wrapper theme-red">
        <div className="desp-top-layout">
          <header className="desp-panel desp-header-area">
            <div className="desp-title-area">
              <h1>Central de Dívidas</h1>
              <p>Controle total de saídas e métodos de pagamento</p>
            </div>
          </header>

          <div className="desp-panel desp-summary-card">
            <span className="summary-label">Total Geral Acumulado</span>
            <h2 className="summary-value">
                {formatarMoeda(despesas.reduce((acc, curr) => acc + Number(curr.valor_total), 0))}
            </h2>
          </div>
        </div>

        <main className="desp-panel desp-list-panel" style={{padding: 0, background: 'transparent', boxShadow: 'none'}}>
          {loading ? (
            <div className="desp-panel" style={{padding: '40px', textAlign: 'center'}}><Loader2 className="spinner" /></div>
          ) : (
            Object.entries(secoesAgrupadas).map(([titulo, itens]) => (
              <div key={titulo} className="desp-section-container" style={{marginBottom: '30px'}}>
                {/* Cabeçalho da Seção */}
                <div className="section-header" style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '12px 25px', 
                  background: '#ffffff', 
                  borderRadius: '16px 16px 0 0',
                  borderBottom: '2px solid #f1f5f9'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    {getIconForSection(titulo)}
                    <h3 style={{fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 900, color: '#1e293b', margin: 0}}>
                      {titulo}
                    </h3>
                  </div>
                  <span style={{fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '4px 10px', borderRadius: '8px'}}>
                    {formatarMoeda(itens.reduce((acc, curr) => acc + Number(curr.valor_total), 0))}
                  </span>
                </div>

                {/* Lista de Itens */}
                <div className="desp-panel" style={{borderRadius: '0 0 16px 16px', borderTop: 'none'}}>
                  {itens.map((item) => (
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
                          {item.user_id && (
                            <>
                              <span className="meta-divider">•</span>
                              <span className="meta-tag">
                                <User size={12} /> {responsaveis.find(r => r.id === item.user_id)?.nome.split(' ')[0] || 'Usuário'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </main>

        {/* Modal de Edição */}
        {isModalOpen && itemEditando && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="edit-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header-flex">
                <h2 style={{margin: 0, fontWeight: 900, color: '#0f172a'}}>Detalhes da Dívida</h2>
                <button onClick={() => setIsModalOpen(false)} className="close-btn-desp"><X size={20} /></button>
              </div>

              <form onSubmit={handleSalvarEdicao} className="edit-form-grid">
                <div className="form-group">
                  <label>DESCRIÇÃO</label>
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
                        <label>TIPO/PAGAMENTO</label>
                        <select 
                            value={itemEditando.tipo_despesa || ''} 
                            onChange={e => setItemEditando({...itemEditando, tipo_despesa: e.target.value})}
                        >
                            <option value="Gastos Variáveis">Gastos Variáveis</option>
                            <option value="Dívida Fixa">Dívida Fixa</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Outros">Outros</option>
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
                  <button type="submit" className="btn-save-full"><Save size={18} /> Salvar Alterações</button>
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