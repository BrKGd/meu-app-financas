import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// O '!' indica que temos a certeza que o elemento 'root' existe
const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);