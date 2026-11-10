import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { academicApi, type AcademicEvaluation, type AcademicMetrics, type AcademicSession } from "./lib/academicApi";
import {
  Brain, BookOpen, CircleHelp, Eye, Lightbulb, RotateCcw, Sparkles,
  Wifi, WifiOff, X, Check, ChevronRight, Heart, Target
} from "lucide-react";

type Player = { name: string; symbol: "X" | "O" };
type Card = { id: number; pair: string; face: string; label: string; kind: "mark" | "surprise" };
type Tab = "game" | "academic";
type SavedMatch = { id: string; savedAt: string; player1_name: string; player2_name: string; player1_metrics: AcademicMetrics; player2_metrics: AcademicMetrics; };

const iconPairs = [
  { pair: "x", face: "X", label: "Símbolo X", kind: "mark" as const },
  { pair: "o", face: "O", label: "Símbolo O", kind: "mark" as const },
  { pair: "eye", face: "◉", label: "Percepção", kind: "surprise" as const },
  { pair: "star", face: "✦", label: "Atenção", kind: "surprise" as const },
  { pair: "spiral", face: "◎", label: "Memória", kind: "surprise" as const },
  { pair: "spark", face: "✧", label: "Cognição", kind: "surprise" as const },
  { pair: "heart", face: "♥", label: "Emoção", kind: "surprise" as const },
  { pair: "moon", face: "☾", label: "Atenção", kind: "surprise" as const },
  { pair: "diamond", face: "◆", label: "Reconhecimento", kind: "surprise" as const },
  { pair: "triangle", face: "▲", label: "Planejamento", kind: "surprise" as const },
  { pair: "circle", face: "●", label: "Associação", kind: "surprise" as const },
  { pair: "wave", face: "〰", label: "Aprendizagem", kind: "surprise" as const },
];

