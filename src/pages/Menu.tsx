import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ShoppingBag, CreditCard, LayoutDashboard, Plus, TrendingUp, 
  ChevronRight, User as UserIcon, Users, X, Calendar, History, 
  PiggyBank, ArrowUpCircle, ArrowDownCircle, Target, Shield, LucideProps
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TipoUsuario } from '../types/database'; 
import '../styles/Menu.css';
import '../styles/Cartoes.css';

// --- INTERFACES ESTREITAS PARA O TYPESCRIPT ---
interface Profile {
  id: string;
  nome: string | null;
  tipo_usuario: TipoUsuario | null;
}

interface Cartao {
  nome: string;
  dia_fechamento: number | null;
}

interface Compra {
  id: string;
  user_id: string;
  valor_total: number;
  num_parcelas: number | string;
  data_compra: string;
  forma_pagamento: string;
  cartao: string;
}

interface GastoPorUsuario {
  nome: string;
  valor: number;
}

interface ItemHistorico {
  chave: string;
  total: number;
  porUsuario: Record<string, number>;
}

interface PerfilEstado {
  nome: string;
  tipo: TipoUsuario;
}

const Menu: React.FC = () => {
  const [resumo, setResumo] = useState({ total: 0, quantidade: 0 });
  const [gastosPorUsuario, setGastosPorUsuario] = useState<GastoPorUsuario[]>([]);
  const [historicoMensal, setHistoricoMensal] = useState<ItemHistorico[]>([]);
  const [perfil, setPerfil] = useState<PerfilEstado>({ nome: 'Usuário', tipo: 'comum' });
  const [loading, setLoading] = useState<boolean>(true);
  const [showModalHistorico, setShowModalHistorico] = useState<boolean>(false);

  useEffect(() => {
    buscarDados();
  }, []);

  const formatMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  async function buscarDados() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      // Executa as consultas e já tipa os resultados individualmente
      const [resPerfil, resTodosPerfis, resCartoes, resCompras] = await Promise.all([
        supabase.from('profiles').select('nome, tipo_usuario').eq('id', user.id).single(),
        supabase.from('profiles').select('id, nome'),
        supabase.from('cartoes').select('nome, dia_fechamento'),
        supabase.from('compras').select('*')
      ]);

      // Tratamento de tipos para os dados do perfil logado
      const perfilData = resPerfil.data as Profile | null;
      const isMaster = user.email === 'gleidson.fig@gmail.com';
      const tipoFinal = (isMaster ? 'proprietario' : (perfilData?.tipo_usuario || 'comum')) as TipoUsuario;
      const temAcessoGestao = tipoFinal === 'proprietario' || tipoFinal === 'administrador';

      if (perfilData) {
        setPerfil({ 
          nome: perfilData.nome ? perfilData.nome.split(' ')[0] : 'Usuário', 
          tipo: tipoFinal 
        });
      }

      // Mapeamento de Nomes (ID -> Primeiro Nome)
      const mapaNomes: Record<string, string> = {};
      (resTodosPerfis.data as Profile[] | null)?.forEach(p => {
        if (p.id && p.nome) mapaNomes[p.id] = p.nome.split(' ')[0];
      });

      // Cache de fechamento de cartões
      const cacheFechamentoCartoes: Record<string, number> = {};
      (resCartoes.data as Cartao[] | null)?.forEach(c => {
        if (c.nome) cacheFechamentoCartoes[c.nome] = c.dia_fechamento || 0;
      });

      // Filtro de compras conforme o nível de acesso
      const comprasBrutas = resCompras.data as Compra[] | null;
      const todasCompras = temAcessoGestao 
        ? comprasBrutas 
        : comprasBrutas?.filter(c => c.user_id === user.id);

      // Lógica de competência (Meses)
      const agora = new Date();
      const mesAtualChave = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
      const mapaHistorico: Record<string, { total: number, porUsuario: Record<string, number> }> = {}; 
      let contadorItensFaturadosNoMes = 0; 
      
      todasCompras?.forEach(item => {
        const numP = Number(item.num_parcelas) || 1;
        const valorTotal = Number(item.valor_total) || 0;
        const dataCompraStr = item.data_compra || '';
        const partesData = dataCompraStr.split('-');
        
        if (partesData.length < 3) return; // Pula se a data estiver mal formatada

        const anoC = parseInt(partesData[0]);
        const mesC = parseInt(partesData[1]);
        const diaC = parseInt(partesData[2]);
        const valorP = parseFloat((valorTotal / numP).toFixed(2));
        const nomeResponsavel = mapaNomes[item.user_id] || 'Outros';
        
        let delayMes = 0;
        if (item.forma_pagamento === 'Crédito' && item.cartao !== 'À Vista') {
          const diaFechamento = cacheFechamentoCartoes[item.cartao];
          if (diaFechamento && diaC > diaFechamento) delayMes = 1;
        }

        // Distribui as parcelas nos meses de competência
        for (let i = 0; i < numP; i++) {
          let mesAlvoZeroIndexed = (mesC - 1) + delayMes + i;
          let anoAlvo = anoC + Math.floor(mesAlvoZeroIndexed / 12);
          let mesAlvoReal = (mesAlvoZeroIndexed % 12) + 1;
          const chaveMes = `${anoAlvo}-${String(mesAlvoReal).padStart(2, '0')}`;
          
          if (!mapaHistorico[chaveMes]) {
            mapaHistorico[chaveMes] = { total: 0, porUsuario: {} };
          }

          const ref = mapaHistorico[chaveMes];
          ref.total += valorP;
          ref.porUsuario[nomeResponsavel] = (ref.porUsuario[nomeResponsavel] || 0) + valorP;

          if (chaveMes === mesAtualChave) contadorItensFaturadosNoMes++;
        }
      });

      const listaHistorico: ItemHistorico[] = Object.keys(mapaHistorico)
        .map(chave => ({ chave, ...mapaHistorico[chave] }))
        .sort((a, b) => b.chave.localeCompare(a.chave));

      const dadosMesAtual = mapaHistorico[mesAtualChave] || { total: 0, porUsuario: {} };

      setHistoricoMensal(listaHistorico);
      setGastosPorUsuario(Object.entries(dadosMesAtual.porUsuario).map(([nome, valor]) => ({ nome, valor })));
      setResumo({ total: dadosMesAtual.total, quantidade: contadorItensFaturadosNoMes });

    } catch (err) {
      console.error("Erro ao buscar dados do menu:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;

  const isGestor = perfil.tipo === 'proprietario' || perfil.tipo === 'administrador';

  return (
    <div className="menu-container fade-in">
      <header className="menu-header">
        <div>
          <span className="header-subtitle">Visão Geral</span>
          <h1 className="header-title">Olá, {perfil.nome} 👋</h1>
        </div>
        <div className="trending-icon-box">
          {perfil.tipo === 'administrador' ? <Shield color="#4361ee" size={24} /> : <TrendingUp color="#4361ee" size={28} />}
        </div>
      </header>

      {/* Card Principal */}
      <div className="main-card" onClick={() => setShowModalHistorico(true)} style={{ cursor: 'pointer' }}>
        <div className="main-card-content">
          <div className="card-label-row">
            {isGestor ? <Users size={18} /> : <UserIcon size={18} />}
            <span>{isGestor ? 'Dívidas Globais' : 'Minha Dívida'}</span>
            <History size={14} style={{ marginLeft: 'auto', opacity: 0.6 }} />
          </div>

          <h2 className="total-value">{formatMoney(resumo.total)}</h2>

          {isGestor && gastosPorUsuario.length > 0 && (
            <div className="mini-cards-container">
              {gastosPorUsuario.map((g, i) => (
                <div key={i} className="mini-card">
                  <span className="mini-card-label">{g.nome}</span>
                  <span className="mini-card-value">{formatMoney(g.valor)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pills-row">
            <div className="pill">
              <span className="pill-label">Itens no mês:</span>
              <span style={{fontWeight: 800}}>{resumo.quantidade}</span>
            </div>
            {perfil.tipo === 'administrador' && (
              <div className="pill" style={{background: 'rgba(255,255,255,0.2)'}}>
                <Shield size={10} style={{marginRight: 4}}/>
                <span style={{fontSize: '0.7rem'}}>MODO ADMIN</span>
              </div>
            )}
          </div>
        </div>
        <div className="card-decoration" />
      </div>

      <h3 className="section-title">Ações Rápidas</h3>
      
      <div className="actions-grid">
        <QuickActionLink to="/dashboard" icon={<LayoutDashboard />} label="Painel" sub="Análise" color="#4361ee" />
        {isGestor && (
          <QuickActionLink to="/categoriasMetas" icon={<Target />} label="Metas" sub="Planejar" color="#8b5cf6" />
        )}

        {isGestor && (
          <>
            <QuickActionLink to="/orcamento" icon={<PiggyBank />} label="Orçamento" sub="Gestão" color="#ff9900" />
            <QuickActionLink to="/proventos" icon={<ArrowUpCircle />} label="Ganhos" sub="Renda" color="#16a34a" />
            <QuickActionLink to="/despesas" icon={<ArrowDownCircle />} label="Gastos" sub="Fixos" color="#ef4444" />
          </>
        )}
        
        {perfil.tipo === 'proprietario' && (
          <QuickActionLink to="/cartoes" icon={<CreditCard />} label="Cartões" sub="Bancos" color="#7209b7" />
        )}
        
        <QuickActionLink to="/listagem" icon={<ShoppingBag />} label="Extrato" sub="Compras" color="#00cc66" />
        
        {perfil.tipo === 'proprietario' && (
          <QuickActionLink to="/lancamento" icon={<Plus />} label="Novo" sub="Lançar" color="#fff" isPrimary />
        )}
      </div>

      <Link to="/perfil" style={{ textDecoration: 'none' }}>
        <div className="footer-action">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="footer-icon-box">
              {perfil.tipo === 'comum' ? <UserIcon size={20} color="#4361ee" /> : <Shield size={20} color="#4361ee" />}
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Perfil</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Ajustes de {perfil.tipo}</span>
            </div>
          </div>
          <ChevronRight size={20} color="#64748b" />
        </div>
      </Link>

      {/* Modal de Histórico Mensal */}
      {showModalHistorico && (
        <div className="modal-overlay" onClick={() => setShowModalHistorico(false)}>
          <div className="modal-content fade-in" onClick={e => e.stopPropagation()} style={{ padding: 0, maxWidth: '450px' }}>
            <div className="modal-details-header" style={{ background: '#1e293b', padding: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Histórico Competência</h2>
                   <button onClick={() => setShowModalHistorico(false)} className="btn-close-round"><X size={18}/></button>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.7)', margin: '5px 0 0 0', fontSize: '0.85rem' }}>
                  {isGestor ? 'Visão consolidada de todos os membros' : 'Meus gastos faturados por mês'}
                </p>
            </div>

            <div style={{ padding: '15px', maxHeight: '450px', overflowY: 'auto' }}>
              {historicoMensal.map((mesObj, idx) => {
                const [ano, mes] = mesObj.chave.split('-');
                const dataFormatada = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(parseInt(ano), parseInt(mes) - 1));
                const isAtual = (new Date().getMonth() + 1) === parseInt(mes) && new Date().getFullYear() === parseInt(ano);

                return (
                  <div key={idx} style={{ 
                    marginBottom: '12px',
                    background: isAtual ? '#f8fafc' : '#fff',
                    borderRadius: '16px',
                    border: isAtual ? '2px solid #4361ee' : '1px solid #f1f5f9',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '16px', 
                      alignItems: 'center',
                      borderBottom: isGestor ? '1px dashed #e2e8f0' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Calendar size={18} color={isAtual ? '#4361ee' : '#64748b'} />
                        <span style={{ fontWeight: '800', textTransform: 'capitalize', color: '#1e293b' }}>
                          {dataFormatada}
                        </span>
                      </div>
                      <span style={{ fontWeight: '900', color: isAtual ? '#4361ee' : '#0f172a' }}>
                        {formatMoney(mesObj.total)}
                      </span>
                    </div>

                    {isGestor && (
                      <div style={{ padding: '12px 16px', background: 'rgba(241, 245, 249, 0.5)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                        {Object.entries(mesObj.porUsuario).map(([nome, valor]) => (
                          <div key={nome} style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{nome}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>{formatMoney(valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE AUXILIAR ---
interface QuickActionProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  color: string;
  isPrimary?: boolean;
}

const QuickActionLink: React.FC<QuickActionProps> = ({ to, icon, label, sub, color, isPrimary }) => (
  <Link to={to} style={{ textDecoration: 'none' }}>
    <div className={`quick-action-card ${isPrimary ? 'primary' : 'secondary'}`}>
      <div className="action-icon-wrapper" style={{ 
        background: isPrimary ? 'rgba(255,255,255,0.2)' : `${color}15`, 
        color: isPrimary ? '#fff' : color 
      }}>
        {React.isValidElement<LucideProps>(icon) ? React.cloneElement(icon, { size: 22 }) : icon}
      </div>
      <div>
        <span>{label}</span>
        <span>{sub}</span>
      </div>
    </div>
  </Link>
);

export default Menu;