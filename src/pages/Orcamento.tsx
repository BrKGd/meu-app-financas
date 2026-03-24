import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import * as LucideIcons from 'lucide-react';
import { 
  PiggyBank, AlertCircle, ArrowUpCircle, 
  TrendingUp, ArrowDownCircle, CheckCircle2, Info, Settings,
  ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';
import '../styles/Orcamento.css';
import { useNavigate } from 'react-router-dom';

import iconFechar from '../assets/fechar.png';

// --- Interfaces para Tipagem ---
interface CategoriaConsolidada {
  id: string;
  nome: string;
  tipo: string;
  regra_50_30_20?: string;
  gastoReal: number;
  metaValor: number;
  tipoMeta: string;
  icone?: string; 
  cor?: string; // Coluna cor da tabela categorias
}

interface DadosOrcamento {
  metaReceita: number;
  receitaReal: number;
  metaGasto: number;
  gastoReal: number;
  categoriasDespesa: CategoriaConsolidada[];
  objetivosPessoais: CategoriaConsolidada[];
  proventosDetalhados: any[];
  resumo503020: {
    essenciais: { valor: number; limite: number; categorias: CategoriaConsolidada[] };
    estiloVida: { valor: number; limite: number; categorias: CategoriaConsolidada[] };
    prioridades: { valor: number; limite: number; categorias: CategoriaConsolidada[] };
  };
}

// Componente para Renderizar Ícone Dinâmico com a cor do banco
const IconeCategoria = ({ nomeIcone, size = 20, color }: { nomeIcone?: string, size?: number, color?: string }) => {
  const Icon = (LucideIcons as any)[nomeIcone || ''] || HelpCircle;
  return <Icon size={size} color={color || 'currentColor'} />;
};

const Orcamento: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date());

  const [modalDetalhe, setModalDetalhe] = useState<{aberto: boolean, tipo: string, dados: any[], limite?: number}>({ 
    aberto: false, tipo: '', dados: [], limite: 0 
  });
  
  const [dados, setDados] = useState<DadosOrcamento>({
    metaReceita: 0,
    receitaReal: 0,
    metaGasto: 0,
    gastoReal: 0,
    categoriasDespesa: [],
    objetivosPessoais: [],
    proventosDetalhados: [],
    resumo503020: {
      essenciais: { valor: 0, limite: 0, categorias: [] },
      estiloVida: { valor: 0, limite: 0, categorias: [] },
      prioridades: { valor: 0, limite: 0, categorias: [] }
    }
  });

  const formatMoney = (v: number | string) => {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const alterarMes = (delta: number) => {
    const novaData = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + delta, 1);
    setDataFiltro(novaData);
  };

  const calcular503020 = (receitaBase: number, categorias: CategoriaConsolidada[]) => {
    const res = {
      essenciais: { valor: 0, limite: receitaBase * 0.5, categorias: [] as CategoriaConsolidada[] },
      estiloVida: { valor: 0, limite: receitaBase * 0.3, categorias: [] as CategoriaConsolidada[] },
      prioridades: { valor: 0, limite: receitaBase * 0.2, categorias: [] as CategoriaConsolidada[] }
    };
    
    const essenciaisLista = ['Aluguel', 'Saúde', 'Educação', 'Mercado', 'Combustível', 'Água', 'Luz', 'Moradia','Alimentação','Seguros'];

    categorias.forEach(cat => {
      if (cat.tipoMeta === 'pessoal') {
        res.prioridades.valor += cat.gastoReal;
        res.prioridades.categorias.push(cat);
      } else if (cat.regra_50_30_20 === 'Essencial' || essenciaisLista.some(e => cat.nome.includes(e))) {
        res.essenciais.valor += cat.gastoReal;
        res.essenciais.categorias.push(cat);
      } else if (cat.tipo === 'despesa') {
        res.estiloVida.valor += cat.gastoReal;
        res.estiloVida.categorias.push(cat);
      }
    });
    return res;
  };

  const buscarDadosCompletos = useCallback(async () => {
    setLoading(true);
    try {
      const anoAtual = dataFiltro.getFullYear();
      const mesAtual = dataFiltro.getMonth() + 1;
      const primeiroDiaMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
      const ultimoDiaBusca = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0];

      const [
        { data: metasData },
        { data: proventos },
        { data: todasComprasMes },
        { data: cats }
      ] = await Promise.all([
        (supabase.from('metas') as any).select('*').eq('mes_referencia', mesAtual).eq('ano_referencia', anoAtual),
        (supabase.from('proventos') as any).select('*').gte('data_recebimento', primeiroDiaMes).lte('data_recebimento', ultimoDiaBusca),
        (supabase.from('compras') as any).select('valor_total, categoria_id').eq('periodo_referencia', primeiroDiaMes),
        (supabase.from('categorias') as any).select('*').order('nome', { ascending: true })
      ]);

      const gastosPorCat: Record<string, number> = {};
      let totalGastoFinal = 0;

      todasComprasMes?.forEach((c: any) => {
        const v = parseFloat(c.valor_total) || 0;
        totalGastoFinal += v;
        if (c.categoria_id) {
          gastosPorCat[c.categoria_id] = (gastosPorCat[c.categoria_id] || 0) + v;
        }
      });

      const totalReceitaReal = proventos?.reduce((acc: number, cur: any) => acc + Number(cur.valor), 0) || 0;
      const receitaParaRegra = proventos?.reduce((acc: number, cur: any) => {
        if (cur.categoria === 'Salários' || cur.categoria === 'Renda extra') return acc + Number(cur.valor);
        return acc;
      }, 0) || 0;

      const todasCategoriasConsolidadas: CategoriaConsolidada[] = (cats || []).map((cat: any) => {
        const metaEncontrada = metasData?.find((m: any) => m.categoria_id === cat.id);
        return {
          ...cat,
          gastoReal: Number(gastosPorCat[cat.id] || 0),
          metaValor: metaEncontrada ? Number(metaEncontrada.valor_meta) : 0,
          tipoMeta: metaEncontrada?.tipo_meta || 'despesa',
        };
      });

      setDados({
        metaReceita: metasData?.filter((m: any) => m.tipo_meta === 'provento').reduce((a: number, b: any) => a + Number(b.valor_meta), 0) || 0,
        receitaReal: totalReceitaReal,
        metaGasto: metasData?.filter((m: any) => m.tipo_meta === 'despesa').reduce((a: number, b: any) => a + Number(b.valor_meta), 0) || 0,
        gastoReal: totalGastoFinal,
        categoriasDespesa: todasCategoriasConsolidadas.filter(c => c.tipo === 'despesa' && c.tipoMeta !== 'pessoal'),
        objetivosPessoais: todasCategoriasConsolidadas.filter(c => c.tipoMeta === 'pessoal'),
        proventosDetalhados: proventos || [],
        resumo503020: calcular503020(receitaParaRegra, todasCategoriasConsolidadas)
      });

    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => {
    buscarDadosCompletos();
  }, [buscarDadosCompletos]);

  const porcGastoOrcamento = useMemo(() => dados.receitaReal > 0 ? (dados.gastoReal / dados.receitaReal) * 100 : 0, [dados]);
  const porcGasto = useMemo(() => dados.metaGasto > 0 ? (dados.gastoReal / dados.metaGasto) * 100 : 0, [dados]);
  const porcReceita = useMemo(() => dados.metaReceita > 0 ? (dados.receitaReal / dados.metaReceita) * 100 : 0, [dados]);

  const statusConfig = useMemo(() => {
    if (dados.metaGasto === 0 && dados.gastoReal > 0) return { label: 'Sem teto definido', class: 'status-bad', color: '#ef4444', icon: <AlertCircle size={14} /> };
    if (porcGastoOrcamento <= 85) return { label: 'Tá de boa', class: 'status-good', color: '#10b981', icon: <CheckCircle2 size={14} /> };
    if (porcGastoOrcamento <= 100) return { label: 'Sua grana tá acabando!', class: 'status-warning', color: '#f59e0b', icon: <Info size={14} /> };
    return { label: 'Deu ruim, gastou demais!', class: 'status-bad', color: '#ef4444', icon: <AlertCircle size={14} /> };
  }, [porcGastoOrcamento, dados]);

  const getModalColor = () => {
    if (modalDetalhe.tipo === 'Gastos Fixos') return '#3b82f6';
    if (modalDetalhe.tipo === 'Gastos Variáveis') return '#f59e0b';
    if (modalDetalhe.tipo === 'Investimentos') return '#8b5cf6';
    if (modalDetalhe.tipo === 'Receitas') return '#10b981';
    if (modalDetalhe.tipo === 'Despesas') return '#ef4444';
    return '#1e293b';
  };

  const renderConteudoModal = () => {
    if (modalDetalhe.tipo === 'Receitas') {
      return modalDetalhe.dados.map((p, i) => (
        <div key={p.id || i} className="fatura-item">
          <div className="fatura-item-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '12px' }}>
              <ArrowUpCircle size={20} color="#10b981" />
            </div>
            <div>
              <span className="fatura-item-desc">{p.descricao}</span>
              <span className="fatura-item-sub">Recebido em {new Date(p.data_recebimento).toLocaleDateString()}</span>
            </div>
          </div>
          <span className="fatura-item-valor" style={{ color: '#10b981' }}>+ {formatMoney(p.valor)}</span>
        </div>
      ));
    }

    const agrupado: Record<string, any[]> = {};
    modalDetalhe.dados.forEach(item => {
      const catNome = item.nome || 'Outros';
      if (!agrupado[catNome]) agrupado[catNome] = [];
      agrupado[catNome].push(item);
    });

    return Object.keys(agrupado).map((categoriaNome) => {
      const primeiraCat = agrupado[categoriaNome][0];
      return (
        <div key={categoriaNome} className="categoria-grupo-modal" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconeCategoria nomeIcone={primeiraCat.icone} size={14} color={primeiraCat.cor} />
            {categoriaNome}
          </div>
          {agrupado[categoriaNome].map((c, i) => (
            <div key={c.id || i} className="fatura-item" style={{ paddingLeft: '8px' }}>
              <div className="fatura-item-info">
                <span className="fatura-item-desc">{c.nome}</span>
                <span className="fatura-item-sub">Consolidado no mês</span>
              </div>
              <span className="fatura-item-valor" style={{ fontWeight: 700 }}>{formatMoney(c.gastoReal)}</span>
            </div>
          ))}
        </div>
      );
    });
  };

  return (
    <div className="orcamento-container">
      <header className="orcamento-header">
        <div className="header-content-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '1.4rem' }}>Gestão Estratégica</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Análise de fluxo</p>
          </div>
          <div className="mes-selector-badge">
            <button onClick={() => alterarMes(-1)}><ChevronLeft size={18} /></button>
            <span>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dataFiltro)}</span>
            <button onClick={() => alterarMes(1)}><ChevronRight size={18} /></button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">Organizando suas finanças...</div>
      ) : (
        <>
          <section className={`main-stats-card ${statusConfig.class}`}>
            <div className="stats-header">
              <div>
                <span className="stats-label">Gastos Totais (Fluxo de Caixa)</span>
                <div className="stats-values">
                  <h3>{formatMoney(dados.gastoReal)}</h3>
                  <span className="goal-value">/ {formatMoney(dados.receitaReal)}</span>
                </div>
              </div>
              <div className={`status-icon-main ${statusConfig.class}`} style={{ color: statusConfig.color }}>
                <PiggyBank size={32} />
              </div>
            </div>
            <div className="premium-progress-bg">
              <div className="premium-progress-fill" style={{ width: `${Math.min(porcGastoOrcamento, 100)}%`, backgroundColor: statusConfig.color }} />
            </div>
            <div className="progress-details">
              <span className="perc-text" style={{ color: statusConfig.color }}>{porcGastoOrcamento.toFixed(1)}% do que você ganhou, já foi gasto.</span>
            </div>
            <div className="status-badges-stack">
              {porcGastoOrcamento > 100 && <div className="critical-alert-badge">Limite excedido</div>}
              <div className={`status-floating-badge ${statusConfig.class}`} style={{ backgroundColor: statusConfig.color }}>
                {statusConfig.icon} {statusConfig.label}
              </div>
            </div>
          </section>

          <div className="summary-grid-objectives">
            <div className="objective-card-premium clickable" onClick={() => setModalDetalhe({ aberto: true, tipo: 'Receitas', dados: dados.proventosDetalhados, limite: dados.metaReceita })}>
              <div className="obj-header">
                <span className="obj-name"><ArrowUpCircle size={16} color="#10b981" /> Soma de Proventos</span>
                <span className="obj-percent" style={{color: '#10b981'}}>{porcReceita.toFixed(0)}%</span>
              </div>
              <div className="obj-progress-container">
                <div className="obj-progress-fill" style={{ width: `${Math.min(porcReceita, 100)}%`, backgroundColor: '#10b981' }} />
              </div>
              <div className="obj-footer">
                <span className="obj-real">{formatMoney(dados.receitaReal)}</span>
                <span className="obj-goal">Meta: {formatMoney(dados.metaReceita)}</span>
              </div>
            </div>

            <div className="objective-card-premium clickable" onClick={() => setModalDetalhe({ aberto: true, tipo: 'Despesas', dados: dados.categoriasDespesa, limite: dados.metaGasto })}>
              <div className="obj-header">
                <span className="obj-name"><ArrowDownCircle size={16} color="#ef4444" /> Total Gasto</span>
                <span className="obj-percent" style={{color: '#ef4444'}}>{porcGasto.toFixed(0)}%</span>
              </div>
              <div className="obj-progress-container">
                <div className="obj-progress-fill" style={{ width: `${Math.min(porcGasto, 100)}%`, backgroundColor: '#ef4444'}} />
              </div>
              <div className="obj-footer">
                <span className="obj-real">{formatMoney(dados.gastoReal)}</span>
                <span className="obj-goal">Teto: {formatMoney(dados.metaGasto)}</span>
              </div>
            </div>
          </div>

          <section className="alocacao-503020">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <h3 className="premium-section-title" style={{ margin: 0 }}>Equilíbrio 50-30-20 (Real)</h3>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>Base: Salários + Renda extra</span>
            </div>
            <div className="alocacao-grid-3-col">
              {(['essenciais', 'estiloVida', 'prioridades'] as const).map((key) => {
                const colors = { essenciais: '#3b82f6', estiloVida: '#f59e0b', prioridades: '#8b5cf6' };
                const labels = { essenciais: 'Gastos Fixos', estiloVida: 'Gastos Variáveis', prioridades: 'Investimentos' };
                const valor = dados.resumo503020[key].valor;
                const limite = dados.resumo503020[key].limite;
                const excedeu = valor > limite && limite > 0;
                return (
                  <div key={key} className="aloc-mini-card clickable" style={{borderColor: colors[key]}} onClick={() => setModalDetalhe({ aberto: true, tipo: labels[key], dados: dados.resumo503020[key].categorias, limite: limite })}>
                    {excedeu && <div className={`badge-pill-excedido ${key === 'prioridades' ? 'badge-green' : 'badge-red'}`}>+ {formatMoney(valor - limite)}</div>}
                    <span className="aloc-label">{key === 'essenciais' ? '50%' : key === 'estiloVida' ? '30%' : '20%'} <span className="aloc-sub">{key === 'essenciais' ? 'Fixos' : key === 'estiloVida' ? 'Desejos' : 'Futuro'}</span></span>
                    <span className="aloc-valor">{formatMoney(valor)}</span>
                    <div className="aloc-progress-bg"><div className="aloc-progress-fill" style={{ width: `${Math.min(limite > 0 ? (valor / limite) * 100 : 0, 100)}%`, backgroundColor: colors[key] }} /></div>
                    <small>Limite {formatMoney(limite)}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <h3 className="premium-section-title"><TrendingUp size={18} /> Objetivos Ativos</h3>
          <div className="summary-grid-objectives">
            {dados.objetivosPessoais.map(meta => (
              <div key={meta.id} className="objective-card-premium clickable" onClick={() => setModalDetalhe({ aberto: true, tipo: 'Objetivos', dados: [meta], limite: meta.metaValor })}>
                <div className="obj-header">
                  <span className="obj-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconeCategoria nomeIcone={meta.icone} size={18} color={meta.cor || '#8b5cf6'} />
                    {meta.nome}
                  </span>
                  <span className="obj-percent">{(meta.metaValor > 0 ? (meta.gastoReal/meta.metaValor)*100 : 0).toFixed(0)}%</span>
                </div>
                <div className="obj-progress-container">
                  <div className="obj-progress-fill" style={{ width: `${Math.min(meta.metaValor > 0 ? (meta.gastoReal/meta.metaValor)*100 : 0, 100)}%`, backgroundColor: meta.cor || '#8b5cf6' }} />
                </div>
                <div className="obj-footer">
                  <span className="obj-real">{formatMoney(meta.gastoReal)}</span>
                  <span className="obj-goal">Alvo: {formatMoney(meta.metaValor)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- MODAL COM BORDA DE 2PX E CORES DINÂMICAS --- */}
      {modalDetalhe.aberto && (
        <div className="modal-overlay" onClick={() => setModalDetalhe({ ...modalDetalhe, aberto: false })}>
          <div 
            className="modal-content-premium" 
            onClick={e => e.stopPropagation()}
            style={{ border: `2px solid ${getModalColor()}` }} // Borda de 2px com a cor do tipo
          >
            <div className="modal-header-premium" style={{ backgroundColor: getModalColor() }}>
              <div className="header-info">
                <h3 style={{ color: '#fff' }}>{modalDetalhe.tipo}</h3>
                <p style={{ color: 'rgba(255,255,255,0.8)' }}>Confira os lançamentos deste mês</p>
              </div>
              <button className="btn-close-clean" onClick={() => setModalDetalhe({ ...modalDetalhe, aberto: false })}>
                <img src={iconFechar} alt="Fechar" />
              </button>
            </div>

            <div className="modal-body-premium">
              <div className="fatura-lista">{renderConteudoModal()}</div>
            </div>

            <div className="modal-footer-icons" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '20px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '1.75rem', color: '#1e293b', fontWeight: 600 }}>Total</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                   {(() => {
                     const total = modalDetalhe.dados.reduce((acc, curr) => acc + (curr.valor || curr.gastoReal || 0), 0);
                     const limite = modalDetalhe.limite || 0;
                     if (total > limite && limite > 0) {
                       const badgeClass = modalDetalhe.tipo === 'Receitas' || modalDetalhe.tipo === 'Investimentos'? 'badge-green' : 'badge-red';
                       return <div className={`badge-pill-excedido ${badgeClass}`} style={{ position: 'static', marginBottom: '6px', fontSize: '0.65rem', padding: '1px 10px' }}>+ {formatMoney(total - limite)}</div>;
                     }
                     return null;
                   })()}
                   <div style={{ fontSize: '1.2rem', fontWeight: 900, color: getModalColor() }}>
                     {formatMoney(modalDetalhe.dados.reduce((acc, curr) => acc + (curr.valor || curr.gastoReal || 0), 0))}
                   </div>
                </div>
            </div>
          </div>
        </div>
      )}

      <button className="btn-ajuste-premium" onClick={() => navigate('/CategoriasMetas')} title="Configurar Metas">
        <Settings size={26} />
      </button>
    </div>
  );
};

export default Orcamento;