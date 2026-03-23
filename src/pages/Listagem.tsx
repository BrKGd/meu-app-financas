import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ChevronLeft, ChevronRight, 
  Hash, Receipt, CreditCard, User, Calendar, 
  Tag, ShoppingBag, Landmark, Lock, UserPlus,
  CheckCircle2, Clock, RefreshCw, Repeat, Layers, CalendarDays
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Listagem.css';
import iconConfirme from '../assets/confirme.png';
import iconExcluir from '../assets/excluir.png';
import iconCancelar from '../assets/cancelar.png';
import iconFechar from '../assets/fechar.png';

// --- Interfaces ---
interface Perfil {
  id: string;
  nome: string;
  tipo_usuario: 'proprietario' | 'administrador' | 'comum';
  email?: string;
}

interface Categoria {
  id: string;
  nome: string;
  cor: string;
}

interface Cartao {
  id: number;
  nome: string;
  dia_fechamento: number;
  id_responsavel?: string; 
}

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
  parcelas_total: number;
  data_compra: string;
  data_vencimento?: string;
  periodo_referencia?: string; 
  recorrencia_id?: string | null;      
  cartao_id?: number | null; 
  cartao_nome_exibicao?: string; 
  forma_pagamento: string;
  categoria_id: string;
  status_pagamento: 'pendente' | 'pago' | 'vencido' | 'cancelado';
  tipo_lancamento: 'unico' | 'parcelado' | 'fixo';
  intervalo_frequencia?: 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | null;
  data_fim?: string | null; 
  parcela_numero?: number;
  valorVisual?: string; 
  nomeResponsavel?: string;
  nomeCriador?: string; 
  nomeCategoria?: string;
  corCategoria?: string; 
}

