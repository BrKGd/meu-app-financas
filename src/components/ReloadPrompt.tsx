import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="reload-prompt-container">
      {(offlineReady || needRefresh) && (
        <div className="reload-prompt">
          <div className="message">
            {offlineReady ? (
              <span>App pronto para uso offline!</span>
            ) : (
              <span>Nova versão disponível! Clique no botão para atualizar.</span>
            )}
          </div>
          {needRefresh && (
            <button className="reload-button" onClick={() => updateServiceWorker(true)}>
              Atualizar Agora
            </button>
          )}
          <button className="close-button" onClick={() => close()}>Fechar</button>
        </div>
      )}
    </div>
  )
}

export default ReloadPrompt