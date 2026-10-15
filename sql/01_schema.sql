-- Minhas Milhas: banco na nuvem (Supabase / Postgres) com permissões validadas NO BANCO.
-- PASSOS: 1) Supabase > Authentication > Providers > Email: desligue "Confirm email".
--         2) Cole este arquivo inteiro no SQL Editor e execute.
--         3) Crie sua conta pelo app (usuário e senha) e depois rode, no SQL Editor:
--            update public.profiles set role='admin', plan='premium' where lower(username)='SEU_USUARIO';
-- O app usa usuario@DOMAIN (DOMAIN de js/config.js, um domínio que exista no DNS) só para satisfazer o Supabase Auth; nenhum e-mail é enviado.
-- Senhas ficam com hash bcrypt no Supabase Auth; nunca passam por tabelas deste projeto.

create extension if not exists pgcrypto;

-- ========== TABELAS ==========
create table public.app_settings(key text primary key, value jsonb not null default '{}', updated_at timestamptz not null default now());
create table public.plan_settings(plan text primary key check (plan in ('free','premium')), max_programs int, thiny_daily int, features jsonb not null default '{}'); -- null = ilimitado
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','premium')),
  plan_requested text not null default 'free' check (plan_requested in ('free','premium')),
  blocked boolean not null default false,
  created_at timestamptz not null default now(), last_seen timestamptz);
create unique index profiles_username_key on public.profiles(lower(username));
create table public.programs(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  balance bigint not null default 0 check (balance >= 0),
  expires_on date, milheiro numeric check (milheiro is null or milheiro >= 0),
  holder text check (length(holder) <= 30),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index programs_user_idx on public.programs(user_id);
create table public.user_data(user_id uuid primary key references public.profiles(id) on delete cascade,
  goals jsonb not null default '[]', hist jsonb not null default '[]', cards jsonb not null default '[]', txs jsonb not null default '[]',
  updated_at timestamptz not null default now());
create table public.thiny_usage(user_id uuid references public.profiles(id) on delete cascade, day date not null default current_date, n int not null default 0, primary key(user_id, day));
create table public.admin_audit(id bigint generated always as identity primary key, admin_id uuid, admin_name text, action text not null, target uuid, details jsonb, at timestamptz not null default now());

-- ========== FUNÇÕES AUXILIARES ==========
create function public.is_active() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from profiles where id = auth.uid() and not blocked) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and not blocked) $$;
create function public.my_plan() returns text language sql stable security definer set search_path=public as
$$ select case when role = 'admin' then 'premium' else plan end from profiles where id = auth.uid() and not blocked $$;
create function public.can_add_program() returns boolean language sql stable security definer set search_path=public as
$$ select coalesce((select ps.max_programs is null or (select count(*) from programs where user_id = auth.uid()) < ps.max_programs
   from plan_settings ps where ps.plan = public.my_plan()), false) $$;
create function public.audit(a text, t uuid, d jsonb) returns void language sql security definer set search_path=public as
$$ insert into admin_audit(admin_id, admin_name, action, target, details)
   select auth.uid(), (select username from profiles where id = auth.uid()), a, t, d $$;

-- ========== CADASTRO: perfil criado só pelo banco; plano pedido NÃO vira privilégio ==========
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare u text := lower(coalesce(new.raw_user_meta_data->>'username',''));
        req text := case when new.raw_user_meta_data->>'plan' = 'premium' then 'premium' else 'free' end;
        inst boolean;
