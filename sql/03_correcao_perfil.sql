-- Correção: "Não foi possível carregar seu perfil". Seguro para rodar mais de uma vez; não apaga dados.
-- 1) Permissões da API para usuários logados (as políticas RLS continuam restringindo cada linha).
grant usage on schema public to authenticated;
grant select on public.profiles, public.plan_settings, public.app_settings, public.admin_audit, public.thiny_usage to authenticated;
grant update on public.profiles to authenticated;                         -- RLS: só administrador altera
grant select, insert, update, delete on public.programs to authenticated;
grant select, insert, update on public.user_data to authenticated;

-- 2) Cria o perfil de contas que existem no Auth mas ficaram sem perfil (cadastro feito antes do gatilho).
insert into public.profiles(id, username, plan, plan_requested)
select u.id, lower(coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))), 'free', 'free'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
  and lower(coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))) ~ '^[a-z0-9_]{3,20}$'
on conflict do nothing;
insert into public.user_data(user_id) select id from public.profiles on conflict do nothing;

-- 3) Confirma contas criadas enquanto "Confirm email" estava ligado (troque SEU_DOMINIO pelo DOMAIN do config.js).
-- update auth.users set email_confirmed_at = now() where email_confirmed_at is null and email like '%@SEU_DOMINIO';

-- Diagnóstico (opcional): o gatilho de cadastro precisa aparecer aqui e deve haver um perfil por conta.
-- select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
-- select (select count(*) from auth.users) as contas, (select count(*) from public.profiles) as perfis;
