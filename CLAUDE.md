# CLAUDE.md — relata-core

Regras do projeto para qualquer agente (Claude Code, Cursor) trabalhando neste repositório.

## O que é

Ferramenta interna: áudio de reunião → transcrição (chunked) → briefing técnico estruturado → consumido pelo Cursor via MCP/REST pra alimentar a Skill que gera o Deck e manda pro Aprova. Ver [docs/PRD.md](docs/PRD.md) e [docs/TRD.md](docs/TRD.md) pro contexto completo antes de qualquer mudança de escopo.

Parte da mesma suíte do [Annotate](https://github.com/ftsmazzo/annotate-core) — repita os padrões já validados lá (Fastify, Drizzle, token por projeto, MCP remoto) em vez de introduzir abordagens novas sem necessidade.

## Arquitetura

- `packages/shared-types` — zod schemas compartilhados. **Precisa rebuild** (`pnpm --filter @relata-core/shared-types build`) depois de qualquer edição, porque `apps/server` importa o `dist/` compilado, não o source.
- `apps/server` — Fastify. Rotas admin (`/api/v1/admin/*`, token `ADMIN_TOKEN`), rotas de projeto (`/api/v1/recordings*`, `/api/v1/events`, `/api/v1/whoami`, token `access` por projeto), MCP remoto em `/mcp` (Streamable HTTP, mesmo token `access`).
- `apps/dashboard` — Vite + React, PWA. Servido estaticamente pelo próprio `apps/server` em produção (`public/dashboard`).
- Worker de processamento (`apps/server/src/worker/process.ts`) roda **dentro do mesmo processo** do Fastify — sem fila externa (Redis/BullMQ) na v1, volume é baixo (3-4 áudios/semana). Ver TRD antes de adicionar fila real; é o próximo passo natural se o volume crescer, não antes.

## Convenções herdadas do Annotate (não reinventar)

- Token por projeto: hash SHA-256 no banco + `tokenPlain` recuperável, pra dar uma tela de "Configurações" que não invalida conexões existentes ao ser reaberta.
- MCP: nova instância de `McpServer` por request, `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`, autenticado por `Authorization: Bearer <access_token>`.
- Erros: nunca vazar texto cru de erro de banco pro cliente (`setErrorHandler` genérico).
- Body limit do Fastify: **já elevado** (300MB) pra caber áudio em base64 — não sobrescrever pra um valor menor.
- Cuidado com o bug já conhecido no Annotate: **nunca setar `content-type: application/json` num fetch sem body** — o parser do Fastify rejeita JSON declarado vazio.
- **Nunca volte a mandar o áudio inteiro numa requisição só.** O proxy reverso da VPS (Traefik) corta a conexão em ~60s — confirmado reproduzindo em produção: um POST de 21MB morreu com `499 Client Closed Request` aos 60.8s mesmo com timeout de cliente de 180s. Por isso o upload é em pedaços de 4MB (`POST /api/v1/recordings` cria o registro vazio → `POST /:id/audio-chunk` por pedaço → `POST /:id/complete-upload` fecha e dispara o processamento). Qualquer mudança nesse fluxo precisa manter cada requisição individual pequena o bastante pra nunca chegar perto de 60s numa conexão lenta.

## Segurança e dados sensíveis

- Áudios contêm falas de clientes reais. Retenção do áudio bruto é limitada (`AUDIO_RETENTION_DAYS`, padrão 60 dias) — isso é uma mitigação mínima, **não** uma política formal de LGPD. Não adicionar nenhum caminho que exponha áudio/transcrição fora do escopo do token do projeto.
- Sem contas individuais na v1 — qualquer um com o token `access` do projeto tem acesso total àquele projeto. Não implementar RBAC sem antes atualizar o PRD.

## Esteira de qualidade

- `pnpm --filter @relata-core/server build` e `pnpm --filter @relata-core/dashboard build` precisam passar antes de qualquer deploy.
- Sem suíte de testes automatizados ainda (gap conhecido, registrado no Plano de Implementação — mesma situação inicial do Annotate).
- Erros/observabilidade: se for adicionar Sentry-like, usar GlitchTip self-hosted (mesmo padrão do Annotate), nunca SaaS pago sem justificativa.

## Fluxo de trabalho

- Branch principal com deploy automático no Easypanel (`autoDeploy: true`) — cuidado ao commitar direto nela em produção real.
- Sempre validar mudança de fluxo de processamento (transcrição/briefing) com um áudio real de teste antes de considerar pronto — curl sozinho não garante que o fluxo funciona ponta a ponta (lição do Annotate: um bug só apareceu em teste real de navegador, não em curl).
