# Pruebas

Las pruebas del backend requieren una base PostgreSQL dedicada mediante `TEST_DATABASE_URL`. Cada test con persistencia crea su propio esquema temporal y lo elimina al terminar.

```sh
cd backend
pytest -p no:cacheprovider
```

Sin `TEST_DATABASE_URL`, las pruebas que requieren persistencia se omiten. No uses una base con datos reales como destino de pruebas.

Para la app Expo:

```sh
cd mobile
npm run typecheck
```
