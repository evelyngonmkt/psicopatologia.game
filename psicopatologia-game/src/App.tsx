import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { academicApi, type AcademicEvaluation, type AcademicMetrics, type AcademicSession, type PendingMatch } from "./lib/academicApi";
import {
  Brain, BookOpen, CircleHelp, Eye, Lightbulb, RotateCcw, Sparkles,
  Wifi, WifiOff, X, Check, ChevronRight, Heart, Target
} from "lucide-react";

type Player = { name: string; symbol: "X" | "O" };
type Card = { id: number; pair: string; face: string; label: string; kind: "mark" | "surprise" };
type Tab = "game" | "academic";
type SavedMatch = { id: string; remoteId?: string; synced?: boolean; savedAt: string; player1_name: string; player2_name: string; player1_metrics: AcademicMetrics; player2_metrics: AcademicMetrics; session_id?: string; session_started_at?: string; session_ends_at?: string; difficulty?: "easy" | "medium" | "hard"; };
type ObservationSession = { id: string; startedAt: string; endsAt: string };

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

function getMatchResult(match: Pick<SavedMatch, "player1_name" | "player2_name" | "player1_metrics" | "player2_metrics">): string {
  const player1Pairs = match.player1_metrics?.pairs || 0;
  const player2Pairs = match.player2_metrics?.pairs || 0;
  if (player1Pairs === player2Pairs) return "Empate";
  return player1Pairs > player2Pairs ? match.player1_name : match.player2_name;
}

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
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [previewing, setPreviewing] = useState(false);
  const [observationSession, setObservationSession] = useState<ObservationSession | null>(null);
  const [sessionRemaining, setSessionRemaining] = useState(600);
  const [isSavingMatch, setIsSavingMatch] = useState(false);
  const savingMatchRef = useRef(false);
  const [selectedAnalysisSessionId, setSelectedAnalysisSessionId] = useState("");
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
    localStorage.setItem("psicopatologia_saved_matches", JSON.stringify(savedMatches.filter((match) => !match.remoteId && !match.synced)));
  }, [savedMatches]);

  useEffect(() => {
    if (!observationSession) return;
    const updateRemaining = () => setSessionRemaining(Math.max(0, Math.ceil((new Date(observationSession.endsAt).getTime() - Date.now()) / 1000)));
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [observationSession]);

  useEffect(() => {
    if (!previewing) return;
    const duration = difficulty === "hard" ? 4000 : difficulty === "medium" ? 7000 : 10000;
    const timer = window.setTimeout(() => {
      setFlipped([]);
      setPreviewing(false);
      setMessage(`${players[0].name} começa! Encontre um par de cartas.`);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [previewing, difficulty]);

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
    Promise.all([academicApi.listEvaluations(session), academicApi.listPendingMatches(session)]).then(([saved, pending]) => {
      setEvaluations(saved);
      const remote: SavedMatch[] = pending.map((item: PendingMatch) => ({ id: item.id, remoteId: item.id, savedAt: item.saved_at, player1_name: item.player1_name, player2_name: item.player2_name, player1_metrics: item.player1_metrics, player2_metrics: item.player2_metrics, session_id: item.session_id, session_started_at: item.session_started_at, session_ends_at: item.session_ends_at, difficulty: item.difficulty }));
      setSavedMatches((local) => [...remote, ...local.filter((item) => !item.remoteId)]);
    }).catch((error: Error) => setAcademicError(error.message)).finally(() => setAcademicBusy(false));
  }, [tab, session]);

  async function handleAcademicLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setAcademicBusy(true); setAcademicError("");
    try { const next = await academicApi.signIn(loginEmail.trim(), loginPassword); setSession(next); setLoginPassword(""); setLoginEmail(""); }
    catch (error) { setAcademicError(error instanceof Error ? error.message : "Não foi possível entrar."); }
    finally { setAcademicBusy(false); }
  }

  async function saveCurrentMatch() {
    if (savingMatchRef.current || !started || !observationSession) return;
    if (sessionRemaining <= 0) { setMessage("O tempo da sessão terminou. Inicie uma nova sessão para continuar."); return; }
    if (savedMatches.filter((item) => item.session_id === observationSession.id || !item.session_id).length >= 5) {
      setMessage("Você já salvou 5 partidas nesta sessão.");
      return;
    }
    savingMatchRef.current = true;
    setIsSavingMatch(true);
    const toMetrics = (m: { attempts:number; pairs:number; errors:number; moves:number }): AcademicMetrics => ({ ...m, precision: m.attempts ? Math.round(m.pairs / m.attempts * 100) : 0 });
    const snapshot: SavedMatch = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      session_id: observationSession.id, session_started_at: observationSession.startedAt, session_ends_at: observationSession.endsAt, difficulty,
      player1_name: players[0].name.trim() || "Jogador 1",
      player2_name: players[1].name.trim() || "Jogador 2",
      player1_metrics: toMetrics(metrics[0]),
      player2_metrics: toMetrics(metrics[1])
    };
    try {
      await academicApi.submitPendingMatch({ client_match_id: snapshot.id, session_id: snapshot.session_id!, session_started_at: snapshot.session_started_at!, session_ends_at: snapshot.session_ends_at!, player1_name: snapshot.player1_name, player2_name: snapshot.player2_name, difficulty: snapshot.difficulty!, player1_metrics: snapshot.player1_metrics, player2_metrics: snapshot.player2_metrics });
      snapshot.synced = true;
      setSavedMatches((current) => current.some((item) => item.id === snapshot.id) ? current : [...current, snapshot]);
      setMessage("Partida enviada para avaliação acadêmica com sucesso.");
    } catch (error) {
      setSavedMatches((current) => current.some((item) => item.id === snapshot.id) ? current : [...current, snapshot]);
      setMessage(`Não foi possível sincronizar agora. A partida ficou salva neste dispositivo: ${error instanceof Error ? error.message : "erro de conexão"}`);
    } finally {
      savingMatchRef.current = false;
      setIsSavingMatch(false);
    }
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
      if (selectedMatch) {
        if (session && selectedMatch.remoteId) await academicApi.deletePendingMatch(session, selectedMatch.remoteId);
        setSavedMatches((current) => current.filter((item) => item.id !== selectedMatch.id));
      }
      setPlayer1Name(""); setPlayer2Name(""); setObservations(""); setObservationRatings({ ...emptyRatings }); setEditingId(null); setSelectedSavedMatchId(null);
    } catch (error) { setAcademicError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setAcademicBusy(false); }
  }

  function editEvaluation(item: AcademicEvaluation) {
    const stored = readStoredObservation(item.observations);\n    setEditingId(item.id); setSelectedSavedMatchId(null); setPlayer1Name(item.player1_name); setPlayer2Name(item.player2_name); setObservations(stored.notes); setObservationRatings(stored.ratings);
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

  const pendingSessionGroups = useMemo(() => {
    const groups = new Map<string, SavedMatch[]>();
    savedMatches.forEach((match) => {
      const key = match.session_id || "legacy";
      groups.set(key, [...(groups.get(key) || []), match]);
    });
    return Array.from(groups.entries()).map(([id, matches]) => ({ id, matches })).sort((a, b) => {
      const aDate = a.matches[0]?.session_started_at || a.matches[0]?.savedAt || "";
      const bDate = b.matches[0]?.session_started_at || b.matches[0]?.savedAt || "";
      return bDate.localeCompare(aDate);
    });
  }, [savedMatches]);
  const selectedAnalysisGroup = pendingSessionGroups.find((group) => group.id === selectedAnalysisSessionId) || pendingSessionGroups[0];
  const sessionAnalysis = useMemo(() => {
    if (!selectedAnalysisGroup) return null;
    const total = (key: "player1_metrics" | "player2_metrics") => selectedAnalysisGroup.matches.reduce((acc, match) => ({
      attempts: acc.attempts + (match[key]?.attempts || 0),
      pairs: acc.pairs + (match[key]?.pairs || 0),
      errors: acc.errors + (match[key]?.errors || 0),
      moves: acc.moves + (match[key]?.moves || 0)
    }), { attempts: 0, pairs: 0, errors: 0, moves: 0 });
    const player1 = total("player1_metrics");
    const player2 = total("player2_metrics");
    return {
      player1: { ...player1, precision: player1.attempts ? Math.round(player1.pairs / player1.attempts * 100) : 0 },
      player2: { ...player2, precision: player2.attempts ? Math.round(player2.pairs / player2.attempts * 100) : 0 }
    };
  }, [selectedAnalysisGroup]);
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
    if (!observationSession || Date.now() >= new Date(observationSession.endsAt).getTime()) {
      const startedAt = new Date();
      setObservationSession({ id: crypto.randomUUID(), startedAt: startedAt.toISOString(), endsAt: new Date(startedAt.getTime() + 10 * 60 * 1000).toISOString() });
      setSessionRemaining(600);
    }
    const nextDeck = makeDeck();
    setDeck(nextDeck); setFlipped(nextDeck.map((card) => card.id)); setMatched([]); setBoard(Array(9).fill(null));
    setMetrics([{ attempts: 0, pairs: 0, errors: 0, moves: 0 }, { attempts: 0, pairs: 0, errors: 0, moves: 0 }]);
    setTurn(0); setPendingMove(false); setRoundOver(false); setStarted(true); setPreviewing(true);
    setMessage("Memorize a posição das cartas!");
  }

  function chooseCard(id: number) {
    if (!started || sessionRemaining <= 0 || previewing || roundOver || pendingMove || flipped.length === 2 || flipped.includes(id) || matched.includes(id)) return;
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
    if (!pendingMove || board[index] || roundOver || sessionRemaining <= 0) return;
    const next = [...board]; next[index] = players[turn].symbol; setBoard(next);
    setMetrics((prev) => prev.map((item, i) => i === turn ? { ...item, moves: item.moves + 1 } : item));
    setPendingMove(false);
    if (!next.every(Boolean)) setMessage(`${players[turn].name}, jogada registrada! Continue encontrando pares.`);
  }

  function resetRound() {
    if (!observationSession || sessionRemaining <= 0) { setMessage("A sessão de 10 minutos terminou. Clique em “Embaralhar e começar” para iniciar outra."); return; }
    setBoard(Array(9).fill(null)); const nextDeck = makeDeck(); setDeck(nextDeck); setFlipped(nextDeck.map((card) => card.id)); setMatched([]);
    setTurn(0); setPendingMove(false); setRoundOver(false); setStarted(true); setPreviewing(true); setMessage("Memorize a posição das cartas!"); setMetrics([{ attempts: 0, pairs: 0, errors: 0, moves: 0 }, { attempts: 0, pairs: 0, errors: 0, moves: 0 }]);
  }

  function resetAll() {
    setStarted(false); setPreviewing(false); setScores([0, 0]); setMetrics([{ attempts: 0, pairs: 0, errors: 0, moves: 0 }, { attempts: 0, pairs: 0, errors: 0, moves: 0 }]); setBoard(Array(9).fill(null)); setDeck(makeDeck());
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
            <div className="difficulty-picker" aria-label="Escolha o nível de dificuldade">
              <span className="difficulty-label">NÍVEL DE DIFICULDADE</span>
              <div className="difficulty-options">
                <button type="button" className={difficulty === "easy" ? "difficulty-option selected" : "difficulty-option"} onClick={() => setDifficulty("easy")} disabled={started && !roundOver}>Fácil</button>
                <button type="button" className={difficulty === "medium" ? "difficulty-option selected" : "difficulty-option"} onClick={() => setDifficulty("medium")} disabled={started && !roundOver}>Médio</button>
                <button type="button" className={difficulty === "hard" ? "difficulty-option selected" : "difficulty-option"} onClick={() => setDifficulty("hard")} disabled={started && !roundOver}>Difícil</button>
              </div>
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
                {board.map((mark, index) => <button key={index} className={`board-cell ${mark ? "occupied" : ""} ${mark?.toLowerCase() || ""} ${pendingMove && !mark ? "selectable" : ""}`} onClick={() => placeMark(index)} disabled={!pendingMove || !!mark || roundOver || previewing} aria-label={`Casa ${index + 1}${mark ? `, ${mark}` : ", vazia"}`}>{mark && <span>{mark}</span>}</button>)}
              </div>
              <div className="score-grid">
                {players.map((p, i) => <div className="score-card" key={p.symbol}><span>{scores[i]}</span><small>{p.name} · {p.symbol}</small></div>)}
              </div>
              <div className="performance-grid" aria-label="Indicadores da partida">
                {players.map((p, i) => <div className="performance-card" key={p.symbol}><strong>{p.name}</strong><span>{metrics[i].pairs} pares encontrados</span><span>{metrics[i].errors} tentativas sem par</span><span>{metrics[i].moves} jogadas no tabuleiro</span><small>Precisão nas tentativas: {metrics[i].attempts ? Math.round(metrics[i].pairs / metrics[i].attempts * 100) : 0}%</small></div>)}
              </div>
              <div className="game-message">{pendingMove ? <Sparkles size={17}/> : <Brain size={17}/>} {message}</div>
              <div className="session-clock">⏱ Sessão de observação: {observationSession ? <><strong>{Math.floor(sessionRemaining / 60).toString().padStart(2, "0")}:{(sessionRemaining % 60).toString().padStart(2, "0")}</strong> {sessionRemaining === 0 ? "· Tempo encerrado" : "· tempo restante"}</> : <span>10 minutos · começa ao iniciar a partida</span>}</div>
              <div className="setup-actions"><button className="primary" onClick={saveCurrentMatch} disabled={isSavingMatch || !started || !observationSession || sessionRemaining <= 0 || !metrics.some((item) => item.attempts > 0 || item.moves > 0) || savedMatches.filter((item) => item.session_id === observationSession?.id || !item.session_id).length >= 5}>Salvar partida para avaliação ({savedMatches.length}/5)</button></div>
              <button className="secondary reset-button" onClick={resetRound}><RotateCcw size={17}/> Reiniciar rodada</button>
            </section>

            <section className="panel cards-panel">
              <div className="panel-title"><div><h2>Cartas da memória</h2><p>Observe bem onde cada figura aparece. São 24 cartas, organizadas em 12 pares de X, O e figuras-surpresa.</p></div><span className="counter">{matched.length / 2} / 12 pares</span></div>
              <div className="cards-grid">
                {deck.map((card) => {
                  const isUp = flipped.includes(card.id) || matched.includes(card.id);
                  return <button key={card.id} className={`memory-card ${isUp ? "revealed" : ""} ${matched.includes(card.id) ? "matched" : ""}`} onClick={() => chooseCard(card.id)} disabled={!started || previewing || isUp || pendingMove || roundOver || flipped.length === 2} aria-label={isUp ? card.label : "Virar carta"}>
                    {isUp ? <><span className={`card-face ${card.pair}`}>{card.face}</span><small>{card.label}</small></> : <span className="card-back">Ψ</span>}
                  </button>;
                })}
              </div>
              {!started && <div className="cards-overlay"><Brain size={25}/><strong>As cartas estão esperando por você.</strong><span>Boa sorte! ✨</span></div>}
              {started && <div className="cards-hint"><Sparkles size={16}/> {previewing ? "Memorize a posição de todas as cartas." : "Memorize as posições — até mesmo quando não for sua vez."}</div>}
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
                <p>Partidas enviadas ficam disponíveis para as avaliadoras em qualquer dispositivo. Cada sessão reúne até 5 partidas em 10 minutos.</p>
                {savedMatches.length === 0 ? <p className="pending-empty">Nenhuma partida aguardando avaliação. Salve uma partida na tela do jogo para trazê-la para cá.</p> : savedMatches.map((match) => <article className="pending-match" key={match.id}>
                  <div className="pending-match-data"><strong>{match.player1_name} × {match.player2_name}</strong><small>{new Date(match.savedAt).toLocaleString("pt-BR")} · {match.difficulty === "hard" ? "Difícil" : match.difficulty === "easy" ? "Fácil" : "Médio"}</small><small>Jogador 1: {match.player1_metrics.pairs} pares · {match.player1_metrics.errors} erros · {match.player1_metrics.moves} jogadas · {match.player1_metrics.precision}% de precisão</small><small>Jogador 2: {match.player2_metrics.pairs} pares · {match.player2_metrics.errors} erros · {match.player2_metrics.moves} jogadas · {match.player2_metrics.precision}% de precisão</small><small className="pending-match-winner"><strong>Resultado no momento do envio:</strong> {getMatchResult(match) === "Empate" ? "Empate" : `Vencedor: ${getMatchResult(match)}`}</small></div>
                  <button type="button" className="secondary" onClick={() => selectSavedMatch(match)}>Avaliar esta partida</button>
                </article>)}
              </section>
              {pendingSessionGroups.length > 0 && <section className="session-analysis panel" style={{margin:"24px 0",padding:"24px",border:"1px solid #e7def2",borderRadius:"20px",background:"#fff",color:"#4b3b68"}}>
                <div className="pending-matches-heading" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                  <div><p className="eyebrow purple" style={{margin:"0 0 6px",fontSize:"12px",letterSpacing:".14em",fontWeight:800,color:"#7655a8"}}>ANÁLISE CONSOLIDADA</p><h3 style={{margin:0,color:"#432d70",fontSize:"22px"}}>Análise da sessão</h3></div>
                  <span style={{padding:"7px 12px",borderRadius:"20px",background:"#f1edf8",color:"#7254bb",fontSize:"13px",fontWeight:800}}>{selectedAnalysisGroup?.matches.length || 0} partidas</span>
                </div>
                <label className="field" style={{display:"block",margin:"20px 0"}}><span style={{display:"block",marginBottom:"8px",fontSize:"12px",fontWeight:800,letterSpacing:".08em",color:"#756b8b"}}>SELECIONE A SESSÃO DE OBSERVAÇÃO</span><select style={{display:"block",width:"100%",minHeight:"46px",padding:"10px 14px",border:"1px solid #e3d9f1",borderRadius:"12px",background:"#fff",color:"#4b3b68",font:"inherit"}} value={selectedAnalysisGroup?.id || ""} onChange={(event) => setSelectedAnalysisSessionId(event.target.value)}>{pendingSessionGroups.map((group) => <option key={group.id} value={group.id}>{group.id === "legacy" ? "Partidas antigas deste dispositivo" : new Date(group.matches[0]?.session_started_at || group.matches[0]?.savedAt || Date.now()).toLocaleString("pt-BR")} · {group.matches.length} partidas</option>)}</select></label>
                {sessionAnalysis && <>
                  <div className="analysis-player-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:"14px",margin:"18px 0"}}>
                    {[{name:selectedAnalysisGroup?.matches[0]?.player1_name || "Jogador 1",metrics:sessionAnalysis.player1,label:"Jogador 1"},{name:selectedAnalysisGroup?.matches[0]?.player2_name || "Jogador 2",metrics:sessionAnalysis.player2,label:"Jogador 2"}].map((player,index) => <article className="analysis-player" key={index} style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"9px",padding:"18px",border:"1px solid #e9e1f2",borderRadius:"15px",background:index===0?"#faf7ff":"#fff9fc",color:"#756b8b",fontSize:"14px",lineHeight:1.45,minWidth:0}}>
                      <span style={{fontSize:"11px",fontWeight:800,letterSpacing:".1em",color:"#8a79a8"}}>{player.label.toUpperCase()}</span><strong style={{fontSize:"18px",color:"#432d70",overflowWrap:"anywhere"}}>{player.name}</strong>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",width:"100%"}}><div style={{padding:"10px",borderRadius:"10px",background:"#fff"}}><small style={{display:"block",color:"#82799a"}}>Pares</small><b style={{fontSize:"20px",color:"#5c438c"}}>{player.metrics.pairs}</b></div><div style={{padding:"10px",borderRadius:"10px",background:"#fff"}}><small style={{display:"block",color:"#82799a"}}>Erros</small><b style={{fontSize:"20px",color:"#5c438c"}}>{player.metrics.errors}</b></div><div style={{padding:"10px",borderRadius:"10px",background:"#fff"}}><small style={{display:"block",color:"#82799a"}}>Jogadas</small><b style={{fontSize:"20px",color:"#5c438c"}}>{player.metrics.moves}</b></div><div style={{padding:"10px",borderRadius:"10px",background:"#fff"}}><small style={{display:"block",color:"#82799a"}}>Precisão</small><b style={{fontSize:"20px",color:"#5c438c"}}>{player.metrics.precision}%</b></div></div>
                    </article>)}
                  </div>
                  <div className="analysis-bars" style={{marginTop:"24px",padding:"18px",border:"1px solid #eee8f5",borderRadius:"15px",background:"#fff"}}>
                    <h4 style={{margin:"0 0 18px",fontSize:"17px",color:"#432d70"}}>Comparativo da sessão</h4>
                    {[{label:"Pares encontrados",a:sessionAnalysis.player1.pairs,b:sessionAnalysis.player2.pairs},{label:"Erros",a:sessionAnalysis.player1.errors,b:sessionAnalysis.player2.errors},{label:"Jogadas",a:sessionAnalysis.player1.moves,b:sessionAnalysis.player2.moves},{label:"Precisão",a:sessionAnalysis.player1.precision,b:sessionAnalysis.player2.precision,suffix:"%"}].map((metric) => { const max=Math.max(metric.a,metric.b,1); return <div className="analysis-metric" key={metric.label} style={{margin:"18px 0"}}><strong style={{display:"block",marginBottom:"9px",fontSize:"13px",color:"#6f6289"}}>{metric.label}</strong>{[{label:"Jogador 1",value:metric.a,color:"#7654aa"},{label:"Jogador 2",value:metric.b,color:"#c49bcf"}].map((item) => <div className="analysis-bar-row" key={item.label} style={{display:"grid",gridTemplateColumns:"78px minmax(0,1fr) 42px",alignItems:"center",gap:"10px",margin:"8px 0",fontSize:"12px",color:"#817695"}}><span>{item.label}</span><div className="analysis-track" style={{height:"12px",overflow:"hidden",borderRadius:"20px",background:"#f0ebf6"}}><i style={{display:"block",height:"100%",width:`${item.value/max*100}%`,minWidth:item.value>0?"3px":0,borderRadius:"20px",background:item.color}}/></div><b style={{textAlign:"right",color:"#4b3b68",fontVariantNumeric:"tabular-nums"}}>{item.value}{metric.suffix||""}</b></div>)}</div>; })}
                  </div>
                  <p className="analysis-reading" style={{margin:"18px 0 0",padding:"15px",borderRadius:"12px",background:"#f8f5fc",color:"#6f6289",fontSize:"13px",lineHeight:1.65}}>{sessionAnalysis.player1.precision === sessionAnalysis.player2.precision ? "Os dois participantes apresentaram a mesma precisão nesta sessão." : sessionAnalysis.player1.precision > sessionAnalysis.player2.precision ? "O Jogador 1 apresentou maior precisão observada nesta sessão." : "O Jogador 2 apresentou maior precisão observada nesta sessão."} Esta comparação descreve somente os resultados registrados no jogo; não representa diagnóstico ou medida isolada de capacidade cognitiva.</p>
                </>}
              </section>}
              <form className="evaluation-form" onSubmit={handleSaveEvaluation}>
                <h3>{editingId ? "Editar avaliação" : selectedSavedMatchId ? "Avaliar partida salva" : "Nova avaliação"}</h3>
                {selectedSavedMatchId && <p className="selected-match-note">Os indicadores desta avaliação serão os dados capturados quando a partida foi salva.</p>}
                <div className="player-fields">
                  <label className="field"><span>NOME DO JOGADOR 1</span><input value={player1Name} onChange={e=>setPlayer1Name(e.target.value)} placeholder={players[0].name}/></label>
                  <label className="field"><span>NOME DO JOGADOR 2</span><input value={player2Name} onChange={e=>setPlayer2Name(e.target.value)} placeholder={players[1].name}/></label>
                </div>
                <section className="match-observation-form">
                  <div className="match-observation-heading"><h4>Avaliação geral da dupla</h4><p>Considere a partida inteira, observando a interação entre os dois participantes. Não atribua notas individuais.</p></div>
                  <p className="rating-scale-note"><strong>Escala de observação:</strong> 0 = não observado; 1 = raramente; 2 = às vezes; 3 = frequentemente; 4 = observado de forma consistente.</p>
                  <div className="observation-rating-list">
                    {ratingDimensions.map((dimension) => <label className="observation-rating" key={dimension.key}>
                      <span><strong>{dimension.label}</strong><small>{dimension.description}</small></span>
                      <select aria-label={`Avaliação de ${dimension.label}`} value={observationRatings[dimension.key]} onChange={(event) => setObservationRatings((current) => ({ ...current, [dimension.key]: Number(event.target.value) }))}>
                        <option value={0}>0 · Não observado</option><option value={1}>1 · Raramente</option><option value={2}>2 · Às vezes</option><option value={3}>3 · Frequentemente</option><option value={4}>4 · Consistentemente</option>
                      </select>
                    </label>)}
                  </div>
                  <div className="hippocampus-context"><strong>Memória e hipocampo</strong><p>Contextualização teórica: o hipocampo participa da formação e consolidação de memórias. O jogo não mede sua atividade nem permite avaliar seu funcionamento.</p></div>
                </section>
                <label className="field"><span>OBSERVAÇÕES GERAIS DA PARTIDA</span><textarea rows={5} value={observations} onChange={e=>setObservations(e.target.value)} placeholder="Descreva como a dupla realizou a atividade, quais comportamentos chamaram atenção e em que momentos eles apareceram..."/></label>
                <p className="academic-disclaimer">A escala é um roteiro descritivo criado para esta atividade, não é instrumento psicológico validado e não permite diagnóstico.</p>
                {academicError && <p className="academic-error" role="alert">{academicError}</p>}
                <div className="setup-actions"><button className="primary" type="submit" disabled={academicBusy}>{academicBusy ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar avaliação"}</button>{(editingId || selectedSavedMatchId) && <button type="button" className="secondary" onClick={()=>{setEditingId(null);setSelectedSavedMatchId(null);setPlayer1Name("");setPlayer2Name("");setObservations("");setObservationRatings({ ...emptyRatings });}}>Cancelar</button>}</div>
              </form>
              <div className="saved-evaluations"><h3>Avaliações registradas</h3>{academicBusy && <p>Carregando...</p>}{!academicBusy && evaluations.length===0 && <p>Nenhuma avaliação salva ainda.</p>}
                {evaluations.map(item=><article className="saved-evaluation" key={item.id}><div><strong>{item.player1_name} × {item.player2_name}</strong><small>{new Date(item.created_at).toLocaleString("pt-BR")}</small>{(() => { const stored = readStoredObservation(item.observations); return <><div className="saved-observation-chart"><strong>Avaliação geral da dupla</strong>{ratingDimensions.map((dimension) => <div className="saved-rating-row" key={dimension.key}><span>{dimension.label}</span><div className="saved-rating-track"><i style={{width:`${stored.ratings[dimension.key] / 4 * 100}%`}}/></div><b>{stored.ratings[dimension.key]}/4</b></div>)}<p><strong>Observações:</strong> {stored.notes || "Sem observações."}</p></div></>; })()}<small>Jogador 1: {item.player1_metrics?.pairs ?? 0} pares · {item.player1_metrics?.errors ?? 0} erros · {item.player1_metrics?.moves ?? 0} jogadas · {item.player1_metrics?.precision ?? 0}% de precisão</small><small>Jogador 2: {item.player2_metrics?.pairs ?? 0} pares · {item.player2_metrics?.errors ?? 0} erros · {item.player2_metrics?.moves ?? 0} jogadas · {item.player2_metrics?.precision ?? 0}% de precisão</small></div><div className="saved-actions"><button className="secondary" onClick={()=>editEvaluation(item)}>Editar</button><button className="text-button" onClick={()=>removeEvaluation(item.id)}>Excluir</button></div></article>)}
              </div>
            </div>}
          </section>
        </section>
      )}

      <footer className="footer">
        <div className="footer-credit"><span>IDEALIZADO E DESENVOLVIDO POR</span><strong className="signature">Linda Gomes</strong><a className="evelyn-logo-link" href="https://www.instagram.com/evelyn.namidia" target="_blank" rel="noreferrer" aria-label="Instagram Evelyn G. Marketing Digital"><img src="/Logomarca%20Evelyn%20G-%20Fundo%20escuro.png" alt="Evelyn G. Marketing Digital"/></a><a className="instagram" href="https://www.instagram.com/evelyn.namidia" target="_blank" rel="noreferrer">@evelyn.namidia</a></div>
        <div className="footer-meta"><span>Um projeto acadêmico que une conhecimento, tecnologia e aprendizagem.</span><span className="offline-indicator">{online ? <Wifi size={14}/> : <WifiOff size={14}/>} {online ? "Conectado" : "Modo offline"}</span></div>
      </footer>

      {showRules && <div className="modal-backdrop" role="presentation" onClick={() => setShowRules(false)}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}><button className="close-modal" onClick={() => setShowRules(false)} aria-label="Fechar"><X size={20}/></button><span className="modal-icon"><BookOpen size={24}/></span><h2 id="rules-title">Como jogar?</h2><ol><li>Dois participantes jogam no mesmo dispositivo e escolhem seus nomes. A sessão de observação dura 10 minutos.</li><li>Escolha o nível de dificuldade. As cartas serão exibidas por alguns instantes e depois viradas para baixo.</li><li>Na sua vez, vire duas cartas e tente encontrar um par.</li><li>Ao encontrar um par, escolha uma casa vazia no tabuleiro para marcar seu símbolo.</li><li>Se não encontrar um par, as cartas voltam e a vez passa para o outro jogador.</li><li>Vence a rodada quem formar uma linha com três símbolos iguais — na horizontal, vertical ou diagonal.</li></ol><p className="rule-note">Dica: observe as cartas abertas pelo outro jogador. Memória também é estratégia!</p><button className="primary full" onClick={() => setShowRules(false)}>Entendi <Check size={18}/></button></section></div>}
    </main>
  );
}
