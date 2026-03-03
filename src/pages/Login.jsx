import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Link } from 'react-router-dom';
import { Wallet, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // O .trim() é vital para evitar que espaços no final do e-mail causem erro
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        console.error("Erro detalhado do Supabase:", authError);
        
        // Mapeamento de erros comuns para mensagens amigáveis
        if (authError.message === "Email not confirmed") {
          setError("Seu e-mail ainda não foi confirmado no painel do Supabase.");
        } else if (authError.message === "Invalid login credentials") {
          setError("E-mail ou senha incorretos. Verifique suas credenciais.");
        } else {
          setError(authError.message);
        }
      } else {
        console.log("Login bem-sucedido!", data);
        // O App.jsx detectará a sessão automaticamente e redirecionará.
      }
    } catch (err) {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    primary: '#4361ee',
    dark: '#0f172a',
    bg: '#f8fafc',
    surface: '#ffffff'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: theme.bg,
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div className="fade-in" style={{ 
        width: '100%', 
        maxWidth: '420px', 
        backgroundColor: theme.surface, 
        padding: '40px', 
        borderRadius: '32px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)',
        boxSizing: 'border-box'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            background: theme.primary, 
            width: '60px', height: '60px', 
            borderRadius: '18px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px auto',
            boxShadow: `0 10px 15px ${theme.primary}44`
          }}>
            <Wallet color="white" size={32} />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: theme.dark, margin: '0 0 8px 0' }}>Bem-vindo</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Acesse sua conta para gerenciar suas finanças.</p>
        </div>

        {error && (
          <div style={{ 
            backgroundColor: '#fef2f2', 
            color: '#b91c1c', 
            padding: '12px 16px', 
            borderRadius: '12px', 
            fontSize: '0.85rem', 
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '20px',
            border: '1px solid #fee2e2'
          }}>
            <AlertCircle size={18} />
            <span style={{ flex: 1 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>E-mail</label>
            <div style={inputWrapperStyle}>
              <Mail size={20} color="#94a3b8" />
              <input 
                type="email" 
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Senha</label>
            <div style={inputWrapperStyle}>
              <Lock size={20} color="#94a3b8" />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 5px', color: '#94a3b8' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              backgroundColor: theme.primary, 
              color: 'white', 
              padding: '16px', 
              borderRadius: '16px', 
              border: 'none', 
              fontSize: '1rem', 
              fontWeight: 700, 
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '10px',
              marginTop: '10px',
              boxShadow: `0 10px 20px ${theme.primary}33`,
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {loading ? 'Autenticando...' : (
              <>
                Entrar na Conta <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.9rem', color: '#64748b' }}>
          Não tem uma conta?{' '}
          <Link to="/registro" style={{ color: theme.primary, fontWeight: 700, textDecoration: 'none' }}>
            Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  );
};

const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' };
const inputWrapperStyle = { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f1f5f9', padding: '0 16px', borderRadius: '16px', height: '56px', boxSizing: 'border-box' };
const inputStyle = { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '1rem', color: '#0f172a', width: '100%' };

export default Login;