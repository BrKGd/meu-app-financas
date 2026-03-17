import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  PiggyBank, AlertCircle, ArrowUpCircle, 
  Calendar, TrendingUp, X, ArrowDownCircle, CheckCircle2, Info, Settings,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import '../styles/Orcamento.css';
import { useNavigate } from 'react-router-dom';

// --- Interfaces para Tipagem ---
interface CategoriaConsolidada {
  id: string;
  nome: string;
  tipo: string;
  regra_50_30_20?: string;
  gastoReal: number;
  metaValor: number;
  tipoMeta: string;
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
    essenciais: { valor: number; limite: number };
    estiloVida: { valor: number; limite: number };
    prioridades: { valor: number; limite: number };
  };
}

const Orcamento: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // --- Estados de Data (Padrão Proventos) ---
  const [dataFiltro, setDataFiltro] = useState(new Date());

  const [modalDetalhe, setModalDetalhe] = useState<{aberto: boolean, tipo: string, dados: any[]}>({ 
    aberto: false, tipo: '', dados: [] 
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
      essenciais: { valor: 0, limite: 0 },
      estiloVida: { valor: 0, limite: 0 },
      prioridades: { valor: 0, limite: 0 }
    }
  });

  const formatMoney = (v: number | string) => {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Funções de Navegação de Data
  const alterarMes = (delta: number) => {
    const novaData = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + delta, 1);
    setDataFiltro(novaData);
  };

  const calcular503020 = (receita: number, categorias: CategoriaConsolidada[]) => {
    const res = {
      essenciais: { valor: 0, limite: receita * 0.5 },
      estiloVida: { valor: 0, limite: receita * 0.3 },
      prioridades: { valor: 0, limite: receita * 0.2 }
    };
    const essenciaisLista = ['Aluguel', 'Saúde', 'Educação', 'Mercado', 'Transporte', 'Água', 'Luz', 'Moradia'];

    categorias.forEach(cat => {
      if (cat.tipoMeta === 'pessoal') {
        res.prioridades.valor += cat.gastoReal;
      } else if (cat.regra_50_30_20 === 'Essencial' || essenciaisLista.some(e => cat.nome.includes(e))) {
        res.essenciais.valor += cat.gastoReal;
      } else if (cat.tipo === 'despesa') {
        res.estiloVida.valor += cat.gastoReal;
      }
    });
    return res;
  };

  const buscarDadosCompletos = useCallback(async () => {
    setLoading(true);
    try {
      const anoAtual = dataFiltro.getFullYear();
      const mesAtual = dataFiltro.getMonth() + 1;
      const primeiroDia = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
      const ultimoDia = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0];

      const [
        { data: metasData },
        { data: proventos },
        { data: comprasNaoParceladas },
        { data: parcelasDoMes },
        { data: cats }
      ] = await Promise.all([
        (supabase.from('metas') as any).select('*').eq('mes_referencia', mesAtual).eq('ano_referencia', anoAtual),
        (supabase.from('proventos') as any).select('*').gte('data_recebimento', primeiroDia).lte('data_recebimento', ultimoDia),
        (supabase.from('compras') as any).select('valor_total, categoria_id').eq('parcelado', false).gte('data_vencimento', primeiroDia).lte('data_vencimento', ultimoDia),
        (supabase.from('parcelas') as any).select('valor_parcela, compras!inner(categoria_id)').gte('data_vencimento', primeiroDia).lte('data_vencimento', ultimoDia),
        (supabase.from('categorias') as any).select('*').order('nome', { ascending: true })
      ]);

      const gastosPorCat: Record<string, number> = {};
      let totalGastoFinal = 0;

      comprasNaoParceladas?.forEach((c: any) => {
        const v = parseFloat(c.valor_total) || 0;
        totalGastoFinal += v;
        if (c.categoria_id) gastosPorCat[c.categoria_id] = (gastosPorCat[c.categoria_id] || 0) + v;
      });

      parcelasDoMes?.forEach((p: any) => {
        const v = parseFloat(p.valor_parcela) || 0;
        totalGastoFinal += v;
        const catId = p.compras?.categoria_id;
        if (catId) gastosPorCat[catId] = (gastosPorCat[catId] || 0) + v;
      });

      const totalReceitaReal = proventos?.reduce((acc: number, cur: any) => acc + Number(cur.valor), 0) || 0;

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
        resumo503020: calcular503020(totalReceitaReal, todasCategoriasConsolidadas)
      });

    } catch (err) {
      console.error("Erro ao consolidar valores no Orcamento:", err);
    } finally {
      setLoading(false);
    }
  }, [dataFiltro]);

  useEffect(() => {
    buscarDadosCompletos();
  }, [buscarDadosCompletos]);

  const porcGasto = useMemo(() => dados.metaGasto > 0 ? (dados.gastoReal / dados.metaGasto) * 100 : 0, [dados]);
  const porcGastoOrcamento = useMemo(() => dados.receitaReal > 0 ? (dados.gastoReal / dados.receitaReal) * 100 : 0, [dados]);
  const porcReceita = useMemo(() => dados.metaReceita > 0 ? (dados.receitaReal / dados.metaReceita) * 100 : 0, [dados]);

  const statusConfig = useMemo(() => {
    if (dados.metaGasto === 0 && dados.gastoReal > 0) return { label: 'Sem teto definido', class: 'status-bad', color: '#ef4444', icon: <AlertCircle size={14} /> };
    if (porcGastoOrcamento <= 85) return { label: 'Tá de boa', class: 'status-good', color: '#10b981', icon: <CheckCircle2 size={14} /> };
    if (porcGastoOrcamento <= 100) return { label: 'Sua grana tá acabando!', class: 'status-warning', color: '#f59e0b', icon: <Info size={14} /> };
    return { label: 'Deu ruim, gastou demais!', class: 'status-bad', color: '#ef4444', icon: <AlertCircle size={14} /> };
  }, [porcGastoOrcamento, dados]);

  return (
    <div className="orcamento-container">
      <header className="orcamento-header">
        <div className="header-content-wrapper">
          <h2>Gestão Estratégica</h2>
          
          <div className="prov-month-selector">
            <button onClick={() => alterarMes(-1)} className="prov-nav-btn">
              <ChevronLeft size={20} />
            </button>
            <div className="prov-current-month">
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              <span>
                {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dataFiltro)}
              </span>
            </div>
            <button onClick={() => alterarMes(1)} className="prov-nav-btn">
              <ChevronRight size={20} />
            </button>
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
              <span className="perc-text" style={{ color: statusConfig.color }}>
                {porcGastoOrcamento.toFixed(1)}% do que você ganhou, já foi gasto.
              </span>
            </div>

            <div className="status-badges-stack">
              {porcGastoOrcamento > 100 && (
                <div className="critical-alert-badge">
                  Limite excedido
                </div>
              )}
              <div className={`status-floating-badge ${statusConfig.class}`} style={{ backgroundColor: statusConfig.color }}>
                {statusConfig.icon} {statusConfig.label}
              </div>
            </div>
          </section>

          <div className="summary-grid-objectives">
            <div className="objective-card-premium clickable" onClick={() => setModalDetalhe({ aberto: true, tipo: 'Receitas', dados: dados.proventosDetalhados })}>
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

            <div className="objective-card-premium clickable" onClick={() => setModalDetalhe({ aberto: true, tipo: 'Despesas', dados: dados.categoriasDespesa })}>
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
            <h3 className="premium-section-title">Equilíbrio 50-30-20 (Real)</h3>
            <div className="alocacao-grid-3-col">
              {(['essenciais', 'estiloVida', 'prioridades'] as const).map((key) => {
                const colors = { essenciais: '#3b82f6', estiloVida: '#f59e0b', prioridades: '#8b5cf6' };
                const valor = dados.resumo503020[key].valor;
                const limite = dados.resumo503020[key].limite;
                const porcLocal = limite > 0 ? (valor / limite) * 100 : 0;
                return (
                  <div key={key} className="aloc-mini-card">
                    <span className="aloc-label">
                      {key === 'essenciais' ? '50%' : key === 'estiloVida' ? '30%' : '20%'} 
                      <span className="aloc-sub">{key === 'essenciais' ? 'Fixos' : key === 'estiloVida' ? 'Desejos' : 'Futuro'}</span>
                    </span>
                    <span className="aloc-valor">{formatMoney(valor)}</span>
                    <div className="aloc-progress-bg">
                      <div className="aloc-progress-fill" style={{ width: `${Math.min(porcLocal, 100)}%`, backgroundColor: colors[key] }} />
                    </div>
                    <small>Limite {formatMoney(limite)}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <h3 className="premium-section-title"><TrendingUp size={18} /> Objetivos Ativos</h3>
          <div className="summary-grid-objectives">
            {dados.objetivosPessoais.map(meta => (
              <div key={meta.id} className="objective-card-premium">
                <div className="obj-header">
                  <span className="obj-name">{meta.nome}</span>
                  <span className="obj-percent">{(meta.metaValor > 0 ? (meta.gastoReal/meta.metaValor)*100 : 0).toFixed(0)}%</span>
                </div>
                <div className="obj-progress-container">
                  <div className="obj-progress-fill" style={{ width: `${Math.min(meta.metaValor > 0 ? (meta.gastoReal/meta.metaValor)*100 : 0, 100)}%`, backgroundColor: '#8b5cf6' }} />
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

      {modalDetalhe.aberto && (
        <div className="modal-overlay" onClick={() => setModalDetalhe({ ...modalDetalhe, aberto: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes de {modalDetalhe.tipo}</h3>
              <button className="close-btn" onClick={() => setModalDetalhe({ ...modalDetalhe, aberto: false })}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {modalDetalhe.tipo === 'Receitas' ? (
                modalDetalhe.dados.map((p, i) => (
                  <div key={p.id || i} className="detalhe-item">
                    <span>{p.descricao}</span>
                    <strong>{formatMoney(p.valor)}</strong>
                  </div>
                ))
              ) : (
                modalDetalhe.dados.map((c, i) => (
                  <div key={c.id || i} className="detalhe-item">
                    <span>{c.nome}</span>
                    <strong>{formatMoney(c.gastoReal)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <button 
        className="btn-ajuste-premium" 
        onClick={() => navigate('/CategoriasMetas')}
        title="Configurar Metas"
      >
        <Settings size={26} />
      </button>
    </div>
  );
};

export default Orcamento;