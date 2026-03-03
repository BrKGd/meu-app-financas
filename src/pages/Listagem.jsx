import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ChevronLeft, ChevronRight, Trash2, X, Save, 
  Hash, Receipt, CreditCard, User, Calendar, 
  PieChart, DollarSign, Tag
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Listagem.css';

const Listagem = () => {
  const [despesas, setDespesas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]); 
  const [categorias, setCategorias] = useState([]); // NOVO
  const [mapaNomes, setMapaNomes] = useState({});
  const [mapaCategorias, setMapaCategorias] = useState({}); // NOVO
  const [perfilLogado, setPerfilLogado] = useState(null);
  const [itemParaEditar, setItemParaEditar] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: null });
  const [filtroData, setFiltroData] = useState({ mes: new Date().getMonth(), ano: new Date().getFullYear() });
  
  const [totaisPorResponsavel, setTotaisPorResponsavel] = useState([]);
  const [totalGeralMes, setTotalGeralMes] = useState(0);

  const mesesNominais = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const formasPagamento = ["Boleto", "Crédito", "Débito", "Dinheiro", "Pix", "Transferência"].sort();

  const isProprietario = perfilLogado?.tipo_usuario === 'proprietario';

  const formatarMoedaVisual = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  const mascaraMoedaInput = (valor) => {
    let v = valor.toString().replace(/\D/g, "");
    v = (Number(v) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return v;
  };

  const desformatarMoedaParaBanco = (valorString) => {
    if (!valorString) return 0;
    const apenasNumeros = valorString.replace(/\D/g, "");
    return parseFloat(apenasNumeros) / 100;
  };

  useEffect(() => { 
    carregarDadosIniciais(); 
  }, [filtroData]);

  async function carregarDadosIniciais() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Busca Perfis
    const { data: todosPerfis } = await supabase.from('profiles').select('id, nome');
    const mapa = {};
    todosPerfis?.forEach(p => mapa[p.id] = p.nome);
    setMapaNomes(mapa);
    setUsuarios(todosPerfis || []);

    // Busca Categorias (Apenas despesas para o select de edição)
    const { data: dCats } = await supabase.from('categorias').select('id, nome').eq('tipo', 'despesa').order('nome');
    const mapaCat = {};
    dCats?.forEach(c => mapaCat[c.id] = c.nome);
    setCategorias(dCats || []);
    setMapaCategorias(mapaCat);

    // Perfil Logado
    const { data: meuPerfil } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const isMaster = user.email === 'gleidson.fig@gmail.com';
    const tipoFinal = isMaster ? 'proprietario' : (meuPerfil?.tipo_usuario || 'comum');
    
    const perfilAtualizado = { ...meuPerfil, tipo_usuario: tipoFinal };
    setPerfilLogado(perfilAtualizado);
    
    // Busca Cartões
    const { data: dCartoes } = await supabase.from('cartoes').select('id, nome, dia_fechamento').order('nome');
    setCartoes(dCartoes || []);

    fetchDespesas(perfilAtualizado, mapa, dCartoes || [], mapaCat);
  }

  async function fetchDespesas(perfil, mapaAtual, listaCartoes, mapaCatAtual) {
    let query = supabase.from('compras').select('*').order('data_compra', { ascending: false });
    if (perfil?.tipo_usuario !== 'proprietario') {
        query = query.eq('user_id', perfil.id);
    }
    
    const { data, error } = await query;
    if (!error && data) {
      const projetadas = [];
      const mapaTotais = {};
      let acumuladoGeral = 0;

      data.forEach(item => {
        const numParcelas = item.num_parcelas || 1;
        const [anoC, mesC, diaC] = item.data_compra.split('-').map(Number);
        
        let delayMes = 0;
        if (item.forma_pagamento === 'Crédito' && item.cartao && item.cartao !== 'À Vista') {
          const infoCartao = listaCartoes.find(c => c.nome === item.cartao);
          if (infoCartao && diaC > infoCartao.dia_fechamento) {
            delayMes = 1;
          }
        }

        for (let i = 0; i < numParcelas; i++) {
          const dataParcela = new Date(anoC, (mesC - 1) + delayMes + i, 1);
          
          if (dataParcela.getMonth() === filtroData.mes && dataParcela.getFullYear() === filtroData.ano) {
            const valorParcela = parseFloat(item.valor_total) / numParcelas;
            const nomeResp = mapaAtual[item.user_id] || '⚠️ Pendente';
            const nomeCat = mapaCatAtual[item.categoria_id] || 'Sem Categoria';

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
    }
  }

  const formatarNF = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 9);
    return apenasNumeros.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2');
  };

  const completarNF = (valor) => {
    if (!valor) return '';
    const apenasNumeros = valor.toString().replace(/\D/g, '');
    if (!apenasNumeros) return '';
    return apenasNumeros.padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!isProprietario) return;

    const isCredito = itemParaEditar.forma_pagamento === 'Crédito';
    const { error } = await supabase.from('compras').update({
      descricao: itemParaEditar.descricao,
      loja: itemParaEditar.loja,
      user_id: itemParaEditar.user_id,
      categoria_id: itemParaEditar.categoria_id, // ATUALIZADO
      valor_total: itemParaEditar.valor_total,
      forma_pagamento: itemParaEditar.forma_pagamento,
      cartao: isCredito ? itemParaEditar.cartao : null,
      data_compra: itemParaEditar.data_compra,
      num_parcelas: isCredito ? parseInt(itemParaEditar.num_parcelas) : 1,
      parcelado: isCredito && parseInt(itemParaEditar.num_parcelas) > 1,
      pedido: itemParaEditar.pedido,
      nota_fiscal: completarNF(itemParaEditar.nota_fiscal)
    }).eq('id', itemParaEditar.id);

    if (!error) {
      setItemParaEditar(null);
      setModal({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Lançamento atualizado.' });
      carregarDadosIniciais();
    }
  };

  const confirmDelete = (id) => {
    setModal({
      isOpen: true,
      type: 'error',
      title: 'Remover?',
      message: 'Esta ação excluirá o gasto permanentemente.',
      onConfirm: async () => {
        const { error } = await supabase.from('compras').delete().eq('id', id);
        if (!error) {
          setItemParaEditar(null); 
          setModal(prev => ({ ...prev, isOpen: false }));
          carregarDadosIniciais();
        }
      }
    });
  };

  const mudarMes = (direcao) => {
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
              <th>N° do Pedido</th>
              <th>NF</th>
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
                  <td className="cell-sub">{item.pedido || '-'}</td>
                  <td className="cell-nf">{completarNF(item.nota_fiscal) || '-'}</td>
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
                    {formatarMoedaVisual(item.valorParcela)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
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
          
          <div className="total-geral-wrapper">
            <div className="badge-responsavel total-geral-badge">
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
              <h3>{isProprietario ? 'Editar Gasto' : 'Detalhes do Gasto'}</h3>
              <button onClick={() => setItemParaEditar(null)} className="btn-close-round"><X size={20}/></button>
            </div>

            <div className="modal-scrollable-body">
              <form id="edit-form" onSubmit={handleUpdate}>
                <div className="grid-form">
                  <div className="form-group">
                    <label><Calendar size={12}/> Data Compra</label>
                    <input type="date" className="form-control" disabled={!isProprietario} value={itemParaEditar.data_compra || ''} onChange={e => setItemParaEditar({...itemParaEditar, data_compra: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label><User size={12}/> Responsável</label>
                    <select className="form-control" disabled={!isProprietario} value={itemParaEditar.user_id || ''} onChange={e => setItemParaEditar({...itemParaEditar, user_id: e.target.value})}>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>

                  {/* NOVO CAMPO CATEGORIA */}
                  <div className="form-group full-width">
                    <label><Tag size={12}/> Categoria</label>
                    <select className="form-control" disabled={!isProprietario} value={itemParaEditar.categoria_id || ''} onChange={e => setItemParaEditar({...itemParaEditar, categoria_id: e.target.value})}>
                      <option value="">Selecione uma categoria</option>
                      {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Descrição</label>
                    <input className="form-control" disabled={!isProprietario} value={itemParaEditar.descricao} onChange={e => setItemParaEditar({...itemParaEditar, descricao: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Loja</label>
                    <input className="form-control" disabled={!isProprietario} value={itemParaEditar.loja || ''} onChange={e => setItemParaEditar({...itemParaEditar, loja: e.target.value})} />
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
                    <label><Hash size={12}/> Pedido</label>
                    <input className="form-control" disabled={!isProprietario} value={itemParaEditar.pedido || ''} onChange={e => setItemParaEditar({...itemParaEditar, pedido: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label><Receipt size={12}/> Nota Fiscal</label>
                    <input 
                      className="form-control" 
                      disabled={!isProprietario}
                      placeholder="000.000.000" 
                      value={itemParaEditar.nota_fiscal || ''} 
                      onChange={e => setItemParaEditar({...itemParaEditar, nota_fiscal: formatarNF(e.target.value)})}
                      onBlur={e => setItemParaEditar({...itemParaEditar, nota_fiscal: completarNF(e.target.value)})}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Pagamento</label>
                    <select className="form-control" disabled={!isProprietario} value={itemParaEditar.forma_pagamento} onChange={e => setItemParaEditar({...itemParaEditar, forma_pagamento: e.target.value})}>
                      {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  {itemParaEditar.forma_pagamento === 'Crédito' && (
                    <>
                      <div className="form-group">
                        <label><CreditCard size={12}/> Cartão</label>
                        <select className="form-control" disabled={!isProprietario} value={itemParaEditar.cartao} onChange={e => setItemParaEditar({...itemParaEditar, cartao: e.target.value})}>
                          {cartoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Parcelas</label>
                        <input type="number" className="form-control" disabled={!isProprietario} value={itemParaEditar.num_parcelas || 1} onChange={e => setItemParaEditar({...itemParaEditar, num_parcelas: e.target.value})} />
                      </div>
                    </>
                  )}
                </div>
              </form>
            </div>

            {isProprietario && (
              <div className="modal-fixed-footer-dual">
                <button type="button" className="btn-footer-delete" onClick={() => confirmDelete(itemParaEditar.id)}>
                  <Trash2 size={18} /> Excluir
                </button>
                <button type="submit" form="edit-form" className="btn-footer-save">
                  <Save size={18} /> Salvar
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