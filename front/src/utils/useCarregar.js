import { useCallback, useEffect, useState } from 'react';
import { mensagemErro } from '../api';

// Carrega dados da API com estados de carregamento e erro
export function useCarregar(buscar, dependencias = []) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await buscar());
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível carregar os dados.'));
    } finally {
      setCarregando(false);
    }
  }, dependencias);

  useEffect(() => { recarregar(); }, [recarregar]);
  return { dados, carregando, erro, recarregar, setDados };
}
