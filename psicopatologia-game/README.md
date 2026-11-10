# Psicopatologia Game — Jogo da Velha Memória

Site experimental de memória e estratégia para **dois jogadores no mesmo dispositivo**.

## Tecnologias
- React + TypeScript
- Vite
- CSS responsivo
- Service Worker para cache e funcionamento offline após o primeiro acesso online

## Requisitos
- Node.js 18 ou superior
- npm

## Executar localmente
```bash
npm install
npm run dev
```

## Gerar versão de produção
```bash
npm run build
npm run preview
```

A versão final será gerada na pasta `dist/`.

## Publicar na Vercel
1. Envie os arquivos deste projeto para o repositório GitHub `psicopatologia.game`.
2. Na Vercel, importe o repositório.
3. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Faça o deploy.

## Modo offline
O site registra um Service Worker que armazena a estrutura do site e os arquivos acessados. Para testar:
1. Abra o site publicado com internet.
2. Aguarde o carregamento completo.
3. Desconecte a internet e atualize a página.

O primeiro acesso precisa de conexão para baixar e armazenar os arquivos. Fontes externas podem não carregar offline; o site usa fontes de sistema como alternativa.

## Regras implementadas
- Dois participantes compartilham o mesmo dispositivo.
- Cada pessoa joga com seu símbolo (X ou O).
- O baralho tem 24 cartas, organizadas em 12 pares.
- Encontrar um par libera uma jogada no tabuleiro 3 × 3.
- Se errar o par, a vez passa para o outro participante.
- A rodada termina com três símbolos em linha ou tabuleiro completo.
- Placar acumulado e reinício de rodada.

## Identidade visual
Paleta: roxo profundo, lilás, lavanda e off-white.
A arte aprovada foi incluída em `public/logo-psicologia.png` e `public/favicon.png`. A marca de realização Evelyn G. foi incluída em `public/evelyn-g-marketing.png`.

## Créditos
Realização: Evelyn G. Marketing Digital  
Instagram: [@evelyn.namidia](https://www.instagram.com/evelyn.namidia)
