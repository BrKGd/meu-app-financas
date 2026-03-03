import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const Registro = () => {
  const [formData, setFormData] = useState({ nome: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: null, message: '' });

    // 1. Validação de Senha
    if (formData.password !== formData.confirmPassword) {
      setStatus({ type: 'error', message: 'As senhas não coincidem.' });
      setLoading(false);
      return;
    }

    try {
      // 2. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            nome: formData.nome,
          },
        },
      });

      if (authError) throw authError;

      // 3. Se o Auth deu certo, salvar na tabela 'profiles'
      if (authData.user) {
        const emailMaster = 'gleidson.fig@gmail.com';
        // Define proprietario se for o seu e-mail, senhas comuns para os demais
        const tipoInicial = formData.email.toLowerCase() === emailMaster ? 'proprietario' : 'comum';

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { 
              id: authData.user.id, 
              nome: formData.nome, 
              email: formData.email,
              tipo_usuario: tipoInicial 
            }
          ]);

        if (profileError) {
          console.error("Erro ao inserir profile:", profileError);
          throw new Error("Sua conta foi criada, mas houve um erro ao configurar seu perfil no banco de dados.");
        }

        setStatus({ 
          type: 'success', 
          message: 'Conta criada com sucesso! Redirecionando para o login...' 
        });
        
        setTimeout(() => navigate('/login'), 2500);
      }

    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // --- Temas e Estilos Preservados ---
  const theme = {
    primary: '#4361ee',
    dark: '#0f172a',
    bg: '#f8fafc',
    surface: '#ffffff'
  };

  const labelStyle = { 
    display: 'block', 
    fontSize: '0.75rem', 
    fontWeight: 700, 
    color: '#475569', 
    marginBottom: '6px', 
    textTransform: 'uppercase' 
  };

  const inputWrapperStyle = { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    backgroundColor: '#f1f5f9', 
    padding: '0 14px', 
    borderRadius: '14px', 
    height: '50px',
    width: '100%',
    boxSizing: 'border-box' 
  };

  const inputStyle = { 
    flex: 1, 
    background: 'none', 
    border: 'none', 
    outline: 'none', 
    fontSize: '0.95rem', 
    color: '#0f172a',
    width: '100%' 
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: theme.bg,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div className="fade-in" style={{ 
        width: '100%', 
        maxWidth: '450px', 
        backgroundColor: theme.surface, 
        padding: '30px', 
        borderRadius: '32px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #4361ee, #4cc9f0)', 
            width: '50px', height: '50px', borderRadius: '15px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 15px auto'
          }}>
            <Wallet color="white" size={28} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: theme.dark, margin: 0 }}>Crie sua conta</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '5px' }}>Gerencie suas finanças com precisão.</p>
        </div>

        {status.message && (
          <div style={{ 
            backgroundColor: status.type === 'error' ? '#fef2f2' : '#f0fdf4', 
            color: status.type === 'error' ? '#b91c1c' : '#166534', 
            padding: '12px', borderRadius: '12px', fontSize: '0.85rem', 
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px',
            border: `1px solid ${status.type === 'error' ? '#fee2e2' : '#dcfce7'}`,
            boxSizing: 'border-box'
          }}>
            {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span style={{ flex: 1 }}>{status.message}</span>
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
          <div style={{ width: '100%' }}>
            <label style={labelStyle}>Nome Completo</label>
            <div style={inputWrapperStyle}>
              <User size={18} color="#94a3b8" />
              <input 
                type="text" required placeholder="Ex: João Silva"
                style={inputStyle}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
              />
            </div>
          </div>

          <div style={{ width: '100%' }}>
            <label style={labelStyle}>E-mail</label>
            <div style={inputWrapperStyle}>
              <Mail size={18} color="#94a3b8" />
              <input 
                type="email" required placeholder="seu@email.com"
                style={inputStyle}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '15px', 
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>Senha</label>
              <div style={inputWrapperStyle}>
                <Lock size={18} color="#94a3b8" />
                <input 
                  type="password" required placeholder="••••"
                  style={inputStyle}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>Confirmar</label>
              <div style={inputWrapperStyle}>
                <Lock size={18} color="#94a3b8" />
                <input 
                  type="password" required placeholder="••••"
                  style={inputStyle}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              backgroundColor: theme.primary, color: 'white', padding: '16px', 
              borderRadius: '16px', border: 'none', fontSize: '1rem', fontWeight: 700, 
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '10px', marginTop: '10px', boxShadow: `0 10px 20px ${theme.primary}33`,
              width: '100%',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <>Criar Minha Conta <ArrowRight size={20} /></>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.9rem', color: '#64748b' }}>
          Já possui acesso?{' '}
          <Link to="/login" style={{ color: theme.primary, fontWeight: 700, textDecoration: 'none' }}>
            Fazer Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Registro;