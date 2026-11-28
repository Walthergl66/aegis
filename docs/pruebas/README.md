# Pruebas

Las pruebas de persistencia requieren una base PostgreSQL desechable en `TEST_DATABASE_URL`. Su nombre debe incluir `test`; cada fixture limpia únicamente los schemas y tablas de Aegis en esa base. No apuntes esta variable a una base con información real.

```sh
cd backend
pytest -p no:cacheprovider
```

Sin `TEST_DATABASE_URL`, las pruebas que requieren persistencia se omiten.

GitHub Actions reparte las pruebas PostgreSQL en tres shards paralelos. Cada shard tiene su propia base desechable y usa `pytest-split`; `backend/.test_durations` conserva los tiempos de referencia para equilibrarlos. Si cambia significativamente el conjunto de pruebas, actualiza esos tiempos ejecutando una pasada completa:

```sh
cd backend
TEST_DATABASE_URL='postgresql://usuario:clave@localhost:5432/aegis_test?sslmode=disable' \
  python -m pytest -q -p no:cacheprovider -m database \
  --store-durations --durations-path .test_durations
```

Para la app Expo:

```sh
cd mobile
npm run typecheck
```
