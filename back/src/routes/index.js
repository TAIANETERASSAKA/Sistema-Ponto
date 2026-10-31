const express = require('express');
const { exigirLogin, exigirPerfil, GESTAO } = require('../middlewares/autenticacao');
const auth = require('../controllers/authController');
const modalidades = require('../controllers/modalidadesController');
const usuarios = require('../controllers/usuariosController');
const configuracoes = require('../controllers/configuracoesController');
const horarios = require('../controllers/horariosController');
const registros = require('../controllers/registrosController');
const solicitacoes = require('../controllers/solicitacoesController');
const notificacoes = require('../controllers/notificacoesController');
const painel = require('../controllers/painelController');
const relatorios = require('../controllers/relatoriosController');
const auditoria = require('../controllers/auditoriaController');
const privacidade = require('../controllers/privacidadeController');

const router = express.Router();
const admin = exigirPerfil('ADMIN');
const gestao = exigirPerfil(...GESTAO);

// Autenticação (Senha Única USP)
router.get('/auth/senhaunica', auth.iniciarLogin);
router.get('/auth/senhaunica/callback', auth.callback);
router.get('/auth/fake', auth.formularioFake);
router.post('/auth/fake', express.urlencoded({ extended: false }), auth.loginFake);
router.get('/auth/me', exigirLogin, auth.usuarioLogado);
router.post('/auth/logout', auth.logout);

// Cadastros (Administrador)
router.get('/modalidades', exigirLogin, modalidades.listar);
router.post('/modalidades', admin, modalidades.criar);
router.put('/modalidades/:id', admin, modalidades.atualizar);
router.delete('/modalidades/:id', admin, modalidades.excluir);

router.get('/usuarios', gestao, usuarios.listar);
router.get('/usuarios/:id', gestao, usuarios.detalhar);
router.post('/usuarios', admin, usuarios.criar);
router.put('/usuarios/:id', admin, usuarios.atualizar);

router.get('/configuracoes', exigirLogin, configuracoes.obter);
router.put('/configuracoes', admin, configuracoes.atualizar);

// Agenda semanal (Pesquisador define; gestão consulta)
router.get('/horarios/minha', exigirLogin, horarios.minhaAgenda);
router.put('/horarios/minha', exigirLogin, horarios.salvarMinhaAgenda);
router.get('/horarios/usuario/:id', gestao, horarios.agendaDoUsuario);

// Registro de frequência
router.get('/registros/painel', exigirLogin, registros.meuPainel);
router.post('/registros/entrada', exigirLogin, registros.registrarEntrada);
router.post('/registros/saida', exigirLogin, registros.registrarSaida);
router.get('/registros/meus', exigirLogin, registros.meusRegistros);
router.get('/registros/usuario/:id', gestao, registros.registrosDoUsuario);
router.post('/registros/manual', admin, registros.criarManual);
router.put('/registros/:id', admin, registros.ajustar);
router.delete('/registros/:id', admin, registros.excluir);

// Justificativas e ajustes
router.get('/solicitacoes/minhas', exigirLogin, solicitacoes.minhas);
router.post('/solicitacoes', exigirLogin, solicitacoes.criar);
router.put('/solicitacoes/:id', exigirLogin, solicitacoes.editar);
router.delete('/solicitacoes/:id', exigirLogin, solicitacoes.cancelar);
router.get('/solicitacoes', gestao, solicitacoes.listar);
router.post('/solicitacoes/:id/avaliar', gestao, solicitacoes.avaliar);

// Notificações
router.get('/notificacoes', exigirLogin, notificacoes.listar);
router.post('/notificacoes/lidas', exigirLogin, notificacoes.marcarTodas);
router.post('/notificacoes/:id/lida', exigirLogin, notificacoes.marcarLida);

// Painel e relatórios (Coordenador e Administrador)
router.get('/painel', gestao, painel.painel);
router.get('/relatorios/mensal', gestao, relatorios.mensal);
router.get('/relatorios/frequencia', gestao, relatorios.frequencia);
router.get('/relatorios/modalidades', gestao, relatorios.modalidades);
router.get('/relatorios/evolucao', gestao, relatorios.evolucao);
router.get('/relatorios/fechamentos', gestao, relatorios.listarFechamentos);
router.post('/relatorios/fechamentos', admin, relatorios.fechar);

// Auditoria e LGPD
router.get('/auditoria', admin, auditoria.listar);
router.get('/privacidade/meus-dados', exigirLogin, privacidade.meusDados);

module.exports = router;
