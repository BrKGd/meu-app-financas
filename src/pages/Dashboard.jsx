import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Users, Calendar, ShoppingCart, 
  Clock, Banknote 
} from 'lucide-react';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMes: 0,
    totalEmAbertoFuturo: 0,
    qtdComprasMes: 0,
    maiorParcelaMes: 0,
    detalhesPorPessoa: {}
  });
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const mesAtualChave = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;

  const colors = {
    primary: '#4361ee',
    secondary: '#7209b7',
    accent2: '#4cc9f0',
    bg: '#f8fafc'
  };

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfilData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: cartoes } = await supabase.from('cartoes').select('*');
      const { data: todosPerfis } = await supabase.from('profiles').select('id, nome');
      setPerfil(perfilData);

      const isMaster = user.email === 'gleidson.fig@gmail.com';
      const isProprietario = perfilData?.tipo_usuario === 'proprietario' || isMaster;

      const mapaNomes = {};
      todosPerfis?.forEach(p => mapaNomes[p.id] = p.nome.split(' ')[0]);

      let query = supabase.from('compras').select('*');
      if (!isProprietario) query = query.eq('user_id', user.id);
      
      const { data: compras } = await query;

      let resumo = {
        totalMes: 0, totalEmAbertoFuturo: 0, qtdComprasMes: 0,
        maiorParcelaMes: 0, detalhesPorPessoa: {}
      };

      compras?.forEach(item => {
        const valorTotal = parseFloat(item.valor_total) || 0;
        const numP = parseInt(item.num_parcelas) || 1;
        const valorP = valorTotal / numP;
        const [anoC, mesC, diaC] = item.data_compra.split('-').map(Number);
        const responsavel = mapaNomes[item.user_id] || 'Outro';

        const infoCartao = cartoes?.find(c => c.nome === item.cartao);
        const vencimento = infoCartao?.dia_vencimento || 0;

        if (!resumo.detalhesPorPessoa[responsavel]) {
          resumo.detalhesPorPessoa[responsavel] = {
            valorNoMes: 0, qtdComprasMes: 0, totalRestanteFuturo: 0,
            ultimaParcelaDate: new Date(0), vencimentoAte15: 0, vencimentoAte20: 0
          };
        }

        const p = resumo.detalhesPorPessoa[responsavel];

        let delayMes = 0;
        if (item.forma_pagamento === 'Crédito' && item.cartao !== 'À Vista') {
          if (infoCartao && diaC > infoCartao.dia_fechamento) delayMes = 1;
        }

        for (let i = 0; i < numP; i++) {
          const dtP = new Date(anoC, (mesC - 1) + delayMes + i, 1);
          const chaveP = `${dtP.getFullYear()}-${String(dtP.getMonth() + 1).padStart(2, '0')}`;

          if (dtP > p.ultimaParcelaDate) p.ultimaParcelaDate = dtP;

          if (chaveP === mesAtualChave) {
            resumo.totalMes += valorP;
            resumo.qtdComprasMes++;
            p.valorNoMes += valorP;
            p.qtdComprasMes++;
            
            if (valorP > resumo.maiorParcelaMes) resumo.maiorParcelaMes = valorP;

            if (vencimento > 0 && vencimento <= 15) {
              p.vencimentoAte15 += valorP;
            } else if (vencimento > 15) {
              p.vencimentoAte20 += valorP;
            }
          }

          if (dtP > new Date(anoAtual, mesAtual, 1) && chaveP !== mesAtualChave) {
            resumo.totalEmAbertoFuturo += valorP;
            p.totalRestanteFuturo += valorP;
          }
        }
      });

      setStats(resumo);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const formatMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: colors.primary, fontWeight: 'bold' }}>Carregando Dashboard...</div>;

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
        <Card title="Dívida Futura" icon={<Clock size={20} />} value={formatMoney(stats.totalEmAbertoFuturo)} gradient={`linear-gradient(135deg, ${colors.secondary}, #560bad)`} footer="Pós-fatura atual" />
        <Card title="Compras no Mês" icon={<ShoppingCart size={20} />} value={stats.qtdComprasMes} gradient={`linear-gradient(135deg, ${colors.accent2}, ${colors.primary})`} />
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
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Compras</span>
                  <div style={{ fontWeight: 800, color: '#334155' }}>{dados.qtdComprasMes}</div>
                </div>
                <div className="mini-stat-box">
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Quitação</span>
                  <div style={{ fontWeight: 800, color: '#334155', textTransform: 'capitalize', fontSize: '0.85rem' }}>
                    {dados.ultimaParcelaDate.toLocaleDateString('pt-BR', { month: 'long', year: '2-digit' }).replace('.', '')}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

const Card = ({ title, icon, value, gradient, footer }) => (
  <div style={{ padding: '14px', borderRadius: '24px', background: gradient, color: 'white', position: 'relative', overflow: 'hidden', minHeight: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)' }}>
    <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.15 }}>{React.cloneElement(icon, { size: 90 })}</div>
    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>{icon} {title}</div>
    <div style={{ fontSize: '1.8rem', fontWeight: 900, zIndex: 1 }}>{value}</div>
    {footer && <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '4px' }}>{footer}</div>}
  </div>
);

export default Dashboard;