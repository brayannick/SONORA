# Doctor Music – Documentação do projeto

Sep 29, 2026 · @Brayan

## Visão geral

O Doctor Music é um site no estilo "letterbox" para músicas: o usuário avalia com até 5 estrelas e comenta o que ouve, e cataloga músicas, gêneros musicais, artistas e bandas.

O projeto roda inteiramente no navegador, sem back-end, e foi construído com HTML, CSS e JavaScript puros. Os dados iniciais ficam em um arquivo `dados.json`. A identidade visual (vermelho, preto e branco) vem do logotipo enviado pela equipe.

**Objetivo:** oferecer um diário de escuta simples, onde cada item tem nota e opinião próprias.

**Público:** pessoas que gostam de música e querem registrar e comparar o que ouviram.

## Levantamento de requisitos

O sistema atende 11 requisitos funcionais e 6 não funcionais, todos vindos do pedido da equipe.

### Requisitos funcionais

| ID | Requisito | Onde é atendido |
| --- | --- | --- |
| RF01 | Chamar o site de "Doctor Music" e usar o logotipo fornecido | `index.html`, `contato.html`, `logo.png` |
| RF02 | Ler os dados das músicas de um arquivo JSON | `dados.json`, `app.js` |
| RF03 | Dar uma avaliação de 1 a 5 estrelas a cada item | `app.js` (botões de estrela) |
| RF04 | Ter uma caixa de texto de comentário em cada item | `app.js` (textarea por cartão) |
| RF05 | Listar gêneros musicais | `dados.json` (10 gêneros) |
| RF06 | Adicionar música | Formulário em `index.html` |
| RF07 | Adicionar gênero ou estilo musical | Formulário em `index.html` |
| RF08 | Adicionar artista | Formulário em `index.html` |
| RF09 | Adicionar banda | Formulário em `index.html` |
| RF10 | Ter página de contato com os nomes dos desenvolvedores | `contato.html` |
| RF11 | Entregar o código-fonte dos arquivos | Pasta `doctor-music/` |

Regras adicionais implementadas: filtro por tipo, busca por nome, remoção da nota ao clicar de novo na mesma estrela e botão para baixar o `dados.json` atualizado.

### Requisitos não funcionais

- **Identidade visual:** cores do logotipo (vermelho `#E4212B`, preto e branco).
- **Simplicidade:** sem framework, sem back-end e sem etapa de build.
- **Responsividade:** o layout se adapta de celular a desktop.
- **Acessibilidade básica:** foco visível no teclado, rótulos nos campos e botões de estrela com texto para leitor de tela.
- **Persistência local:** notas, comentários e itens novos sobrevivem ao recarregar a página.
- **Segurança de exibição:** todo texto digitado é escapado antes de ir para o HTML.

## Estruturação

O projeto tem 6 arquivos numa única pasta, cada um com uma função: páginas, estilo, lógica, dados e logotipo.

```text
doctor-music/
├── index.html     catálogo, filtros, busca e formulário de cadastro
├── contato.html   página de contato com a equipe
├── style.css      estilos das duas páginas
├── app.js         lógica do catálogo (só usada em index.html)
├── dados.json     dados iniciais dos itens
└── logo.png       logotipo recortado da imagem enviada
```

### Modelo de dados (`dados.json`)

O arquivo tem uma lista `itens`. Todo item, de qualquer tipo, usa os mesmos campos:

| Campo | Conteúdo | Exemplo |
| --- | --- | --- |
| `id` | Identificador único do item | `m1` |
| `tipo` | `musica`, `genero`, `artista` ou `banda` | `musica` |
| `nome` | Nome exibido | `Bohemian Rhapsody` |
| `detalhe` | Artista ou banda (música) ou descrição (demais tipos) | `Queen` |
| `genero` | Gênero do item; vazio quando o tipo é `genero` | `Rock` |
| `nota` | Estrelas de 0 a 5 | `0` |
| `comentario` | Texto da opinião | `""` |

O arquivo inicial traz 18 itens: 10 gêneros, 4 músicas, 2 artistas e 2 bandas.

### Como o `app.js` funciona

1. Lê o `dados.json` com `fetch` e guarda a lista base.
2. Lê do `localStorage` (chave `doctormusic:v1`) as alterações do usuário: `edits` (nota e comentário por `id`) e `novos` (itens cadastrados).
3. Junta base, novos e edições numa lista única e desenha os cartões, aplicando filtro por tipo e busca.
4. Ao clicar numa estrela ou digitar um comentário, grava em `edits` e atualiza só aquele cartão.
5. Ao enviar o formulário, cria o item em `novos`. Se for um gênero, ele passa a aparecer no seletor de gênero.
6. O botão de exportar baixa a lista completa como um novo `dados.json`.

