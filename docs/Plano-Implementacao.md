# Plano de Implementação — relata-core

> Roteiro de execução.
> Depende de: [PRD](PRD.md), [TRD](TRD.md), [Fluxo do App](Fluxo-App.md), [UI/UX](UIUX.md), [Esquema Backend](Esquema-Backend.md).

**Data**: 2026-09-28

## 1. MVP

O que precisa existir para o produto já gerar valor/ser testável:

- Registro de projeto com token (`access`/`widget`, mesmo padrão do Annotate).
- Gravação de áudio ao vivo (com PWA) e upload de áudio já gravado.
- Transcrição com fatiamento automático (chunking) via OpenRouter Whisper, com retry por chunk.
- Geração do briefing técnico estruturado via OpenRouter LLM, como etapa desacoplada da transcrição.
- Tela de revisão/edição do briefing antes de finalizar.
- Entrega do briefing + transcrição pro Cursor via MCP remoto + REST (mesmo padrão do Annotate).
- Histórico de registros por projeto com status.

## 2. Fases seguintes

| Fase | Escopo | Prioridade | Dependências |
|---|---|---|---|
| 1 (MVP) | Gravação/upload, transcrição com chunking, geração de briefing, revisão/edição, entrega via MCP/REST, histórico | Alta | Nenhuma — é o ponto de partida |
| 2 | A decidir com o time depois de operar o MVP (candidatos já mapeados no PRD/TRD: entrada por texto colado tipo WhatsApp pulando a transcrição, edição da transcrição crua, tradução multi-idioma, fila mais robusta se o volume crescer) | A definir | Depende de uso real do MVP pra priorizar corretamente |

## 3. Marcos externos

- **Data de lançamento/demo**: não há data fixa, mas a prioridade é **alta e urgente** — já existem projetos reais bloqueados por áudio de mais de 40 minutos que a automação atual não processa, então o objetivo é ter o MVP rodando antes do próximo projeto que dependa de áudio longo.
- **Outras datas relevantes**: nenhuma registrada.

## 4. Critério de "pronto" por fase

- **Fase 1 (MVP)**: fluxo completo testado de ponta a ponta com um caso real — gravar ou subir um áudio de mais de 40 minutos, confirmar que a transcrição completa sai correta (sem perder trechos por causa do chunking), confirmar que o briefing estruturado gerado faz sentido, editar o briefing, finalizar, e confirmar que o Cursor consegue puxar esse conteúdo via MCP/REST (mesma validação que já foi feita no Annotate).
- **Fase 2**: critério a definir junto com a decisão de prioridade, depois que o time tiver usado o MVP na prática.

---

## Modo B — Plano de Melhoria (usar em vez das seções acima, quando analisando repo existente)

Não aplicável — este documento foi gerado em Modo A (projeto novo).
