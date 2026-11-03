'use strict';

const CHAVE_DADOS = 'sonora:dados';
const CHAVE_USUARIO = 'sonora:usuario';
const CHAVE_CAPAS = 'sonora:capas';
const PASSO_CARROSSEL = 166; // largura do .poster-card (150px) + gap (16px) — ver style.css
const COLECOES = { musica: 'musicas', album: 'albuns', artista: 'artistas', lista: 'listas' };
const ROTULOS = { musica: 'Música', album: 'Álbum', artista: 'Artista', lista: 'Lista' };

let db;             // estado da aplicação (dados.json + alterações salvas no navegador)
let usuarioId;      // usuário "logado"
let cacheCapas = {}; // chave "tipo:id" -> URL da capa real (iTunes) ou null se não achou
let editandoAvaliacao = null; // "tipo:id" da avaliação que está aberta pra edição, ou null

// ================= Dados =================

// Usa o que já foi salvo no navegador; na primeira visita, carrega dados.json.
async function carregarDados() {
  const salvo = localStorage.getItem(CHAVE_DADOS);
  if (salvo) return JSON.parse(salvo);
  const resposta = await fetch('dados.json');
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return resposta.json();
}

function salvar() {
  localStorage.setItem(CHAVE_DADOS, JSON.stringify(db));
}

// ---- Capas reais (busca ao vivo na API pública do iTunes; nada é baixado/guardado no projeto) ----

function salvarCacheCapas() {
  localStorage.setItem(CHAVE_CAPAS, JSON.stringify(cacheCapas));
}

