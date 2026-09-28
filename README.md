# relata-core

Ferramenta interna da Fábrica dos Dados: grava/recebe áudio de reunião com cliente, transcreve (com fatiamento automático — sem o limite de 20min do Whisper via n8n), gera um briefing técnico estruturado e entrega isso pro Cursor (ou outra IA de codificação) consumir via MCP remoto ou REST.

Documentação completa do produto em [`docs/`](docs/) (PRD, TRD, Fluxo do App, UI/UX, Esquema Backend, Plano de Implementação) — gerada via `/project-blueprint`.

## Stack

- Monorepo pnpm — `apps/server` (Fastify + Drizzle + MCP remoto), `apps/dashboard` (Vite + React, PWA), `packages/shared-types` (zod).
- Postgres dedicado. Áudio em volume de disco (`AUDIO_STORAGE_DIR`).
- Transcrição e geração de briefing via OpenRouter (`OPENROUTER_API_KEY`).
- `ffmpeg`/`ffprobe` necessários no ambiente de execução (já incluídos na imagem Docker).

## Desenvolvimento local

```bash
pnpm install
pnpm --filter @relata-core/shared-types build
pnpm --filter @relata-core/server dev
pnpm --filter @relata-core/dashboard dev
```

Variáveis de ambiente do servidor (`apps/server`): `DATABASE_URL`, `ADMIN_TOKEN`, `OPENROUTER_API_KEY`, `WHISPER_MODEL` (padrão `openai/whisper-large-v3`), `BRIEFING_MODEL` (padrão `anthropic/claude-sonnet-4.5`), `AUDIO_STORAGE_DIR`, `AUDIO_CHUNK_SECONDS` (padrão 600), `AUDIO_RETENTION_DAYS` (padrão 60), `PORT`.

## Primeiro projeto

1. Acesse `/admin`, entre com o `ADMIN_TOKEN`, crie um projeto.
2. Abra "Configurações" do projeto pra pegar o link do painel e os comandos de conexão (Claude Code / Cursor via MCP).
3. Mande o link do painel pro time — é lá que se grava/sobe áudio e revisa o briefing antes de finalizar.
