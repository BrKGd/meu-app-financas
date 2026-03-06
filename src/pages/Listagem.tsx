import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ChevronLeft, ChevronRight, 
  Hash, Receipt, CreditCard, User, Calendar, 
  Tag, ShoppingBag, Landmark, Lock, UserPlus,
  CheckCircle2, Clock, RefreshCw
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Listagem.css';
import iconConfirme from '../assets/confirme.png';
import iconExcluir from '../assets/excluir.png';
import iconCancelar from '../assets/cancelar.png';
import iconFechar from '../assets/fechar.png';

// --- Interfaces para Tipagem Atualizada conforme SQL ---
interface ItemCompra {
  id: string;
  user_id: string;
  usuario_criacao?: string; 
  descricao: string;
  loja: string;
  nota_fiscal: string;
  pedido: string;
  valor_total: number;
  parcelado: boolean;
  num_parcelas: number;
  data_compra: string;
  cartao: string | null;
  forma_pagamento: string;
  categoria_id: string;
  // Campos vindos do seu SQL (CHECK constraints)
  status_pagamento: 'pendente' | 'pago' | 'vencido' | 'cancelado';
  tipo_recorrencia: string; 
  // Campos virtuais para UI
  parcelaAtual?: number;
  valorParcela?: number;
  nomeResponsavel?: string;
  nomeCriador?: string; 
  nomeCategoria?: string;
  corCategoria?: string; 
  valorVisual?: string; 
}

