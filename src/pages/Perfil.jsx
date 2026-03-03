import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  User, Shield, Mail, Trash2, Save, 
  Loader2, Crown, Users, Key, ChevronDown, 
  Settings, Zap, CheckCircle2, Lock, X, Star
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Perfil.css';

const Perfil = () => {
  const [perfilLogado, setPerfilLogado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  const [modal, setModal] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: null });

  const fecharSelecao = useCallback(() => {
    setUsuarioSelecionado(null);
    setIsModalOpen(false);
    setNovaSenha('');
  }, []);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: meuPerfil } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (meuPerfil) {
        const isMaster = user.email === 'gleidson.fig@gmail.com';
        const tipoFinal = isMaster ? 'proprietario' : (meuPerfil.tipo_usuario || 'comum');
        const perfilComTipoCorreto = { ...meuPerfil, tipo_usuario: tipoFinal };

        setPerfilLogado(perfilComTipoCorreto);
        
        // Admins e Proprietários podem ver a lista completa
        if (tipoFinal === 'proprietario' || tipoFinal === 'administrador') {
          const { data: lista } = await supabase.from('profiles').select('*').order('nome', { ascending: true });
          if (lista) setUsuarios(lista);
        } else {
          setUsuarios([perfilComTipoCorreto]);
        }
      }
    } catch (err) { 
        console.error("Erro ao carregar dados:", err);
    } finally { setLoading(false); }
  };

  const selecionarUsuario = (user) => {
    const souAdminOuProp = perfilLogado?.tipo_usuario === 'proprietario' || perfilLogado?.tipo_usuario === 'administrador';
    
    if (!souAdminOuProp && user.id !== perfilLogado?.id) return;
    
    setUsuarioSelecionado(user);
    setNovoNome(user.nome || '');
    setNovoEmail(user.email || '');
    
    // Abre modal administrativo se for admin/proprietário editando outra pessoa
    if (souAdminOuProp && user.id !== perfilLogado.id) {
      setIsModalOpen(true);
    }
  };

  const atualizarNome = async () => {
    const { error } = await supabase.from('profiles').update({ nome: novoNome }).eq('id', usuarioSelecionado.id);
    if (!error) {
      if (usuarioSelecionado.id === perfilLogado.id) setPerfilLogado({ ...perfilLogado, nome: novoNome });
      setUsuarios(usuarios.map(u => u.id === usuarioSelecionado.id ? { ...u, nome: novoNome } : u));
      setModal({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Nome atualizado corretamente.' });
    }
  };

  const atualizarEmail = async () => {
    if (!novoEmail.includes('@')) return setModal({ isOpen: true, type: 'warning', title: 'E-mail Inválido', message: 'Digite um e-mail real.' });

    const { error: authError } = await supabase.auth.updateUser({ email: novoEmail });
    if (authError) return setModal({ isOpen: true, type: 'error', title: 'Erro', message: authError.message });

    const { error: profileError } = await supabase.from('profiles').update({ email: novoEmail }).eq('id', usuarioSelecionado.id);
    if (!profileError) {
      if (usuarioSelecionado.id === perfilLogado.id) setPerfilLogado({ ...perfilLogado, email: novoEmail });
      setUsuarios(usuarios.map(u => u.id === usuarioSelecionado.id ? { ...u, email: novoEmail } : u));
      setModal({ isOpen: true, type: 'success', title: 'E-mail Alterado', message: 'Verifique sua caixa de entrada para confirmar.' });
    }
  };

  const atualizarSenha = async () => {
    if (novaSenha.length < 6) return setModal({ isOpen: true, type: 'warning', title: 'Senha Curta', message: 'Mínimo 6 caracteres.' });
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (!error) {
      setModal({ isOpen: true, type: 'success', title: '🔒 Segurança', message: 'Sua senha foi alterada com sucesso.' });
      setNovaSenha('');
    }
  };

  const excluirUsuario = async (id, nome) => {
    setModal({
      isOpen: true,
      type: 'error',
      title: 'Excluir Usuário?',
      message: `Isso removerá ${nome} permanentemente do sistema.`,
      onConfirm: async () => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (!error) {
          setUsuarios(usuarios.filter(u => u.id !== id));
          fecharSelecao();
          setModal({ isOpen: true, type: 'success', title: 'Removido', message: 'Usuário excluído com sucesso.' });
        }
      }
    });
  };

  if (loading) return <div className="container-center"><Loader2 className="animate-spin" size={48} color="#6366f1" /></div>;

  const getIconeCargo = (tipo) => {
    if (tipo === 'proprietario') return <Crown size={16} color="#eab308" />;
    if (tipo === 'administrador') return <Shield size={16} color="#6366f1" />;
    return null;
  };

  return (
    <div className="page-wrapper">
      <div className="content-container">
        
        <header className="perfil-header">
          <div className="icon-badge"><Settings size={28} color="#fff" /></div>
          <div>
            <h1 className="main-title">Gestão de Conta</h1>
            <p className="sub-title">Gerencie seus dados e níveis de acesso</p>
          </div>
        </header>

        <section style={{ marginBottom: '40px' }}>
          <div className="admin-header">
            <Users size={24} color="#0f172a" />
            <h2 className="admin-title">
              {perfilLogado?.tipo_usuario !== 'comum' ? 'Membros do Sistema' : 'Meu Perfil'}
            </h2>
            <span className="user-count-badge">
              {usuarios.length} {usuarios.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          
          <div className="user-table-wrapper">
            {usuarios.map(u => {
              const ehMeusDados = u.id === perfilLogado?.id;

              return (
                <div 
                  key={u.id} 
                  className="user-row"
                  style={{
                    borderColor: usuarioSelecionado?.id === u.id ? '#6366f1' : '#f1f5f9',
                    cursor: 'pointer'
                  }} 
                  onClick={() => selecionarUsuario(u)}
                >
                  <div className="user-avatar-container">
                    {getIconeCargo(u.tipo_usuario) || u.nome?.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="user-name">{u.nome} {ehMeusDados && " (Você)"}</div>
                    <div className="user-email">{u.email}</div>
                  </div>
                  <div className={`badge-cargo badge-${u.tipo_usuario}`}>
                    {u.tipo_usuario}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {usuarioSelecionado && usuarioSelecionado.id === perfilLogado?.id && (
          <div className="perfil-grid">
            <div className="glass-card">
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                <div className="card-header-flex"><Zap size={18} color="#6366f1" /><h3 className="card-title">Meus Dados</h3></div>
                <button onClick={fecharSelecao} className="close-btn"><X size={20} /></button>
              </div>
              
              <div className="input-group">
                <label className="premium-label">Nome Completo</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="premium-input" />
                  <button onClick={atualizarNome} className="save-action-btn"><CheckCircle2 size={18} /></button>
                </div>
              </div>

              <div className="input-group">
                <label className="premium-label">E-mail de Login</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} className="premium-input" />
                  <button onClick={atualizarEmail} className="save-action-btn"><CheckCircle2 size={18} /></button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{flex: 1, padding: '12px', background: '#f8fafc', borderRadius: '12px'}}>
                  <label className="premium-label">Nível de Acesso</label>
                  <div className={`badge-cargo badge-${perfilLogado.tipo_usuario}`} style={{display:'inline-block', marginTop:'5px'}}>
                    {perfilLogado.tipo_usuario}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="card-header-flex"><Lock size={18} color="#f43f5e" /><h3 className="card-title">Segurança</h3></div>
              <div className="input-group">
                <label className="premium-label">Nova Senha</label>
                <div className="input-wrapper">
                  <Key size={18} className="input-icon" />
                  <input type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="premium-input" />
                </div>
              </div>
              <button onClick={atualizarSenha} className="gradient-btn">Atualizar Senha</button>
            </div>
          </div>
        )}

        {isModalOpen && usuarioSelecionado && (perfilLogado?.tipo_usuario === 'proprietario' || perfilLogado?.tipo_usuario === 'administrador') && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && fecharSelecao()}>
            <div className="profile-modal-content">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'25px'}}>
                <h3 className="admin-title">Controle de Membro</h3>
                <button onClick={fecharSelecao} style={{background:'none', border:'none', cursor:'pointer', color:'#94a3b8'}}><X size={24} /></button>
              </div>
              <div className="user-row-simple">
                <div className="user-avatar-container">{getIconeCargo(usuarioSelecionado.tipo_usuario) || usuarioSelecionado.nome?.charAt(0)}</div>
                <div>
                  <div className="user-name">{usuarioSelecionado.nome}</div>
                  <div className="user-email">{usuarioSelecionado.email}</div>
                </div>
              </div>
              <div style={{marginTop: '25px'}}>
                <label className="premium-label">Alterar Nível de Acesso</label>
                <div style={{position:'relative'}}>
                  <select 
                    value={usuarioSelecionado.tipo_usuario} 
                    onChange={(e) => {
                      const novo = e.target.value;
                      // Impede que um admin mude o tipo de um proprietário
                      if (perfilLogado.tipo_usuario === 'administrador' && usuarioSelecionado.tipo_usuario === 'proprietario') {
                        return setModal({isOpen: true, type: 'error', title: 'Acesso Negado', message: 'Admins não podem alterar Proprietários.'});
                      }
                      
                      supabase.from('profiles').update({ tipo_usuario: novo }).eq('id', usuarioSelecionado.id).then(() => {
                        setUsuarios(usuarios.map(u => u.id === usuarioSelecionado.id ? { ...u, tipo_usuario: novo } : u));
                        setUsuarioSelecionado(prev => ({ ...prev, tipo_usuario: novo }));
                      });
                    }}
                    className="modal-select"
                  >
                    <option value="comum">Usuário Comum</option>
                    <option value="administrador">Administrador</option>
                    <option value="proprietario">Proprietário / Master</option>
                  </select>
                  <ChevronDown size={18} style={{position:'absolute', right:'15px', top:'50%', transform:'translateY(-50%)', color:'#6366f1', pointerEvents:'none'}} />
                </div>
              </div>
              <div style={{marginTop: '40px', display: 'flex', gap: '12px'}}>
                <button 
                  onClick={() => {
                     if (perfilLogado.tipo_usuario === 'administrador' && usuarioSelecionado.tipo_usuario === 'proprietario') {
                        return setModal({isOpen: true, type: 'error', title: 'Acesso Negado', message: 'Admins não podem excluir Proprietários.'});
                     }
                     excluirUsuario(usuarioSelecionado.id, usuarioSelecionado.nome)
                  }} 
                  className="delete-full-btn"
                >
                  <Trash2 size={18} /> Excluir Usuário
                </button>
                <button onClick={fecharSelecao} className="gradient-btn" style={{flex: 1}}>Finalizar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModalFeedback 
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
};

export default Perfil;