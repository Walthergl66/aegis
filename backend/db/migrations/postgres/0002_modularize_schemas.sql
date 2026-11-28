-- Move application data from public into private module schemas without copying rows.
DO $migration$
DECLARE
    source_schema TEXT := current_schema();
    item RECORD;
BEGIN
    CREATE SCHEMA IF NOT EXISTS identity;
    CREATE SCHEMA IF NOT EXISTS integrations;
    CREATE SCHEMA IF NOT EXISTS app;
    CREATE SCHEMA IF NOT EXISTS backups;
    CREATE SCHEMA IF NOT EXISTS audit;

    FOR item IN
        SELECT * FROM (VALUES
            ('app_users', 'identity'),
            ('refresh_sessions', 'identity'),
            ('access_token_revocations', 'identity'),
            ('accounts', 'integrations'),
            ('projects', 'app'),
            ('backup_history', 'backups'),
            ('backup_jobs', 'backups'),
            ('audit_log', 'audit')
        ) AS targets(table_name, target_schema)
    LOOP
        IF to_regclass(format('%I.%I', source_schema, item.table_name)) IS NOT NULL THEN
            IF to_regclass(format('%I.%I', item.target_schema, item.table_name)) IS NOT NULL THEN
                RAISE EXCEPTION 'No se puede mover %.%: %.% ya existe',
                    source_schema, item.table_name, item.target_schema, item.table_name;
            END IF;
            EXECUTE format(
                'ALTER TABLE %I.%I SET SCHEMA %I',
                source_schema, item.table_name, item.target_schema
            );
        END IF;
    END LOOP;
END
$migration$;

-- Schemas must not be implicitly usable by arbitrary database roles.
REVOKE ALL ON SCHEMA identity, integrations, app, backups, audit FROM PUBLIC;
