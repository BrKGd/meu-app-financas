import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ShoppingBag, CreditCard, LayoutDashboard, Plus, TrendingUp, 
  ChevronRight, User as UserIcon, Users, Calendar, History, 
  PiggyBank, ArrowUpCircle, ArrowDownCircle, Target, Shield, LucideProps,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TipoUsuario } from '../types/database'; 
import '../styles/Menu.css';

// Importação do ícone de fechar seguindo o padrão Cartoes.tsx
import iconFechar from '../assets/fechar.png';

// --- INTERFACES ---
interface Profile {
  id: string;
  nome: string | null;
  tipo_usuario: TipoUsuario | null;
}

interface Compra {
  id: string;
  user_id: string;
  valor_total: string | number;
  data_compra: string;
  forma_pagamento: string;
  cartao: string | null;
  periodo_referencia: string;
  parcela_numero: number;
  status_pagamento?: string; 
}

interface GastoPorUsuario {
  nome: string;
  valorPendente: number;
  valorPago: number;
}

interface ItemHistorico {
  chave: string;
  totalPendente: number;
  totalPago: number;
  porUsuario: Record<string, { pendente: number; pago: number }>;
}

interface PerfilEstado {
  nome: string;
  tipo: TipoUsuario;
}

const Menu: React.FC = () => {
  const [resumo, setResumo] = useState({ totalPendente: 0, quantidade: 0 });
  const [gastosPorUsuario, setGastosPorUsuario] = useState<GastoPorUsuario[]>([]);
  const [historicoMensal, setHistoricoMensal] = useState<ItemHistorico[]>([]);
  const [perfil, setPerfil] = useState<PerfilEstado>({ nome: 'Usuário', tipo: 'comum' });
  const [loading, setLoading] = useState<boolean>(true);
  const [showModalHistorico, setShowModalHistorico] = useState<boolean>(false);

  const formatMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const buscarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const [resPerfil, resTodosPerfis, resCompras] = await Promise.all([
        supabase.from('profiles').select('nome, tipo_usuario').eq('id', user.id).single(),
        supabase.from('profiles').select('id, nome'),
        supabase.from('compras').select('*')
      ]);

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

      const mapaNomes: Record<string, string> = {};
      (resTodosPerfis.data as Profile[] | null)?.forEach(p => {
        if (p.id && p.nome) mapaNomes[p.id] = p.nome.split(' ')[0];
      });

      const comprasBrutas = resCompras.data as Compra[] | null;
      const todasCompras = temAcessoGestao 
        ? comprasBrutas 
        : comprasBrutas?.filter(c => c.user_id === user.id);

      const agora = new Date();
      const mesAtualChave = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
      const mesAtualReferencia = `${mesAtualChave}-01`;
      
      const mapaHistorico: Record<string, ItemHistorico> = {}; 
      let contadorItensNoMes = 0; 
      
      todasCompras?.forEach(item => {
        const valorParcela = parseFloat(String(item.valor_total)) || 0;
        const nomeResponsavel = mapaNomes[item.user_id] || 'Outros';
        const estaPago = item.status_pagamento === 'pago';
        
        if (!item.periodo_referencia) return;
        const chaveMes = item.periodo_referencia.substring(0, 7);

        if (!mapaHistorico[chaveMes]) {
          mapaHistorico[chaveMes] = { 
            chave: chaveMes, 
            totalPendente: 0, 
            totalPago: 0, 
            porUsuario: {} 
          };
        }

        const ref = mapaHistorico[chaveMes];
        if (!ref.porUsuario[nomeResponsavel]) {
          ref.porUsuario[nomeResponsavel] = { pendente: 0, pago: 0 };
        }

        if (estaPago) {
          ref.totalPago += valorParcela;
          ref.porUsuario[nomeResponsavel].pago += valorParcela;
        } else {
          ref.totalPendente += valorParcela;
          ref.porUsuario[nomeResponsavel].pendente += valorParcela;
        }

        if (item.periodo_referencia === mesAtualReferencia) {
          contadorItensNoMes++;
        }
      });

      const listaHistorico = Object.values(mapaHistorico)
        .sort((a, b) => b.chave.localeCompare(a.chave));

      const dadosMesAtual = mapaHistorico[mesAtualChave] || { totalPendente: 0, totalPago: 0, porUsuario: {} };

      setHistoricoMensal(listaHistorico);
      setGastosPorUsuario(Object.entries(dadosMesAtual.porUsuario).map(([nome, dados]) => ({ 
        nome, 
        valorPendente: dados.pendente,
        valorPago: dados.pago
      })));
      setResumo({ totalPendente: dadosMesAtual.totalPendente, quantidade: contadorItensNoMes });

    } catch (err) {
      console.error("Erro ao buscar dados do menu:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

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
      <div className="main-card" onClick={() => setShowModalHistorico(true)}>
        <div className="main-card-content">
          <div className="card-label-row">
            {isGestor ? <Users size={18} /> : <UserIcon size={18} />}
            <span>{isGestor ? 'Pendências Globais' : 'Minha Pendência'}</span>
            <History size={14} style={{ marginLeft: 'auto', opacity: 0.6 }} />
          </div>

          <h2 className="total-value">{formatMoney(resumo.totalPendente)}</h2>

          {isGestor && gastosPorUsuario.length > 0 && (
            <div className="mini-cards-container">
              {gastosPorUsuario.map((g, i) => {
                const isUserPago = g.valorPendente === 0 && g.valorPago > 0;
                return (
                  <div key={i} className={`mini-card ${isUserPago ? 'status-pago-opacidade' : ''}`}>
                    <span className="mini-card-label">
                      {g.nome} {isUserPago && <CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginLeft: 4 }} />}
                    </span>
                    <span className="mini-card-value">
                      {isUserPago ? formatMoney(g.valorPago) : formatMoney(g.valorPendente)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pills-row">
            <div className="pill">
              <span className="pill-label">Itens no mês:</span>
              <span style={{fontWeight: 800}}>{resumo.quantidade}</span>
            </div>
          </div>
        </div>
        <div className="card-decoration" />
      </div>

      <h3 className="section-title">Ações Rápidas</h3>
      
      {/* Grade de Ações em 5 colunas sem cards de fundo */}
      <div className="actions-grid-minimal">
        <QuickActionIcon to="/dashboard" icon={<LayoutDashboard />} label="Painel" color="#4361ee" />
        {isGestor && <QuickActionIcon to="/categoriasMetas" icon={<Target />} label="Metas" color="#8b5cf6" />}
        {isGestor && <QuickActionIcon to="/orcamento" icon={<PiggyBank />} label="Gestão" color="#ff9900" />}
        {isGestor && <QuickActionIcon to="/proventos" icon={<ArrowUpCircle />} label="Ganhos" color="#16a34a" />}
        <QuickActionIcon to="/despesas" icon={<ArrowDownCircle />} label="Fixos" color="#ef4444" />
        {perfil.tipo === 'proprietario' && <QuickActionIcon to="/cartoes" icon={<CreditCard />} label="Cartões" color="#7209b7" />}
        <QuickActionIcon to="/listagem" icon={<ShoppingBag />} label="Extrato" color="#00cc66" />
        <QuickActionIcon to="/lancamento" icon={<Plus />} label="Novo" color="#4361ee" isPrimary />
      </div>

      <Link to="/perfil" className="footer-link-reset">
        <div className="footer-action">
          <div className="footer-info-group">
            <div className="footer-icon-box">
              {perfil.tipo === 'comum' ? <UserIcon size={20} color="#4361ee" /> : <Shield size={20} color="#4361ee" />}
            </div>
            <div>
              <span className="footer-label-main">Perfil</span>
              <span className="footer-label-sub">Ajustes de {perfil.tipo}</span>
            </div>
          </div>
          <ChevronRight size={20} color="#64748b" />
        </div>
      </Link>

      {/* Modal de Histórico Mensal */}
      {showModalHistorico && (
        <div className="modal-overlay" onClick={() => setShowModalHistorico(false)}>
          <div className="modal-content history-modal-container fade-in" onClick={e => e.stopPropagation()}>
            <div className="history-header-bg">
                <div className="history-header-row">
                   <div>
                     <h2 className="history-title">Histórico de Faturas</h2>
                     <p className="history-subtitle">Valores pendentes e pagos por mês</p>
                   </div>
                   <button onClick={() => setShowModalHistorico(false)} className="btn-close-round">
                     <img src={iconFechar} alt="Fechar" />
                   </button>
                </div>
            </div>

            <div className="modal-scroll-area">
              {historicoMensal.map((mesObj, idx) => {
                const [ano, mes] = mesObj.chave.split('-');
                const dataFormatada = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(parseInt(ano), parseInt(mes) - 1));
                const tudoPago = mesObj.totalPendente === 0 && mesObj.totalPago > 0;

                return (
                  <div key={idx} className={`history-item-card ${tudoPago ? 'status-pago-opacidade' : ''}`}>
                    <div className="history-item-main">
                      <div className="history-item-info">
                        <Calendar size={18} color={tudoPago ? '#10b981' : '#64748b'} />
                        <span className="history-item-date">{dataFormatada}</span>
                        {tudoPago && (
                          <div className="badge-pago-mini" style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 800 }}>
                            PAGO
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`history-item-total ${tudoPago ? 'text-pago' : ''}`} style={tudoPago ? { color: '#10b981' } : {}}>
                          {formatMoney(tudoPago ? mesObj.totalPago : mesObj.totalPendente)}
                        </span>
                        {!tudoPago && mesObj.totalPago > 0 && (
                          <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600 }}>
                            + {formatMoney(mesObj.totalPago)} pagos
                          </div>
                        )}
                      </div>
                    </div>

                    {isGestor && (
                      <div className="history-user-grid">
                        {Object.entries(mesObj.porUsuario).map(([nome, d]) => {
                          const isUserMensalPago = d.pendente === 0 && d.pago > 0;
                          return (
                            <div key={nome} className="user-spend-col" style={{ opacity: isUserMensalPago ? 0.6 : 1 }}>
                              <span className="user-spend-name">
                                {nome} {isUserMensalPago && <CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginLeft: 4 }} />}
                              </span>
                              <span className="user-spend-value" style={isUserMensalPago ? { color: '#10b981' } : {}}>
                                {formatMoney(isUserMensalPago ? d.pago : d.pendente)}
                              </span>
                            </div>
                          );
                        })}
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

// --- COMPONENTE DE ÍCONE MINIMALISTA ---
interface QuickActionIconProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  isPrimary?: boolean;
}

const QuickActionIcon: React.FC<QuickActionIconProps> = ({ to, icon, label, color, isPrimary }) => (
  <Link to={to} className="quick-action-minimal-link">
    <div className={`action-icon-circle ${isPrimary ? 'primary-bg' : ''}`} style={!isPrimary ? { backgroundColor: `${color}15`, color: color } : {}}>
      {React.isValidElement<LucideProps>(icon) ? React.cloneElement(icon, { size: 24 }) : icon}
    </div>
    <span className="action-icon-label">{label}</span>
  </Link>
);

export default Menu;