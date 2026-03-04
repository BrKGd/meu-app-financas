import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabaseClient'; // Corrigido nome e removido .ts
import { Session } from '@supabase/supabase-js';

// Estilos
import './styles/App.css';

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
import CategoriasMetas from './pages/CategoriasMetas';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      setLoading(false);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-screen" style={loadingContainerStyle}>
        <div className="spinner"></div>
        <p>A carregar sistema financeiro...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-main">
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
                <Route path="/" element={<Menu />} />
                <Route path="/menu" element={<Navigate to="/" replace />} />
                
                <Route path="/lancamento" element={<Lancamento />} />
                <Route path="/listagem" element={<Listagem />} />
                <Route path="/categoriasMetas" element={<CategoriasMetas />} /> 
                <Route path="/orcamento" element={<Orcamento />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/proventos" element={<Proventos />} />
                <Route path="/despesas" element={<Despesas />} />
                <Route path="/cartoes" element={<Cartoes />} />
                <Route path="/perfil" element={<Perfil />} />
                
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        )}
      </div>
    </Router>
  );
};

const loadingContainerStyle: React.CSSProperties = {
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'sans-serif',
  color: '#6366f1'
};

export default App;