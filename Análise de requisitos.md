# Rastreabilidade de requisitos: Doctor Music → Sonora

O projeto passou por mudanças a pedido dos clientes e o **Doctor Music** agora se chama **Sonora**. Este documento relaciona cada requisito levantado originalmente (`documentação.md`) ao que existe hoje no Sonora (`index_oficial.html`, `app_oficial.js`, `style_oficial.css`, `dados_oficial.json`, `README_oficial.md`) e diz se foi cumprido e como.

**Método:** leitura estática do código e dos dados. O site **não foi executado em navegador**; "cumprido" significa que o código implementa o requisito.

**Legenda**

| Símbolo | Significado |
| :-: | --- |
| ✅ | Cumprido |
| 🔄 | Cumprido de forma adaptada: o requisito original mudou de forma, e o Sonora tem um equivalente |
| ⚠️ | Cumprido em parte |
| ❌ | Sem equivalente no Sonora |

---

## 1. Resumo

| Grupo | ✅ | 🔄 | ⚠️ | ❌ | Total |
| --- | :-: | :-: | :-: | :-: | :-: |
| Requisitos funcionais (RF01–RF11) | 4 | 1 | 1 | 5 | 11 |
| Regras adicionais | 1 | 2 | 0 | 1 | 4 |
| Requisitos não funcionais | 5 | 1 | 0 | 0 | 6 |

**Leitura geral**

- A **base técnica** do Doctor Music foi preservada: HTML/CSS/JS puros, dados em JSON, persistência no `localStorage`, texto escapado, layout responsivo.
- O **núcleo de avaliação** (estrelas de 1 a 5 e comentário) foi mantido e ampliado: agora é por usuário, com média, curtidas e listas.
- O **bloco de cadastro** (RF06 a RF09) e a **página de contato** (RF10) não têm correspondente no Sonora. Se a retirada foi pedida pelos clientes, ela deve ser registrada na documentação como mudança de escopo; se não foi, são lacunas.
- A identidade visual (nome, logotipo e cores) mudou por inteiro.

---

## 2. Requisitos funcionais

| ID | Requisito original | Status | Como o Sonora trata |
| --- | --- | :-: | --- |
| RF01 | Chamar o site de "Doctor Music" e usar o logotipo | 🔄 | O nome agora é **Sonora** (`<title>`, cabeçalho, `definirTitulo()`). O logotipo virou um ícone SVG de nota musical no `index_oficial.html`. O `logo.png` do Doctor Music continua anexado, mas **nenhuma página o usa**. |
| RF02 | Ler os dados das músicas de um arquivo JSON | ✅ | `carregarDados()` faz `fetch('dados.json')` na primeira visita e depois usa o `localStorage`. O JSON cresceu para 6 coleções: `usuarios`, `artistas`, `albuns`, `musicas`, `listas`, `avaliacoes`. |
| RF03 | Avaliar de 1 a 5 estrelas cada item | ✅ | `formAvaliacao()` gera cinco botões de estrela e o envio exige nota de 1 a 5. Vale para músicas, álbuns, artistas e listas (README: RF01, RF02, RF03 e RF08). Agora cada **usuário** tem uma avaliação por item. |
| RF04 | Caixa de comentário em cada item | ✅ | Textarea opcional no mesmo formulário (até 500 caracteres, com contador). Fica na página de detalhe do item, não mais no cartão do catálogo. |
| RF05 | Listar gêneros musicais | ⚠️ | O gênero passou a ser atributo do **artista** (9 valores no JSON). Aparece como filtro "Todos os gêneros" em Músicas, Álbuns e Artistas e nas estatísticas do catálogo. Não há tela de gêneros nem gênero como item. |
| RF06 | Adicionar música | ❌ | Não existe cadastro de música. O mais próximo é adicionar músicas **já existentes** a uma lista. |
| RF07 | Adicionar gênero ou estilo | ❌ | Não existe. Gêneros só mudam editando o `dados.json`. |
| RF08 | Adicionar artista | ❌ | Não existe cadastro de artista. |
| RF09 | Adicionar banda | ❌ | O conceito de banda deixou de existir: Queen e Bob Marley & The Wailers são artistas comuns. |
| RF10 | Página de contato com os nomes dos desenvolvedores | ❌ | Não há página de contato nem link na navegação. A navegação tem Músicas, Álbuns, Artistas e Listas; o rodapé traz só a identificação acadêmica. |
| RF11 | Entregar o código-fonte | ✅ | HTML, CSS, JS e JSON entregues, com README de execução. A estrutura mudou: 4 arquivos de código, sem `contato.html`. |

### Regras adicionais da documentação original

| Regra | Status | Como o Sonora trata |
| --- | :-: | --- |
| Filtro por tipo | 🔄 | Substituído por telas separadas por tipo (Músicas, Álbuns, Artistas, Listas) e por filtro de gênero. |
| Busca por nome | ✅ | `aplicarFiltrosCatalogo()` busca por nome e artista, sem diferenciar acentos, e combina com o filtro de gênero. Há ainda ordenação por relevância, nota, nome e ano (álbuns). |
| Remover a nota ao clicar de novo na mesma estrela | 🔄 | Não desmarca ao clicar. Em troca, a avaliação pode ser **editada** ou **excluída** pelos botões "editar" e "excluir". |
| Botão para baixar o `dados.json` atualizado | ❌ | Não existe exportação. Há apenas "Restaurar dados iniciais" no rodapé. |

---

## 3. Requisitos não funcionais

