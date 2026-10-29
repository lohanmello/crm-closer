'use strict';

/**
 * CRM Closer - servidor local
 * Node.js + SQLite embutido (node:sqlite). Sem dependencias externas.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DB_DIR = process.env.CRM_DATA_DIR
  ? path.resolve(process.env.CRM_DATA_DIR)
  : path.join(ROOT, 'db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DB_FILE = path.join(DB_DIR, 'crm.db');
const LOG_FILE = path.join(DB_DIR, 'server.log');
const PID_FILE = path.join(DB_DIR, 'server.pid');

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const ABRIR_NAVEGADOR = process.argv.includes('--open');
const PORTA_BASE = Number(process.env.PORT) || 3000;

function log(...args) {
  const linha =
    '[' + new Date().toISOString() + '] ' +
    args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  try {
    fs.appendFileSync(LOG_FILE, linha + '\n');
  } catch { /* ignora */ }
  console.log(linha);
}

function hojeISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function arredondar2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Banco de dados
// ---------------------------------------------------------------------------

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT,
    origem TEXT,
    produto TEXT,
    ticket REAL NOT NULL DEFAULT 0,
    etapa TEXT NOT NULL DEFAULT 'novo',
    proximo_followup TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    cliente TEXT NOT NULL,
    produto TEXT,
    origem TEXT,
    valor REAL NOT NULL,
    percentual REAL NOT NULL,
    comissao REAL NOT NULL,
    data_fechamento TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recebida',
    pago_em TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS fixos (
    mes TEXT PRIMARY KEY,
    valor REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS metas (
    mes TEXT PRIMARY KEY,
    meta_vendas REAL NOT NULL DEFAULT 0,
    meta_comissao REAL NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_fechamento);
  CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads(etapa);
`);

const CONFIG_PADRAO = {
  nome: 'CRM Closer',
  percentual_padrao: '5',
  fixo_padrao: '3000',
  pin: '',
};

const ETAPAS = ['novo', 'contato', 'agendado', 'call', 'proposta', 'fechado', 'perdido'];

function configurarPadroes() {
  const existentes = new Set(
    db.prepare('SELECT chave FROM config').all().map((r) => r.chave)
  );
  for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) {
    if (!existentes.has(chave)) {
      db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?)').run(chave, valor);
    }
  }
}
configurarPadroes();

function getConfig() {
  const cfg = { ...CONFIG_PADRAO };
  for (const row of db.prepare('SELECT chave, valor FROM config').all()) {
    cfg[row.chave] = row.valor;
  }
  return cfg;
}

function publicConfig() {
  const cfg = getConfig();
  return {
    nome: cfg.nome || 'CRM Closer',
    percentual_padrao: Number(cfg.percentual_padrao) || 0,
    fixo_padrao: Number(cfg.fixo_padrao) || 0,
    pin_ativo: !!cfg.pin,
  };
}

function setConfig(chave, valor) {
  db.prepare(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ' +
      'ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
  ).run(chave, String(valor));
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

function criarBackup(sufixo) {
  try {
    const agora = new Date();
    const stamp =
      agora.getFullYear() +
      '-' + String(agora.getMonth() + 1).padStart(2, '0') +
      '-' + String(agora.getDate()).padStart(2, '0') +
      '_' + String(agora.getHours()).padStart(2, '0') +
      '-' + String(agora.getMinutes()).padStart(2, '0') +
      '-' + String(agora.getSeconds()).padStart(2, '0');
    const nome = 'crm-' + sufixo + '-' + stamp + '.db';
    const destino = path.join(BACKUP_DIR, nome);
    db.exec("VACUUM INTO '" + destino.replace(/'/g, "''") + "'");
    podarBackups();
    return destino;
  } catch (erro) {
    log('Falha no backup:', erro.message);
    return null;
  }
}

function podarBackups() {
  try {
    const arquivos = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('crm-') && f.endsWith('.db'))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const item of arquivos.slice(7)) {
      fs.unlinkSync(path.join(BACKUP_DIR, item.f));
    }
  } catch (erro) {
    log('Falha ao podar backups:', erro.message);
  }
}

function backupDoDiaFeito() {
  const agora = new Date();
  const hoje =
    agora.getFullYear() +
    '-' + String(agora.getMonth() + 1).padStart(2, '0') +
    '-' + String(agora.getDate()).padStart(2, '0');
  try {
    return fs.readdirSync(BACKUP_DIR).some((f) => f.startsWith('crm-diario-' + hoje));
  } catch {
    return false;
  }
}

function backupDiarioSePreciso() {
  if (!backupDoDiaFeito()) criarBackup('diario');
}

criarBackup('diario');
setInterval(backupDiarioSePreciso, 60 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Utilidades de dados
// ---------------------------------------------------------------------------

function txt(valor, max) {
  if (valor === undefined || valor === null) return null;
  const s = String(valor).trim();
  if (!s) return null;
  return s.slice(0, max || 500);
}

function num(valor) {
  if (valor === undefined || valor === null) return 0;
  const n = Number(String(valor).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function dataISO(valor) {
  const s = String(valor || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function mesISO(valor) {
  const s = String(valor || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

function hojeOuPadrao(valor) {
  return dataISO(valor) || hojeISO();
}

function adicionarMes(mes, delta) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

class HttpError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function json(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
  });
  res.end(texto);
}

function lerCorpo(req, limite) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > (limite || 5 * 1024 * 1024)) {
        reject(new HttpError(413, 'Conteúdo muito grande.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON invalido.'));
      }
    });
    req.on('error', reject);
  });
}

function cookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sessoes / PIN
// ---------------------------------------------------------------------------

const sessoes = new Map();
const tentativas = new Map();
const VALIDADE_SESSAO = 30 * 24 * 60 * 60 * 1000;

function limparSessoes() {
  const agora = Date.now();
  for (const [token, expira] of sessoes) {
    if (expira < agora) sessoes.delete(token);
  }
}

function autenticado(req) {
  const cfg = getConfig();
  if (!cfg.pin) return true;
  const token = cookie(req, 'sid');
  if (!token) return false;
  const expira = sessoes.get(token);
  if (!expira || expira < Date.now()) {
    sessoes.delete(token);
    return false;
  }
  return true;
}

function criarSessao(res) {
  const token = crypto.randomBytes(24).toString('hex');
  sessoes.set(token, Date.now() + VALIDADE_SESSAO);
  res.setHeader(
    'Set-Cookie',
    'sid=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + Math.floor(VALIDADE_SESSAO / 1000)
  );
  return token;
}

function ipDaRequisicao(req) {
  return req.socket.remoteAddress || 'desconhecido';
}

function bloquearPorTentativas(ip) {
  const item = tentativas.get(ip);
  if (!item) return false;
  if (item.reset < Date.now()) {
    tentativas.delete(ip);
    return false;
  }
  return item.contagem >= 8;
}

function registrarTentativa(ip) {
  const agora = Date.now();
  const item = tentativas.get(ip);
  if (!item || item.reset < agora) {
    tentativas.set(ip, { contagem: 1, reset: agora + 10 * 60 * 1000 });
  } else {
    item.contagem += 1;
  }
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

function normalizarLead(corpo) {
  const nome = txt(corpo.nome, 120);
  if (!nome) throw new HttpError(400, 'Informe o nome do lead.');
  return {
    nome,
    telefone: txt(corpo.telefone, 40),
    origem: txt(corpo.origem, 60),
    produto: txt(corpo.produto, 120),
    ticket: Math.max(0, num(corpo.ticket)),
    etapa: ETAPAS.includes(corpo.etapa) ? corpo.etapa : 'novo',
    proximo_followup: dataISO(corpo.proximo_followup),
    observacoes: txt(corpo.observacoes, 2000),
  };
}

function buscarLead(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(id));
}

function criarLead(corpo) {
  const l = normalizarLead(corpo);
  const agora = agoraISO();
  const info = db
    .prepare(
      'INSERT INTO leads (nome, telefone, origem, produto, ticket, etapa, proximo_followup, observacoes, criado_em, atualizado_em) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(l.nome, l.telefone, l.origem, l.produto, l.ticket, l.etapa, l.proximo_followup, l.observacoes, agora, agora);
  return buscarLead(Number(info.lastInsertRowid));
}

function atualizarLead(id, corpo) {
  const atual = buscarLead(id);
  if (!atual) throw new HttpError(404, 'Lead nao encontrado.');
  const dados = normalizarLead({ ...atual, ...corpo });
  db.prepare(
    'UPDATE leads SET nome=?, telefone=?, origem=?, produto=?, ticket=?, etapa=?, proximo_followup=?, observacoes=?, atualizado_em=? WHERE id=?'
  ).run(
    dados.nome,
    dados.telefone,
    dados.origem,
    dados.produto,
    dados.ticket,
    dados.etapa,
    dados.proximo_followup,
    dados.observacoes,
    agoraISO(),
    Number(id)
  );
  return buscarLead(id);
}

// ---------------------------------------------------------------------------
// Vendas
// ---------------------------------------------------------------------------

function normalizarVenda(corpo) {
  const cliente = txt(corpo.cliente, 120);
  if (!cliente) throw new HttpError(400, 'Informe o nome do cliente.');
  const valor = num(corpo.valor);
  if (!(valor > 0)) throw new HttpError(400, 'O valor da venda precisa ser maior que zero.');

  let percentual = corpo.percentual;
  if (percentual === undefined || percentual === null || percentual === '') {
    percentual = Number(getConfig().percentual_padrao);
  } else {
    percentual = num(percentual);
  }
  if (percentual < 0 || percentual > 100) {
    throw new HttpError(400, 'O percentual deve ficar entre 0 e 100.');
  }

  const status = corpo.status === 'pendente' ? 'pendente' : 'recebida';
  const dataFechamento = hojeOuPadrao(corpo.data_fechamento);
  const pagoEm = status === 'recebida' ? hojeOuPadrao(corpo.pago_em || dataFechamento) : null;

  let leadId = corpo.lead_id === undefined || corpo.lead_id === null || corpo.lead_id === ''
    ? null
    : Number(corpo.lead_id);
  if (leadId && !buscarLead(leadId)) leadId = null;

  return {
    lead_id: leadId,
    cliente,
    produto: txt(corpo.produto, 120),
    origem: txt(corpo.origem, 60),
    valor: arredondar2(valor),
    percentual: arredondar2(percentual),
    comissao: arredondar2((valor * percentual) / 100),
    data_fechamento: dataFechamento,
    status,
    pago_em: pagoEm,
    observacoes: txt(corpo.observacoes, 2000),
  };
}

function buscarVenda(id) {
  return db.prepare('SELECT * FROM vendas WHERE id = ?').get(Number(id));
}

function criarVenda(corpo) {
  const v = normalizarVenda(corpo);
  const info = db
    .prepare(
      'INSERT INTO vendas (lead_id, cliente, produto, origem, valor, percentual, comissao, data_fechamento, status, pago_em, observacoes, criado_em) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      v.lead_id,
      v.cliente,
      v.produto,
      v.origem,
      v.valor,
      v.percentual,
      v.comissao,
      v.data_fechamento,
      v.status,
      v.pago_em,
      v.observacoes,
      agoraISO()
    );
  if (v.lead_id) {
    db.prepare("UPDATE leads SET etapa='fechado', atualizado_em=? WHERE id=?").run(agoraISO(), v.lead_id);
  }
  return buscarVenda(Number(info.lastInsertRowid));
}

function atualizarVenda(id, corpo) {
  const atual = buscarVenda(id);
  if (!atual) throw new HttpError(404, 'Venda nao encontrada.');
  const v = normalizarVenda({ ...atual, ...corpo });
  db.prepare(
    'UPDATE vendas SET lead_id=?, cliente=?, produto=?, origem=?, valor=?, percentual=?, comissao=?, data_fechamento=?, status=?, pago_em=?, observacoes=? WHERE id=?'
  ).run(
    v.lead_id,
    v.cliente,
    v.produto,
    v.origem,
    v.valor,
    v.percentual,
    v.comissao,
    v.data_fechamento,
    v.status,
    v.pago_em,
    v.observacoes,
    Number(id)
  );
  return buscarVenda(id);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function dashboard(mes) {
  const cfg = getConfig();
  const vendas = db
    .prepare("SELECT * FROM vendas WHERE substr(data_fechamento, 1, 7) = ?")
    .all(mes);
  const fixoRow = db.prepare('SELECT valor FROM fixos WHERE mes = ?').get(mes);
  const fixo = fixoRow ? Number(fixoRow.valor) : Number(cfg.fixo_padrao) || 0;

  const valorTotal = arredondar2(vendas.reduce((s, v) => s + Number(v.valor), 0));
  const comissaoTotal = arredondar2(vendas.reduce((s, v) => s + Number(v.comissao), 0));
  const recebidas = arredondar2(
    vendas.filter((v) => v.status === 'recebida').reduce((s, v) => s + Number(v.comissao), 0)
  );
  const pendentes = arredondar2(comissaoTotal - recebidas);

  const leadsMes = db
    .prepare('SELECT * FROM leads WHERE substr(criado_em, 1, 7) = ?')
    .all(mes);
  const contagem = {};
  for (const etapa of ETAPAS) contagem[etapa] = 0;
  for (const lead of leadsMes) contagem[lead.etapa] = (contagem[lead.etapa] || 0) + 1;

  const fechados = contagem.fechado || 0;
  const perdidos = contagem.perdido || 0;
  const conversao = fechados + perdidos > 0 ? fechados / (fechados + perdidos) : 0;

  const followups = db
    .prepare(
      "SELECT id, nome, telefone, etapa, produto, proximo_followup FROM leads " +
        "WHERE proximo_followup IS NOT NULL AND proximo_followup <> '' AND proximo_followup < ? " +
        "AND etapa NOT IN ('fechado', 'perdido') ORDER BY proximo_followup ASC LIMIT 8"
    )
    .all(hojeISO());

  const metaRow = db.prepare('SELECT * FROM metas WHERE mes = ?').get(mes);

  const historico = [];
  for (let i = 5; i >= 0; i -= 1) {
    const m = adicionarMes(mes, -i);
    const linhas = db
      .prepare("SELECT valor, comissao FROM vendas WHERE substr(data_fechamento, 1, 7) = ?")
      .all(m);
    historico.push({
      mes: m,
      valor: arredondar2(linhas.reduce((s, v) => s + Number(v.valor), 0)),
      comissao: arredondar2(linhas.reduce((s, v) => s + Number(v.comissao), 0)),
    });
  }

  const ultimasVendas = db
    .prepare('SELECT * FROM vendas ORDER BY data_fechamento DESC, id DESC LIMIT 5')
    .all();

  return {
    mes,
    fixo: arredondar2(fixo),
    valorTotal,
    comissaoTotal,
    recebidas,
    pendentes,
    totalMes: arredondar2(fixo + comissaoTotal),
    qtdVendas: vendas.length,
    leads: {
      total: leadsMes.length,
      porEtapa: contagem,
      fechados,
      perdidos,
      conversao,
    },
    followups,
    meta: {
      meta_vendas: metaRow ? Number(metaRow.meta_vendas) : 0,
      meta_comissao: metaRow ? Number(metaRow.meta_comissao) : 0,
    },
    historico,
    ultimasVendas,
  };
}

// ---------------------------------------------------------------------------
// CSV / backup JSON
// ---------------------------------------------------------------------------

function celulaCSV(valor) {
  const s = valor === undefined || valor === null ? '' : String(valor);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function numeroBR(n) {
  return Number(n || 0).toFixed(2).replace('.', ',');
}

function gerarCSVVendas() {
  const linhas = db
    .prepare('SELECT * FROM vendas ORDER BY data_fechamento ASC, id ASC')
    .all();
  const cabecalho = [
    'Data fechamento', 'Cliente', 'Produto', 'Origem', 'Valor da venda',
    'Percentual (%)', 'Comissao', 'Status', 'Pago em', 'Observacoes',
  ];
  const corpo = linhas.map((v) =>
    [
      v.data_fechamento,
      v.cliente,
      v.produto,
      v.origem,
      numeroBR(v.valor),
      String(Number(v.percentual)).replace('.', ','),
      numeroBR(v.comissao),
      v.status === 'recebida' ? 'Recebida' : 'Pendente',
      v.pago_em,
      v.observacoes,
    ].map(celulaCSV).join(';')
  );
  return '\uFEFF' + cabecalho.join(';') + '\r\n' + corpo.join('\r\n') + '\r\n';
}

function gerarCSVLeads() {
  const linhas = db.prepare('SELECT * FROM leads ORDER BY nome ASC').all();
  const cabecalho = [
    'Nome', 'Telefone', 'Origem', 'Produto', 'Ticket estimado',
    'Etapa', 'Proximo follow-up', 'Observacoes', 'Criado em',
  ];
  const rotulo = {
    novo: 'Novo', contato: 'Contato', agendado: 'Agendado', call: 'Call realizada',
    proposta: 'Proposta', fechado: 'Fechado', perdido: 'Perdido',
  };
  const corpo = linhas.map((l) =>
    [
      l.nome,
      l.telefone,
      l.origem,
      l.produto,
      numeroBR(l.ticket),
      rotulo[l.etapa] || l.etapa,
      l.proximo_followup,
      l.observacoes,
      l.criado_em,
    ].map(celulaCSV).join(';')
  );
  return '\uFEFF' + cabecalho.join(';') + '\r\n' + corpo.join('\r\n') + '\r\n';
}

function exportarJSON() {
  return {
    app: 'crm-closer',
    versao: 1,
    exportado_em: agoraISO(),
    config: (() => {
      const c = getConfig();
      return {
        nome: c.nome,
        percentual_padrao: Number(c.percentual_padrao),
        fixo_padrao: Number(c.fixo_padrao),
      };
    })(),
    leads: db.prepare('SELECT * FROM leads ORDER BY id').all(),
    vendas: db.prepare('SELECT * FROM vendas ORDER BY id').all(),
    fixos: db.prepare('SELECT * FROM fixos').all(),
    metas: db.prepare('SELECT * FROM metas').all(),
  };
}

function importarJSON(dados) {
  if (!dados || !Array.isArray(dados.leads) || !Array.isArray(dados.vendas)) {
    throw new HttpError(400, 'Arquivo invalido: leads e vendas sao obrigatorios.');
  }
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM vendas; DELETE FROM leads; DELETE FROM fixos; DELETE FROM metas;');

    const insLead = db.prepare(
      'INSERT INTO leads (id, nome, telefone, origem, produto, ticket, etapa, proximo_followup, observacoes, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const l of dados.leads) {
      insLead.run(
        Number(l.id) || null,
        txt(l.nome, 120) || 'Sem nome',
        txt(l.telefone, 40),
        txt(l.origem, 60),
        txt(l.produto, 120),
        num(l.ticket),
        ETAPAS.includes(l.etapa) ? l.etapa : 'novo',
        dataISO(l.proximo_followup),
        txt(l.observacoes, 2000),
        l.criado_em || agoraISO(),
        l.atualizado_em || agoraISO()
      );
    }

    const insVenda = db.prepare(
      'INSERT INTO vendas (id, lead_id, cliente, produto, origem, valor, percentual, comissao, data_fechamento, status, pago_em, observacoes, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const v of dados.vendas) {
      const valor = num(v.valor);
      const percentual = num(v.percentual);
      insVenda.run(
        Number(v.id) || null,
        v.lead_id ? Number(v.lead_id) : null,
        txt(v.cliente, 120) || 'Sem nome',
        txt(v.produto, 120),
        txt(v.origem, 60),
        arredondar2(valor),
        arredondar2(percentual),
        arredondar2(v.comissao !== undefined ? num(v.comissao) : (valor * percentual) / 100),
        dataISO(v.data_fechamento) || hojeISO(),
        v.status === 'pendente' ? 'pendente' : 'recebida',
        dataISO(v.pago_em),
        txt(v.observacoes, 2000),
        v.criado_em || agoraISO()
      );
    }

    const insFixo = db.prepare('INSERT INTO fixos (mes, valor) VALUES (?, ?)');
    for (const f of dados.fixos || []) {
      const mes = mesISO(f.mes);
      if (mes) insFixo.run(mes, num(f.valor));
    }

    const insMeta = db.prepare('INSERT INTO metas (mes, meta_vendas, meta_comissao) VALUES (?, ?, ?)');
    for (const m of dados.metas || []) {
      const mes = mesISO(m.mes);
      if (mes) insMeta.run(mes, num(m.meta_vendas), num(m.meta_comissao));
    }

    db.exec('COMMIT');
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }

  if (dados.config) {
    if (dados.config.nome) setConfig('nome', txt(dados.config.nome, 80) || 'CRM Closer');
    if (dados.config.percentual_padrao !== undefined) {
      setConfig('percentual_padrao', Math.max(0, Math.min(100, num(dados.config.percentual_padrao))));
    }
    if (dados.config.fixo_padrao !== undefined) {
      setConfig('fixo_padrao', Math.max(0, num(dados.config.fixo_padrao)));
    }
  }
}

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

function dadosExemplo() {
  const totalLeads = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
  const totalVendas = db.prepare('SELECT COUNT(*) AS n FROM vendas').get().n;
  if (totalLeads > 0 || totalVendas > 0) {
    throw new HttpError(409, 'Ja existem dados cadastrados. Apague os dados antes de carregar o exemplo.');
  }

  const agora = agoraISO();
  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);
  const mesAnterior = adicionarMes(mesAtual, -1);
  const doisMeses = adicionarMes(mesAtual, -2);
  const dia = (m, d) => m + '-' + String(d).padStart(2, '0');

  const novos = [
    ['Ana Souza', '(11) 98888-1010', 'Instagram', 'Mentoria Individual', 12000, 'novo', null],
    ['Bruno Lima', '(11) 97777-2020', 'Indicacao', 'Consultoria', 8000, 'contato', null],
    ['Carla Mendes', '(21) 96666-3030', 'Trafego pago', 'Mentoria Grupo', 15000, 'agendado', dia(mesAtual, 28)],
    ['Diego Rocha', '(31) 95555-4040', 'Instagram', 'Programa Anual', 20000, 'call', null],
    ['Elisa Prado', '(41) 94444-5050', 'Indicacao', 'Mentoria Individual', 35000, 'proposta', dia(mesAtual, 3)],
    ['Felipe Nunes', '(51) 93333-6060', 'Instagram', 'Mentoria Individual', 25000, 'fechado', null],
    ['Gabi Torres', '(61) 92222-7070', 'Trafego pago', 'Consultoria', 9000, 'perdido', null],
    ['Hugo Alves', '(71) 91111-8080', 'Evento', 'Mentoria Grupo', 18000, 'agendado', dia(mesAtual, 5)],
  ];
  db.exec('BEGIN');
  try {
    const insLead = db.prepare(
      'INSERT INTO leads (nome, telefone, origem, produto, ticket, etapa, proximo_followup, observacoes, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const ids = {};
    for (const l of novos) {
      const info = insLead.run(l[0], l[1], l[2], l[3], l[4], l[5], l[6], null, agora, agora);
      ids[l[0]] = Number(info.lastInsertRowid);
    }

    const insVenda = db.prepare(
      'INSERT INTO vendas (lead_id, cliente, produto, origem, valor, percentual, comissao, data_fechamento, status, pago_em, observacoes, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const vendas = [
      [ids['Felipe Nunes'], 'Felipe Nunes', 'Mentoria Individual', 'Instagram', 25000, 5, dia(mesAtual, 12), 'recebida'],
      [null, 'Marina Costa', 'Mentoria Grupo', 'Indicacao', 12000, 5, dia(mesAtual, 18), 'pendente'],
      [null, 'Paulo Reis', 'Consultoria', 'Trafego pago', 30000, 5, dia(mesAnterior, 9), 'recebida'],
      [null, 'Renata Dias', 'Programa Anual', 'Instagram', 45000, 5, dia(mesAnterior, 22), 'recebida'],
      [null, 'Sergio Matos', 'Mentoria Individual', 'Evento', 18000, 5, dia(doisMeses, 15), 'recebida'],
    ];
    for (const v of vendas) {
      insVenda.run(v[0], v[1], v[2], v[3], v[4], v[5], arredondar2((v[4] * v[5]) / 100), v[6], v[7], v[7], null, agora);
    }

    db.prepare('INSERT OR REPLACE INTO fixos (mes, valor) VALUES (?, ?)').run(mesAtual, 3000);
    db.prepare('INSERT OR REPLACE INTO fixos (mes, valor) VALUES (?, ?)').run(mesAnterior, 3000);
    db.prepare('INSERT OR REPLACE INTO metas (mes, meta_vendas, meta_comissao) VALUES (?, ?, ?)').run(
      mesAtual,
      60000,
      3000
    );
    db.exec('COMMIT');
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function lanUrls(porta) {
  const urls = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces || []) {
      if (item.family === 'IPv4' && !item.internal) {
        urls.push('http://' + item.address + ':' + porta);
      }
    }
  }
  return urls;
}

async function tratarApi(req, res, url) {
  const rota = url.pathname;
  const metodo = req.method || 'GET';

  if (rota === '/api/health' && metodo === 'GET') {
    return json(res, 200, {
      app: 'crm-closer',
      versao: 1,
      ok: true,
      needsPin: !!getConfig().pin,
    });
  }

  if (rota === '/api/login' && metodo === 'POST') {
    const ip = ipDaRequisicao(req);
    if (bloquearPorTentativas(ip)) {
      throw new HttpError(429, 'Muitas tentativas. Aguarde 10 minutos.');
    }
    const corpo = await lerCorpo(req);
    const cfg = getConfig();
    if (cfg.pin && String(corpo.pin || '') !== cfg.pin) {
      registrarTentativa(ip);
      throw new HttpError(401, 'PIN incorreto.');
    }
    tentativas.delete(ip);
    criarSessao(res);
    return json(res, 200, { ok: true });
  }

  if (!autenticado(req)) {
    throw new HttpError(401, 'Acesso bloqueado. Informe o PIN.');
  }

  if (rota === '/api/logout' && metodo === 'POST') {
    const token = cookie(req, 'sid');
    if (token) sessoes.delete(token);
    res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return json(res, 200, { ok: true });
  }

  if (rota === '/api/bootstrap' && metodo === 'GET') {
    limparSessoes();
    const mes = mesISO(url.searchParams.get('mes')) || hojeISO().slice(0, 7);
    return json(res, 200, {
      ok: true,
      hoje: hojeISO(),
      config: publicConfig(),
      lan: lanUrls(portaAtual),
      leads: db
        .prepare(
          'SELECT * FROM leads ORDER BY (proximo_followup IS NULL), proximo_followup ASC, atualizado_em DESC'
        )
        .all(),
      vendas: db.prepare('SELECT * FROM vendas ORDER BY data_fechamento DESC, id DESC').all(),
      fixos: db.prepare('SELECT * FROM fixos ORDER BY mes DESC').all(),
      metas: db.prepare('SELECT * FROM metas ORDER BY mes DESC').all(),
      dash: dashboard(mes),
    });
  }

  if (rota === '/api/config' && metodo === 'PUT') {
    const corpo = await lerCorpo(req);
    if (corpo.nome !== undefined) {
      setConfig('nome', (txt(corpo.nome, 80) || 'CRM Closer'));
    }
    if (corpo.percentual_padrao !== undefined) {
      const p = num(corpo.percentual_padrao);
      if (p < 0 || p > 100) throw new HttpError(400, 'Percentual invalido.');
      setConfig('percentual_padrao', arredondar2(p));
    }
    if (corpo.fixo_padrao !== undefined) {
      const f = num(corpo.fixo_padrao);
      if (f < 0) throw new HttpError(400, 'Valor fixo invalido.');
      setConfig('fixo_padrao', arredondar2(f));
    }
    if (corpo.remover_pin === true) {
      setConfig('pin', '');
      sessoes.clear();
    } else if (corpo.pin !== undefined && corpo.pin !== null && String(corpo.pin) !== '') {
      const pin = String(corpo.pin).trim();
      if (!/^\d{4}$/.test(pin)) throw new HttpError(400, 'O PIN precisa ter exatamente 4 digitos.');
      setConfig('pin', pin);
      sessoes.clear();
      criarSessao(res);
    }
    return json(res, 200, { ok: true, config: publicConfig() });
  }

  if (rota === '/api/leads' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    return json(res, 201, { ok: true, lead: criarLead(corpo) });
  }

  const mLead = rota.match(/^\/api\/leads\/(\d+)$/);
  if (mLead) {
    if (metodo === 'PUT') {
      const corpo = await lerCorpo(req);
      return json(res, 200, { ok: true, lead: atualizarLead(mLead[1], corpo) });
    }
    if (metodo === 'DELETE') {
      const info = db.prepare('DELETE FROM leads WHERE id = ?').run(Number(mLead[1]));
      if (!info.changes) throw new HttpError(404, 'Lead nao encontrado.');
      return json(res, 200, { ok: true });
    }
  }

  if (rota === '/api/vendas' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    return json(res, 201, { ok: true, venda: criarVenda(corpo) });
  }

  const mVenda = rota.match(/^\/api\/vendas\/(\d+)$/);
  if (mVenda) {
    if (metodo === 'PUT') {
      const corpo = await lerCorpo(req);
      return json(res, 200, { ok: true, venda: atualizarVenda(mVenda[1], corpo) });
    }
    if (metodo === 'DELETE') {
      const info = db.prepare('DELETE FROM vendas WHERE id = ?').run(Number(mVenda[1]));
      if (!info.changes) throw new HttpError(404, 'Venda nao encontrada.');
      return json(res, 200, { ok: true });
    }
  }

  const mFixo = rota.match(/^\/api\/fixos\/(\d{4}-\d{2})$/);
  if (mFixo && metodo === 'PUT') {
    const corpo = await lerCorpo(req);
    const valor = num(corpo.valor);
    if (valor < 0) throw new HttpError(400, 'Valor fixo invalido.');
    db.prepare(
      'INSERT INTO fixos (mes, valor) VALUES (?, ?) ON CONFLICT(mes) DO UPDATE SET valor = excluded.valor'
    ).run(mFixo[1], arredondar2(valor));
    return json(res, 200, { ok: true });
  }

  const mMeta = rota.match(/^\/api\/metas\/(\d{4}-\d{2})$/);
  if (mMeta && metodo === 'PUT') {
    const corpo = await lerCorpo(req);
    const metaVendas = Math.max(0, num(corpo.meta_vendas));
    const metaComissao = Math.max(0, num(corpo.meta_comissao));
    db.prepare(
      'INSERT INTO metas (mes, meta_vendas, meta_comissao) VALUES (?, ?, ?) ' +
        'ON CONFLICT(mes) DO UPDATE SET meta_vendas = excluded.meta_vendas, meta_comissao = excluded.meta_comissao'
    ).run(mMeta[1], arredondar2(metaVendas), arredondar2(metaComissao));
    return json(res, 200, { ok: true });
  }

  if (rota === '/api/export.csv' && metodo === 'GET') {
    const tipo = url.searchParams.get('tipo') === 'leads' ? 'leads' : 'vendas';
    const conteudo = tipo === 'leads' ? gerarCSVLeads() : gerarCSVVendas();
    const nome = tipo === 'leads' ? 'leads.csv' : 'vendas.csv';
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + nome + '"',
      'Cache-Control': 'no-store',
    });
    return res.end(conteudo);
  }

  if (rota === '/api/backup.json' && metodo === 'GET') {
    const texto = JSON.stringify(exportarJSON(), null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="crm-backup.json"',
      'Cache-Control': 'no-store',
    });
    return res.end(texto);
  }

  if (rota === '/api/import' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    importarJSON(corpo.dados || corpo);
    return json(res, 200, { ok: true });
  }

  if (rota === '/api/backup' && metodo === 'POST') {
    const arquivo = criarBackup('manual');
    if (!arquivo) throw new HttpError(500, 'Nao foi possivel criar o backup.');
    return json(res, 200, { ok: true, arquivo: path.basename(arquivo) });
  }

  if (rota === '/api/seed' && metodo === 'POST') {
    dadosExemplo();
    return json(res, 200, { ok: true });
  }

  if (rota === '/api/reset' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    if (String(corpo.confirm || '') !== 'APAGAR') {
      throw new HttpError(400, 'Confirmacao invalida. Envie confirm = APAGAR.');
    }
    db.exec('DELETE FROM vendas; DELETE FROM leads; DELETE FROM fixos; DELETE FROM metas;');
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('leads', 'vendas');");
    return json(res, 200, { ok: true });
  }

  if (rota === '/api/dashboard' && metodo === 'GET') {
    const mes = mesISO(url.searchParams.get('mes')) || hojeISO().slice(0, 7);
    return json(res, 200, { ok: true, dash: dashboard(mes) });
  }

  throw new HttpError(404, 'Rota nao encontrada.');
}

// ---------------------------------------------------------------------------
// Arquivos estaticos
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function cabecalhosSeguranca(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  );
}

function servirEstatico(req, res, rota) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { erro: 'Metodo nao permitido.' });
  }
  const relativo = rota === '/' ? '/index.html' : rota;
  const destino = path.resolve(path.join(PUBLIC_DIR, relativo));
  if (!destino.startsWith(path.resolve(PUBLIC_DIR) + path.sep)) {
    return json(res, 404, { erro: 'Arquivo nao encontrado.' });
  }
  fs.readFile(destino, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nao encontrado');
    }
    const ext = path.extname(destino).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': conteudo.length,
      'Cache-Control': ext === '.html' ? 'no-store' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    return res.end(conteudo);
  });
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

let portaAtual = PORTA_BASE;

const servidor = http.createServer(async (req, res) => {
  cabecalhosSeguranca(res);
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return json(res, 400, { erro: 'Requisicao invalida.' });
  }

  try {
    if (url.pathname.startsWith('/api/')) {
      await tratarApi(req, res, url);
    } else {
      servirEstatico(req, res, decodeURIComponent(url.pathname));
    }
  } catch (erro) {
    if (!(erro instanceof HttpError)) log('ERRO', erro && erro.stack ? erro.stack : String(erro));
    if (!res.headersSent) {
      json(res, erro instanceof HttpError ? erro.status : 500, {
        erro: erro instanceof HttpError ? erro.message : 'Erro interno do servidor.',
      });
    } else {
      res.end();
    }
  }
});

function abrirNavegador(url) {
  try {
    let filho;
    if (process.platform === 'win32') {
      filho = spawn('cmd.exe', ['/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
    } else if (process.platform === 'darwin') {
      filho = spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      filho = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    if (filho && typeof filho.unref === 'function') filho.unref();
    log('Abrindo navegador em ' + url);
  } catch (erro) {
    log('Nao foi possivel abrir o navegador:', erro.message);
  }
}

async function instanciaExistente(porta) {
  try {
    const resposta = await fetch('http://127.0.0.1:' + porta + '/api/health', {
      signal: AbortSignal.timeout(800),
    });
    if (!resposta.ok) return false;
    const dados = await resposta.json();
    return dados && dados.app === 'crm-closer';
  } catch {
    return false;
  }
}

function tentarEscutar(porta) {
  return new Promise((resolve) => {
    const aoFalhar = () => resolve(false);
    servidor.once('error', aoFalhar);
    servidor.listen(porta, '0.0.0.0', () => {
      servidor.removeListener('error', aoFalhar);
      resolve(true);
    });
  });
}

async function iniciar() {
  for (let porta = PORTA_BASE; porta < PORTA_BASE + 10; porta += 1) {
    if (await instanciaExistente(porta)) {
      const url = 'http://127.0.0.1:' + porta;
      const rede = lanUrls(porta);
      log('CRM ja esta rodando em ' + url);
      try {
        fs.writeFileSync(path.join(DB_DIR, 'url.txt'), [url, ...rede].join('\r\n') + '\r\n');
      } catch { /* ignora */ }
      if (ABRIR_NAVEGADOR) {
        abrirNavegador(url);
        setTimeout(() => process.exit(0), 700);
      } else {
        process.exit(0);
      }
      return;
    }
    const livre = await tentarEscutar(porta);
    if (livre) {
      portaAtual = porta;
      try {
        fs.writeFileSync(PID_FILE, String(process.pid));
      } catch { /* ignora */ }
      const local = 'http://127.0.0.1:' + porta;
      const rede = lanUrls(porta);
      log('CRM Closer iniciado em ' + local + (process.env.PORT ? ' (PORT definido)' : ''));
      for (const u of rede) log('Acesso na rede local: ' + u);
      try {
        fs.writeFileSync(path.join(DB_DIR, 'url.txt'), [local, ...rede].join('\r\n') + '\r\n');
      } catch { /* ignora */ }
      if (ABRIR_NAVEGADOR) {
        setTimeout(() => abrirNavegador(local), 400);
      }
      return;
    }
  }
  console.error('Nao foi possivel iniciar: portas ' + PORTA_BASE + '-' + (PORTA_BASE + 9) + ' ocupadas.');
  process.exit(1);
}

function limparPid() {
  try {
    if (fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch { /* ignora */ }
}

function encerrar() {
  limparPid();
  try {
    db.close();
  } catch { /* ignora */ }
  process.exit(0);
}

process.on('exit', limparPid);
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

iniciar();
