# Esquema Backend — relata-core

> Modelagem de dados e API.
> Fonte: [x] Entrevista com usuário  [ ] Leitura de código existente
> Depende de: [TRD](TRD.md)

**Data**: 2026-09-28

## 1. Entidades principais

| Entidade | Campos-chave | Relacionamentos |
|---|---|---|
| `projects` | id, name, slug | Registro próprio do relata-core (mesmo conceito do Annotate, mas cadastro independente — bancos separados) |
| `project_tokens` | hash do token, `token_plain` (recuperável, mesmo padrão do Annotate), tipo (`widget`\|`access`) | Pertence a um `project` |
| `recordings` | id, project_id, status (`recording`\|`uploaded`\|`transcribing`\|`transcribed`\|`generating_briefing`\|`ready`\|`error`), fonte (`live`\|`upload`), duração, caminho do arquivo de áudio no volume, criado_por, criado_em, expira_em (retenção do áudio bruto — ver TRD seção 3) | Pertence a um `project`; gera um `transcript` e um `briefing` |
| `transcript_chunks` | id, recording_id, índice/posição no áudio, texto transcrito, status (`pending`\|`done`\|`failed`) | Pertence a um `recording` — permite retry por pedaço sem re-transcrever tudo |
| `transcripts` | id, recording_id, texto completo remontado (concatenação ordenada dos `transcript_chunks`) | 1:1 com `recording` |
| `briefings` | id, recording_id, texto gerado pela IA, texto final (após edição humana), status (`draft`\|`finalized`), finalizado_em | 1:1 com `recording`. Desacoplado da transcrição em si (recebe texto bruto — de áudio ou, no futuro, colado — e gera o texto estruturado; ver nota arquitetural no TRD) |
| `events` | id, recording_id, tipo, payload, criado_em | Mesmo padrão outbox do Annotate — alimenta polling de status (barra de progresso) e a entrega ao Cursor via MCP |

## 2. Autenticação e autorização

- **Método**: token por projeto (mesmo modelo do Annotate) — token `widget` (não previsto usar aqui, já que não há widget externo, mas mantém a simetria) e token `access` (usado pelo dashboard do time, pelo MCP e pelo REST). Hash SHA-256 no banco + `token_plain` recuperável via tela de Configurações, evitando o problema já resolvido no Annotate de token não-recuperável quebrar conexões existentes.
- **Níveis de permissão/papéis**: nenhum — perfil único (ver Fluxo do App), qualquer um com o token do projeto tem acesso completo àquele projeto.

## 3. Endpoints/ações principais

| Endpoint/Ação | Método | Autenticado? | Regra de negócio relevante |
|---|---|---|---|
| `POST /api/v1/recordings` | POST | access token | Cria o registro (upload de arquivo ou início de gravação ao vivo), dispara o processamento assíncrono |
| `GET /api/v1/recordings` | GET | access token | Lista registros do projeto com status — alimenta o histórico |
| `GET /api/v1/recordings/:id` | GET | access token | Detalhe: status, transcrição completa (se pronta), briefing (rascunho ou finalizado) |
| `PATCH /api/v1/recordings/:id/briefing` | PATCH | access token | Salva a edição humana do briefing (ainda como rascunho) |
| `POST /api/v1/recordings/:id/finalize` | POST | access token | Marca o briefing como finalizado — fica disponível pro Cursor puxar |
| `POST /api/v1/recordings/:id/retry` | POST | access token | Reprocessa (transcrição de chunks falhos, ou só a geração do briefing, sem re-transcrever) |
| `GET /api/v1/events?since=&wait=` | GET | access token | Long-poll — mesmo padrão do Annotate, usado pra barra de progresso em tempo quase-real |
| Tools MCP: `list_ready_briefings`, `get_briefing`, `get_transcript` | — | Bearer access token | Mesma lógica de exposição do Annotate pro Cursor puxar via MCP remoto |

## 4. Processamento assíncrono

- **Abordagem v1**: worker simples dentro do próprio processo Fastify, com fila numa tabela Postgres (mesmo padrão de outbox/eventos do Annotate) — sem Redis/BullMQ, dado o volume baixo (3-4/semana).
- **Etapas**: upload/gravação → fatiar áudio em chunks → transcrever cada chunk (OpenRouter Whisper, com retry automático por chunk) → remontar transcrição completa → gerar briefing estruturado (OpenRouter LLM) → aguardar revisão/edição humana → finalização.
- **Ponto de atenção pra escalar depois** (registrado a pedido do usuário): se o volume crescer, essa fila em tabela Postgres é o primeiro gargalo — migrar pra uma fila real (BullMQ + Redis, ou equivalente) é o próximo passo, sem precisar redesenhar as entidades acima.

## 5. Armazenamento

- **Tipo de dados**: estruturado (Postgres) para projetos, tokens, metadados de recordings, transcrições e briefings; arquivo binário (áudio) em volume de disco persistente, referenciado por caminho na tabela `recordings`.
- **Dados sensíveis**: os áudios e as transcrições contêm falas de clientes reais — retenção do áudio bruto limitada (30-90 dias, configurável) conforme decidido no TRD; transcrição e briefing (texto) mantidos indefinidamente por serem os artefatos de trabalho.
- **Volume esperado**: baixo (3-4 áudios/semana) — sem necessidade de particionamento, sharding ou otimização de escala nesta fase.

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

- [ ] Gap identificado:
- Recomendação:
