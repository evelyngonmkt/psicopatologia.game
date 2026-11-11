-- Corrige o envio público de partidas e torna cada envio idempotente.
-- Pode ser executado no SQL Editor do Supabase mesmo que a tabela já tenha dados.

alter table public.pending_matches
  add column if not exists client_match_id uuid;

update public.pending_matches
set client_match_id = gen_random_uuid()
where client_match_id is null;

alter table public.pending_matches
  alter column client_match_id set not null;

create unique index if not exists pending_matches_client_match_id_uidx
  on public.pending_matches (client_match_id);

-- Os participantes não precisam de login. As restrições da tabela continuam
-- validando nomes, dificuldade e duração da sessão. A leitura continua restrita
-- às avaliadoras autorizadas pelas policies já existentes.
drop policy if exists "Participantes podem enviar partidas para avaliação"
  on public.pending_matches;

create policy "Participantes podem enviar partidas para avaliação"
  on public.pending_matches
  for insert
  to anon, authenticated
  with check (true);

grant insert on public.pending_matches to anon, authenticated;
