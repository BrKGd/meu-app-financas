import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  LayoutDashboard, List, Home, 
  CreditCard, Wallet, LogOut, User, 
  ArrowUpCircle, ArrowDownCircle, Target,
  PlusCircle, PieChart 
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const [perfil, setPerfil] = useState({ tipo: 'comum' });
  const [modalLogout, setModalLogout] = useState({ isOpen: false });

  const isActive = (path) => location.pathname.toLowerCase() === path.toLowerCase();

  const isProprietario = perfil.tipo === 'proprietario';
  const isAdmin = perfil.tipo === 'administrador';
  const temAcessoGestao = isProprietario || isAdmin;

  useEffect(() => {
    obterPerfil();
  }, []);

  async function obterPerfil() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('tipo_usuario')
          .eq('id', user.id)
          .single();
        
        const isMaster = user.email === 'gleidson.fig@gmail.com';
        const tipoFinal = isMaster ? 'proprietario' : (data?.tipo_usuario || 'comum');
        setPerfil({ tipo: tipoFinal });
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <aside className="sidebar-container">
        <div className="sidebar-logo">
          <Wallet size={28} fill="#4361ee30" />
          <span>Finanças</span>
        </div>

        <nav className="sidebar-nav-list">
          <Link to="/" className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}>
            <Home size={20} />
            <span>Início</span>
          </Link>

          {isProprietario && (
            <Link to="/lancamento" className={`sidebar-nav-item ${isActive('/lancamento') ? 'active' : ''}`}>
              <PlusCircle size={20} />
              <span>Lançar</span>
            </Link>
          )}

          {temAcessoGestao && (
            <>
              <Link to="/proventos" className={`sidebar-nav-item ${isActive('/proventos') ? 'active' : ''}`}>
                <ArrowUpCircle size={20} />
                <span>Entradas</span>
              </Link>
              <Link to="/despesas" className={`sidebar-nav-item ${isActive('/despesas') ? 'active' : ''}`}>
                <ArrowDownCircle size={20} />
                <span>Saídas</span>
              </Link>
              
              {/* Link Unificado: Categorias e Metas */}
              <Link to="/categoriasMetas" className={`sidebar-nav-item ${isActive('/categoriasMetas') ? 'active' : ''}`}>
                <Target size={20} />
                <span>Planejamento</span>
              </Link>

              <Link to="/orcamento" className={`sidebar-nav-item ${isActive('/orcamento') ? 'active' : ''}`}>
                <PieChart size={20} />
                <span>Orçamento</span>
              </Link>

              {isProprietario && (
                <Link to="/cartoes" className={`sidebar-nav-item ${isActive('/cartoes') ? 'active' : ''}`}>
                  <CreditCard size={20} />
                  <span>Cartões</span>
                </Link>
              )}
            </>
          )}

          <Link to="/listagem" className={`sidebar-nav-item ${isActive('/listagem') ? 'active' : ''}`}>
            <List size={20} />
            <span>Extrato</span>
          </Link>

          <Link to="/dashboard" className={`sidebar-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Painel</span>
          </Link>

          <Link to="/perfil" className={`sidebar-nav-item ${isActive('/perfil') ? 'active' : ''}`}>
            <User size={20} />
            <span>Perfil</span>
          </Link>

          <button 
            type="button"
            onClick={() => setModalLogout({ isOpen: true })} 
            className="sidebar-nav-item sidebar-logout-btn"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </nav>
      </aside>

      <ModalFeedback
        isOpen={modalLogout.isOpen}
        type="error"
        title="Encerrar Sessão?"
        message="Você terá que entrar com suas credenciais novamente para acessar o sistema."
        onClose={() => setModalLogout({ isOpen: false })}
        onConfirm={handleLogout}
      />
    </>
  );
};

export default Sidebar;