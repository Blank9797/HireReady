// ── HireReady: logica applicativa ───────────────────────────────────────
'use strict';

const LS_KEY = 'colloquio_sim_v1';

function freshState() {
  return {
    setup: { posizione: '', livello: 'Junior', cv: '', annuncio: '', lingua: 'it', stile: 'neutro', nCon: N_DOMANDE.conoscitivo, nTec: N_DOMANDE.tecnico, model: '', tts: false },
    profili: [], sessions: [], activeId: null, seq: 1,
  };
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.setup && Array.isArray(s.sessions)) {
        // migrazione da versioni precedenti
        const d = freshState().setup;
        s.setup = { ...d, ...s.setup };
        s.profili = s.profili || [];
        return s;
      }
    }
  } catch (e) { /* stato corrotto: si riparte puliti */ }
  return freshState();
}
let state = loadState();
const save = () => localStorage.setItem(LS_KEY, JSON.stringify(state));

// ── Helper ──
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fmtD = ts => new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDshort = ts => new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const fmtDT = ts => new Date(ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const activeSession = () => state.sessions.find(s => s.id === state.activeId) || null;
const getSession = id => state.sessions.find(s => s.id === id) || null;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

const scoreColor = p => p >= SOGLIA ? 'var(--good)' : p >= 40 ? 'var(--warn)' : 'var(--crit)';
const scoreText  = p => p >= SOGLIA ? 'var(--good-text)' : p >= 40 ? 'var(--warn-text)' : 'var(--crit-text)';

function parseJSON(text) {
  if (!text) return null;
  let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}
const asList = x => Array.isArray(x) ? x.map(String).filter(Boolean) : [];
function normalizeEval(j, listKeys) {
  if (!j) return null;
  let p = Number(j.punteggio);
  if (!Number.isFinite(p)) return null;
  p = Math.max(0, Math.min(100, Math.round(p)));
  const esito = /scart/i.test(String(j.esito)) || p < SOGLIA ? 'scartato' : 'superato';
  const out = { punteggio: p, esito };
  for (const k of listKeys) out[k] = asList(j[k]);
  out.motivazione = String(j.motivazione || j.feedback || '').trim();
  if (Array.isArray(j.dettaglio)) {
    out.dettaglio = j.dettaglio.filter(d => d && (d.domanda || d.commento)).map(d => ({
      domanda: String(d.domanda || '').trim(),
      voto: Number.isFinite(Number(d.voto)) ? Math.max(0, Math.min(10, Math.round(Number(d.voto)))) : null,
      commento: String(d.commento || '').trim(),
      risposta_modello: String(d.risposta_modello || '').trim(),
    }));
  }
  return out;
}

// ── Client Ollama ──
const AI = { ok: false, base: null, models: [], err: 'Verifica in corso…' };

async function checkOllama() {
  for (const b of ['http://localhost:11434', 'http://127.0.0.1:11434']) {
    try {
      const res = await fetch(`${b}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data.models)) continue;
      AI.base = b;
      AI.models = data.models.map(m => m.name);
      AI.ok = AI.models.length > 0;
      AI.err = AI.ok ? null : 'Nessun modello installato: esegui “ollama pull gemma3:4b”';
      if (!state.setup.model || !AI.models.includes(state.setup.model)) {
        state.setup.model = AI.models.find(m => m.startsWith(MODEL_PREFERITO.split(':')[0])) || AI.models[0] || '';
      }
      return;
    } catch { /* prova il prossimo indirizzo */ }
  }
  AI.ok = false;
  AI.err = 'Ollama non raggiungibile: avvia l’app di Ollama o esegui “ollama serve”';
}

async function ollamaChat(messages, { json = false, temperature = 0.7, onToken = null, model = null } = {}) {
  const body = {
    model: model || state.setup.model,
    messages,
    stream: !!onToken,
    options: { temperature, num_ctx: 8192 },
  };
  if (json) body.format = 'json';
  App.abortCtrl = new AbortController();
  const res = await fetch(`${AI.base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: App.abortCtrl.signal,
  });
  if (!res.ok) throw new Error(`Ollama ha risposto ${res.status}`);
  if (!onToken) {
    const data = await res.json();
    return data.message?.content ?? '';
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const j = JSON.parse(line);
        const t = j.message?.content || '';
        if (t) { full += t; onToken(full); }
      } catch { /* riga parziale */ }
    }
  }
  return full;
}

// Chiamata JSON con retry automatico (i modelli piccoli a volte sbagliano formato)
async function callJSONRetry(messages, normalizer, opts = {}) {
  let lastErr = null;
  for (let i = 0; i < 2; i++) {
    try {
      const txt = await ollamaChat(messages, { json: true, temperature: 0.2, ...opts });
      const j = normalizer(parseJSON(txt));
      if (j) return j;
      lastErr = new Error('risposta del modello non interpretabile');
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

function normalizeGiudice(j) {
  if (!j) return null;
  const v = Number(j.voto);
  if (!Number.isFinite(v)) return null;
  return {
    voto: Math.max(0, Math.min(10, Math.round(v))),
    commento: String(j.commento || '').trim(),
    risposta_modello: String(j.risposta_modello || '').trim(),
  };
}
function normalizeSintesi(j) {
  if (!j) return null;
  const out = {
    punti_forza: asList(j.punti_forza),
    aree_miglioramento: asList(j.aree_miglioramento),
    motivazione: String(j.feedback || j.motivazione || '').trim(),
    consigli: asList(j.consigli),
  };
  return out.motivazione || out.punti_forza.length ? out : null;
}

// Modelli distinti per i giudici, se l'utente ne ha installati altri
function juryModels() {
  const main = state.setup.model;
  const altri = AI.models.filter(m => m !== main);
  if (!altri.length) return null;
  return [main, altri[0], altri[1] || main];
}

// ── App ──
const App = {
  view: 'home',       // home | sim | storico | report
  busy: null,         // null | 'screening' | 'chat' | 'eval'
  reportId: null,
  lastError: null,
  abortCtrl: null,
  qStartTs: null,     // inizio timer risposta
  _timerInt: null,
  _prefill: null,     // testo da rimettere nell'input dopo "correggi"

  go(view) { this.view = view; this.lastError = null; render(); },
  goSim() { this.go(activeSession() ? 'sim' : 'home'); },
};

// ── Render principale ──
function render() {
  document.querySelectorAll('.nav-btn').forEach(b => {
    const v = b.dataset.view;
    b.classList.toggle('active',
      (v === 'sim' && ['home', 'sim'].includes(App.view)) ||
      (v === 'storico' && ['storico', 'report'].includes(App.view)));
  });
  const pill = $('#ai-pill');
  pill.innerHTML = AI.ok
    ? `<span class="dot ok"></span><span>AI locale attiva<br><b>${esc(state.setup.model)}</b></span>`
    : `<span class="dot ko"></span><span>${esc(AI.err || 'AI non disponibile')}</span>`;
  const v = $('#view');
  switch (App.view) {
    case 'home': v.innerHTML = renderHome(); break;
    case 'sim': v.innerHTML = renderSim(); break;
    case 'storico': v.innerHTML = renderStorico(); break;
    case 'report': v.innerHTML = renderReportView(); break;
  }
  const msgs = $('#chat-msgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
  // timer live sulla risposta
  clearInterval(App._timerInt);
  const lt = $('#live-timer');
  if (lt) {
    if (!App.qStartTs) App.qStartTs = Date.now();
    const upd = () => { const el = $('#live-timer'); if (el) el.textContent = Math.round((Date.now() - App.qStartTs) / 1000) + 's'; };
    upd();
    App._timerInt = setInterval(upd, 1000);
  }
  // testo da ripristinare nell'input (correggi risposta)
  if (App._prefill != null) {
    const ta = $('#chat-input');
    if (ta && !ta.disabled) { ta.value = App._prefill; ta.focus(); }
    App._prefill = null;
  }
}

// ── Home / setup ──
function renderHome() {
  const s = state.setup;
  const act = activeSession();
  const ripresa = act && act.fase !== 'report' ? `<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><b>Simulazione in corso:</b> ${esc(act.posizione)} (${esc(act.livello)}) — fase ${esc(faseLabel(act.fase))}</div>
      <div style="display:flex;gap:8px">
        <button class="btn small" onclick="App.go('sim')">Riprendi</button>
        <button class="btn small ghost" onclick="App.abbandona()">Abbandona</button>
      </div>
    </div>` : '';
  const livOpts = LIVELLI.map(l => `<option ${s.livello === l ? 'selected' : ''}>${l}</option>`).join('');
  const modOpts = AI.models.map(m => `<option ${s.model === m ? 'selected' : ''}>${m}</option>`).join('');
  const stileOpts = Object.entries(STILI).map(([k, v]) => `<option value="${k}" ${s.stile === k ? 'selected' : ''}>${v.label}</option>`).join('');
  const lingOpts = Object.entries(LINGUE).map(([k, v]) => `<option value="${k}" ${s.lingua === k ? 'selected' : ''}>${v}</option>`).join('');
  const nOpts = n => Array.from({ length: 8 }, (_, i) => i + 3).map(x => `<option ${x === n ? 'selected' : ''}>${x}</option>`).join('');
  const profOpts = state.profili.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
  const aiWarn = !AI.ok ? `<div class="card" style="margin-bottom:16px;border-color:var(--crit)">
      <b style="color:var(--crit-text)">⚠️ ${esc(AI.err || 'AI non disponibile')}</b>
      <div class="hint" style="margin-top:6px">L’app usa un LLM locale via Ollama (gratuito, nessun dato esce dal tuo computer).
      Installa Ollama da ollama.com, poi esegui <code>ollama pull gemma3:4b</code>.</div>
      <button class="btn small ghost" style="margin-top:10px" onclick="App.retryAI()">🔄 Riprova connessione</button>
    </div>` : '';
  const profili = state.profili.length ? `<div class="prof-row">
      <select id="prof-select">${profOpts}</select>
      <button type="button" class="btn small ghost" onclick="App.caricaProfilo()">📂 Carica</button>
      <button type="button" class="btn small ghost" style="color:var(--crit-text)" onclick="App.eliminaProfilo()">🗑</button>
    </div>` : '';
  return `<div class="view-head">
    <div><h1>Preparati al colloquio</h1>
    <div class="sub">Un recruiter AI (in locale) simula il vero processo di selezione: può scartarti a ogni fase, proprio come nella realtà.</div></div>
  </div>
  ${ripresa}${aiWarn}
  <div class="how-grid">
    <div class="how"><span class="h-icon">📄</span><b>1 · Screening CV</b>L’AI confronta il tuo CV con posizione, livello e annuncio. Se non sei in linea, sei fuori — con i consigli per sistemarlo.</div>
    <div class="how"><span class="h-icon">💬</span><b>2 · Colloquio conoscitivo</b>Domande su motivazione, percorso e soft skill. Rispondi in chat (o a voce) come in un vero colloquio.</div>
    <div class="how"><span class="h-icon">🧪</span><b>3 · Colloquio tecnico</b>Domande tecniche calibrate su posizione e livello, con eventuali approfondimenti.</div>
    <div class="how"><span class="h-icon">🏁</span><b>4 · Report finale</b>Punteggi, feedback domanda per domanda con risposte modello, consigli per quello vero.</div>
  </div>
  <form class="card" onsubmit="App.startSim(event)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <h2 style="margin:0">La tua candidatura</h2>${profili}
    </div>
    <div class="setup-grid">
      <div><label>Per quale posizione ti stai candidando? *</label>
        <input name="posizione" required placeholder="es. Sviluppatore Frontend React, Data Analyst, Store Manager…" value="${esc(s.posizione)}"></div>
      <div><label>Livello *</label><select name="livello">${livOpts}</select></div>
    </div>
    <div class="setup-grid4">
      <div><label>Stile recruiter</label><select name="stile">${stileOpts}</select></div>
      <div><label>Lingua colloquio</label><select name="lingua">${lingOpts}</select></div>
      <div><label>Domande conoscitivo</label><select name="nCon">${nOpts(s.nCon)}</select></div>
      <div><label>Domande tecnico</label><select name="nTec">${nOpts(s.nTec)}</select></div>
    </div>
    <label>Annuncio di lavoro (consigliato: rende screening e domande molto più mirati)</label>
    <textarea name="annuncio" class="annuncio" placeholder="Incolla qui il testo dell’annuncio: requisiti, responsabilità, tecnologie richieste…">${esc(s.annuncio)}</textarea>
    <label>Il tuo CV *</label>
    <div class="cv-tools">
      <button type="button" class="btn small ghost" onclick="document.getElementById('cv-pdf').click()">📎 Carica da PDF</button>
      <span class="hint">oppure trascina il PDF sul riquadro, oppure incolla il testo</span>
    </div>
    <textarea name="cv" id="cv-text" class="cv" required placeholder="Incolla il testo del tuo CV: esperienze, formazione, competenze…"
      ondragover="event.preventDefault();this.classList.add('drop-hover')"
      ondragleave="this.classList.remove('drop-hover')"
      ondrop="App.dropCv(event)">${esc(s.cv)}</textarea>
    <div class="hint">Tutto resta sul tuo computer: l’AI gira in locale, niente cloud.</div>
    ${AI.models.length > 1 ? `<label>Modello AI</label><select onchange="App.setModel(this.value)">${modOpts}</select>` : ''}
    <div class="actions-bar">
      <button type="submit" class="btn" ${AI.ok ? '' : 'disabled'}>🚀 Inizia la simulazione</button>
      <button type="button" class="btn ghost" onclick="App.salvaProfilo(event)">💾 Salva come profilo</button>
    </div>
  </form>`;
}

App.retryAI = async () => { AI.err = 'Verifica in corso…'; render(); await checkOllama(); render(); };
App.setModel = m => { state.setup.model = m; save(); render(); };

function leggiSetupForm() {
  const form = $('#view form');
  if (!form) return;
  const f = new FormData(form);
  Object.assign(state.setup, {
    posizione: (f.get('posizione') || '').trim(),
    livello: f.get('livello') || 'Junior',
    stile: f.get('stile') || 'neutro',
    lingua: f.get('lingua') || 'it',
    nCon: +f.get('nCon') || N_DOMANDE.conoscitivo,
    nTec: +f.get('nTec') || N_DOMANDE.tecnico,
    annuncio: (f.get('annuncio') || '').trim(),
    cv: (f.get('cv') || '').trim(),
  });
}

// ── Profili ──
App.salvaProfilo = () => {
  leggiSetupForm();
  if (!state.setup.posizione) { toast('Compila almeno la posizione'); return; }
  const nome = prompt('Nome del profilo:', state.setup.posizione + ' (' + state.setup.livello + ')');
  if (!nome) return;
  const { posizione, livello, cv, annuncio, lingua, stile, nCon, nTec } = state.setup;
  state.profili.push({ id: 'p' + (state.seq++), nome: nome.trim(), posizione, livello, cv, annuncio, lingua, stile, nCon, nTec });
  save(); render();
  toast('Profilo salvato');
};
App.caricaProfilo = () => {
  const p = state.profili.find(x => x.id === $('#prof-select')?.value);
  if (!p) return;
  const { id, nome, ...dati } = p;
  Object.assign(state.setup, dati);
  save(); render();
  toast(`Profilo “${p.nome}” caricato`);
};
App.eliminaProfilo = () => {
  const sel = $('#prof-select');
  const p = state.profili.find(x => x.id === sel?.value);
  if (!p || !confirm(`Eliminare il profilo “${p.nome}”?`)) return;
  state.profili = state.profili.filter(x => x.id !== p.id);
  save(); render();
};

// ── CV da PDF ──
async function extractPdfText(data) {
  if (!window.pdfjsLib) throw new Error('pdf.js non caricato');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items.map(i => i.str).join(' '));
  }
  return pages.join('\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}
async function caricaCvPdf(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { toast('Serve un file PDF'); return; }
  toast('Estraggo il testo dal PDF…');
  try {
    const text = await extractPdfText(await file.arrayBuffer());
    if (!text) { toast('PDF senza testo estraibile (è una scansione?)'); return; }
    const ta = $('#cv-text');
    if (ta) ta.value = text;
    state.setup.cv = text;
    save();
    toast(`CV estratto: ${text.length} caratteri ✓`);
  } catch (e) {
    toast('Errore nella lettura del PDF');
  }
}
App.handleCvPdf = ev => { caricaCvPdf(ev.target.files[0]); ev.target.value = ''; };
App.dropCv = ev => {
  ev.preventDefault();
  ev.target.classList.remove('drop-hover');
  caricaCvPdf(ev.dataTransfer.files[0]);
};

// ── Avvio simulazione ──
App.startSim = ev => {
  ev.preventDefault();
  leggiSetupForm();
  const s = state.setup;
  if (s.cv.length < 150 && !confirm('Il CV sembra molto corto: lo screening sarà poco affidabile. Continuare lo stesso?')) return;
  const sess = {
    id: 's' + (state.seq++), ts: Date.now(),
    posizione: s.posizione, livello: s.livello, cv: s.cv,
    annuncio: s.annuncio, lingua: s.lingua, stile: s.stile,
    nDomande: { conoscitivo: s.nCon, tecnico: s.nTec },
    fase: 'screening',
    screening: null,
    conoscitivo: null, tecnico: null,
    esitoFinale: null,
  };
  state.sessions.push(sess);
  state.activeId = sess.id;
  save();
  App.view = 'sim';
  render();
  runScreening();
};

App.abbandona = () => {
  const s = activeSession();
  if (!s) return;
  if (!confirm('Abbandonare la simulazione in corso? (la ritrovi nello Storico)')) return;
  speechSynthesis?.cancel?.();
  state.activeId = null;
  save(); App.go('home');
};

// ── Vista simulazione ──
const faseLabel = f => FASI.find(x => x.id === f)?.label ?? f;

function renderStepper(sess) {
  const order = ['screening', 'conoscitivo', 'tecnico', 'report'];
  const cur = order.indexOf(sess.fase);
  return `<div class="stepper">` + FASI.map((f, i) => {
    let cls = '', extra = '';
    const val = f.id === 'screening' ? sess.screening : sess[f.id]?.valutazione;
    if (val) {
      cls = val.esito === 'superato' ? 'done' : 'failed';
      extra = `<span class="s-score">${val.punteggio}</span>`;
    } else if (i === cur) cls = 'active';
    return `<div class="step ${cls}">${f.icon} ${f.label} ${extra}</div>`;
  }).join('') + `</div>`;
}

function renderSim() {
  const sess = activeSession();
  if (!sess) { App.view = 'home'; return renderHome(); }
  let body = '';
  if (App.lastError) {
    body = `<div class="card"><b style="color:var(--crit-text)">⚠️ Errore AI:</b> ${esc(App.lastError)}
      <div class="actions-bar"><button class="btn" onclick="App.retryPhase()">🔄 Riprova</button></div></div>`;
  } else if (sess.fase === 'screening') body = renderScreening(sess);
  else if (sess.fase === 'conoscitivo' || sess.fase === 'tecnico') body = renderIntervista(sess, sess.fase);
  else body = renderReport(sess);
  const meta = [sess.livello, STILI[sessStile(sess)].label.replace(/^\S+\s/, ''), sessLingua(sess) === 'en' ? 'in inglese' : null]
    .filter(Boolean).join(' · ');
  return `<div class="view-head">
    <div><h1>${esc(sess.posizione)} <span style="color:var(--muted);font-weight:600;font-size:16px">· ${esc(meta)}</span></h1>
    <div class="sub">Simulazione del ${fmtD(sess.ts)}</div></div>
    <button class="btn ghost small" onclick="App.abbandona()">Abbandona</button>
  </div>
  ${renderStepper(sess)}
  ${body}`;
}

// ── Fase 1: screening ──
function renderScreening(sess) {
  if (App.busy === 'screening' || !sess.screening) {
    return `<div class="card phase-loading">
      <div class="spinner"></div>
      Il recruiter AI sta analizzando il tuo CV rispetto alla posizione
      <b>${esc(sess.posizione)}</b> (${esc(sess.livello)})${sessAnnuncio(sess) ? ' e all’annuncio' : ''}…
      <div class="hint" style="margin-top:6px">Con un modello locale può volerci qualche decina di secondi.</div>
    </div>`;
  }
  const r = sess.screening;
  const ok = r.esito === 'superato';
  return `<div class="card">
    <h2>Esito dello screening CV</h2>
    <div class="score-row">
      <div class="score-big" style="color:${scoreText(r.punteggio)}">${r.punteggio}<small>/100</small></div>
      <div class="score-track"><div class="score-fill" style="width:${r.punteggio}%;background:${scoreColor(r.punteggio)}"></div></div>
      <span class="badge ${ok ? 'ok' : 'bad'}">${ok ? '✓ CV in linea' : '✕ Scartato'}</span>
    </div>
    <div class="feedback-box">${esc(r.motivazione)}</div>
    <div class="eval-lists">
      <div><div class="eval-h ok">Punti in linea</div><ul>${r.punti_in_linea.map(x => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul></div>
      <div><div class="eval-h bad">Lacune rispetto alla posizione</div><ul>${r.lacune.map(x => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul></div>
    </div>
    ${r.consigli_cv.length ? `<div style="margin-top:12px"><div class="eval-h blue">Consigli per migliorare il CV</div>
      <ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2)">${r.consigli_cv.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="actions-bar">
      ${ok ? `<button class="btn good" onclick="App.avviaIntervista('conoscitivo')">💬 Inizia il colloquio conoscitivo</button>`
           : `<button class="btn" onclick="App.rifaiScreening()">✏️ Modifica il CV e riprova</button>`}
      <button class="btn ghost" onclick="App.chiudiSim()">Chiudi e vai al report</button>
    </div>
  </div>`;
}

async function runScreening() {
  const sess = activeSession();
  if (!sess || App.busy) return;
  App.busy = 'screening'; App.lastError = null;
  render();
  try {
    const j = await callJSONRetry(buildScreeningMessages(sess), x => normalizeEval(x, ['punti_in_linea', 'lacune', 'consigli_cv']));
    sess.screening = j;
    if (j.esito === 'scartato') sess.esitoFinale = 'scartato_screening';
    save();
  } catch (e) {
    if (e.name !== 'AbortError') App.lastError = e.message || String(e);
  }
  App.busy = null;
  render();
}

App.rifaiScreening = () => {
  const sess = activeSession();
  Object.assign(state.setup, {
    cv: sess.cv, posizione: sess.posizione, livello: sess.livello,
    annuncio: sess.annuncio || '', lingua: sessLingua(sess), stile: sessStile(sess),
  });
  state.activeId = null;
  save(); App.go('home');
  toast('Modifica il CV e avvia una nuova simulazione');
};

App.retryPhase = () => {
  const sess = activeSession();
  App.lastError = null;
  if (!sess) return App.go('home');
  if (sess.fase === 'screening') { sess.screening = null; save(); render(); runScreening(); }
  else {
    const fase = sess[sess.fase];
    if (!fase.valutazione) {
      const nAns = fase.transcript.filter(m => m.role === 'user').length;
      if (nAns >= sessN(sess, sess.fase) || fase._evalPending) valuta(sess.fase);
      else nextTurno(sess.fase);
    } else render();
  }
};

// ── Fasi 2-3: interviste in chat ──
App.avviaIntervista = tipo => {
  const sess = activeSession();
  sess.fase = tipo;
  if (!sess[tipo]) sess[tipo] = { transcript: [], valutazione: null, _evalPending: false };
  save(); render();
  nextTurno(tipo);
};

function renderIntervista(sess, tipo) {
  const fase = sess[tipo];
  if (fase.valutazione) return renderValutazione(sess, tipo);
  const nTot = sessN(sess, tipo);
  const nAns = fase.transcript.filter(m => m.role === 'user').length;
  if (App.busy === 'eval' || fase._evalPending) {
    return `<div class="card phase-loading"><div class="spinner"></div>
      Colloquio concluso: la giuria (${GIUDICI.length} giudici indipendenti) sta valutando le tue risposte…
      <div class="hint" style="margin-top:8px"><b id="eval-progress">Preparazione…</b></div>
      <div class="hint" style="margin-top:4px">Ogni risposta viene votata da HR, esperto tecnico e hiring manager: può richiedere 1-2 minuti.</div></div>`;
  }
  const bubbles = fase.transcript.map(m => `<div class="bubble ${m.role === 'assistant' ? 'ai' : 'me'}">
      <span class="b-who">${m.role === 'assistant' ? '🧑‍💼 Recruiter' : '🙋 Tu'}${m.tempo ? ` <span class="b-time">⏱ ${m.tempo}s</span>` : ''}</span>${esc(m.content)}</div>`).join('');
  const typing = App.busy === 'chat'
    ? `<div class="bubble ai"><span class="b-who">🧑‍💼 Recruiter</span><span id="stream-bubble"></span><span class="typing"><i></i><i></i><i></i></span></div>` : '';
  const last = fase.transcript.at(-1);
  const needResume = !App.busy && (fase.transcript.length === 0 || last?.role === 'user');
  const resume = needResume
    ? `<div style="text-align:center;padding:8px"><button class="btn" onclick="nextTurno('${tipo}')">▶️ ${fase.transcript.length ? 'Continua il colloquio' : 'Fai iniziare il recruiter'}</button></div>` : '';
  const canWrite = !App.busy && last?.role === 'assistant';
  const sttOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  // strumenti sopra l'input
  const tools = [];
  if (App.busy === 'chat') tools.push(`<button class="btn small ghost" onclick="App.stopGen()">⏹ Ferma</button>`);
  if (!App.busy && last?.role === 'assistant')
    tools.push(`<button class="btn small ghost" onclick="App.rigenera('${tipo}')">🔄 Rigenera domanda</button>`);
  if (!App.busy && fase.transcript.some(m => m.role === 'user'))
    tools.push(`<button class="btn small ghost" onclick="App.correggi('${tipo}')">✏️ Correggi ultima risposta</button>`);
  return `<div class="card chat-card">
    <div class="chat-head">
      <div><div class="ch-title">${tipo === 'tecnico' ? '🧪 Colloquio tecnico' : '💬 Colloquio conoscitivo'}</div>
      <div class="ch-sub">domanda ${Math.min(nAns + 1, nTot)} di ~${nTot}${canWrite ? ` · <b>⏱ <span id="live-timer">0s</span></b>` : ''}</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn small ghost ${state.setup.tts ? 'tts-on' : ''}" onclick="App.toggleTts()" title="Il recruiter legge le domande a voce alta">${state.setup.tts ? '🔊' : '🔇'} Voce</button>
        ${nAns >= 1 && !App.busy ? `<button class="btn small ghost" onclick="valuta('${tipo}')">🏁 Termina e valuta ora</button>` : ''}
      </div>
    </div>
    <div class="chat-msgs" id="chat-msgs">${bubbles}${typing}${resume}</div>
    ${tools.length ? `<div class="chat-tools">${tools.join('')}</div>` : ''}
    <div class="chat-input">
      ${sttOk ? `<button class="mic-btn" id="mic-btn" title="Rispondi a voce (dettatura del browser: può usare servizi cloud)" ${canWrite ? '' : 'disabled'} onclick="App.toggleMic()">🎙️</button>` : ''}
      <textarea id="chat-input" placeholder="${canWrite ? 'Scrivi (o detta col microfono) la tua risposta… Invio per inviare' : 'Attendi la domanda del recruiter…'}"
        ${canWrite ? '' : 'disabled'} onkeydown="App.chatKey(event,'${tipo}')"></textarea>
      <button class="btn" ${canWrite ? '' : 'disabled'} onclick="App.sendRisposta('${tipo}')">Invia</button>
    </div>
  </div>`;
}

App.chatKey = (ev, tipo) => {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); App.sendRisposta(tipo); }
};
App.sendRisposta = tipo => {
  const ta = $('#chat-input');
  const text = (ta?.value || '').trim();
  if (!text || App.busy) return;
  stopMic();
  const sess = activeSession();
  const fase = sess[tipo];
  const msg = { role: 'user', content: text };
  if (App.qStartTs) { msg.tempo = Math.max(1, Math.round((Date.now() - App.qStartTs) / 1000)); App.qStartTs = null; }
  fase.transcript.push(msg);
  save();
  const nAns = fase.transcript.filter(m => m.role === 'user').length;
  if (nAns >= sessN(sess, tipo)) valuta(tipo);
  else nextTurno(tipo);
};

App.stopGen = () => { App.abortCtrl?.abort(); };
App.rigenera = tipo => {
  const fase = activeSession()[tipo];
  if (fase.transcript.at(-1)?.role !== 'assistant') return;
  fase.transcript.pop();
  save();
  nextTurno(tipo);
};
App.correggi = tipo => {
  const fase = activeSession()[tipo];
  const t = fase.transcript;
  if (t.at(-1)?.role === 'assistant' && t.at(-2)?.role === 'user') t.pop();
  if (t.at(-1)?.role !== 'user') return;
  App._prefill = t.pop().content;
  App.qStartTs = null;
  save(); render();
};

async function nextTurno(tipo) {
  const sess = activeSession();
  if (!sess || App.busy) return;
  const fase = sess[tipo];
  App.busy = 'chat'; App.lastError = null;
  render();
  try {
    const messages = [{ role: 'system', content: buildIntervistaSystem(tipo, sess) }, ...fase.transcript];
    const content = await ollamaChat(messages, {
      temperature: 0.7,
      onToken: full => {
        const el = $('#stream-bubble');
        if (el) { el.textContent = full; const m = $('#chat-msgs'); if (m) m.scrollTop = m.scrollHeight; }
      },
    });
    fase.transcript.push({ role: 'assistant', content: content.trim() });
    App.qStartTs = Date.now();
    save();
    speak(content.trim(), sessLingua(sess));
  } catch (e) {
    if (e.name !== 'AbortError') App.lastError = e.message || String(e);
  }
  App.busy = null;
  render();
  const ta = $('#chat-input');
  if (ta && !ta.disabled) ta.focus();
}

const evalProg = txt => { const el = $('#eval-progress'); if (el) el.textContent = txt; };
const shortQ = q => q.length > 110 ? q.slice(0, 107).trimEnd() + '…' : q;

async function valuta(tipo) {
  const sess = activeSession();
  if (!sess || App.busy) return;
  const fase = sess[tipo];
  App.busy = 'eval'; App.lastError = null;
  fase._evalPending = true;
  stopMic(); speechSynthesis?.cancel?.();
  save(); render();
  try {
    // coppie domanda → risposta dalla trascrizione
    const qa = [];
    let lastQ = null;
    for (const m of fase.transcript) {
      if (m.role === 'assistant') lastQ = m.content;
      else if (m.role === 'user') qa.push({ domanda: lastQ || '(domanda non registrata)', risposta: m.content, tempo: m.tempo });
    }
    if (!qa.length) throw new Error('nessuna risposta da valutare');
    const modelli = juryModels();
    const dettaglio = [];
    for (let i = 0; i < qa.length; i++) {
      const giudici = [];
      let rispostaModello = '';
      for (let j = 0; j < GIUDICI.length; j++) {
        const g = GIUDICI[j];
        evalProg(`Domanda ${i + 1}/${qa.length} — ${g.icona} ${g.nome} sta valutando…`);
        const model = modelli ? modelli[j] : null;
        try {
          const v = await callJSONRetry(
            buildGiudiceMessages(g, tipo, sess, qa[i].domanda, qa[i].risposta, qa[i].tempo),
            normalizeGiudice, { temperature: g.temp, model });
          giudici.push({ nome: g.nome, icona: g.icona, voto: v.voto, commento: v.commento, modello: model || undefined });
          if (g.conModello && v.risposta_modello) rispostaModello = v.risposta_modello;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          // giudice non pervenuto: la giuria prosegue con gli altri
        }
      }
      if (!giudici.length) throw new Error('la giuria non è riuscita a valutare (il modello non risponde)');
      const voti = giudici.map(g => g.voto).sort((a, b) => a - b);
      const mediana = voti[Math.floor(voti.length / 2)];
      const accordo = giudici.length > 1 ? (voti[voti.length - 1] - voti[0] <= 2 ? 'unanime' : 'divisa') : null;
      dettaglio.push({ domanda: shortQ(qa[i].domanda), voto: mediana, giudici, accordo, risposta_modello: rispostaModello });
    }
    const punteggio = Math.round(dettaglio.reduce((a, d) => a + d.voto, 0) / dettaglio.length * 10);
    const esito = punteggio >= SOGLIA ? 'superato' : 'scartato';
    evalProg('Il portavoce della giuria scrive il verdetto…');
    let sintesi = null;
    try {
      sintesi = await callJSONRetry(buildSintesiMessages(tipo, sess, dettaglio), normalizeSintesi);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      // sintesi fallita: si usa un verdetto minimale, i voti restano validi
    }
    fase.valutazione = {
      punteggio, esito, giuria: giudici_label(modelli),
      punti_forza: sintesi?.punti_forza || [],
      aree_miglioramento: sintesi?.aree_miglioramento || [],
      motivazione: sintesi?.motivazione || `La giuria assegna una mediana complessiva di ${punteggio}/100 sulle ${dettaglio.length} risposte valutate.`,
      consigli: sintesi?.consigli || [],
      dettaglio,
    };
    fase._evalPending = false;
    if (esito === 'scartato') sess.esitoFinale = 'scartato_' + tipo;
    else if (tipo === 'tecnico') sess.esitoFinale = 'promosso';
    save();
  } catch (e) {
    if (e.name !== 'AbortError') App.lastError = e.message || String(e);
  }
  App.busy = null;
  render();
}
const giudici_label = modelli => modelli ? `${GIUDICI.length} giudici · ${new Set(modelli).size} modelli` : `${GIUDICI.length} giudici`;

// ── Voce: dettatura e sintesi ──
let recog = null;
function stopMic() { try { recog?.stop(); } catch {} recog = null; $('#mic-btn')?.classList.remove('rec'); }
App.toggleMic = () => {
  if (recog) { stopMic(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Dettatura non supportata da questo browser'); return; }
  const sess = activeSession();
  recog = new SR();
  recog.lang = sessLingua(sess) === 'en' ? 'en-US' : 'it-IT';
  recog.continuous = true;
  recog.interimResults = true;
  const ta = $('#chat-input');
  const base = ta ? ta.value : '';
  recog.onresult = e => {
    let txt = '';
    for (const r of e.results) txt += r[0].transcript;
    if (ta) ta.value = (base + ' ' + txt).replace(/\s+/g, ' ').trimStart();
  };
  recog.onerror = () => { stopMic(); toast('Dettatura interrotta'); };
  recog.onend = () => { recog = null; $('#mic-btn')?.classList.remove('rec'); };
  recog.start();
  $('#mic-btn')?.classList.add('rec');
  toast('🎙️ Sto ascoltando… ripremi per fermare');
};
App.toggleTts = () => {
  state.setup.tts = !state.setup.tts;
  if (!state.setup.tts) speechSynthesis?.cancel?.();
  save(); render();
};
function speak(text, lingua) {
  if (!state.setup.tts || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lingua === 'en' ? 'en-US' : 'it-IT';
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

// ── Valutazione fase ──
function renderDettaglio(det) {
  if (!det?.length) return '';
  return `<div style="margin-top:14px"><div class="eval-h blue">Feedback domanda per domanda</div>
  ${det.map((d, i) => {
    const juryRow = d.giudici?.length ? `<div class="jury-row">
        ${d.giudici.map(g => `<span class="jury-chip" title="${esc(g.nome)}${g.modello ? ' · ' + esc(g.modello) : ''}">${g.icona} ${g.voto}/10</span>`).join('')}
        ${d.accordo ? `<span class="badge ${d.accordo === 'unanime' ? 'ok' : 'warn'}">giuria ${d.accordo}</span>` : ''}
      </div>` : '';
    const commenti = d.giudici?.length
      ? d.giudici.map(g => `<p><b>${g.icona} ${esc(g.nome)}${g.modello ? ` <span class="jm">(${esc(g.modello)})</span>` : ''} — ${g.voto}/10:</b> ${esc(g.commento)}</p>`).join('')
      : (d.commento ? `<p>${esc(d.commento)}</p>` : '');
    return `<details class="q-det">
    <summary><span class="qd-num">${i + 1}.</span> ${esc(d.domanda || 'Domanda ' + (i + 1))}
      ${d.voto != null ? `<span class="badge ${d.voto >= 6 ? 'ok' : d.voto >= 4 ? 'warn' : 'bad'}">${d.voto}/10</span>` : ''}
      ${d.accordo === 'divisa' ? '<span class="badge warn">⚖️ divisa</span>' : ''}</summary>
    <div class="qd-body">
      ${juryRow}${commenti}
      ${d.risposta_modello ? `<p class="qd-model"><b>💡 Risposta modello:</b> ${esc(d.risposta_modello)}</p>` : ''}
    </div>
  </details>`;
  }).join('')}</div>`;
}

function renderValutazione(sess, tipo) {
  const v = sess[tipo].valutazione;
  const ok = v.esito === 'superato';
  const isCon = tipo === 'conoscitivo';
  const azioni = ok
    ? (isCon
      ? `<button class="btn good" onclick="App.avviaIntervista('tecnico')">🧪 Prosegui al colloquio tecnico</button>`
      : `<button class="btn good" onclick="App.chiudiSim()">🏁 Vai al report finale</button>`)
    : `<button class="btn" onclick="App.riprovaFase('${tipo}')">🔁 Riprova questo colloquio</button>
       <button class="btn ghost" onclick="App.chiudiSim()">Chiudi e vai al report</button>`;
  return `<div class="card">
    <h2>Valutazione del colloquio ${isCon ? 'conoscitivo' : 'tecnico'}
      ${v.giuria ? `<span class="badge stage" style="margin-left:6px">🧑‍⚖️ ${esc(v.giuria)}</span>` : ''}</h2>
    <div class="score-row">
      <div class="score-big" style="color:${scoreText(v.punteggio)}">${v.punteggio}<small>/100</small></div>
      <div class="score-track"><div class="score-fill" style="width:${v.punteggio}%;background:${scoreColor(v.punteggio)}"></div></div>
      <span class="badge ${ok ? 'ok' : 'bad'}">${ok ? '✓ Superato' : '✕ Scartato'}</span>
    </div>
    <div class="feedback-box">${esc(v.motivazione)}</div>
    <div class="eval-lists">
      <div><div class="eval-h ok">Punti di forza</div><ul>${v.punti_forza.map(x => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul></div>
      <div><div class="eval-h bad">Aree di miglioramento</div><ul>${v.aree_miglioramento.map(x => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul></div>
    </div>
    ${v.consigli.length ? `<div style="margin-top:12px"><div class="eval-h blue">Consigli per prepararti</div>
      <ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2)">${v.consigli.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${renderDettaglio(v.dettaglio)}
    ${renderTranscript(sess[tipo].transcript)}
    <div class="actions-bar">${azioni}</div>
  </div>`;
}

App.riprovaFase = tipo => {
  const sess = activeSession();
  sess[tipo] = { transcript: [], valutazione: null, _evalPending: false };
  sess.esitoFinale = null;
  sess.fase = tipo;
  save(); render();
  nextTurno(tipo);
};

App.chiudiSim = () => {
  const sess = activeSession();
  sess.fase = 'report';
  if (!sess.esitoFinale) {
    sess.esitoFinale = sess.tecnico?.valutazione?.esito === 'superato' ? 'promosso' : 'interrotta';
  }
  stopMic(); speechSynthesis?.cancel?.();
  save(); render();
};

// ── Report ──
const ESITI = {
  promosso: { label: '🎉 Processo superato: saresti passato!', cls: 'ok' },
  scartato_screening: { label: '✕ Scartato allo screening del CV', cls: 'bad' },
  scartato_conoscitivo: { label: '✕ Scartato al colloquio conoscitivo', cls: 'bad' },
  scartato_tecnico: { label: '✕ Scartato al colloquio tecnico', cls: 'bad' },
  interrotta: { label: 'Simulazione interrotta', cls: 'neutral' },
};

function renderTranscript(transcript) {
  if (!transcript?.length) return '';
  return `<details class="transcript"><summary>Rileggi la trascrizione (${transcript.length} messaggi)</summary>
    ${transcript.map(m => `<div class="tr-line"><b>${m.role === 'assistant' ? '🧑‍💼 Recruiter' : '🙋 Tu'}${m.tempo ? ` · ⏱ ${m.tempo}s` : ''}</b>${esc(m.content)}</div>`).join('')}
  </details>`;
}

function faseReport(titolo, val, listA, listB, extraKey, transcript) {
  if (!val) return `<div class="card" style="margin-bottom:14px"><h2>${titolo}</h2>
    <span style="color:var(--muted);font-size:13.5px">Fase non svolta.</span></div>`;
  const ok = val.esito === 'superato';
  return `<div class="card" style="margin-bottom:14px">
    <h2>${titolo} <span class="badge ${ok ? 'ok' : 'bad'}" style="margin-left:6px">${ok ? '✓ superato' : '✕ scartato'} · ${val.punteggio}/100</span></h2>
    <div class="feedback-box">${esc(val.motivazione)}</div>
    <div class="eval-lists">
      <div><div class="eval-h ok">${listA.label}</div><ul>${val[listA.key].map(x => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul></div>
      <div><div class="eval-h bad">${listB.label}</div><ul>${val[listB.key].map(x => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul></div>
    </div>
    ${val[extraKey]?.length ? `<div style="margin-top:12px"><div class="eval-h blue">Consigli</div>
      <ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2)">${val[extraKey].map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${renderDettaglio(val.dettaglio)}
    ${renderTranscript(transcript)}
  </div>`;
}

function renderReport(sess) {
  const e = ESITI[sess.esitoFinale] || ESITI.interrotta;
  return `<div class="card" style="margin-bottom:14px;text-align:center;padding:26px">
    <span class="badge ${e.cls}" style="font-size:15px;padding:6px 16px">${e.label}</span>
    <div class="hint" style="margin-top:8px">${esc(sess.posizione)} · ${esc(sess.livello)} · ${fmtD(sess.ts)}</div>
  </div>
  ${faseReport('📄 Screening CV', sess.screening,
    { key: 'punti_in_linea', label: 'Punti in linea' }, { key: 'lacune', label: 'Lacune' }, 'consigli_cv', null)}
  ${faseReport('💬 Colloquio conoscitivo', sess.conoscitivo?.valutazione,
    { key: 'punti_forza', label: 'Punti di forza' }, { key: 'aree_miglioramento', label: 'Aree di miglioramento' }, 'consigli', sess.conoscitivo?.transcript)}
  ${faseReport('🧪 Colloquio tecnico', sess.tecnico?.valutazione,
    { key: 'punti_forza', label: 'Punti di forza' }, { key: 'aree_miglioramento', label: 'Aree di miglioramento' }, 'consigli', sess.tecnico?.transcript)}
  <div class="actions-bar no-print">
    <button class="btn ghost" onclick="App.copiaReport('${sess.id}')">📋 Copia report</button>
    <button class="btn ghost" onclick="window.print()">🖨️ Stampa / PDF</button>
    <button class="btn" onclick="App.nuovaSim()">🚀 Nuova simulazione</button>
  </div>`;
}

function renderReportView() {
  const sess = getSession(App.reportId);
  if (!sess) { App.view = 'storico'; return renderStorico(); }
  return `<button class="btn ghost small no-print" style="margin-bottom:14px" onclick="App.go('storico')">← Storico</button>
  <div class="view-head"><div><h1>${esc(sess.posizione)} <span style="color:var(--muted);font-weight:600;font-size:16px">· ${esc(sess.livello)}</span></h1>
  <div class="sub">Report della simulazione del ${fmtDT(sess.ts)}</div></div></div>
  ${renderReport(sess)}`;
}

App.nuovaSim = () => {
  state.activeId = null;
  save(); App.go('home');
};

function reportText(sess) {
  const L = [];
  const e = ESITI[sess.esitoFinale] || ESITI.interrotta;
  L.push(`SIMULAZIONE COLLOQUIO — ${sess.posizione} (${sess.livello}) — ${fmtD(sess.ts)}`);
  L.push(`Esito: ${e.label.replace(/^[^\w]+\s*/, '')}`);
  const fase = (nome, v, a, b, c) => {
    if (!v) return;
    L.push('', `— ${nome}: ${v.punteggio}/100 (${v.esito})`, v.motivazione);
    if (v[a]?.length) L.push('Punti di forza: ' + v[a].join('; '));
    if (v[b]?.length) L.push('Da migliorare: ' + v[b].join('; '));
    if (v[c]?.length) L.push('Consigli: ' + v[c].join('; '));
    if (v.dettaglio?.length) {
      L.push('Dettaglio domande:');
      v.dettaglio.forEach((d, i) => {
        const voti = d.giudici?.length ? ` [${d.giudici.map(g => `${g.nome} ${g.voto}`).join(' · ')} → ${d.voto}/10]` : (d.voto != null ? ` [${d.voto}/10]` : '');
        L.push(`  ${i + 1}. ${d.domanda}${voti}`);
        (d.giudici || []).forEach(g => L.push(`     ${g.nome}: ${g.commento}`));
        if (!d.giudici?.length && d.commento) L.push(`     ${d.commento}`);
        if (d.risposta_modello) L.push(`     Risposta modello: ${d.risposta_modello}`);
      });
    }
  };
  fase('Screening CV', sess.screening, 'punti_in_linea', 'lacune', 'consigli_cv');
  fase('Colloquio conoscitivo', sess.conoscitivo?.valutazione, 'punti_forza', 'aree_miglioramento', 'consigli');
  fase('Colloquio tecnico', sess.tecnico?.valutazione, 'punti_forza', 'aree_miglioramento', 'consigli');
  return L.join('\n');
}
App.copiaReport = id => {
  const text = reportText(getSession(id));
  const done = () => toast('Report copiato negli appunti ✓');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  else fallbackCopy(text, done);
};
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); ta.remove(); done();
}

// ── Storico + andamento ──
const VIZ = [
  { key: 'CV',        color: 'var(--viz-1)', get: s => s.screening?.punteggio },
  { key: 'Colloquio', color: 'var(--viz-2)', get: s => s.conoscitivo?.valutazione?.punteggio },
  { key: 'Tecnico',   color: 'var(--viz-3)', get: s => s.tecnico?.valutazione?.punteggio },
];

function trendChart(group) {
  const g = [...group].sort((a, b) => a.ts - b.ts);
  const n = g.length;
  const W = 560, H = 190, pl = 34, pr = 16, pt = 12, pb = 26;
  const x = i => n === 1 ? (pl + (W - pl - pr) / 2) : pl + i * (W - pl - pr) / (n - 1);
  const y = v => pt + (100 - v) / 100 * (H - pt - pb);
  const grid = [0, 50, 100].map(v => `<line x1="${pl}" y1="${y(v)}" x2="${W - pr}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>
    <text x="${pl - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="10.5" fill="var(--muted)">${v}</text>`).join('');
  const xLabels = g.map((s, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${fmtDshort(s.ts)}</text>`).join('');
  // offset etichette per serie, per evitare collisioni quando i punti sono vicini
  const lbl = [
    p => ({ x: 0, y: -9, anchor: 'middle' }),   // CV: sopra
    p => ({ x: 0, y: 17, anchor: 'middle' }),   // Colloquio: sotto
    p => ({ x: 10, y: 4, anchor: 'start' }),    // Tecnico: a destra
  ];
  const series = VIZ.map((sr, si) => {
    const pts = g.map((s, i) => ({ i, v: sr.get(s) })).filter(p => p.v != null);
    if (!pts.length) return '';
    const line = pts.length > 1
      ? `<polyline points="${pts.map(p => `${x(p.i)},${y(p.v)}`).join(' ')}" fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round"/>` : '';
    const dots = pts.map(p => {
      const o = lbl[si](p);
      return `<circle cx="${x(p.i)}" cy="${y(p.v)}" r="4.5" fill="${sr.color}" stroke="var(--surface)" stroke-width="2"><title>${sr.key}: ${p.v}/100 — ${fmtD(g[p.i].ts)}</title></circle>
      <text x="${x(p.i) + o.x}" y="${y(p.v) + o.y}" text-anchor="${o.anchor}" font-size="11" font-weight="600" fill="var(--ink-2)">${p.v}</text>`;
    }).join('');
    return line + dots;
  }).join('');
  const legend = VIZ.map(sr => `<span class="lg-item"><span class="lg-swatch" style="background:${sr.color}"></span>${sr.key}</span>`).join('');
  return `<div class="card" style="margin-bottom:14px">
    <h2>📈 Andamento — ${esc(g[0].posizione)} (${esc(g[0].livello)})</h2>
    <div class="viz-legend">${legend}</div>
    <div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block">${grid}${series}${xLabels}</svg></div>
  </div>`;
}

function trendCharts() {
  const groups = {};
  state.sessions.forEach(s => {
    if (!s.screening && !s.conoscitivo?.valutazione && !s.tecnico?.valutazione) return;
    const k = s.posizione.trim().toLowerCase() + '|' + s.livello;
    (groups[k] = groups[k] || []).push(s);
  });
  return Object.values(groups).filter(g => g.length >= 2).map(trendChart).join('');
}

function renderStorico() {
  const list = [...state.sessions].sort((a, b) => b.ts - a.ts);
  if (!list.length) {
    return `<div class="view-head"><div><h1>Storico</h1><div class="sub">Le tue simulazioni passate</div></div></div>
    <div class="card empty"><div class="e-icon">🕘</div><h3>Nessuna simulazione</h3>
    <p>Quando completi una simulazione la ritrovi qui, con report e trascrizioni.</p>
    <button class="btn" style="margin-top:8px" onclick="App.go('home')">Inizia la prima</button></div>`;
  }
  const items = list.map(s => {
    const attiva = s.id === state.activeId && s.fase !== 'report';
    const riprendibile = !attiva && s.fase !== 'report' && !s.esitoFinale;
    const e = attiva ? { label: '⏳ In corso — ' + faseLabel(s.fase), cls: 'stage' } : (ESITI[s.esitoFinale] || ESITI.interrotta);
    const scores = [
      s.screening ? `CV ${s.screening.punteggio}` : null,
      s.conoscitivo?.valutazione ? `Con. ${s.conoscitivo.valutazione.punteggio}` : null,
      s.tecnico?.valutazione ? `Tec. ${s.tecnico.valutazione.punteggio}` : null,
    ].filter(Boolean).join(' · ');
    return `<div class="card hist-item">
      <div class="hi-main"><b>${esc(s.posizione)}</b> <span class="badge neutral">${esc(s.livello)}</span>
        <div class="hi-sub">${fmtDT(s.ts)}${scores ? ' · ' + scores : ''}</div></div>
      <div class="hi-actions">
        <span class="badge ${e.cls}">${e.label}</span>
        ${attiva ? `<button class="btn small" onclick="App.go('sim')">Riprendi</button>` : ''}
        ${riprendibile ? `<button class="btn small" onclick="App.riprendiSessione('${s.id}')">Riprendi</button>` : ''}
        ${!attiva ? `<button class="btn small ghost" onclick="App.reportId='${s.id}';App.go('report')">Report</button>` : ''}
        <button class="btn small ghost" style="color:var(--crit-text)" onclick="App.deleteSession('${s.id}')">Elimina</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="view-head"><div><h1>Storico</h1><div class="sub">${list.length} simulazioni</div></div></div>
  ${trendCharts()}${items}`;
}

App.riprendiSessione = id => {
  state.activeId = id;
  save(); App.go('sim');
};
App.deleteSession = id => {
  if (!confirm('Eliminare questa simulazione?')) return;
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.activeId === id) state.activeId = null;
  save(); render();
  toast('Simulazione eliminata');
};

// ── Import / export / reset ──
App.exportData = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hireready-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup esportato');
};
App.importData = () => $('#import-file').click();
App.handleImport = ev => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s.setup || !Array.isArray(s.sessions)) throw new Error('formato');
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      state = loadState();
      render(); checkOllama().then(render);
      toast('Dati importati ✓');
    } catch { toast('File non valido'); }
  };
  reader.readAsText(file);
  ev.target.value = '';
};
App.resetData = () => {
  if (!confirm('Azzerare tutte le simulazioni, i profili e il CV salvato?')) return;
  state = freshState(); save();
  App.view = 'home'; render();
  checkOllama().then(render);
  toast('Dati azzerati');
};

// ── Avvio ──
window.App = App;
window.nextTurno = nextTurno;
window.valuta = valuta;
render();
checkOllama().then(render);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
