import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Trash2 } from 'lucide-react';
import '../styles/ModalFeedback.css';

const ModalFeedback = ({ isOpen, type = 'success', title, message, onClose, onConfirm }) => {
  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle size={44} />,
    warning: <AlertTriangle size={44} />,
    error: <XCircle size={44} />,
    danger: <Trash2 size={44} /> 
  };

  return (
    <div className="modal-feedback-overlay">
      <div className={`modal-feedback-card modal-${type}`}>
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
              <button className="modal-button-primary" onClick={() => {
                onConfirm();
                // Opcional: fechar ao confirmar
                // onClose(); 
              }}>
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