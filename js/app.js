(() => {
'use strict';
const C = window.CFG || {}, $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dfmt = d => d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—';
let sb, me = null, lim = {}, progs = [], ud = { goals: [], hist: [] }, view = 'dash', area = '', users = [];
const toast = (m, ok = true) => { const t = document.createElement('div'); t.className = 'toast ' + (ok ? 'ok' : 'bad'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3800); };
const err = e => /row-level|permission|negada|violates/i.test(e.message || '') ? 'Permissão negada ou limite do plano atingido.' : (e.message || 'Erro inesperado.');
const head = (t, x = '') => `<div class="head"><h1>${t}</h1>${x}</div>`;
const kpi = (l, v, s = '') => `<div class="kpi"><small>${l}</small><b>${v}</b><span>${s}</span></div>`;
const bars = rows => { const m = Math.max(1, ...rows.map(r => r[1])); return rows.length ? `<div class="bars">${rows.map(([n, v]) => `<div class="bar"><span>${esc(n)}</span><i style="width:${Math.round(v / m * 100)}%"></i><em>${fmt(v)}</em></div>`).join('')}</div>` : '<div class="empty">Nenhum dado ainda.</div>'; };

function modal(title, body, ok, submit) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3>${body}<div class="row"><button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">${esc(ok)}</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.querySelector('[data-x]').onclick = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.querySelector('form').onsubmit = async e => { e.preventDefault(); const b = e.submitter; if (b) b.disabled = true; const r = await submit(e.target); if (b) b.disabled = false; if (r !== false) d.close(); };
}

/* ---------- Login e cadastro (somente usuário e senha) ---------- */
const mail = u => u + '@' + C.DOMAIN;
function loginView(msg = '') {
  area = ''; app.className = '';
  app.innerHTML = `<div class="auth auth-showcase"><div class="auth-atmosphere" aria-hidden="true"><span></span><span></span><span></span><i></i><i></i></div><div class="auth-layout"><section class="auth-story"><div class="auth-brand"><span class="auth-brand-icon">✈</span><span>MINHAS <b>MILHAS</b></span></div><div class="auth-eyebrow"><span class="auth-live-dot"></span> SUA JORNADA COMEÇA AQUI</div><h1>Suas milhas.<br><em>Novos destinos.</em></h1><p class="auth-intro">Organize seus programas de fidelidade, acompanhe seus saldos e descubra oportunidades para aproveitar melhor cada ponto.</p><div class="auth-feature-grid"><article class="auth-feature"><span>↗</span><div><b>Visão inteligente</b><small>Seus saldos reunidos em um só lugar.</small></div></article><article class="auth-feature"><span>◈</span><div><b>Oportunidades</b><small>Acompanhe promoções e transferências.</small></div></article><article class="auth-feature"><span>✦</span><div><b>Thiny, sua assistente IA</b><small>Uma ajudante para sua jornada de milhas.</small></div></article><article class="auth-feature"><span>⌁</span><div><b>Planeje melhor</b><small>Calculadoras para comparar possibilidades.</small></div></article></div><section class="auth-plans" aria-label="Planos disponíveis"><h2><span>♛</span> Escolha o seu plano</h2><div class="auth-plan-grid"><article class="auth-plan auth-plan-free"><div class="auth-plan-title"><span>➤</span><div><b>Free</b><small>Comece sua jornada</small></div></div><ul><li>Acompanhe seus saldos</li><li>Acesso às oportunidades</li><li>Calculadoras básicas</li><li>Suporte da Thiny</li></ul><span class="auth-plan-cta">Disponível para começar</span></article><article class="auth-plan auth-plan-premium"><div class="auth-plan-title"><span>☆</span><div><b>Premium</b><small>Mais possibilidades</small></div><i>MAIS COMPLETO</i></div><ul><li>Todos os recursos do Free</li><li>Calculadoras avançadas</li><li>Alertas personalizados</li><li>Acesso prioritário à Thiny</li></ul><span class="auth-plan-cta">Peça acesso ao Premium</span></article></div></section><div class="auth-trust"><span>◉</span> Seus dados e suas conversas são individuais por conta.</div></section><section class="box auth-box"><div class="auth-box-heading"><span class="auth-mini-icon">✦</span><div><h2>Bem-vindo de volta</h2><p>Acesse seu espaço de viagens.</p></div></div>
  <div class="tabs"><button data-t="in" class="on">Entrar</button><button data-t="up">Criar conta</button></div>
  <form id="af"><label>Usuário</label><input name="u" autocomplete="username" required maxlength="20" placeholder="ex.: maria_silva">
  <label>Senha</label><input name="p" type="password" autocomplete="current-password" required minlength="8">
  <div id="upx" hidden><label>Plano</label>
  <label class="opt"><input type="radio" name="pl" value="free" checked><span><b>Free</b>: até ${lim.free?.max_programs ?? 3} programas, resumo, alertas e calculadoras.</span></label>
  <label class="opt"><input type="radio" name="pl" value="premium"><span><b>Premium</b>: todos os recursos. Disponível após aprovação do pedido.</span></label>
  <label class="opt"><input type="checkbox" name="ok"><span>Li e aceito o uso dos meus dados no app (LGPD).</span></label></div>
  <p class="err" id="am">${esc(msg)}</p><button class="btn pri wide" id="ab">Entrar</button></form>
  <p class="hint auth-password-note">Esqueceu a senha? A recuperação de senha não está disponível nesta versão.</p><div class="auth-box-foot"><span>✦</span> Milhas bem cuidadas. Viagens mais inteligentes.</div></section></div><footer class="auth-footer"><span>MINHAS MILHAS</span><span>Organize · Compare · Planeje</span><span>Uma plataforma para sua próxima viagem</span></footer></div>`;
  let up = false; const f = $('#af');
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    up = b.dataset.t === 'up'; app.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b));
    $('#upx').hidden = !up; $('#ab').textContent = up ? 'Criar conta' : 'Entrar'; f.p.autocomplete = up ? 'new-password' : 'current-password';
  });
  f.onsubmit = async e => {
    e.preventDefault(); const u = f.u.value.trim().toLowerCase(), p = f.p.value, m = $('#am'); m.textContent = '';
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { m.textContent = 'Usuário: 3 a 20 letras minúsculas, números ou _.'; return; }
    if (p.length < 8) { m.textContent = 'A senha precisa ter ao menos 8 caracteres.'; return; }
    if (up && !f.ok.checked) { m.textContent = 'Aceite o aviso de privacidade para continuar.'; return; }
    $('#ab').disabled = true;
    const r = up ? await sb.auth.signUp({ email: mail(u), password: p, options: { data: { username: u, plan: f.pl.value } } })
                 : await sb.auth.signInWithPassword({ email: mail(u), password: p });
    $('#ab').disabled = false;
    if (r.error) {
      const t = r.error.message || '';
      m.textContent = /invalid login/i.test(t) ? 'Usuário ou senha incorretos.' : /database error|already|registered/i.test(t) ? 'Esse usuário já existe ou é inválido.'
        : /email address .* invalid/i.test(t) ? 'O Supabase recusou o DOMAIN de js/config.js. Use um domínio que exista na internet (veja o README).'
        : /signups? (are )?disabled/i.test(t) ? 'Cadastros desativados no Supabase: ative o provedor Email e a opção de novos usuários (veja o README).'
        : /not confirmed/i.test(t) ? 'No Supabase, desligue "Confirm email" (veja o README).' : t;
      return;
    }
    if (!r.data.session) { m.textContent = 'Conta criada, mas o Supabase pede confirmação por e-mail. Desligue "Confirm email" (veja o README).'; return; }
    if (up && f.pl.value === 'premium') toast('Conta criada. Seu pedido de Premium aguarda aprovação.');
    enter(r.data.user);
  };
}

function resetState() {
  me = null; progs = []; ud = { goals: [], hist: [], cards: [], txs: [] }; users = []; aprogs = [];
  tmsgs = []; tconvs = []; tcur = null; tloaded = false; tbusy = false; view = 'dash';
  try { speechSynthesis.cancel(); } catch (e) {}
}
async function enter(user) {
  resetState();
  app.innerHTML = '<div class="load">Carregando…</div>';
  const r = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (r.error || !r.data) {
    await sb.auth.signOut(); const t = r.error?.message || '';
    loginView(/permission denied/i.test(t) ? 'Sem permissão para ler o perfil: faltam permissões no banco (rode sql/03_correcao_perfil.sql).' : !r.data || /no rows|multiple \(or no\) rows/i.test(t) ? 'Seu perfil não foi criado no cadastro (rode sql/03_correcao_perfil.sql).' : 'Não foi possível carregar seu perfil: ' + t);
    return;
  }
  me = r.data;
  if (me.blocked) { await sb.auth.signOut(); loginView('Conta bloqueada. Fale com o administrador.'); return; }
  sb.rpc('touch');
  const pl = await sb.from('plan_settings').select('*'); lim = Object.fromEntries((pl.data || []).map(x => [x.plan, x]));
  area = me.role === 'admin' ? 'adm' : me.plan === 'premium' ? 'pre' : 'free'; view = 'dash';
  if (area !== 'adm') await load();
  render();
}

