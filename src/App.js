import React, { useEffect, useState } from 'react';
import './styles/App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabaseClient';

// Importação de Componentes e Páginas
import Sidebar from './components/Sidebar';
import Menu from './pages/Menu';
import Lancamento from './pages/Lancamento';
import Listagem from './pages/Listagem';
import Dashboard from './pages/Dashboard';
import Cartoes from './pages/Cartoes';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Perfil from './pages/Perfil';
import Orcamento from './pages/Orcamento';
import Proventos from './pages/Proventos';
import Despesas from './pages/Despesas';
import CategoriasMetas from './pages/CategoriasMetas'; // <-- Importação Unificada

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false); 
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', height: '100vh', width: '100vw', 
        alignItems: 'center', justifyContent: 'center', background: '#f8fafc' 
      }}>
        <div className="loader">Carregando...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="main-wrapper">
        {!session ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <div className="app-container">
            <Sidebar />
            <main className="content-area">
              <Routes>
                {/* Rota Raiz (Página Inicial) */}
                <Route path="/" element={<Menu />} />
                
                {/* Lançamentos e Listagem */}
                <Route path="/lancamento" element={<Lancamento />} />
                <Route path="/listagem" element={<Listagem />} />
                
                {/* Planejamento e Metas (Unificado) */}
                <Route path="/categoriasMetas" element={<CategoriasMetas />} /> 
                <Route path="/orcamento" element={<Orcamento />} />
                
                {/* Gestão de Dados */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/proventos" element={<Proventos />} />
                <Route path="/despesas" element={<Despesas />} />
                <Route path="/cartoes" element={<Cartoes />} />
                <Route path="/perfil" element={<Perfil />} />
                
                {/* Redirecionamentos de Segurança */}
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/registro" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;