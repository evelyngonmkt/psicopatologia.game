import { useEffect, useMemo, useState } from "react";
import {
  Brain, BookOpen, CircleHelp, Eye, Lightbulb, RotateCcw, Sparkles,
  Wifi, WifiOff, X, Check, ChevronRight, Heart, Target
} from "lucide-react";

type Player = { name: string; symbol: "X" | "O" };
type Card = { id: number; pair: string; face: string; label: string; kind: "mark" | "surprise" };
type Tab = "game" | "academic";

const iconPairs = [
  { pair: "x", face: "X", label: "Símbolo X", kind: "mark" as const },
  { pair: "o", face: "O", label: "Símbolo O", kind: "mark" as const },
  { pair: "eye", face: "◉", label: "Percepção", kind: "surprise" as const },
  { pair: "star", face: "✦", label: "Atenção", kind: "surprise" as const },
  { pair: "spiral", face: "◎", label: "Memória", kind: "surprise" as const },
  { pair: "spark", face: "✧", label: "Cognição", kind: "surprise" as const },
];

function makeDeck(): Card[] {
  const cards: Card[] = [];
  iconPairs.forEach((item) => {
    for (let i = 0; i < 4; i++) {
      cards.push({ ...item, id: cards.length + 1 });
    }
  });
  return cards.sort(() => Math.random() - 0.5);
}

