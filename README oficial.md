# Sonora

Protótipo de um "Letterboxd de músicas", feito para a Atividade 02 de Fundamentos da Engenharia de Software (Fábrica de SW + Processo de SW).

O projeto roda inteiramente no navegador, sem back-end, com HTML, CSS e JavaScript puros — sem framework, sem etapa de build. Os dados iniciais ficam em `dados.json`; as alterações feitas pelos usuários são salvas no `localStorage` do navegador.

## Como rodar

O navegador bloqueia `fetch('dados.json')` quando o `index.html` é aberto direto do disco (`file://`). Por isso, sirva a pasta com um servidor local:

```bash
cd sonora
python3 -m http.server 8000
# abra http://localhost:8000
```

Alternativa: extensão **Live Server** do VS Code (botão direito no `index.html` > "Open with Live Server").

Para voltar ao estado inicial, use o botão **Restaurar dados iniciais** no rodapé.

## Estrutura

```
index.html   estrutura da página (topo, navegação, área principal)
style.css    visual (tema escuro inspirado no Letterboxd)
app.js       lógica: carregamento dos dados, telas, rotas (#/...) e ações
dados.json   dados iniciais: usuarios, artistas, albuns, musicas, listas, avaliacoes
```

Não existe login de verdade: o avatar no canto superior direito simula o usuário logado (clica pra trocar).

## Decisões de arquitetura

Pra apresentação, vale citar estas escolhas como decisões conscientes da fábrica, não falta de tempo:

- **Sem framework (React/Vue/Angular).** O time inteiro — incluindo quem não programa no dia a dia — precisa continuar lendo e defendendo o código. Um framework exigiria build, dependências e uma curva de aprendizado que não cabia no prazo da atividade. O ganho visual foi buscado dentro do HTML/CSS/JS puro (animações, estados de carregamento, acessibilidade) em vez de trocar a base.
- **Sem back-end.** Todo o estado vive no `localStorage` do navegador de quem acessa; por isso cada pessoa vê seus próprios dados, e "Restaurar dados iniciais" existe porque não há um servidor pra reverter o estado por elas.
- **Capas de disco e foto de artista vêm de APIs públicas ao vivo** (iTunes Search API para música/álbum, Wikipédia para artista) em vez de arquivos de imagem no repositório — evita usar capas com direito autoral sem licença, e mantém o projeto leve.
- **"Popular" nas avaliações** é ordenado por curtidas (e nota como desempate), não por data — mais fiel ao conceito de "review popular" do Letterboxd.

## Requisitos atendidos

| Código | Requisito | Onde testar |
|--------|-----------|-------------|
| RF01 | Avaliar músicas (1 a 5 estrelas + resenha opcional) | Músicas > abrir uma música |
| RF02 | Avaliar álbuns | Álbuns > abrir um álbum |
| RF03 | Avaliar artistas | Artistas > abrir um artista |
| RF04 | Editar e excluir a própria avaliação | Tela de qualquer item já avaliado |
| RF05 | Criar lista de músicas | Listas > Nova lista |
| RF06 | Atualizar lista (nome, descrição, adicionar/remover músicas) | Abrir uma lista sua > Editar lista |
| RF07 | Excluir lista | Abrir uma lista sua > Editar lista > Excluir lista |
| RF08 | Avaliar listas de outros usuários (não a própria) | Listas > Listas da comunidade |
| RF09 | Ver média e quantidade de avaliações | Qualquer item |
| RF10 | Buscar e filtrar por gênero no catálogo | Músicas / Álbuns / Artistas |
| RF11 | Curtir avaliações de outros usuários | Qualquer avaliação de outro usuário |
| RF12 | Ver avaliações populares (por curtida) e recentes separadamente | Início e tela de qualquer item |
| RNF01 | Rodar só no navegador, sem back-end | — |
| RNF02 | Interface acessível (navegação por teclado, leitor de tela) | Tab pela página; link "Pular para o conteúdo" |

## Roteiro de testes (para o testador)

1. Entrar como **Ana** (avatar no canto), abrir um álbum, dar 4 estrelas com comentário. A média deve mudar.
2. Voltar ao mesmo álbum: o bloco "Sua avaliação" deve mostrar o que foi salvo. Clicar em **editar**, mudar pra 2 estrelas e **Salvar**.
3. **Excluir** a avaliação; ela deve sumir da tela.
4. Tentar publicar sem escolher estrelas: deve aparecer o aviso "Escolha de 1 a 5 estrelas."
5. Curtir uma avaliação de outro usuário; ela deve subir de posição em "Avaliações populares" se juntar mais curtidas que as outras.
6. Criar uma lista, adicionar 3 músicas (pela tela da lista e pela tela de uma música), remover 1.
7. Adicionar a mesma música duas vezes pela tela da música: deve avisar que já está na lista.
8. Editar nome/descrição da lista; excluir a lista.
9. Na lista de outro usuário: deve aparecer o formulário de avaliação. Na própria lista: não.
10. Trocar de usuário pelo avatar e verificar que os dados do usuário anterior continuam lá.
11. Filtrar Músicas por gênero e por texto ao mesmo tempo; combinar os dois deve funcionar junto.
12. Recarregar a página (F5): os dados devem persistir. **Restaurar dados iniciais** deve zerar tudo.
13. Digitar `<b>teste</b>` num comentário: deve aparecer como texto, não em negrito.
14. Navegar só com o teclado (Tab/Enter): o foco deve ficar visível em todo elemento clicável.
