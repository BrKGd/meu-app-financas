import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  CreditCard, Plus, Trash2, X, Save, Calendar, ShoppingCart, Settings2, RotateCcw 
} from 'lucide-react';
import '../styles/Cartoes.css';

const Cartoes = () => {
  const [cartoes, setCartoes] = useState([]);
  const [compras, setCompras] = useState([]);
  const [showModalCadastro, setShowModalCadastro] = useState(false);
  const [selectedCartao, setSelectedCartao] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formCartao, setFormCartao] = useState({
    nome: '', limite: '', dia_fechamento: '', dia_vencimento: '', cor: '#6366f1'
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
    const { data: cData } = await supabase.from('cartoes').select('*').order('nome');
    const { data: compData } = await supabase.from('compras').select('*');
    setCartoes(cData || []);
    setCompras(compData || []);
    setLoading(false);
  }

  const getMesInicioCobranca = (item, cartoesReferencia) => {
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

  const calcularDisponivel = (cartao, limite) => {
    const totalComprometido = compras.reduce((acc, item) => {
      if (item.cartao !== cartao.nome) return acc;
      const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
      const numParcelas = item.num_parcelas || 1;
      const dataUltimaParcela = new Date(anoInicio, mesInicio + (numParcelas - 1), 1);
      const dataFronteiraMesAtual = new Date(anoAtual, mesAtual, 1);
      if (dataUltimaParcela >= dataFronteiraMesAtual) {
        return acc + parseFloat(item.valor_total);
      }
      return acc;
    }, 0);
    return parseFloat((limite - totalComprometido).toFixed(2));
  };

  const calcularTotalMes = (cartaoNome) => {
    const infoCartao = cartoes.find(c => c.nome === cartaoNome);
    if (!infoCartao) return 0;
    const total = compras.reduce((acc, item) => {
      if (item.cartao !== cartaoNome) return acc;
      const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
      const numParcelas = item.num_parcelas || 1;
      let valorNoMes = 0;
      for (let i = 0; i < numParcelas; i++) {
        const dP = new Date(anoInicio, mesInicio + i, 1);
        if (dP.getMonth() === mesAtual && dP.getFullYear() === anoAtual) {
          valorNoMes = parseFloat(item.valor_total) / numParcelas;
        }
      }
      return acc + valorNoMes;
    }, 0);
    return parseFloat(total.toFixed(2));
  };

  async function handleSave(e) {
    e.preventDefault();
    const payload = { 
      ...formCartao, 
      limite: parseFloat(parseFloat(formCartao.limite).toFixed(2)),
      dia_fechamento: parseInt(formCartao.dia_fechamento) || 1,
      dia_vencimento: parseInt(formCartao.dia_vencimento) || 1
    };

    if (isEditing && selectedCartao) {
      const { error } = await supabase.from('cartoes').update(payload).eq('id', selectedCartao.id);
      if (!error) { fetchDados(); fecharModais(); }
    } else {
      const { error } = await supabase.from('cartoes').insert([payload]);
      if (!error) { fetchDados(); fecharModais(); }
    }
  }

  async function handleDelete(id) {
    if (window.confirm('Excluir este cartão? Compras vinculadas ficarão sem cartão definido.')) {
      const { error } = await supabase.from('cartoes').delete().eq('id', id);
      if (!error) { fetchDados(); fecharModais(); }
    }
  }

  const formatMoney = (v) => `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="cartoes-container fade-in">
      <header className="cartoes-header">
        <div>
          <h1>Minha Carteira</h1>
          <p style={{ color: '#64748b', fontWeight: '500' }}>Gestão de limites e fechamento de faturas.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModalCadastro(true)} style={{ borderRadius: '16px', padding: '12px 24px' }}>
          <Plus size={20} /> Novo Cartão
        </button>
      </header>

      <div className="cartoes-grid">
        {cartoes.map(cartao => {
          const disponivel = calcularDisponivel(cartao, cartao.limite);
          const perc = Math.max(0, (disponivel / cartao.limite) * 100);

          return (
            <div key={cartao.id} className="card-cartao" 
              onClick={() => setSelectedCartao(cartao)}
              style={{ background: `linear-gradient(135deg, ${cartao.cor}, #0f172a)`, boxShadow: `0 20px 25px -5px ${cartao.cor}44` }}>
              
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
                      <small className="limit-available-label">LIMITE DISPONÍVEL</small>
                      <div className="limit-value">{formatMoney(disponivel)}</div>
                   </div>
                   <div style={{ fontSize: '0.85rem', fontWeight: '700', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
                     {Math.round(perc)}%
                   </div>
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
                  <h2 style={{ margin: 0, fontWeight: '800', color: '#fff' }}>{isEditing ? 'Editar Cartão' : selectedCartao.nome}</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isEditing && (
                      <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setFormCartao(selectedCartao); }} className="btn-close-round"><Settings2 size={18}/></button>
                    )}
                    <button onClick={fecharModais} className="btn-close-round"><X size={18}/></button>
                  </div>
               </div>
               {!isEditing && <div style={{ marginTop: '10px', opacity: 0.9, color: '#fff' }}>Limite Total: {formatMoney(selectedCartao.limite)}</div>}
            </div>

            <div style={{ padding: '30px' }}>
              {isEditing ? (
                <form onSubmit={handleSave}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                    <FormFields form={formCartao} setForm={setFormCartao} />
                  </div>
                  
                  {/* FOOTER DE EDIÇÃO MELHORADO */}
                  <div className="edit-actions-grid">
                    <button type="submit" className="btn-modal-save">
                      <Save size={18} /> Salvar
                    </button>
                    <button type="button" onClick={() => setIsEditing(false)} className="btn-modal-cancel">
                      <RotateCcw size={18} /> Cancelar
                    </button>
                    <button type="button" onClick={() => handleDelete(selectedCartao.id)} className="btn-modal-delete">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '15px' }}>
                    <ShoppingCart size={16} />
                    <h4 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase' }}>Fatura de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())}</h4>
                  </div>
                  
                  <div className="listagem-lancamentos">
                    {compras
                      .filter(c => c.cartao === selectedCartao.nome)
                      .map((item, idx) => {
                        const { mesInicio, anoInicio } = getMesInicioCobranca(item, cartoes);
                        const numParcelas = item.num_parcelas || 1;
                        let infoMês = null;
                        for (let i = 0; i < numParcelas; i++) {
                          const dP = new Date(anoInicio, mesInicio + i, 1);
                          if (dP.getMonth() === mesAtual && dP.getFullYear() === anoAtual) {
                            infoMês = { atual: i + 1, total: numParcelas, valor: parseFloat(item.valor_total) / numParcelas };
                          }
                        }
                        if (!infoMês) return null;
                        return (
                          <div key={idx} className="fatura-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ flex: 1, paddingRight: '10px' }}>
                              <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.95rem' }}>{item.loja || item.descricao}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.num_parcelas > 1 ? `Parcela ${infoMês.atual}/${infoMês.total}` : 'À Vista'}</div>
                            </div>
                            <div style={{ fontWeight: '800', color: '#0f172a' }}>{formatMoney(infoMês.valor)}</div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="fatura-resumo">
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', display: 'block' }}>TOTAL NO MÊS</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Vencimento dia {selectedCartao.dia_vencimento}</span>
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
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', padding: '35px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '25px', fontWeight: '900' }}>Cadastrar Cartão</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <FormFields form={formCartao} setForm={setFormCartao} />
               <button type="submit" className="btn-primary" style={{ height: '55px' }}>Criar Cartão</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FormFields = ({ form, setForm }) => (
  <>
    <div className="form-group">
      <label className="label-caps">Nome do Banco</label>
      <input className="form-control" placeholder="Ex: Nubank" required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
    </div>
    <div className="form-group">
      <label className="label-caps">Limite Total</label>
      <input className="form-control" type="number" step="0.01" placeholder="0.00" required value={form.limite} onChange={e => setForm({...form, limite: e.target.value})} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
      <div className="form-group">
         <label className="label-caps">Dia Fechamento</label>
         <input className="form-control" type="number" min="1" max="31" value={form.dia_fechamento} onChange={e => setForm({...form, dia_fechamento: e.target.value})} />
      </div>
      <div className="form-group">
         <label className="label-caps">Dia Vencimento</label>
         <input className="form-control" type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} />
      </div>
    </div>
    <div className="form-group">
      <label className="label-caps">Cor do Cartão</label>
      <input type="color" className="form-control" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} style={{ height: '50px', padding: '5px' }} />
    </div>
  </>
);

export default Cartoes;