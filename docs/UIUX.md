# UI/UX Design — relata-core

> Direção visual e de experiência.
> Fonte: [x] Entrevista com usuário  [ ] Leitura de código existente
> Depende de: [Fluxo do App](Fluxo-App.md)

**Data**: 2026-09-28

## 1. Referências e tom

- **Referência visual**: o próprio dashboard do Annotate — mesmo design system (sidebar escura, cards, tags coloridas de status, tipografia Inter, tokens de cor via CSS custom properties). Não reinventar identidade visual, reaproveitar o que já foi validado como "premium/profissional" pelo usuário.
- **Tom da marca**: sério/profissional, mesmo tom do Annotate — ferramenta interna de trabalho, não precisa de personalidade lúdica.

## 2. Plataformas-alvo

- [x] Web responsivo
- [ ] Mobile nativo (iOS/Android)
- [x] Desktop
- [x] **PWA** — as funções principais, especialmente **gravação de áudio**, precisam funcionar bem como app instalável (PWA), pra permitir gravar direto do celular durante/logo após uma reunião presencial, sem depender de abrir o navegador manualmente toda vez.

## 3. Sistema visual

- **Paleta de cores**: reaproveitar os CSS custom properties já definidos em `apps/dashboard/src/styles.css` do Annotate (mesmos tokens de cor, radius, shadow).
- **Tipografia**: Inter (mesma do Annotate).
- **Componentes centrais**:
  - Botão de gravação com timer — estados visuais claros e distintos: **parado/pronto pra gravar**, **gravando** (com timer rodando), **gravação parada/pronta pra enviar**, **enviando/transcrevendo** (barra de progresso). O usuário precisa identificar o estado atual sem ambiguidade a qualquer momento.
  - Área de upload de áudio (drag-and-drop + seleção de arquivo), como alternativa à gravação ao vivo.
  - Barra/indicador de progresso do processamento (transcrição → geração do briefing).
  - Editor de texto simples pra revisão/edição do briefing estruturado (não precisa ser rich text complexo — textarea bem formatada resolve).
  - Lista/histórico de registros por projeto com tag de status (processando, pronto, erro) — mesmo padrão visual de tags do Annotate.

## 4. Acessibilidade

- Sem requisito específico levantado (público é o próprio time interno). Manter o padrão básico razoável já usado no Annotate (contraste de cor adequado, foco visível em campos interativos) — sem exigência formal de WCAG nesta fase.

## 5. Telas principais

| Tela | Jornada relacionada | Estado (rascunho/aprovado) |
|---|---|---|
| Seleção/criação de projeto | Registrar reunião e gerar briefing | Rascunho — reaproveita padrão do Annotate |
| Gravação/upload de áudio | Registrar reunião e gerar briefing | Rascunho |
| Progresso de processamento | Registrar reunião e gerar briefing | Rascunho |
| Revisão/edição do briefing | Registrar reunião e gerar briefing | Rascunho |
| Confirmação de sucesso | Registrar reunião e gerar briefing | Rascunho |
| Histórico de registros do projeto | Consultar registros anteriores | Rascunho |
| Configurações (conectar Cursor/MCP) | — | Rascunho — reaproveita a tela "Configurações" já existente no Annotate, adaptada |

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

- [ ] Gap identificado:
- Recomendação:
