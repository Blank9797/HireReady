# HireReady — Piano di progetto (v2)

App web che aiuta il **candidato** a prepararsi a un colloquio di lavoro.
Un LLM locale (Ollama, `gemma3:4b` — nessuna API key, 100% gratis) interpreta il
recruiter e simula un vero processo di selezione in tre fasi, con possibile
scarto a ogni fase.

> v1 era un gestionale per recruiter: scopo sbagliato, sostituita da questa versione.

## 1. Requisiti

### Funzionali
- **RF1 — Setup candidatura**: il candidato indica la posizione per cui si sta
  candidando (testo libero, nessun elenco predefinito), il livello
  (Junior/Mid/Senior/Lead) e incolla il proprio CV.
- **RF2 — Fase 1, screening CV (AI)**: l'LLM valuta il CV rispetto a posizione e
  livello → punteggio 0-100, punti in linea, lacune, motivazione, consigli per
  migliorare il CV. Sotto soglia (60) il candidato è **scartato già qui**.
- **RF3 — Fase 2, colloquio conoscitivo (AI, chat)**: il recruiter AI fa 5 domande
  una alla volta (motivazione, percorso, soft skill, comportamentali), adattandosi
  a CV e risposte. Al termine: valutazione con esito superato/scartato.
- **RF4 — Fase 3, colloquio tecnico (AI, chat)**: 6 domande tecniche mirate su
  posizione e livello, difficoltà calibrata. Valutazione finale con esito.
- **RF5 — Esiti realistici**: ogni fase può scartare; in caso di scarto il
  candidato riceve feedback e può riprovare la fase (allenamento) o chiudere.
- **RF6 — Report finale**: riepilogo di tutte le fasi, punti di forza, aree di
  miglioramento, consigli di studio; copiabile negli appunti.
- **RF7 — Storico**: le simulazioni passate restano consultabili (report completo,
  trascrizioni incluse); una simulazione interrotta si può riprendere.
- **RF8 — Stato AI**: verifica automatica che Ollama giri e il modello ci sia;
  scelta del modello tra quelli installati; istruzioni se manca.
- **RF9 — Dati**: persistenza locale, export/import JSON.

### Non funzionali
- Vanilla HTML/CSS/JS, nessuna dipendenza; UI in italiano; light + dark mode.
- LLM solo in locale via Ollama (`http://localhost:11434`, API `/api/chat`),
  streaming delle domande del recruiter per una chat realistica;
  valutazioni con `format: json` e parsing tollerante.
- Porta **4190** (voce `recruiting` in launch.json).

## 2. Architettura

```
recruiting-app/
├── index.html      # shell: sidebar + viste + modale + toast
├── css/style.css   # design token, stepper, chat, report
└── js/
    ├── prompts.js  # costruzione prompt (screening / conoscitivo / tecnico / valutazioni)
    └── app.js      # stato, client Ollama (stream + json), macchina a stati delle fasi, viste
```

- **Sessione**: `{ id, ts, posizione, livello, cv, fase, screening, conoscitivo:{transcript, valutazione}, tecnico:{…}, esitoFinale }`.
- **Flusso**: setup → screening (auto) → [scarto | conoscitivo (chat 5 domande) →
  valutazione → [scarto | tecnico (chat 6 domande) → valutazione → report]].
- Il conteggio domande è controllato dall'app (non dal modello): dopo l'ultima
  risposta parte la valutazione JSON sulla trascrizione.

## 3. Fasi di sviluppo
1. Client Ollama: check `/api/tags`, chat streaming NDJSON, chiamate JSON.
2. Prompt italiani per screening, interviste (una domanda alla volta) e valutazioni.
3. Macchina a stati della simulazione + persistenza/ripresa.
4. UI: setup, stepper, chat con streaming, card di valutazione, report, storico.
5. Test dal vivo con gemma3:4b (screening reale + colloquio + valutazione).

## 4. Migliorie v2.1 (implementate)
- **Annuncio di lavoro**: campo opzionale; screening, domande e valutazioni si
  ancorano ai requisiti reali dell'annuncio.
- **CV da PDF**: estrazione testo in locale con pdf.js (`js/vendor/`), bottone o
  drag&drop sulla textarea.
- **Feedback domanda per domanda**: la valutazione include voto 0-10, commento e
  "risposta modello" per ogni domanda (campo `dettaglio` nel JSON).
- **Recruiter configurabile**: stile (cordiale / professionale / sotto pressione)
  e numero di domande per fase (3-10).
- **Voce**: dettatura risposte (Web Speech API, può usare servizi cloud del
  browser) e lettura ad alta voce delle domande (SpeechSynthesis), entrambe opt-in.
- **Timer**: cronometro live sulla risposta; tempo salvato per ogni risposta,
  mostrato in chat/trascrizioni e passato al valutatore.
- **Colloquio in inglese**: toggle lingua; risposte modello in inglese, feedback in italiano.
- **Robustezza**: retry automatico sulle chiamate JSON; ⏹ Ferma generazione
  (AbortController); 🔄 Rigenera domanda; ✏️ Correggi ultima risposta.
- **Trend**: grafico SVG dei punteggi (CV/conoscitivo/tecnico) per posizione
  nello Storico, palette categorica validata, ripresa sessioni dallo storico.
- **PWA**: manifest + service worker network-first (mai su Ollama); stampa/PDF
  del report con CSS di stampa.
- **Profili salvati**: più candidature riutilizzabili (posizione+CV+annuncio+opzioni).
