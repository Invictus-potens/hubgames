# Roadmap — HubGames (GameVault)

## Fase 0 — Fundação ✅ concluída
- Postgres em container + Prisma como ORM
- Sessão de login persistida no banco (`connect-pg-simple`)
- Biblioteca de jogos migrada de `localStorage` para endpoints REST (`/api/games`)
- `.env.example` e README com instruções de setup

---

## Fase 1 — Enriquecer o que já existe

1. **Achievements do Steam** ✅ concluído
   - Usar `GetPlayerAchievements` / `GetSchemaForGame` da Steam Web API
   - Mostrar progresso de conquistas por jogo na biblioteca

2. **Estatísticas / Dashboard pessoal** ✅ concluído
   - Total de horas jogadas, jogos completados
   - Gráfico de atividade recente (já temos `playtime_2weeks` da Steam, falta expor)

3. **Metadata rica via IGDB ou RAWG API** ✅ concluído
   - Gênero, sinopse, nota crítica, screenshots (hoje só há nome e capa)

4. **Busca e filtros avançados** ✅ concluído (parcial)
   - Busca por nome, filtro por gênero e ano
   - Filtro por plataforma não implementado: hoje o app só rastreia jogos Steam (via `appid`) ou cadastro manual sem campo de plataforma; ficou fora de escopo até existir suporte multiplataforma (Fase 3, item 10)

---

## Fase 2 — Social (depende da Fase 0)

5. **Reviews/avaliações pessoais**
   - Nota + comentário por jogo, visível no perfil

6. **Sistema de amigos** ✅ concluído
   - Lista de amigos com status online e jogo atual
   - Ver biblioteca de um amigo e jogos em comum

7. **Listas compartilháveis**
   - Ex.: "meus favoritos de 2026", com link público

---

## Fase 3 — Descoberta e engajamento

8. **Wishlist com alerta de preço**
   - Integração com IsThereAnyDeal ou similar

9. **Notificações de lançamentos**
   - Já existe a UI de calendário; falta notificar quando a data se aproxima

10. **Suporte multiplataforma manual**
    - Epic/GOG/Xbox/PS via entrada manual (sem OAuth público fácil pra todas)

---

## Fase 4 — Qualidade / infra

11. **Testes automatizados**
    - Jest + Supertest para rotas de auth/library/games

12. **Exportar/importar dados**
    - Backup em JSON — rede de segurança adicional

13. **CI básico**
    - Lint + testes no GitHub Actions