const concepts = [
  { title: "Memória", icon: Brain, text: "É a capacidade de codificar, armazenar e recuperar informações. No jogo, ela aparece quando tentamos lembrar onde cada carta está." },
  { title: "Atenção seletiva", icon: Eye, text: "É o processo de priorizar determinados estímulos e filtrar distrações. Observar as cartas viradas exige foco no que é relevante." },
  { title: "Percepção", icon: Target, text: "É a organização e interpretação das informações captadas pelos sentidos. Reconhecer figuras e diferenças faz parte desse processo." },
  { title: "Estratégia", icon: Lightbulb, text: "Envolve planejar ações a partir das informações disponíveis. Cada escolha no tabuleiro considera possibilidades e consequências." },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("game");
  const [players, setPlayers] = useState<Player[]>([
    { name: "Jogador 1", symbol: "X" }, { name: "Jogador 2", symbol: "O" }
  ]);
  const [started, setStarted] = useState(false);
  const [deck, setDeck] = useState<Card[]>(makeDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [scores, setScores] = useState([0, 0]);
  const [turn, setTurn] = useState(0);
  const [pendingMove, setPendingMove] = useState(false);
  const [message, setMessage] = useState("Clique em “Embaralhar e começar” para iniciar a partida.");
  const [roundOver, setRoundOver] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const winner = useMemo(() => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return board.every(Boolean) ? "draw" : null;
  }, [board]);

  useEffect(() => {
    if (!winner) return;
    setRoundOver(true);
    if (winner !== "draw") {
      const winnerIndex = players.findIndex((p) => p.symbol === winner);
      setScores((prev) => prev.map((score, i) => i === winnerIndex ? score + 1 : score));
      setMessage(`${players[winnerIndex].name} venceu a rodada!`);
    } else {
      setMessage("Deu velha! O tabuleiro ficou completo.");
    }
  }, [winner]); // eslint-disable-line react-hooks/exhaustive-deps

  function startGame() {
    setDeck(makeDeck()); setFlipped([]); setMatched([]); setBoard(Array(9).fill(null));
    setTurn(0); setPendingMove(false); setRoundOver(false); setStarted(true);
    setMessage(`${players[0].name} começa! Encontre um par de cartas.`);
  }

  function chooseCard(id: number) {
    if (!started || roundOver || pendingMove || flipped.length === 2 || flipped.includes(id) || matched.includes(id)) return;
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length === 2) {
      const first = deck.find((c) => c.id === next[0])!;
      const second = deck.find((c) => c.id === next[1])!;
      if (first.pair === second.pair) {
        window.setTimeout(() => {
          setMatched((prev) => [...prev, ...next]);
          setFlipped([]);
          setPendingMove(true);
          setMessage(first.kind === "surprise"
            ? `Par de ${first.label.toLowerCase()} encontrado! Escolha uma casa no tabuleiro.`
            : `Par encontrado! Agora escolha uma casa no tabuleiro.`);
        }, 450);
      } else {
        window.setTimeout(() => {
          setFlipped([]);
          setTurn((prev) => 1 - prev);
          setMessage(`Não foi dessa vez. Agora é a vez de ${players[1 - turn].name}.`);
        }, 950);
      }
    }
  }

  function placeMark(index: number) {
    if (!pendingMove || board[index] || roundOver) return;
    const next = [...board]; next[index] = players[turn].symbol; setBoard(next);
    setPendingMove(false);
    if (!next.every(Boolean)) setMessage(`${players[turn].name}, jogada registrada! Continue encontrando pares.`);
  }

  function resetRound() {
    setBoard(Array(9).fill(null)); setDeck(makeDeck()); setFlipped([]); setMatched([]);
    setTurn(0); setPendingMove(false); setRoundOver(false); setStarted(true);
    setMessage(`${players[0].name} começa uma nova rodada!`);
  }

  function resetAll() {
    setStarted(false); setScores([0, 0]); setBoard(Array(9).fill(null)); setDeck(makeDeck());
    setFlipped([]); setMatched([]); setTurn(0); setPendingMove(false); setRoundOver(false);
    setMessage("Clique em “Embaralhar e começar” para iniciar a partida.");
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow">UM JOGO DE MEMÓRIA E ESTRATÉGIA</div>
          <h1>Jogo da Velha<br/>Memória <span className="brain-emoji">🧠</span></h1>
          <p>Encontre os pares, observe as posições e conquiste seu espaço no tabuleiro. Quem será que tem a melhor memória?</p>
        </div>
        <div className="hero-mark" aria-hidden="true"><img src="/logo-psicologia.png" alt="" /></div>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
      </header>

      <nav className="tabs" aria-label="Navegação principal">
        <button className={tab === "game" ? "tab active" : "tab"} onClick={() => setTab("game")}><span>🎮</span> Jogar</button>
        <button className={tab === "academic" ? "tab active" : "tab"} onClick={() => setTab("academic")}><span>🧠</span> Área acadêmica</button>
      </nav>

      {tab === "game" ? (
        <section className="content">
          <section className="setup panel">
            <div className="section-heading"><div><h2>Antes de começar</h2><p>Dois jogadores, um dispositivo e uma disputa de memória. Escolham seus nomes e símbolos!</p></div><span className="pill"><Heart size={15}/> Juntos no mesmo dispositivo</span></div>
            <div className="player-fields">
              {players.map((player, index) => (
                <label className="field" key={player.symbol}>
                  <span>JOGADOR {player.symbol}</span>
                  <input value={player.name} maxLength={24} onChange={(e) => setPlayers((prev) => prev.map((p, i) => i === index ? { ...p, name: e.target.value } : p))} disabled={started && !roundOver} />
                </label>
              ))}
            </div>
            <div className="setup-actions">
              <button className="primary" onClick={startGame}>Embaralhar e começar <ChevronRight size={18}/></button>
              <button className="secondary" onClick={() => setShowRules(true)}><CircleHelp size={18}/> Como jogar?</button>
              {started && <button className="text-button" onClick={resetAll}>Encerrar partida</button>}
            </div>
          </section>

          <section className="turn-banner">
            <div><strong>{roundOver ? "Rodada finalizada" : `${players[turn].name} está na vez!`}</strong><span>{roundOver ? message : pendingMove ? "Par encontrado: escolha uma casa vazia." : "Encontre um par de cartas."}</span></div>
            <span className={`symbol-badge ${players[turn].symbol.toLowerCase()}`}>SÍMBOLO {players[turn].symbol}</span>
          </section>

          <div className="game-layout">
            <section className="panel board-panel">
              <div className="panel-title"><div><h2>Tabuleiro</h2><p>Quando encontrar seu par, escolha uma casa vazia.</p></div><span className="tiny-tag">3 × 3</span></div>
              <div className="board">
                {board.map((mark, index) => <button key={index} className={`board-cell ${mark ? "occupied" : ""} ${mark?.toLowerCase() || ""} ${pendingMove && !mark ? "selectable" : ""}`} onClick={() => placeMark(index)} disabled={!pendingMove || !!mark || roundOver} aria-label={`Casa ${index + 1}${mark ? `, ${mark}` : ", vazia"}`}>{mark && <span>{mark}</span>}</button>)}
              </div>
              <div className="score-grid">
                {players.map((p, i) => <div className="score-card" key={p.symbol}><span>{scores[i]}</span><small>{p.name} · {p.symbol}</small></div>)}
              </div>
              <div className="game-message">{pendingMove ? <Sparkles size={17}/> : <Brain size={17}/>} {message}</div>
              <button className="secondary reset-button" onClick={resetRound}><RotateCcw size={17}/> Reiniciar rodada</button>
            </section>

            <section className="panel cards-panel">
              <div className="panel-title"><div><h2>Cartas da memória</h2><p>Observe bem onde cada figura aparece. São 24 cartas: pares de X, O e figuras-surpresa.</p></div><span className="counter">{matched.length / 2} / 12 pares</span></div>
              <div className="cards-grid">
                {deck.map((card) => {
                  const isUp = flipped.includes(card.id) || matched.includes(card.id);
                  return <button key={card.id} className={`memory-card ${isUp ? "revealed" : ""} ${matched.includes(card.id) ? "matched" : ""}`} onClick={() => chooseCard(card.id)} disabled={!started || isUp || pendingMove || roundOver || flipped.length === 2} aria-label={isUp ? card.label : "Virar carta"}>
                    {isUp ? <><span className={`card-face ${card.pair}`}>{card.face}</span><small>{card.label}</small></> : <span className="card-back">Ψ</span>}
                  </button>;
                })}
              </div>
              {!started && <div className="cards-overlay"><Brain size={25}/><strong>As cartas estão esperando por você.</strong><span>Boa sorte! ✨</span></div>}
              {started && <div className="cards-hint"><Sparkles size={16}/> Memorize as posições — até mesmo quando não for sua vez.</div>}
            </section>
          </div>

          <div className="tip"><Lightbulb size={20}/><span><strong>Dica:</strong> preste atenção também nas cartas viradas pelo outro jogador. Sua memória pode guardar informações mesmo quando não é sua vez!</span></div>
          <section className="panel psychology-strip"><div className="psych-title"><h2>Um toque de Psicologia</h2><span>✦</span></div><div className="concept-chips"><span>Freud tentando lembrar o sonho: 🤔</span><span>Atenção seletiva ativada 👀</span><span>O hipocampo trabalhando 🧠</span><span>Ψ Psicologia em jogo!</span></div></section>
        </section>
      ) : (
        <section className="content academic">
          <div className="academic-intro panel"><span className="academic-icon"><BookOpen size={25}/></span><div><p className="eyebrow purple">APRENDER JOGANDO</p><h2>O que acontece na mente durante uma partida?</h2><p>O jogo é um convite para observar processos cognitivos presentes no nosso dia a dia.</p></div></div>
          <div className="concept-grid">
            {concepts.map(({ title, icon: Icon, text }) => <article className="concept-card panel" key={title}><span className="concept-icon"><Icon size={23}/></span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
          <div className="academic-note"><Sparkles size={19}/><p><strong>Para refletir:</strong> quais estratégias você utilizou para lembrar a posição das cartas? O que ajudou ou atrapalhou sua concentração?</p></div>
        </section>
      )}

      <footer className="footer">
        <div className="footer-credit"><span>REALIZAÇÃO</span><a className="evelyn-logo-link" href="https://www.instagram.com/evelyn.namidia" target="_blank" rel="noreferrer" aria-label="Instagram Evelyn G. Marketing Digital"><img src="/evelyn-g-marketing.png" alt="Evelyn G. Marketing Digital"/></a><a className="instagram" href="https://www.instagram.com/evelyn.namidia" target="_blank" rel="noreferrer">@evelyn.namidia</a></div>
        <div className="footer-meta"><span>Jogo da Velha Memória</span><span>Psicologia · Memória · Estratégia</span><span className="offline-indicator">{online ? <Wifi size={14}/> : <WifiOff size={14}/>} {online ? "Conectado" : "Modo offline"}</span></div>
      </footer>

      {showRules && <div className="modal-backdrop" role="presentation" onClick={() => setShowRules(false)}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}><button className="close-modal" onClick={() => setShowRules(false)} aria-label="Fechar"><X size={20}/></button><span className="modal-icon"><BookOpen size={24}/></span><h2 id="rules-title">Como jogar?</h2><ol><li>Dois participantes jogam no mesmo dispositivo e escolhem seus nomes.</li><li>Na sua vez, vire duas cartas e tente encontrar um par.</li><li>Ao encontrar um par, escolha uma casa vazia no tabuleiro para marcar seu símbolo.</li><li>Se não encontrar um par, as cartas voltam e a vez passa para o outro jogador.</li><li>Vence a rodada quem formar uma linha com três símbolos iguais — na horizontal, vertical ou diagonal.</li></ol><p className="rule-note">Dica: observe as cartas abertas pelo outro jogador. Memória também é estratégia!</p><button className="primary full" onClick={() => setShowRules(false)}>Entendi <Check size={18}/></button></section></div>}
    </main>
  );
}