const Listagem: React.FC = () => {
  const [despesas, setDespesas] = useState<ItemCompra[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]); 
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [perfilLogado, setPerfilLogado] = useState<Perfil | null>(null);
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

  const mesesNominais = useMemo(() => [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ], []);

  const formasPagamento = useMemo(() => ["Boleto", "Crédito", "Débito", "Dinheiro", "Pix", "Transferência"].sort(), []);
  const tiposLancamento = ["unico", "parcelado", "fixo"];
  const statusPagamento = ["pendente", "pago", "vencido", "cancelado"];

  const currentUserId = perfilLogado?.id;

  const temPermissaoEscrita = useCallback((item: ItemCompra | null) => {
    if (!item || !currentUserId || !perfilLogado) return false;
    if (perfilLogado.tipo_usuario === 'proprietario') return true;
    return item.usuario_criacao === currentUserId;
  }, [perfilLogado, currentUserId]);

  const formatarMoedaVisual = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  };

  const mascaraMoedaInput = (valor: string) => {
    const v = valor.replace(/\D/g, "");
    return (Number(v) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const desformatarMoedaParaBanco = (valorString: string) => {
    if (!valorString) return 0;
    const apenasNumeros = valorString.replace(/\D/g, "");
    return parseFloat(apenasNumeros) / 100;
  };

  const completarNF = (valor: string | number | null) => {
    if (!valor) return '-';
    const apenasNumeros = valor.toString().replace(/\D/g, '');
    if (!apenasNumeros) return '-';
    return apenasNumeros.padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  };

  const fetchDespesas = useCallback(async (perfil: Perfil, mapaNomes: Record<string, string>, listaCartoes: Cartao[], mapaCats: Record<string, {nome: string, cor: string}>) => {
    const primeiroDia = `${filtroData.ano}-${String(filtroData.mes + 1).padStart(2, '0')}-01`;
    
    let query = supabase
      .from('compras')
      .select('*')
      .eq('periodo_referencia', primeiroDia)
      .order('data_compra', { ascending: false });
    
    if (perfil.tipo_usuario === 'comum') {
      query = query.eq('user_id', perfil.id);
    }
    
    const { data, error } = await query;
    if (error) return;

    const mapaCartoes: Record<number, string> = {};
    listaCartoes.forEach(c => {
      mapaCartoes[c.id] = c.nome;
    });

    const formatadas: ItemCompra[] = [];
    const mapaTotais: Record<string, number> = {};
    let acumuladoGeral = 0;

    (data as any[])?.forEach((item) => {
      const valorLinha = Number(item.valor_total);
      const nomeResp = mapaNomes[item.user_id] || '⚠️ Pendente';
      const nomeCriador = mapaNomes[item.usuario_criacao || ''] || 'Sistema'; 
      const infoCat = mapaCats[item.categoria_id] || { nome: 'Sem Categoria', cor: '#94a3b8' };
      
      const nomeDoCartao = item.cartao_id ? (mapaCartoes[item.cartao_id] || `ID: ${item.cartao_id}`) : '-';

      formatadas.push({ 
        ...item, 
        nomeResponsavel: nomeResp,
        nomeCriador: nomeCriador,
        nomeCategoria: infoCat.nome,
        corCategoria: infoCat.cor,
        cartao_nome_exibicao: nomeDoCartao
      });

      mapaTotais[nomeResp] = (mapaTotais[nomeResp] || 0) + valorLinha;
      acumuladoGeral += valorLinha;
    });

    setDespesas(formatadas);
    setTotalGeralMes(acumuladoGeral);
    setTotaisPorResponsavel(Object.entries(mapaTotais).map(([nome, valor]) => ({ nome, valor })));
  }, [filtroData.mes, filtroData.ano]);

  const carregarDadosIniciais = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [pRes, cRes, cartRes, meuPerfilRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, tipo_usuario'),
      supabase.from('categorias').select('id, nome, cor').in('tipo', ['despesa', 'pessoal']).order('nome'),
      supabase.from('cartoes').select('*').order('nome'), 
      supabase.from('profiles').select('*').eq('id', user.id).single()
    ]);

    const mapaNomes: Record<string, string> = {};
    (pRes.data as Perfil[])?.forEach(p => mapaNomes[p.id] = p.nome);
    setUsuarios((pRes.data as Perfil[]) || []);

    const mapaCats: Record<string, {nome: string, cor: string}> = {};
    (cRes.data as Categoria[])?.forEach(c => {
      mapaCats[c.id] = { nome: c.nome, cor: c.cor };
    });
    setCategorias((cRes.data as Categoria[]) || []);

    const meuPerfil = meuPerfilRes.data as Perfil;
    const isMaster = user.email === 'gleidson.fig@gmail.com';
    const tipoFinal = isMaster ? 'proprietario' : (meuPerfil?.tipo_usuario || 'comum');
    const perfilAtualizado: Perfil = { ...meuPerfil, id: user.id, tipo_usuario: tipoFinal as any };
    
    setPerfilLogado(perfilAtualizado);
    const listaCartoes = (cartRes.data as Cartao[]) || [];
    setCartoes(listaCartoes);

    fetchDespesas(perfilAtualizado, mapaNomes, listaCartoes, mapaCats);
  }, [fetchDespesas]);

  useEffect(() => { 
    carregarDadosIniciais(); 
  }, [carregarDadosIniciais]);

  const handleUpdate = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemParaEditar) return;

    if (!temPermissaoEscrita(itemParaEditar)) {
      setModal({ isOpen: true, type: 'error', title: 'Bloqueado', message: 'Sem permissão para editar.' });
      return;
    }

    try {
        const { error: errorCompra } = await supabase.from('compras').update({
          descricao: itemParaEditar.descricao,
          loja: itemParaEditar.loja,
          user_id: itemParaEditar.user_id,
          categoria_id: itemParaEditar.categoria_id,
          valor_total: itemParaEditar.valor_total,
          forma_pagamento: itemParaEditar.forma_pagamento,
          cartao_id: itemParaEditar.forma_pagamento === 'Crédito' ? itemParaEditar.cartao_id : null,
          data_compra: itemParaEditar.data_compra,
          status_pagamento: itemParaEditar.status_pagamento,
          tipo_lancamento: itemParaEditar.tipo_lancamento,
          parcelas_total: itemParaEditar.tipo_lancamento !== 'unico' ? itemParaEditar.parcelas_total : 1
        }).eq('id', itemParaEditar.id);

        if (errorCompra) throw errorCompra;
        
        setItemParaEditar(null);
        setModal({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Registro atualizado.' });
        carregarDadosIniciais();
    } catch (err: any) {
        setModal({ isOpen: true, type: 'error', title: 'Erro', message: err.message });
    }
  };

  const confirmDelete = (item: ItemCompra) => {
    setModal({
      isOpen: true,
      type: 'danger',
      title: 'Remover?',
      message: 'Deseja excluir este lançamento?',
      onConfirm: async () => {
        const { error } = await supabase.from('compras').delete().eq('id', item.id);
        if (!error) {
          setItemParaEditar(null);
          setModal(prev => ({ ...prev, isOpen: false }));
          carregarDadosIniciais();
        }
      }
    });
  };

  const mudarMes = (direcao: number) => {
    setFiltroData(prev => {
        let novoMes = prev.mes + direcao;
        let novoAno = prev.ano;
        if (novoMes < 0) { novoMes = 11; novoAno--; }
        else if (novoMes > 11) { novoMes = 0; novoAno++; }
        return { mes: novoMes, ano: novoAno };
    });
  };

  const cartoesFiltradosParaEdicao = useMemo(() => {
    if (!perfilLogado || !cartoes) return [];
    if (perfilLogado.tipo_usuario === 'proprietario') return cartoes;
    // Usuário comum só vê no dropdown os cartões em que ele é o id_responsavel
    return cartoes.filter(c => c.id_responsavel === perfilLogado.id);
  }, [cartoes, perfilLogado]);

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
                  <td className="cell-date">
                    <div style={{display: 'flex', flexDirection: 'column'}}>
                       <span>{item.data_compra.split('-').reverse().slice(0,2).join('/')}</span>
                       {item.periodo_referencia && (
                         <span style={{fontSize: '0.65rem', color: '#6366f1', fontWeight: 600}}>
                           Ref: {item.periodo_referencia.split('-')[1]}/{item.periodo_referencia.split('-')[0].slice(-2)}
                         </span>
                       )}
                    </div>
                  </td>
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
                  <td className="cell-main">
                    <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                        {item.recorrencia_id && <Repeat size={10} className="text-indigo-500" />}
                        {item.descricao}
                        {!temPermissaoEscrita(item) && <Lock size={12} style={{opacity: 0.5}} />}
                    </div>
                  </td>
                  <td className="cell-sub">{item.loja || '-'}</td>
                  <td className="cell-nf">{completarNF(item.nota_fiscal)}</td>
                  <td className="cell-nf">{item.pedido ? `#${item.pedido}` : '-'}</td>
                  <td>{item.forma_pagamento}</td>
                  <td style={{ fontWeight: 500, color: '#475569' }}>{item.cartao_nome_exibicao}</td>
                  <td>
                    <span className={`badge-parcela ${item.tipo_lancamento !== 'unico' ? 'is-parcelado' : 'is-avista'}`}>
                      {item.tipo_lancamento !== 'unico' ? `${item.parcela_numero}/${item.parcelas_total}` : 'À Vista'}
                    </span>
                  </td>
                  <td className="cell-value" style={{ textAlign: 'right' }}>
                    {formatarMoedaVisual(item.valor_total || 0)}
                  </td>
                  <td className="cell-sub" style={{ fontSize: '0.75rem' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                       <UserPlus size={10} /> {item.nomeCriador}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Nenhum lançamento encontrado.
                </td>
              </tr>
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
              <button onClick={() => setItemParaEditar(null)} className="btn-icon-action">
                  <img src={iconFechar} alt="Fechar" title="Fechar" />
              </button>
            </div>

            <div className="modal-scrollable-body">
              <form id="edit-form" onSubmit={handleUpdate}>
                <div className="grid-form">
                  <div className="form-group">
                    <label><Calendar size={12}/> Data Real Compra</label>
                    <input type="date" className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.data_compra} onChange={e => setItemParaEditar({...itemParaEditar, data_compra: e.target.value})} />
                  </div>

                  <div className="form-group">
                    <label><Layers size={12}/> Período Referência</label>
                    <input type="date" className="form-control" disabled={true} value={itemParaEditar.periodo_referencia || ''} />
                  </div>
                  
                  <div className="form-group">
                    <label><CheckCircle2 size={12}/> Status</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.status_pagamento ?? ''} onChange={e => setItemParaEditar({...itemParaEditar, status_pagamento: e.target.value as any})}>
                      {statusPagamento.map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><RefreshCw size={12}/> Tipo Lançamento</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.tipo_lancamento ?? ''} onChange={e => setItemParaEditar({...itemParaEditar, tipo_lancamento: e.target.value as any})}>
                      {tiposLancamento.map(tipo => <option key={tipo} value={tipo}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><User size={12}/> Responsável</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.user_id ?? ''} onChange={e => setItemParaEditar({...itemParaEditar, user_id: e.target.value})}>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><Tag size={12}/> Categoria</label>
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.categoria_id ?? ''} onChange={e => setItemParaEditar({...itemParaEditar, categoria_id: e.target.value})}>
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
                    <select className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.forma_pagamento ?? ''} onChange={e => setItemParaEditar({...itemParaEditar, forma_pagamento: e.target.value})}>
                      {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {itemParaEditar.forma_pagamento === 'Crédito' && (
                    <>
                      <div className="form-group">
                        <label><CreditCard size={12}/> Cartão</label>
                        <select 
                          className="form-control" 
                          disabled={!temPermissaoEscrita(itemParaEditar)} 
                          value={itemParaEditar.cartao_id ?? ''} 
                          onChange={e => setItemParaEditar({...itemParaEditar, cartao_id: e.target.value ? Number(e.target.value) : null})}
                        >
                          <option value="">Selecione...</option>
                          
                          {/* INJEÇÃO PARA VISUALIZAÇÃO: Se o cartão atual não estiver na lista filtrada (ex: cartão de outro usuário), mostra mas bloqueia */}
                          {itemParaEditar.cartao_id && !cartoesFiltradosParaEdicao.find(c => c.id === itemParaEditar.cartao_id) && (
                            <option key={itemParaEditar.cartao_id} value={itemParaEditar.cartao_id} disabled>
                              {itemParaEditar.cartao_nome_exibicao} (Somente Visualização)
                            </option>
                          )}

                          {cartoesFiltradosParaEdicao.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Parcelas</label>
                        <input type="number" min="1" className="form-control" disabled={!temPermissaoEscrita(itemParaEditar)} value={itemParaEditar.parcelas_total} onChange={e => setItemParaEditar({...itemParaEditar, parcelas_total: Number(e.target.value)})} />
                      </div>
                    </>
                  )}
                </div>
              </form>
            </div>

            {temPermissaoEscrita(itemParaEditar) ? (
              <div className="modal-footer-icons">
                <button type="button" className="btn-icon-action btn-delete" onClick={() => confirmDelete(itemParaEditar)}>
                  <img src={iconExcluir} alt="Excluir" />
                </button>
                <div className="footer-right-actions">
                  <button type="button" className="btn-icon-action" onClick={() => setItemParaEditar(null)}><img src={iconCancelar} alt="Cancelar" /></button>
                  <button type="submit" form="edit-form" className="btn-icon-action"><img src={iconConfirme} alt="Salvar" /></button>
                </div>
              </div>
            ) : (
                <div className="modal-footer-icons" style={{justifyContent: 'center', backgroundColor: '#f8fafc', padding: '15px'}}>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <Lock size={14} /> <span style={{fontSize: '0.85rem'}}>Somente Visualização (Autor: {itemParaEditar.nomeCriador})</span>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      <ModalFeedback 
        isOpen={modal.isOpen} type={modal.type} title={modal.title} message={modal.message}
        onClose={() => setModal({ ...modal, isOpen: false })} onConfirm={modal.onConfirm}
      />
    </div>
  );
};

export default Listagem;