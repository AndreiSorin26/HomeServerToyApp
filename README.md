# HomeServer Toy App

A deliberately tiny frontend/backend repository for testing the HomeServer control plane.

- The frontend is a blank HTML page that calls the relative `api/message` URL.
- The backend exposes `GET /api/message` and returns the text displayed by the page.
- `GET /health` is reserved for the container health check.
- The relative browser URL makes the app compatible with HomeServer's `/apps/{slug}/` prefix routing.

## Local container check

```sh
docker build -t home-server-toy-app .
docker run --rm -p 18081:8080 home-server-toy-app
```

Open `http://127.0.0.1:18081`.

## Deploy through HomeServer

1. Push this repository's `main` branch to an HTTPS or SSH Git URL.
2. In HomeServer, register the URL with manifest path `control-plane.yml`.
3. Registration automatically queues the first deployment.
4. Open `/apps/home-server-toy-app/` after the deployment succeeds.
