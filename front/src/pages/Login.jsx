import { useSearchParams } from 'react-router-dom';
import api from '../api';

const ERROS = {
  nao_cadastrado: 'Seu Número USP não está cadastrado neste sistema. Procure a coordenação do laboratório para solicitar o cadastro.',
  inativo: 'Seu cadastro está inativo. Procure a coordenação do laboratório.',
  sessao_expirada: 'Sua sessão expirou. Entre novamente.',
  login_invalido: 'Não foi possível validar o login. Tente novamente.',
  falha_usp: 'Não foi possível se comunicar com a Senha Única USP. Tente novamente em instantes.',
  falha_sessao: 'Erro ao iniciar a sessão. Tente novamente.',
  nao_configurado: 'O login pela Senha Única ainda não foi configurado no servidor.'
};

export default function Login() {
  const [params] = useSearchParams();
  const erro = params.get('erro');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Controle de Frequência</h1>
          <p className="mt-1 text-slate-500">Laboratório de Pesquisas</p>
        </div>

        {erro && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {ERROS[erro] || 'Erro ao fazer login.'}
          </div>
        )}

        <a href={`${api.defaults.baseURL}/auth/senhaunica`}
          className="block w-full rounded-lg bg-sky-700 py-3 text-center font-semibold text-white transition-colors hover:bg-sky-800">
          Entrar com Senha Única USP
        </a>

        <p className="mt-6 text-center text-xs text-slate-500">
          Você será redirecionado para a página oficial da USP. Para criar ou redefinir sua senha, acesse o{' '}
          <a href="https://uspdigital.usp.br/" target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">USP Digital</a>.
        </p>
      </div>
    </div>
  );
}
