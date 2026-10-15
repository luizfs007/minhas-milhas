// Edge Function: criar usuário e redefinir senha. Só administradores (validado aqui e no banco).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return j({ error: 'Não autenticado' }, 401);
    const { data: isAdm } = await asUser.rpc('is_admin');
    if (!isAdm) return j({ error: 'Permissão negada' }, 403);
    const admin = createClient(url, svc), b = await req.json();
    const { data: me } = await admin.from('profiles').select('username').eq('id', user.id).single();
    const log = (action: string, target: string, details: unknown) => admin.from('admin_audit').insert({ admin_id: user.id, admin_name: me?.username, action, target, details });
    if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 72) return j({ error: 'A senha precisa ter de 8 a 72 caracteres.' }, 400);
    if (b.action === 'create') {
      const u = String(b.username ?? '').toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(u)) return j({ error: 'Usuário: 3 a 20 letras minúsculas, números ou _.' }, 400);
      const domain = Deno.env.get('EMAIL_DOMAIN');
      if (!domain) return j({ error: 'Defina o segredo EMAIL_DOMAIN da função (igual ao DOMAIN de js/config.js).' }, 500);
      const email = `${u}@${domain}`;
      const plan = b.plan === 'premium' ? 'premium' : 'free';
      const { data, error } = await admin.auth.admin.createUser({ email, password: b.password, email_confirm: true, user_metadata: { username: u, plan } });
      if (error) return j({ error: /already|registered|database/i.test(error.message) ? 'Esse usuário já existe.' : error.message }, 400);
      if (plan === 'premium') await admin.from('profiles').update({ plan: 'premium' }).eq('id', data.user.id);
      await log('create_user', data.user.id, { username: u, plan });
      return j({ ok: true });
    }
    if (b.action === 'reset') {
      const { error } = await admin.auth.admin.updateUserById(String(b.id), { password: b.password });
      if (error) return j({ error: error.message }, 400);
      await log('reset_password', String(b.id), {});
      return j({ ok: true });
    }
    return j({ error: 'Ação desconhecida' }, 400);
  } catch (e) { return j({ error: String((e as Error).message ?? e) }, 500); }
});
