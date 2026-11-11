-- Sessões de observação do jogo (10 minutos) e partidas enviadas para análise.
-- Execute este script no SQL Editor do projeto Supabase antes de ativar a sincronização no app.

create table if not exists public.pending_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  session_started_at timestamptz not null,
  session_ends_at timestamptz not null,
  player1_name text not null,
  player2_name text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  player1_metrics jsonb not null,
  player2_metrics jsonb not null,
  saved_at timestamptz not null default now(),
  constraint pending_matches_session_window check (
    session_ends_at > session_started_at
    and session_ends_at - session_started_at <= interval '10 minutes 5 seconds'
  )
);

create index if not exists pending_matches_session_idx
  on public.pending_matches (session_id, saved_at);

alter table public.pending_matches enable row level security;

-- Participantes podem enviar snapshots sem fazer login.
grant insert on public.pending_matches to anon, authenticated;

drop policy if exists "Participantes podem enviar partidas para avaliação" on public.pending_matches;
create policy "Participantes podem enviar partidas para avaliação"
  on public.pending_matches
  for insert
  to anon, authenticated
  with check (
    char_length(trim(player1_name)) between 1 and 80
    and char_length(trim(player2_name)) between 1 and 80
    and difficulty in ('easy', 'medium', 'hard')
    and session_ends_at > session_started_at
    and session_ends_at - session_started_at <= interval '10 minutes 5 seconds'
  );

-- Somente as avaliadoras autorizadas podem consultar e excluir partidas recebidas.
grant select, delete on public.pending_matches to authenticated;

drop policy if exists "Avaliadoras autorizadas podem visualizar partidas" on public.pending_matches;
create policy "Avaliadoras autorizadas podem visualizar partidas"
  on public.pending_matches
  for select
  to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'lindagomes24@outlook.com',
      'evelyngon.mkt@gmail.com',
      'luanaddesousa@gmail.com'
    )
  );

drop policy if exists "Avaliadoras autorizadas podem excluir partidas" on public.pending_matches;
create policy "Avaliadoras autorizadas podem excluir partidas"
  on public.pending_matches
  for delete
  to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'lindagomes24@outlook.com',
      'evelyngon.mkt@gmail.com',
      'luanaddesousa@gmail.com'
    )
  );
