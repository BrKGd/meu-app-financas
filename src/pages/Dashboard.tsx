import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Users, Calendar, ShoppingCart, 
  Clock, Banknote, Loader2 
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

// Interface da tabela Compras Atualizada conforme novo Schema
interface Compra {
  id: string;
  user_id: string;
  valor_total: number;
  parcelas_total: number; // Antigo num_parcelas
  parcela_numero: number; // Nova coluna
  data_compra: string;
  data_vencimento: string; // Importante para o dashboard
  cartao: string;
  forma_pagamento: string;
  periodo_referencia: string; // Nova coluna: 'YYYY-MM-01'
  status_pagamento: string; // Nova coluna
}

interface DetalhePessoa {
  valorNoMes: number;
  qtdComprasMes: number;
  totalRestanteFuturo: number;
  ultimaParcelaDate: Date;
  vencimentoAte15: number;
  vencimentoAte20: number;
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

  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  
  // Chave baseada no primeiro dia do mês para bater com 'periodo_referencia'
  const mesAtualReferencia = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`;

  const colors = {
    primary: '#4361ee',
    secondary: '#7209b7',
    accent2: '#4cc9f0',
    bg: '#f8fafc'
  };

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfilData } = await supabase.from('profiles').select('*').eq('id', user.id).single() as { data: Perfil | null };
      const { data: cartoes } = await supabase.from('cartoes').select('*') as { data: Cartao[] | null };
      const { data: todosPerfis } = await supabase.from('profiles').select('id, nome') as { data: { id: string, nome: string }[] | null };
      
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
      
      const { data: compras } = await query as { data: Compra[] | null };

      let resumo: Stats = {
        totalMes: 0, totalEmAbertoFuturo: 0, qtdComprasMes: 0,
        maiorParcelaMes: 0, detalhesPorPessoa: {}
      };

      compras?.forEach(item => {
        const valorLinha = parseFloat(item.valor_total.toString()) || 0;
        const responsavel = mapaNomes[item.user_id] || 'Outro';

        // O vencimento agora vem direto da linha, ou do cartão se for crédito
        const infoCartao = cartoes?.find(c => c.nome === item.cartao);
        const diaVencimento = infoCartao?.dia_vencimento || 0;

        if (!resumo.detalhesPorPessoa[responsavel]) {
          resumo.detalhesPorPessoa[responsavel] = {
            valorNoMes: 0, qtdComprasMes: 0, totalRestanteFuturo: 0,
            ultimaParcelaDate: new Date(0), vencimentoAte15: 0, vencimentoAte20: 0
          };
        }

        const p = resumo.detalhesPorPessoa[responsavel];
        const dataVencimentoObjeto = new Date(item.data_vencimento + 'T12:00:00');

        // Atualiza última parcela para saber quando a pessoa "fica livre"
        if (dataVencimentoObjeto > p.ultimaParcelaDate) {
          p.ultimaParcelaDate = dataVencimentoObjeto;
        }

        // Lógica: Se o período de referência é este mês
        if (item.periodo_referencia === mesAtualReferencia) {
          resumo.totalMes += valorLinha;
          resumo.qtdComprasMes++;
          p.valorNoMes += valorLinha;
          p.qtdComprasMes++;

          // Lógica de Badges (Dia 15 ou 20)
          if (diaVencimento > 0 && diaVencimento <= 15) p.vencimentoAte15 += valorLinha;
          else if (diaVencimento > 15) p.vencimentoAte20 += valorLinha;
        }

        // Dívida Futura: Tudo que tem vencimento após o último dia deste mês e não está pago
        const fimDoMesAtual = new Date(anoAtual, mesAtual + 1, 0);
        if (dataVencimentoObjeto > fimDoMesAtual && item.status_pagamento !== 'pago') {
          resumo.totalEmAbertoFuturo += valorLinha;
          p.totalRestanteFuturo += valorLinha;
        }
      });

      setStats(resumo);
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [mesAtualReferencia, anoAtual, mesAtual]);

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
      
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#1e293b' }}>
          {perfil?.tipo_usuario === 'proprietario' ? 'Dashboard Global' : 'Meu Resumo Financeiro'}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Mês de Referência: {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(hoje)}</p>
      </div>

      <div className="dashboard-grid">
        <Card title="Fatura Mês" icon={<Calendar size={20} />} value={formatMoney(stats.totalMes)} gradient={`linear-gradient(135deg, ${colors.primary}, #3f37c9)`} />
        <Card title="Dívida Futura" icon={<Clock size={20} />} value={formatMoney(stats.totalEmAbertoFuturo)} gradient={`linear-gradient(135deg, ${colors.secondary}, #560bad)`} footer="Somente pendentes" />
        <Card title="Itens no Mês" icon={<ShoppingCart size={20} />} value={stats.qtdComprasMes.toString()} gradient={`linear-gradient(135deg, ${colors.accent2}, ${colors.primary})`} />
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
                    <div className={`badge-pay ${diaAtual >= 15 ? 'badge-status-alert' : 'badge-status-ok'}`}>
                      <Banknote size={14} /> Até dia 15: {formatMoney(dados.vencimentoAte15)}
                    </div>
                  )}
                  {dados.vencimentoAte20 > 0 && (
                    <div className={`badge-pay ${diaAtual >= 20 ? 'badge-status-alert' : 'badge-status-ok'}`}>
                      <Banknote size={14} /> Até dia 20: {formatMoney(dados.vencimentoAte20)}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'capitalize' }}>Total Faturado</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{formatMoney(dados.valorNoMes)}</div>
              </div>

              <div style={{ padding: '10px', background: 'linear-gradient(to right, #f8fafc, #ffffff)', borderRadius: '16px', border: '1px solid #f1f5f9', marginBottom: '15px' }}>
                <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Dívida Restante</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: colors.secondary }}>{formatMoney(dados.totalRestanteFuturo)}</div>
              </div>

              <div className="mini-stat-grid">
                <div className="mini-stat-box">
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Lançamentos</span>
                  <div style={{ fontWeight: 800, color: '#334155' }}>{dados.qtdComprasMes}</div>
                </div>
                <div className="mini-stat-box">
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Quitação</span>
                  <div style={{ fontWeight: 800, color: '#334155', textTransform: 'capitalize', fontSize: '0.85rem' }}>
                    {dados.ultimaParcelaDate.getTime() > 0 
                      ? dados.ultimaParcelaDate.toLocaleDateString('pt-BR', { month: 'long', year: '2-digit' }).replace('.', '')
                      : '--'}
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