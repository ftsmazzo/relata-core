# TRD — relata-core

> Technical Requirements Document — traduz o PRD em decisões técnicas.
> Fonte: [x] Entrevista com usuário  [ ] Leitura de código existente
> Depende de: [PRD](PRD.md)

**Data**: 2026-09-28

## 1. Stack tecnológica

| Camada | Tecnologia | Motivo/restrição |
|---|---|---|
| Frontend (dashboard) | Vite + React (SPA estática, servida pelo próprio backend) | Mesmo padrão já validado em produção no Annotate — evita reaprender um novo stack de UI |
| Backend | Node.js 20 + TypeScript, Fastify | Mesmo padrão do Annotate; Fastify dá acesso a `request.raw`/`reply.raw`, útil se precisarmos de streaming de upload de áudio grande |
| Banco de dados | PostgreSQL + Drizzle ORM | Mesmo padrão do Annotate (evita fricção de binary engine tipo Prisma) |
| Armazenamento de áudio | Volume de disco persistente no próprio serviço Easypanel (sem S3/MinIO na v1) | Volume baixo (3-4 áudios/semana) não justifica infra de object storage; ver retenção na seção 3 |
| Infra/Deploy | Easypanel (VPS já usada), projeto e banco **dedicados** (não reaproveitar `postgres-core` nem o banco do Annotate) | Mesmo padrão do Annotate — nunca compartilhar banco entre projetos |

**Sugestão registrada, não decisão travada**: se o volume de áudio crescer muito (uso diário/alto volume), migrar o armazenamento de áudio pra um object storage (ex. MinIO self-hosted) é o próximo passo natural — não precisa disso na v1.

**Ponto de atenção arquitetural (do usuário)**: no futuro, o time quer poder colar uma conversa de texto (ex. WhatsApp) e gerar o mesmo briefing estruturado, sem precisar de áudio. Por isso a geração do briefing deve ser projetada como uma etapa **desacoplada** da transcrição — ela recebe texto bruto (venha de onde vier: transcrição de áudio ou texto colado) e devolve o texto técnico estruturado. Isso evita que a v1 (só áudio) precise ser refeita quando essa entrada por texto for adicionada depois.

## 2. Integrações externas

| Integração | Finalidade | Observações |
|---|---|---|
| OpenRouter — Whisper | Transcrição de áudio | Cada áudio é fatiado em pedaços (chunking) antes de enviar, pra não esbarrar em limite de duração/tamanho por chamada; pedaços são transcritos e a transcrição completa é remontada na ordem certa |
| OpenRouter — modelo de texto (LLM) | Gerar o texto técnico estruturado a partir da transcrição crua | **Sugestão**: modelo configurável via variável de ambiente, começando com um modelo forte de instrução (ex. Claude Sonnet ou GPT-4o via OpenRouter) — como o volume é baixo (3-4/semana), custo por chamada não é o fator limitante, qualidade do briefing é mais importante |
| Cursor (Skill existente) | Consome a transcrição + briefing estruturado pra montar o Deck e mandar pro Aprova | Mesmo padrão de entrega do Annotate: MCP remoto (HTTP) + REST/webhook de fallback, autenticado por token de projeto. **Sem integração direta com o Aprova** — o envio ao Aprova continua sendo comandado manualmente pelo usuário através do Cursor, isso já funciona e está fora do escopo do relata-core |

## 3. Requisitos não-funcionais

- **Performance**: sem exigência de tempo real; transcrição + geração de briefing pode ser assíncrona (o usuário grava/envia e volta depois pra pegar o resultado pronto). Volume baixo (3-4/semana) dispensa fila robusta (Redis/BullMQ) — um processamento em background simples, acompanhado via polling na mesma tabela de eventos (padrão outbox já usado no Annotate), é suficiente.
- **Escalabilidade**: volume esperado é baixo (3-4 áudios/semana, uso só pelo time interno) — não é um requisito de escala nesta fase.
- **Segurança**: mesmo modelo de token por projeto do Annotate (token `widget` vs `access`, hash no banco) — acesso restrito ao time, sem contas individuais na v1.
- **Compliance (LGPD)**: áudios contêm dados de clientes reais. **Sugestão de mitigação mínima pra v1** (não travada, revisar com o usuário): manter o arquivo de áudio bruto por um período curto e configurável (ex. 30-90 dias) só pro time conseguir reprocessar/conferir se necessário, e depois descartar automaticamente — mantendo a transcrição e o briefing estruturado (texto, sem o áudio) indefinidamente, já que são os artefatos realmente usados no fluxo. Isso reduz a superfície de dado sensível armazenado sem travar o MVP numa política formal de LGPD ainda não definida. Fica registrado como pendência de revisão (mesmo risco já anotado no PRD).
- **Disponibilidade**: sem SLA formal — mesma tolerância do Annotate (ferramenta interna, não client-facing).
- **Internacionalização/idiomas**: fora de escopo (ver PRD).

## 4. Ambiente e deploy

- **Onde roda**: Easypanel (mesma VPS do Annotate e do Aprova).
- **Provedor**: Easypanel, projeto `relata-core` próprio, com Postgres dedicado (nunca reaproveitar banco de outro projeto).
- **CI/CD**: deploy automático via GitHub → Easypanel (`autoDeploy: true`), mesmo padrão do Annotate — push na branch principal dispara rebuild.

## 5. Restrições herdadas

- **Sistemas legados a integrar**: nenhum de fato — a troca da automação n8n+Whisper é justamente o problema que este projeto substitui, não algo a integrar.
- **Decisões técnicas já tomadas e não-negociáveis**: transcrição via OpenRouter (Whisper); modelo de projeto/token igual ao Annotate; sem integração direta código-a-código com o Aprova (fluxo permanece manual via Cursor).

## 6. Manutenção

- **Quem mantém o código após o lançamento**: mesmo time que mantém o Annotate hoje (Fábrica dos Dados, com apoio de Cursor/Claude Code).
- **Nível de complexidade aceitável dado quem mantém**: baixo/médio — repetir deliberadamente os padrões já testados do Annotate (Fastify, Drizzle, MCP remoto) em vez de introduzir stack nova, pra manter a curva de manutenção previsível.

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

- [ ] Gap identificado:
- Recomendação:
