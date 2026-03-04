import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { CreditCard, Plus, Settings2 } from 'lucide-react'; 
import '../styles/Cartoes.css';

// Importação das imagens
import iconConfirme from '../assets/confirme.png';
import iconExcluir from '../assets/excluir.png';
import iconCancelar from '../assets/cancelar.png';
import iconFechar from '../assets/fechar.png';

// --- Interfaces ---
interface Cartao {
  id: number;
  nome: string;
  limite: number | string;
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string;
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
    nome: '', limite: '', dia_fechamento: '', dia_vencimento: '', cor: '#4361ee'
  });

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  // --- FUNÇÃO EXCLUSIVA PARA O SETTINGS2 ---
  const getSettingsColor = (hexcolor: string) => {
    if (!hexcolor) return '#ffffff';
    const hex = hexcolor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Fórmula YIQ para decidir se o ícone deve ser preto ou branco
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
  };

  const fecharModais = useCallback(() => {
    setShowModalCadastro(false);
    setSelectedCartao(null);
    setIsEditing(false);
    setFormCartao({ nome: '', limite: '', dia_fechamento: '', dia_vencimento: '', cor: '#4361ee' });
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
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- Cálculos ---
  const getMesInicioCobranca = (item: Compra, cartoesReferencia: Cartao[]) => {
    const [anoC, mesC, diaC] = item.data_compra.split('-').map(Number);
    let mesInicio = mesC - 1; 
    let anoInicio = anoC;
    if (item.forma_pagamento === 'Crédito') {
      const info = cartoesReferencia.find(c => c.nome === item.cartao);
      if (info && diaC > info.dia_fechamento) mesInicio += 1;
    }
    return { mesInicio, anoInicio };
  };

  const calcularDisponivel = (cartao: Cartao, limite: number | string) => {
    const limNum = Number(limite);
    const totalComprometido = compras.reduce((acc, item) => {
      if (item.cartao !== cartao.nome) return acc;
      const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
      const dataUltimaParcela = new Date(anoInicio, mesInicio + ((item.num_parcelas || 1) - 1), 1);
      if (dataUltimaParcela >= new Date(anoAtual, mesAtual, 1)) return acc + Number(item.valor_total);
      return acc;
    }, 0);
    return Number((limNum - totalComprometido).toFixed(2));
  };

  const calcularTotalMes = (cartaoNome: string) => {
    const total = compras.reduce((acc, item) => {
      if (item.cartao !== cartaoNome) return acc;
      const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
      const numParcelas = item.num_parcelas || 1;
      for (let i = 0; i < numParcelas; i++) {
        const dP = new Date(anoInicio, mesInicio + i, 1);
        if (dP.getMonth() === mesAtual && dP.getFullYear() === anoAtual) {
          return acc + (Number(item.valor_total) / numParcelas);
        }
      }
      return acc;
    }, 0);
    return Number(total.toFixed(2));
  };

  // --- Ações ---
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = { 
      nome: formCartao.nome,
      limite: parseFloat(formCartao.limite) || 0,
      dia_fechamento: parseInt(formCartao.dia_fechamento) || 1,
      dia_vencimento: parseInt(formCartao.dia_vencimento) || 1,
      cor: formCartao.cor
    };

    try {
      if (isEditing && selectedCartao) {
        await (supabase.from('cartoes') as any).update(payload).eq('id', selectedCartao.id);
      } else {
        await (supabase.from('cartoes') as any).insert([payload]);
      }
      fetchDados();
      fecharModais();
    } catch (error: any) { alert(error.message); }
  }

  async function handleDelete(id: number) {
    if (window.confirm('Excluir este cartão permanentemente?')) {
      const { error } = await supabase.from('cartoes').delete().eq('id', id);
      if (!error) { fetchDados(); fecharModais(); }
    }
  }

  const formatMoney = (v: number | string) => {
    return `R$ ${Number(v).toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return (
    <div className="cartoes-container fade-in">
      <header className="cartoes-header">
        <div>
          <h1>Minha Carteira</h1>
          <p style={{ color: '#94a3b8', fontWeight: 600 }}>Gestão inteligente de crédito.</p>
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
                   <span className="card-label">Crédito Gold</span>
                   <div className="card-bank-name">{cartao.nome}</div>
                </div>
                <CreditCard size={35} opacity={0.4} strokeWidth={1.5} />
              </div>

              <div className="limit-info-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                   <div>
                      <small className="limit-available-label">DISPONÍVEL AGORA</small>
                      <div className="limit-value">{formatMoney(disponivel)}</div>
                   </div>
                   <div style={{ fontWeight: 900, fontSize: '0.9rem', opacity: 0.8 }}>{Math.round(perc)}%</div>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${perc}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(selectedCartao || showModalCadastro) && (
        <div className="modal-overlay" onClick={fecharModais}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ padding: 0, maxWidth: '520px', borderRadius: '45px' }}>
            
            <div className="modal-details-header" style={{ background: isEditing || showModalCadastro ? '#1e293b' : selectedCartao?.cor }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>
                    {showModalCadastro ? 'Novo Cartão' : isEditing ? 'Editar Configurações' : selectedCartao?.nome}
                  </h2>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {!isEditing && !showModalCadastro && (
                      <button onClick={() => { 
                          setIsEditing(true); 
                          setFormCartao({
                              nome: selectedCartao!.nome,
                              limite: selectedCartao!.limite.toString(),
                              dia_fechamento: selectedCartao!.dia_fechamento.toString(),
                              dia_vencimento: selectedCartao!.dia_vencimento.toString(),
                              cor: selectedCartao!.cor
                          }); 
                      }} className="btn-icon-action">
                        {/* UNICO ELEMENTO MANIPULADO DINAMICAMENTE */}
                        <Settings2 
                          size={32} 
                          color={getSettingsColor(selectedCartao!.cor)} 
                        />
                      </button>
                    )}
                    <button onClick={fecharModais} className="btn-icon-action">
                      <img src={iconFechar} alt="Fechar" style={{ width: '32px', height: '32px' }} />
                    </button>
                  </div>
               </div>
               {!isEditing && !showModalCadastro && (
                 <div style={{ marginTop: '10px', fontWeight: 700, opacity: 0.9 }}>
                   Limite Total: {formatMoney(selectedCartao!.limite)}
                 </div>
               )}
            </div>

            <div style={{ padding: '35px' }}>
              {isEditing || showModalCadastro ? (
                <form id="card-form" onSubmit={handleSave}>
                  <FormFields form={formCartao} setForm={setFormCartao} />
                </form>
              ) : (
                <>
                  <div className="listagem-lancamentos">
                    <h4 style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }}>Lançamentos do Mês</h4>
                    {compras
                      .filter(c => c.cartao === selectedCartao?.nome)
                      .map((item, idx) => {
                        const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
                        let infoMes = null;
                        for (let i = 0; i < (item.num_parcelas || 1); i++) {
                          const dP = new Date(anoInicio, mesInicio + i, 1);
                          if (dP.getMonth() === mesAtual && dP.getFullYear() === anoAtual) {
                            infoMes = { atual: i + 1, total: item.num_parcelas, valor: item.valor_total / (item.num_parcelas || 1) };
                          }
                        }
                        return infoMes && (
                          <div key={idx} className="fatura-item">
                            <div>
                              <div className="fatura-item-desc">{item.descricao ||item.loja }</div>
                              <div className="fatura-item-sub">{item.num_parcelas > 1 ? `Parcela ${infoMes.atual}/${infoMes.total}` : 'À Vista'}</div>
                            </div>
                            <div className="fatura-item-valor">{formatMoney(infoMes.valor)}</div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="fatura-resumo">
                    <div>
                      <span className="resumo-label">TOTAL DA FATURA</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Vence dia {selectedCartao?.dia_vencimento}</span>
                    </div>
                    <div className="fatura-valor" style={{ color: selectedCartao?.cor }}>
                      {formatMoney(calcularTotalMes(selectedCartao!.nome))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {(isEditing || showModalCadastro) && (
              <div className="modal-footer-icons">
                {isEditing ? (
                  <button type="button" className="btn-icon-action" onClick={() => handleDelete(selectedCartao!.id)}>
                    <img src={iconExcluir} alt="Excluir" title="Excluir Cartão" />
                  </button>
                ) : <div />}
                
                <div className="footer-right-actions">
                  <button type="button" className="btn-icon-action" onClick={() => isEditing ? setIsEditing(false) : fecharModais()}>
                    <img src={iconCancelar} alt="Cancelar" title="Cancelar" />
                  </button>
                  <button type="submit" form="card-form" className="btn-icon-action">
                    <img src={iconConfirme} alt="Salvar" title="Salvar Cartão" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Subcomponente de Campos ---
const FormFields = ({ form, setForm }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div className="form-group">
      <label>Instituição Financeira</label>
      <input className="form-control" placeholder="Ex: Nubank, Inter..." required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
    </div>
    <div className="form-group">
      <label>Limite de Crédito</label>
      <input className="form-control" type="number" step="0.01" required value={form.limite} onChange={e => setForm({...form, limite: e.target.value})} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div className="form-group">
         <label>Dia Fechamento</label>
         <input className="form-control" type="number" min="1" max="31" value={form.dia_fechamento} onChange={e => setForm({...form, dia_fechamento: e.target.value})} />
      </div>
      <div className="form-group">
         <label>Dia Vencimento</label>
         <input className="form-control" type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} />
      </div>
    </div>
    <div className="form-group">
      <label>Cor de Identificação</label>
      <input type="color" className="form-control" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} style={{ height: '50px', padding: '5px' }} />
    </div>
  </div>
);

export default Cartoes;