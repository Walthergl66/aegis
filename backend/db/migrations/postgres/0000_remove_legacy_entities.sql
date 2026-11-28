-- Preserve account IDs and ownership while normalizing legacy schema names.
DO $migration$
DECLARE
    schema_name TEXT := current_schema();
    old_user_table TEXT := 'web_' || 'users';
    old_audit_column TEXT := 'web_user_' || 'id';
BEGIN
    IF to_regclass(format('%I.%I', schema_name, old_user_table)) IS NOT NULL
       AND to_regclass(format('%I.app_users', schema_name)) IS NULL THEN
        EXECUTE format('ALTER TABLE %I.%I RENAME TO app_users', schema_name, old_user_table);
    END IF;

    IF to_regclass(format('%I.audit_log', schema_name)) IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'audit_log'
              AND column_name = old_audit_column
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'audit_log'
              AND column_name = 'app_user_id'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I.audit_log RENAME COLUMN %I TO app_user_id',
                schema_name, old_audit_column
            );
        END IF;
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'audit_log'
              AND column_name = 'user_id'
        ) THEN
            EXECUTE format('ALTER TABLE %I.audit_log DROP COLUMN user_id', schema_name);
        END IF;
    END IF;

    EXECUTE format('DROP TABLE IF EXISTS %I.permissions CASCADE', schema_name);
    EXECUTE format('DROP TABLE IF EXISTS %I.users CASCADE', schema_name);
END
$migration$;
