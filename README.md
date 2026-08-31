# HomeServer Toy App

A deliberately tiny frontend/backend repository for testing the HomeServer control plane.

- The responsive frontend calls the backend through relative URLs so it also works behind a route prefix.
- The backend exposes `GET /api/message` and returns the text displayed by the page.
- A username form writes to an attached PostgreSQL database.
- A raw file upload writes to an attached read/write storage sandbox.
- A single smoke-test action performs real write/read checks against PostgreSQL, MongoDB, Redis, pgvector, and Neo4j.
- `GET /health` is reserved for the container health check.
- The relative browser URL makes the app compatible with HomeServer's `/apps/{slug}/` prefix routing.

## Local container check

```sh
docker compose -f docker-compose.smoke.yml up -d --build
```

Open `http://127.0.0.1:18081`.

The compose stack uses the same default database images as HomeServer and persists each engine in a named volume. Use the page's **Run all database tests** button to exercise relational queries, document storage, key/value storage, vector similarity, and graph traversal.

## Unit tests

```sh
npm test
```

The unit tests cover username normalization/limits, upload filename sanitization, and the five integration declarations. The Compose smoke test covers the actual database drivers and queries.

## Deploy through HomeServer

1. Push this repository's `main` branch to an HTTPS or SSH Git URL.
2. In HomeServer, register the URL with manifest path `control-plane.yml`.
3. Registration automatically queues the first deployment.
4. Open `/apps/home-server-toy-app/` after the deployment succeeds.