async function buscarNaApi(termo, entity) {
  const resposta = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(termo)}&entity=${entity}&limit=1`);
  if (!resposta.ok) return null;
  const { results } = await resposta.json();
  const url = results[0]?.artworkUrl100;
  return url ? url.replace('100x100bb', '600x600bb') : null;
}

// Foto de artista vem da Wikipédia (fotos de lá têm licença aberta, ao contrário da capa
// de disco). Tenta a página em português primeiro, depois em inglês.
async function buscarFotoWikipedia(nome, idioma) {
  const resposta = await fetch(`https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nome)}`);
  if (!resposta.ok) return null;
  const dados = await resposta.json();
  const src = dados.thumbnail?.source;
  if (!src) return null;
  return src.replace(/\/\d+px-/, '/500px-'); // pede um tamanho maior que a miniatura padrão
}

async function buscarCapaReal(tipo, item) {
  const nomeArtista = buscar('artista', item.artistaId)?.nome ?? '';
  try {
    if (tipo === 'artista') {
      let url = await buscarFotoWikipedia(item.nome, 'pt');
      if (!url) url = await buscarFotoWikipedia(item.nome, 'en');
      if (!url) console.warn('[capas] nenhuma foto na Wikipédia para', item.nome);
      return url;
    }
    if (tipo === 'musica') {
      // Busca a faixa; se a API não achar (comum pra faixas menos conhecidas), cai pra capa do álbum.
      let url = await buscarNaApi(`${item.titulo} ${nomeArtista}`, 'song');
      if (!url) {
        const album = buscar('album', item.albumId);
        if (album) url = await buscarNaApi(`${album.titulo} ${nomeArtista}`, 'album');
      }
      if (!url) console.warn('[capas] nenhum resultado (faixa nem álbum) para', item.titulo);
      return url;
    }
    const url = await buscarNaApi(`${item.titulo} ${nomeArtista}`, 'album');
    if (!url) console.warn('[capas] nenhum resultado para', item.titulo);
    return url;
  } catch (erro) {
    console.warn('[capas] falha ao buscar', item.titulo ?? item.nome, '—', erro.message); // sem internet, bloqueio ou API fora do ar
    return null;
  }
}

function aplicarCapaNoDom(elementos, url) {
  if (!url) return;
  elementos.forEach(el => {
    if (el.querySelector('img')) return;
    const img = new Image();
    img.alt = '';
    // Sem "loading=lazy" aqui: a imagem ainda não está no documento (só entra depois de
    // carregar), e o navegador não consegue calcular "perto da tela" pra um elemento fora do DOM
    // — nesse caso ele nunca dispara o carregamento, e onload/onerror nunca chegam a rodar.
    img.onerror = () => { console.warn('[capas] imagem não carregou:', url); img.remove(); };
    img.onload = () => { el.querySelector('.letra-capa')?.remove(); el.appendChild(img); };
    img.src = url;
  });
}

// Busca as capas ainda não resolvidas que apareceram na tela renderizada.
function carregarCapasPendentes() {
  const grupos = new Map(); // "tipo:id" -> elementos .capa correspondentes
  document.querySelectorAll('#app .capa[data-capa-id]').forEach(el => {
    const chaveBase = `${el.dataset.capaTipo}:${el.dataset.capaId}`;
    (grupos.get(chaveBase) ?? grupos.set(chaveBase, []).get(chaveBase)).push(el);
  });
  grupos.forEach((elementos, chaveBase) => {
    const [tipo, id] = chaveBase.split(':');
    const item = buscar(tipo, id);
    if (!item) return;
    // O nome entra na chave de cache de propósito: se o id for reaproveitado pra outro
    // item (ex.: trocar o catálogo inteiro mas manter "al1"), a chave muda sozinha e evita
    // mostrar a capa antiga guardada por engano.
    const chave = `${chaveBase}:${nomeDe(item)}`;
    if (chave in cacheCapas) return aplicarCapaNoDom(elementos, cacheCapas[chave]);
    buscarCapaReal(tipo, item).then(url => {
      // só grava sucesso no cache; falha (ex.: rede instável) tenta de novo na próxima visita.
      if (url) { cacheCapas[chave] = url; salvarCacheCapas(); }
      aplicarCapaNoDom(elementos, url);
    });
  });
}

function novoId(prefixo) {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function buscar(tipo, id) {
  return db[COLECOES[tipo]].find(item => item.id === id);
}

function usuario(id) {
  return db.usuarios.find(u => u.id === id);
}

function avatarUsuario(u) {
  let matiz = 0;
  for (const c of u.id) matiz = (matiz * 37 + c.charCodeAt(0)) % 360;
  return `<span class="avatar" style="--h:${matiz}">${esc(u.nome.charAt(0).toUpperCase())}</span>`;
}

function atualizarBotaoPerfil() {
  const u = usuario(usuarioId);
  document.getElementById('perfil-botao').innerHTML = `${avatarUsuario(u)} <span class="nome-perfil">${esc(u.nome)}</span>`;
  document.querySelectorAll('#perfil-menu button').forEach(b => b.classList.toggle('ativo', b.dataset.id === usuarioId));
}

// Substitui o antigo <select> "Entrar como": um avatar clicável que abre a lista de usuários.
function configurarPerfil() {
  const botao = document.getElementById('perfil-botao');
  const menu = document.getElementById('perfil-menu');
  menu.innerHTML = db.usuarios.map(u => `<button type="button" data-acao="trocar-usuario" data-id="${u.id}">${avatarUsuario(u)} ${esc(u.nome)}</button>`).join('');
  atualizarBotaoPerfil();

  botao.addEventListener('click', evento => {
    evento.stopPropagation();
    menu.hidden = !menu.hidden;
    botao.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', evento => {
    if (!menu.hidden && !evento.target.closest('.perfil')) {
      menu.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    }
  });
}

function nomeDe(item) {
  return item.titulo ?? item.nome;
}

function avaliacoesDe(tipo, id) {
  return db.avaliacoes
    .filter(a => a.tipo === tipo && a.alvoId === id)
    .sort((a, b) => b.data.localeCompare(a.data));
}

function media(tipo, id) {
  const avaliacoes = avaliacoesDe(tipo, id);
  if (!avaliacoes.length) return { media: 0, total: 0 };
  const soma = avaliacoes.reduce((s, a) => s + a.nota, 0);
  return { media: soma / avaliacoes.length, total: avaliacoes.length };
}

// ================= Helpers de HTML =================

// Escapa texto digitado pelo usuário antes de colocar no HTML.
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function estrelas(nota) {
  const cheias = Math.round(nota);
  return `<span class="estrelas" title="${nota.toFixed(1)} de 5">${'★'.repeat(cheias)}<span class="vazia">${'★'.repeat(5 - cheias)}</span></span>`;
}

function resumoNota(tipo, id) {
  const { media: m, total } = media(tipo, id);
  if (!total) return '<span class="muted">Sem avaliações</span>';
  return `${estrelas(m)} <span class="muted">${m.toFixed(1)} · ${total} ${total === 1 ? 'avaliação' : 'avaliações'}</span>`;
}

function resumoCurto(tipo, id) {
  const { media: m, total } = media(tipo, id);
  return total ? `${estrelas(m)} <span class="muted">${m.toFixed(1)}</span>` : '<span class="muted">—</span>';
}

// Capa gerada a partir do id (cor + inicial). Serve de placeholder e também de fallback
// para quando a capa real (buscarCapaReal, via API do iTunes) não é encontrada.
// Mapeia a média pra uma cor de "sinal de qualidade" no selo — verde/laranja/vermelho.
function corNota(m) {
  if (m >= 4) return 'var(--verde)';
  if (m >= 2.5) return 'var(--laranja)';
  return 'var(--perigo)';
}

// Matiz (0-360) derivado do id — cor determinística usada na capa gerada e no brilho decorativo.
function matizDe(item) {
  let matiz = 0;
  for (const c of item.id) matiz = (matiz * 31 + c.charCodeAt(0)) % 360;
  return matiz;
}

function capa(item, tamanho = '', tipo = '', comSelo = false) {
  const dados = (tipo === 'musica' || tipo === 'album' || tipo === 'artista') ? ` data-capa-tipo="${tipo}" data-capa-id="${item.id}"` : '';
  let selo = '';
  if (comSelo && tipo) {
    const { media: m, total } = media(tipo, item.id);
    if (total) selo = `<span class="selo-nota" style="--corSelo:${corNota(m)}">${m.toFixed(1)}</span>`;
  }
  // A letra fica num <span> à parte (não solto no texto do div) pra sobreviver quando a
  // capa real chega: só o <span> é removido, o selo continua no lugar.
  return `<div class="capa ${tamanho}" style="--h:${matizDe(item)}"${dados}>${selo}<span class="letra-capa">${esc(nomeDe(item).charAt(0).toUpperCase())}</span></div>`;
}

function link(tipo, item) {
  return `<a href="#/${tipo}/${item.id}">${esc(nomeDe(item))}</a>`;
}

function dataCurta(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function vazio(mensagem) {
  return `<p class="vazio">${mensagem}</p>`;
}

function subtitulo(tipo, item) {
  if (tipo === 'musica' || tipo === 'album') return buscar('artista', item.artistaId)?.nome ?? '';
  if (tipo === 'artista') return item.genero;
  if (tipo === 'lista') return `por ${usuario(item.usuarioId)?.nome} · ${item.musicas.length} músicas`;
  return '';
}

// Gênero de música/álbum vem do artista (não têm gênero próprio no modelo de dados).
function generoDe(tipo, item) {
  if (tipo === 'artista') return item.genero ?? '';
  return buscar('artista', item.artistaId)?.genero ?? '';
}

function card(tipo, item, ordem = 0) {
  const sub = subtitulo(tipo, item);
  const genero = generoDe(tipo, item);
  const { media: nota } = media(tipo, item.id);
  return `<a class="card" href="#/${tipo}/${item.id}" data-busca-texto="${esc(normalizar(nomeDe(item) + ' ' + sub))}"
    data-genero="${esc(genero)}" data-nome="${esc(normalizar(nomeDe(item)))}" data-nota="${nota}" data-ano="${item.ano ?? 0}" data-ordem="${ordem}">
    ${capa(item, '', tipo, true)}
    <strong>${esc(nomeDe(item))}</strong>
    <span class="muted">${esc(sub)}</span>
    <span class="nota-card">${resumoCurto(tipo, item.id)}</span>
  </a>`;
}

function grade(tipo, itens, mensagemVazia) {
  return itens.length
    ? `<div class="grade">${itens.map((i, ordem) => card(tipo, i, ordem)).join('')}</div>`
    : vazio(mensagemVazia);
}

function listaMusicas(musicas, listaId = null) {
  if (!musicas.length) return vazio('Nenhuma música ainda.');
  return `<ol class="faixas">${musicas.map(m => `
    <li><div>
      <span>${capa(m, 'faixa', 'musica')} ${link('musica', m)} <span class="muted">— ${esc(buscar('artista', m.artistaId)?.nome)}</span></span>
      <span class="direita">
        ${resumoCurto('musica', m.id)}
        ${listaId ? `<button class="link perigo" data-acao="remover-musica" data-lista="${listaId}" data-musica="${m.id}">remover</button>` : ''}
      </span>
    </div></li>`).join('')}
  </ol>`;
}

// Ícones simples em SVG (sem depender de biblioteca de ícones nem imagens externas).
function iconeCoracao(preenchido) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${preenchido ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2.2 4.8 5.6 4.2c2-.4 3.9.5 5 2.1a5.4 5.4 0 0 1 1.4-1.6c1.8-1.3 4.3-1.3 6 .2 2 1.8 2 5 0 7.4C15.5 16.4 12 21 12 21z"/>
  </svg>`;
}
function iconeLapis() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
  </svg>`;
}
function iconeLixeira() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>`;
}

