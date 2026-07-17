# HireReady — Analisi concorrenza e piano per il mercato (lug 2026)

## 1. Il problema su Vercel (risolto in parte)

Ollama accetta richieste **solo da origini localhost**: dalla pagina hostata su
`https://hire-ready-e52z.vercel.app` risponde **403** (verificato). In più, chi
visita il sito senza Ollama installato non ha alcun motore AI. L'app ora rileva
il contesto hostato e mostra il comando `OLLAMA_ORIGINS` pronto da copiare, ma
la vera soluzione è la **Fase 0** del piano: motore AI nel browser + BYOK.

## 2. La concorrenza

| Segmento | Player | Prezzo | Punti deboli |
|---|---|---|---|
| Mock interview AI | **Final Round AI** (+ Verve AI) | ~49-148 $/mese | carissimo, cloud, no-refund, orientato al "copilot" live (borderline cheating) |
| Delivery coaching | **Yoodli** | ~24 $/mese | valuta il *come* parli, non il contenuto né il processo completo |
| Gratis base | **Google Interview Warmup**, LoopCV, NoBsResume | gratis | domande sciolte, niente processo, niente scarto realistico, niente contesto annuncio |
| Copilot locale | **Natively** (open source, Ollama/BYOK) | gratis | è un copilot per *durante* il colloquio, non un simulatore di allenamento |
| Italia | **AppLI** (Ministero del Lavoro), **ColloquIA** (Univ. Padova, avatar 3D), app store minori | gratis | basici o riservati agli studenti; nessun prodotto consumer completo |
| Tracker candidature | **Teal** (29 $/m), **Huntr** (10-40 $/m), **Simplify** | freemium | solo tracking/CV: nessuno integra l'allenamento al colloquio |

**Il buco di mercato**: nessuno combina (a) simulazione dell'**intero funnel**
con scarto realistico (screening → conoscitivo → tecnico), (b) valutazione a
**giuria**, (c) **tracker dei colloqui reali** collegato all'allenamento,
(d) **privacy totale** (il CV non lascia il computer — dopo il data breach di
Cluely il tema è caldo), (e) **gratis**. HireReady li ha già tutti e cinque.

## 3. Piano

### Fase 0 — Sbloccare il web (1-2 settimane) ⬅ priorità assoluta
1. **Motore AI a 3 livelli** con selezione automatica:
   - 🖥 **Ollama** se raggiungibile (qualità/velocità migliore, oggi);
   - 🌐 **WebLLM** (WebGPU, modello 1-3B nel browser): zero installazione —
     chiunque apra il link Vercel può provare subito;
   - 🔑 **BYOK** (chiave OpenAI/Claude/Groq salvata solo in locale): qualità
     top per chi la vuole, a costo zero per noi.
2. Onboarding <60 secondi: demo con CV/annuncio di esempio precompilati.

### Fase 1 — Sorpasso di prodotto (1-2 mesi)
3. **Interfaccia in inglese** (i18n): il mercato ×100; l'italiano resta il cuneo
   di ingresso (spazio consumer libero).
4. **Metriche di delivery** dalla trascrizione: filler words, lunghezza,
   tempi di risposta, struttura STAR → attacca il punto forte di Yoodli a costo
   quasi zero (i dati li abbiamo già).
5. Fase "**Hai domande per me?**", guida di preparazione generata dall'annuncio,
   **banca domande/ripasso** (riprova le domande andate male).
6. Voce migliorata: modalità conversazione continua; Whisper WASM per STT locale.

### Fase 2 — Distribuzione (continua)
7. Lancio open source: **Show HN / Product Hunt** con l'angolo privacy
   ("il tuo CV non lascia mai il tuo computer").
8. **SEO**: landing per ruolo in IT e EN ("simulatore colloquio frontend
   developer", "AI mock interview nurse", …) — i competitor vincono così.
9. **Career service universitari italiani**: Padova ha appena validato il
   bisogno con ColloquIA (solo interno); offrire HireReady agli altri atenei è
   un canale B2B che Big Interview/VMock presidiano solo in USA.

### Fase 3 — Fossato difensivo
10. Loop tracker↔simulazione: "martedì hai il tecnico con TechNova → allenati
    ora con quelle domande" (nessun concorrente ce l'ha).
11. Preparazione **azienda-specifica** e analytics dei progressi tra sessioni.
12. Monetizzazione senza tradire il posizionamento: core locale **gratis per
    sempre**; Pro (~9 €/mese) = AI cloud gestita, sync multi-dispositivo,
    analytics avanzate. Sottocosto rispetto a tutti (Yoodli 24$, Teal 29$,
    Final Round 49-148$).

### KPI di "prima nel mercato"
- ⭐ GitHub stars e installazioni PWA (traction open source)
- % simulazioni completate fino al report (qualità del funnel)
- Utenti che collegano ≥1 candidatura reale (attivazione del moat)
- Posizionamento SEO su "simulatore colloquio" (IT) e long-tail EN
