#!/usr/bin/env bash
# Invoked on the server. Never source configuration files or enable shell tracing.
set -Eeuo pipefail
umask 077

fail() { printf 'Erro: %s\n' "$*" >&2; exit 1; }
[[ $# == 4 ]] || fail 'Uso: deploy.sh APP_DIR RELEASE_ID BACKEND_IMAGE FRONTEND_IMAGE'
app_dir=$1
release_id=$2
backend_image=$3
frontend_image=$4
[[ $app_dir =~ ^/[a-zA-Z0-9_/-]+$ && $app_dir != / ]] || fail 'Diretório de deploy inválido.'
[[ $release_id =~ ^[a-f0-9]{40}$ ]] || fail 'Release deve ser o SHA completo do commit.'
for image in "$backend_image" "$frontend_image"; do
  [[ $image =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]] || fail 'A imagem precisa de um digest imutável do GHCR.'
done
for executable in docker flock gzip curl; do
  command -v "$executable" >/dev/null || fail "Comando necessário: $executable"
done

state_dir="$app_dir/.deploy"
release_dir="$state_dir/releases/$release_id"
compose_file="$release_dir/docker-compose.prod.yml"
candidate_env="$release_dir/images.env"
rollback_env="$release_dir/rollback.env"
[[ -f $app_dir/.env.prod && -f $app_dir/backend/.env.prod ]] || fail 'Arquivos .env.prod de produção não encontrados.'
[[ -f $compose_file ]] || fail 'Compose da release não encontrado.'
mkdir -p "$state_dir" "$app_dir/backups"
exec 9>"$state_dir/deploy.lock"
flock -n 9 || fail 'Já existe um deploy em andamento neste servidor.'

printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\n' "$backend_image" "$frontend_image" > "$candidate_env"
compose() {
  local images_file=$1
  shift
  docker compose --project-name finance-pro --project-directory "$app_dir" \
    --env-file "$app_dir/.env.prod" --env-file "$images_file" -f "$compose_file" "$@"
}

changed_containers=false
cleanup_registry() {
  # Only remove the temporary credentials directory created by this workflow.
  if [[ ${DOCKER_CONFIG:-} == "$state_dir"/registry-* ]]; then
    rm -f -- "$DOCKER_CONFIG/config.json"
    rmdir -- "$DOCKER_CONFIG" 2>/dev/null || true
  fi
}
on_failure() {
  local status=$?
  trap - ERR
  set +e
  if [[ $changed_containers == true && -s $rollback_env ]]; then
    printf 'A nova release falhou. Restaurando as imagens anteriores.\n' >&2
    if compose "$rollback_env" up -d --no-deps --force-recreate --pull never --wait --wait-timeout 180 backend frontend; then
      printf 'Containers anteriores restaurados. O banco não foi revertido automaticamente.\n' >&2
    else
      printf 'Rollback falhou. Verifique os containers no servidor.\n' >&2
    fi
  fi
  compose "$candidate_env" ps >&2
  exit "$status"
}
trap cleanup_registry EXIT
trap on_failure ERR

# Capture the exact running image IDs, including the first deployment from local images.
old_backend=$(docker inspect --format '{{.Image}}' finance_backend_prod 2>/dev/null || true)
old_frontend=$(docker inspect --format '{{.Image}}' finance_frontend_prod 2>/dev/null || true)
if [[ -n $old_backend && -n $old_frontend ]]; then
  printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\n' "$old_backend" "$old_frontend" > "$rollback_env"
fi

compose "$candidate_env" config --quiet
compose "$candidate_env" pull backend frontend
compose "$candidate_env" up -d --wait --wait-timeout 120 postgres

# The backup must succeed before any schema or container change.
backup_file="$app_dir/backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-$release_id.sql.gz"
compose "$candidate_env" exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' | gzip > "$backup_file"
gzip -t "$backup_file"

# Existing project uses schema.prisma, without versioned migrations.
# Destructive changes fail here; never use --accept-data-loss in automated deploys.
compose "$candidate_env" run --rm --no-deps backend ./node_modules/.bin/prisma db push --skip-generate

changed_containers=true
compose "$candidate_env" up -d --no-deps --force-recreate --wait --wait-timeout 180 backend frontend
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3100/ >/dev/null
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3100/api/ | grep -q '"message":"OK"'

if [[ -f $state_dir/current-release ]]; then
  cp "$state_dir/current-release" "$state_dir/previous-release"
fi
printf '%s\n' "$release_id" > "$state_dir/current-release.tmp"
mv "$state_dir/current-release.tmp" "$state_dir/current-release"
printf 'Deploy concluído: %s\nBackup: %s\n' "$release_id" "$backup_file"
