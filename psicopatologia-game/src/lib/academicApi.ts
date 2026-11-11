const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ALLOWED_EMAILS = ["lindagomes24@outlook.com", "evelyngon.mkt@gmail.com", "luanaddesousa@gmail.com"];

export type AcademicSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
  email: string;
};

export type AcademicMetrics = {
  attempts: number;
  pairs: number;
  errors: number;
  moves: number;
  precision: number;
};

export type PendingMatch = {
  id: string;
  client_match_id: string;
  session_id: string;
  session_started_at: string;
  session_ends_at: string;
  player1_name: string;
  player2_name: string;
  difficulty: "easy" | "medium" | "hard";
  player1_metrics: AcademicMetrics;
  player2_metrics: AcademicMetrics;
  saved_at: string;
};

export type PendingMatchInput = Omit<PendingMatch, "id" | "saved_at">;

export type AcademicEvaluation = {
  id: string;
  evaluator_id: string;
  player1_name: string;
  player2_name: string;
  player1_metrics: AcademicMetrics;
  player2_metrics: AcademicMetrics;
  observations: string | null;
  created_at: string;
};

type EvaluationInput = {
  id: string | null;
  player1_name: string;
  player2_name: string;
  player1_metrics: AcademicMetrics;
  player2_metrics: AcademicMetrics;
  observations: string;
};

const SESSION_KEY = "psicopatologia_academic_session";

function ensureConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("A conexão com o Supabase não está configurada. Confira as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.");
}

function readSession(): AcademicSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AcademicSession;
    if (!session.access_token || !session.user?.id || !ALLOWED_EMAILS.includes(session.email.toLowerCase())) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(session: AcademicSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function refreshSession(session: AcademicSession): Promise<AcademicSession> {
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const data = await response.json();
  if (!response.ok) {
    localStorage.removeItem(SESSION_KEY);
    throw new Error("Sua sessão expirou. Entre novamente na área acadêmica.");
  }
  const renewed: AcademicSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    user: { id: data.user.id, email: data.user.email },
    email: String(data.user.email).toLowerCase()
  };
  Object.assign(session, renewed);
  saveSession(renewed);
  return session;
}

async function request(path: string, session: AcademicSession, options: RequestInit = {}) {
  ensureConfig();
  const activeSession = await refreshSession(session);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${activeSession.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers
    }
  });
  const body = await response.text();
  if (!response.ok) {
    let message = body;
    try { message = JSON.parse(body).message || JSON.parse(body).hint || body; } catch { /* keep response text */ }
    throw new Error(message || "Erro ao acessar os registros acadêmicos.");
  }
  return body ? JSON.parse(body) : null;
}

export const academicApi = {
  getSession(): AcademicSession | null {
    return readSession();
  },

  async signIn(email: string, password: string): Promise<AcademicSession> {
    ensureConfig();
    const normalizedEmail = email.toLowerCase();
    if (!ALLOWED_EMAILS.includes(normalizedEmail)) throw new Error("Este e-mail não está autorizado a acessar a área acadêmica.");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || data.message || "E-mail ou senha inválidos.");
    if (!data.user?.id || !ALLOWED_EMAILS.includes(String(data.user.email).toLowerCase())) throw new Error("Este usuário não está autorizado.");
    const session: AcademicSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
      user: { id: data.user.id, email: data.user.email },
      email: String(data.user.email).toLowerCase()
    };
    saveSession(session);
    return session;
  },

  async signOut() {
    const session = readSession();
    if (session && SUPABASE_URL && SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` }
      }).catch(() => undefined);
    }
    localStorage.removeItem(SESSION_KEY);
  },

  async submitPendingMatch(input: PendingMatchInput) {
    ensureConfig();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pending_matches?on_conflict=client_match_id`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(input)
    });
    const body = await response.text();
    if (!response.ok) {
      let message = body;
      try { message = JSON.parse(body).message || JSON.parse(body).hint || body; } catch { /* keep response text */ }
      throw new Error(message || "Não foi possível enviar a partida.");
    }
    return body ? JSON.parse(body) : null;
  },

  async listPendingMatches(session: AcademicSession): Promise<PendingMatch[]> {
    return request("pending_matches?select=*&order=session_started_at.desc,saved_at.asc", session);
  },

  async deletePendingMatch(session: AcademicSession, id: string) {
    return request(`pending_matches?id=eq.${encodeURIComponent(id)}`, session, { method: "DELETE" });
  },

  async listEvaluations(session: AcademicSession): Promise<AcademicEvaluation[]> {
    return request("academic_evaluations?select=*&order=created_at.desc", session);
  },

  async saveEvaluation(session: AcademicSession, input: EvaluationInput) {
    const payload = {
      evaluator_id: session.user.id,
      player1_name: input.player1_name,
      player2_name: input.player2_name,
      player1_metrics: input.player1_metrics,
      player2_metrics: input.player2_metrics,
      observations: input.observations
    };
    if (input.id) {
      return request(`academic_evaluations?id=eq.${encodeURIComponent(input.id)}`, session, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    }
    return request("academic_evaluations", session, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async deleteEvaluation(session: AcademicSession, id: string) {
    return request(`academic_evaluations?id=eq.${encodeURIComponent(id)}`, session, { method: "DELETE" });
  }
};
