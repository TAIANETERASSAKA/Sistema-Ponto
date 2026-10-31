import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexto/Auth';
import Layout from './components/Layout';
import { Carregando } from './components/ui';
import Login from './pages/Login';
import Retorno from './pages/Retorno';
import MeuPonto from './pages/MeuPonto';
import Historico from './pages/Historico';
import Agenda from './pages/Agenda';
import MinhasSolicitacoes from './pages/MinhasSolicitacoes';
import Notificacoes from './pages/Notificacoes';
import Privacidade from './pages/Privacidade';
import Painel from './pages/gestao/Painel';
import Frequencia from './pages/gestao/Frequencia';
import FrequenciaPesquisador from './pages/gestao/FrequenciaPesquisador';
import Solicitacoes from './pages/gestao/Solicitacoes';
import Relatorios from './pages/gestao/Relatorios';
import Usuarios from './pages/admin/Usuarios';
import Modalidades from './pages/admin/Modalidades';
import Configuracoes from './pages/admin/Configuracoes';
import Auditoria from './pages/admin/Auditoria';

// Libera a rota só para quem tem permissão; o backend também valida cada requisição
function Protegida({ permitido, children }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <div className="min-h-screen"><Carregando /></div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (permitido && !permitido(usuario)) return <Navigate to="/" replace />;
  return children;
}

// Tela inicial: registro de ponto para quem registra, painel para a gestão
function Inicio() {
  const { registraPonto } = useAuth();
  return registraPonto ? <MeuPonto /> : <Navigate to="/painel" replace />;
}

const pontoPermitido = (u) => Boolean(u.modalidade_id);
const gestao = (u) => ['ADMIN', 'COORDENADOR'].includes(u.perfil);
const admin = (u) => u.perfil === 'ADMIN';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/retorno" element={<Retorno />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="historico" element={<Protegida permitido={pontoPermitido}><Historico /></Protegida>} />
        <Route path="agenda" element={<Protegida permitido={pontoPermitido}><Agenda /></Protegida>} />
        <Route path="minhas-solicitacoes" element={<Protegida permitido={pontoPermitido}><MinhasSolicitacoes /></Protegida>} />
        <Route path="notificacoes" element={<Notificacoes />} />
        <Route path="privacidade" element={<Privacidade />} />

        <Route path="painel" element={<Protegida permitido={gestao}><Painel /></Protegida>} />
        <Route path="frequencia" element={<Protegida permitido={gestao}><Frequencia /></Protegida>} />
        <Route path="frequencia/:id" element={<Protegida permitido={gestao}><FrequenciaPesquisador /></Protegida>} />
        <Route path="solicitacoes" element={<Protegida permitido={gestao}><Solicitacoes /></Protegida>} />
        <Route path="relatorios" element={<Protegida permitido={gestao}><Relatorios /></Protegida>} />

        <Route path="usuarios" element={<Protegida permitido={admin}><Usuarios /></Protegida>} />
        <Route path="modalidades" element={<Protegida permitido={admin}><Modalidades /></Protegida>} />
        <Route path="configuracoes" element={<Protegida permitido={admin}><Configuracoes /></Protegida>} />
        <Route path="auditoria" element={<Protegida permitido={admin}><Auditoria /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
