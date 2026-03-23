import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  LayoutDashboard, List, Home, 
  CreditCard, Wallet, LogOut, User, 
  ArrowUpCircle, ArrowDownCircle, Target,
  PlusCircle, PieChart, Flag 
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Sidebar.css';

// --- Interfaces para Tipagem ---
type UserTipo = 'comum' | 'proprietario' | 'administrador';

interface PerfilState {
  tipo: UserTipo;
}

interface ModalState {
  isOpen: boolean;
}

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [perfil, setPerfil] = useState<PerfilState>({ tipo: 'comum' });
  const [modalLogout, setModalLogout] = useState<ModalState>({ isOpen: false });

  // Função para verificar se a rota está ativa
  const isActive = (path: string): boolean => 
    location.pathname.toLowerCase() === path.toLowerCase();

  // Constantes de Acesso baseadas no tipo de usuário
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
        // CORREÇÃO DO ERRO: Tipamos o retorno do .single()
        const { data, error } = await supabase
          .from('profiles')
          .select('tipo_usuario')
          .eq('id', user.id)
          .single() as { data: { tipo_usuario: UserTipo } | null, error: any };

        if (error) throw error;

        // Lógica de Master (Prioridade para o seu e-mail)
        const isMaster = user.email === 'gleidson.fig@gmail.com';
        const tipoFinal: UserTipo = isMaster ? 'proprietario' : (data?.tipo_usuario || 'comum');
        
        setPerfil({ tipo: tipoFinal });
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      setPerfil({ tipo: 'comum' }); // Fallback em caso de erro
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

          {/* Lançar: Agora visível para todos os usuários */}
          <Link to="/lancamento" className={`sidebar-nav-item ${isActive('/lancamento') ? 'active' : ''}`}>
            <PlusCircle size={20} />
            <span>Lançar</span>
          </Link>

          {/* Área de Gestão: Restrita a Proprietário ou Administrador */}
          {temAcessoGestao && (
            <Link to="/proventos" className={`sidebar-nav-item ${isActive('/proventos') ? 'active' : ''}`}>
              <ArrowUpCircle size={20} />
              <span>Entradas</span>
            </Link>
          )}

          {/* Saídas (Gastos Fixos): Agora visível para todos os usuários */}
          <Link to="/despesas" className={`sidebar-nav-item ${isActive('/despesas') ? 'active' : ''}`}>
            <ArrowDownCircle size={20} />
            <span>Saídas</span>
          </Link>
          <Link to="/cartoes" className={`sidebar-nav-item ${isActive('/cartoes') ? 'active' : ''}`}>
            <CreditCard size={20} />
            <span>Cartões</span>
          </Link>

          {/* Planejamento e Orçamento: Restritos a Gestores */}
          {temAcessoGestao && (
            <>
              <Link to="/categoriasMetas" className={`sidebar-nav-item ${isActive('/categoriasMetas') ? 'active' : ''}`}>
                <Flag size={20} />
                <span>Categorias e Metas</span>
              </Link>

              <Link to="/orcamento" className={`sidebar-nav-item ${isActive('/orcamento') ? 'active' : ''}`}>
                <PieChart size={20} />
                <span>Orçamento</span>
              </Link>
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
        type="warning"
        title="Encerrar Sessão?"
        message="Você terá que entrar com suas credenciais novamente para acessar o sistema."
        onClose={() => setModalLogout({ isOpen: false })}
        onConfirm={handleLogout}
      />
    </>
  );
};

export default Sidebar;