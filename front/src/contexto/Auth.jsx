import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContexto = createContext(null);

// Mantém o usuário logado (a fonte da verdade é a sessão no servidor)
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUsuario(data.usuario);
      return data.usuario;
    } catch {
      setUsuario(null);
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  const sair = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally {
      setUsuario(null);
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const ehGestao = usuario && ['ADMIN', 'COORDENADOR'].includes(usuario.perfil);
  const registraPonto = Boolean(usuario?.modalidade_id);

  return (
    <AuthContexto.Provider value={{ usuario, carregando, recarregar, sair, ehGestao, registraPonto, ehAdmin: usuario?.perfil === 'ADMIN' }}>
      {children}
    </AuthContexto.Provider>
  );
}

export const useAuth = () => useContext(AuthContexto);
