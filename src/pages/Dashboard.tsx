import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Users, Calendar, ShoppingCart, 
  Clock, Banknote, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import '../styles/Dashboard.css';

// --- Interfaces para Tipagem ---
interface Perfil {
  id: string;
  nome: string;
  tipo_usuario: 'comum' | 'administrador' | 'proprietario';
  email: string;
}

interface Cartao {
  id: number;
  nome: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface Compra {
  id: string;
  user_id: string;
  valor_total: number;
  parcelas_total: number;
  parcela_numero: number;
  data_compra: string;
  periodo_referencia: string;
  cartao: string;
  cartao_id?: number;
  forma_pagamento: string;
  status_pagamento?: string;
}

interface DetalhePessoa {
  valorNoMes: number;
  qtdComprasMes: number;
  totalRestanteFuturo: number;
  ultimaParcelaDate: Date;
  vencimentoAte15: number;
  vencimentoAte20: number;
  pagoNoMes: number;
}

interface Stats {
  totalMes: number;
  totalEmAbertoFuturo: number;
  qtdComprasMes: number;
  maiorParcelaMes: number;
  detalhesPorPessoa: Record<string, DetalhePessoa>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalMes: 0,
    totalEmAbertoFuturo: 0,
    qtdComprasMes: 0,
    maiorParcelaMes: 0,
    detalhesPorPessoa: {}
  });
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date());

  const mesesNominais = useMemo(() => [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ], []);

  const mesReferenciaChave = useMemo(() => {
    return `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth() + 1).padStart(2, '0')}-01`;
  }, [dataFiltro]);

  const diaAtualReal = new Date().getDate();

  const colors = {
    primary: '#4361ee',
    secondary: '#7209b7',
    accent2: '#4cc9f0',
    success: '#10b981',
    bg: '#f8fafc'
  };

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [pRes, cRes, perfRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('cartoes').select('*'),
        supabase.from('profiles').select('id, nome')
      ]);

      const perfilData = pRes.data as Perfil;
      const cartoes = cRes.data as Cartao[];
      const todosPerfis = perfRes.data as any[];
      
      setPerfil(perfilData);

      const isMaster = user.email === 'gleidson.fig@gmail.com';
      const isProprietario = perfilData?.tipo_usuario === 'proprietario' || isMaster;

      const mapaNomes: Record<string, string> = {};
      todosPerfis?.forEach(p => {
        mapaNomes[p.id] = p.nome.split(' ')[0];
      });

      let query = supabase.from('compras').select('*');
      if (!isProprietario && perfilData?.tipo_usuario !== 'administrador') {
        query = query.eq('user_id', user.id);
      }
      
      const { data: compras } = await query;
      const listaCompras = (compras as unknown as Compra[]) || [];

      let resumo: Stats = {
        totalMes: 0, totalEmAbertoFuturo: 0, qtdComprasMes: 0,
        maiorParcelaMes: 0, detalhesPorPessoa: {}
      };

      listaCompras.forEach(item => {
        const valorParcela = parseFloat(item.valor_total.toString()) || 0;
        const responsavel = mapaNomes[item.user_id] || 'Outro';
        const estaPago = item.status_pagamento === 'pago';
        
        const infoCartao = cartoes?.find(c => c.id === item.cartao_id || c.nome === item.cartao);
        const vencimento = infoCartao?.dia_vencimento || 0;

        if (!resumo.detalhesPorPessoa[responsavel]) {
          resumo.detalhesPorPessoa[responsavel] = {
            valorNoMes: 0, qtdComprasMes: 0, totalRestanteFuturo: 0,
            ultimaParcelaDate: new Date(0), vencimentoAte15: 0, vencimentoAte20: 0,
            pagoNoMes: 0
          };
        }

        const p = resumo.detalhesPorPessoa[responsavel];
        const dataCompraObj = new Date(item.data_compra + 'T00:00:00');

        if (item.periodo_referencia === mesReferenciaChave) {
          resumo.qtdComprasMes++;
          p.qtdComprasMes++;
          if (!estaPago) {
            resumo.totalMes += valorParcela;
            p.valorNoMes += valorParcela;
            if (vencimento > 0 && vencimento <= 15) p.vencimentoAte15 += valorParcela;
            else if (vencimento > 15) p.vencimentoAte20 += valorParcela;
          } else {
            p.pagoNoMes += valorParcela;
          }
        }

        if (item.periodo_referencia > mesReferenciaChave && !estaPago) {
          resumo.totalEmAbertoFuturo += valorParcela;
          p.totalRestanteFuturo += valorParcela;
        }

        if (dataCompraObj > p.ultimaParcelaDate) {
          p.ultimaParcelaDate = dataCompraObj;
        }
      });

      setStats(resumo);
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [mesReferenciaChave]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const formatMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', color: colors.primary }}>
        <Loader2 className="spinner" size={40} style={{ marginBottom: '10px' }} />
        <span style={{ fontWeight: 'bold' }}>Carregando Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '25px', backgroundColor: colors.bg, minHeight: '100vh', paddingBottom: '100px' }}>
      
      {/* HEADER: TÍTULO À ESQUERDA | SELETOR À DIREITA EM LINHA ÚNICA */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        gap: '10px',
        width: '100%'
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: 'clamp(1.1rem, 4vw, 1.8rem)', 
            fontWeight: 800, 
            color: '#1e293b',
            whiteSpace: 'nowrap'
          }}>
            {perfil?.tipo_usuario === 'proprietario' ? 'Dashboard Global' : 'Meu Resumo'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '2px 0 0 0' }}>
            Análise de gastos
          </p>
        </div>

        {/* SELETOR DE MÊS - LINHA ÚNICA E NOME COMPLETO */}
        <div className="mes-selector-badge" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          background: '#ffffff', 
          padding: '8px 14px', 
          borderRadius: '100px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          flexShrink: 0
        }}>
          <button 
            onClick={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() - 1, 1))} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '2px' }}
          >
            <ChevronLeft size={18} />
          </button>
          
          <span style={{ 
            fontWeight: 800, 
            fontSize: '0.75rem', 
            color: '#1e293b', 
            textTransform: 'capitalize',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            minWidth: '110px' 
          }}>
            {mesesNominais[dataFiltro.getMonth()]} de {dataFiltro.getFullYear()}
          </span>

          <button 
            onClick={() => setDataFiltro(new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + 1, 1))} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '2px' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card 
          title="Pendente Mês" 
          icon={<Calendar size={20} />} 
          value={formatMoney(stats.totalMes)} 
          gradient={`linear-gradient(135deg, ${colors.primary}, #3f37c9)`} 
        />
        <Card 
          title="Dívida Futura" 
          icon={<Clock size={20} />} 
          value={formatMoney(stats.totalEmAbertoFuturo)} 
          gradient={`linear-gradient(135deg, ${colors.secondary}, #560bad)`} 
          footer="Parcelas após o mês selecionado" 
        />
        <Card 
          title="Compras no Mês" 
          icon={<ShoppingCart size={20} />} 
          value={stats.qtdComprasMes.toString()} 
          gradient={`linear-gradient(135deg, ${colors.accent2}, ${colors.primary})`} 
        />
      </div>

      <div style={{ margin: '45px 0 20px 0' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontWeight: 700 }}>
          <Users size={22} color={colors.primary} /> Detalhamento por Pessoa
        </h3>
      </div>

      <div className="dashboard-grid">
        {Object.entries(stats.detalhesPorPessoa)
          .sort((a, b) => b[1].valorNoMes - a[1].valorNoMes)
          .map(([nome, dados]) => (
            <div key={nome} className="person-card">
              <div className="card-top-row">
                <span className="person-name-tag">{nome}</span>
                <div className="badges-right-wrapper">
                  {dados.vencimentoAte15 > 0 && (
                    <div className={`badge-pay ${diaAtualReal >= 15 && dataFiltro.getMonth() === new Date().getMonth() && dataFiltro.getFullYear() === new Date().getFullYear() ? 'badge-status-alert' : 'badge-status-ok'}`}>
                      <Banknote size={14} /> Até dia 15: {formatMoney(dados.vencimentoAte15)}
                    </div>
                  )}
                  {dados.vencimentoAte20 > 0 && (
                    <div className={`badge-pay ${diaAtualReal >= 20 && dataFiltro.getMonth() === new Date().getMonth() && dataFiltro.getFullYear() === new Date().getFullYear() ? 'badge-status-alert' : 'badge-status-ok'}`}>
                      <Banknote size={14} /> Até dia 20: {formatMoney(dados.vencimentoAte20)}
                    </div>
                  )}
                  {dados.valorNoMes === 0 && dados.pagoNoMes > 0 && (
                    <div className="badge-pay" style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                      <CheckCircle2 size={14} /> Tudo Pago
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'capitalize' }}>A Pagar ({mesesNominais[dataFiltro.getMonth()]})</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: dados.valorNoMes === 0 ? colors.success : '#1e293b' }}>
                    {formatMoney(dados.valorNoMes)}
                </div>
              </div>

              <div style={{ padding: '10px', background: 'linear-gradient(to right, #f8fafc, #ffffff)', borderRadius: '16px', border: '1px solid #f1f5f9', marginBottom: '15px' }}>
                <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Dívida Restante (Pós {mesesNominais[dataFiltro.getMonth()]})</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: colors.secondary }}>{formatMoney(dados.totalRestanteFuturo)}</div>
              </div>

              <div className="mini-stat-grid">
                <div className="mini-stat-box">
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Compras</span>
                  <div style={{ fontWeight: 800, color: '#334155' }}>{dados.qtdComprasMes}</div>
                </div>
                <div className="mini-stat-box">
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Última Parcela</span>
                  <div style={{ fontWeight: 800, color: '#334155', textTransform: 'capitalize', fontSize: '0.85rem' }}>
                    {dados.ultimaParcelaDate.getTime() > 0 
                      ? dados.ultimaParcelaDate.toLocaleDateString('pt-BR', { month: 'long', year: '2-digit' }).replace('.', '') 
                      : '-'}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// --- Subcomponente Card ---
interface CardProps {
  title: string;
  icon: React.ReactElement<{ size?: number }>;
  value: string;
  gradient: string;
  footer?: string;
}

const Card: React.FC<CardProps> = ({ title, icon, value, gradient, footer }) => (
  <div style={{ 
    padding: '14px', borderRadius: '24px', background: gradient, color: 'white', 
    position: 'relative', overflow: 'hidden', minHeight: '130px', 
    display: 'flex', flexDirection: 'column', justifyContent: 'center', 
    boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)' 
  }}>
    <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.15 }}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 90 })}
    </div>
    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })} {title}
    </div>
    <div style={{ fontSize: '1.8rem', fontWeight: 900, zIndex: 1 }}>{value}</div>
    {footer && <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '4px' }}>{footer}</div>}
  </div>
);

export default Dashboard;