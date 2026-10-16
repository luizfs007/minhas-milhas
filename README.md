# Minhas Milhas (GitHub Pages + Supabase), acesso só com usuário e senha

## Como funciona sem e-mail
O Supabase Auth exige um e-mail por conta e recusa endereços cujo domínio não existe na internet (foi o erro de `.invalid`).
Por isso o app monta `usuario@DOMAIN` por baixo dos panos. O `DOMAIN` precisa ser um domínio que **exista no DNS**
(você não precisa ter caixa de e-mail nele) e **nenhum e-mail é enviado**, desde que "Confirm email" esteja DESLIGADO.
Recomendado: o endereço do seu GitHub Pages, por exemplo `maria.github.io` (resolve na internet e é seu).
Não use domínios de e-mail de terceiros (gmail.com etc.): o endereço montado poderia pertencer a outra pessoa.
Se o Supabase ainda disser "Email address ... is invalid", teste outro domínio que resolva no DNS.

## 1. Banco de dados
Nada muda no banco existente. Se ainda não executou: `sql/01_schema.sql` e depois `sql/02_complemento.sql`.
Promova sua conta a ADM no SQL Editor:
`update public.profiles set role='admin', plan='premium' where lower(username)='SEU_USUARIO';`

Se aparecer "Não foi possível carregar seu perfil", execute também `sql/03_correcao_perfil.sql` (permissões da API e perfis faltantes).

## Histórico da Thiny (por usuário)
Execute `sql/04_thiny_historico.sql` e publique de novo a função `thiny` (código em `supabase/functions/thiny/index.ts`).
Cada conversa pertence ao ID do usuário autenticado (RLS). O ADM pode desligar o histórico em Configurações > Thiny.

## 2. Supabase (painel)
- Authentication > Sign In / Providers > Email: deixe o provedor **ativado** (se estiver desativado, aparece "Email signups are disabled") e **desligue apenas "Confirm email"**.
- Authentication > Sign In / Providers (ou User Signups): a opção "Allow new users to sign up" deve estar ligada.
- Defina o tamanho mínimo de senha em 8.

## 3. Site
Edite `js/config.js`: chave pública (anon/publishable) e `DOMAIN`. Nunca use a service_role.
**Depois que existirem contas, não troque o DOMAIN**, senão ninguém consegue entrar.

## 4. Funções de servidor (criar usuário e redefinir senha pelo ADM, e Thiny)
```
supabase login
supabase link --project-ref vanxkoraerxsqrztgnoh
supabase secrets set EMAIL_DOMAIN=o_mesmo_valor_do_DOMAIN
supabase secrets set GEMINI_API_KEY=sua_chave_do_google_ai_studio
# opcional, modelo de reserva se o principal estiver sobrecarregado: supabase secrets set GEMINI_FALLBACK_MODEL=outro_modelo
# opcional (padrão gemini-3.8-flash): supabase secrets set GEMINI_MODEL=nome_do_modelo
supabase functions deploy admin-users
supabase functions deploy thiny
```
As chaves secretas ficam só no servidor.

## 5. GitHub Pages
Envie o conteúdo desta pasta (index.html na raiz). Settings > Pages > Deploy from a branch > main / (root).

## Recuperação de acesso
Sem e-mail, o ADM define uma nova senha pelo botão "Senha" na lista de usuários. Para ter recuperação automática
no futuro, adicione um e-mail real à conta (o Supabase já oferece isso) sem recriar o banco.

## Observações
- Os recursos marcados em "Planos" orientam a interface; o banco aplica limite de programas, cota da Thiny e acesso por plano.
- A lista de oportunidades é editada pelo ADM (aba Oportunidades) e não atualiza sozinha.

## Thiny (Google AI Studio)
A chave vem de https://aistudio.google.com (Get API key). O plano gratuito tem limites por minuto e por dia compartilhados por todos os usuários do app, e o Google pode usar os dados enviados no plano gratuito para melhorar seus produtos. A Thiny Premium envia saldos e metas do usuário: informe isso no aviso de privacidade ou use uma chave com cobrança ativada.
