import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:7080/api',
  withCredentials: true
});

// Sessão expirada: volta para o login
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const rotaAuth = erro.config?.url?.startsWith('/auth');
    if (erro.response?.status === 401 && !rotaAuth && window.location.pathname !== '/login') {
      window.location.href = '/login?erro=sessao_expirada';
    }
    return Promise.reject(erro);
  }
);

// Mensagem amigável a partir de um erro da API
export function mensagemErro(erro, padrao = 'Não foi possível concluir a operação.') {
  if (!erro.response) return 'Sem conexão com o servidor. Verifique sua internet.';
  return erro.response.data?.message || padrao;
}

// Baixa um arquivo (relatório) mantendo a sessão
export async function baixarArquivo(url, params) {
  const resposta = await api.get(url, { params, responseType: 'blob' });
  const nome = /filename="([^"]+)"/.exec(resposta.headers['content-disposition'] || '')?.[1] || 'arquivo';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(resposta.data);
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default api;
