# Pruebas

Las pruebas de persistencia requieren una base PostgreSQL desechable en `TEST_DATABASE_URL`. Su nombre debe incluir `test`; cada fixture limpia únicamente los schemas y tablas de Aegis en esa base. No apuntes esta variable a una base con información real.

```sh
cd backend
pytest -p no:cacheprovider
```

Sin `TEST_DATABASE_URL`, las pruebas que requieren persistencia se omiten.

Para la app Expo:

```sh
cd mobile
npm run typecheck
```
