import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  CreditCard, Plus, Trash2, X, Save, ShoppingCart, Settings2, RotateCcw 
} from 'lucide-react';
import '../styles/Cartoes.css';

// --- Interfaces de Tipagem ---
interface Cartao {
  id: number;
  nome: string;
  limite: number | string; // Aceita string por causa do retorno do banco
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string;
  created_at?: string;
}

interface Compra {
  id: string;
  descricao: string;
  loja?: string;
  valor_total: number;
  num_parcelas: number;
  data_compra: string; 
  cartao: string; 
  forma_pagamento: string;
}

const Cartoes: React.FC = () => {
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [showModalCadastro, setShowModalCadastro] = useState<boolean>(false);
  const [selectedCartao, setSelectedCartao] = useState<Cartao | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [formCartao, setFormCartao] = useState({
    nome: '', 
    limite: '', 
    dia_fechamento: '', 
    dia_vencimento: '', 
    cor: '#6366f1'
  });

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  const fecharModais = useCallback(() => {
    setShowModalCadastro(false);
    setSelectedCartao(null);
    setIsEditing(false);
    setFormCartao({ nome: '', limite: '', dia_fechamento: '', dia_vencimento: '', cor: '#6366f1' });
  }, []);

  useEffect(() => {
    fetchDados();
  }, []);

  async function fetchDados() {
    setLoading(true);
    try {
      const { data: cData } = await supabase.from('cartoes').select('*').order('nome');
      const { data: compData } = await supabase.from('compras').select('*');
      
      setCartoes((cData as any[]) || []);
      setCompras((compData as any[]) || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  const getMesInicioCobranca = (item: Compra, cartoesReferencia: Cartao[]) => {
    const [anoC, mesC, diaC] = item.data_compra.split('-').map(Number);
    let mesInicio = mesC - 1; 
    let anoInicio = anoC;

    if (item.forma_pagamento === 'Crédito') {
      const info = cartoesReferencia.find(c => c.nome === item.cartao);
      if (info && diaC > info.dia_fechamento) {
        mesInicio += 1;
      }
    }
    return { mesInicio, anoInicio };
  };

  const calcularDisponivel = (cartao: Cartao, limite: number | string) => {
    const limNum = Number(limite);
    const totalComprometido = compras.reduce((acc, item) => {
      if (item.cartao !== cartao.nome) return acc;
      const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
      const numParcelas = item.num_parcelas || 1;
      
      const dataUltimaParcela = new Date(anoInicio, mesInicio + (numParcelas - 1), 1);
      const dataFronteiraMesAtual = new Date(anoAtual, mesAtual, 1);
      
      if (dataUltimaParcela >= dataFronteiraMesAtual) {
        return acc + Number(item.valor_total);
      }
      return acc;
    }, 0);
    return parseFloat((limNum - totalComprometido).toFixed(2));
  };

  const calcularTotalMes = (cartaoNome: string) => {
    const total = compras.reduce((acc, item) => {
      if (item.cartao !== cartaoNome) return acc;
      const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
      const numParcelas = item.num_parcelas || 1;
      let valorNoMes = 0;
      
      for (let i = 0; i < numParcelas; i++) {
        const dP = new Date(anoInicio, mesInicio + i, 1);
        if (dP.getMonth() === mesAtual && dP.getFullYear() === anoAtual) {
          valorNoMes = Number(item.valor_total) / numParcelas;
        }
      }
      return acc + valorNoMes;
    }, 0);
    return parseFloat(total.toFixed(2));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    
    // Objeto limpo para o banco
    const payload = { 
      nome: formCartao.nome,
      limite: parseFloat(formCartao.limite) || 0,
      dia_fechamento: parseInt(formCartao.dia_fechamento) || 1,
      dia_vencimento: parseInt(formCartao.dia_vencimento) || 1,
      cor: formCartao.cor
    };

    try {
      if (isEditing && selectedCartao) {
        // O segredo está no 'as any' aqui para evitar o erro de 'never'
        const { error } = await (supabase.from('cartoes') as any)
          .update(payload)
          .eq('id', selectedCartao.id);
        
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('cartoes') as any)
          .insert([payload]);
        
        if (error) throw error;
      }
      
      fetchDados();
      fecharModais();
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    }
  }

  async function handleDelete(id: number) {
    if (window.confirm('Excluir este cartão?')) {
      const { error } = await supabase.from('cartoes').delete().eq('id', id);
      if (!error) { fetchDados(); fecharModais(); }
    }
  }

  const formatMoney = (v: number | string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="cartoes-container fade-in">
      <header className="cartoes-header">
        <div>
          <h1>Minha Carteira</h1>
          <p style={{ color: '#64748b' }}>Gestão de limites e fechamento de faturas.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModalCadastro(true)}>
          <Plus size={20} /> Novo Cartão
        </button>
      </header>

      <div className="cartoes-grid">
        {cartoes.map(cartao => {
          const disponivel = calcularDisponivel(cartao, cartao.limite);
          const perc = Math.max(0, (disponivel / Number(cartao.limite)) * 100);

          return (
            <div key={cartao.id} className="card-cartao" 
              onClick={() => setSelectedCartao(cartao)}
              style={{ background: `linear-gradient(135deg, ${cartao.cor}, #0f172a)` }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                   <span className="card-label">Crédito</span>
                   <div className="card-bank-name">{cartao.nome}</div>
                </div>
                <CreditCard size={32} opacity={0.5} />
              </div>

              <div className="limit-info-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                   <div>
                      <small className="limit-available-label">DISPONÍVEL</small>
                      <div className="limit-value">{formatMoney(disponivel)}</div>
                   </div>
                   <div className="limit-perc-badge">{Math.round(perc)}%</div>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${perc}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCartao && (
        <div className="modal-overlay" onClick={fecharModais}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ padding: 0, maxWidth: '520px' }}>
            <div className="modal-details-header" style={{ background: isEditing ? '#1e293b' : selectedCartao.cor }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, color: '#fff' }}>{isEditing ? 'Editar Cartão' : selectedCartao.nome}</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isEditing && (
                      <button onClick={() => { 
                          setIsEditing(true); 
                          setFormCartao({
                              nome: selectedCartao.nome,
                              limite: selectedCartao.limite.toString(),
                              dia_fechamento: selectedCartao.dia_fechamento.toString(),
                              dia_vencimento: selectedCartao.dia_vencimento.toString(),
                              cor: selectedCartao.cor
                          }); 
                      }} className="btn-close-round"><Settings2 size={18}/></button>
                    )}
                    <button onClick={fecharModais} className="btn-close-round"><X size={18}/></button>
                  </div>
               </div>
               {!isEditing && <div style={{ color: '#fff', opacity: 0.9 }}>Limite: {formatMoney(selectedCartao.limite)}</div>}
            </div>

            <div style={{ padding: '30px' }}>
              {isEditing ? (
                <form onSubmit={handleSave}>
                  <FormFields form={formCartao} setForm={setFormCartao} />
                  <div className="edit-actions-grid" style={{ marginTop: '20px' }}>
                    <button type="submit" className="btn-modal-save"><Save size={18} /> Salvar</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="btn-modal-cancel"><RotateCcw size={18} /> Voltar</button>
                    <button type="button" onClick={() => handleDelete(selectedCartao.id)} className="btn-modal-delete"><Trash2 size={18} /></button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="listagem-lancamentos">
                    {compras
                      .filter(c => c.cartao === selectedCartao.nome)
                      .map((item, idx) => {
                        const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
                        const numParcelas = item.num_parcelas || 1;
                        let infoMes = null;
                        for (let i = 0; i < numParcelas; i++) {
                          const dP = new Date(anoInicio, mesInicio + i, 1);
                          if (dP.getMonth() === mesAtual && dP.getFullYear() === anoAtual) {
                            infoMes = { atual: i + 1, total: numParcelas, valor: Number(item.valor_total) / numParcelas };
                          }
                        }
                        if (!infoMes) return null;
                        return (
                          <div key={idx} className="fatura-item">
                            <div>
                              <div className="fatura-item-desc">{item.loja || item.descricao}</div>
                              <div className="fatura-item-sub">{item.num_parcelas > 1 ? `${infoMes.atual}/${infoMes.total}` : 'À Vista'}</div>
                            </div>
                            <div className="fatura-item-valor">{formatMoney(infoMes.valor)}</div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="fatura-resumo">
                    <div>
                      <span className="resumo-label">TOTAL NO MÊS</span>
                      <span className="resumo-sub">Vencimento dia {selectedCartao.dia_vencimento}</span>
                    </div>
                    <div className="fatura-valor" style={{ color: selectedCartao.cor }}>
                      {formatMoney(calcularTotalMes(selectedCartao.nome))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showModalCadastro && (
        <div className="modal-overlay" onClick={fecharModais}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Novo Cartão</h3>
            <form onSubmit={handleSave}>
                <FormFields form={formCartao} setForm={setFormCartao} />
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '20px' }}>Criar Cartão</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FormFields = ({ form, setForm }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
    <div className="form-group">
      <label>Banco</label>
      <input className="form-control" required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
    </div>
    <div className="form-group">
      <label>Limite Total</label>
      <input className="form-control" type="number" step="0.01" required value={form.limite} onChange={e => setForm({...form, limite: e.target.value})} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <div className="form-group">
         <label>Dia Fechamento</label>
         <input className="form-control" type="number" value={form.dia_fechamento} onChange={e => setForm({...form, dia_fechamento: e.target.value})} />
      </div>
      <div className="form-group">
         <label>Dia Vencimento</label>
         <input className="form-control" type="number" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} />
      </div>
    </div>
    <div className="form-group">
      <label>Cor</label>
      <input type="color" className="form-control" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} style={{ height: '40px' }} />
    </div>
  </div>
);

export default Cartoes;