import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ChevronLeft, ChevronRight, Trash2, X, Save, 
  Hash, Receipt, CreditCard, User, Calendar, 
  Tag
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Listagem.css';

// --- Interfaces para Tipagem ---
interface ItemCompra {
  id: string;
  user_id: string;
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
  // Propriedades calculadas para exibição
  parcelaAtual?: number;
  valorParcela?: number;
  nomeResponsavel?: string;
  nomeCategoria?: string;
  valorVisual?: string; 
}

const Listagem: React.FC = () => {
  const [despesas, setDespesas] = useState<ItemCompra[]>([]);
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]); 
  const [categorias, setCategorias] = useState<any[]>([]);
  const [perfilLogado, setPerfilLogado] = useState<any>(null);
  const [itemParaEditar, setItemParaEditar] = useState<ItemCompra | null>(null);
  
  // Ajuste no tipo do modal para evitar erro 2322 (onConfirm)
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

  const isProprietario = perfilLogado?.tipo_usuario === 'proprietario';

  // --- Funções de Formatação ---
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
    if (!valor) return '';
    const apenasNumeros = valor.toString().replace(/\D/g, '');
    if (!apenasNumeros) return '';
    return apenasNumeros.padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  };

  // --- Lógica de Busca e Processamento ---
  const fetchDespesas = useCallback(async (perfil: any, mapaNomes: any, listaCartoes: any[], mapaCats: any) => {
    // Casting (as any) para evitar erro 'never' na query
    let query = (supabase.from('compras') as any).select('*').order('data_compra', { ascending: false });
    
    if (perfil?.tipo_usuario !== 'proprietario') {
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
        // Usamos dia 15 para evitar bugs de virada de mês/fevereiro
        const dataReferenciaParcela = new Date(anoC, (mesC - 1) + delayMes + i, 15);
        
        if (dataReferenciaParcela.getMonth() === filtroData.mes && dataReferenciaParcela.getFullYear() === filtroData.ano) {
          const valorParcela = Number(item.valor_total) / numParcelas;
          const nomeResp = mapaNomes[item.user_id] || '⚠️ Pendente';
          const nomeCat = mapaCats[item.categoria_id] || 'Sem Categoria';

          projetadas.push({ 
            ...item, 
            parcelaAtual: i + 1, 
            valorParcela: valorParcela, 
            nomeResponsavel: nomeResp,
            nomeCategoria: nomeCat
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

    // Resolvendo Erros 2339 e 2698 com casting explícito
    const [pRes, cRes, cartRes, meuPerfilRes] = await Promise.all([
      (supabase.from('profiles') as any).select('id, nome'),
      (supabase.from('categorias') as any).select('id, nome').eq('tipo', 'despesa').order('nome'),
      (supabase.from('cartoes') as any).select('id, nome, dia_fechamento').order('nome'),
      (supabase.from('profiles') as any).select('*').eq('id', user.id).single()
    ]);

    const mapaNomes: any = {};
    (pRes.data as any[])?.forEach(p => mapaNomes[p.id] = p.nome);
    setUsuarios(pRes.data || []);

    const mapaCats: any = {};
    (cRes.data as any[])?.forEach(c => mapaCats[c.id] = c.nome);
    setCategorias(cRes.data || []);

    const meuPerfil = meuPerfilRes.data as any;
    const isMaster = user.email === 'gleidson.fig@gmail.com';
    const tipoFinal = isMaster ? 'proprietario' : (meuPerfil?.tipo_usuario || 'comum');
    
    // Erro 2698 resolvido: Criando objeto a partir de tipo conhecido
    const perfilAtualizado = { ...meuPerfil, tipo_usuario: tipoFinal };
    
    setPerfilLogado(perfilAtualizado);
    setCartoes(cartRes.data || []);

    fetchDespesas(perfilAtualizado, mapaNomes, cartRes.data || [], mapaCats);
  }, [fetchDespesas]);

  useEffect(() => { 
    carregarDadosIniciais(); 
  }, [carregarDadosIniciais]);

  // --- Handlers de Ações ---
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProprietario || !itemParaEditar) return;

    const isCredito = itemParaEditar.forma_pagamento === 'Crédito';
    
    // Erro 2345 resolvido com casting (as any) no .from()
    const { error } = await (supabase.from('compras') as any).update({
      descricao: itemParaEditar.descricao,
      loja: itemParaEditar.loja,
      user_id: itemParaEditar.user_id,
      categoria_id: itemParaEditar.categoria_id,
      valor_total: itemParaEditar.valor_total,
      forma_pagamento: itemParaEditar.forma_pagamento,
      cartao: isCredito ? itemParaEditar.cartao : null,
      data_compra: itemParaEditar.data_compra,
      num_parcelas: isCredito ? Number(itemParaEditar.num_parcelas) : 1,
      parcelado: isCredito && Number(itemParaEditar.num_parcelas) > 1,
      pedido: itemParaEditar.pedido,
      nota_fiscal: itemParaEditar.nota_fiscal
    }).eq('id', itemParaEditar.id);

    if (!error) {
      setItemParaEditar(null);
      setModal({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Lançamento atualizado.' });
      carregarDadosIniciais();
    }
  };

  const confirmDelete = (id: string) => {
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
              <th>Responsável</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Loja</th>
              <th>NF / Pedido</th>
              <th>Pagamento</th>
              <th>Parcela</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {despesas.length > 0 ? (
              despesas.map((item, idx) => (
                <tr key={`${item.id}-${idx}`} className="clickable-row" onClick={() => setItemParaEditar({...item})}>
                  <td className="cell-date">{item.data_compra.split('-').reverse().slice(0,2).join('/')}</td>
                  <td className="cell-user">{item.nomeResponsavel}</td>
                  <td className="cell-category"><span className="cat-badge">{item.nomeCategoria}</span></td>
                  <td className="cell-main">{item.descricao}</td>
                  <td className="cell-sub">{item.loja || '-'}</td>
                  <td className="cell-nf">
                    <div className="main-text">{completarNF(item.nota_fiscal) || '-'}</div>
                    <div className="sub-text">{item.pedido && `#${item.pedido}`}</div>
                  </td>
                  <td>
                      <div className="main-text">{item.forma_pagamento}</div>
                      <div className="sub-text">{item.cartao}</div>
                  </td>
                  <td>
                    <span className={`badge-parcela ${item.parcelado ? 'is-parcelado' : 'is-avista'}`}>
                      {item.parcelado ? `${item.parcelaAtual}/${item.num_parcelas}` : 'À Vista'}
                    </span>
                  </td>
                  <td className="cell-value" style={{ textAlign: 'right' }}>
                    {formatarMoedaVisual(item.valorParcela || 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Nenhum lançamento encontrado para este mês.
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
          <div className="total-geral-badge">
            <span className="badge-nome">Total Geral:</span>
            <span className="badge-valor">{formatarMoedaVisual(totalGeralMes)}</span>
          </div>
        </div>
      )}

      {itemParaEditar && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-content">
            <div className="modal-fixed-header">
              <h3>{isProprietario ? 'Editar Gasto' : 'Detalhes do Gasto'}</h3>
              <button onClick={() => setItemParaEditar(null)} className="btn-close-round"><X size={20}/></button>
            </div>

            <div className="modal-scrollable-body">
              <form id="edit-form" onSubmit={handleUpdate}>
                <div className="grid-form">
                  <div className="form-group">
                    <label><Calendar size={12}/> Data Compra</label>
                    <input type="date" className="form-control" disabled={!isProprietario} value={itemParaEditar.data_compra} onChange={e => setItemParaEditar({...itemParaEditar, data_compra: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label><User size={12}/> Responsável</label>
                    <select className="form-control" disabled={!isProprietario} value={itemParaEditar.user_id} onChange={e => setItemParaEditar({...itemParaEditar, user_id: e.target.value})}>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label><Tag size={12}/> Categoria</label>
                    <select className="form-control" disabled={!isProprietario} value={itemParaEditar.categoria_id} onChange={e => setItemParaEditar({...itemParaEditar, categoria_id: e.target.value})}>
                      <option value="">Selecione...</option>
                      {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Descrição</label>
                    <input className="form-control" disabled={!isProprietario} value={itemParaEditar.descricao} onChange={e => setItemParaEditar({...itemParaEditar, descricao: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Valor Total</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      disabled={!isProprietario} 
                      value={itemParaEditar.valorVisual || formatarMoedaVisual(itemParaEditar.valor_total)} 
                      onChange={e => {
                        const masked = mascaraMoedaInput(e.target.value);
                        setItemParaEditar({
                          ...itemParaEditar,
                          valorVisual: masked,
                          valor_total: desformatarMoedaParaBanco(masked)
                        });
                      }} 
                    />
                  </div>
                  <div className="form-group">
                    <label><Receipt size={12}/> Nota Fiscal</label>
                    <input className="form-control" disabled={!isProprietario} value={itemParaEditar.nota_fiscal || ''} onChange={e => setItemParaEditar({...itemParaEditar, nota_fiscal: e.target.value})} />
                  </div>
                </div>
              </form>
            </div>

            {isProprietario && (
              <div className="modal-fixed-footer-dual">
                <button type="button" className="btn-footer-delete" onClick={() => confirmDelete(itemParaEditar.id)}>
                  <Trash2 size={18} /> Excluir
                </button>
                <button type="submit" form="edit-form" className="btn-footer-save">
                  <Save size={18} /> Salvar Alterações
                </button>
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