import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  User, Shield, Mail, Trash2, Loader2, Crown, Users, Key, ChevronDown, 
  Settings, Zap, CheckCircle2, Lock, X, Fingerprint, Eye, EyeOff
} from 'lucide-react';
import ModalFeedback from '../components/ModalFeedback';
import '../styles/Perfil.css';

// --- Interfaces de Tipagem ---
interface PerfilUsuario {
  id: string;
  nome: string;
  email: string;
  tipo_usuario: 'proprietario' | 'administrador' | 'comum';
}

interface ModalState {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'danger';
  title: string;
  message: string;
  onConfirm?: (() => void) | null;
}

const Perfil: React.FC = () => {
  const [perfilLogado, setPerfilLogado] = useState<PerfilUsuario | null>(null);
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<PerfilUsuario | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [modal, setModal] = useState<ModalState>({ 
    isOpen: false, 
    type: 'success', 
    title: '', 
    message: '', 
    onConfirm: null 
  });

  const fecharSelecao = useCallback(() => {
    setUsuarioSelecionado(null);
    setIsModalOpen(false);
    setNovaSenha('');
    setShowPassword(false);
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: meuPerfil } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (meuPerfil) {
        const isMaster = user.email === 'gleidson.fig@gmail.com';
        const tipoFinal = isMaster ? 'proprietario' : (meuPerfil.tipo_usuario || 'comum');
        const perfilComTipoCorreto: PerfilUsuario = { ...meuPerfil, tipo_usuario: tipoFinal };

        setPerfilLogado(perfilComTipoCorreto);
        
        if (tipoFinal === 'proprietario' || tipoFinal === 'administrador') {
          const { data: lista } = await (supabase.from('profiles') as any)
            .select('*')
            .order('nome', { ascending: true });
          if (lista) setUsuarios(lista as PerfilUsuario[]);
        } else {
          setUsuarios([perfilComTipoCorreto]);
        }
      }
    } catch (err) { 
        console.error("Erro ao carregar dados:", err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const selecionarUsuario = (user: PerfilUsuario) => {
    if (!perfilLogado) return;
    const souAdminOuProp = perfilLogado.tipo_usuario === 'proprietario' || perfilLogado.tipo_usuario === 'administrador';
    
    setUsuarioSelecionado(user);
    setNovoNome(user.nome || '');
    setNovoEmail(user.email || '');
    
    // Se for admin e clicar em OUTRO usuário, abre o modal de controle
    if (souAdminOuProp && user.id !== perfilLogado.id) {
      setIsModalOpen(true);
    } 
    // Se clicar no PRÓPRIO perfil, não abre modal, foca na edição direta (lógica mantida)
  };

  const atualizarNome = async () => {
    if (!usuarioSelecionado || !perfilLogado) return;
    const { error } = await (supabase.from('profiles') as any).update({ nome: novoNome }).eq('id', usuarioSelecionado.id);
    if (!error) {
      if (usuarioSelecionado.id === perfilLogado.id) setPerfilLogado({ ...perfilLogado, nome: novoNome });
      setUsuarios(usuarios.map(u => u.id === usuarioSelecionado.id ? { ...u, nome: novoNome } : u));
      setModal({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Nome atualizado corretamente.' });
    }
  };

  const atualizarEmail = async () => {
    if (!usuarioSelecionado || !perfilLogado) return;
    if (!novoEmail.includes('@')) return setModal({ isOpen: true, type: 'warning', title: 'E-mail Inválido', message: 'Digite um e-mail real.' });

    const { error: authError } = await supabase.auth.updateUser({ email: novoEmail });
    if (authError) return setModal({ isOpen: true, type: 'error', title: 'Erro', message: authError.message });

    const { error: profileError } = await (supabase.from('profiles') as any).update({ email: novoEmail }).eq('id', usuarioSelecionado.id);
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
      setShowPassword(false);
    }
  };

  const excluirUsuario = async (id: string, nome: string) => {
    setModal({
      isOpen: true,
      type: 'danger',
      title: 'Excluir Usuário?',
      message: `Isso removerá ${nome} permanentemente do sistema.`,
      onConfirm: async () => {
        const { error } = await (supabase.from('profiles') as any).delete().eq('id', id);
        if (!error) {
          setUsuarios(usuarios.filter(u => u.id !== id));
          fecharSelecao();
          setModal({ isOpen: true, type: 'success', title: 'Removido', message: 'Usuário excluído com sucesso.' });
        }
      }
    });
  };

  if (loading) return (
    <div className="perfil-loader-container">
      <div className="loader-premium">
        <Loader2 className="animate-spin" size={48} color="#4361ee" />
        <span>Carregando ambiente seguro...</span>
      </div>
    </div>
  );

  const getIconeCargo = (tipo: string, size = 18) => {
    if (tipo === 'proprietario') return <Crown size={size} color="#eab308" />;
    if (tipo === 'administrador') return <Shield size={size} color="#4361ee" />;
    return <User size={size} color="#94a3b8" />;
  };

  return (
    <div className="page-wrapper fade-in">
      <div className="content-container">
        <header className="perfil-header-premium">
            <div className="header-icon-box"><Fingerprint size={32} color="#fff" /></div>
            <div>
              <h1 className="main-title-premium">Central de Segurança</h1>
              <p className="sub-title-premium">Gerencie sua identidade e níveis de autoridade</p>
            </div>
        </header>

        <section className="section-membros-premium">
          <div className="admin-header-premium">
            <div className="title-with-icon-premium">
              <Users size={22} className="title-icon-premium" />
              <h2 className="admin-title-premium">
                {perfilLogado?.tipo_usuario !== 'comum' ? 'Membros da Organização' : 'Minha Credencial'}
              </h2>
            </div>
            <span className="user-count-badge-premium">
              {usuarios.length} {usuarios.length === 1 ? 'membro' : 'membros'}
            </span>
          </div>
          
          <div className="user-list-wrapper-premium">
            {usuarios.map(u => {
              const ehMeusDados = u.id === perfilLogado?.id;
              const estaSelecionado = usuarioSelecionado?.id === u.id && !isModalOpen;
              return (
                <div 
                  key={u.id} 
                  className={`user-card-premium ${estaSelecionado ? 'card-active' : ''}`}
                  onClick={() => selecionarUsuario(u)}
                >
                  <div className="user-avatar-premium">
                    {getIconeCargo(u.tipo_usuario, 22)}
                  </div>
                  <div className="user-info-premium">
                    <div className="user-name-premium">{u.nome} {ehMeusDados && <span className="self-tag-premium">VOCÊ</span>}</div>
                    <div className="user-email-premium">{u.email}</div>
                  </div>
                  <div className={`badge-cargo-premium badge-${u.tipo_usuario}`}>
                    <span className="cargo-dot"></span>
                    {u.tipo_usuario}
                  </div>
                  {(perfilLogado?.tipo_usuario !== 'comum' && !ehMeusDados) && <ChevronDown size={18} className="expand-icon" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* ÁREA DE EDIÇÃO DO PRÓPRIO PERFIL (LÓGICA MANTIDA) */}
        {usuarioSelecionado && perfilLogado && usuarioSelecionado.id === perfilLogado.id && (
          <div className="perfil-edit-grid-premium fade-in">
            <div className="premium-card">
              <div className="card-header-flex-premium">
                 <h3 className="card-title-premium"><Zap size={18} color="#4361ee" /> Dados Pessoais</h3>
                 <button onClick={fecharSelecao} title='Fechar' className="close-btn-drawer"><X size={20} /></button>
              </div>
              
              <div className="card-body-premium">
                <div className="input-group-premium">
                  <label>Nome Completo</label>
                  <div className="input-wrapper-premium">
                    <User size={18} className="input-icon-premium" />
                    <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Seu nome" />
                    <button onClick={atualizarNome} className="save-btn-inside"><CheckCircle2 size={18} /></button>
                  </div>
                </div>

                <div className="input-group-premium">
                  <label>E-mail Corporativo</label>
                  <div className="input-wrapper-premium">
                    <Mail size={18} className="input-icon-premium" />
                    <input value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="seu@email.com" />
                    <button onClick={atualizarEmail} className="save-btn-inside"><CheckCircle2 size={18} /></button>
                  </div>
                </div>

                <div className="privilege-footer-premium">
                    <span>Nível de Acesso</span>
                    <div className={`badge-cargo-premium badge-${perfilLogado.tipo_usuario}`}>
                      <span className="cargo-dot"></span>
                      {perfilLogado.tipo_usuario}
                    </div>
                </div>
              </div>
            </div>

            <div className="premium-card security-card-premium">
              <div className="card-header-flex-premium">
                <h3 className="card-title-premium"><Lock size={18} color="#ef4444" /> Segurança</h3>
              </div>
              
              <div className="card-body-premium">
                <div className="input-group-premium">
                  <label>Redefinir Senha</label>
                  <div className="input-wrapper-premium">
                    <Key size={18} className="input-icon-premium" />
                    <input type={showPassword ? "text" : "password"} placeholder="Mínimo 6 dígitos" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                    <button onClick={() => setShowPassword(!showPassword)} className="save-btn-inside secondary">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button onClick={atualizarSenha} className="btn-save-premium">Atualizar Senha</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONTROLE DE MEMBRO - ESTILO DRAWER LATERAL PREMIUM */}
        {isModalOpen && usuarioSelecionado && perfilLogado && (perfilLogado.tipo_usuario !== 'comum') && (
          <div className="drawer-overlay-premium" onClick={(e) => e.target === e.currentTarget && fecharSelecao()}>
            <div className="drawer-content-premium fade-in-right">
      
              <div className="drawer-header-premium">
                <div className="title-group-premium">
                  <Settings size={20} color="#4361ee" className="spin-slow" />
                  <h3 className="drawer-title-premium">Gestão de Membro</h3>
                </div>
                <button onClick={fecharSelecao} className="close-btn-drawer"><X size={20} /></button>
              </div>

              <div className="drawer-user-summary-premium">
                <div className="large-avatar-premium">{getIconeCargo(usuarioSelecionado.tipo_usuario, 28)}</div>
                <div className="summary-info-premium">
                  <div className="summary-name">{usuarioSelecionado.nome}</div>
                  <div className="summary-email">{usuarioSelecionado.email}</div>
                </div>
              </div>

              <div className="drawer-body-premium">
                <div className="input-group-premium">
                  <label>Alterar Nível de Autoridade</label>
                  <div className="select-wrapper-premium">
                    <select 
                      value={usuarioSelecionado.tipo_usuario} 
                      onChange={(e) => {
                        const novo = e.target.value as any;
                        if (perfilLogado.tipo_usuario === 'administrador' && usuarioSelecionado.tipo_usuario === 'proprietario') {
                          return setModal({isOpen: true, type: 'error', title: 'Acesso Negado', message: 'Admins não podem alterar Proprietários.'});
                        }
                        
                        (supabase.from('profiles') as any).update({ tipo_usuario: novo }).eq('id', usuarioSelecionado.id).then(() => {
                          setUsuarios(usuarios.map(u => u.id === usuarioSelecionado.id ? { ...u, tipo_usuario: novo } : u));
                          setUsuarioSelecionado(prev => prev ? { ...prev, tipo_usuario: novo } : null);
                        });
                      }}
                      className="premium-select"
                    >
                      <option value="comum">Usuário Comum</option>
                      <option value="administrador">Administrador</option>
                      <option value="proprietario">Proprietário / Master</option>
                    </select>
                    <ChevronDown size={18} className="select-arrow-premium" />
                  </div>
                </div>

                <div className="drawer-note-premium">
                    <Shield size={22} color="#94a3b8" />
                    <p>Cuidado ao elevar níveis de acesso. Administradores podem visualizar e editar dados sensíveis da organização.</p>
                </div>
              </div>

              <div className="drawer-footer-premium">
                <button 
                  onClick={() => {
                      if (perfilLogado.tipo_usuario === 'administrador' && usuarioSelecionado.tipo_usuario === 'proprietario') {
                        return setModal({isOpen: true, type: 'error', title: 'Acesso Negado', message: 'Admins não podem excluir Proprietários.'});
                      }
                      excluirUsuario(usuarioSelecionado.id, usuarioSelecionado.nome)
                  }} 
                  className="btn-danger-premium"
                > Excluir
                </button>
                <button onClick={fecharSelecao} className="btn-save-premium flex-1">Cancelar</button>
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
        onConfirm={modal.onConfirm || undefined}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
};

const FormFields = ({ form, setForm, usuarios, perfilLogado }: any) => {
    // Componente FormFields não é mais usado na renderização direta, lógica integrada no Perfil.tsx
    return null;
};

export default Perfil;