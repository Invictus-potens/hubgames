# hubgames

registro para jogos

## Rodando localmente com Docker

1. Copie `.env.example` para `.env` e preencha `STEAM_API_KEY`, `STEAM_DOMAIN`, `SESSION_SECRET` e `POSTGRES_PASSWORD`.
2. Suba os containers:

   ```
   docker compose up --build
   ```

   O serviço `postgres` sobe primeiro; o serviço `hubgames` aguarda o banco ficar saudável, aplica as migrations do Prisma (`prisma migrate deploy`) e então inicia o servidor Express na porta 3422.
3. Acesse `http://localhost:3422`.

## Persistência

A biblioteca de jogos e os usuários são armazenados no Postgres (via Prisma). As sessões de login também ficam persistidas no banco (tabela `session`, criada automaticamente pelo `connect-pg-simple`), então o login sobrevive a restarts do container.
