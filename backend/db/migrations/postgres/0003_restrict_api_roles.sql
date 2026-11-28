-- Supabase REST roles must not read or mutate private application schemas.
-- Plain PostgreSQL installations may not define these roles, so detect them
-- before issuing role-specific REVOKE statements.
DO $migration$
DECLARE
    role_name TEXT;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format(
                'REVOKE ALL ON SCHEMA identity, integrations, app, backups, audit FROM %I',
                role_name
            );
            EXECUTE format(
                'REVOKE ALL ON ALL TABLES IN SCHEMA identity, integrations, app, backups, audit FROM %I',
                role_name
            );
            EXECUTE format(
                'REVOKE ALL ON ALL SEQUENCES IN SCHEMA identity, integrations, app, backups, audit FROM %I',
                role_name
            );
            EXECUTE format(
                'REVOKE ALL ON TABLE public.schema_migrations FROM %I',
                role_name
            );
        END IF;
    END LOOP;
END
$migration$;
