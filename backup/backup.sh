#!/bin/sh
# RNF06 — backup automático diário do banco de dados.
# Roda todos os dias no horário BACKUP_HORA e mantém os últimos BACKUP_RETENCAO_DIAS dias.
set -eu

HORA="${BACKUP_HORA:-02:00}"
RETENCAO="${BACKUP_RETENCAO_DIAS:-14}"
DESTINO=/backups

fazer_backup() {
  arquivo="$DESTINO/ponto-$(date +%Y-%m-%d_%H%M).sql.gz"
  if pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip > "$arquivo.tmp"; then
    mv "$arquivo.tmp" "$arquivo"
    echo "$(date '+%F %T') backup gerado: $(basename "$arquivo") ($(du -h "$arquivo" | cut -f1))"
  else
    rm -f "$arquivo.tmp"
    echo "$(date '+%F %T') ERRO ao gerar backup" >&2
  fi
  find "$DESTINO" -name 'ponto-*.sql.gz' -mtime +"$RETENCAO" -delete
}

export PGPASSWORD="$POSTGRES_PASSWORD"
mkdir -p "$DESTINO"

# Garante um backup no dia em que o serviço sobe
ls "$DESTINO"/ponto-"$(date +%Y-%m-%d)"_*.sql.gz >/dev/null 2>&1 || fazer_backup

while true; do
  agora=$(date +%s)
  alvo=$(date -d "$(date +%Y-%m-%d) $HORA" +%s 2>/dev/null || date -D '%Y-%m-%d %H:%M' -d "$(date +%Y-%m-%d) $HORA" +%s)
  [ "$alvo" -le "$agora" ] && alvo=$((alvo + 86400))
  sleep $((alvo - agora))
  fazer_backup
done