| Requisito original | Status | Como o Sonora trata |
| --- | :-: | --- |
| Identidade visual: vermelho `#E4212B`, preto e branco | 🔄 | O tema agora é escuro com destaque **verde** (`--verde: #1ed76a`), "inspirado no Letterboxd" segundo o README. Tipografia Manrope e Inter no lugar de Montserrat. O vermelho só aparece como cor de erro e de curtida. |
| Simplicidade: sem framework, back-end ou build | ✅ | Mantida, e o README transforma isso em decisão de arquitetura justificada. |
| Responsividade | ✅ | `@media` em 380, 600, 640 e 720 px, com grade e carrossel adaptáveis. |
| Acessibilidade básica | ✅ | Ampliada e promovida a requisito formal (RNF02): link "Pular para o conteúdo", `:focus-visible`, `aria-label` nos botões de estrela e de curtir, `aria-live` nos avisos, `aria-expanded` no menu de perfil, `prefers-reduced-motion`. Ressalva: busca do catálogo e "Nova lista" usam só `placeholder`, sem `<label>`. |
| Persistência local | ✅ | `localStorage` com as chaves `sonora:dados`, `sonora:usuario` e `sonora:capas`. Passa a guardar também usuário ativo, listas, curtidas e cache de capas. |
| Segurança de exibição (texto escapado) | ✅ | `esc()` aplicada a todo texto digitado e a atributos. O README tem teste específico (digitar `<b>teste</b>`). |

---

## 4. O que o Sonora acrescentou

Funcionalidades que **não estavam** nos requisitos do Doctor Music e hoje fazem parte do projeto:

| Novidade | Onde |
| --- | --- |
| Usuários simulados, com troca pelo avatar do topo | `configurarPerfil()`, `trocar-usuario` |
| Avaliar álbuns e listas, além de músicas e artistas | `telaDetalhe()`, `telaLista()` |
| Média e quantidade de avaliações por item | `media()`, `resumoNota()`, selo na capa |
| Curtir avaliações | `curtir-avaliacao` |
| Avaliações populares e recentes | `blocoAvaliacoes()` |
| Listas de músicas (criar, editar, excluir, avaliar as dos outros) | `telaListas()`, `telaLista()` |
| Perfil público do usuário | `telaUsuario()` |
| Capas de discos e fotos de artistas via iTunes e Wikipédia | `buscarCapaReal()` |
| Início com destaque, carrosséis e avaliações em evidência | `telaInicio()` |

Vários desses itens correspondem a **melhorias futuras** listadas na documentação original: contas de usuário (simuladas), média de estrelas por item, editar e excluir (avaliações e listas, não itens do catálogo) e ordenação por nota ou nome. Ficaram de fora: paginação, importação de JSON, eliminação de duplicatas e testes automatizados.

---

## 5. Limitações da documentação original: situação atual

| Limitação citada | Situação no Sonora |
| --- | --- |
| Dados não compartilhados entre pessoas | **Persiste.** Cada navegador guarda seus dados no `localStorage`. |
| Perda de dados ao limpar o navegador | **Persiste.** O README trata "Restaurar dados iniciais" como o único reset. |
| Atualização manual do JSON | **Mudou.** Não há mais exportação; o JSON só é lido. |
| Duplicatas após exportar | **Não se aplica mais**, pois não há exportação. |
| Sem editar nem excluir | **Parcialmente resolvida.** Avaliações e listas podem ser editadas e excluídas; músicas, artistas e gêneros não. |
| Sem validação de repetição | **Parcialmente resolvida.** O app avisa se a música já está na lista, e há uma avaliação por usuário e item. |
| Servidor local obrigatório | **Persiste.** A tela de erro e o README explicam isso. |
| Dependência de internet para a fonte | **Ampliada.** Agora também há capas e fotos externas, com fallback por cor e inicial. |
| Sem ordenação nem paginação | **Ordenação resolvida;** paginação não. |
| Sem testes automatizados | **Persiste.** O README traz um roteiro manual de 14 passos. |
| Logotipo só em PNG | **Não se aplica**, pois o Sonora usa ícone SVG. |

---

## 6. Pendências e recomendações

1. **Registrar as mudanças de escopo.** Anotar formalmente que a identidade visual, o cadastro de itens (RF06 a RF09), a página de contato e a exportação do JSON foram substituídos ou retirados, caso tenham sido decisões dos clientes. Sem esse registro, a `documentação.md` continua descrevendo um sistema que não existe.
2. **Atualizar a `documentação.md`.** Nome, estrutura de arquivos, modelo de dados, chaves do `localStorage`, tecnologias (APIs do iTunes e da Wikipédia, fontes Manrope e Inter) e limitações.
3. **Decidir sobre RF10.** A página de contato com os nomes da equipe era requisito explícito e não foi migrada. É a lacuna mais simples de fechar.
4. **Decidir sobre o logotipo.** O `logo.png` não é usado. Ou ele sai da entrega, ou o Sonora ganha uma identidade equivalente documentada.
5. **Conferir os nomes dos arquivos.** O HTML referencia `style oficial.css` e `app oficial.js` (com espaço) e o JS busca `dados.json`. Os anexos chegaram como `style_oficial.css`, `app_oficial.js` e `dados_oficial.json`. Se forem entregues assim, a página não carrega.
6. **Ressalvas funcionais do Sonora**, vistas na análise anterior: curtir a própria avaliação ainda é possível nas telas de perfil e início; o início não tem bloco de recentes em geral; e a regra de não avaliar a própria lista existe só na interface.
7. **Executar o roteiro de testes do README** em um navegador antes da entrega.
