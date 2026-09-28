# PRD — relata-core

> Product Requirements Document — o quê e por quê, não como.
> Fonte: [x] Entrevista com usuário  [ ] Leitura de código existente

**Data**: 2026-09-28
**Responsável**: Fábrica dos Dados

## 1. Resumo em uma frase

Ferramenta interna que transforma áudio de reuniões com clientes (gravado ao vivo ou enviado já pronto) em transcrição completa e um briefing técnico estruturado, prontos para a Skill do Cursor gerar o Deck e enviar pro Aprova.

## 2. Problema e contexto

- **Problema real que motiva o projeto**: a automação atual (n8n + Whisper) trava em 20 minutos de áudio, não fatia áudios mais longos, e entrega só a transcrição crua — sem estrutura. O time perde tempo reescrevendo isso manualmente antes de repassar a demanda pra IA.
- **Como é resolvido hoje**: automação n8n + Whisper (limitada a ~20min, sem chunking) + retrabalho manual do time pra estruturar a demanda antes de mandar pro Cursor.
- **Por que agora**: já existem pelo menos 2 projetos reais com áudios de mais de 40 minutos que a automação atual simplesmente não processa — é um bloqueio recorrente, não hipotético.

## 3. Público-alvo

- **Persona principal**: o próprio time da Fábrica dos Dados que participa/grava reuniões com clientes.
- **Outros perfis de usuário relevantes**: nenhum — o cliente final **nunca** acessa essa ferramenta diretamente (mesmo modelo de acesso restrito por token do Annotate, sem conta individual).

## 4. Objetivos e métricas de sucesso

| Objetivo | Métrica | Meta |
|---|---|---|
| Reduzir tempo entre reunião e demanda pronta pra IA | Tempo entre fim da reunião e briefing técnico disponível pro Cursor | Cair de X (hoje, manual) para Y — baseline e meta exatos a definir com o time após uso real |
| Eliminar perda de áudios longos | % de áudios acima de 20min transcritos com sucesso (hoje falha) | 100% |
| Reduzir retrabalho do Cursor por briefing mal estruturado | Nº de idas-e-voltas do Cursor pedindo esclarecimento sobre a demanda | Redução perceptível frente ao cenário atual (transcrição crua) |

## 5. Escopo

### Dentro do escopo (MVP)
- Gravação de áudio ao vivo, direto na ferramenta, durante/logo após a reunião.
- Upload de áudio já gravado (sem limite prático de duração).
- Transcrição com fatiamento automático (chunking) — sem o limite de 20min do Whisper via n8n.
- Geração de um texto técnico estruturado a partir da transcrição crua (briefing pronto pra IA agir, não só a transcrição literal).
- Registro/tagueamento por projeto, no mesmo padrão de "projeto + token" já usado no Annotate.
- Entrega organizada da transcrição + briefing de forma consumível pela Skill do Cursor que já gera o Deck pro Aprova (mecanismo exato — API/MCP — a definir no TRD).

### Fora do escopo (por enquanto)
- Acesso direto do cliente à ferramenta.
- Tradução multi-idioma.
- Edição manual da **transcrição crua** pela interface (o texto literal do que foi falado não é editável).
- Política formal de retenção/anonimização de dados sensíveis (LGPD) — acesso fica restrito ao time por ora; ver risco na seção 8.

> Nota da Fase 3 (Fluxo do App): editar a transcrição crua continua fora de escopo, mas **editar o texto técnico estruturado (briefing) antes de finalizar** entrou como parte do MVP — é a etapa de revisão humana antes de enviar pro Cursor.

## 6. Funcionalidades principais

| Funcionalidade | Prioridade (MVP/depois) | Descrição curta |
|---|---|---|
| Gravação de áudio ao vivo | MVP | Gravar direto no navegador durante/após a reunião com cliente |
| Upload de áudio pré-gravado | MVP | Anexar arquivo de áudio já gravado, incluindo os de +40min |
| Transcrição com fatiamento automático | MVP | Quebra áudio longo em pedaços, transcreve cada um e reconstitui o texto completo |
| Geração de texto técnico estruturado | MVP | A partir da transcrição crua, gera um briefing organizado e pronto pra IA agir |
| Registro/tagueamento por projeto | MVP | Mesmo modelo de projeto/token do Annotate |
| Entrega pro Cursor (Skill existente) | MVP | Disponibiliza transcrição + briefing estruturado pra Skill do Cursor puxar e montar o Deck pro Aprova |
| Edição do briefing estruturado antes de finalizar | MVP | Revisão humana: ajustar/completar o texto técnico gerado antes de disponibilizar pro Cursor |
| Edição manual da transcrição crua na interface | Fora de escopo | Corrigir o texto literal transcrito não é permitido pela interface |
| Tradução multi-idioma | Depois | — |
| Entrada por texto colado (ex. conversa de WhatsApp) gerando o mesmo briefing estruturado, sem passar por áudio/transcrição | Depois — ponto de atenção arquitetural | Ideia levantada pelo usuário: no futuro, colar uma conversa de texto deveria poder pular a etapa de transcrição e ir direto pra geração do briefing estruturado. Não é MVP, mas o TRD já considera isso ao desenhar a geração do briefing como uma etapa desacoplada da transcrição de áudio |
| Acesso direto do cliente | Fora de escopo | Cliente nunca usa essa ferramenta diretamente |

## 7. Restrições de negócio

- **Prazo**: urgente — já há pelo menos 2 projetos reais bloqueados por áudios de mais de 40 minutos que a automação atual não processa.
- **Orçamento**: a definir (nenhuma restrição explícita levantada ainda).
- **Legais/regulatórias (ex. LGPD)**: áudios contêm falas de clientes reais (dados pessoais/comerciais). Por ora, mitigação é restringir o acesso só ao time (mesmo modelo de token do Annotate) — sem anonimização ou política formal de retenção nesta fase. Ver risco abaixo.

## 8. Riscos e premissas

- **Premissa**: o time consegue gravar/enviar os áudios de forma rotineira sem fricção alta; se a captura exigir esforço manual grande, a ferramenta não é adotada.
- **Premissa**: a Skill do Cursor que já gera o Deck consegue consumir o texto técnico estruturado que este sistema vai produzir — formato exato de entrega a validar no TRD.
- **Risco**: custo e/ou latência da transcrição de áudios longos via chunking (múltiplas chamadas de API de transcrição) pode ficar caro ou lento — validar no TRD antes de bater o MVP.
- **Risco**: dado sensível de cliente armazenado sem política formal de retenção/LGPD — aceito como pendência nesta fase, precisa de revisão futura antes de qualquer uso fora do time interno.

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

- [ ] Gap identificado:
- Recomendação:
