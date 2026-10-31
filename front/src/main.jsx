import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexto/Auth';
import { AvisoProvider } from './contexto/Aviso';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AvisoProvider>
          <App />
        </AvisoProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