begin
  if u !~ '^[a-z0-9_]{3,20}$' then raise exception 'Usuário inválido: use 3 a 20 letras minúsculas, números ou _'; end if;
  select coalesce((value->>'premium_instant')::boolean, false) into inst from app_settings where key = 'signup';
  insert into profiles(id, username, plan, plan_requested) values (new.id, u, case when req = 'premium' and coalesce(inst,false) then 'premium' else 'free' end, req);
  insert into user_data(user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Usuário comum jamais altera role, plano, bloqueio ou nome de usuário (nem pelo navegador).
create function public.guard_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if; -- SQL Editor/servidor ou administrador
  if new.role <> old.role or new.plan <> old.plan or new.blocked <> old.blocked or new.username <> old.username or new.plan_requested <> old.plan_requested or new.id <> old.id
  then raise exception 'Permissão negada'; end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

create function public.touch() returns void language sql security definer set search_path=public as
$$ update profiles set last_seen = now() where id = auth.uid() and not blocked $$;

-- ========== THINY: cota diária validada no banco ==========
create function public.consume_thiny() returns jsonb language plpgsql security definer set search_path=public as $$
declare lim int; used int; en boolean;
begin
  if not public.is_active() then return jsonb_build_object('ok', false, 'reason', 'bloqueado'); end if;
  select coalesce((value->>'enabled')::boolean, true) into en from app_settings where key = 'thiny';
  if not coalesce(en, true) then return jsonb_build_object('ok', false, 'reason', 'desativada'); end if;
  select thiny_daily into lim from plan_settings where plan = public.my_plan();
  insert into thiny_usage(user_id, day, n) values (auth.uid(), current_date, 0) on conflict do nothing;
  select n into used from thiny_usage where user_id = auth.uid() and day = current_date for update;
  if lim is not null and used >= lim then return jsonb_build_object('ok', false, 'reason', 'limite'); end if;
  update thiny_usage set n = n + 1 where user_id = auth.uid() and day = current_date;
  return jsonb_build_object('ok', true, 'remaining', case when lim is null then null else lim - used - 1 end);
end $$;

-- ========== PAINEL ADM: toda ação valida is_admin() e grava auditoria ==========
create function public.admin_set_plan(p_user uuid, p_plan text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  if p_plan not in ('free','premium') then raise exception 'Plano inválido'; end if;
  update profiles set plan = p_plan where id = p_user;
  perform public.audit('set_plan', p_user, jsonb_build_object('plan', p_plan));
end $$;
create function public.admin_set_blocked(p_user uuid, p_blocked boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  if p_blocked and p_user = auth.uid() then raise exception 'Você não pode bloquear a si mesmo'; end if;
  update profiles set blocked = p_blocked where id = p_user;
  perform public.audit(case when p_blocked then 'block' else 'unblock' end, p_user, '{}');
end $$;
create function public.admin_set_role(p_user uuid, p_role text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  if p_role not in ('user','admin') then raise exception 'Perfil inválido'; end if;
  if p_role = 'user' and (select role from profiles where id = p_user) = 'admin'
     and (select count(*) from profiles where role = 'admin' and not blocked) <= 1
  then raise exception 'Precisa existir ao menos um administrador'; end if;
  update profiles set role = p_role where id = p_user;
  perform public.audit('set_role', p_user, jsonb_build_object('role', p_role));
end $$;
create function public.admin_delete_user(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  if p_user = auth.uid() then raise exception 'Você não pode excluir a si mesmo'; end if;
  perform public.audit('delete_user', p_user, (select to_jsonb(p) - 'id' from profiles p where id = p_user));
  delete from auth.users where id = p_user; -- apaga em cascata perfil, programas e dados
end $$;
create function public.admin_set_setting(p_key text, p_value jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  if p_key not in ('general','signup','thiny') then raise exception 'Configuração desconhecida'; end if;
  insert into app_settings(key, value) values (p_key, p_value) on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.audit('set_setting', null, jsonb_build_object('key', p_key, 'value', p_value));
end $$;
create function public.admin_set_plan_limits(p_plan text, p_max_programs int, p_thiny_daily int, p_features jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  update plan_settings set max_programs = p_max_programs, thiny_daily = p_thiny_daily, features = coalesce(p_features, features) where plan = p_plan;
  perform public.audit('set_plan_limits', null, jsonb_build_object('plan', p_plan, 'max_programs', p_max_programs, 'thiny_daily', p_thiny_daily));
end $$;
create function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles), 'free', (select count(*) from profiles where plan = 'free' and role = 'user'),
    'premium', (select count(*) from profiles where plan = 'premium' and role = 'user'), 'admins', (select count(*) from profiles where role = 'admin'),
    'blocked', (select count(*) from profiles where blocked), 'programs', (select count(*) from programs),
    'signups_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'active_7d', (select count(*) from profiles where last_seen > now() - interval '7 days'),
    'pending_premium', (select count(*) from profiles where plan_requested = 'premium' and plan = 'free'),
    'thiny_today', (select coalesce(sum(n), 0) from thiny_usage where day = current_date));
end $$;
-- Comandos administrativos: apenas uma lista fixa (nada de SQL livre).
create function public.admin_command(p_cmd text) returns jsonb language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  if p_cmd = 'reset_thiny_hoje' then delete from thiny_usage where day = current_date;
  elsif p_cmd = 'limpar_uso_antigo' then delete from thiny_usage where day < current_date - 30;
  elsif p_cmd = 'aprovar_pedidos_premium' then update profiles set plan = 'premium' where plan_requested = 'premium' and plan = 'free';
  else raise exception 'Comando desconhecido'; end if;
  get diagnostics n = row_count;
  perform public.audit('command', null, jsonb_build_object('cmd', p_cmd, 'linhas', n));
  return jsonb_build_object('ok', true, 'linhas', n);
end $$;

-- ========== RLS: cada plano só acessa o que lhe cabe ==========
alter table public.app_settings enable row level security;  alter table public.plan_settings enable row level security;
alter table public.profiles enable row level security;      alter table public.programs enable row level security;
alter table public.user_data enable row level security;     alter table public.thiny_usage enable row level security;
alter table public.admin_audit enable row level security;

create policy cfg_read on public.app_settings for select to authenticated using (true);
create policy plan_read on public.plan_settings for select to authenticated using (true);
create policy prof_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy prof_admin_upd on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy prog_read on public.programs for select to authenticated using ((user_id = auth.uid() and public.is_active()) or public.is_admin());
create policy prog_ins on public.programs for insert to authenticated with check ((user_id = auth.uid() and public.is_active() and public.can_add_program()) or public.is_admin());
create policy prog_upd on public.programs for update to authenticated using ((user_id = auth.uid() and public.is_active()) or public.is_admin()) with check ((user_id = auth.uid() and public.is_active()) or public.is_admin());
create policy prog_del on public.programs for delete to authenticated using ((user_id = auth.uid() and public.is_active()) or public.is_admin());
-- user_data (metas, histórico, cartões, faturas, nuvem): só Premium (ou ADM)
create policy ud_read on public.user_data for select to authenticated using ((user_id = auth.uid() and public.is_active() and public.my_plan() = 'premium') or public.is_admin());
create policy ud_ins on public.user_data for insert to authenticated with check ((user_id = auth.uid() and public.is_active() and public.my_plan() = 'premium') or public.is_admin());
create policy ud_upd on public.user_data for update to authenticated using ((user_id = auth.uid() and public.is_active() and public.my_plan() = 'premium') or public.is_admin()) with check ((user_id = auth.uid() and public.is_active() and public.my_plan() = 'premium') or public.is_admin());
create policy use_read on public.thiny_usage for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy audit_read on public.admin_audit for select to authenticated using (public.is_admin());

-- ========== PERMISSÕES DE EXECUÇÃO ==========
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_active(), public.is_admin(), public.my_plan(), public.can_add_program(), public.touch(), public.consume_thiny(),
  public.admin_set_plan(uuid,text), public.admin_set_blocked(uuid,boolean), public.admin_set_role(uuid,text), public.admin_delete_user(uuid),
  public.admin_set_setting(text,jsonb), public.admin_set_plan_limits(text,int,int,jsonb), public.admin_stats(), public.admin_command(text) to authenticated;
revoke all on all tables in schema public from anon;

-- ========== DADOS INICIAIS ==========
insert into public.plan_settings(plan, max_programs, thiny_daily, features) values
 ('free', 3, 5, '{"metas":false,"historico":false,"evolucao":false,"cartoes":false,"milheiro":false,"lancamento_rapido":false,"exportar":false,"nuvem":false,"thiny_dados":false,"thiny_acoes":false,"thiny_voz":false}'),
 ('premium', null, null, '{"metas":true,"historico":true,"evolucao":true,"cartoes":true,"milheiro":true,"lancamento_rapido":true,"exportar":true,"nuvem":true,"thiny_dados":true,"thiny_acoes":true,"thiny_voz":true}');
insert into public.app_settings(key, value) values
 ('general', '{"nome":"Minhas Milhas"}'), ('signup', '{"premium_instant":false}'),
 ('thiny', '{"enabled":true,"acoes_permitidas":["lancamento","programa","meta"],"voz_somente_premium":true}');