const Listagem: React.FC = () => {
  const [despesas, setDespesas] = useState<ItemCompra[]>([]);
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]); 
  const [categorias, setCategorias] = useState<any[]>([]);
  const [perfilLogado, setPerfilLogado] = useState<any>(null);
  const [itemParaEditar, setItemParaEditar] = useState<ItemCompra | null>(null);
  
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'danger';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const [filtroData, setFiltroData] = useState({ mes: new Date().getMonth(), ano: new Date().getFullYear() });
  const [totaisPorResponsavel, setTotaisPorResponsavel] = useState<{nome: string, valor: number}[]>([]);
  const [totalGeralMes, setTotalGeralMes] = useState(0);

  const mesesNominais = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const formasPagamento = ["Boleto", "Crédito", "Débito", "Dinheiro", "Pix", "Transferência"].sort();
  const opcoesRecorrencia = ["Nenhuma", "Mensal", "Anual"];

  const isProprietario = perfilLogado?.tipo_usuario === 'proprietario';
  const currentUserId = perfilLogado?.id;

  const temPermissaoEscrita = (item: ItemCompra | null) => {
    if (!item) return false;
    if (isProprietario) return true; 
    return item.usuario_criacao === currentUserId; 
  };

  const formatarMoedaVisual = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  };

  const mascaraMoedaInput = (valor: string) => {
    let v = valor.replace(/\D/g, "");
    v = (Number(v) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return v;
  };

  const desformatarMoedaParaBanco = (valorString: string) => {
    if (!valorString) return 0;
    const apenasNumeros = valorString.replace(/\D/g, "");
    return parseFloat(apenasNumeros) / 100;
  };

  const completarNF = (valor: any) => {
    if (!valor) return '-';
    const apenasNumeros = valor.toString().replace(/\D/g, '');
    if (!apenasNumeros) return '-';
    return apenasNumeros.padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  };

  const fetchDespesas = useCallback(async (perfil: any, mapaNomes: any, listaCartoes: any[], mapaCats: any) => {
    let query = (supabase.from('compras') as any).select('*').order('data_compra', { ascending: false });
    
    if (perfil?.tipo_usuario === 'comum') {
      query = query.eq('user_id', perfil.id);
    }
    
    const { data, error } = await query;
    if (error) return;

    const projetadas: ItemCompra[] = [];
    const mapaTotais: Record<string, number> = {};
    let acumuladoGeral = 0;

    (data as any[])?.forEach((item) => {
      const numParcelas = item.num_parcelas || 1;
      const [anoC, mesC, diaC] = item.data_compra.split('-').map(Number);
      
      let delayMes = 0;
      if (item.forma_pagamento === 'Crédito' && item.cartao) {
        const infoCartao = listaCartoes.find(c => c.nome === item.cartao);
        if (infoCartao && diaC > infoCartao.dia_fechamento) {
          delayMes = 1;
        }
      }

      for (let i = 0; i < numParcelas; i++) {
        const dataReferenciaParcela = new Date(anoC, (mesC - 1) + delayMes + i, 15);
        
        if (dataReferenciaParcela.getMonth() === filtroData.mes && dataReferenciaParcela.getFullYear() === filtroData.ano) {
          const valorParcela = Number(item.valor_total) / numParcelas;
          const nomeResp = mapaNomes[item.user_id] || '⚠️ Pendente';
          const nomeCriador = mapaNomes[item.usuario_criacao] || 'Sistema'; 
          const infoCat = mapaCats[item.categoria_id] || { nome: 'Sem Categoria', cor: '#94a3b8' };

          projetadas.push({ 
            ...item, 
            parcelaAtual: i + 1, 
            valorParcela: valorParcela, 
            nomeResponsavel: nomeResp,
            nomeCriador: nomeCriador,
            nomeCategoria: infoCat.nome,
            corCategoria: infoCat.cor
          });

          mapaTotais[nomeResp] = (mapaTotais[nomeResp] || 0) + valorParcela;
          acumuladoGeral += valorParcela;
        }
      }
    });

    setDespesas(projetadas);
    setTotalGeralMes(acumuladoGeral);
    setTotaisPorResponsavel(Object.entries(mapaTotais).map(([nome, valor]) => ({ nome, valor })));
  }, [filtroData]);

  const carregarDadosIniciais = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [pRes, cRes, cartRes, meuPerfilRes] = await Promise.all([
      (supabase.from('profiles') as any).select('id, nome'),
      (supabase.from('categorias') as any).select('id, nome, cor').eq('tipo', 'despesa').order('nome'),
      (supabase.from('cartoes') as any).select('id, nome, dia_fechamento').order('nome'),
      (supabase.from('profiles') as any).select('*').eq('id', user.id).single()
    ]);

    const mapaNomes: any = {};
    (pRes.data as any[])?.forEach(p => mapaNomes[p.id] = p.nome);
    setUsuarios(pRes.data || []);

    const mapaCats: any = {};
    (cRes.data as any[])?.forEach(c => {
      mapaCats[c.id] = { nome: c.nome, cor: c.cor };
    });
    setCategorias(cRes.data || []);

    const meuPerfil = meuPerfilRes.data as any;
    const isMaster = user.email === 'gleidson.fig@gmail.com';
    const tipoFinal = isMaster ? 'proprietario' : (meuPerfil?.tipo_usuario || 'comum');
    const perfilAtualizado = { ...meuPerfil, id: user.id, tipo_usuario: tipoFinal };
    
    setPerfilLogado(perfilAtualizado);
    setCartoes(cartRes.data || []);

    fetchDespesas(perfilAtualizado, mapaNomes, cartRes.data || [], mapaCats);
  }, [fetchDespesas]);

  useEffect(() => { 
    carregarDadosIniciais(); 
  }, [carregarDadosIniciais]);

  const handleUpdate = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemParaEditar) return;

    if (!temPermissaoEscrita(itemParaEditar)) {
        setModal({ isOpen: true, type: 'error', title: 'Bloqueado', message: 'Você não tem permissão para editar este registro.' });
        return;
    }

    const isCredito = itemParaEditar.forma_pagamento === 'Crédito';
    
    // CORREÇÃO DO ERRO 400: Enviando apenas o que existe na tabela 'compras'
    const { error } = await (supabase.from('compras') as any).update({
      descricao: itemParaEditar.descricao,
      loja: itemParaEditar.loja,
      user_id: itemParaEditar.user_id,
      usuario_criacao: itemParaEditar.usuario_criacao || perfilLogado.id, 
      categoria_id: itemParaEditar.categoria_id,
      valor_total: itemParaEditar.valor_total,
      forma_pagamento: itemParaEditar.forma_pagamento,
      cartao: isCredito ? itemParaEditar.cartao : null,
      data_compra: itemParaEditar.data_compra,
      num_parcelas: isCredito ? Number(itemParaEditar.num_parcelas) : 1,
      parcelado: isCredito && Number(itemParaEditar.num_parcelas) > 1,
      pedido: itemParaEditar.pedido,
      nota_fiscal: itemParaEditar.nota_fiscal,
      // Novos campos vindos da estrutura SQL:
      status_pagamento: itemParaEditar.status_pagamento.toLowerCase(), 
      tipo_recorrencia: itemParaEditar.tipo_recorrencia || 'Nenhuma'
    }).eq('id', itemParaEditar.id);

    if (error) {
      setModal({ isOpen: true, type: 'error', title: 'Erro ao Salvar', message: error.message });
    } else {
      setItemParaEditar(null);
      setModal({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Lançamento atualizado.' });
      carregarDadosIniciais();
    }
  };

  const confirmDelete = (id: string) => {
    if (!temPermissaoEscrita(itemParaEditar)) return;
    setModal({
      isOpen: true,
      type: 'danger',
      title: 'Remover?',
      message: 'Esta ação excluirá o gasto permanentemente.',
      onConfirm: async () => {
        const { error } = await (supabase.from('compras') as any).delete().eq('id', id);
        if (!error) {
          setItemParaEditar(null); 
          setModal(prev => ({ ...prev, isOpen: false }));
          carregarDadosIniciais();
        }
      }
    });
  };

  const mudarMes = (direcao: number) => {
    let novoMes = filtroData.mes + direcao;
    let novoAno = filtroData.ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    else if (novoMes > 11) { novoMes = 0; novoAno++; }
    setFiltroData({ mes: novoMes, ano: novoAno });
  };

  return (
    <div className="listagem-container fade-in">
      <div className="listagem-header">
        <div className="header-title-wrapper">
          <h2>Extrato</h2>
          <span className="header-subtitle">{mesesNominais[filtroData.mes]} de {filtroData.ano}</span>
        </div>
        
        <div className="modern-navigator">
          <button onClick={() => mudarMes(-1)} className="nav-circle-btn"><ChevronLeft size={20} /></button>
          <div className="nav-info">
            <span className="nav-month">{mesesNominais[filtroData.mes]}</span>
            <span className="nav-year">{filtroData.ano}</span>
          </div>
          <button onClick={() => mudarMes(1)} className="nav-circle-btn"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>Categoria</th>
              <th>Recorrência</th>
              <th>Descrição</th>
              <th>Loja</th>
              <th>NF</th>
              <th>Pedido</th>
              <th>Pagamento</th>
              <th>Cartão</th>
              <th>Parcela</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Lançado por</th>
            </tr>
          </thead>
          <tbody>
            {despesas.length > 0 ? (
              despesas.map((item, idx) => (
                <tr key={`${item.id}-${idx}`} className="clickable-row" onClick={() => setItemParaEditar({...item})}>
                  <td className="cell-date">{item.data_compra.split('-').reverse().slice(0,2).join('/')}</td>
                  <td>
                    <span className={`status-badge status-${item.status_pagamento}`}>
                      {item.status_pagamento === 'pago' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {item.status_pagamento}
                    </span>
                  </td>
                  <td className="cell-user">{item.nomeResponsavel}</td>
                  <td className="cell-category">
                    <span className="cat-badge" style={{ backgroundColor: `${item.corCategoria}20`, color: item.corCategoria, border: `1px solid ${item.corCategoria}40` }}>
                      {item.nomeCategoria}
                    </span>
                  </td>
                  <td className="cell-sub">{item.tipo_recorrencia !== 'Nenhuma' ? item.tipo_recorrencia : '-'}</td>
                  <td className="cell-main">
                    {item.descricao}
                    {!temPermissaoEscrita(item) && <Lock size={12} style={{marginLeft: '6px', opacity: 0.5}} />}
                  </td>
                  <td className="cell-sub">{item.loja || '-'}</td>
                  <td className="cell-nf">{completarNF(item.nota_fiscal)}</td>
                  <td className="cell-nf">{item.pedido ? `#${item.pedido}` : '-'}</td>
                  <td>{item.forma_pagamento}</td>
                  <td>{item.cartao || '-'}</td>
                  <td>
                    <span className={`badge-parcela ${item.parcelado ? 'is-parcelado' : 'is-avista'}`}>
                      {item.parcelado ? `${item.parcelaAtual}/${item.num_parcelas}` : 'À Vista'}
                    </span>
                  </td>
                  <td className="cell-value" style={{ textAlign: 'right' }}>{formatarMoedaVisual(item.valorParcela || 0)}</td>
                  <td className="cell-sub" style={{ fontSize: '0.75rem' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                       <UserPlus size={10} /> {item.nomeCriador}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Nenhum lançamento.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {despesas.length > 0 && (
        <div className="resumo-badges-container fade-in">
          <div className="resumo-badges-list">
            {totaisPorResponsavel.map((resp, i) => (
              <div key={i} className="badge-responsavel">
                <span className="badge-nome">{resp.nome.split(' ')[0]}:</span>
                <span className="badge-valor">{formatarMoedaVisual(resp.valor)}</span>
              </div>
            ))}
          </div>
          <div className="resumo-badges-list">
            <div className="total-geral-badge">
              <span className="badge-nome">Total Geral:</span>
              <span className="badge-valor">{formatarMoedaVisual(totalGeralMes)}</span>
            </div>
          </div>
        </div>
      )}

      {itemParaEditar && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-content">
            <div className="modal-fixed-header">
              <h3>{temPermissaoEscrita(itemParaEditar) ? 'Editar Gasto' : 'Detalhes do Gasto'}</h3>
              <button onClick={() => setItemParaEditar(null)} className="btn-icon-action"><img src={iconFechar} alt="Fechar" /></button>
            </div>

            <div className="modal-scrollable-body">
              <form id="edit-form" onSubmit={handleUpdate}>
                <div className="grid-form">
                  <div className="form-group">
                    <label><Calendar size={12}/> Data</label>
                    <input type="date" className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.data_compra} onChange={e => setItemParaEditar({...itemParaEditar, data_compra: e.target.value})} />
                  </div>
                  
                  <div className="form-group">
                    <label><CheckCircle2 size={12}/> Status</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.status_pagamento} onChange={e => setItemParaEditar({...itemParaEditar, status_pagamento: e.target.value as any})}>
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="vencido">Vencido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label><RefreshCw size={12}/> Recorrência</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.tipo_recorrencia || 'Nenhuma'} onChange={e => setItemParaEditar({...itemParaEditar, tipo_recorrencia: e.target.value})}>
                      {opcoesRecorrencia.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><User size={12}/> Responsável</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.user_id} onChange={e => setItemParaEditar({...itemParaEditar, user_id: e.target.value})}>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><Tag size={12}/> Categoria</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.categoria_id} onChange={e => setItemParaEditar({...itemParaEditar, categoria_id: e.target.value})}>
                      {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><ShoppingBag size={12}/> Loja</label>
                    <input className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.loja || ''} onChange={e => setItemParaEditar({...itemParaEditar, loja: e.target.value})} />
                  </div>

                  <div className="form-group full-width">
                    <label>Descrição</label>
                    <input className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.descricao} onChange={e => setItemParaEditar({...itemParaEditar, descricao: e.target.value})} />
                  </div>

                  <div className="form-group">
                    <label>Valor Total</label>
                    <input type="text" className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.valorVisual || formatarMoedaVisual(itemParaEditar.valor_total)} 
                      onChange={e => {
                        const masked = mascaraMoedaInput(e.target.value);
                        setItemParaEditar({...itemParaEditar, valorVisual: masked, valor_total: desformatarMoedaParaBanco(masked)});
                      }} 
                    />
                  </div>

                  <div className="form-group">
                    <label><Landmark size={12}/> Pagamento</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.forma_pagamento} onChange={e => setItemParaEditar({...itemParaEditar, forma_pagamento: e.target.value})}>
                      {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {itemParaEditar.forma_pagamento === 'Crédito' && (
                    <>
                      <div className="form-group">
                        <label><CreditCard size={12}/> Cartão</label>
                        <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.cartao || ''} onChange={e => setItemParaEditar({...itemParaEditar, cartao: e.target.value})}>
                          <option value="">Selecione...</option>
                          {cartoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Parcelas</label>
                        <input type="number" min="1" className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.num_parcelas} onChange={e => setItemParaEditar({...itemParaEditar, num_parcelas: Number(e.target.value)})} />
                      </div>
                    </>
                  )}
                </div>
              </form>
            </div>

            {temPermissaoEscrita(itemParaEditar) ? (
              <div className="modal-footer-icons">
                <button type="button" className="btn-icon-action btn-delete" onClick={() => confirmDelete(itemParaEditar.id)}><img src={iconExcluir} alt="Excluir" /></button>
                <div className="footer-right-actions">
                  <button type="button" className="btn-icon-action" onClick={() => setItemParaEditar(null)}><img src={iconCancelar} alt="Cancelar" /></button>
                  <button type="submit" form="edit-form" className="btn-icon-action"><img src={iconConfirme} alt="Salvar" /></button>
                </div>
              </div>
            ) : (
                <div className="modal-footer-icons" style={{justifyContent: 'center', backgroundColor: '#f8fafc', padding: '15px', borderTop: '1px solid #e2e8f0'}}>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px'}}>
                        <div style={{display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 600}}><Lock size={14} style={{marginRight: '8px'}} /> Apenas visualização</div>
                        <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>Registro por: {itemParaEditar.nomeCriador}</span>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      <ModalFeedback isOpen={modal.isOpen} type={modal.type} title={modal.title} message={modal.message} onClose={() => setModal({ ...modal, isOpen: false })} onConfirm={modal.onConfirm} />
    </div>
  );
};

export default Listagem;