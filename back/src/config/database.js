require('dotenv').config({ quiet: true });

const base = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'ponto',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  logging: false,
  define: { underscored: true }
};

module.exports = {
  development: base,
  test: base,
  production: base
};