function makeDeck(): Card[] {
  const cards: Card[] = [];
  iconPairs.forEach((item) => {
    for (let i = 0; i < 2; i++) {
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
  { title: "Memória e hipocampo", icon: Brain, text: "O hipocampo participa da formação e consolidação de novas memórias. O jogo permite observar comportamentos relacionados à lembrança e à aprendizagem, mas não mede a atividade cerebral nem avalia o funcionamento dessa estrutura." },
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
  const [metrics, setMetrics] = useState([{ attempts: 0, pairs: 0, errors: 0, moves: 0 }, { attempts: 0, pairs: 0, errors: 0, moves: 0 }]);
  const [turn, setTurn] = useState(0);
  const [pendingMove, setPendingMove] = useState(false);
  const [message, setMessage] = useState("Clique em “Embaralhar e começar” para iniciar a partida.");
  const [roundOver, setRoundOver] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [showRules, setShowRules] = useState(false);
  const [session, setSession] = useState<AcademicSession | null>(() => academicApi.getSession());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [academicBusy, setAcademicBusy] = useState(false);
  const [academicError, setAcademicError] = useState("");
  const [evaluations, setEvaluations] = useState<AcademicEvaluation[]>([]);
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [observations, setObservations] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>(() => {
    try { return JSON.parse(localStorage.getItem("psicopatologia_saved_matches") || "[]").slice(0, 5) as SavedMatch[]; }
    catch { return []; }
  });
  const [selectedSavedMatchId, setSelectedSavedMatchId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("psicopatologia_saved_matches", JSON.stringify(savedMatches));
  }, [savedMatches]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (tab !== "academic" || !session) return;
    setAcademicBusy(true);
    academicApi.listEvaluations(session).then(setEvaluations).catch((error: Error) => setAcademicError(error.message)).finally(() => setAcademicBusy(false));
  }, [tab, session]);

  async function handleAcademicLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setAcademicBusy(true); setAcademicError("");
    try { const next = await academicApi.signIn(loginEmail.trim(), loginPassword); setSession(next); setLoginPassword(""); setLoginEmail(""); }
    catch (error) { setAcademicError(error instanceof Error ? error.message : "Não foi possível entrar."); }
    finally { setAcademicBusy(false); }
  }

  function saveCurrentMatch() {
    if (!started) return;
    if (savedMatches.length >= 5) {
      setMessage("Você já salvou 5 partidas. A administração precisa registrar ou remover uma delas antes de salvar outra.");
      return;
    }
    const toMetrics = (m: { attempts:number; pairs:number; errors:number; moves:number }): AcademicMetrics => ({ ...m, precision: m.attempts ? Math.round(m.pairs / m.attempts * 100) : 0 });
    const snapshot: SavedMatch = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      player1_name: players[0].name.trim() || "Jogador 1",
      player2_name: players[1].name.trim() || "Jogador 2",
      player1_metrics: toMetrics(metrics[0]),
      player2_metrics: toMetrics(metrics[1])
    };
    setSavedMatches((current) => [...current, snapshot]);
    setMessage(`Partida de ${snapshot.player1_name} e ${snapshot.player2_name} salva para avaliação.`);
  }

  function selectSavedMatch(match: SavedMatch) {
    setSelectedSavedMatchId(match.id);
    setEditingId(null);
    setPlayer1Name(match.player1_name);
    setPlayer2Name(match.player2_name);
    setObservations("");
    setAcademicError("");
  }

  async function handleSaveEvaluation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!session) return;
    setAcademicBusy(true); setAcademicError("");
    const toMetrics = (m: { attempts:number; pairs:number; errors:number; moves:number }): AcademicMetrics => ({ ...m, precision: m.attempts ? Math.round(m.pairs / m.attempts * 100) : 0 });
    try {
      const existing = editingId ? evaluations.find((item) => item.id === editingId) : undefined;
      const selectedMatch = selectedSavedMatchId ? savedMatches.find((item) => item.id === selectedSavedMatchId) : undefined;
      await academicApi.saveEvaluation(session, {
        id: editingId,
        player1_name: player1Name.trim() || players[0].name,
        player2_name: player2Name.trim() || players[1].name,
        player1_metrics: selectedMatch?.player1_metrics || existing?.player1_metrics || toMetrics(metrics[0]),
        player2_metrics: selectedMatch?.player2_metrics || existing?.player2_metrics || toMetrics(metrics[1]),
        observations
      });
      setEvaluations(await academicApi.listEvaluations(session));
      if (selectedMatch) setSavedMatches((current) => current.filter((item) => item.id !== selectedMatch.id));
      setPlayer1Name(""); setPlayer2Name(""); setObservations(""); setEditingId(null); setSelectedSavedMatchId(null);
    } catch (error) { setAcademicError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setAcademicBusy(false); }
  }

  function editEvaluation(item: AcademicEvaluation) {
    setEditingId(item.id); setSelectedSavedMatchId(null); setPlayer1Name(item.player1_name); setPlayer2Name(item.player2_name); setObservations(item.observations || "");
  }

  async function removeEvaluation(id: string) {
    if (!session || !window.confirm("Excluir esta avaliação?")) return;
    setAcademicBusy(true); setAcademicError("");
    try { await academicApi.deleteEvaluation(session, id); setEvaluations(await academicApi.listEvaluations(session)); }
    catch (error) { setAcademicError(error instanceof Error ? error.message : "Não foi possível excluir."); }
    finally { setAcademicBusy(false); }
  }

  async function logoutAcademic() {
    await academicApi.signOut(); setSession(null); setEvaluations([]); setAcademicError("");
  }

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
    setMetrics([{ attempts: 0, pairs: 0, errors: 0, moves: 0 }, { attempts: 0, pairs: 0, errors: 0, moves: 0 }]);
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
      setMetrics((prev) => prev.map((item, i) => i === turn ? { ...item, attempts: item.attempts + 1, ...(first.pair === second.pair ? { pairs: item.pairs + 1 } : { errors: item.errors + 1 }) } : item));
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
    setMetrics((prev) => prev.map((item, i) => i === turn ? { ...item, moves: item.moves + 1 } : item));
    setPendingMove(false);
    if (!next.every(Boolean)) setMessage(`${players[turn].name}, jogada registrada! Continue encontrando pares.`);
  }

  function resetRound() {
    setBoard(Array(9).fill(null)); setDeck(makeDeck()); setFlipped([]); setMatched([]);
    setTurn(0); setPendingMove(false); setRoundOver(false); setStarted(true); setMetrics([{ attempts: 0, pairs: 0, errors: 0, moves: 0 }, { attempts: 0, pairs: 0, errors: 0, moves: 0 }]);
    setMessage(`${players[0].name} começa uma nova rodada!`);
  }

  function resetAll() {
    setStarted(false); setScores([0, 0]); setMetrics([{ attempts: 0, pairs: 0, errors: 0, moves: 0 }, { attempts: 0, pairs: 0, errors: 0, moves: 0 }]); setBoard(Array(9).fill(null)); setDeck(makeDeck());
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
              <div className="performance-grid" aria-label="Indicadores da partida">
                {players.map((p, i) => <div className="performance-card" key={p.symbol}><strong>{p.name}</strong><span>{metrics[i].pairs} pares encontrados</span><span>{metrics[i].errors} tentativas sem par</span><span>{metrics[i].moves} jogadas no tabuleiro</span><small>Precisão nas tentativas: {metrics[i].attempts ? Math.round(metrics[i].pairs / metrics[i].attempts * 100) : 0}%</small></div>)}
              </div>
              <div className="game-message">{pendingMove ? <Sparkles size={17}/> : <Brain size={17}/>} {message}</div>
              <div className="setup-actions"><button className="primary" onClick={saveCurrentMatch} disabled={!started || !metrics.some((item) => item.attempts > 0 || item.moves > 0) || savedMatches.length >= 5}>Salvar partida para avaliação ({savedMatches.length}/5)</button></div>
              <button className="secondary reset-button" onClick={resetRound}><RotateCcw size={17}/> Reiniciar rodada</button>
            </section>

            <section className="panel cards-panel">
              <div className="panel-title"><div><h2>Cartas da memória</h2><p>Observe bem onde cada figura aparece. São 24 cartas, organizadas em 12 pares de X, O e figuras-surpresa.</p></div><span className="counter">{matched.length / 2} / 12 pares</span></div>
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

          <div className="tip"><Lightbulb size={20}/><span><strong>Indicadores de desempenho:</strong> os dados mostram resultados observáveis durante esta partida — tentativas, pares, erros e jogadas. Eles são recursos didáticos, não testes neuropsicológicos ou diagnósticos, e não medem diretamente a atividade do hipocampo.</span></div>
          <section className="panel psychology-strip"><div className="psych-title"><h2>Um toque de Psicologia</h2><span>✦</span></div><div className="concept-chips"><span>Memória em ação 🧠</span><span>Atenção seletiva ativada 👀</span><span>Aprendizagem em construção ✨</span><span>Ψ Psicologia em jogo!</span></div></section>
        </section>
      ) : (
        <section className="content academic">
          <div className="academic-intro panel"><span className="academic-icon"><BookOpen size={25}/></span><div><p className="eyebrow purple">APRENDER JOGANDO</p><h2>O que acontece na mente durante uma partida?</h2><p>O jogo é um convite para observar processos cognitivos presentes no nosso dia a dia.</p></div></div>
          <div className="concept-grid">
            {concepts.map(({ title, icon: Icon, text }) => <article className="concept-card panel" key={title}><span className="concept-icon"><Icon size={23}/></span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
          <div className="academic-note"><Sparkles size={19}/><p><strong>Para refletir:</strong> quais estratégias você utilizou para lembrar a posição das cartas? O que ajudou ou atrapalhou sua concentração?</p></div>
          <section className="academic-workspace panel">
            {!session ? <form className="academic-login" onSubmit={handleAcademicLogin}>
              <p className="eyebrow purple">ACESSO RESTRITO</p><h2>Área de avaliação acadêmica</h2>
              <p>Entre com o e-mail e a senha cadastrados. O acesso é limitado às três avaliadoras autorizadas.</p>
              <label className="field"><span>E-MAIL</span><input type="email" autoComplete="username" required value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="seuemail@exemplo.com"/></label>
              <label className="field"><span>SENHA</span><input type="password" autoComplete="current-password" required value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Sua senha"/></label>
              {academicError && <p className="academic-error" role="alert">{academicError}</p>}
              <button className="primary" type="submit" disabled={academicBusy}>{academicBusy ? "Entrando..." : "Entrar na área acadêmica"}</button>
            </form> : <div className="academic-dashboard">
              <div className="academic-dashboard-head"><div><p className="eyebrow purple">AMBIENTE DAS AVALIADORAS</p><h2>Registros e observações</h2><p>Sessão: {session.email}</p></div><button className="secondary" onClick={logoutAcademic}>Sair</button></div>
              <section className="pending-matches">
                <div className="pending-matches-heading"><h3>Partidas aguardando avaliação</h3><span>{savedMatches.length}/5 salvas</span></div>
                <p>As partidas ficam guardadas neste dispositivo até serem registradas no histórico acadêmico.</p>
                {savedMatches.length === 0 ? <p className="pending-empty">Nenhuma partida aguardando avaliação. Salve uma partida na tela do jogo para trazê-la para cá.</p> : savedMatches.map((match) => <article className="pending-match" key={match.id}>
                  <div className="pending-match-data"><strong>{match.player1_name} × {match.player2_name}</strong><small>{new Date(match.savedAt).toLocaleString("pt-BR")}</small><small>Jogador 1: {match.player1_metrics.pairs} pares · {match.player1_metrics.errors} erros · {match.player1_metrics.moves} jogadas · {match.player1_metrics.precision}% de precisão</small><small>Jogador 2: {match.player2_metrics.pairs} pares · {match.player2_metrics.errors} erros · {match.player2_metrics.moves} jogadas · {match.player2_metrics.precision}% de precisão</small></div>
                  <button type="button" className="secondary" onClick={() => selectSavedMatch(match)}>Avaliar esta partida</button>
                </article>)}
              </section>
              <form className="evaluation-form" onSubmit={handleSaveEvaluation}>
                <h3>{editingId ? "Editar avaliação" : selectedSavedMatchId ? "Avaliar partida salva" : "Nova avaliação"}</h3>
                {selectedSavedMatchId && <p className="selected-match-note">Os indicadores desta avaliação serão os dados capturados quando a partida foi salva.</p>}
                <div className="player-fields">
                  <label className="field"><span>NOME DO JOGADOR 1</span><input value={player1Name} onChange={e=>setPlayer1Name(e.target.value)} placeholder={players[0].name}/></label>
                  <label className="field"><span>NOME DO JOGADOR 2</span><input value={player2Name} onChange={e=>setPlayer2Name(e.target.value)} placeholder={players[1].name}/></label>
                </div>
                <label className="field"><span>OBSERVAÇÕES, TEXTOS E AVALIAÇÃO</span><textarea rows={5} value={observations} onChange={e=>setObservations(e.target.value)} placeholder="Registre observações sobre atenção, memória, percepção, estratégia e comportamentos observados..."/></label>
                <p className="academic-disclaimer">Os indicadores da partida são comportamentais e didáticos; não constituem diagnóstico nem avaliação neuropsicológica.</p>
                {academicError && <p className="academic-error" role="alert">{academicError}</p>}
                <div className="setup-actions"><button className="primary" type="submit" disabled={academicBusy}>{academicBusy ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar avaliação"}</button>{(editingId || selectedSavedMatchId) && <button type="button" className="secondary" onClick={()=>{setEditingId(null);setSelectedSavedMatchId(null);setPlayer1Name("");setPlayer2Name("");setObservations("");}}>Cancelar</button>}</div>
              </form>
              <div className="saved-evaluations"><h3>Avaliações registradas</h3>{academicBusy && <p>Carregando...</p>}{!academicBusy && evaluations.length===0 && <p>Nenhuma avaliação salva ainda.</p>}
                {evaluations.map(item=><article className="saved-evaluation" key={item.id}><div><strong>{item.player1_name} × {item.player2_name}</strong><small>{new Date(item.created_at).toLocaleString("pt-BR")}</small><p>{item.observations || "Sem observações."}</p><small>Jogador 1: {item.player1_metrics?.pairs ?? 0} pares · {item.player1_metrics?.errors ?? 0} erros · {item.player1_metrics?.moves ?? 0} jogadas · {item.player1_metrics?.precision ?? 0}% de precisão</small><small>Jogador 2: {item.player2_metrics?.pairs ?? 0} pares · {item.player2_metrics?.errors ?? 0} erros · {item.player2_metrics?.moves ?? 0} jogadas · {item.player2_metrics?.precision ?? 0}% de precisão</small></div><div className="saved-actions"><button className="secondary" onClick={()=>editEvaluation(item)}>Editar</button><button className="text-button" onClick={()=>removeEvaluation(item.id)}>Excluir</button></div></article>)}
              </div>
            </div>}
          </section>
        </section>
      )}

      <footer className="footer">
        <div className="footer-credit"><span>IDEALIZADO E DESENVOLVIDO POR</span><strong className="signature">Linda Gomes</strong><a className="evelyn-logo-link" href="https://www.instagram.com/evelyn.namidia" target="_blank" rel="noreferrer" aria-label="Instagram Evelyn G. Marketing Digital"><img src="/Logomarca%20Evelyn%20G-%20Fundo%20escuro.png" alt="Evelyn G. Marketing Digital"/></a><a className="instagram" href="https://www.instagram.com/evelyn.namidia" target="_blank" rel="noreferrer">@evelyn.namidia</a></div>
        <div className="footer-meta"><span>Um projeto acadêmico que une conhecimento, tecnologia e aprendizagem.</span><span className="offline-indicator">{online ? <Wifi size={14}/> : <WifiOff size={14}/>} {online ? "Conectado" : "Modo offline"}</span></div>
      </footer>

      {showRules && <div className="modal-backdrop" role="presentation" onClick={() => setShowRules(false)}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}><button className="close-modal" onClick={() => setShowRules(false)} aria-label="Fechar"><X size={20}/></button><span className="modal-icon"><BookOpen size={24}/></span><h2 id="rules-title">Como jogar?</h2><ol><li>Dois participantes jogam no mesmo dispositivo e escolhem seus nomes.</li><li>Na sua vez, vire duas cartas e tente encontrar um par.</li><li>Ao encontrar um par, escolha uma casa vazia no tabuleiro para marcar seu símbolo.</li><li>Se não encontrar um par, as cartas voltam e a vez passa para o outro jogador.</li><li>Vence a rodada quem formar uma linha com três símbolos iguais — na horizontal, vertical ou diagonal.</li></ol><p className="rule-note">Dica: observe as cartas abertas pelo outro jogador. Memória também é estratégia!</p><button className="primary full" onClick={() => setShowRules(false)}>Entendi <Check size={18}/></button></section></div>}
    </main>
  );
}
