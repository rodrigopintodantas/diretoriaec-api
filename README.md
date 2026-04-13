# base-api

Projeto base de backend com:

- Express
- Sequelize
- PostgreSQL
- Docker Dev Container
- Login com JWT

## Subir banco (docker)

```bash
docker compose -f .devcontainer/docker-compose.yml up -d postgres
```

## Configurar ambiente

Copie `.env.example` para `.env` e ajuste se necessario.

## Rodar migrations e seed

```bash
npm run db:migrate
npm run db:seed
```

## Iniciar API

```bash
npm run dev
```

## Endpoints principais

- `GET /api/status`
- `POST /api/auth/login`
- `GET /api/auth/perfil` (Bearer token)

## Usuario inicial

- login: `admin`
- senha: `admin123`
