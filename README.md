# HireReady
HireReady is your personal AI interview coach, available 24/7. Practice real interview scenarios tailored to your industry, get instant feedback on your answers, and walk into every interview with the confidence of someone who's already been there.

Un recruiter AI **100% in locale** (via [Ollama](https://ollama.com)) simula il vero processo di selezione — e può scartarti a ogni fase, proprio come nella realtà. Nessuna API key, nessun dato lascia il tuo computer.

## Come funziona

1. **📄 Screening CV** — incolli il CV (o lo carichi da PDF) e l'annuncio di lavoro: l'AI decide se sei in linea con posizione e livello. Sotto 60/100 sei fuori, con i consigli per sistemare il CV.
2. **💬 Colloquio conoscitivo** — chat (o voce) con il recruiter AI: domande su motivazione, percorso e soft skill, adattate al tuo CV e alle tue risposte.
3. **🧪 Colloquio tecnico** — domande tecniche mirate su posizione e livello, con approfondimenti sulle risposte vaghe.
4. **🏁 Report finale** — punteggi, punti di forza, lacune, consigli e trascrizioni. Stampabile e copiabile.

### 🧑‍⚖️ La giuria

Ogni risposta è votata da **tre giudici AI indipendenti** — HR, esperto tecnico e hiring manager — ognuno con il proprio criterio. Il voto è la **mediana** dei tre, e il disaccordo è segnalato ("giuria divisa"). Se hai più modelli installati in Ollama, ogni giudice usa un modello diverso. Un "portavoce" sintetizza il verdetto finale.

## Caratteristiche

- Posizione e livello liberi (Junior / Mid / Senior / Lead), annuncio di lavoro opzionale per domande più mirate
- Stile recruiter configurabile: 😊 cordiale · 💼 professionale · 🔥 sotto pressione
- Colloquio in italiano o in inglese; numero di domande configurabile
- CV da PDF (estrazione locale con pdf.js), risposte a voce (dettatura) e domande lette ad alta voce
- Timer sulle risposte, feedback domanda per domanda con **risposta modello**
- Grafico dell'andamento tra simulazioni, storico completo, profili salvati
- PWA installabile, dark mode, export/import dei dati
- Robustezza: retry automatico, ferma/rigenera domanda, correggi ultima risposta, ripresa delle sessioni interrotte

## Requisiti e avvio

1. Installa [Ollama](https://ollama.com) e scarica un modello:
   ```bash
   ollama pull gemma3:4b
   ```
2. Servi la cartella con un web server qualsiasi (serve solo per il service worker — niente build, niente dipendenze):
   ```bash
   python3 -m http.server 4190
   ```
3. Apri `http://localhost:4190` — l'app rileva Ollama da sola.

> Suggerimento: con modelli più grandi (`gemma3:12b`, `qwen3:8b`…) la qualità dei giudizi sale parecchio; l'app li propone automaticamente nel menu modello. Con più modelli installati, la giuria diventa multi-modello.

## Architettura

```
├── index.html      # shell dell'app
├── css/style.css   # design token, chat, stepper, report, stampa
├── js/
│   ├── prompts.js  # prompt del recruiter, dei 3 giudici e del portavoce
│   ├── app.js      # stato, client Ollama (streaming + JSON), macchina a stati, viste
│   └── vendor/     # pdf.js (estrazione CV in locale)
├── manifest.json   # PWA
└── sw.js           # service worker (network-first, mai sulle chiamate a Ollama)
```

Vanilla HTML/CSS/JS, zero dipendenze di build. I dati vivono in `localStorage`.
