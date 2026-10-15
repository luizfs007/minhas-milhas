-- Complemento ao schema.sql. Seguro para rodar uma vez: não apaga dados nem recria tabelas.
-- 1) Pedido de upgrade: o usuário só consegue marcar "quero Premium"; quem libera é o administrador.
create or replace function public.request_upgrade() returns void language sql security definer set search_path=public as
$$ update profiles set plan_requested = 'premium' where id = auth.uid() and plan = 'free' and not blocked $$;
-- guard_profile impede usuário de alterar plan_requested direto; esta função (security definer) é o único caminho.
-- Como guard_profile roda como o próprio usuário, liberamos só este caso:
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.role <> old.role or new.plan <> old.plan or new.blocked <> old.blocked or new.username <> old.username or new.id <> old.id
     or (new.plan_requested <> old.plan_requested and not (old.plan_requested = 'free' and new.plan_requested = 'premium' and old.plan = 'free'))
  then raise exception 'Permissão negada'; end if;
  return new;
end $$;
revoke execute on function public.request_upgrade() from public, anon;
grant execute on function public.request_upgrade() to authenticated;

-- 2) Colunas exclusivas do Premium em programs (valor do milheiro e titular) são zeradas para Free.
create or replace function public.guard_program() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.my_plan() is distinct from 'premium' then new.milheiro := null; new.holder := null; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_program on public.programs;
create trigger guard_program before insert or update on public.programs for each row execute function public.guard_program();

-- 3) Registro de auditoria para edições de dados feitas pelo ADM direto nas tabelas.
create or replace function public.admin_log(p_action text, p_target uuid, p_details jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  perform public.audit(left(p_action, 40), p_target, coalesce(p_details, '{}'));
end $$;
revoke execute on function public.admin_log(text,uuid,jsonb) from public, anon;
grant execute on function public.admin_log(text,uuid,jsonb) to authenticated;

-- 4) A lista de oportunidades de mercado passa a ser configuração editável pelo ADM.
create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permissão negada'; end if;
  if p_key not in ('general','signup','thiny','opps') then raise exception 'Configuração desconhecida'; end if;
  insert into app_settings(key, value) values (p_key, p_value) on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.audit('set_setting', null, jsonb_build_object('key', p_key));
end $$;
