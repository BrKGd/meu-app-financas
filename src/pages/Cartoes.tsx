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
interface Perfil {
  id: string;
  nome: string;
}

interface PerfilLogado {
  id: string;
  tipo_usuario: string;
}

interface Cartao {
  id: number;
  nome: string;
  limite: number | string;
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string;
  id_responsavel: string;
  usuario_criacao?: string;
}

interface Compra {
  id: string;
  descricao: string;
  loja?: string;
  valor_total: number;
  parcela_numero: number;
  parcelas_total: number;
  data_compra: string; 
  cartao_id: number; 
  forma_pagamento: string;
  periodo_referencia: string;
  status_pagamento: string;
}

const Cartoes: React.FC = () => {
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [perfilLogado, setPerfilLogado] = useState<PerfilLogado | null>(null);
  const [showModalCadastro, setShowModalCadastro] = useState<boolean>(false);
  const [selectedCartao, setSelectedCartao] = useState<Cartao | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [formCartao, setFormCartao] = useState({
    nome: '', 
    limite: '', 
    dia_fechamento: '', 
    dia_vencimento: '', 
    cor: '#4361ee',
    id_responsavel: ''
  });

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const periodoAtual = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;

  const getSettingsColor = (hexcolor: string) => {
    if (!hexcolor) return '#ffffff';
    const hex = hexcolor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
  };

  const fecharModais = useCallback(() => {
    setShowModalCadastro(false);
    setSelectedCartao(null);
    setIsEditing(false);
    setFormCartao({ nome: '', limite: '', dia_fechamento: '', dia_vencimento: '', cor: '#4361ee', id_responsavel: '' });
  }, []);

  useEffect(() => {
    fetchDados();
    fetchUsuarios();
    fetchPerfilLogado();
  }, []);

  async function fetchPerfilLogado() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('profiles')
      .select('id, tipo_usuario')
      .eq('id', user.id)
      .single();

    if (data) {
      const isMaster = user.email === 'gleidson.fig@gmail.com';
      setPerfilLogado({
        id: data.id,
        tipo_usuario: isMaster ? 'proprietario' : data.tipo_usuario
      });
    }
  }

  async function fetchUsuarios() {
    const { data } = await supabase.from('profiles').select('id, nome').order('nome');
    if (data) setUsuarios(data);
  }

  async function fetchDados() {
    setLoading(true);
    try {
      const [cData, compData] = await Promise.all([
        supabase.from('cartoes').select('*').order('nome'),
        supabase.from('compras').select('*').eq('forma_pagamento', 'Crédito')
      ]);
      setCartoes((cData.data as any[]) || []);
      setCompras((compData.data as any[]) || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  }

  const abrirModalCadastro = () => {
    setShowModalCadastro(true);
    if (perfilLogado && perfilLogado.tipo_usuario !== 'proprietario') {
      setFormCartao(prev => ({ ...prev, id_responsavel: perfilLogado.id }));
    }
  };

  const calcularDisponivel = (cartao: Cartao, limite: number | string) => {
    const limNum = Number(limite);
    const totalComprometido = compras.reduce((acc, item) => {
      if (item.cartao_id !== cartao.id) return acc;
      if (item.status_pagamento === 'pago') return acc;
      if (item.periodo_referencia >= periodoAtual) {
          return acc + Number(item.valor_total);
      }
      return acc;
    }, 0);
    return Number((limNum - totalComprometido).toFixed(2));
  };

  const calcularTotalMes = (cartaoId: number) => {
    const total = compras.reduce((acc, item) => {
      if (item.cartao_id === cartaoId && item.periodo_referencia === periodoAtual) {
        return acc + Number(item.valor_total);
      }
      return acc;
    }, 0);
    return Number(total.toFixed(2));
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload: any = { 
      nome: formCartao.nome,
      limite: parseFloat(formCartao.limite) || 0,
      dia_fechamento: parseInt(formCartao.dia_fechamento) || 1,
      dia_vencimento: parseInt(formCartao.dia_vencimento) || 1,
      cor: formCartao.cor,
      id_responsavel: formCartao.id_responsavel || user.id,
    };

    try {
      if (isEditing && selectedCartao) {
        await supabase.from('cartoes').update(payload).eq('id', selectedCartao.id);
      } else {
        payload.usuario_criacao = user.id;
        await supabase.from('cartoes').insert([payload]);
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
        <button className="btn-primary" onClick={abrirModalCadastro}>
          <Plus size={20} /> Novo Cartão
        </button>
      </header>

      <div className="cartoes-grid">
        {cartoes
          // FILTRO ADICIONADO AQUI:
          .filter(cartao => {
            if (!perfilLogado) return false;
            if (perfilLogado.tipo_usuario === 'proprietario') return true; // Gleidson vê tudo
            return cartao.id_responsavel === perfilLogado.id; // Outros veem só o seu
          })
          .map(cartao => {
            const disponivel = calcularDisponivel(cartao, cartao.limite);
            const perc = Math.max(0, (disponivel / Number(cartao.limite)) * 100);
            const responsavelObj = usuarios.find(u => u.id === cartao.id_responsavel);

            return (
              <div key={cartao.id} className="card-cartao" 
                onClick={() => setSelectedCartao(cartao)}
                style={{ background: `linear-gradient(135deg, ${cartao.cor}, #0f172a)` }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                     <span className="card-label">
                       {responsavelObj ? responsavelObj.nome : 'Crédito'}
                     </span>
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

      {/* Restante do código dos modais e formulários permanece idêntico conforme sua solicitação */}
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
                              cor: selectedCartao!.cor,
                              id_responsavel: selectedCartao!.id_responsavel
                          }); 
                      }} className="btn-icon-action">
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
                  <FormFields form={formCartao} setForm={setFormCartao} usuarios={usuarios} perfilLogado={perfilLogado} />
                </form>
              ) : (
                <>
                  <div className="listagem-lancamentos">
                    <h4 style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }}>Lançamentos do Mês</h4>
                    {compras
                      .filter(c => c.cartao_id === selectedCartao?.id && c.periodo_referencia === periodoAtual)
                      .map((item, idx) => (
                          <div key={idx} className="fatura-item">
                            <div>
                              <div className="fatura-item-desc">{item.descricao || item.loja}</div>
                              <div className="fatura-item-sub">
                                {item.parcelas_total > 1 ? `Parcela ${item.parcela_numero}/${item.parcelas_total}` : 'À Vista'}
                                {item.status_pagamento === 'pago' && <span style={{ marginLeft: '8px', color: '#10b981' }}>• Pago</span>}
                              </div>
                            </div>
                            <div className="fatura-item-valor">{formatMoney(item.valor_total)}</div>
                          </div>
                      ))}
                  </div>
                  <div className="fatura-resumo">
                    <div>
                      <span className="resumo-label">TOTAL DA FATURA</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Vence dia {selectedCartao?.dia_vencimento}</span>
                    </div>
                    <div className="fatura-valor" style={{ color: selectedCartao?.cor }}>
                      {formatMoney(calcularTotalMes(selectedCartao!.id))}
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

const FormFields = ({ form, setForm, usuarios, perfilLogado }: any) => {
  const isProprietario = perfilLogado?.tipo_usuario === 'proprietario';

  return (
    <div className= "modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="form-group">
        <label>Responsável</label>
        <select 
          className="form-control" 
          value={form.id_responsavel} 
          onChange={e => setForm({...form, id_responsavel: e.target.value})}
          required
          disabled={!isProprietario}
          style={!isProprietario ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', opacity: 0.8 } : {}}
        >
          {isProprietario ? (
            <>
              <option value="">Selecione quem usará este cartão</option>
              {usuarios.map((u: any) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </>
          ) : (
            usuarios
              .filter((u: any) => u.id === perfilLogado?.id)
              .map((u: any) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))
          )}
        </select>
      </div>

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
        <label>Cor de Identificação (Hexadecimal)</label>
        <div className ="seletor-cor" style={{ display: 'flex', gap: '10px', alignItems: 'center'}}>
          <input 
            type="color" 
            className="color-picker-input" 
            value={form.cor.startsWith('#') && form.cor.length === 7 ? form.cor : '#4361ee'} 
            onChange={e => setForm({...form, cor: e.target.value})} 
            style={{ width: 'auto', height: '45px', padding: '2px', border: '2px solid #f1f5f9', borderRadius: '12px', cursor: 'pointer' }} 
          />
          <input 
            type="text" 
            className="form-control" 
            placeholder="#000000"
            value={form.cor} 
            onChange={e => setForm({...form, cor: e.target.value})}
            maxLength={7}
            style={{ flex: 1 }}
          />
        </div>
      </div>
    </div>
  );
};

export default Cartoes;