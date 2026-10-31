FROM node:22-alpine

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Roda como usuário sem privilégios
USER node
EXPOSE 7080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:7080/api/saude || exit 1

# Aplica as migrations pendentes e inicia a API
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node src/server.js"]