function totalCurtidas(a) {
  return a.curtidas?.length ?? 0;
}

function itemAvaliacao(a, mostrarAlvo = false) {
  const autor = usuario(a.usuarioId);
  const alvo = buscar(a.tipo, a.alvoId);
  const curti = a.curtidas?.includes(usuarioId) ?? false;
  const total = totalCurtidas(a);
  return `<article class="avaliacao">
    <header>
      <a href="#/usuario/${autor.id}"><strong>${esc(autor.nome)}</strong></a>
      ${mostrarAlvo && alvo ? `<span class="tag">${ROTULOS[a.tipo]}</span> ${link(a.tipo, alvo)}` : ''}
      ${estrelas(a.nota)}
      <span class="muted">${dataCurta(a.data)}</span>
    </header>
    ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}
    <button type="button" class="curtir ${curti ? 'ativa' : ''}" data-acao="curtir-avaliacao" data-id="${a.id}"
      aria-label="${curti ? 'Descurtir' : 'Curtir'}">
      ${iconeCoracao(curti)} ${total ? `<span class="muted">${total}</span>` : ''}
    </button>
  </article>`;
}

// Mostra o que o usuário já avaliou (se houver) — sem misturar com o formulário de baixo.
// Visualização de "sua avaliação" — vira formulário no lugar quando clica em editar
// (ver blocoAvaliacoes), em vez de ficar um formulário separado embaixo sempre visível.
function minhaAvaliacaoBloco(tipo, minha) {
  return `<div class="minha-avaliacao">
    <span class="muted">Sua avaliação para essa ${ROTULOS[tipo].toLowerCase()}</span>
    <div class="minha-avaliacao-linha">
      ${estrelas(minha.nota)}
      <button type="button" class="link" data-acao="editar-avaliacao" data-tipo="${tipo}" data-alvo="${minha.alvoId}">${iconeLapis()} editar</button>
      <button type="button" class="link perigo" data-acao="excluir-avaliacao" data-id="${minha.id}">${iconeLixeira()} excluir</button>
    </div>
    ${minha.comentario ? `<p>${esc(minha.comentario)}</p>` : ''}
  </div>`;
}

// Sem "minha": formulário em branco pra avaliar pela primeira vez.
// Com "minha": formulário de edição, pré-preenchido, no lugar do bloco de leitura acima.
const ROTULOS_NOTA = ['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'];

function formAvaliacao(tipo, id, minha) {
  const nota = minha?.nota ?? 0;
  const comentario = minha?.comentario ?? '';
  const botoes = [1, 2, 3, 4, 5].map(n => `
    <button type="button" data-acao="estrela" data-nota="${n}" class="${n <= nota ? 'ativa' : ''}"
      aria-label="${n} ${n === 1 ? 'estrela' : 'estrelas'}">★</button>`).join('');
  return `<form class="form-avaliacao" data-form="avaliacao" data-tipo="${tipo}" data-alvo="${id}">
    <label>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1Z"/></svg>
      ${minha ? 'Editar avaliação' : 'Avalie'}
    </label>
    <div class="linha-estrelas">
      <div class="seletor-estrelas">${botoes}</div>
      <span class="rotulo-nota" data-rotulo>${ROTULOS_NOTA[nota] ?? ''}</span>
    </div>
    <input type="hidden" name="nota" value="${nota}">
    <div class="campo-textarea">
      <textarea name="comentario" rows="3" maxlength="500" placeholder="Escreva uma resenha (opcional)" data-contador>${esc(comentario)}</textarea>
      <span class="contador-caracteres" data-contador-texto>${comentario.length}/500</span>
    </div>
    <div class="acoes">
      <button type="submit">${minha ? 'Salvar' : 'Publicar'}</button>
      ${minha ? `<button type="button" class="secundario" data-acao="cancelar-edicao">Cancelar</button>` : ''}
    </div>
  </form>`;
}

