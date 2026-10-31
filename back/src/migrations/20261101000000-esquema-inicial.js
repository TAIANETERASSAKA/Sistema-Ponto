'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, SMALLINT, STRING, TEXT, BOOLEAN, DATE, DATEONLY, TIME, DECIMAL, JSONB, CHAR } = Sequelize;
    const agora = Sequelize.literal('CURRENT_TIMESTAMP');
    const timestamps = {
      created_at: { type: DATE, allowNull: false, defaultValue: agora },
      updated_at: { type: DATE, allowNull: false, defaultValue: agora }
    };
    const fk = (tabela, onDelete = 'RESTRICT', allowNull = false) => ({
      type: INTEGER, allowNull, references: { model: tabela, key: 'id' }, onUpdate: 'CASCADE', onDelete
    });

    // RF02 / RF03 — modalidades acadêmicas e carga horária
    await queryInterface.createTable('modalidades', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: STRING(80), allowNull: false, unique: true },
      horas_semanais: { type: DECIMAL(5, 2), allowNull: false },
      horas_mensais: { type: DECIMAL(6, 2), allowNull: false },
      regras: { type: TEXT },
      ativo: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps
    });

    // RF01 — pesquisadores e demais usuários (administradores e coordenadores)
    await queryInterface.createTable('usuarios', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      nome: { type: STRING(150), allowNull: false },
      email: { type: STRING(150), allowNull: false },
      telefone_cripto: { type: TEXT }, // RNF01 — dado pessoal criptografado
      numero_usp: { type: STRING(20), allowNull: false, unique: true },
      perfil: { type: STRING(20), allowNull: false, defaultValue: 'PESQUISADOR' },
      data_ingresso: { type: DATEONLY },
      modalidade_id: fk('modalidades', 'RESTRICT', true),
      orientador_id: fk('usuarios', 'SET NULL', true),
      ativo: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ultimo_login_em: { type: DATE },
      ...timestamps
    });

    // RN04 / RN05 — regras configuráveis (linha única)
    await queryInterface.createTable('configuracoes', {
      id: { type: INTEGER, primaryKey: true },
      tolerancia_atraso_minutos: { type: INTEGER, allowNull: false, defaultValue: 10 },
      banco_horas_ativo: { type: BOOLEAN, allowNull: false, defaultValue: false },
      lembretes_ativos: { type: BOOLEAN, allowNull: false, defaultValue: true },
      emails_ativos: { type: BOOLEAN, allowNull: false, defaultValue: true },
      percentual_frequencia_baixa: { type: INTEGER, allowNull: false, defaultValue: 75 },
      ...timestamps
    });

    // RF04 — agenda semanal planejada
    await queryInterface.createTable('horarios', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: fk('usuarios', 'CASCADE'),
      dia_semana: { type: SMALLINT, allowNull: false }, // 0 = domingo ... 6 = sábado
      hora_entrada: { type: TIME, allowNull: false },
      hora_saida: { type: TIME, allowNull: false },
      intervalo_minutos: { type: INTEGER, allowNull: false, defaultValue: 0 },
      turno: { type: STRING(10), allowNull: false },
      ...timestamps
    });

    // RF05 — registros de frequência (entrada/saída)
    await queryInterface.createTable('registros', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: fk('usuarios', 'CASCADE'),
      entrada: { type: DATE, allowNull: false },
      saida: { type: DATE },
      origem: { type: STRING(10), allowNull: false }, // WEB, MOBILE, MANUAL, AJUSTE
      ip: { type: STRING(64) },
      user_agent: { type: STRING(300) },
      observacao: { type: TEXT },
      criado_por_id: fk('usuarios', 'SET NULL', true),
      ...timestamps
    });
    await queryInterface.addIndex('registros', ['usuario_id', 'entrada'], { name: 'idx_registros_usuario_entrada' });
    // RN02 — no máximo um registro em aberto por pesquisador (impede entrada duplicada)
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX idx_registros_um_aberto ON registros (usuario_id) WHERE saida IS NULL'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE registros ADD CONSTRAINT chk_registros_saida_apos_entrada CHECK (saida IS NULL OR saida > entrada)'
    );

    // RF09 — justificativas e ajustes
    await queryInterface.createTable('solicitacoes', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: fk('usuarios', 'CASCADE'),
      tipo: { type: STRING(30), allowNull: false }, // JUSTIFICATIVA_AUSENCIA, CORRECAO_REGISTRO, INCLUSAO_HORAS
      registro_id: fk('registros', 'SET NULL', true),
      data: { type: DATEONLY, allowNull: false },
      entrada_proposta: { type: DATE },
      saida_proposta: { type: DATE },
      minutos_abonados: { type: INTEGER },
      motivo: { type: TEXT, allowNull: false },
      status: { type: STRING(15), allowNull: false, defaultValue: 'PENDENTE' },
      resposta: { type: TEXT },
      avaliado_por_id: fk('usuarios', 'SET NULL', true),
      avaliado_em: { type: DATE },
      ...timestamps
    });
    await queryInterface.addIndex('solicitacoes', ['status'], { name: 'idx_solicitacoes_status' });
    await queryInterface.addIndex('solicitacoes', ['usuario_id', 'data'], { name: 'idx_solicitacoes_usuario_data' });

    // RF10 — notificações do sistema interno
    await queryInterface.createTable('notificacoes', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: fk('usuarios', 'CASCADE'),
      tipo: { type: STRING(30), allowNull: false },
      titulo: { type: STRING(150), allowNull: false },
      mensagem: { type: TEXT, allowNull: false },
      link: { type: STRING(150) },
      chave: { type: STRING(80) }, // evita enviar o mesmo lembrete duas vezes
      lida: { type: BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps
    });
    await queryInterface.addIndex('notificacoes', ['usuario_id', 'lida'], { name: 'idx_notificacoes_usuario_lida' });
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX idx_notificacoes_chave ON notificacoes (usuario_id, chave) WHERE chave IS NOT NULL'
    );

    // RN03 — fechamento mensal consolidado
    await queryInterface.createTable('fechamentos', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      mes: { type: CHAR(7), allowNull: false, unique: true }, // AAAA-MM
      gerado_por_id: fk('usuarios', 'SET NULL', true), // nulo = gerado automaticamente
      total_pesquisadores: { type: INTEGER, allowNull: false, defaultValue: 0 },
      total_cumpriram: { type: INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps
    });
    await queryInterface.createTable('fechamento_itens', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      fechamento_id: fk('fechamentos', 'CASCADE'),
      usuario_id: fk('usuarios', 'CASCADE'),
      modalidade_nome: { type: STRING(80) },
      minutos_exigidos: { type: INTEGER, allowNull: false },
      minutos_realizados: { type: INTEGER, allowNull: false },
      minutos_abonados: { type: INTEGER, allowNull: false },
      saldo_minutos: { type: INTEGER, allowNull: false },
      saldo_banco_minutos: { type: INTEGER, allowNull: false, defaultValue: 0 },
      percentual: { type: DECIMAL(6, 2), allowNull: false },
      cumpriu: { type: BOOLEAN, allowNull: false },
      dias_trabalhados: { type: INTEGER, allowNull: false, defaultValue: 0 },
      atrasos: { type: INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps
    });
    await queryInterface.addIndex('fechamento_itens', ['fechamento_id', 'usuario_id'], { unique: true, name: 'idx_fechamento_itens_unico' });

    // RF12 — histórico e auditoria
    await queryInterface.createTable('auditorias', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: fk('usuarios', 'SET NULL', true),
      acao: { type: STRING(40), allowNull: false },
      entidade: { type: STRING(40) },
      entidade_id: { type: INTEGER },
      dados_antes: { type: JSONB },
      dados_depois: { type: JSONB },
      ip: { type: STRING(64) },
      user_agent: { type: STRING(300) },
      created_at: { type: DATE, allowNull: false, defaultValue: agora }
    });
    await queryInterface.addIndex('auditorias', ['created_at'], { name: 'idx_auditorias_data' });
    await queryInterface.addIndex('auditorias', ['acao'], { name: 'idx_auditorias_acao' });

    // Dados iniciais: modalidades do RF02 com a carga do RF03 (mensal = 4 semanas, ajustável)
    const modalidades = [
      ['Pós-doutorado', 40], ['Doutorado', 30], ['Mestrado', 20], ['Iniciação científica', 12], ['Estágio', 20]
    ];
    await queryInterface.bulkInsert('modalidades', modalidades.map(([nome, horas]) => ({
      nome, horas_semanais: horas, horas_mensais: horas * 4, ativo: true
    })));
    await queryInterface.bulkInsert('configuracoes', [{ id: 1 }]);
  },

  async down(queryInterface) {
    for (const tabela of ['auditorias', 'fechamento_itens', 'fechamentos', 'notificacoes', 'solicitacoes',
      'registros', 'horarios', 'configuracoes', 'usuarios', 'modalidades']) {
      await queryInterface.dropTable(tabela);
    }
  }
};
