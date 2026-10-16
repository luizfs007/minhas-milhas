-- Thiny: histórico INDIVIDUAL por usuário (conversas e mensagens) com RLS por dono.
-- Seguro para rodar mais de uma vez. Não apaga, altera nem recria nenhuma tabela existente.

create table if not exists public.thiny_conversations(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default 'Nova conversa' check (length(title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists thiny_conv_user_idx on public.thiny_conversations(user_id, updated_at desc);

create table if not exists public.thiny_messages(
  id bigint generated always as identity primary key,           -- a ordem das mensagens vem deste número
  conversation_id uuid not null references public.thiny_conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(content) <= 2000),
  created_at timestamptz not null default now());
create index if not exists thiny_msg_conv_idx on public.thiny_messages(conversation_id, id);

-- Limites de segurança: 100 conversas por usuário e 200 mensagens por conversa.
create or replace function public.thiny_limits() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name = 'thiny_conversations' then
    if (select count(*) from thiny_conversations where user_id = new.user_id) >= 100 then raise exception 'Limite de 100 conversas: exclua conversas antigas.'; end if;
  else
    if (select count(*) from thiny_messages where conversation_id = new.conversation_id) >= 200 then raise exception 'Esta conversa chegou a 200 mensagens: inicie uma nova.'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.thiny_limits() from public, anon, authenticated;
drop trigger if exists thiny_conv_limit on public.thiny_conversations;
create trigger thiny_conv_limit before insert on public.thiny_conversations for each row execute function public.thiny_limits();
drop trigger if exists thiny_msg_limit on public.thiny_messages;
create trigger thiny_msg_limit before insert on public.thiny_messages for each row execute function public.thiny_limits();

-- RLS: o dono é SEMPRE o auth.uid() validado pelo Supabase (nunca nome, e-mail ou plano). Nem o ADM lê conversas alheias.
alter table public.thiny_conversations enable row level security;
alter table public.thiny_messages enable row level security;

drop policy if exists tc_select on public.thiny_conversations;
drop policy if exists tc_insert on public.thiny_conversations;
drop policy if exists tc_update on public.thiny_conversations;
drop policy if exists tc_delete on public.thiny_conversations;
create policy tc_select on public.thiny_conversations for select to authenticated using (user_id = auth.uid() and public.is_active());
create policy tc_insert on public.thiny_conversations for insert to authenticated with check (user_id = auth.uid() and public.is_active());
create policy tc_update on public.thiny_conversations for update to authenticated using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid());
create policy tc_delete on public.thiny_conversations for delete to authenticated using (user_id = auth.uid() and public.is_active());

drop policy if exists tm_select on public.thiny_messages;
drop policy if exists tm_insert on public.thiny_messages;
drop policy if exists tm_delete on public.thiny_messages;
create policy tm_select on public.thiny_messages for select to authenticated using (user_id = auth.uid() and public.is_active());
create policy tm_insert on public.thiny_messages for insert to authenticated with check (
  user_id = auth.uid() and public.is_active()
  and exists (select 1 from public.thiny_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy tm_delete on public.thiny_messages for delete to authenticated using (user_id = auth.uid() and public.is_active());
-- Mensagens não podem ser editadas (não há política de UPDATE).

revoke all on public.thiny_conversations, public.thiny_messages from anon;
grant select, insert, delete on public.thiny_conversations, public.thiny_messages to authenticated;
grant update (title, updated_at) on public.thiny_conversations to authenticated;