async function load() {
  const r = await sb.from('programs').select('*').order('name'); progs = r.data || [];
  if (area === 'pre') { const u = await sb.from('user_data').select('*').eq('user_id', me.id).maybeSingle(); ud = u.data || { goals: [], hist: [] }; ud.goals = ud.goals || []; ud.hist = ud.hist || []; ud.cards = ud.cards || []; ud.txs = ud.txs || []; }
}
const saveUd = () => sb.from('user_data').upsert({ user_id: me.id, goals: ud.goals, hist: ud.hist.slice(0, 200), cards: ud.cards || [], txs: (ud.txs || []).slice(-1000), updated_at: new Date().toISOString() });

/* ---------- Estrutura e rotas por perfil ---------- */
function shell(items) {
  const adm = area === 'adm';
  const planLabel = adm ? 'Administrador' : area === 'pre' ? 'Plano Premium' : 'Plano Free';
  const current = items.find(([k]) => k === view);
  app.className = adm ? 'adm app-shell' : 'app-shell';
  app.innerHTML = `<aside class="side">
    <a class="brand" href="#inicio" aria-label="Minhas Milhas início"><span class="brand-mark">✈</span><span class="brand-copy"><b>minhas<span>milhas</span></b><small>SMART TRAVEL FINANCE</small></span></a>
    <div class="nav-caption">ESPAÇO DE TRABALHO</div>
    <nav aria-label="Navegação principal">${items.map(([k, i, l]) => `<button type="button" data-v="${k}" aria-current="${view === k ? 'page' : 'false'}" class="${view === k ? 'on' : ''}"><span class="nav-icon">${i}</span><span class="nav-label">${l}</span>${view === k ? '<span class="nav-active-dot"></span>' : ''}</button>`).join('')}</nav>
    <div class="side-bottom"><div class="side-status"><span class="status-pulse"></span><span><b>Sistema operacional</b><small>Seu painel está pronto</small></span></div>
    <div class="who"><div class="avatar">${esc((me.username || 'U').slice(0,1).toUpperCase())}</div><span class="who-copy"><b>${esc(me.username)}</b><small>${planLabel}</small></span><button class="btn sm logout-icon" id="out" type="button" aria-label="Sair" title="Sair">↗</button></div></div>
  </aside><div class="workspace"><header class="topbar"><div class="topbar-heading"><span class="eyebrow">MINHAS MILHAS <i></i> CENTRAL INTELIGENTE</span><div class="topbar-title">${esc(current ? current[2] : 'Painel')}</div></div><div class="topbar-actions"><span class="live-pill"><span></span> DADOS DO SEU PAINEL</span><div class="topbar-user"><span class="avatar">${esc((me.username || 'U').slice(0,1).toUpperCase())}</span><span><b>${esc(me.username)}</b><small>${planLabel}</small></span></div></div></header><main id="mn"></main><footer class="app-footer"><span>✦ MINHAS MILHAS</span><span>Inteligência para viajar mais longe.</span></footer></div>`;
  app.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render(); });
  $('#out').onclick = () => sb.auth.signOut();
}
const AREAS = {
  free: { items: [['dash', '📊', 'Resumo'], ['progs', '✈️', 'Programas'], ['calc', '🧮', 'Calculadoras'], ['opp', '💹', 'Oportunidades'], ['thiny', '💬', 'Thiny'], ['up', '⭐', 'Premium']], views: { dash: () => dash(), progs: () => progView(), calc: () => calcView(), opp: () => oppView(), thiny: () => thinyView(), up: () => upView() } },
  pre: { items: [['dash', '📊', 'Resumo'], ['progs', '✈️', 'Programas'], ['cards', '💳', 'Cartões'], ['goals', '🎯', 'Metas'], ['hist', '🕘', 'Histórico'], ['calc', '🧮', 'Calculadoras'], ['opp', '💹', 'Oportunidades'], ['thiny', '💬', 'Thiny'], ['exp', '📤', 'Exportar']], views: { dash: () => dash(), progs: () => progView(), cards: () => cardsView(), goals: () => goalsView(), hist: () => histView(), calc: () => calcView(), opp: () => oppView(), thiny: () => thinyView(), exp: () => expView() } },
  adm: { items: [['dash', '📊', 'Painel'], ['users', '👥', 'Usuários'], ['progs', '✈️', 'Programas'], ['plans', '🧩', 'Planos'], ['cfg', '⚙️', 'Configurações'], ['opps', '💹', 'Oportunidades'], ['audit', '📜', 'Auditoria'], ['cmd', '🛠️', 'Comandos']], views: { dash: () => aDash(), users: () => aUsers(), progs: () => aProgs(), plans: () => aPlans(), cfg: () => aCfg(), opps: () => aOpps(), audit: () => aAudit(), cmd: () => aCmd() } }
};
async function render() {
  const A = AREAS[area]; shell(A.items); const mn = $('#mn'); mn.innerHTML = '<div class="load">Carregando…</div>';
  try { mn.innerHTML = await A.views[view](); } catch (e) { mn.innerHTML = `<div class="empty">${esc(err(e))}</div>`; }
  mn.oninput = e => { if (e.target.closest('[data-calc]')) calc(e); }; mn.onchange = e => { if (e.target.closest('[data-calc]')) calc(e); if (e.target.id === 'tc') ACT.topen(e.target.value); }; mn.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'ti') ACT.tsend(); };
  mn.onclick = async e => {
    const nav = e.target.closest('[data-v]');
    if (nav) { view = nav.dataset.v; render(); return; }
    const b = e.target.closest('[data-a]'); if (b && ACT[b.dataset.a]) await ACT[b.dataset.a](b.dataset.id, b);
  };
}

/* ---------- Free e Premium ---------- */
function dash() {
  const pre = area === 'pre';
  const tot = progs.reduce((a, p) => a + Number(p.balance || 0), 0);
  const max = lim[me.plan]?.max_programs;
  const est = progs.reduce((a, p) => a + (p.milheiro ? Number(p.balance || 0) / 1000 * Number(p.milheiro) : 0), 0);
  const soon = progs.filter(p => p.expires_on && (new Date(p.expires_on + 'T00:00:00') - new Date()) / 864e5 <= 30)
    .sort((a,b) => String(a.expires_on).localeCompare(String(b.expires_on)));
  const sorted = [...progs].sort((a,b) => Number(b.balance || 0) - Number(a.balance || 0));
  const top = sorted.slice(0, 5);
  const totalPrograms = progs.length;
  const firstName = (me.username || 'viajante').split(/[_.-]/)[0];
  const fmtCompact = n => Number(n || 0).toLocaleString('pt-BR', { notation:'compact', maximumFractionDigits:1 });
  const share = (p) => tot ? Math.round(Number(p.balance || 0) / tot * 100) : 0;
  const ringStops = (() => {
    if (!top.length || !tot) return '#283449 0 100%';
    let cur = 0;
    const colors = ['#51dff5','#9874ff','#4d8dff','#ed79f5','#40d9b0'];
    return top.map((p,i) => { const a=cur; cur += Number(p.balance||0)/tot*100; return `${colors[i%colors.length]} ${a}% ${cur}%`; }).join(',');
  })();
  const miniBars = top.length ? top.map((p,i) => {
    const pct = tot ? Math.max(3, Number(p.balance||0)/Math.max(...top.map(x=>Number(x.balance||0)),1)*100) : 3;
    return `<div class="orbit-program-row"><span class="orbit-program-icon op-${i%5}">${['✈','◇','✦','◎','✧'][i%5]}</span><span class="orbit-program-name">${esc(p.name)}</span><span class="orbit-program-value">${fmtCompact(p.balance)}</span><span class="orbit-program-track"><i class="op-fill-${i%5}" style="width:${pct}%"></i></span></div>`;
  }).join('') : `<div class="dash-empty-inline">Cadastre um programa para ver seus saldos aqui.</div>`;
  const pointDots = top.map((p,i) => {
    const x = 35 + i*115, y = 105 - Math.min(65, (Number(p.balance||0)/Math.max(...top.map(x=>Number(x.balance||0)),1))*65);
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="${['#55e4f7','#9d76ff','#4e94ff','#ed79f5','#48dcb5'][i%5]}" stroke="#d7faff" stroke-width="1.2"/><text x="${x}" y="139" text-anchor="middle" fill="#899bb7" font-size="9">${esc(String(p.name).slice(0,9))}</text>`;
  }).join('');
  const linePath = top.length > 1 ? top.map((p,i) => `${i?'L':'M'} ${35+i*115} ${105-Math.min(65,(Number(p.balance||0)/Math.max(...top.map(x=>Number(x.balance||0)),1))*65)}`).join(' ') : 'M 35 90 L 150 76 L 265 85 L 380 48 L 495 60';
  const hist = (ud.hist || []).slice(0, 7);
  const historyRows = hist.length ? hist.map((h,i) => `<div class="dash-history-row"><span class="history-dot hd-${i%4}"></span><span class="dash-history-name">${esc(h.p || 'Movimentação')}<small>${dfmt(h.d)}</small></span><b class="${Number(h.dl)>=0?'positive':'negative'}">${Number(h.dl)>=0?'+':'−'}${fmt(Math.abs(Number(h.dl||0)))}</b></div>`).join('') : `<div class="dash-empty-state"><span class="empty-chart-icon">⌁</span><b>Seu histórico vai aparecer aqui</b><span>Registre movimentações para acompanhar a evolução dos seus saldos.</span><button class="dash-link" data-v="progs">Gerenciar programas ↗</button></div>`;
  const soonHtml = soon.length ? `<div class="dash-alert"><span>!</span><div><b>Vencimentos próximos</b><small>${soon.map(p=>`${esc(p.name)} · ${dfmt(p.expires_on)}`).join(' &nbsp;•&nbsp; ')}</small></div></div>` : '';
  return `
  <section class="orbit-dashboard">
    <div class="orbit-overview">
      <div class="orbit-card-heading"><div><span class="orbit-eyebrow">VISÃO GERAL</span><h2>Seu universo de milhas</h2></div><span class="orbit-status"><i></i> Atualizado</span></div>
      <div class="orbit-metric-grid">
        <article class="orbit-metric"><span class="orbit-metric-label">Total de milhas</span><strong>${fmt(tot)}</strong><small>✦ Saldo acumulado</small><span class="metric-spark spark-cyan">⌁⌁⌁⌁</span></article>
        <article class="orbit-metric"><span class="orbit-metric-label">Programas ativos</span><strong>${totalPrograms}${max != null ? `<small class="metric-limit"> / ${max}</small>` : ''}</strong><small>◈ Programas cadastrados</small><span class="metric-spark spark-blue">⌁⌁⌁</span></article>
        <article class="orbit-metric"><span class="orbit-metric-label">${pre?'Valor estimado':'Oportunidades'}</span><strong>${pre?brl(est):'Explore'}</strong><small>${pre?'Estimativa pelo milheiro':'Promoções e transferências'}</small><span class="metric-spark spark-purple">⌁⌁⌁⌁</span></article>
        <article class="orbit-metric"><span class="orbit-metric-label">Vencimentos próximos</span><strong>${soon.length}</strong><small>${soon.length?'Nos próximos 30 dias':'Nenhum alerta próximo'}</small><span class="metric-spark spark-pink">⌁⌁⌁</span></article>
      </div>
    </div>
    <div class="orbit-card orbit-trend">
      <div class="orbit-card-heading"><div><span class="orbit-eyebrow">SEUS PROGRAMAS</span><h3>Distribuição de milhas</h3></div><span class="orbit-select-label">Por saldo⌄</span></div>
      <div class="orbit-trend-total"><strong>${fmtCompact(tot)}</strong><span>milhas no total</span></div>
      <svg class="orbit-chart-line" viewBox="0 0 540 155" role="img" aria-label="Gráfico de distribuição dos saldos por programa"><defs><linearGradient id="orbitLineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#55dff4" stop-opacity=".42"/><stop offset="100%" stop-color="#8b6cff" stop-opacity="0"/></linearGradient><linearGradient id="orbitLineStroke"><stop stop-color="#55e5f4"/><stop offset="100%" stop-color="#a777ff"/></linearGradient></defs><path class="orbit-gridline" d="M0 25H540 M0 55H540 M0 85H540 M0 115H540"/><path d="${linePath} L ${35+Math.max(0,top.length-1)*115} 128 L 35 128 Z" fill="url(#orbitLineFill)"/><path d="${linePath}" fill="none" stroke="url(#orbitLineStroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pointDots}</svg>
      <div class="orbit-chart-foot"><span><i class="legend-dot cyan"></i> Saldo por programa</span><span>${totalPrograms} ${totalPrograms===1?'programa':'programas'}</span></div>
    </div>
    <div class="orbit-card orbit-history">
      <div class="orbit-card-heading"><div><span class="orbit-eyebrow">ATIVIDADE</span><h3>Evolução e movimentações</h3></div><button class="orbit-select-label orbit-select-button" data-v="${pre?'hist':'progs'}">Ver detalhes ↗</button></div>
      ${hist.length ? `<div class="orbit-history-chart"><div class="history-chart-scale"><span>Recentes</span><span>Movimentações</span><span>Anteriores</span></div><div class="history-bars">${hist.slice().reverse().map((h,i)=>`<div class="history-bar-wrap"><span class="history-bar-value">${fmtCompact(Math.abs(Number(h.dl||0)))}</span><i class="history-bar hb-${i%5}" style="height:${Math.max(12,Math.abs(Number(h.dl||0))/Math.max(...hist.map(x=>Math.abs(Number(x.dl||0))),1)*100)}%"></i><small>${esc(String(h.p||'Pontos').slice(0,8))}</small></div>`).join('')}</div></div>` : `<div class="orbit-empty-chart"><svg viewBox="0 0 600 105" preserveAspectRatio="none" aria-hidden="true"><path d="M0 88 C60 55 95 80 150 48 S250 75 305 38 S390 72 450 27 S530 50 600 12" fill="none" stroke="#49d9f1" stroke-width="2.5"/><path d="M0 98 C65 76 95 48 150 65 S235 30 305 58 S390 20 450 48 S530 32 600 20" fill="none" stroke="#9468f5" stroke-width="2.5" opacity=".8"/></svg><div><b>Seu próximo gráfico começa aqui</b><span>Registre movimentações para acompanhar a evolução real das milhas.</span><button class="dash-link" data-v="progs">Adicionar ou lançar pontos ↗</button></div></div>`}
    </div>
    <div class="orbit-card orbit-map-card">
      <div class="orbit-card-heading"><div><span class="orbit-eyebrow">CARTEIRA DE FIDELIDADE</span><h3>Programas acompanhados</h3></div><span class="orbit-status"><i></i> ${totalPrograms} ativos</span></div>
      <div class="orbit-program-list">${miniBars}</div>
      <div class="orbit-map-foot"><span>✈ Seus programas, em um só lugar</span><button class="dash-link" data-v="progs">Ver programas ↗</button></div>
    </div>
    <div class="orbit-card orbit-donut-card">
      <div class="orbit-card-heading"><div><span class="orbit-eyebrow">COMPOSIÇÃO</span><h3>Seus saldos</h3></div></div>
      <div class="orbit-donut-wrap"><div class="orbit-donut" style="background:conic-gradient(${ringStops})"><div><strong>${fmtCompact(tot)}</strong><small>milhas</small></div></div></div>
      <div class="orbit-legend">${top.slice(0,4).map((p,i)=>`<div><span><i class="legend-dot color-${i}"></i>${esc(p.name)}</span><b>${share(p)}%</b></div>`).join('') || '<span class="dash-empty-inline">Cadastre programas para ver a composição.</span>'}</div>
    </div>
    <div class="orbit-card orbit-top-card">
      <div class="orbit-card-heading"><div><span class="orbit-eyebrow">DESTAQUES</span><h3>Maiores saldos</h3></div><span class="orbit-select-label">Top ${top.length}</span></div>
      <div class="orbit-top-list">${top.length ? top.map((p,i)=>`<div class="orbit-top-row"><span class="orbit-top-rank rank-${i}">${i+1}</span><span class="orbit-top-name">${esc(p.name)}<small>${share(p)}% do total</small></span><b>${fmtCompact(p.balance)}</b><span class="orbit-top-track"><i class="op-fill-${i%5}" style="width:${tot?Number(p.balance||0)/Math.max(...top.map(x=>Number(x.balance||0)),1)*100:0}%"></i></span></div>`).join('') : '<div class="dash-empty-inline">Seus maiores saldos aparecerão após cadastrar programas.</div>'}</div>
    </div>
    ${soonHtml}
  </section>`;
}
function progView() {
  const max = lim[me.plan]?.max_programs, pre = area === 'pre', full = max != null && progs.length >= max;
  return head('Programas', `<button class="btn pri" data-a="padd" ${full ? 'disabled' : ''}>+ Programa</button>`) +
    (full ? `<div class="note">Você atingiu o limite de ${max} programas do plano Free. Veja a aba Premium.</div>` : '') +
    (progs.length ? `<div class="tbl"><table><tr><th>Programa</th><th>Saldo</th><th>Vence</th>${pre ? '<th>Milheiro</th><th>Titular</th>' : ''}<th></th></tr>${progs.map(p => `<tr><td>${esc(p.name)}</td><td>${fmt(p.balance)}</td><td>${dfmt(p.expires_on)}</td>${pre ? `<td>${p.milheiro ? brl(p.milheiro) : '—'}</td><td>${esc(p.holder || '—')}</td>` : ''}<td class="act">${pre ? `<button class="btn sm" data-a="lanc" data-id="${p.id}">± Lançar</button>` : ''}<button class="btn sm" data-a="pedit" data-id="${p.id}">Editar</button><button class="btn sm bad" data-a="pdel" data-id="${p.id}">Excluir</button></td></tr>`).join('')}</table></div>` : '<div class="empty">Nenhum programa cadastrado. Toque em “+ Programa”.</div>');
}
function pform(p) {
  const pre = area === 'pre';
  modal(p ? 'Editar programa' : 'Novo programa', `<label>Programa</label><input name="name" required maxlength="40" value="${esc(p?.name || '')}"><label>Saldo (milhas ou pontos)</label><input name="balance" type="number" min="0" step="1" required value="${p?.balance ?? ''}"><label>Vencimento</label><input name="exp" type="date" value="${p?.expires_on || ''}">` +
    (pre ? `<label>Valor do milheiro (R$)</label><input name="mil" type="number" min="0" step="0.01" value="${p?.milheiro ?? ''}"><label>Titular</label><input name="holder" maxlength="30" value="${esc(p?.holder || '')}">` : ''), 'Salvar', async f => {
    const o = { name: f.name.value.trim().slice(0, 40), balance: Math.max(0, parseInt(f.balance.value) || 0), expires_on: f.exp.value || null };
    if (!o.name) { toast('Informe o nome do programa.', false); return false; }
    if (pre) { o.milheiro = f.mil.value ? +f.mil.value : null; o.holder = f.holder.value.trim() || null; }
    const q = p ? sb.from('programs').update(o).eq('id', p.id) : sb.from('programs').insert({ ...o, user_id: me.id });
    const { error } = await q; if (error) { toast(err(error), false); return false; }
    await load(); toast('Programa salvo.'); render();
  });
}
function lanc(p) {
  modal('Lançamento: ' + p.name, `<label>Tipo</label><select name="k"><option value="c">Compra</option><option value="o">Outro crédito</option><option value="r">Resgate / uso</option></select><label>Quantidade</label><input name="q" type="number" min="1" required><label>Observação</label><input name="n" maxlength="60">`, 'Salvar', async f => {
    const q = parseInt(f.q.value) || 0, r = f.k.value === 'r', dl = r ? -Math.min(q, p.balance) : q;
    if (q <= 0) { toast('Informe a quantidade.', false); return false; }
    const { error } = await sb.from('programs').update({ balance: p.balance + dl }).eq('id', p.id); if (error) { toast(err(error), false); return false; }
    ud.hist.unshift({ d: new Date().toISOString(), p: p.name, dl, n: f.n.value.trim().slice(0, 60) }); await saveUd(); await load(); toast('Lançamento registrado.'); render();
  });
}
function upView() {
  const pend = me.plan_requested === 'premium';
  return head('Plano Premium') + `<div class="card"><h3>Libere todos os recursos</h3><p>Com o Premium você tem programas ilimitados e:</p><ul><li>Metas de resgate e histórico de movimentações</li><li>Evolução do saldo e valor estimado do milheiro</li><li>Lançamento rápido de créditos e resgates</li><li>Exportação em JSON, CSV e calendário (ICS)</li><li>Dados salvos na nuvem, com titulares (conta família)</li></ul>${pend ? '<div class="note">✅ Seu pedido foi enviado. Aguarde a aprovação do administrador.</div>' : '<button class="btn pri" data-a="upg">Solicitar Premium</button>'}</div>
  <div class="card lock"><h3>Bloqueado no plano Free 🔒</h3><p class="hint">Metas · Histórico · Evolução · Milheiro · Lançamento rápido · Exportação · Thiny completa</p></div>`;
}
function goalsView() {
  return head('Metas de resgate', '<button class="btn pri" data-a="gadd">+ Meta</button>') + (ud.goals.length ? ud.goals.map((g, i) => {
    const have = (g.p ? progs.filter(p => p.name === g.p) : progs).reduce((a, p) => a + p.balance, 0), pc = Math.min(100, Math.round(have / g.t * 100));
    return `<div class="card"><div class="row2"><b>${esc(g.n)}${g.p ? ' · ' + esc(g.p) : ''}</b><button class="btn sm bad" data-a="gdel" data-id="${i}">Excluir</button></div><div class="meter"><i style="width:${pc}%"></i></div><small>${fmt(have)} de ${fmt(g.t)} (${pc}%). Faltam ${fmt(Math.max(0, g.t - have))}.</small></div>`;
  }).join('') : '<div class="empty">Nenhuma meta ainda. Toque em “+ Meta”.</div>');
}
const histView = () => head('Histórico') + (ud.hist.length ? `<div class="tbl"><table><tr><th>Data</th><th>Programa</th><th>Variação</th><th>Observação</th></tr>${ud.hist.slice(0, 100).map(h => `<tr><td>${dfmt(h.d)}</td><td>${esc(h.p)}</td><td>${h.dl > 0 ? '+' : ''}${fmt(h.dl)}</td><td>${esc(h.n || '')}</td></tr>`).join('')}</table></div>` : '<div class="empty">Sem movimentações ainda. Use “± Lançar” em Programas.</div>');
const expView = () => head('Exportar') + '<div class="card"><p>Baixe seus dados quando quiser.</p><div class="row" style="justify-content:flex-start"><button class="btn" data-a="exj">JSON</button><button class="btn" data-a="exc">CSV</button><button class="btn" data-a="exi">Calendário (.ics)</button></div></div>';
const dl = (n, t, m) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: m })); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const cell = s => { s = String(s ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

/* ---------- Administração ---------- */
async function aDash() {
  const { data: s, error } = await sb.rpc('admin_stats'); if (error) throw error;
  return head('Painel administrativo') + `<div class="kpis">${kpi('Usuários', s.users)}${kpi('Free', s.free)}${kpi('Premium', s.premium)}${kpi('Administradores', s.admins)}${kpi('Bloqueados', s.blocked)}${kpi('Programas', s.programs)}${kpi('Cadastros em 7 dias', s.signups_7d)}${kpi('Ativos em 7 dias', s.active_7d)}${kpi('Pedidos de Premium', s.pending_premium)}${kpi('Thiny hoje', s.thiny_today)}</div>`;
}
async function aUsers() {
  const r = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(500); if (r.error) throw r.error; users = r.data;
  return head('Usuários', '<button class="btn pri" data-a="ucreate">+ Criar usuário</button>') + `<div class="tbl"><table><tr><th>Usuário</th><th>Plano</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th></th></tr>${users.map(u => `<tr><td>${esc(u.username)}${u.plan_requested === 'premium' && u.plan === 'free' ? ' <span class="tag">pediu Premium</span>' : ''}</td><td>${u.plan}</td><td>${u.role === 'admin' ? 'ADM' : 'Usuário'}</td><td>${u.blocked ? '<span class="tag bad">Bloqueado</span>' : 'Ativo'}</td><td>${dfmt(u.last_seen)}</td><td class="act">${u.plan === 'free' ? `<button class="btn sm" data-a="uplan" data-id="${u.id}" data-p="premium">${u.plan_requested === 'premium' ? 'Aprovar Premium' : 'Tornar Premium'}</button>` : `<button class="btn sm" data-a="uplan" data-id="${u.id}" data-p="free">Voltar a Free</button>`}<button class="btn sm" data-a="ublk" data-id="${u.id}">${u.blocked ? 'Desbloquear' : 'Bloquear'}</button><button class="btn sm" data-a="urole" data-id="${u.id}">${u.role === 'admin' ? 'Remover ADM' : 'Tornar ADM'}</button><button class="btn sm" data-a="upass" data-id="${u.id}">Senha</button><button class="btn sm bad" data-a="udel" data-id="${u.id}">Excluir</button></td></tr>`).join('')}</table></div>`;
}
async function aPlans() {
  const r = await sb.from('plan_settings').select('*'); if (r.error) throw r.error; lim = Object.fromEntries(r.data.map(x => [x.plan, x]));
  return head('Planos e limites') + '<p class="hint">Os limites de programas e de perguntas à Thiny são aplicados pelo banco. Os recursos marcados orientam a interface.</p>' + ['free', 'premium'].map(p => { const L = lim[p]; return `<div class="card" data-pl="${p}"><h3>${p === 'free' ? 'Free' : 'Premium'}</h3><div class="grid2"><label>Máx. de programas (vazio = ilimitado)<input type="number" min="0" name="mp" value="${L.max_programs ?? ''}"></label><label>Perguntas à Thiny por dia (vazio = ilimitado)<input type="number" min="0" name="td" value="${L.thiny_daily ?? ''}"></label></div><div class="chk">${Object.entries(L.features || {}).map(([k, v]) => `<label><input type="checkbox" name="${esc(k)}" ${v ? 'checked' : ''}> ${esc(k.replace(/_/g, ' '))}</label>`).join('')}</div><button class="btn pri" data-a="psave" data-id="${p}">Salvar ${p}</button></div>`; }).join('');
}
async function aCfg() {
  const r = await sb.from('app_settings').select('*'); if (r.error) throw r.error; const c = Object.fromEntries(r.data.map(x => [x.key, x.value]));
  return head('Configurações') + `<div class="card" data-cf="general"><h3>Geral</h3><label>Nome do sistema<input name="nome" maxlength="40" value="${esc(c.general?.nome || '')}"></label><button class="btn pri" data-a="csave" data-id="general">Salvar</button></div>
  <div class="card" data-cf="signup"><h3>Cadastro</h3><label class="opt"><input type="checkbox" name="premium_instant" ${c.signup?.premium_instant ? 'checked' : ''}><span>Liberar Premium na hora para quem escolher esse plano (sem aprovação). Use só para testes.</span></label><button class="btn pri" data-a="csave" data-id="signup">Salvar</button></div>
  <div class="card" data-cf="thiny"><h3>Thiny</h3><label class="opt"><input type="checkbox" name="enabled" ${c.thiny?.enabled !== false ? 'checked' : ''}><span>Thiny ativada</span></label><label class="opt"><input type="checkbox" name="salvar_historico" ${c.thiny?.salvar_historico !== false ? 'checked' : ''}><span>Salvar o histórico das conversas de cada usuário (cada um vê só o seu)</span></label><label class="opt"><input type="checkbox" name="voz_somente_premium" ${c.thiny?.voz_somente_premium !== false ? 'checked' : ''}><span>Voz somente para Premium</span></label><label>Ações permitidas (separadas por vírgula)<input name="acoes" value="${esc((c.thiny?.acoes_permitidas || []).join(', '))}"></label><button class="btn pri" data-a="csave" data-id="thiny">Salvar</button></div>`;
}
async function aAudit() {
  const r = await sb.from('admin_audit').select('*').order('at', { ascending: false }).limit(100); if (r.error) throw r.error;
  return head('Auditoria') + (r.data.length ? `<div class="tbl"><table><tr><th>Quando</th><th>Administrador</th><th>Ação</th><th>Detalhes</th></tr>${r.data.map(a => `<tr><td>${dfmt(a.at)} ${new Date(a.at).toLocaleTimeString('pt-BR')}</td><td>${esc(a.admin_name)}</td><td>${esc(a.action)}</td><td>${esc(JSON.stringify(a.details || {}).slice(0, 90))}</td></tr>`).join('')}</table></div>` : '<div class="empty">Nenhuma ação registrada ainda.</div>');
}
const aCmd = () => head('Comandos de manutenção') + `<div class="card"><p class="hint">Somente comandos de uma lista fixa. Cada execução fica na auditoria.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn" data-a="cmd" data-id="reset_thiny_hoje">Zerar cota da Thiny de hoje</button><button class="btn" data-a="cmd" data-id="limpar_uso_antigo">Limpar uso com mais de 30 dias</button><button class="btn" data-a="cmd" data-id="aprovar_pedidos_premium">Aprovar todos os pedidos de Premium</button></div></div>`;
const rpc = async (fn, args, ok) => { const { error } = await sb.rpc(fn, args); if (error) { toast(err(error), false); return; } toast(ok); render(); };
const uOf = id => users.find(u => u.id === id);

/* ---------- Funções auxiliares (servidor, calculadoras, Thiny) ---------- */
const fn = async (n, b) => { const { data, error } = await sb.functions.invoke(n, { body: b }); if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch (e) {} throw new Error(m); } return data; };
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const hoje = () => new Date().toLocaleDateString('en-CA');
const num = s => { s = String(s).replace(/R\$|\s/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s); };
const dt = s => { s = s.trim(); const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : /^\d{4}-\d\d-\d\d$/.test(s) ? s : ''; };

const ROTAS = [['Livelo → Smiles', 1, '1:1'], ['Livelo → LATAM Pass', 1, '1:1'], ['Livelo → Azul', 1, '1:1'], ['Esfera → Smiles', 1, '1:1'], ['Esfera → LATAM Pass', 1, '1:1'], ['Esfera → Azul', 1, '1:1'], ['LATAM Pass → ALL Accor', .25, '4:1'], ['Livelo → Copa ConnectMiles', 1 / 3, '3:1']];
const calcView = () => head('Calculadoras') + `<div class="card" data-calc><h3>Transferência com bônus</h3><label>Rota (confira a paridade no site oficial)</label><select name="r"><option value="">Escolher…</option>${ROTAS.map((r, i) => `<option value="${i}">${esc(r[0])} (${r[2]})</option>`).join('')}</select><div class="grid2"><label>Pontos<input name="p" type="number" min="0"></label><label>Bônus (%)<input name="b" type="number" min="0" value="0"></label></div><label>Paridade (multiplicador)<input name="k" type="number" min="0" step="0.01" value="1"></label><b id="r1"></b></div>
<div class="card" data-calc><h3>Milhas ou dinheiro?</h3><div class="grid2"><label>Preço em dinheiro (R$)<input name="a" type="number" min="0"></label><label>Milhas exigidas<input name="m" type="number" min="0"></label><label>Taxas (R$)<input name="t" type="number" min="0" value="0"></label><label>Seu custo do milheiro (R$)<input name="c" type="number" min="0"></label></div><b id="r2"></b></div>`;
function calc(e) {
  const [c1, c2] = document.querySelectorAll('[data-calc]'); if (!c1) return; const g = (c, n) => +c.querySelector('[name=' + n + ']').value || 0;
  if (e && e.target.name === 'r' && e.target.value !== '') c1.querySelector('[name=k]').value = (+ROTAS[e.target.value][1].toFixed(4));
  const p = g(c1, 'p'), b = g(c1, 'b'), k = g(c1, 'k') || 1; $('#r1').textContent = p ? 'Você recebe ' + fmt(Math.round(p * (1 + b / 100) * k)) + ' milhas ou pontos' : '';
  const a = g(c2, 'a'), m = g(c2, 'm'), t = g(c2, 't'), c = g(c2, 'c');
  $('#r2').textContent = a && m ? 'Cada milheiro rende ' + brl((a - t) / (m / 1000)) + (c ? ((a - t) / (m / 1000) > c ? ' — compensa usar milhas' : ' — compensa pagar em dinheiro') : '') : '';
}

const OPP0 = [
  { k: 'a', p: 'Esfera', t: 'Petlove Saúde', d: '30 pontos por real', v: 30, f: '2026-10-18', s: ['esfera'] }, { k: 'a', p: 'Smiles', t: 'Polishop', d: '26 milhas por real', v: 26, f: '2026-10-18', s: ['smiles'] },
  { k: 'a', p: 'Esfera', t: 'Unidas', d: '10 pontos por real', v: 10, f: '2026-10-15', s: ['esfera'] }, { k: 'a', p: 'Esfera', t: 'Camicado', d: '8 pontos por real', v: 8, f: '2026-10-15', s: ['esfera'] },
  { k: 'a', p: 'Esfera', t: 'Polishop', d: '8 pontos por real', v: 8, f: '2026-10-19', s: ['esfera'] }, { k: 'a', p: 'Esfera', t: 'Decolar', d: '6 pontos por real', v: 6, f: '2026-10-16', s: ['esfera'] },
  { k: 'a', p: 'Smiles', t: 'Lojas selecionadas', d: '4,5 milhas por real', v: 4.5, f: '2026-10-20', s: ['smiles'] },
  { k: 't', p: 'Livelo → Copa ConnectMiles', t: '50% de bônus', d: 'Mínimo de 3.000 pontos; paridade 3:1', v: 50, f: '2026-10-15', s: ['livelo'] },
  { k: 't', p: 'LATAM Pass', t: '25% de recompensa (Missão)', d: 'Ativar no app até 19/10; para quem recebeu a comunicação; até 300 mil milhas extras', v: 25, f: '2026-10-19', s: ['livelo', 'esfera', 'banco'] },
  { k: 't', p: 'ALL Accor', t: '10% a 20% de bônus', d: 'A partir do LATAM Pass, paridade 4:1; 20% para ALL Signature', v: 20, f: '2026-10-16', s: ['latam'] }
];
async function oppView() {
  const r = await sb.from('app_settings').select('value').eq('key', 'opps').maybeSingle(), v = r.data?.value;
  const list = (v && Array.isArray(v.itens) ? v.itens : OPP0).filter(o => o.f >= hoje()), upd = (v && v.u) || '2026-10-13', mine = progs.map(p => p.name.toLowerCase());
  const ord = { a: 0, t: 1, c: 2 }, tit = { a: 'Pontos por real', t: 'Bônus de transferência', c: 'Clubes' };
  list.sort((a, b) => (ord[a.k] - ord[b.k]) || (b.v - a.v));
  return head('Oportunidades de mercado') + `<p class="hint">Atualizado em ${dfmt(upd)}. Confira o regulamento oficial antes de transferir. ⭐ = você tem saldo nesse programa.</p>` +
    (list.length ? ['a', 't', 'c'].map(k => { const l = list.filter(o => o.k === k); return l.length ? `<h3>${tit[k]}</h3>` + l.map(o => { const n = Math.round((new Date(o.f + 'T00:00:00') - new Date(hoje() + 'T00:00:00')) / 864e5); return `<div class="card"><div class="row2"><b>${esc(o.p)} · ${esc(o.t)}${(o.s || []).some(s => mine.some(m => m.includes(s))) ? ' ⭐' : ''}</b><span class="tag ${n <= 1 ? 'bad' : ''}">${n === 0 ? 'termina hoje' : n + ' dias'}</span></div><small class="hint">${esc(o.d)} · até ${dfmt(o.f)}</small></div>`; }).join('') : ''; }).join('') : '<div class="empty">Nenhuma oportunidade vigente no momento.</div>');
}

const cardsView = () => head('Cartões e faturas', '<div><button class="btn" data-a="cadd">+ Cartão</button> <button class="btn pri" data-a="cimp">Importar fatura</button></div>') + (ud.cards.length ? ud.cards.map((c, i) => { const t = ud.txs.filter(x => x.c === c.n), g = t.reduce((a, x) => a + x.v, 0); return `<div class="card"><div class="row2"><b>${esc(c.n)}</b><button class="btn sm bad" data-a="cdel" data-id="${i}">Excluir</button></div><p>${c.k} pts por R$${c.p ? ' → ' + esc(c.p) : ''} · ${t.length} lançamentos · ${brl(g)}</p><b>${fmt(Math.floor(Math.max(0, g) * c.k))} pontos estimados</b></div>`; }).join('') : '<div class="empty">Cadastre um cartão e importe a fatura para estimar os pontos.</div>');

let aprogs = [];
async function aProgs() {
  const r = await sb.from('programs').select('*,profiles(username)').order('created_at', { ascending: false }).limit(500); if (r.error) throw r.error; aprogs = r.data;
  return head('Programas dos usuários') + (aprogs.length ? `<div class="tbl"><table><tr><th>Usuário</th><th>Programa</th><th>Saldo</th><th>Vence</th><th></th></tr>${aprogs.map(p => `<tr><td>${esc(p.profiles?.username)}</td><td>${esc(p.name)}</td><td>${fmt(p.balance)}</td><td>${dfmt(p.expires_on)}</td><td class="act"><button class="btn sm" data-a="apedit" data-id="${p.id}">Editar</button><button class="btn sm bad" data-a="apdel" data-id="${p.id}">Excluir</button></td></tr>`).join('')}</table></div>` : '<div class="empty">Nenhum programa cadastrado.</div>');
}
async function aOpps() {
  const r = await sb.from('app_settings').select('value').eq('key', 'opps').maybeSingle(), itens = r.data?.value?.itens || OPP0;
  return head('Oportunidades de mercado') + `<div class="card"><p class="hint">Edite a lista em JSON. Campos: k (a, t ou c), p, t, d, v, f (AAAA-MM-DD) e s (lista de programas para a marcação ⭐). Itens vencidos somem sozinhos.</p><textarea id="oj" rows="14" style="font-family:monospace">${esc(JSON.stringify(itens, null, 1))}</textarea><div class="row"><button class="btn pri" data-a="osave">Publicar lista</button></div></div>`;
}

let tmsgs = [], tbusy = false, vozOn = true, tconvs = [], tcur = null, tloaded = false, tcerr = false;
const chatHtml = () => tmsgs.map(m => `<div class="msg ${m.r}">${esc(m.t)}</div>`).join('') || '<div class="hint">Pergunte sobre o app ou sobre milhas.</div>';
async function loadConvs() { const r = await sb.from('thiny_conversations').select('id,title,updated_at').order('updated_at', { ascending: false }).limit(50); tcerr = !!r.error; tconvs = r.error ? [] : r.data; tloaded = true; }
async function openConv(id) {
  if (!id) { tcur = null; tmsgs = []; return; }
  const r = await sb.from('thiny_messages').select('role,content').eq('conversation_id', id).order('id').limit(200);
  tcur = id; tmsgs = (r.data || []).map(m => ({ r: m.role === 'user' ? 'u' : 'a', t: m.content }));
}
async function thinyView() {
  if (!tloaded) { await loadConvs(); if (!tcur && tconvs.length && !tmsgs.length) await openConv(tconvs[0].id); }
  return head('Thiny') + `<div class="card">${tcerr ? '<div class="note">Histórico indisponível: execute sql/04_thiny_historico.sql no Supabase.</div>' : `<div class="row2" style="margin-bottom:10px"><select id="tc"><option value="">+ Nova conversa</option>${tconvs.map(c => `<option value="${c.id}" ${c.id === tcur ? 'selected' : ''}>${esc(c.title)} · ${dfmt(c.updated_at)}</option>`).join('')}</select><button class="btn" data-a="tnew">Nova</button><button class="btn bad" data-a="tdel" ${tcur ? '' : 'disabled'}>Excluir</button></div>`}<div id="tm" class="chat">${chatHtml()}</div><div class="row2" style="margin-top:10px"><input id="ti" maxlength="400" placeholder="${area === 'pre' ? 'Pergunte ou peça um registro' : 'Pergunte sobre o app ou sobre milhas'}"><button class="btn pri" data-a="tsend">Enviar</button>${area === 'pre' ? `<button class="btn" data-a="tvoz" title="Ligar ou desligar a voz">${vozOn ? '🔊' : '🔇'}</button>` : ''}${area === 'pre' && SR ? '<button class="btn" data-a="tmic" title="Falar">🎤</button>' : ''}</div><p class="hint">${area === 'pre' ? 'Thiny completa: usa seus dados, propõe ações que só valem depois do seu OK e fala as respostas.' + (SR ? '' : ' O microfone não está disponível neste navegador (use Chrome ou Edge).') : 'Thiny básica: 5 perguntas por dia, sem dados pessoais, ações ou voz.'} Suas conversas são só suas.</p></div>`;
}
const refreshChat = () => { const c = $('#tm'); if (c) { c.innerHTML = chatHtml(); c.scrollTop = c.scrollHeight; } };
const speak = t => { if (area !== 'pre' || !vozOn || !window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t).replace(/[*_#`>]|\p{Extended_Pictographic}/gu, '')); u.lang = 'pt-BR'; speechSynthesis.speak(u); } catch (e) {} };
async function propor(a) {
  if (area !== 'pre') return;
  const n = v => Math.round(+v) || 0, low = s => String(s || '').trim().toLowerCase(); let txt = '', run;
  if (a.tipo === 'lancamento') {
    const p = progs.find(x => x.name.toLowerCase() === low(a.programa)), q = n(a.quantidade), k = ['c', 'o', 'r'].includes(a.kind) ? a.kind : 'o';
    if (!p || q <= 0) return toast('A Thiny não conseguiu montar esse lançamento.', false);
    txt = (k === 'r' ? 'Resgate de ' : k === 'c' ? 'Compra de ' : 'Crédito de ') + fmt(q) + ' em ' + p.name;
    run = async () => { const dl = k === 'r' ? -Math.min(q, p.balance) : q; const { error } = await sb.from('programs').update({ balance: p.balance + dl }).eq('id', p.id); if (error) throw error; ud.hist.unshift({ d: new Date().toISOString(), p: p.name, dl, n: 'via Thiny' }); const r = await saveUd(); if (r.error) throw r.error; };
  } else if (a.tipo === 'programa') {
    const nome = String(a.programa || '').trim().slice(0, 40), s = n(a.saldo), v = /^\d{4}-\d\d-\d\d$/.test(a.vencimento) ? a.vencimento : null;
    if (!nome || s < 0) return toast('A Thiny não conseguiu montar esse programa.', false);
    txt = 'Programa ' + nome + ' com saldo ' + fmt(s);
    run = async () => { const ex = progs.find(x => x.name.toLowerCase() === nome.toLowerCase()); const { error } = await (ex ? sb.from('programs').update({ balance: s, ...(v ? { expires_on: v } : {}) }).eq('id', ex.id) : sb.from('programs').insert({ user_id: me.id, name: nome, balance: s, expires_on: v })); if (error) throw error; };
  } else if (a.tipo === 'meta') {
    const nome = String(a.nome || '').trim().slice(0, 50), t = n(a.milhas), p = progs.find(x => x.name.toLowerCase() === low(a.programa));
    if (!nome || t <= 0) return toast('A Thiny não conseguiu montar essa meta.', false);
    txt = 'Meta "' + nome + '" de ' + fmt(t) + ' milhas';
    run = async () => { ud.goals.push({ n: nome, p: p ? p.name : '', t }); const r = await saveUd(); if (r.error) throw r.error; };
  } else return;
  if (!confirm('Thiny propõe: ' + txt + '. Confirmar?')) return;
  try { await run(); await load(); toast('Feito: ' + txt); } catch (e) { toast(err(e), false); }
}
const EXTRA_ACT = {
  cadd: () => modal('Novo cartão', '<label>Nome</label><input name="n" required maxlength="30"><label>Pontos por real gasto</label><input name="k" type="number" min="0" step="0.1" required><label>Programa de destino (opcional)</label><input name="p" maxlength="40">', 'Salvar', async f => { const n = f.n.value.trim(); if (!n || ud.cards.some(c => c.n === n)) { toast('Informe um nome que ainda não exista.', false); return false; } ud.cards.push({ n, k: +f.k.value || 0, p: f.p.value.trim() }); const r = await saveUd(); if (r.error) { toast(err(r.error), false); return false; } render(); }),
  async cdel(i) { const c = ud.cards[+i]; if (!confirm('Excluir ' + c.n + ' e seus lançamentos?')) return; ud.cards.splice(+i, 1); ud.txs = ud.txs.filter(t => t.c !== c.n); const r = await saveUd(); if (r.error) return toast(err(r.error), false); render(); },
  cimp() {
    if (!ud.cards.length) return toast('Cadastre um cartão primeiro.', false);
    modal('Importar fatura', '<label>Cartão</label><select name="c">' + ud.cards.map(c => `<option>${esc(c.n)}</option>`).join('') + '</select><label>Cole as linhas: data;descrição;valor</label><textarea name="t" rows="8" placeholder="05/10/2026;Mercado;152,30"></textarea>', 'Importar', async f => {
      let n = 0; f.t.value.split('\n').forEach(l => { const p = l.split(l.includes(';') ? ';' : ','); if (p.length < 3) return; const v = num(p[p.length - 1]); if (isNaN(v)) return; ud.txs.push({ c: f.c.value, d: dt(p[0]), ds: p.slice(1, -1).join(' ').trim().slice(0, 60), v }); n++; });
      if (!n) { toast('Nenhuma linha válida encontrada.', false); return false; } const r = await saveUd(); if (r.error) { toast(err(r.error), false); return false; } toast(n + ' lançamentos importados.'); render();
    });
  },
  apedit(id) { const p = aprogs.find(x => x.id === id); modal('Editar programa de ' + (p.profiles?.username || ''), `<label>Programa</label><input name="name" required maxlength="40" value="${esc(p.name)}"><label>Saldo</label><input name="balance" type="number" min="0" required value="${p.balance}"><label>Vencimento</label><input name="exp" type="date" value="${p.expires_on || ''}">`, 'Salvar', async f => { const { error } = await sb.from('programs').update({ name: f.name.value.trim().slice(0, 40), balance: Math.max(0, parseInt(f.balance.value) || 0), expires_on: f.exp.value || null }).eq('id', id); if (error) { toast(err(error), false); return false; } await sb.rpc('admin_log', { p_action: 'edit_program', p_target: p.user_id, p_details: { programa: p.name } }); toast('Programa atualizado.'); render(); }); },
  async apdel(id) { const p = aprogs.find(x => x.id === id); if (!confirm('Excluir o programa ' + p.name + ' de ' + (p.profiles?.username || '') + '?')) return; const { error } = await sb.from('programs').delete().eq('id', id); if (error) return toast(err(error), false); await sb.rpc('admin_log', { p_action: 'delete_program', p_target: p.user_id, p_details: { programa: p.name } }); toast('Programa excluído.'); render(); },
  async osave() {
    let l; try { l = JSON.parse($('#oj').value); } catch (e) { return toast('JSON inválido.', false); }
    if (!Array.isArray(l) || l.some(o => !['a', 't', 'c'].includes(o.k) || !/^\d{4}-\d\d-\d\d$/.test(o.f) || !o.p || !o.t)) return toast('Cada item precisa de k (a, t ou c), p, t e f (AAAA-MM-DD).', false);
    rpc('admin_set_setting', { p_key: 'opps', p_value: { u: hoje(), itens: l } }, 'Lista publicada.');
  },
  ucreate: () => modal('Criar usuário', '<label>Usuário</label><input name="u" required maxlength="20" placeholder="letras minúsculas, números ou _"><label>Senha (mín. 8)</label><input name="p" type="password" minlength="8" required><label>Plano</label><select name="pl"><option value="free">Free</option><option value="premium">Premium</option></select>', 'Criar', async f => { try { await fn('admin-users', { action: 'create', username: f.u.value.trim().toLowerCase(), password: f.p.value, plan: f.pl.value }); toast('Usuário criado.'); render(); } catch (e) { toast(e.message, false); return false; } }),
  upass(id) { const u = uOf(id); modal('Nova senha para ' + u.username, '<label>Nova senha (mín. 8)</label><input name="p" type="password" minlength="8" required>', 'Redefinir', async f => { try { await fn('admin-users', { action: 'reset', id, password: f.p.value }); toast('Senha redefinida. Informe a nova senha ao usuário.'); } catch (e) { toast(e.message, false); return false; } }); },
  async tsend() {
    const i = $('#ti'), q = i && i.value.trim(); if (!q || tbusy) return; tbusy = true; i.value = ''; tmsgs.push({ r: 'u', t: q }, { r: 'a', t: '…' }); refreshChat();
    try {
      const d = await fn('thiny', { pergunta: q, conversa_id: tcur, historico: tmsgs.slice(0, -2).slice(-6).map(m => ({ r: m.r, t: m.t })) });
      tmsgs[tmsgs.length - 1].t = d.resposta || 'Não consegui responder agora.';
      const nova = d.conversa_id && d.conversa_id !== tcur; if (d.conversa_id) { tcur = d.conversa_id; await loadConvs(); }
      if (nova) render(); else refreshChat();
      speak(tmsgs[tmsgs.length - 1].t); if (d.acao) await propor(d.acao);
    } catch (e) { tmsgs[tmsgs.length - 1].t = e.message || 'Não consegui responder agora.'; refreshChat(); }
    tbusy = false;
  },
  async tnew() { tcur = null; tmsgs = []; render(); },
  async topen(id) { await openConv(id); render(); },
  async tdel() { if (!tcur || !confirm('Excluir esta conversa? Isso não pode ser desfeito.')) return; const { error } = await sb.from('thiny_conversations').delete().eq('id', tcur); if (error) return toast(err(error), false); tcur = null; tmsgs = []; await loadConvs(); toast('Conversa excluída.'); render(); },
  tvoz() { vozOn = !vozOn; if (!vozOn) { try { speechSynthesis.cancel(); } catch (e) {} } render(); },
  tmic() { try { const r = new SR(); r.lang = 'pt-BR'; r.onresult = ev => { $('#ti').value = ev.results[0][0].transcript; ACT.tsend(); }; r.onerror = () => toast('Não consegui usar o microfone. Verifique a permissão do navegador.', false); r.start(); } catch (e) {} }
};

/* ---------- Ações dos botões ---------- */
const ACT = {
  ...EXTRA_ACT,
  padd: () => pform(), pedit: id => pform(progs.find(p => p.id === id)), lanc: id => lanc(progs.find(p => p.id === id)),
  async pdel(id) { const p = progs.find(x => x.id === id); if (!confirm('Excluir ' + p.name + '?')) return; const { error } = await sb.from('programs').delete().eq('id', id); if (error) return toast(err(error), false); await load(); toast('Programa excluído.'); render(); },
  async upg() { const { error } = await sb.rpc('request_upgrade'); if (error) return toast(err(error), false); me.plan_requested = 'premium'; toast('Pedido enviado ao administrador.'); render(); },
  gadd: () => modal('Nova meta', '<label>Nome</label><input name="n" required maxlength="50"><label>Programa (opcional)</label><select name="p"><option value="">Todos</option>' + progs.map(p => `<option>${esc(p.name)}</option>`).join('') + '</select><label>Milhas necessárias</label><input name="t" type="number" min="1" required>', 'Salvar', async f => { ud.goals.push({ n: f.n.value.trim(), p: f.p.value, t: parseInt(f.t.value) || 1 }); const { error } = await saveUd(); if (error) { toast(err(error), false); return false; } toast('Meta salva.'); render(); }),
  async gdel(i) { ud.goals.splice(+i, 1); const { error } = await saveUd(); if (error) return toast(err(error), false); render(); },
  exj: () => dl('milhas.json', JSON.stringify({ programas: progs, metas: ud.goals, historico: ud.hist }, null, 1), 'application/json'),
  exc: () => dl('milhas.csv', '\ufeffPrograma,Saldo,Vencimento,Milheiro,Titular\n' + progs.map(p => [cell(p.name), p.balance, p.expires_on || '', p.milheiro || '', cell(p.holder)].join(',')).join('\n'), 'text/csv'),
  exi() {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Minhas Milhas//PT'], st = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    progs.filter(p => p.expires_on).forEach(p => L.push('BEGIN:VEVENT', 'UID:' + p.id + '@minhas-milhas', 'DTSTAMP:' + st, 'DTSTART;VALUE=DATE:' + p.expires_on.replace(/-/g, ''), 'SUMMARY:Vence: ' + p.name.replace(/[^\p{L}\p{N} ().-]/gu, ' '), 'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:Milhas vencendo em 7 dias', 'END:VALARM', 'END:VEVENT'));
    L.push('END:VCALENDAR'); dl('vencimentos.ics', L.join('\r\n'), 'text/calendar');
  },
  uplan: (id, b) => rpc('admin_set_plan', { p_user: id, p_plan: b.dataset.p }, 'Plano atualizado.'),
  ublk(id) { const u = uOf(id), b = !u.blocked; if (confirm((b ? 'Bloquear ' : 'Desbloquear ') + u.username + '?')) rpc('admin_set_blocked', { p_user: id, p_blocked: b }, b ? 'Conta bloqueada.' : 'Conta desbloqueada.'); },
  urole(id) { const u = uOf(id), r = u.role === 'admin' ? 'user' : 'admin'; if (confirm('Alterar o perfil de ' + u.username + ' para ' + (r === 'admin' ? 'ADMINISTRADOR' : 'usuário') + '?')) rpc('admin_set_role', { p_user: id, p_role: r }, 'Perfil atualizado.'); },
  udel(id) { const u = uOf(id); if (confirm('EXCLUIR ' + u.username + ' e todos os seus dados? Isso não pode ser desfeito.')) rpc('admin_delete_user', { p_user: id }, 'Usuário excluído.'); },
  psave(p) {
    const c = document.querySelector('[data-pl="' + p + '"]'), v = n => c.querySelector('[name=' + n + ']').value, num = n => v(n) === '' ? null : parseInt(v(n)), feats = {};
    c.querySelectorAll('.chk input').forEach(i => feats[i.name] = i.checked);
    rpc('admin_set_plan_limits', { p_plan: p, p_max_programs: num('mp'), p_thiny_daily: num('td'), p_features: feats }, 'Plano salvo.');
  },
  csave(k) {
    const c = document.querySelector('[data-cf="' + k + '"]'), g = n => c.querySelector('[name=' + n + ']'); let val = {};
    if (k === 'general') val = { nome: g('nome').value.trim() };
    if (k === 'signup') val = { premium_instant: g('premium_instant').checked };
    if (k === 'thiny') val = { enabled: g('enabled').checked, voz_somente_premium: g('voz_somente_premium').checked, salvar_historico: g('salvar_historico').checked, acoes_permitidas: g('acoes').value.split(',').map(s => s.trim()).filter(Boolean) };
    rpc('admin_set_setting', { p_key: k, p_value: val }, 'Configuração salva.');
  },
  cmd(c) { if (confirm('Executar o comando "' + c + '"?')) rpc('admin_command', { p_cmd: c }, 'Comando executado.'); }
};

/* ---------- Thiny flutuante: bolinha fixa + janela de conversa ---------- */
function initThinyFloating() {
  if (document.getElementById('thiny-widget')) return;
  const root = document.createElement('div'); root.id = 'thiny-widget'; root.innerHTML = `
    <section class="thiny-float-panel" id="thiny-float-panel" aria-label="Conversa com Thiny" hidden>
      <header class="thiny-float-head"><span class="thiny-float-avatar">✦</span><div><b>Thiny</b><small>Sua assistente de IA <i></i></small></div><button type="button" id="thiny-float-close" aria-label="Fechar conversa">×</button></header>
      <div class="thiny-float-messages" id="thiny-float-messages"><div class="thiny-bubble thiny-bot">Olá! 👋 Sou a Thiny. Como posso ajudar com suas milhas hoje?</div><div class="thiny-suggestions"><button type="button">Quero ver meus saldos</button><button type="button">Como usar minhas milhas?</button><button type="button">Tem alguma promoção hoje?</button></div></div>
      <form id="thiny-float-form" class="thiny-float-compose"><input id="thiny-float-input" maxlength="400" placeholder="Digite sua mensagem..." autocomplete="off"><button type="submit" aria-label="Enviar mensagem">➤</button></form>
      <footer class="thiny-float-foot">Suas conversas são individuais por conta</footer>
    </section>
    <button type="button" id="thiny-float-launch" class="thiny-float-launch" aria-label="Abrir conversa com Thiny"><span class="thiny-launch-spark">✦</span><span class="thiny-launch-label">Thiny</span><i></i></button>`;
  document.body.appendChild(root);
  const panel = root.querySelector('#thiny-float-panel'), launcher = root.querySelector('#thiny-float-launch'), messages = root.querySelector('#thiny-float-messages');
  // A bolinha fica visível em todas as telas; a conversa só aparece após clique.
  panel.hidden = true;
  let drag = null, moved = false;
  launcher.addEventListener('pointerdown', e => { if (e.button !== 0 && e.pointerType === 'mouse') return; const r = root.getBoundingClientRect(); drag = {x:e.clientX,y:e.clientY,left:r.left,top:r.top}; moved=false; launcher.setPointerCapture?.(e.pointerId); });
  launcher.addEventListener('pointermove', e => { if (!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if (Math.abs(dx)+Math.abs(dy)>5) moved=true; if (!moved) return; const w=root.offsetWidth,h=root.offsetHeight; const left=Math.max(8,Math.min(window.innerWidth-w-8,drag.left+dx)); const top=Math.max(8,Math.min(window.innerHeight-h-8,drag.top+dy)); root.style.left=left+'px'; root.style.top=top+'px'; root.style.right='auto'; root.style.bottom='auto'; root.style.position='fixed'; });
  launcher.addEventListener('pointerup', () => { if (moved) launcher.dataset.dragged='1'; drag=null; });
  launcher.addEventListener('pointercancel', () => { drag=null; });
  const drawMessages = () => { messages.querySelectorAll('.thiny-bubble').forEach(n=>n.remove()); const frag=document.createDocumentFragment(); (tmsgs||[]).forEach(m=>{const d=document.createElement('div');d.className='thiny-bubble '+(m.r==='u'?'thiny-user':'thiny-bot');d.textContent=m.t;frag.appendChild(d)}); messages.prepend(frag); messages.scrollTop=messages.scrollHeight; };
  launcher.onclick = async () => { if (launcher.dataset.dragged === '1') { launcher.dataset.dragged='0'; return; } panel.hidden=false; launcher.classList.add('thiny-launch-hidden'); if (!me) { messages.innerHTML='<div class="thiny-bubble thiny-bot">Olá! 👋 Para conversar comigo e manter seu histórico privado, entre na sua conta primeiro.</div>'; return; } try { if(!tloaded) await loadConvs(); if(!tcur && tconvs.length && !tmsgs.length) await openConv(tconvs[0].id); messages.innerHTML=''; drawMessages(); } catch(e) { messages.innerHTML='<div class="thiny-bubble thiny-bot">Olá! Pode me perguntar sobre suas milhas.</div>'; } root.querySelector('#thiny-float-input').focus(); };
  root.querySelector('#thiny-float-close').onclick = () => { panel.hidden=true; launcher.classList.remove('thiny-launch-hidden'); };
  root.querySelectorAll('.thiny-suggestions button').forEach(b=>b.onclick=()=>{root.querySelector('#thiny-float-input').value=b.textContent;root.querySelector('#thiny-float-form').requestSubmit();});
  root.querySelector('#thiny-float-form').onsubmit = async e => { e.preventDefault(); const input=root.querySelector('#thiny-float-input'), q=input.value.trim(); if(!q||tbusy)return; if(!me){messages.innerHTML='<div class="thiny-bubble thiny-bot">Entre na sua conta para conversar comigo.</div>';return;} input.value=''; tbusy=true; tmsgs.push({r:'u',t:q},{r:'a',t:'Estou pensando...'}); drawMessages();
    try { const d=await fn('thiny',{pergunta:q,conversa_id:tcur,historico:tmsgs.slice(0,-2).slice(-6).map(m=>({r:m.r,t:m.t}))}); tmsgs[tmsgs.length-1].t=d.resposta||'Não consegui responder agora.'; if(d.conversa_id){tcur=d.conversa_id;await loadConvs();} drawMessages(); if(d.acao) await propor(d.acao); }
    catch(err0){tmsgs[tmsgs.length-1].t=err0.message||'Não consegui responder agora.';drawMessages();} finally {tbusy=false;input.focus();}
  };
}

/* ---------- Início ---------- */
async function boot() {
  initThinyFloating();
  if (!C.URL || C.URL.includes('SEU-PROJETO') || !C.KEY || C.KEY.includes('SUA_CHAVE') || !C.DOMAIN || C.DOMAIN.includes('SEU_USUARIO')) { app.innerHTML = '<div class="auth"><div class="box"><div class="logo">Configuração pendente</div><p>Preencha <b>js/config.js</b> com a URL, a chave pública e o <b>DOMAIN</b> (sugestão para este endereço: <b>'+esc(location.hostname)+'</b>).</p></div></div>'; return; }
  sb = window.supabase.createClient(C.URL, C.KEY);
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') { resetState(); loginView(); } });
  const { data } = await sb.auth.getSession();
  if (data.session) enter(data.session.user); else loginView();
}
boot();
})();