function blocoAvaliacoes(tipo, id, podeAvaliar, motivo = '') {
  const todas = avaliacoesDe(tipo, id); // já vem por data, mais recente primeiro
  const minha = todas.find(a => a.usuarioId === usuarioId);
  const outras = todas.filter(a => a !== minha);
  const populares = [...outras].sort((a, b) => totalCurtidas(b) - totalCurtidas(a) || b.nota - a.nota || b.data.localeCompare(a.data)).slice(0, 4);
  const recentes = outras.slice(0, 4);
  const editando = editandoAvaliacao === `${tipo}:${id}`;
  const blocoMinha = !podeAvaliar ? `<p class="muted">${motivo}</p>`
    : (minha && !editando) ? minhaAvaliacaoBloco(tipo, minha)
    : formAvaliacao(tipo, id, editando ? minha : null);
  return `<h2>Avaliações</h2>
    ${blocoMinha}
    ${outras.length ? `
      <div class="titulo-secao"><h2>Avaliações populares</h2></div>
      <div class="avaliacoes">${populares.map(a => itemAvaliacao(a)).join('')}</div>
      <div class="titulo-secao"><h2>Avaliações recentes</h2></div>
      <div class="avaliacoes">${recentes.map(a => itemAvaliacao(a)).join('')}</div>
    ` : vazio('Nenhuma outra avaliação ainda.')}`;
}

function formAdicionarALista(musicaId) {
  const minhas = db.listas.filter(l => l.usuarioId === usuarioId);
  if (!minhas.length) {
    return `<p class="muted">Crie uma lista em <a href="#/listas">Listas</a> para adicionar esta música.</p>`;
  }
  return `<form class="inline" data-form="add-musica" data-musica="${musicaId}">
    <select name="listaId">${minhas.map(l => `<option value="${l.id}">${esc(l.nome)}</option>`).join('')}</select>
    <button type="submit">Adicionar à lista</button>
  </form>`;
}

function botaoVoltar() {
  return `<button type="button" class="botao-voltar" data-acao="voltar">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>
    Voltar
  </button>`;
}

function cabecalho(item, rotulo, info, extra = '', tipo = '') {
  return `${botaoVoltar()}
  <section class="detalhe">
    ${capa(item, 'grande', tipo)}
    <div>
      <span class="tag">${rotulo}</span>
      <h1>${esc(nomeDe(item))}</h1>
      <p class="muted">${info}</p>
      ${extra}
    </div>
  </section>`;
}

// ================= Telas =================

// "Popular" = melhor média entre os mais avaliados; completa com o resto se faltar item.
function popularidade(tipo, id) {
  return media(tipo, id);
}

function cardPoster(tipo, item) {
  const sub = subtitulo(tipo, item);
  return `<a class="poster-card" href="#/${tipo}/${item.id}">
    ${capa(item, 'poster', tipo, true)}
    <strong>${esc(nomeDe(item))}</strong>
    <span class="muted">${esc(sub)}</span>
    <span class="nota-card">${resumoCurto(tipo, item.id)}</span>
  </a>`;
}