## Tecnologias

O projeto usa só tecnologias nativas do navegador, mais uma fonte externa opcional.

| Tecnologia | Uso no projeto | Motivo da escolha |
| --- | --- | --- |
| HTML5 | Estrutura das páginas `index.html` e `contato.html` | Semântica e acessibilidade sem dependências |
| CSS3 | Layout com grid e flexbox, variáveis de cor, responsividade | Paleta do logotipo centralizada em variáveis |
| JavaScript (ES6+) | Renderização, filtros, avaliação, cadastro e exportação | Sem framework nem etapa de build |
| JSON | Base de dados inicial em `dados.json` | Formato simples de editar e trocar |
| `fetch` API | Carregar o `dados.json` | Nativa do navegador |
| `localStorage` | Guardar notas, comentários e itens novos | Persistência sem servidor |
| Blob e download por link | Exportar o `dados.json` atualizado | Único jeito de gerar arquivo sem back-end |
| Google Fonts (Montserrat) | Tipografia, próxima à do logotipo | Carrega da internet; se falhar, o site usa Arial |
| Python `http.server` | Servir a pasta localmente durante o desenvolvimento | Já vem com o Python; qualquer servidor estático serve |

## Como executar

O site precisa ser aberto por um servidor local, porque o navegador bloqueia a leitura do `dados.json` quando o `index.html` é aberto com dois cliques.

1. Abra um terminal dentro da pasta `doctor-music/`.
2. Rode `python -m http.server 8000`.
3. Acesse `http://localhost:8000` no navegador.
4. Filtre por tipo, dê estrelas, escreva comentários e cadastre itens pelo formulário.
5. Para gravar as mudanças no projeto, clique em "Baixar dados.json atualizado" e substitua o arquivo da pasta (veja a limitação sobre itens duplicados).

## Limitações

Como o projeto não tem back-end, os dados de cada pessoa ficam presos ao navegador dela, e o `dados.json` só muda por substituição manual.

- **Dados não compartilhados:** notas, comentários e itens novos ficam no `localStorage` de cada navegador e dispositivo. Não há contas de usuário, então duas pessoas não veem as avaliações uma da outra.
- **Perda de dados:** limpar os dados do navegador apaga tudo que não foi exportado. O `localStorage` também tem limite de espaço (cerca de 5 MB na maioria dos navegadores).
- **Atualização manual do JSON:** o navegador não grava em arquivos do projeto. É preciso baixar o `dados.json` e substituir o original.
- **Duplicatas após exportar:** o arquivo exportado já contém os itens novos. Se ele substituir o original sem limpar o `localStorage`, esses itens aparecem duas vezes. Hoje a aplicação não elimina duplicatas ao carregar.
- **Sem editar nem excluir itens:** só é possível adicionar. Nome, detalhe e gênero de um item não podem ser alterados depois de criados.
- **Sem validação de repetição:** o formulário aceita dois itens com o mesmo nome.
- **Servidor obrigatório:** abrir o `index.html` direto do disco não carrega o `dados.json`.
- **Dependência de internet para a fonte:** sem conexão, o site usa Arial no lugar da Montserrat.
- **Sem ordenação nem paginação:** todos os itens do filtro aparecem de uma vez, na ordem do arquivo.
- **Testes:** não há testes automatizados. O JSON e a sintaxe do JavaScript foram validados, mas o site não foi testado em navegadores diferentes.
- **Logotipo em imagem:** o `logo.png` é um recorte da imagem enviada, sem versão vetorial, e pode perder nitidez em tamanhos grandes.

## Melhorias futuras e equipe

A melhoria de maior efeito seria trocar o `localStorage` por um back-end com banco de dados, o que resolveria de uma vez os dados não compartilhados, a perda de dados e a atualização manual do JSON.

- Contas de usuário, para que cada pessoa tenha suas avaliações.
- Média de estrelas por item, calculada com as notas de todos os usuários.
- Editar e excluir itens, e impedir nomes repetidos.
- Eliminar duplicatas por `id` ao carregar os dados.
- Ordenar por nota ou por nome, e paginar a lista.
- Importar um `dados.json` pelo próprio site.
- Testes automatizados e verificação em vários navegadores.

### Desenvolvedores

- Nick Brayan
- Laerte Parnaíba
- Marcos Antônio
- Thomás Freitas
- Pedro Odalves
