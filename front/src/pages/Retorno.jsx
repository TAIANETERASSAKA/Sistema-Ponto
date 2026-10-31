import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexto/Auth';
import { Carregando } from '../components/ui';

// Retorno da Senha Única: carrega o usuário e vai para a tela inicial do perfil
export default function Retorno() {
  const { recarregar } = useAuth();
  const navegar = useNavigate();

  useEffect(() => {
    recarregar().then(usuario => {
      if (!usuario) return navegar('/login?erro=login_invalido', { replace: true });
      navegar(usuario.modalidade_id ? '/' : '/painel', { replace: true });
    });
  }, [recarregar, navegar]);

  return <div className="min-h-screen"><Carregando texto="Entrando no sistema..." /></div>;
}