// Setas ficam do lado do título da seção, não em cima da capa — nada de botão
// flutuante nem degradê por cima da imagem, que já causou mais confusão que ajuda.
function carrossel(tipo, titulo, itens) {
  if (!itens.length) return `<h2>${titulo}</h2>${vazio('Nada por aqui ainda.')}`;
  const seta = (dir) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="${dir < 0 ? '15 6 9 12 15 18' : '9 6 15 12 9 18'}"/></svg>`;
  return `<h2>${titulo}</h2>
  <div class="carrossel-wrap">
    <button type="button" class="seta esquerda" data-acao="carrossel" data-dir="-1" aria-label="Anterior">${seta(-1)}</button>
    <div class="carrossel">${itens.map(i => cardPoster(tipo, i)).join('')}</div>
    <button type="button" class="seta direita" data-acao="carrossel" data-dir="1" aria-label="Próximo">${seta(1)}</button>
  </div>`;
}

function reviewDestaque(a) {
  const autor = usuario(a.usuarioId);
  const alvo = buscar(a.tipo, a.alvoId);
  if (!alvo) return '';
  const album = a.tipo === 'musica' ? buscar('album', alvo.albumId) : null;
  return `<article class="review-destaque">
    ${capa(alvo, 'mini', a.tipo)}
    <div>
      <a href="#/usuario/${autor.id}">${esc(autor.nome)}</a>
      <h3>${link(a.tipo, alvo)} ${album ? `<span class="muted">${album.ano}</span>` : ''}</h3>
      ${estrelas(a.nota)}
      ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}
    </div>
  </article>`;
}

function telaInicio() {
  const popularesAlbuns = db.albuns
    .map(album => ({ album, ...popularidade('album', album.id) }))
    .sort((x, y) => y.total - x.total || y.media - x.media)
    .map(x => x.album);

  const popularesMusicas = db.musicas
    .map(musica => ({ musica, ...popularidade('musica', musica.id) }))
    .sort((x, y) => y.total - x.total || y.media - x.media)
    .slice(0, 14)
    .map(x => x.musica);

  const reviewsPopulares = [...db.avaliacoes]
    .filter(a => a.comentario)
    .sort((a, b) => totalCurtidas(b) - totalCurtidas(a) || b.nota - a.nota || b.data.localeCompare(a.data))
    .slice(0, 4);

  // Vem logo depois do carrossel de artistas, então mostra avaliação de artista mesmo
  // (não de qualquer tipo) — pra seguir coerente com o que tá acima dela.
  const avaliacoesArtistas = db.avaliacoes
    .filter(a => a.tipo === 'artista')
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 6);

  const artistasDestaque = [...db.artistas]
    .map(artista => ({ artista, ...media('artista', artista.id) }))
    .sort((x, y) => y.total - x.total || y.media - x.media)
    .map(x => x.artista);

  const listasComunidade = [...db.listas].sort((a, b) => totalCurtidas(b) - totalCurtidas(a)).slice(0, 3);

  // Destaque do herói: fixo no Michael Jackson, por pedido — não é o item mais popular calculado.
  const destaque = db.albuns.find(a => buscar('artista', a.artistaId)?.nome === 'Michael Jackson') ?? popularesAlbuns[0];

  return `<section class="hero">
      <div class="hero-texto">
        <h1>Avalie as músicas mais populares do momento.</h1>
        <p>Dê nota a músicas, álbuns e artistas. Crie listas e veja o que a comunidade anda ouvindo.</p>
        <a href="#/albuns" class="hero-cta">Explorar álbuns</a>
      </div>
      ${destaque ? `<div class="hero-destaque-wrap" style="--h:${matizDe(destaque)}">${capa(destaque, 'destaque', 'album', true)}</div>` : ''}
    </section>
    ${carrossel('musica', 'Músicas populares esta semana', popularesMusicas)}
    <div class="titulo-secao"><h2>Avaliações populares esta semana</h2></div>
    ${reviewsPopulares.length
      ? `<div class="reviews-populares">${reviewsPopulares.map(reviewDestaque).join('')}</div>`
      : vazio('Nenhuma avaliação com resenha ainda.')}
    ${carrossel('artista', 'Artistas', artistasDestaque)}
    <h2>Avaliações de artistas</h2>
    ${avaliacoesArtistas.length
      ? `<div class="avaliacoes">${avaliacoesArtistas.map(a => itemAvaliacao(a, true)).join('')}</div>`
      : vazio('Nenhuma avaliação de artista ainda.')}
    <div class="titulo-secao"><h2>Listas da comunidade</h2><a href="#/listas">ver todas</a></div>
    ${grade('lista', listasComunidade, 'Nenhuma lista criada ainda.')}`;
}

function telaCatalogo(tipo, titulo) {
  const itens = db[COLECOES[tipo]];
  const generos = [...new Set(itens.map(i => generoDe(tipo, i)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));

  const avaliados = itens.map(i => media(tipo, i.id)).filter(x => x.total);
  const mediaGeral = avaliados.length ? avaliados.reduce((s, x) => s + x.media, 0) / avaliados.length : 0;
  const totalAvaliacoes = avaliados.reduce((s, x) => s + x.total, 0);

  const opcoesOrdenar = [
    { valor: 'relevancia', rotulo: 'Mais relevantes' },
    { valor: 'nota', rotulo: 'Mais bem avaliados' },
    { valor: 'nome', rotulo: 'Nome (A-Z)' },
    ...(tipo === 'album' ? [{ valor: 'ano', rotulo: 'Mais recentes' }] : []),
  ];

  return `<div class="cabecalho-catalogo">
      <h1>${titulo}</h1>
      <div class="estatisticas-catalogo">
        <span><strong>${itens.length}</strong> ${titulo.toLowerCase()}</span>
        ${mediaGeral ? `<span>${estrelas(mediaGeral)} <strong>${mediaGeral.toFixed(1)}</strong> de média</span>` : ''}
        ${totalAvaliacoes ? `<span><strong>${totalAvaliacoes}</strong> ${totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'} no total</span>` : ''}
        ${generos.length ? `<span><strong>${generos.length}</strong> ${generos.length === 1 ? 'gênero' : 'gêneros'}</span>` : ''}
      </div>
      <div class="filtros">
        <div class="campo campo-select">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
          <select data-filtro-genero aria-label="Filtrar por gênero">
            <option value="">Todos os gêneros</option>
            ${generos.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
          </select>
        </div>
        <div class="campo campo-busca">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" placeholder="Buscar…" data-busca>
        </div>
        <div class="campo campo-select">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 7h11M3 12h7M3 17h4M17 4v16m0 0 4-4m-4 4-4-4"/></svg>
          <select data-ordenar aria-label="Ordenar por">
            ${opcoesOrdenar.map(o => `<option value="${o.valor}">${o.rotulo}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    ${grade(tipo, itens, 'Nada cadastrado.')}`;
}

function telaDetalhe(tipo, id) {
  const item = buscar(tipo, id);
  if (!item) return vazio('Item não encontrado.');

  let info = '';
  let extra = '';
  if (tipo === 'musica') {
    const album = buscar('album', item.albumId);
    info = `${link('artista', buscar('artista', item.artistaId))} · do álbum ${link('album', album)} (${album.ano})`;
    extra = `<h2>Adicionar a uma lista</h2>${formAdicionarALista(id)}`;
  } else if (tipo === 'album') {
    info = `${link('artista', buscar('artista', item.artistaId))} · ${item.ano}`;
    extra = `<h2>Faixas</h2>${listaMusicas(db.musicas.filter(m => m.albumId === id))}`;
  } else if (tipo === 'artista') {
    info = esc(item.genero);
    extra = `<h2>Álbuns</h2>${grade('album', db.albuns.filter(a => a.artistaId === id), 'Nenhum álbum.')}
      <h2>Músicas</h2>${listaMusicas(db.musicas.filter(m => m.artistaId === id))}`;
  }

  return cabecalho(item, ROTULOS[tipo], info, `<p class="nota-grande">${resumoNota(tipo, id)}</p>`, tipo)
    + extra
    + blocoAvaliacoes(tipo, id, true);
}

function telaListas() {
  const minhas = db.listas.filter(l => l.usuarioId === usuarioId);
  const outras = db.listas.filter(l => l.usuarioId !== usuarioId);
  return `<div class="titulo-secao"><h1>Listas</h1></div>
    <form class="painel" data-form="nova-lista">
      <h2>Nova lista</h2>
      <input name="nome" required maxlength="80" placeholder="Nome da lista">
      <textarea name="descricao" rows="2" maxlength="300" placeholder="Descrição (opcional)"></textarea>
      <button type="submit">Criar lista</button>
    </form>
    <h2>Minhas listas</h2>
    ${grade('lista', minhas, 'Você ainda não criou nenhuma lista.')}
    <h2>Listas da comunidade</h2>
    ${grade('lista', outras, 'Nenhuma lista de outros usuários.')}`;
}

function telaLista(id) {
  const lista = buscar('lista', id);
  if (!lista) return vazio('Lista não encontrada.');

  const dono = lista.usuarioId === usuarioId;
  const musicas = lista.musicas.map(mid => buscar('musica', mid)).filter(Boolean);
  const disponiveis = db.musicas.filter(m => !lista.musicas.includes(m.id));
  const autor = usuario(lista.usuarioId);

  const info = `por <a href="#/usuario/${autor.id}">${esc(autor.nome)}</a> · ${musicas.length} músicas`;
  const extra = `${lista.descricao ? `<p>${esc(lista.descricao)}</p>` : ''}
    <p class="nota-grande">${resumoNota('lista', id)}</p>`;

  const edicao = dono ? `
    <details class="painel">
      <summary>Editar lista</summary>
      <form data-form="editar-lista" data-id="${id}">
        <input name="nome" required maxlength="80" value="${esc(lista.nome)}">
        <textarea name="descricao" rows="2" maxlength="300" placeholder="Descrição (opcional)">${esc(lista.descricao)}</textarea>
        <div class="acoes">
          <button type="submit">Salvar</button>
          <button type="button" class="secundario perigo" data-acao="excluir-lista" data-id="${id}">Excluir lista</button>
        </div>
      </form>
    </details>` : '';

  const adicionar = dono && disponiveis.length ? `
    <form class="inline" data-form="add-musica" data-lista="${id}">
      <select name="musicaId">${disponiveis.map(m =>
        `<option value="${m.id}">${esc(m.titulo)} — ${esc(buscar('artista', m.artistaId).nome)}</option>`).join('')}
      </select>
      <button type="submit">Adicionar música</button>
    </form>` : '';

  return cabecalho(lista, 'Lista', info, extra)
    + edicao
    + `<h2>Músicas</h2>${listaMusicas(musicas, dono ? id : null)}${adicionar}`
    + blocoAvaliacoes('lista', id, !dono, 'Você não pode avaliar a sua própria lista.');
}

function telaUsuario(id) {
  const u = usuario(id);
  if (!u) return vazio('Usuário não encontrado.');
  const avaliacoes = db.avaliacoes.filter(a => a.usuarioId === id).sort((a, b) => b.data.localeCompare(a.data));
  const listas = db.listas.filter(l => l.usuarioId === id);
  return cabecalho(u, 'Perfil', `${avaliacoes.length} avaliações · ${listas.length} listas`)
    + `<h2>Listas</h2>${grade('lista', listas, 'Nenhuma lista.')}
       <h2>Avaliações</h2>
       ${avaliacoes.length ? `<div class="avaliacoes">${avaliacoes.map(a => itemAvaliacao(a, true)).join('')}</div>` : vazio('Nenhuma avaliação.')}`;
}

// ================= Roteamento =================

function render() {
  const [rota = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  const telas = {
    '': telaInicio,
    musicas: () => telaCatalogo('musica', 'Músicas'),
    albuns: () => telaCatalogo('album', 'Álbuns'),
    artistas: () => telaCatalogo('artista', 'Artistas'),
    listas: telaListas,
    musica: () => telaDetalhe('musica', id),
    album: () => telaDetalhe('album', id),
    artista: () => telaDetalhe('artista', id),
    lista: () => telaLista(id),
    usuario: () => telaUsuario(id),
  };
  const tela = telas[rota] ?? (() => vazio('Página não encontrada.'));
  const app = document.getElementById('app');
  app.innerHTML = tela();
  carregarCapasPendentes();
  definirTitulo(rota, id);

  // Reinicia a animação de entrada a cada troca de página (sem isso, o navegador não
  // percebe a classe "voltando" e a transição não toca de novo).
  app.classList.remove('entrando');
  void app.offsetWidth;
  app.classList.add('entrando');

  const secao = { musica: 'musicas', album: 'albuns', artista: 'artistas', lista: 'listas' }[rota] ?? rota;
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('ativo', a.getAttribute('href') === `#/${secao}`);
  });
}

function definirTitulo(rota, id) {
  const rotulos = { musicas: 'Músicas', albuns: 'Álbuns', artistas: 'Artistas', listas: 'Listas' };
  let titulo = 'Sonora';
  if (rota === '') titulo = 'Sonora — avalie o que você ouve';
  else if (rotulos[rota]) titulo = `${rotulos[rota]} · Sonora`;
  else if (rota === 'musica' || rota === 'album' || rota === 'artista') {
    const item = buscar(rota, id);
    if (item) titulo = `${nomeDe(item)} · Sonora`;
  } else if (rota === 'lista') {
    const lista = buscar('lista', id);
    if (lista) titulo = `${lista.nome} · Sonora`;
  } else if (rota === 'usuario') {
    const u = usuario(id);
    if (u) titulo = `${u.nome} · Sonora`;
  }
  document.title = titulo;
}

function aviso(mensagem) {
  const el = document.getElementById('aviso');
  el.textContent = mensagem;
  el.classList.add('visivel');
  clearTimeout(aviso.timer);
  aviso.timer = setTimeout(() => el.classList.remove('visivel'), 2500);
}

// ================= Ações do usuário =================

document.addEventListener('click', evento => {
  const alvo = evento.target.closest('[data-acao]');
  if (!alvo) return;
  const { acao } = alvo.dataset;

  if (acao === 'voltar') {
    // Volta pra página anterior do histórico; se abriram o link direto (sem página
    // anterior nesta aba), cai na home em vez de fechar a aba sem querer.
    if (history.length > 1) history.back(); else location.hash = '#/';
  }

  if (acao === 'trocar-usuario') {
    usuarioId = alvo.dataset.id;
    localStorage.setItem(CHAVE_USUARIO, usuarioId);
    atualizarBotaoPerfil();
    document.getElementById('perfil-menu').hidden = true;
    editandoAvaliacao = null;
    render();
  }

  if (acao === 'estrela') {
    const form = alvo.closest('form');
    const nota = Number(alvo.dataset.nota);
    form.elements.nota.value = nota;
    form.querySelectorAll('[data-acao="estrela"]').forEach(b => {
      b.classList.toggle('ativa', Number(b.dataset.nota) <= nota);
    });
    const rotulo = form.querySelector('[data-rotulo]');
    if (rotulo) rotulo.textContent = ROTULOS_NOTA[nota] ?? '';
  }

  if (acao === 'curtir-avaliacao') {
    const avaliacao = db.avaliacoes.find(a => a.id === alvo.dataset.id);
    if (!avaliacao) return;
    avaliacao.curtidas ??= [];
    const i = avaliacao.curtidas.indexOf(usuarioId);
    if (i === -1) avaliacao.curtidas.push(usuarioId); else avaliacao.curtidas.splice(i, 1);
    salvar();
    render();
  }

  if (acao === 'editar-avaliacao') {
    editandoAvaliacao = `${alvo.dataset.tipo}:${alvo.dataset.alvo}`;
    render();
  }

  if (acao === 'cancelar-edicao') {
    editandoAvaliacao = null;
    render();
  }

  if (acao === 'excluir-avaliacao') {
    db.avaliacoes = db.avaliacoes.filter(a => a.id !== alvo.dataset.id);
    editandoAvaliacao = null;
    salvar();
    render();
    aviso('Avaliação excluída.');
  }

  if (acao === 'carrossel') {
    const carrossel = alvo.parentElement.querySelector('.carrossel');
    // Largura do card (150px, ver .poster-card no CSS) + gap (16px). Fixo, não medido:
    // medir via getBoundingClientRect no momento do clique dava valor errado (imagem
    // ainda carregando, layout mudando) e travava a conta de índice máximo.
    const passo = PASSO_CARROSSEL;
    const visiveis = Math.max(1, Math.round(carrossel.clientWidth / passo));
    const indiceMax = Math.max(0, carrossel.children.length - visiveis);
    // Controla por índice de card (não pela posição de rolagem, que oscila durante a
    // animação e atrapalhava a conta em cliques rápidos). Passa do fim, volta pro início — e vice-versa.
    let indice = Number(carrossel.dataset.indice ?? 0) + Number(alvo.dataset.dir);
    if (indice > indiceMax) indice = 0;
    if (indice < 0) indice = indiceMax;
    carrossel.dataset.indice = indice;
    carrossel.scrollTo({ left: indice * passo, behavior: 'smooth' });
  }

  if (acao === 'remover-musica') {
    const lista = buscar('lista', alvo.dataset.lista);
    lista.musicas = lista.musicas.filter(m => m !== alvo.dataset.musica);
    salvar();
    render();
    aviso('Música removida da lista.');
  }

  if (acao === 'excluir-lista') {
    if (!confirm('Excluir esta lista? Essa ação não pode ser desfeita.')) return;
    const id = alvo.dataset.id;
    db.listas = db.listas.filter(l => l.id !== id);
    db.avaliacoes = db.avaliacoes.filter(a => !(a.tipo === 'lista' && a.alvoId === id));
    salvar();
    location.hash = '#/listas';
    aviso('Lista excluída.');
  }
});

document.addEventListener('submit', evento => {
  const form = evento.target;
  if (!form.dataset.form) return;
  evento.preventDefault();
  const campos = new FormData(form);

  if (form.dataset.form === 'avaliacao') {
    const nota = Number(campos.get('nota'));
    if (!nota) return aviso('Escolha de 1 a 5 estrelas.');
    const { tipo, alvo } = form.dataset;
    const comentario = campos.get('comentario').trim();
    const data = new Date().toISOString();
    const existente = db.avaliacoes.find(a => a.tipo === tipo && a.alvoId === alvo && a.usuarioId === usuarioId);
    if (existente) {
      Object.assign(existente, { nota, comentario, data });
    } else {
      db.avaliacoes.push({ id: novoId('av'), usuarioId, tipo, alvoId: alvo, nota, comentario, data });
    }
    editandoAvaliacao = null; // volta pro bloco de leitura, com o valor recém-salvo
    salvar();
    render();
    aviso(existente ? 'Avaliação atualizada.' : 'Avaliação publicada.');
  }

  if (form.dataset.form === 'nova-lista') {
    const nome = campos.get('nome').trim();
    if (!nome) return aviso('Dê um nome à lista.');
    const lista = { id: novoId('l'), usuarioId, nome, descricao: campos.get('descricao').trim(), musicas: [] };
    db.listas.push(lista);
    salvar();
    location.hash = `#/lista/${lista.id}`;
    aviso('Lista criada.');
  }

  if (form.dataset.form === 'editar-lista') {
    const nome = campos.get('nome').trim();
    if (!nome) return aviso('Dê um nome à lista.');
    const lista = buscar('lista', form.dataset.id);
    lista.nome = nome;
    lista.descricao = campos.get('descricao').trim();
    salvar();
    render();
    aviso('Lista atualizada.');
  }

  if (form.dataset.form === 'add-musica') {
    const lista = buscar('lista', form.dataset.lista ?? campos.get('listaId'));
    const musicaId = form.dataset.musica ?? campos.get('musicaId');
    if (lista.musicas.includes(musicaId)) return aviso('Essa música já está na lista.');
    lista.musicas.push(musicaId);
    salvar();
    render();
    aviso(`Adicionada a "${lista.nome}".`);
  }
});

// Busca no catálogo: só esconde os cards que não batem com o texto.
// Busca por texto e filtro de gênero atuam juntos: um card só aparece se bater nos dois.
function aplicarFiltrosCatalogo() {
  const termo = normalizar((document.querySelector('[data-busca]')?.value ?? '').trim());
  const genero = document.querySelector('[data-filtro-genero]')?.value ?? '';
  document.querySelectorAll('.grade .card').forEach(card => {
    const bateBusca = card.dataset.buscaTexto.includes(termo);
    const bateGenero = !genero || card.dataset.genero === genero;
    card.hidden = !(bateBusca && bateGenero);
  });
}

// Reordena os cards no lugar (sem re-renderizar a página) — mantém filtro/busca intactos,
// já que só muda a ordem dos elementos, não esconde nada.
function aplicarOrdenacaoCatalogo() {
  const select = document.querySelector('[data-ordenar]');
  const grade = document.querySelector('.grade');
  if (!select || !grade) return;
  const criterio = select.value;
  const cards = [...grade.children];
  if (criterio === 'nota') cards.sort((a, b) => Number(b.dataset.nota) - Number(a.dataset.nota));
  else if (criterio === 'nome') cards.sort((a, b) => a.dataset.nome.localeCompare(b.dataset.nome, 'pt'));
  else if (criterio === 'ano') cards.sort((a, b) => Number(b.dataset.ano) - Number(a.dataset.ano));
  else cards.sort((a, b) => Number(a.dataset.ordem) - Number(b.dataset.ordem)); // "relevancia" = ordem original
  cards.forEach(c => grade.appendChild(c));
}

let debounceBusca;
document.addEventListener('input', evento => {
  if (evento.target.matches('[data-busca]')) {
    clearTimeout(debounceBusca);
    debounceBusca = setTimeout(aplicarFiltrosCatalogo, 200);
  }
  if (evento.target.matches('[data-contador]')) {
    const contador = evento.target.closest('.campo-textarea')?.querySelector('[data-contador-texto]');
    if (contador) contador.textContent = `${evento.target.value.length}/${evento.target.maxLength}`;
  }
});
document.addEventListener('change', evento => {
  if (evento.target.matches('[data-filtro-genero]')) aplicarFiltrosCatalogo();
  if (evento.target.matches('[data-ordenar]')) aplicarOrdenacaoCatalogo();
});

// Preview visual ao passar o mouse pelas estrelas, antes de clicar de fato.
document.addEventListener('mouseover', evento => {
  const alvo = evento.target.closest('[data-acao="estrela"]');
  if (!alvo) return;
  const nota = Number(alvo.dataset.nota);
  alvo.closest('.seletor-estrelas').querySelectorAll('[data-acao="estrela"]').forEach(b => {
    b.classList.toggle('previa', Number(b.dataset.nota) <= nota);
  });
  const rotulo = alvo.closest('form')?.querySelector('[data-rotulo]');
  if (rotulo) rotulo.textContent = ROTULOS_NOTA[nota] ?? '';
});
document.addEventListener('mouseout', evento => {
  const grupo = evento.target.closest('.seletor-estrelas');
  if (!grupo || grupo.contains(evento.relatedTarget)) return;
  grupo.querySelectorAll('[data-acao="estrela"]').forEach(b => b.classList.remove('previa'));
  const form = grupo.closest('form');
  const rotulo = form?.querySelector('[data-rotulo]');
  if (rotulo) rotulo.textContent = ROTULOS_NOTA[Number(form.elements.nota.value)] ?? '';
});

// ================= Inicialização =================

async function iniciar() {
  try {
    db = await carregarDados();
  } catch (erro) {
    console.error(erro);
    document.getElementById('app').innerHTML = `<div class="painel erro">
      <h1>Não foi possível carregar os dados</h1>
      <p>O navegador bloqueia a leitura de <code>dados.json</code> quando o <code>index.html</code> é aberto direto do disco.
      Rode um servidor local na pasta do projeto (ex.: <code>python3 -m http.server</code>) ou use a extensão Live Server do VS Code.</p>
    </div>`;
    return;
  }

  try { cacheCapas = JSON.parse(localStorage.getItem(CHAVE_CAPAS)) ?? {}; } catch { cacheCapas = {}; }

  usuarioId = localStorage.getItem(CHAVE_USUARIO);
  if (!usuario(usuarioId)) usuarioId = db.usuarios[0].id;
  configurarPerfil();

  document.getElementById('restaurar').addEventListener('click', () => {
    if (!confirm('Apagar todas as alterações e voltar aos dados iniciais?')) return;
    localStorage.removeItem(CHAVE_DADOS);
    localStorage.removeItem(CHAVE_CAPAS);
    location.reload();
  });

  window.addEventListener('hashchange', () => {
    window.scrollTo(0, 0);
    editandoAvaliacao = null; // saiu da página, fecha edição aberta que ficou pra trás
    render();
  });
  render();
}

iniciar();
