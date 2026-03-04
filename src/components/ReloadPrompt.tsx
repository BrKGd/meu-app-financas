import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import '../styles/ReloadPrompt.css'; 

const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('PWA registrado com sucesso');
    },
    onRegisterError(error: any) {
      console.error('Erro no registro do PWA', error);
    },
  });

  // Fecha o alerta automaticamente após 5 segundos se for apenas aviso de Offline
  useEffect(() => {
    if (offlineReady) {
      const timer = setTimeout(() => {
        setOfflineReady(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [offlineReady, setOfflineReady]);

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