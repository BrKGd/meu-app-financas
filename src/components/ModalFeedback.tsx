import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Trash2 } from 'lucide-react';
import '../styles/ModalFeedback.css';

// --- Definição de Tipos ---
export type ModalType = 'success' | 'warning' | 'error' | 'danger';

interface ModalFeedbackProps {
  isOpen: boolean;
  type?: ModalType;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void; // Opcional: se não enviado, mostra apenas o botão "Entendido"
}

const ModalFeedback: React.FC<ModalFeedbackProps> = ({ 
  isOpen, 
  type = 'success', 
  title, 
  message, 
  onClose, 
  onConfirm 
}) => {
  
  if (!isOpen) return null;

  // Mapeamento de ícones com tipagem Record para segurança
  const icons: Record<ModalType, React.ReactNode> = {
    success: <CheckCircle size={44} />,
    warning: <AlertTriangle size={44} />,
    error: <XCircle size={44} />,
    danger: <Trash2 size={44} /> 
  };

  return (
    <div className="modal-feedback-overlay" onClick={onClose}>
      {/* stopPropagation impede que o clique no card feche o modal acidentalmente */}
      <div 
        className={`modal-feedback-card modal-${type}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon-wrapper">
          {icons[type] || icons.error}
        </div>
        
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        
        <div className="modal-actions">
          {onConfirm ? (
            <>
              <button className="modal-button-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button 
                className="modal-button-primary" 
                onClick={() => {
                  onConfirm();
                  onClose(); 
                }}
              >
                Confirmar
              </button>
            </>
          ) : (
            <button className="modal-button-primary" onClick={onClose}>
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalFeedback;