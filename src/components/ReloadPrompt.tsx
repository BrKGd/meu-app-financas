import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import '../styles/ReloadPrompt.css'; // Importando o novo estilo

const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('PWA registrado');
    },
    onRegisterError(error) {
      console.error('Erro no PWA', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="reload-prompt-wrapper">
      <div className="reload-prompt-badge">
        <div className="reload-prompt-message">
          {offlineReady ? (
            "🚀 App pronto para uso offline!"
          ) : (
            "✨ Nova versão disponível com melhorias!"
          )}
        </div>
        
        <div className="reload-prompt-actions">
          {needRefresh && (
            <button className="btn-update" onClick={() => updateServiceWorker(true)}>
              Atualizar
            </button>
          )}
          <button className="btn-close" onClick={close}>
            {offlineReady ? "Entendi" : "Depois"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReloadPrompt;