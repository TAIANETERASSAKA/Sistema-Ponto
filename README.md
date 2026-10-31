# Sistema de Controle de Frequência

Registro de ponto e acompanhamento da carga horária dos pesquisadores do laboratório.
O login é feito pela **Senha Única USP**, a mesma integração do sistema de empréstimo de notebooks.

- **Backend:** Node.js 22, Express 5, Sequelize, PostgreSQL 16
- **Frontend:** React 19, Vite, Tailwind CSS 4
- **Infraestrutura:** Docker Compose, com banco, API, interface web e backup diário

## Como rodar

```bash
cp .env.example .env              # preencha DB_PASS
cp back/.env.example back/.env    # preencha SESSION_SECRET, DATA_ENCRYPTION_KEY e a Senha Única
docker compose up -d --build
```

| Serviço | Endereço |
|---|---|
| Interface web | http://localhost:8090 |
| API | http://localhost:7080/api |
| Saúde da API | http://localhost:7080/api/saude |

As migrations rodam sozinhas quando a API sobe.

**Primeiro acesso:** coloque o seu Número USP em `SENHAUNICA_ADMINS`. No primeiro login você entra como administrador e
cadastra os demais usuários. **Só entra no sistema quem foi cadastrado pelo administrador.**

### Desenvolvimento sem as credenciais da USP

No `back/.env`, use `SENHAUNICA_FAKE=true` e `NODE_ENV=development`. O botão de login abre um formulário simulado.
Para gerar dados fictícios de demonstração (só funciona em um banco sem pesquisadores):

```bash
docker compose exec back node scripts/dados-demo.js
```

| Perfil | Nº USP (modo simulado) |
|---|---|
| Administrador | 1000001 |
| Coordenadora | 1000002 |
| Pesquisadores | 2000001 a 2000006 |

Para apagar tudo e recomeçar: `docker compose down -v`.

### Testes

```bash
cd back && npm install && npm test   # testes do cálculo de horas
```

## Perfis

| Perfil | O que faz |
|---|---|
| **Pesquisador** | Registra entrada e saída, define a agenda semanal, consulta o histórico, solicita ajustes e justifica ausências |
| **Coordenador** | Acompanha o painel e a frequência da equipe, avalia solicitações e emite relatórios |
| **Administrador** | Tudo o que o coordenador faz, mais: cadastra usuários e modalidades, configura regras, faz registros manuais e ajustes, fecha meses e consulta a auditoria |

Um coordenador ou administrador com modalidade cadastrada também registra o próprio ponto.

## Onde cada requisito foi atendido

| Requisito | Implementação |
|---|---|
| RF01 Cadastro de pesquisadores | Tela *Pesquisadores e usuários*. O telefone é armazenado criptografado |
| RF02 / RF03 Modalidades e carga horária | Tela *Modalidades*. As 5 modalidades do documento já vêm cadastradas (carga mensal = 4 semanas, ajustável) |
| RF04 Horários de trabalho | *Minha agenda*. O sistema recusa sobreposição e jornada abaixo do mínimo da modalidade |
| RF05 Registro de frequência | Botão de entrada/saída com o horário do servidor, que detecta se veio do celular. Registro manual autorizado pelo administrador |
| RF06 Controle automático de horas | Horas do dia, da semana e do mês, faltantes e excedentes, em tempo real (`back/src/services/calculoHoras.js`) |
| RF07 Relatório mensal | *Relatórios → Mensal*, com filtro de quem cumpriu e quem não cumpriu |
| RF08 Painel gerencial | Presença, ranking, alertas de irregularidade, baixa frequência e evolução mensal |
| RF09 Justificativas e ajustes | O pesquisador solicita; o coordenador aprova, rejeita ou pede revisão. A aprovação aplica o ajuste ou abono automaticamente |
| RF10 Notificações | Sistema interno e e-mail (com SMTP configurado): lembretes de entrada e de saída esquecida, carga insuficiente, avaliações e encerramento mensal |
| RF11 Exportação | PDF, Excel e CSV em todos os relatórios |
| RF12 Histórico e auditoria | Tela *Auditoria*: logins, alterações (com o antes e o depois), ajustes, aprovações e exportações |
| RN01 Frequência mínima | Carga semanal e mensal por modalidade |
| RN02 Validação de horários | Sem sobreposição, duplicidade, registro futuro ou jornada incompatível (garantido também por índice no banco) |
| RN03 Fechamento mensal | Automático no dia 1º, com reprocessamento manual. Relatórios de meses fechados usam o fechamento oficial |
| RN04 Tolerância de atraso | *Configurações*. Usada para identificar atrasos e ausências |
| RN05 Banco de horas | Opcional em *Configurações*. O saldo se acumula entre meses fechados |
| RNF01 Segurança | Senha Única USP (a redefinição de senha é feita pela USP), controle por perfil checado a cada requisição, logs de acesso e criptografia AES-256-GCM |
| RNF02 Disponibilidade | Containers com `restart` e *healthcheck*; sessões no banco sobrevivem a reinícios; fechamento recuperado se o servidor estava fora do ar |
| RNF03 / RNF05 Usabilidade e compatibilidade | Interface responsiva (menu em gaveta no celular), testada no Chromium |
| RNF06 Backup diário | Serviço `backup`: `pg_dump` diário em `./backups`, mantém 14 dias (`BACKUP_HORA`, `BACKUP_RETENCAO_DIAS`) |
| RNF07 LGPD | Tela *Privacidade e dados*: finalidade do tratamento e download dos próprios dados. Acesso mínimo por perfil e auditoria |

### Decisões e limitações

- **Registro que atravessa a meia-noite:** as horas contam no dia da entrada.
- **Registros longos:** um registro aberto há mais de 24 horas não pode ser fechado pelo botão; o pesquisador solicita uma correção.
- **Justificativa de ausência aprovada:** abona as horas previstas na agenda para aquele dia que não foram trabalhadas.
- **Fora do escopo desta versão:** os itens opcionais (QR Code, geolocalização e biometria), o aplicativo nativo e as integrações futuras do documento.

## Produção

- Defina `NODE_ENV=production`, `SENHAUNICA_FAKE=false` e as credenciais da Senha Única. A STI precisa cadastrar a URL de retorno
  `https://SEU_DOMINIO/api/auth/senhaunica/callback`.
- Publique atrás de HTTPS e use `COOKIE_SECURE=true`.
- **Não troque a `DATA_ENCRYPTION_KEY`** depois de cadastrar usuários; os telefones já gravados ficariam ilegíveis.
- Copie a pasta `backups/` para outro local (outro servidor ou armazenamento externo).
