# Fluxo do App — relata-core

> Como o usuário se move pelo produto.
> Fonte: [x] Entrevista com usuário  [ ] Leitura de código existente
> Depende de: [PRD](PRD.md)

**Data**: 2026-09-28

## 1. Perfis de usuário

| Perfil | Descrição | Permissões principais |
|---|---|---|
| Time (perfil único) | Qualquer pessoa do time da Fábrica dos Dados com o token do projeto | Criar/selecionar projeto, gravar ou subir áudio, acompanhar processamento, revisar e editar o briefing, finalizar/disponibilizar pro Cursor |

Sem distinção de papel na v1 (ex. "quem grava" vs "quem revisa") — a mesma pessoa costuma fazer o ciclo completo.

## 2. Jornadas principais

### Jornada: Registrar reunião e gerar briefing pro Cursor

Perfil: Time (perfil único)

1. Usuário entra no relata-core e seleciona (ou cria) o projeto do cliente — mesmo modelo de projeto/token do Annotate.
2. Usuário escolhe **gravar ao vivo** ou **subir um áudio já gravado**.
3. Ao confirmar, o processamento começa: barra de progresso visível (transcrição com chunking → geração do texto técnico estruturado). Usuário pode sair e voltar depois; o processamento continua em background.
4. Quando concluído, o briefing estruturado + a transcrição completa ficam disponíveis pra leitura.
5. Usuário lê o texto técnico estruturado e, se quiser, **edita/completa o briefing** (ex. adicionar algo que a IA de geração não considerou relevante mas o time julga importante). A transcrição crua em si não é editável (item 6 do PRD).
6. Usuário clica em **Finalizar** — o sistema marca aquele registro como pronto/disponível pra ser consumido pelo Cursor e mostra uma mensagem de sucesso.
7. (Fora deste sistema) Usuário manda pro Cursor, que consome a transcrição + briefing (via MCP/REST, mesmo padrão do Annotate) e, sob comando do usuário, monta o Deck e envia pro Aprova.

Telas envolvidas: seleção/criação de projeto, tela de gravação/upload, tela de progresso, tela de revisão/edição do briefing, confirmação de sucesso.

Fluxo de erro/exceção:
- **Falha em algum pedaço da transcrição** (chunk específico): sistema tenta novamente automaticamente algumas vezes; se persistir, marca esse pedaço como falho e segue com o resto — usuário vê claramente qual trecho falhou (por tempo/posição no áudio) em vez de a transcrição inteira travar.
- **Upload interrompido/áudio corrompido**: mensagem de erro clara, usuário pode tentar de novo sem perder o projeto/contexto já selecionado.
- **Geração do briefing estruturado falha** (erro na chamada ao LLM): transcrição completa continua disponível mesmo assim; usuário pode pedir pra gerar o briefing de novo sem re-transcrever o áudio (evita repetir trabalho já feito).
- **Usuário fecha a aba durante o processamento**: processamento continua em background no servidor; ao voltar, o registro aparece com o status atualizado (em andamento/concluído/erro), sem precisar reiniciar.

### Jornada: Consultar registros anteriores

Perfil: Time (perfil único)

1. Usuário acessa o histórico de um projeto.
2. Vê a lista de gravações/uploads anteriores com status (processando, pronto, com erro) e data.
3. Abre um registro específico pra reler a transcrição e o briefing já finalizado, ou reabrir um que ficou com erro pra tentar reprocessar.

Telas envolvidas: lista de registros do projeto, tela de detalhe (mesma tela de revisão da jornada anterior, em modo leitura quando já finalizado).
Fluxo de erro/exceção: registro com erro permanente (todas as tentativas de reprocessamento falharam) fica visível com opção de reprocessar manualmente ou reportar o problema — não desaparece silenciosamente.

## 3. Diagrama (opcional)

Não gerado nesta fase — pode ser pedido como Artifact/diagrama separado se for útil pra alinhar com o time visualmente.

---

## Gaps & Recomendações (preencher só no Modo B — análise de repo existente)

- [ ] Gap identificado:
- Recomendação:
