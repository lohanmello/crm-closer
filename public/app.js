'use strict';

/* CRM Closer - interface */

(() => {
  // ---------------------------------------------------------------- atalhos

  const $ = (sel) => document.querySelector(sel);

  const ETAPAS = [
    { id: 'novo', nome: 'Novo', cor: '#60a5fa', badge: 'cinza', curto: 'Novo' },
    { id: 'contato', nome: 'Contato', cor: '#22d3ee', badge: 'ciano', curto: 'Contato' },
    { id: 'agendado', nome: 'Agendado', cor: '#a78bfa', badge: 'violeta', curto: 'Agendado' },
    { id: 'call', nome: 'Call realizada', cor: '#fbbf24', badge: 'ambar', curto: 'Call' },
    { id: 'proposta', nome: 'Proposta', cor: '#f472b6', badge: 'rosa', curto: 'Proposta' },
    { id: 'fechado', nome: 'Fechado', cor: '#34d399', badge: 'verde', curto: 'Fechado' },
    { id: 'perdido', nome: 'Perdido', cor: '#f87171', badge: 'vermelho', curto: 'Perdido' },
  ];

  const NAV = [
    { id: 'dashboard', nome: 'Dashboard', icone: 'grid' },
    { id: 'leads', nome: 'Leads', icone: 'users' },
    { id: 'vendas', nome: 'Vendas', icone: 'bag' },
    { id: 'financeiro', nome: 'Financeiro', icone: 'wallet' },
    { id: 'metas', nome: 'Metas', icone: 'target' },
    { id: 'config', nome: 'Config', icone: 'settings' },
  ];

  const SUBTITULOS = {
    dashboard: 'Visão geral do mês',
    leads: 'Seu funil de vendas',
    vendas: 'Vendas fechadas no mês',
    financeiro: 'Fixo, comissões e recebimentos',
    metas: 'Objetivos do mês',
    config: 'Ajustes, backup e acesso',
  };

  const ORIGENS = ['Instagram', 'Indicação', 'Tráfego pago', 'WhatsApp', 'Evento', 'Prospecção ativa', 'Outro'];

  const state = {
    mes: mesAtual(),
    view: 'dashboard',
    data: null,
    health: null,
    tema: localStorage.getItem('crm.tema') || 'dark',
    leadsModo: localStorage.getItem('crm.leadsModo') || (window.innerWidth <= 900 ? 'lista' : 'kanban'),
    leadsFiltro: { q: '', etapa: 'todas' },
    vendasFiltro: { q: '', status: 'todos' },
  };

  // ---------------------------------------------------------------- utils

  function mesAtual() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function adicionarMes(mes, delta) {
    const [ano, m] = mes.split('-').map(Number);
    const d = new Date(ano, m - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function fmtBRL(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtPct(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';
  }

  function fmtData(iso) {
    if (!iso) return '—';
    const s = String(iso).slice(0, 10);
    return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
  }

  function fmtMes(mes) {
    const [ano, m] = mes.split('-').map(Number);
    const texto = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ano, m - 1, 1));
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function fmtMesCurto(mes) {
    const [ano, m] = mes.split('-').map(Number);
    const texto = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(ano, m - 1, 1)).replace('.', '');
    return mes === mesAtual() ? 'Atual' : texto.charAt(0).toUpperCase() + texto.slice(1) + '/' + String(ano).slice(2);
  }

  function fmtCompact(valor) {
    const n = Number(valor || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace('.', ',') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + 'k';
    return String(Math.round(n));
  }

  function esc(valor) {
    return String(valor === undefined || valor === null ? '' : valor).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function etapaInfo(id) {
    return ETAPAS.find((e) => e.id === id) || ETAPAS[0];
  }

  function diasAtraso(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    const alvo = new Date(a, m - 1, d);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.round((hoje.getTime() - alvo.getTime()) / 86400000);
  }

  function nomeAtivo(id) {
    return NAV.find((n) => n.id === id)?.nome || '';
  }

  // ---------------------------------------------------------------- icones

  const ICONES = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    wallet: '<path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"/><path d="M18 15h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    dollar: '<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  };

  function ico(nome, tamanho) {
    const t = tamanho || 18;
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONES[nome] || '') + '</svg>';
  }

  // ---------------------------------------------------------------- api

  async function api(caminho, opcoes) {
    const opts = opcoes || {};
    const config = { method: opts.method || 'GET', headers: {} };
    if (opts.body !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(opts.body);
    }
    const resposta = await fetch(caminho, config);
    if (resposta.status === 401) {
      mostrarLogin();
      throw new Error('Sessão bloqueada. Informe o PIN novamente.');
    }
    const tipo = resposta.headers.get('content-type') || '';
    const dados = tipo.includes('json') ? await resposta.json() : await resposta.text();
    if (!resposta.ok) {
      throw new Error((dados && dados.erro) || 'Não foi possível concluir a operação.');
    }
    return dados;
  }

  // ---------------------------------------------------------------- toast

  let toastTimer = null;
  function toast(mensagem, tipo) {
    const el = $('#toast');
    el.textContent = mensagem;
    el.className = 'toast show ' + (tipo === 'erro' ? 'erro' : 'ok');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = 'toast';
    }, 3400);
  }

  // ---------------------------------------------------------------- login

  function mostrarLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    const campo = $('#pin');
    if (campo) {
      campo.value = '';
      setTimeout(() => campo.focus(), 60);
    }
  }

  function esconderLogin() {
    $('#login').hidden = true;
    $('#app').hidden = false;
  }

  async function entrar(evento) {
    evento.preventDefault();
    const campo = $('#pin');
    const erro = $('#login-erro');
    erro.textContent = '';
    try {
      await api('/api/login', { method: 'POST', body: { pin: campo.value } });
      esconderLogin();
      await carregar();
    } catch (e) {
      erro.textContent = e.message;
      campo.value = '';
      campo.focus();
    }
  }

  // ---------------------------------------------------------------- dados

  async function carregar(preservarScroll) {
    const y = window.scrollY;
    const dados = await api('/api/bootstrap?mes=' + encodeURIComponent(state.mes));
    state.data = dados;
    if (state.health) state.health.needsPin = dados.config.pin_ativo;
    render();
    if (preservarScroll) window.scrollTo(0, y);
  }

  async function recarregarHealth() {
    try {
      const h = await fetch('/api/health').then((r) => r.json());
      state.health = h;
    } catch { /* ignora */ }
  }

  // ---------------------------------------------------------------- tema / nav

  function aplicarTema() {
    const claro = state.tema === 'light';
    document.body.classList.toggle('light', claro);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', claro ? '#f4f6fb' : '#0a0c11');
    const alvo = $('#ico-tema');
    if (alvo) alvo.innerHTML = ico(claro ? 'moon' : 'sun', 16);
  }

  function montarNavs() {
    const html = NAV.map((n) =>
      '<button class="nav-item" data-act="nav" data-view="' + n.id + '">' +
        ico(n.icone, 17) + '<span>' + n.nome + '</span>' +
      '</button>'
    ).join('');
    $('#nav-lateral').innerHTML = html;
    $('#nav-inferior').innerHTML = html;
  }

  function marcarNav() {
    document.querySelectorAll('.nav-item').forEach((b) => {
      b.classList.toggle('ativo', b.dataset.view === state.view);
    });
  }

  function navegar(view) {
    if (!NAV.some((n) => n.id === view)) return;
    state.view = view;
    if (location.hash !== '#' + view) location.hash = view;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function viewDoHash() {
    const alvo = location.hash.replace('#', '');
    return NAV.some((n) => n.id === alvo) ? alvo : null;
  }

  // ---------------------------------------------------------------- render

  function render() {
    if (!state.data) return;
    const cfg = state.data.config;
    $('#brand-nome').textContent = cfg.nome || 'CRM Closer';
    $('#page-title').textContent = nomeAtivo(state.view);
    $('#page-sub').textContent = SUBTITULOS[state.view] || '';
    $('#mes-input').value = state.mes;
    $('#btn-sair').hidden = !cfg.pin_ativo;
    document.title = nomeAtivo(state.view) + ' · ' + (cfg.nome || 'CRM Closer');
    marcarNav();

    const view = $('#view');
    if (state.view === 'dashboard') view.innerHTML = viewDashboard();
    else if (state.view === 'leads') view.innerHTML = viewLeads();
    else if (state.view === 'vendas') view.innerHTML = viewVendas();
    else if (state.view === 'financeiro') view.innerHTML = viewFinanceiro();
    else if (state.view === 'metas') view.innerHTML = viewMetas();
    else view.innerHTML = viewConfig();

    if (state.view === 'leads' && state.leadsModo === 'kanban') {
      ajustarScrollKanban();
    }
  }

  function ajustarScrollKanban() {
    const kanban = $('.kanban');
    if (!kanban) return;
    const ativo = kanban.querySelector('.kanban-col[data-etapa="' + state.leadsFiltro.etapa + '"]');
    if (ativo) ativo.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  // ---------------------------------------------------------------- dashboard

  function kpi(rotulo, valor, sub, icone, tom) {
    return '<div class="card kpi' + (tom === 'destaque' ? ' destaque' : '') + '">' +
      '<div class="kpi-label">' + ico(icone, 13) + rotulo + '</div>' +
      '<div class="kpi-value ' + (tom === 'verde' ? 'verde' : tom === 'vermelho' ? 'vermelho' : tom === 'ambar' ? 'ambar' : '') + '">' + valor + '</div>' +
      '<div class="kpi-sub">' + sub + '</div>' +
    '</div>';
  }

  function viewDashboard() {
    const d = state.data.dash;
    const meta = d.meta;
    const usaComissao = meta.meta_comissao > 0;
    const alvo = usaComissao ? meta.meta_comissao : meta.meta_vendas;
    const feito = usaComissao ? d.comissaoTotal : d.valorTotal;
    const pct = alvo > 0 ? Math.min(100, (feito / alvo) * 100) : 0;
    const falta = Math.max(0, alvo - feito);
    const semDados = d.qtdVendas === 0 && state.data.leads.length === 0 && d.leads.total === 0;
    const temHistorico = d.historico.some((h) => Number(h.valor) > 0 || Number(h.comissao) > 0);

    const kpis =
      kpi('Vendido no mês', fmtBRL(d.valorTotal), d.qtdVendas + (d.qtdVendas === 1 ? ' venda fechada' : ' vendas fechadas'), 'trend') +
      kpi('Comissão gerada', fmtBRL(d.comissaoTotal), 'sobre as vendas do mês', 'dollar') +
      kpi('Fixo do mês', fmtBRL(d.fixo), 'salário base', 'wallet') +
      kpi('Total do mês', fmtBRL(d.totalMes), 'fixo + comissão (recebida + a receber)', 'bag', 'destaque') +
      kpi('A receber', fmtBRL(d.pendentes), d.pendentes > 0 ? 'comissões pendentes' : 'tudo recebido', 'alert', d.pendentes > 0 ? 'ambar' : 'verde');

    let metaHtml;
    if (alvo > 0) {
      metaHtml =
        '<div class="meta-top"><strong>' + fmtBRL(feito) + '</strong><span>de ' + fmtBRL(alvo) + '</span></div>' +
        '<div class="progress"><i class="' + (pct >= 100 ? 'completo' : '') + '" style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="meta-info"><span>' + pct.toFixed(0) + '% da meta de ' + (usaComissao ? 'comissão' : 'vendas') + '</span><span>' +
          (falta > 0 ? 'faltam ' + fmtBRL(falta) : 'meta batida') + '</span></div>';
    } else {
      metaHtml =
        '<div class="vazio" style="padding:18px 6px 8px">' +
          '<div class="vazio-titulo">Nenhuma meta definida</div>' +
          '<p>Defina uma meta de vendas ou de comissão para acompanhar seu progresso.</p>' +
          '<button class="btn small" data-act="nav" data-view="metas">Definir meta</button>' +
        '</div>';
    }

    return (
      (semDados ? avisoInicial() : '') +
      '<div class="kpi-grid">' + kpis + '</div>' +

      '<div class="grid-2">' +
        '<section class="card">' +
          '<div class="section-title"><h2>Faturamento e comissão</h2><span class="sub">últimos 6 meses</span></div>' +
          '<div class="chart-wrap">' + (temHistorico ? svgHistorico(d.historico) : chartVazio()) + '</div>' +
          (temHistorico ? '<div class="chart-legenda"><span class="legenda-vendas"><i></i>Valor vendido</span><span class="legenda-comissao"><i></i>Comissão</span></div>' : '') +
        '</section>' +
        '<section class="card">' +
          '<div class="section-title"><h2>Meta de ' + fmtMes(state.mes) + '</h2></div>' +
          metaHtml +
          '<div class="linha-divisoria"></div>' +
          '<div class="meta-info" style="margin-top:0"><span>Conversão dos leads do mês</span><strong>' + fmtPct(d.leads.conversao * 100) + '</strong></div>' +
          '<div class="meta-info"><span>Leads criados no mês</span><strong>' + d.leads.total + '</strong></div>' +
          '<div class="meta-info"><span>Vendas fechadas</span><strong>' + d.qtdVendas + '</strong></div>' +
        '</section>' +
      '</div>' +

      '<div class="grid-2">' +
        '<section class="card">' +
          '<div class="section-title"><h2>Funil do mês</h2><span class="sub">' + d.leads.total + ' leads criados</span></div>' +
          funilHTML(d.leads.porEtapa) +
        '</section>' +
        '<section class="card">' +
          '<div class="section-title"><h2>Follow-ups atrasados</h2><span class="sub">' + d.followups.length + '</span></div>' +
          followupsHTML(d.followups) +
        '</section>' +
      '</div>' +

      '<div class="grid-2">' +
        '<section class="card">' +
          '<div class="section-title"><h2>Leads recentes</h2><button class="btn ghost small" data-act="nav" data-view="leads">Ver todos</button></div>' +
          leadsRecentesHTML() +
        '</section>' +
        '<section class="card">' +
          '<div class="section-title"><h2>Últimas vendas</h2><button class="btn ghost small" data-act="nav" data-view="vendas">Ver todas</button></div>' +
          ultimasVendasHTML(d.ultimasVendas) +
        '</section>' +
      '</div>'
    );
  }

  function avisoInicial() {
    return '<section class="card" style="margin-bottom:14px">' +
      '<div class="section-title"><h2>Bem-vindo ao seu CRM</h2><span class="badge violeta">primeiros passos</span></div>' +
      '<p style="color:var(--text-2);font-size:13px">Cadastre seus leads, registre vendas e acompanhe fixo + comissão mês a mês. ' +
      'Se quiser ver o sistema cheio antes de começar, carregue dados de exemplo.</p>' +
      '<div class="form-acoes" style="justify-content:flex-start;margin-top:12px">' +
        '<button class="btn primary" data-act="novo-lead">' + ico('plus', 15) + ' Cadastrar lead</button>' +
        '<button class="btn ghost" data-act="seed">Carregar dados de exemplo</button>' +
      '</div>' +
    '</section>';
  }

  function funilHTML(porEtapa) {
    const maximo = Math.max(1, ...ETAPAS.map((e) => porEtapa[e.id] || 0));
    return '<div class="funil">' + ETAPAS.map((e) => {
      const qtd = porEtapa[e.id] || 0;
      const largura = (qtd / maximo) * 100;
      return '<div class="funil-linha" style="--stage-cor:' + e.cor + '">' +
        '<span class="rotulo">' + e.curto + '</span>' +
        '<span class="funil-barra"><i style="width:' + largura.toFixed(1) + '%"></i></span>' +
        '<span class="qtd">' + qtd + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function followupsHTML(lista) {
    if (!lista.length) {
      return '<div class="vazio" style="padding:22px 10px"><div class="vazio-titulo">Tudo em dia</div><p>Nenhum follow-up atrasado por aqui.</p></div>';
    }
    return '<div class="lista-follow">' + lista.map((l) => {
      const atraso = diasAtraso(l.proximo_followup);
      return '<div class="follow-item" data-act="editar-lead" data-id="' + l.id + '">' +
        '<span class="follow-nome">' + esc(l.nome) + '</span>' +
        '<span class="chip-origem">' + esc(l.etapa) + '</span>' +
        '<span class="follow-data">' + (atraso > 0 ? atraso + 'd de atraso' : 'hoje') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function leadsRecentesHTML() {
    const lista = state.data.leads
      .slice()
      .sort((a, b) => String(b.atualizado_em || b.criado_em).localeCompare(String(a.atualizado_em || a.criado_em)))
      .slice(0, 6);

    if (!lista.length) {
      return '<div class="vazio" style="padding:22px 10px"><div class="vazio-titulo">Nenhum lead ainda</div><p>Cadastre seu primeiro lead para acompanhar o funil.</p></div>';
    }

    return '<div class="lista-follow">' + lista.map((l) => {
      const etapa = etapaInfo(l.etapa);
      return '<div class="follow-item" data-act="editar-lead" data-id="' + l.id + '">' +
        '<span class="follow-nome">' + esc(l.nome) + '</span>' +
        '<span class="badge ' + etapa.badge + '">' + etapa.nome + '</span>' +
        '<span class="follow-data" title="Ticket estimado">' + (Number(l.ticket) > 0 ? 'Ticket ' + fmtBRL(l.ticket) : '—') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function ultimasVendasHTML(lista) {
    if (!lista.length) {
      return '<div class="vazio" style="padding:26px 10px"><div class="vazio-titulo">Nenhuma venda registrada</div><p>Registre sua primeira venda para ver os números aqui.</p><button class="btn primary small" data-act="nova-venda">' + ico('plus', 14) + ' Registrar venda</button></div>';
    }
    return '<div class="table-wrap" style="border:0"><table style="min-width:560px"><thead><tr>' +
      '<th>Data</th><th>Cliente</th><th class="num">Valor</th><th class="num">Comissão</th><th>Status</th>' +
      '</tr></thead><tbody>' + lista.map((v) => '<tr>' +
        '<td>' + fmtData(v.data_fechamento) + '</td>' +
        '<td><strong>' + esc(v.cliente) + '</strong>' + (v.produto ? '<span class="sub">' + esc(v.produto) + '</span>' : '') + '</td>' +
        '<td class="num">' + fmtBRL(v.valor) + '</td>' +
        '<td class="num"><strong>' + fmtBRL(v.comissao) + '</strong></td>' +
        '<td>' + badgeStatus(v.status) + '</td>' +
      '</tr>').join('') + '</tbody></table></div>';
  }

  function badgeStatus(status) {
    return status === 'recebida'
      ? '<span class="badge verde">Recebida</span>'
      : '<span class="badge ambar">Pendente</span>';
  }

  function chartVazio() {
    return '<div class="vazio" style="padding:46px 16px">' +
      '<div class="vazio-titulo">Sem faturamento nos últimos 6 meses</div>' +
      '<p>As barras aparecem aqui quando você registrar as primeiras vendas.</p>' +
    '</div>';
  }

  function svgHistorico(hist) {
    const W = 660;
    const H = 232;
    const pl = 50;
    const pr = 12;
    const pt = 14;
    const pb = 30;
    const iw = W - pl - pr;
    const ih = H - pt - pb;
    const maior = Math.max(1, ...hist.map((h) => Math.max(Number(h.valor), Number(h.comissao))));
    const max = escalaBonita(maior);
    const passo = iw / hist.length;
    const larguraBarra = Math.min(24, passo * 0.24);

    let grades = '';
    for (let i = 0; i <= 4; i += 1) {
      const y = pt + (ih / 4) * i;
      const valor = max - (max / 4) * i;
      grades += '<line class="chart-grid" x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + y.toFixed(1) + '"/>';
      grades += '<text class="chart-label" x="' + (pl - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + fmtCompact(valor) + '</text>';
    }

    let barras = '';
    hist.forEach((h, i) => {
      const centro = pl + passo * i + passo / 2;
      const alturaV = (Number(h.valor) / max) * ih;
      const alturaC = (Number(h.comissao) / max) * ih;
      const yV = pt + ih - alturaV;
      const yC = pt + ih - alturaC;
      barras += '<rect class="chart-bar" x="' + (centro - larguraBarra - 2).toFixed(1) + '" y="' + yV.toFixed(1) + '" width="' + larguraBarra.toFixed(1) + '" height="' + Math.max(0, alturaV).toFixed(1) + '" rx="4" fill="#8b5cf6"><title>' + fmtMes(h.mes) + ' — vendido ' + fmtBRL(h.valor) + '</title></rect>';
      barras += '<rect class="chart-bar" x="' + (centro + 2).toFixed(1) + '" y="' + yC.toFixed(1) + '" width="' + larguraBarra.toFixed(1) + '" height="' + Math.max(0, alturaC).toFixed(1) + '" rx="4" fill="#34d399"><title>' + fmtMes(h.mes) + ' — comissão ' + fmtBRL(h.comissao) + '</title></rect>';
      barras += '<text class="chart-label" x="' + centro.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + fmtMesCurto(h.mes) + '</text>';
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Faturamento e comissão dos últimos 6 meses">' +
      grades + barras + '</svg>';
  }

  function escalaBonita(valor) {
    const exp = Math.pow(10, Math.floor(Math.log10(valor)));
    const n = valor / exp;
    const passos = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
    const passo = passos.find((p) => p >= n) || 10;
    return passo * exp;
  }

  // ---------------------------------------------------------------- leads

  function leadsFiltrados() {
    const f = state.leadsFiltro;
    const q = f.q.trim().toLowerCase();
    return state.data.leads.filter((l) => {
      if (f.etapa !== 'todas' && l.etapa !== f.etapa) return false;
      if (!q) return true;
      return [l.nome, l.telefone, l.produto, l.origem]
        .some((campo) => String(campo || '').toLowerCase().includes(q));
    });
  }

  function viewLeads() {
    const leads = leadsFiltrados();
    const kanban = state.leadsModo === 'kanban';
    const toolbar =
      '<div class="toolbar">' +
        '<div class="search">' + ico('search', 16) + '<input id="busca-leads" placeholder="Buscar lead, telefone, produto..." value="' + esc(state.leadsFiltro.q) + '"></div>' +
        '<select class="select" id="filtro-etapa" aria-label="Filtrar etapa">' +
          '<option value="todas">Todas as etapas</option>' +
          ETAPAS.map((e) => '<option value="' + e.id + '"' + (state.leadsFiltro.etapa === e.id ? ' selected' : '') + '>' + e.nome + '</option>').join('') +
        '</select>' +
        '<span class="espaco"></span>' +
        '<div class="segmentado">' +
          '<button data-act="modo-leads" data-modo="kanban" class="' + (kanban ? 'ativo' : '') + '">Kanban</button>' +
          '<button data-act="modo-leads" data-modo="lista" class="' + (!kanban ? 'ativo' : '') + '">Lista</button>' +
        '</div>' +
      '</div>';

    if (!state.data.leads.length) {
      return toolbar + '<div class="card"><div class="vazio">' +
        '<span class="ico">' + ico('users', 34) + '</span>' +
        '<div class="vazio-titulo">Nenhum lead cadastrado</div>' +
        '<p>Cadastre quem você está atendendo para acompanhar cada etapa do funil.</p>' +
        '<button class="btn primary" data-act="novo-lead">' + ico('plus', 15) + ' Cadastrar lead</button>' +
      '</div></div>';
    }

    if (!leads.length) {
      return toolbar + '<div class="card"><div class="vazio">' +
        '<div class="vazio-titulo">Nenhum lead encontrado</div><p>Ajuste a busca ou o filtro de etapa.</p>' +
      '</div></div>';
    }

    if (kanban) return toolbar + kanbanHTML(leads);
    return toolbar + listaLeadsHTML(leads);
  }

  function kanbanHTML(leads) {
    const etapas = state.leadsFiltro.etapa === 'todas'
      ? ETAPAS
      : ETAPAS.filter((e) => e.id === state.leadsFiltro.etapa);
    return '<div class="kanban">' + etapas.map((e) => {
      const itens = leads.filter((l) => l.etapa === e.id);
      return '<div class="kanban-col" data-etapa="' + e.id + '" style="--stage-cor:' + e.cor + '">' +
        '<div class="kanban-head">' +
          '<span class="kanban-nome"><i class="ponto"></i>' + e.nome + '</span>' +
          '<span class="contador">' + itens.length + '</span>' +
        '</div>' +
        '<div class="kanban-lista">' +
          (itens.length ? itens.map(cardLead).join('') : '<div class="kanban-vazio">Sem leads</div>') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function cardLead(l) {
    const e = etapaInfo(l.etapa);
    let dataHtml = '';
    if (l.proximo_followup) {
      const atraso = diasAtraso(l.proximo_followup);
      const classe = atraso > 0 ? 'atrasado' : atraso === 0 ? 'hoje' : '';
      const rotulo = atraso > 0 ? atraso + 'd de atraso' : atraso === 0 ? 'hoje' : fmtData(l.proximo_followup);
      dataHtml = '<span class="lead-data ' + classe + '">' + ico('calendar', 11) + ' ' + rotulo + '</span>';
    }
    return '<div class="lead-card" draggable="true" data-act="editar-lead" data-id="' + l.id + '" style="--stage-cor:' + e.cor + '">' +
      '<span class="lead-nome">' + esc(l.nome) + '</span>' +
      '<div class="lead-info">' + esc(l.produto || 'Sem produto') + (l.origem ? ' · ' + esc(l.origem) : '') + '</div>' +
      '<div class="lead-rodape">' +
        '<span class="lead-ticket">' + (Number(l.ticket) > 0 ? fmtBRL(l.ticket) : '—') + '</span>' +
        dataHtml +
      '</div>' +
    '</div>';
  }

  function listaLeadsHTML(leads) {
    return '<div class="lista-leads">' + leads.map((l) => {
      const e = etapaInfo(l.etapa);
      return '<div class="linha-lead" data-act="editar-lead" data-id="' + l.id + '">' +
        '<div>' +
          '<div class="nome">' + esc(l.nome) + '</div>' +
          '<div class="detalhe">' + esc(l.telefone || 'sem telefone') + (l.origem ? ' · ' + esc(l.origem) : '') + '</div>' +
        '</div>' +
        '<div class="detalhe">' + esc(l.produto || '—') + '</div>' +
        '<span class="badge ' + e.badge + '">' + e.nome + '</span>' +
        '<div class="ticket">' + (Number(l.ticket) > 0 ? fmtBRL(l.ticket) : '—') + '</div>' +
        '<button class="icon-btn" data-act="editar-lead" data-id="' + l.id + '" aria-label="Editar lead">' + ico('edit', 14) + '</button>' +
      '</div>';
    }).join('') + '</div>';
  }

  // ---------------------------------------------------------------- vendas

  function vendasFiltradas() {
    const f = state.vendasFiltro;
    const q = f.q.trim().toLowerCase();
    return state.data.vendas.filter((v) => {
      if (!String(v.data_fechamento).startsWith(state.mes)) return false;
      if (f.status !== 'todos' && v.status !== f.status) return false;
      if (!q) return true;
      return [v.cliente, v.produto, v.origem]
        .some((campo) => String(campo || '').toLowerCase().includes(q));
    });
  }

  function viewVendas() {
    const vendas = vendasFiltradas();
    const todasMes = state.data.vendas.filter((v) => String(v.data_fechamento).startsWith(state.mes));
    const totalValor = todasMes.reduce((s, v) => s + Number(v.valor), 0);
    const totalComissao = todasMes.reduce((s, v) => s + Number(v.comissao), 0);

    const toolbar =
      '<div class="toolbar">' +
        '<div class="search">' + ico('search', 16) + '<input id="busca-vendas" placeholder="Buscar cliente, produto..." value="' + esc(state.vendasFiltro.q) + '"></div>' +
        '<select class="select" id="filtro-status" aria-label="Filtrar status">' +
          '<option value="todos">Todos os status</option>' +
          '<option value="recebida"' + (state.vendasFiltro.status === 'recebida' ? ' selected' : '') + '>Recebidas</option>' +
          '<option value="pendente"' + (state.vendasFiltro.status === 'pendente' ? ' selected' : '') + '>Pendentes</option>' +
        '</select>' +
        '<span class="espaco"></span>' +
        '<button class="btn primary somente-desktop" data-act="nova-venda">' + ico('plus', 15) + ' Nova venda</button>' +
      '</div>';

    if (!vendas.length) {
      return toolbar + '<div class="card"><div class="vazio">' +
        '<span class="ico">' + ico('bag', 34) + '</span>' +
        '<div class="vazio-titulo">' + (todasMes.length ? 'Nenhuma venda encontrada' : 'Nenhuma venda em ' + fmtMes(state.mes)) + '</div>' +
        '<p>' + (todasMes.length ? 'Ajuste a busca ou o filtro de status.' : 'Registre uma venda para calcular automaticamente a comissão de 5%.') + '</p>' +
        (todasMes.length ? '' : '<button class="btn primary" data-act="nova-venda">' + ico('plus', 15) + ' Registrar venda</button>') +
      '</div></div>';
    }

    const linhas = vendas.map((v) => '<tr>' +
      '<td>' + fmtData(v.data_fechamento) + '</td>' +
      '<td><strong>' + esc(v.cliente) + '</strong>' + (v.produto ? '<span class="sub">' + esc(v.produto) + '</span>' : '') + '</td>' +
      '<td>' + esc(v.origem || '—') + '</td>' +
      '<td class="num">' + fmtBRL(v.valor) + '</td>' +
      '<td class="num">' + fmtPct(v.percentual) + '</td>' +
      '<td class="num"><strong>' + fmtBRL(v.comissao) + '</strong></td>' +
      '<td><button class="badge ' + (v.status === 'recebida' ? 'verde' : 'ambar') + '" data-act="alternar-status" data-id="' + v.id + '" title="Clique para alternar entre recebida e pendente">' +
        (v.status === 'recebida' ? 'Recebida' : 'Pendente') + '</button></td>' +
      '<td class="acoes">' +
        '<button class="icon-btn" data-act="editar-venda" data-id="' + v.id + '" aria-label="Editar venda">' + ico('edit', 14) + '</button>' +
        '<button class="icon-btn perigo" data-act="excluir-venda" data-id="' + v.id + '" aria-label="Excluir venda">' + ico('trash', 14) + '</button>' +
      '</td>' +
    '</tr>').join('');

    const cards = '<div class="lista-vendas somente-mobile">' + vendas.map(cardVenda).join('') +
      '<div class="total-mobile">' +
        '<span>Vendido: <strong>' + fmtBRL(vendas.reduce((s, v) => s + Number(v.valor), 0)) + '</strong></span>' +
        '<span>Comissão: <strong>' + fmtBRL(vendas.reduce((s, v) => s + Number(v.comissao), 0)) + '</strong></span>' +
      '</div>' +
    '</div>';

    return toolbar + cards +
      '<div class="somente-desktop"><div class="table-wrap">' +
        '<table><thead><tr><th>Data</th><th>Cliente</th><th>Origem</th><th class="num">Valor</th><th class="num">%</th><th class="num">Comissão</th><th>Status</th><th class="acoes"></th></tr></thead>' +
        '<tbody>' + linhas + '</tbody></table>' +
        '<div class="rodape-tabela">' +
          '<span>' + vendas.length + ' venda(s) listada(s)</span>' +
          '<span>Total vendido: <strong>' + fmtBRL(vendas.reduce((s, v) => s + Number(v.valor), 0)) + '</strong></span>' +
          '<span>Comissão: <strong>' + fmtBRL(vendas.reduce((s, v) => s + Number(v.comissao), 0)) + '</strong></span>' +
          '<span>Mês: <strong>' + fmtBRL(totalValor) + '</strong> / ' + fmtBRL(totalComissao) + '</span>' +
        '</div>' +
      '</div></div>';
  }

  function cardVenda(v) {
    const recebida = v.status === 'recebida';
    return '<div class="venda-card">' +
      '<div class="venda-card-top">' +
        '<div class="venda-card-cliente"><strong>' + esc(v.cliente) + '</strong>' +
          '<span>' + esc(v.produto || 'Sem produto') + ' · ' + fmtData(v.data_fechamento) + (v.origem ? ' · ' + esc(v.origem) : '') + '</span>' +
        '</div>' +
        '<button class="badge ' + (recebida ? 'verde' : 'ambar') + '" data-act="alternar-status" data-id="' + v.id + '">' +
          (recebida ? 'Recebida' : 'Pendente') + '</button>' +
      '</div>' +
      '<div class="venda-card-valores">' +
        '<div><span>Venda</span><strong>' + fmtBRL(v.valor) + '</strong></div>' +
        '<div><span>Comissão ' + fmtPct(v.percentual) + '</span><strong class="verde">' + fmtBRL(v.comissao) + '</strong></div>' +
        '<div class="venda-card-acoes">' +
          '<button class="icon-btn" data-act="editar-venda" data-id="' + v.id + '" aria-label="Editar venda">' + ico('edit', 14) + '</button>' +
          '<button class="icon-btn perigo" data-act="excluir-venda" data-id="' + v.id + '" aria-label="Excluir venda">' + ico('trash', 14) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ---------------------------------------------------------------- financeiro

  function resumoMes(mes) {
    const cfg = state.data.config;
    const vendas = state.data.vendas.filter((v) => String(v.data_fechamento).startsWith(mes));
    const fixoRow = state.data.fixos.find((f) => f.mes === mes);
    const fixo = fixoRow ? Number(fixoRow.valor) : Number(cfg.fixo_padrao) || 0;
    const valor = vendas.reduce((s, v) => s + Number(v.valor), 0);
    const comissao = vendas.reduce((s, v) => s + Number(v.comissao), 0);
    const recebido = vendas.filter((v) => v.status === 'recebida').reduce((s, v) => s + Number(v.comissao), 0);
    return {
      mes,
      fixo,
      valor,
      comissao,
      recebido,
      pendente: comissao - recebido,
      total: fixo + comissao,
      qtd: vendas.length,
    };
  }

  function mesesDisponiveis() {
    const conjunto = new Set([state.mes]);
    for (const v of state.data.vendas) conjunto.add(String(v.data_fechamento).slice(0, 7));
    for (const f of state.data.fixos) conjunto.add(f.mes);
    for (const m of state.data.metas) conjunto.add(m.mes);
    return Array.from(conjunto).sort().reverse();
  }

  function viewFinanceiro() {
    const res = resumoMes(state.mes);
    const fixoAtual = state.data.fixos.find((f) => f.mes === state.mes);

    const cards =
      kpi('Fixo do mês', fmtBRL(res.fixo), 'salário base', 'wallet') +
      kpi('Comissões recebidas', fmtBRL(res.recebido), res.qtd + ' venda(s) no mês', 'check', 'verde') +
      kpi('Comissões pendentes', fmtBRL(res.pendente), res.pendente > 0 ? 'aguardando recebimento' : 'nada pendente', 'alert', res.pendente > 0 ? 'ambar' : 'verde') +
      kpi('Total do mês', fmtBRL(res.total), 'fixo + comissões', 'bag', 'destaque');

    const meses = mesesDisponiveis();
    const linhas = meses.map((mes) => {
      const r = resumoMes(mes);
      const atual = mes === state.mes;
      return '<tr' + (atual ? ' style="background:var(--accent-soft)"' : '') + '>' +
        '<td><strong>' + fmtMes(mes) + '</strong>' + (atual ? ' <span class="badge violeta">atual</span>' : '') + '</td>' +
        '<td class="num">' + fmtBRL(r.fixo) + '</td>' +
        '<td class="num">' + fmtBRL(r.valor) + '</td>' +
        '<td class="num">' + fmtBRL(r.comissao) + '</td>' +
        '<td class="num" style="color:var(--green)">' + fmtBRL(r.recebido) + '</td>' +
        '<td class="num"' + (r.pendente > 0 ? ' style="color:var(--amber)"' : '') + '>' + fmtBRL(r.pendente) + '</td>' +
        '<td class="num"><strong>' + fmtBRL(r.total) + '</strong></td>' +
        '<td class="acoes">' + (atual ? '' : '<button class="btn ghost small" data-act="abrir-mes" data-mes="' + mes + '">Abrir</button>') + '</td>' +
      '</tr>';
    }).join('');

    const cardsMeses = '<div class="lista-meses somente-mobile">' +
      meses.map((mes) => cardMes(resumoMes(mes), mes === state.mes)).join('') +
    '</div>';

    return '<div class="kpi-grid">' + cards + '</div>' +

      '<section class="card" style="margin-bottom:14px">' +
        '<div class="section-title"><h2>Fixo de ' + fmtMes(state.mes) + '</h2><span class="sub">edite o salário base deste mês</span></div>' +
        '<form data-form="fixo" data-mes="' + state.mes + '" class="toolbar" style="margin-bottom:0">' +
          '<div class="campo" style="width:220px"><label>Valor do fixo (R$)</label>' +
            '<input type="number" name="valor" step="0.01" min="0" value="' + (fixoAtual ? Number(fixoAtual.valor) : res.fixo) + '">' +
          '</div>' +
          '<button class="btn primary" type="submit">Salvar fixo</button>' +
          '<span class="sub" style="color:var(--muted);font-size:12px">Padrão atual: ' + fmtBRL(state.data.config.fixo_padrao) + '</span>' +
        '</form>' +
      '</section>' +

      '<section class="card" style="padding:0;overflow:hidden">' +
        '<div class="section-title" style="padding:16px 18px 0"><h2>Histórico mensal</h2><span class="sub">fixo + comissões</span></div>' +
        cardsMeses +
        '<div class="table-wrap somente-desktop" style="border:0;border-radius:0">' +
          '<table><thead><tr><th>Mês</th><th class="num">Fixo</th><th class="num">Vendido</th><th class="num">Comissão</th><th class="num">Recebido</th><th class="num">Pendente</th><th class="num">Total</th><th></th></tr></thead>' +
          '<tbody>' + linhas + '</tbody></table>' +
        '</div>' +
      '</section>';
  }

  function cardMes(r, atual) {
    return '<div class="mes-card' + (atual ? ' atual' : '') + '">' +
      '<div class="mes-card-top">' +
        '<strong>' + fmtMes(r.mes) + '</strong>' +
        (atual ? '<span class="badge violeta">atual</span>' : '<button class="btn ghost small" data-act="abrir-mes" data-mes="' + r.mes + '">Abrir</button>') +
      '</div>' +
      '<div class="mes-card-grid">' +
        '<div><span>Fixo</span><b>' + fmtBRL(r.fixo) + '</b></div>' +
        '<div><span>Vendido</span><b>' + fmtBRL(r.valor) + '</b></div>' +
        '<div><span>Recebido</span><b style="color:var(--green)">' + fmtBRL(r.recebido) + '</b></div>' +
        '<div><span>Pendente</span><b style="color:' + (r.pendente > 0 ? 'var(--amber)' : 'var(--text-2)') + '">' + fmtBRL(r.pendente) + '</b></div>' +
      '</div>' +
      '<div class="mes-card-total"><span>Total do mês</span><strong>' + fmtBRL(r.total) + '</strong></div>' +
    '</div>';
  }

  // ---------------------------------------------------------------- metas

  function viewMetas() {
    const res = resumoMes(state.mes);
    const meta = state.data.metas.find((m) => m.mes === state.mes) || { meta_vendas: 0, meta_comissao: 0 };
    const pctVendas = meta.meta_vendas > 0 ? Math.min(100, (res.valor / meta.meta_vendas) * 100) : 0;
    const pctComissao = meta.meta_comissao > 0 ? Math.min(100, (res.comissao / meta.meta_comissao) * 100) : 0;

    const historicMeses = [];
    for (let i = 0; i < 6; i += 1) historicMeses.push(adicionarMes(state.mes, -i));
    const historico = historicMeses.map((mes) => {
      const r = resumoMes(mes);
      const m = state.data.metas.find((x) => x.mes === mes) || { meta_vendas: 0, meta_comissao: 0 };
      return '<tr>' +
        '<td><strong>' + fmtMes(mes) + '</strong></td>' +
        '<td class="num">' + fmtBRL(m.meta_vendas) + '</td>' +
        '<td class="num">' + fmtBRL(r.valor) + '</td>' +
        '<td class="num">' + fmtBRL(m.meta_comissao) + '</td>' +
        '<td class="num">' + fmtBRL(r.comissao) + '</td>' +
        '<td class="num"><strong>' + fmtBRL(r.total) + '</strong></td>' +
      '</tr>';
    }).join('');

    const historicoCards = '<div class="lista-meses somente-mobile">' + historicMeses.map((mes) => {
      const r = resumoMes(mes);
      const m = state.data.metas.find((x) => x.mes === mes) || { meta_vendas: 0, meta_comissao: 0 };
      return '<div class="mes-card">' +
        '<div class="mes-card-top"><strong>' + fmtMes(mes) + '</strong></div>' +
        '<div class="mes-card-grid">' +
          '<div><span>Meta vendas</span><b>' + fmtBRL(m.meta_vendas) + '</b></div>' +
          '<div><span>Vendido</span><b>' + fmtBRL(r.valor) + '</b></div>' +
          '<div><span>Meta comissão</span><b>' + fmtBRL(m.meta_comissao) + '</b></div>' +
          '<div><span>Comissão</span><b style="color:var(--green)">' + fmtBRL(r.comissao) + '</b></div>' +
        '</div>' +
        '<div class="mes-card-total"><span>Total do mês</span><strong>' + fmtBRL(r.total) + '</strong></div>' +
      '</div>';
    }).join('') + '</div>';

    return '<div class="grid-2 igual">' +
        '<section class="card">' +
          '<div class="section-title"><h2>Meta de vendas</h2><span class="sub">' + fmtMes(state.mes) + '</span></div>' +
          '<div class="meta-top"><strong>' + fmtBRL(res.valor) + '</strong><span>de ' + fmtBRL(meta.meta_vendas) + '</span></div>' +
          '<div class="progress"><i class="' + (pctVendas >= 100 ? 'completo' : '') + '" style="width:' + pctVendas.toFixed(1) + '%"></i></div>' +
          '<div class="meta-info"><span>' + pctVendas.toFixed(0) + '% atingido</span><span>' + (meta.meta_vendas > res.valor ? 'faltam ' + fmtBRL(meta.meta_vendas - res.valor) : 'meta batida') + '</span></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="section-title"><h2>Meta de comissão</h2><span class="sub">' + fmtMes(state.mes) + '</span></div>' +
          '<div class="meta-top"><strong>' + fmtBRL(res.comissao) + '</strong><span>de ' + fmtBRL(meta.meta_comissao) + '</span></div>' +
          '<div class="progress"><i class="' + (pctComissao >= 100 ? 'completo' : '') + '" style="width:' + pctComissao.toFixed(1) + '%"></i></div>' +
          '<div class="meta-info"><span>' + pctComissao.toFixed(0) + '% atingido</span><span>' + (meta.meta_comissao > res.comissao ? 'faltam ' + fmtBRL(meta.meta_comissao - res.comissao) : 'meta batida') + '</span></div>' +
        '</section>' +
      '</div>' +

      '<section class="card" style="margin-bottom:14px">' +
        '<div class="section-title"><h2>Definir metas de ' + fmtMes(state.mes) + '</h2></div>' +
        '<form data-form="metas" data-mes="' + state.mes + '" class="form-grid">' +
          '<div class="campo"><label>Meta de vendas (R$)</label><input type="number" name="meta_vendas" step="0.01" min="0" value="' + Number(meta.meta_vendas) + '"></div>' +
          '<div class="campo"><label>Meta de comissão (R$)</label><input type="number" name="meta_comissao" step="0.01" min="0" value="' + Number(meta.meta_comissao) + '"></div>' +
          '<div class="form-acoes full"><button class="btn primary" type="submit">Salvar metas</button></div>' +
        '</form>' +
      '</section>' +

      '<section class="card" style="padding:0;overflow:hidden">' +
        '<div class="section-title" style="padding:16px 18px 0"><h2>Últimos 6 meses</h2><span class="sub">meta x realizado</span></div>' +
        historicoCards +
        '<div class="table-wrap somente-desktop" style="border:0;border-radius:0">' +
          '<table><thead><tr><th>Mês</th><th class="num">Meta vendas</th><th class="num">Vendido</th><th class="num">Meta comissão</th><th class="num">Comissão</th><th class="num">Total mês</th></tr></thead>' +
          '<tbody>' + historico + '</tbody></table>' +
        '</div>' +
      '</section>';
  }

  // ---------------------------------------------------------------- config

  function viewConfig() {
    const cfg = state.data.config;
    const semDados = state.data.leads.length === 0 && state.data.vendas.length === 0;
    const links = state.data.lan && state.data.lan.length
      ? state.data.lan.map((url) => '<div class="link-caixa"><span>' + esc(url) + '</span><button class="icon-btn sem-borda" data-act="copiar" data-texto="' + esc(url) + '" aria-label="Copiar link">' + ico('copy', 14) + '</button></div>').join('')
      : '<p class="dica" style="font-size:12px;color:var(--muted)">Nenhuma rede local detectada. Conecte o PC ao Wi-Fi ou cabo.</p>';

    return '<div class="duas-colunas-config">' +
        '<div class="coluna">' +
          '<section class="card bloco-config">' +
            '<h3>Preferências</h3>' +
            '<p>Valores usados como padrão em novos cadastros.</p>' +
            '<form data-form="config" class="form-grid">' +
              '<div class="campo full"><label>Nome do CRM</label><input name="nome" value="' + esc(cfg.nome) + '" maxlength="80"></div>' +
              '<div class="campo"><label>Percentual de comissão padrão (%)</label><input type="number" name="percentual_padrao" step="0.01" min="0" max="100" value="' + Number(cfg.percentual_padrao) + '"></div>' +
              '<div class="campo"><label>Fixo mensal padrão (R$)</label><input type="number" name="fixo_padrao" step="0.01" min="0" value="' + Number(cfg.fixo_padrao) + '"></div>' +
              '<div class="form-acoes full"><button class="btn primary" type="submit">Salvar preferências</button></div>' +
            '</form>' +
          '</section>' +

          '<section class="card bloco-config">' +
            '<h3>Segurança</h3>' +
            '<p>Proteja o acesso pelo celular com um PIN de 4 dígitos.</p>' +
            '<div class="toolbar" style="margin-bottom:12px"><span class="badge ' + (cfg.pin_ativo ? 'verde' : 'cinza') + '">' + (cfg.pin_ativo ? 'PIN ativo' : 'PIN desativado') + '</span></div>' +
            '<form data-form="pin" class="toolbar" style="margin-bottom:0">' +
              '<input class="select" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="' + (cfg.pin_ativo ? 'Novo PIN (4 dígitos)' : 'Definir PIN (4 dígitos)') + '" style="width:190px">' +
              '<button class="btn primary" type="submit">' + ico('lock', 14) + ' Salvar PIN</button>' +
              (cfg.pin_ativo ? '<button class="btn ghost" type="button" data-act="desativar-pin">Desativar</button>' : '') +
            '</form>' +
          '</section>' +

          '<section class="card bloco-config">' +
            '<h3>Acesso pelo celular</h3>' +
            '<p>Abra um destes endereços no navegador do celular, na mesma rede Wi-Fi do PC.</p>' +
            '<div class="lista-links">' + links + '</div>' +
            '<div class="aviso" style="margin-top:12px">' + ico('alert', 16) + '<span>O PC precisa estar ligado. Se o celular não abrir, verifique se o Windows liberou a porta 3000 no firewall.</span></div>' +
          '</section>' +
        '</div>' +

        '<div class="coluna">' +
          '<section class="card bloco-config">' +
            '<h3>Dados e backup</h3>' +
            '<p>Seus dados ficam somente neste PC, em <code>db/crm.db</code>. Faça backups com frequência.</p>' +
            '<div class="toolbar" style="margin-bottom:0">' +
              '<a class="btn" href="/api/backup.json" download>' + ico('download', 14) + ' Backup completo</a>' +
              '<button class="btn" data-act="backup-agora">' + ico('database', 14) + ' Backup agora</button>' +
            '</div>' +
            '<div class="toolbar" style="margin-top:10px;margin-bottom:0">' +
              '<a class="btn ghost" href="/api/export.csv?tipo=vendas">Vendas (CSV)</a>' +
              '<a class="btn ghost" href="/api/export.csv?tipo=leads">Leads (CSV)</a>' +
            '</div>' +
            '<div class="linha-divisoria"></div>' +
            '<p style="font-size:12px;color:var(--muted);margin-bottom:9px">Restaurar um backup substitui todos os dados atuais.</p>' +
            '<input type="file" id="arquivo-import" accept=".json,application/json" hidden>' +
            '<button class="btn" data-act="importar">' + ico('upload', 14) + ' Importar backup</button>' +
          '</section>' +

          '<section class="card bloco-config perigo-zona">' +
            '<h3>Zona de perigo</h3>' +
            '<p>Ações irreversíveis. Um backup é criado automaticamente ao iniciar o sistema.</p>' +
            (semDados ? '<button class="btn ghost" data-act="seed" style="margin-bottom:8px">Carregar dados de exemplo</button><br>' : '') +
            '<button class="btn danger" data-act="reset">' + ico('trash', 14) + ' Apagar todos os dados</button>' +
          '</section>' +

          '<section class="card bloco-config">' +
            '<h3>Sobre</h3>' +
            '<p>CRM Closer v1 · Node.js + SQLite local. Aberto em <strong>' + esc(location.host) + '</strong>.</p>' +
            '<p style="font-size:12px;color:var(--muted)">Dados salvos localmente no seu computador.</p>' +
          '</section>' +
        '</div>' +
      '</div>';
  }

  // ---------------------------------------------------------------- modais

  function abrirModal(titulo, corpo) {
    const root = $('#modal-root');
    root.innerHTML = '<div class="modal-bg" data-act="fechar-backdrop">' +
      '<div class="modal-card" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          '<h2>' + esc(titulo) + '</h2>' +
          '<button class="icon-btn sem-borda" data-act="fechar-modal" aria-label="Fechar">' + ico('close', 18) + '</button>' +
        '</div>' +
        '<div class="modal-body">' + corpo + '</div>' +
      '</div>' +
    '</div>';
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const primeiro = root.querySelector('input:not([type=hidden]), select, textarea') || root.querySelector('button');
      if (primeiro) primeiro.focus();
    }, 40);
  }

  function fecharModal() {
    $('#modal-root').innerHTML = '';
    document.body.style.overflow = '';
  }

  function pedirConfirmacao(titulo, texto, rotuloBotao, acao) {
    abrirModal(titulo,
      '<p style="font-size:13px;color:var(--text-2);line-height:1.5">' + texto + '</p>' +
      '<div class="form-acoes"><button class="btn ghost" data-act="fechar-modal" type="button">Cancelar</button>' +
      '<button class="btn danger" id="btn-confirmar" type="button">' + esc(rotuloBotao) + '</button></div>'
    );
    const botao = $('#btn-confirmar');
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      try {
        await acao();
      } catch (e) {
        toast(e.message, 'erro');
        botao.disabled = false;
      }
    });
  }

  function abrirLead(lead) {
    const l = lead || {};
    const editando = !!lead;
    const temVenda = editando && state.data.vendas.some((v) => Number(v.lead_id) === Number(l.id));
    const origens = ORIGENS.map((o) => '<option value="' + esc(o) + '">').join('');
    const corpo =
      '<form data-form="lead" data-id="' + (editando ? l.id : '') + '" class="form-grid">' +
        '<div class="campo full"><label>Nome *</label><input name="nome" required maxlength="120" value="' + esc(l.nome || '') + '" placeholder="Nome do lead"></div>' +
        '<div class="campo"><label>Telefone / WhatsApp</label><input name="telefone" maxlength="40" value="' + esc(l.telefone || '') + '" placeholder="(11) 99999-9999"></div>' +
        '<div class="campo"><label>Origem</label><input name="origem" maxlength="60" list="lista-origens" value="' + esc(l.origem || '') + '" placeholder="Instagram, indicação..."><datalist id="lista-origens">' + origens + '</datalist></div>' +
        '<div class="campo"><label>Produto / oferta</label><input name="produto" maxlength="120" value="' + esc(l.produto || '') + '" placeholder="Mentoria, consultoria..."></div>' +
        '<div class="campo"><label>Ticket estimado (R$)</label><input type="number" name="ticket" step="0.01" min="0" value="' + (Number(l.ticket) > 0 ? Number(l.ticket) : '') + '"></div>' +
        '<div class="campo"><label>Etapa</label><select name="etapa">' +
          ETAPAS.map((e) => '<option value="' + e.id + '"' + ((l.etapa || 'novo') === e.id ? ' selected' : '') + '>' + e.nome + '</option>').join('') +
        '</select></div>' +
        '<div class="campo"><label>Próximo follow-up</label><input type="date" name="proximo_followup" value="' + (l.proximo_followup || '') + '"></div>' +
        '<div class="campo full"><label>Observações</label><textarea name="observacoes" maxlength="2000" placeholder="Contexto, objeções, combinados...">' + esc(l.observacoes || '') + '</textarea></div>' +
        '<div class="form-acoes full">' +
          (editando ? '<button type="button" class="btn danger small" data-act="excluir-lead" data-id="' + l.id + '" style="margin-right:auto">' + ico('trash', 13) + ' Excluir</button>' : '') +
          (editando && !temVenda ? '<button type="button" class="btn ghost" data-act="vender-lead" data-id="' + l.id + '">' + ico('bag', 14) + ' Registrar venda</button>' : '') +
          '<button type="button" class="btn ghost" data-act="fechar-modal">Cancelar</button>' +
          '<button class="btn primary" type="submit">Salvar lead</button>' +
        '</div>' +
      '</form>';
    abrirModal(editando ? 'Editar lead' : 'Novo lead', corpo);
  }

  function abrirVenda(venda, preenchimento) {
    const editando = !!venda;
    const base = Object.assign({}, venda || {}, preenchimento || {});
    const cfg = state.data.config;
    const leads = state.data.leads;
    const percentual = base.percentual !== undefined && base.percentual !== null && base.percentual !== ''
      ? Number(base.percentual)
      : Number(cfg.percentual_padrao);
    const valor = Number(base.valor) || 0;
    const status = base.status || 'recebida';
    const data = base.data_fechamento || state.data.hoje;
    const origemOptions = ORIGENS.map((o) => '<option value="' + esc(o) + '">').join('');

    const corpo =
      '<form data-form="venda" data-id="' + (editando ? venda.id : '') + '" class="form-grid">' +
        '<div class="campo full"><label>Cliente *</label><input name="cliente" required maxlength="120" value="' + esc(base.cliente || '') + '" placeholder="Nome do cliente"></div>' +
        '<div class="campo"><label>Valor da venda (R$) *</label><input type="number" id="venda-valor" name="valor" step="0.01" min="0.01" required value="' + (valor > 0 ? valor : '') + '" placeholder="10000"></div>' +
        '<div class="campo"><label>Comissão (%)</label><input type="number" id="venda-percentual" name="percentual" step="0.01" min="0" max="100" value="' + percentual + '"></div>' +
        '<div class="campo full"><div class="comissao-preview"><span>Comissão desta venda</span><strong id="venda-comissao">' + fmtBRL((valor * percentual) / 100) + '</strong></div></div>' +
        '<div class="campo"><label>Data do fechamento</label><input type="date" name="data_fechamento" value="' + data + '"></div>' +
        '<div class="campo"><label>Status</label><select name="status">' +
          '<option value="recebida"' + (status === 'recebida' ? ' selected' : '') + '>Recebida</option>' +
          '<option value="pendente"' + (status === 'pendente' ? ' selected' : '') + '>Pendente</option>' +
        '</select></div>' +
        '<div class="campo"><label>Produto</label><input name="produto" maxlength="120" value="' + esc(base.produto || '') + '" placeholder="Mentoria, consultoria..."></div>' +
        '<div class="campo"><label>Origem</label><input name="origem" maxlength="60" list="lista-origens-venda" value="' + esc(base.origem || '') + '"><datalist id="lista-origens-venda">' + origemOptions + '</datalist></div>' +
        '<div class="campo full"><label>Lead vinculado</label><select name="lead_id"><option value="">— sem vínculo —</option>' +
          leads.map((l) => '<option value="' + l.id + '"' + (Number(base.lead_id) === Number(l.id) ? ' selected' : '') + '>' + esc(l.nome) + (l.produto ? ' · ' + esc(l.produto) : '') + '</option>').join('') +
        '</select></div>' +
        '<div class="campo full"><label>Observações</label><textarea name="observacoes" maxlength="2000">' + esc(base.observacoes || '') + '</textarea></div>' +
        '<div class="form-acoes full">' +
          (editando ? '<button type="button" class="btn danger small" data-act="excluir-venda" data-id="' + venda.id + '" style="margin-right:auto">' + ico('trash', 13) + ' Excluir</button>' : '') +
          '<button type="button" class="btn ghost" data-act="fechar-modal">Cancelar</button>' +
          '<button class="btn primary" type="submit">Salvar venda</button>' +
        '</div>' +
      '</form>';

    abrirModal(editando ? 'Editar venda' : 'Nova venda', corpo);
    atualizarPreviewComissao();
  }

  function atualizarPreviewComissao() {
    const valor = Number($('#venda-valor')?.value || 0);
    const percentual = Number($('#venda-percentual')?.value || 0);
    const alvo = $('#venda-comissao');
    if (alvo) alvo.textContent = fmtBRL((valor * percentual) / 100);
  }

  // ---------------------------------------------------------------- acoes

  function acharLead(id) {
    return state.data.leads.find((l) => Number(l.id) === Number(id));
  }

  function acharVenda(id) {
    return state.data.vendas.find((v) => Number(v.id) === Number(id));
  }

  async function salvarLead(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    dados.ticket = Number(dados.ticket || 0);
    const id = form.dataset.id;
    if (id) await api('/api/leads/' + id, { method: 'PUT', body: dados });
    else await api('/api/leads', { method: 'POST', body: dados });
    fecharModal();
    toast(id ? 'Lead atualizado' : 'Lead cadastrado');
    await carregar(true);
  }

  async function salvarVenda(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    dados.valor = Number(dados.valor || 0);
    dados.percentual = dados.percentual === '' ? '' : Number(dados.percentual);
    dados.lead_id = dados.lead_id || null;
    const id = form.dataset.id;
    if (id) await api('/api/vendas/' + id, { method: 'PUT', body: dados });
    else await api('/api/vendas', { method: 'POST', body: dados });
    fecharModal();
    toast(id ? 'Venda atualizada' : 'Venda registrada');
    await carregar(true);
  }

  async function salvarFixo(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    await api('/api/fixos/' + form.dataset.mes, { method: 'PUT', body: { valor: Number(dados.valor || 0) } });
    toast('Fixo do mês atualizado');
    await carregar(true);
  }

  async function salvarMetas(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    await api('/api/metas/' + form.dataset.mes, {
      method: 'PUT',
      body: { meta_vendas: Number(dados.meta_vendas || 0), meta_comissao: Number(dados.meta_comissao || 0) },
    });
    toast('Metas salvas');
    await carregar(true);
  }

  async function salvarConfig(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    await api('/api/config', {
      method: 'PUT',
      body: {
        nome: dados.nome,
        percentual_padrao: Number(dados.percentual_padrao || 0),
        fixo_padrao: Number(dados.fixo_padrao || 0),
      },
    });
    toast('Preferências salvas');
    await carregar(true);
  }

  async function salvarPin(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    const pin = String(dados.pin || '').trim();
    if (!/^\d{4}$/.test(pin)) throw new Error('O PIN precisa ter exatamente 4 dígitos.');
    await api('/api/config', { method: 'PUT', body: { pin } });
    toast('PIN atualizado');
    await recarregarHealth();
    await carregar(true);
  }

  async function desativarPin() {
    await api('/api/config', { method: 'PUT', body: { remover_pin: true } });
    toast('PIN desativado');
    await recarregarHealth();
    await carregar(true);
  }

  async function moverLead(id, etapa) {
    const lead = acharLead(id);
    if (!lead || lead.etapa === etapa) return;
    const anterior = lead.etapa;
    lead.etapa = etapa;
    render();
    try {
      await api('/api/leads/' + id, { method: 'PUT', body: { etapa } });
      toast('Lead movido para ' + etapaInfo(etapa).nome);
      await carregar(true);
    } catch (e) {
      lead.etapa = anterior;
      render();
      throw e;
    }
  }

  async function alternarStatus(id) {
    const venda = acharVenda(id);
    if (!venda) return;
    const novo = venda.status === 'recebida' ? 'pendente' : 'recebida';
    await api('/api/vendas/' + id, { method: 'PUT', body: { status: novo } });
    toast(novo === 'recebida' ? 'Comissão marcada como recebida' : 'Comissão marcada como pendente');
    await carregar(true);
  }

  function excluirLead(id) {
    const lead = acharLead(id);
    if (!lead) return;
    pedirConfirmacao('Excluir lead', 'Tem certeza que deseja excluir <strong>' + esc(lead.nome) + '</strong>? As vendas vinculadas continuam salvas, mas perdem o vínculo.', 'Excluir lead', async () => {
      await api('/api/leads/' + id, { method: 'DELETE' });
      fecharModal();
      toast('Lead excluído');
      await carregar(true);
    });
  }

  function excluirVenda(id) {
    const venda = acharVenda(id);
    if (!venda) return;
    pedirConfirmacao('Excluir venda', 'Excluir a venda de <strong>' + esc(venda.cliente) + '</strong> no valor de ' + fmtBRL(venda.valor) + '? A comissão de ' + fmtBRL(venda.comissao) + ' também será removida.', 'Excluir venda', async () => {
      await api('/api/vendas/' + id, { method: 'DELETE' });
      fecharModal();
      toast('Venda excluída');
      await carregar(true);
    });
  }

  function venderDoLead(id) {
    const lead = acharLead(id);
    if (!lead) return;
    fecharModal();
    abrirVenda(null, {
      lead_id: lead.id,
      cliente: lead.nome,
      produto: lead.produto || '',
      origem: lead.origem || '',
      valor: Number(lead.ticket) || 0,
    });
  }

  function backupAgora() {
    api('/api/backup', { method: 'POST' })
      .then((r) => toast('Backup criado: ' + r.arquivo))
      .catch((e) => toast(e.message, 'erro'));
  }

  function carregarExemplo() {
    pedirConfirmacao('Dados de exemplo', 'Isso adiciona leads, vendas e metas fictícias para você testar o sistema. Só funciona com o CRM vazio.', 'Carregar exemplo', async () => {
      await api('/api/seed', { method: 'POST' });
      fecharModal();
      toast('Dados de exemplo carregados');
      await carregar();
    });
  }

  function apagarTudo() {
    pedirConfirmacao('Apagar todos os dados', 'Todos os leads, vendas, fixos e metas serão apagados. As preferências e o PIN são mantidos. Essa ação não pode ser desfeita.', 'Apagar tudo', async () => {
      await api('/api/reset', { method: 'POST', body: { confirm: 'APAGAR' } });
      fecharModal();
      toast('Dados apagados');
      await carregar();
    });
  }

  function importarArquivo(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      let dados;
      try {
        dados = JSON.parse(String(leitor.result));
      } catch {
        toast('Arquivo JSON inválido.', 'erro');
        return;
      }
      pedirConfirmacao('Importar backup', 'A importação substitui todos os leads, vendas, fixos e metas atuais pelos dados do arquivo. O PIN não é alterado.', 'Importar agora', async () => {
        await api('/api/import', { method: 'POST', body: dados });
        fecharModal();
        toast('Backup importado com sucesso');
        await carregar();
      });
    };
    leitor.readAsText(arquivo);
  }

  function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(() => toast('Link copiado'), () => toast('Não foi possível copiar', 'erro'));
      return;
    }
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('Link copiado');
    } catch {
      toast('Não foi possível copiar', 'erro');
    }
    area.remove();
  }

  // ---------------------------------------------------------------- eventos

  function tratarClique(e) {
    const alvo = e.target.closest('[data-act]');
    if (!alvo) return;
    const acao = alvo.dataset.act;
    const id = alvo.dataset.id;

    if (acao === 'nav') navegar(alvo.dataset.view);
    else if (acao === 'tema') {
      state.tema = state.tema === 'light' ? 'dark' : 'light';
      localStorage.setItem('crm.tema', state.tema);
      aplicarTema();
    } else if (acao === 'fechar-backdrop') {
      if (alvo === e.target) fecharModal();
    } else if (acao === 'fechar-modal') fecharModal();
    else if (acao === 'novo-lead') abrirLead(null);
    else if (acao === 'nova-venda') abrirVenda(null, null);
    else if (acao === 'editar-lead') {
      const lead = acharLead(id);
      if (lead) abrirLead(lead);
    } else if (acao === 'editar-venda') {
      const venda = acharVenda(id);
      if (venda) abrirVenda(venda, null);
    } else if (acao === 'excluir-lead') excluirLead(id);
    else if (acao === 'excluir-venda') excluirVenda(id);
    else if (acao === 'vender-lead') venderDoLead(id);
    else if (acao === 'alternar-status') {
      alternarStatus(id).catch((err) => toast(err.message, 'erro'));
    } else if (acao === 'modo-leads') {
      state.leadsModo = alvo.dataset.modo;
      localStorage.setItem('crm.leadsModo', state.leadsModo);
      render();
    } else if (acao === 'abrir-mes') {
      state.mes = alvo.dataset.mes;
      carregar().catch((err) => toast(err.message, 'erro'));
    } else if (acao === 'backup-agora') backupAgora();
    else if (acao === 'seed') carregarExemplo();
    else if (acao === 'reset') apagarTudo();
    else if (acao === 'importar') $('#arquivo-import')?.click();
    else if (acao === 'desativar-pin') {
      pedirConfirmacao('Desativar PIN', 'Sem PIN, qualquer aparelho na sua rede local poderá abrir o CRM. Deseja continuar?', 'Desativar', async () => {
        await desativarPin();
        fecharModal();
      });
    } else if (acao === 'copiar') copiarTexto(alvo.dataset.texto || '');
    else if (acao === 'sair') {
      api('/api/logout', { method: 'POST' })
        .then(() => {
          recarregarHealth();
          mostrarLogin();
        })
        .catch((err) => toast(err.message, 'erro'));
    }
  }

  document.addEventListener('click', (e) => {
    try {
      tratarClique(e);
    } catch (err) {
      toast(err.message, 'erro');
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const tipo = form.dataset.form;
    const executar = async () => {
      if (tipo === 'lead') await salvarLead(form);
      else if (tipo === 'venda') await salvarVenda(form);
      else if (tipo === 'fixo') await salvarFixo(form);
      else if (tipo === 'metas') await salvarMetas(form);
      else if (tipo === 'config') await salvarConfig(form);
      else if (tipo === 'pin') await salvarPin(form);
    };
    executar().catch((err) => toast(err.message, 'erro'));
  });

  let timerBusca = null;

  document.addEventListener('input', (e) => {
    if (e.target.id === 'busca-leads') {
      state.leadsFiltro.q = e.target.value;
      clearTimeout(timerBusca);
      timerBusca = setTimeout(() => {
        render();
        const campo = $('#busca-leads');
        if (campo) {
          campo.focus();
          campo.setSelectionRange(campo.value.length, campo.value.length);
        }
      }, 220);
      return;
    }
    if (e.target.id === 'busca-vendas') {
      state.vendasFiltro.q = e.target.value;
      clearTimeout(timerBusca);
      timerBusca = setTimeout(() => {
        render();
        const campo = $('#busca-vendas');
        if (campo) {
          campo.focus();
          campo.setSelectionRange(campo.value.length, campo.value.length);
        }
      }, 220);
      return;
    }
    if (e.target.id === 'venda-valor' || e.target.id === 'venda-percentual') {
      atualizarPreviewComissao();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'filtro-etapa') {
      state.leadsFiltro.etapa = e.target.value;
      render();
    } else if (e.target.id === 'filtro-status') {
      state.vendasFiltro.status = e.target.value;
      render();
    } else if (e.target.id === 'arquivo-import') {
      importarArquivo(e.target.files && e.target.files[0]);
      e.target.value = '';
    } else if (e.target.id === 'mes-input') {
      if (/^\d{4}-\d{2}$/.test(e.target.value)) {
        state.mes = e.target.value;
        carregar().catch((err) => toast(err.message, 'erro'));
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
  });

  // --- drag and drop do kanban (delegado no #view)

  function configurarArrastar() {
    const view = $('#view');

    view.addEventListener('dragstart', (e) => {
      const cartao = e.target.closest('.lead-card');
      if (!cartao) return;
      e.dataTransfer.setData('text/plain', cartao.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      cartao.classList.add('dragging');
    });

    view.addEventListener('dragend', (e) => {
      const cartao = e.target.closest('.lead-card');
      if (cartao) cartao.classList.remove('dragging');
      view.querySelectorAll('.kanban-col.drop').forEach((c) => c.classList.remove('drop'));
    });

    view.addEventListener('dragover', (e) => {
      const coluna = e.target.closest('.kanban-col');
      if (!coluna) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      view.querySelectorAll('.kanban-col.drop').forEach((c) => {
        if (c !== coluna) c.classList.remove('drop');
      });
      coluna.classList.add('drop');
    });

    view.addEventListener('dragleave', (e) => {
      const coluna = e.target.closest('.kanban-col');
      if (coluna && !coluna.contains(e.relatedTarget)) coluna.classList.remove('drop');
    });

    view.addEventListener('drop', (e) => {
      const coluna = e.target.closest('.kanban-col');
      if (!coluna) return;
      e.preventDefault();
      coluna.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const etapa = coluna.dataset.etapa;
      if (id && etapa) moverLead(id, etapa).catch((err) => toast(err.message, 'erro'));
    });
  }

  // ---------------------------------------------------------------- inicio

  function montarIconesFixos() {
    const alvos = {
      'ico-mais-lead': ['plus', 15],
      'ico-mais-venda': ['plus', 15],
      'ico-sair': ['logout', 16],
    };
    for (const [id, par] of Object.entries(alvos)) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = ico(par[0], par[1]);
    }
  }

  async function iniciar() {
    aplicarTema();
    montarIconesFixos();
    montarNavs();
    configurarArrastar();
    $('#login-form').addEventListener('submit', entrar);
    window.addEventListener('hashchange', () => {
      const alvo = viewDoHash();
      if (alvo && alvo !== state.view) {
        state.view = alvo;
        render();
      }
    });
    const inicial = viewDoHash();
    if (inicial) state.view = inicial;

    try {
      const health = await fetch('/api/health').then((r) => r.json());
      state.health = health;
      if (health.needsPin) {
        mostrarLogin();
      } else {
        esconderLogin();
        await carregar();
      }
    } catch (e) {
      document.body.innerHTML = '<div style="padding:40px;font-family:system-ui">' +
        '<h2>Não foi possível conectar ao servidor</h2>' +
        '<p style="color:#888;margin-top:8px">Feche esta aba e abra o CRM pelo atalho novamente.</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
