#!/bin/bash
set -euo pipefail

# Runs once on first Postgres volume init.

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<-EOSQL
	DO \$\$
	BEGIN
		IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${KEYCLOAK_DB_USER}') THEN
			CREATE USER ${KEYCLOAK_DB_USER} WITH ENCRYPTED PASSWORD '${KEYCLOAK_DB_PASSWORD}';
		END IF;
	END
	\$\$;
EOSQL

exists=$(psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${KEYCLOAK_DB}'")

if [ "${exists}" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
    -c "CREATE DATABASE ${KEYCLOAK_DB} OWNER ${KEYCLOAK_DB_USER};"
fi

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${KEYCLOAK_DB}" <<-EOSQL
	GRANT ALL ON SCHEMA public TO ${KEYCLOAK_DB_USER};
EOSQL
