const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database')[process.env.NODE_ENV || 'development'];
const { criptografar, descriptografar } = require('../utils/cripto');

const sequelize = new Sequelize(config.database, config.username, config.password, config);
const { INTEGER, SMALLINT, STRING, TEXT, BOOLEAN, DATE, DATEONLY, TIME, DECIMAL, JSONB, CHAR, VIRTUAL } = DataTypes;

const PERFIS = ['ADMIN', 'COORDENADOR', 'PESQUISADOR'];
const TURNOS = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'];
const ORIGENS = ['WEB', 'MOBILE', 'MANUAL', 'AJUSTE'];
const TIPOS_SOLICITACAO = ['JUSTIFICATIVA_AUSENCIA', 'CORRECAO_REGISTRO', 'INCLUSAO_HORAS'];
const STATUS_SOLICITACAO = ['PENDENTE', 'APROVADA', 'REJEITADA', 'REVISAO'];

// DECIMAL vem do Postgres como texto; converte para número
const decimal = (campo) => ({
  type: DECIMAL,
  allowNull: false,
  get() { const v = this.getDataValue(campo); return v === null ? null : Number(v); }
});

const Modalidade = sequelize.define('Modalidade', {
  nome: { type: STRING(80), allowNull: false, unique: true },
  horas_semanais: decimal('horas_semanais'),
  horas_mensais: decimal('horas_mensais'),
  regras: TEXT,
  ativo: { type: BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: 'modalidades' });

const Usuario = sequelize.define('Usuario', {
  nome: { type: STRING(150), allowNull: false },
  email: { type: STRING(150), allowNull: false },
  telefone_cripto: TEXT,
  // Campo virtual: criptografa ao salvar e descriptografa ao ler
  telefone: {
    type: VIRTUAL,
    get() { return descriptografar(this.getDataValue('telefone_cripto')); },
    set(valor) { this.setDataValue('telefone_cripto', criptografar(valor)); }
  },
  numero_usp: { type: STRING(20), allowNull: false, unique: true },
  perfil: { type: STRING(20), allowNull: false, defaultValue: 'PESQUISADOR', validate: { isIn: [PERFIS] } },
  data_ingresso: DATEONLY,
  modalidade_id: INTEGER,
  orientador_id: INTEGER,
  ativo: { type: BOOLEAN, allowNull: false, defaultValue: true },
  ultimo_login_em: DATE
}, {
  tableName: 'usuarios',
  defaultScope: { attributes: { exclude: ['telefone_cripto', 'telefone'] } },
  scopes: { completo: {} }
});

const Configuracao = sequelize.define('Configuracao', {
  tolerancia_atraso_minutos: { type: INTEGER, allowNull: false },
  banco_horas_ativo: { type: BOOLEAN, allowNull: false },
  lembretes_ativos: { type: BOOLEAN, allowNull: false },
  emails_ativos: { type: BOOLEAN, allowNull: false },
  percentual_frequencia_baixa: { type: INTEGER, allowNull: false }
}, { tableName: 'configuracoes' });

const Horario = sequelize.define('Horario', {
  usuario_id: { type: INTEGER, allowNull: false },
  dia_semana: { type: SMALLINT, allowNull: false },
  hora_entrada: { type: TIME, allowNull: false },
  hora_saida: { type: TIME, allowNull: false },
  intervalo_minutos: { type: INTEGER, allowNull: false, defaultValue: 0 },
  turno: { type: STRING(10), allowNull: false, validate: { isIn: [TURNOS] } }
}, { tableName: 'horarios' });

const Registro = sequelize.define('Registro', {
  usuario_id: { type: INTEGER, allowNull: false },
  entrada: { type: DATE, allowNull: false },
  saida: DATE,
  origem: { type: STRING(10), allowNull: false, validate: { isIn: [ORIGENS] } },
  ip: STRING(64),
  user_agent: STRING(300),
  observacao: TEXT,
  criado_por_id: INTEGER
}, { tableName: 'registros' });

const Solicitacao = sequelize.define('Solicitacao', {
  usuario_id: { type: INTEGER, allowNull: false },
  tipo: { type: STRING(30), allowNull: false, validate: { isIn: [TIPOS_SOLICITACAO] } },
  registro_id: INTEGER,
  data: { type: DATEONLY, allowNull: false },
  entrada_proposta: DATE,
  saida_proposta: DATE,
  minutos_abonados: INTEGER,
  motivo: { type: TEXT, allowNull: false },
  status: { type: STRING(15), allowNull: false, defaultValue: 'PENDENTE', validate: { isIn: [STATUS_SOLICITACAO] } },
  resposta: TEXT,
  avaliado_por_id: INTEGER,
  avaliado_em: DATE
}, { tableName: 'solicitacoes' });

const Notificacao = sequelize.define('Notificacao', {
  usuario_id: { type: INTEGER, allowNull: false },
  tipo: { type: STRING(30), allowNull: false },
  titulo: { type: STRING(150), allowNull: false },
  mensagem: { type: TEXT, allowNull: false },
  link: STRING(150),
  chave: STRING(80),
  lida: { type: BOOLEAN, allowNull: false, defaultValue: false }
}, { tableName: 'notificacoes' });

const Fechamento = sequelize.define('Fechamento', {
  mes: { type: CHAR(7), allowNull: false, unique: true },
  gerado_por_id: INTEGER,
  total_pesquisadores: { type: INTEGER, allowNull: false, defaultValue: 0 },
  total_cumpriram: { type: INTEGER, allowNull: false, defaultValue: 0 }
}, { tableName: 'fechamentos' });

const FechamentoItem = sequelize.define('FechamentoItem', {
  fechamento_id: { type: INTEGER, allowNull: false },
  usuario_id: { type: INTEGER, allowNull: false },
  modalidade_nome: STRING(80),
  minutos_exigidos: { type: INTEGER, allowNull: false },
  minutos_realizados: { type: INTEGER, allowNull: false },
  minutos_abonados: { type: INTEGER, allowNull: false },
  saldo_minutos: { type: INTEGER, allowNull: false },
  saldo_banco_minutos: { type: INTEGER, allowNull: false, defaultValue: 0 },
  percentual: decimal('percentual'),
  cumpriu: { type: BOOLEAN, allowNull: false },
  dias_trabalhados: { type: INTEGER, allowNull: false, defaultValue: 0 },
  atrasos: { type: INTEGER, allowNull: false, defaultValue: 0 }
}, { tableName: 'fechamento_itens' });

const Auditoria = sequelize.define('Auditoria', {
  usuario_id: INTEGER,
  acao: { type: STRING(40), allowNull: false },
  entidade: STRING(40),
  entidade_id: INTEGER,
  dados_antes: JSONB,
  dados_depois: JSONB,
  ip: STRING(64),
  user_agent: STRING(300)
}, { tableName: 'auditorias', updatedAt: false });

// Relacionamentos
Usuario.belongsTo(Modalidade, { as: 'modalidade', foreignKey: 'modalidade_id' });
Usuario.belongsTo(Usuario, { as: 'orientador', foreignKey: 'orientador_id' });
Usuario.hasMany(Horario, { as: 'horarios', foreignKey: 'usuario_id' });
Registro.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuario_id' });
Registro.belongsTo(Usuario, { as: 'criadoPor', foreignKey: 'criado_por_id' });
Solicitacao.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuario_id' });
Solicitacao.belongsTo(Usuario, { as: 'avaliadoPor', foreignKey: 'avaliado_por_id' });
Solicitacao.belongsTo(Registro, { as: 'registro', foreignKey: 'registro_id' });
Fechamento.hasMany(FechamentoItem, { as: 'itens', foreignKey: 'fechamento_id' });
FechamentoItem.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuario_id' });
Auditoria.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuario_id' });

module.exports = {
  sequelize, Sequelize,
  Modalidade, Usuario, Configuracao, Horario, Registro, Solicitacao, Notificacao, Fechamento, FechamentoItem, Auditoria,
  PERFIS, TURNOS, ORIGENS, TIPOS_SOLICITACAO, STATUS_SOLICITACAO
};
