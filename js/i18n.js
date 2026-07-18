// ── HireReady: i18n ───────────────────────────────────────────────────────
// Le stringhe italiane fanno da chiave: t('…') le lascia intatte in IT e le
// traduce in EN se presenti nel dizionario (fallback: italiano).
let LANG = 'it';
const setLang = l => { LANG = l === 'en' ? 'en' : 'it'; document.documentElement.lang = LANG; };
const t = s => LANG === 'en' ? (I18N_EN[s] ?? s) : s;

const I18N_EN = {
  // Navigazione e shell
  'Simulazione': 'Practice', 'Palestra': 'Gym', 'Colloqui': 'Interviews', 'Ripasso': 'Review', 'Storico': 'History',
  'Allenati con un recruiter AI in locale': 'Train with a local AI recruiter',
  'Esporta dati': 'Export data', 'Importa dati': 'Import data', 'Azzera dati': 'Reset data',
  'AI locale attiva': 'Local AI active', 'AI via API ☁️': 'AI via API ☁️', 'AI nel browser 🌐': 'In-browser AI 🌐',
  'Verifica in corso…': 'Checking…',

  // Home
  'Preparati al colloquio': 'Get interview-ready',
  'Un recruiter AI (in locale) simula il vero processo di selezione: può scartarti a ogni fase, proprio come nella realtà.':
    'An AI recruiter simulates the real hiring process: you can get rejected at every stage, just like in real life.',
  'Simulazione in corso:': 'Simulation in progress:', 'fase': 'stage', 'Riprendi': 'Resume', 'Abbandona': 'Leave',
  '1 · Screening CV': '1 · CV screening',
  'L’AI confronta il tuo CV con posizione, livello e annuncio. Se non sei in linea, sei fuori — con i consigli per sistemarlo.':
    'The AI checks your CV against role, level and job post. If you don’t match, you’re out — with tips to fix it.',
  '2 · Colloquio conoscitivo': '2 · Screening interview',
  'Domande su motivazione, percorso e soft skill. Rispondi in chat (o a voce) come in un vero colloquio.':
    'Questions on motivation, background and soft skills. Answer in chat (or by voice) like in a real interview.',
  '3 · Colloquio tecnico': '3 · Technical interview',
  'Domande tecniche calibrate su posizione e livello, con eventuali approfondimenti.':
    'Technical questions calibrated to role and level, with follow-ups.',
  '4 · Report finale': '4 · Final report',
  'Punteggi, feedback domanda per domanda con risposte modello, consigli per quello vero.':
    'Scores, question-by-question feedback with model answers, tips for the real one.',
  'La tua candidatura': 'Your application',
  'Per quale posizione ti stai candidando? *': 'What role are you applying for? *',
  'Livello *': 'Level *', 'Stile recruiter': 'Recruiter style', 'Lingua colloquio': 'Interview language',
  'Domande conoscitivo': 'Screening questions', 'Domande tecnico': 'Technical questions',
  'Annuncio di lavoro (consigliato: rende screening e domande molto più mirati)':
    'Job post (recommended: makes screening and questions far more targeted)',
  'Il tuo CV *': 'Your CV *', 'Carica da PDF': 'Load from PDF',
  'oppure trascina il PDF sul riquadro, oppure incolla il testo': 'or drag the PDF onto the box, or paste the text',
  'Tutto resta sul tuo computer: l’AI gira in locale, niente cloud.': 'Everything stays on your machine: the AI runs locally, no cloud.',
  'Motore AI': 'AI engine', '🖥 Ollama (locale, privato)': '🖥 Ollama (local, private)',
  '☁️ API esterna (Groq / OpenAI…)': '☁️ External API (Groq / OpenAI…)', '🌐 Nel browser (WebGPU)': '🌐 In-browser (WebGPU)',
  '🚀 Inizia la simulazione': '🚀 Start the simulation', '💾 Salva come profilo': '💾 Save as profile',
  '📂 Carica': '📂 Load', 'Modello Ollama': 'Ollama model', 'Chiave API': 'API key', 'Modello': 'Model',
  'URL base (OpenAI-compatibile)': 'Base URL (OpenAI-compatible)',
  '🔄 Riprova connessione': '🔄 Retry connection',

  // Fasi / stepper
  'Screening CV': 'CV screening', 'Conoscitivo': 'Screening', 'Tecnico': 'Technical',
  'Le tue domande': 'Your questions', 'Report': 'Report',
  '😊 Cordiale': '😊 Friendly', '💼 Professionale': '💼 Professional', '🔥 Sotto pressione': '🔥 High pressure',

  // Chat
  '💬 Colloquio conoscitivo': '💬 Screening interview', '🧪 Colloquio tecnico': '🧪 Technical interview',
  '🙋 Le tue domande al recruiter': '🙋 Your questions for the recruiter',
  'domanda': 'question', 'di': 'of', 'Invia': 'Send', 'Voce': 'Voice',
  '🏁 Termina e valuta ora': '🏁 Finish & evaluate now', '⏹ Ferma': '⏹ Stop',
  '🔄 Rigenera domanda': '🔄 Regenerate question', '✏️ Correggi ultima risposta': '✏️ Edit last answer',
  'Scrivi (o detta col microfono) la tua risposta… Invio per inviare': 'Type (or dictate) your answer… Enter to send',
  'Scrivi una domanda da fare al recruiter… Invio per inviare': 'Type a question for the recruiter… Enter to send',
  'Attendi il recruiter…': 'Waiting for the recruiter…',
  '▶️ Continua il colloquio': '▶️ Continue the interview', '▶️ Fai iniziare il recruiter': '▶️ Let the recruiter start',
  '🧑‍💼 Recruiter': '🧑‍💼 Recruiter', '🙋 Tu': '🙋 You',

  // Valutazioni / report
  'Esito dello screening CV': 'CV screening result',
  'Valutazione del colloquio conoscitivo': 'Screening interview evaluation',
  'Valutazione del colloquio tecnico': 'Technical interview evaluation',
  '✓ CV in linea': '✓ CV matches', '✕ Scartato': '✕ Rejected', '✓ Superato': '✓ Passed',
  'Punti in linea': 'Matching points', 'Lacune rispetto alla posizione': 'Gaps vs the role',
  'Consigli per migliorare il CV': 'Tips to improve your CV',
  'Punti di forza': 'Strengths', 'Aree di miglioramento': 'Areas to improve',
  'Consigli per prepararti': 'Preparation tips', 'Feedback domanda per domanda': 'Question-by-question feedback',
  '💡 Risposta modello:': '💡 Model answer:', 'giuria unanime': 'unanimous jury', 'giuria divisa': 'split jury',
  '🎁 fase bonus — non elimina': '🎁 bonus stage — no elimination',
  'Cosa è piaciuto': 'What worked', 'Da migliorare': 'To improve',
  'Domande che avresti potuto fare': 'Questions you could have asked',
  '💬 Inizia il colloquio conoscitivo': '💬 Start the screening interview',
  '🧪 Prosegui al colloquio tecnico': '🧪 Continue to the technical interview',
  '🙋 Fase finale: fai TU le domande': '🙋 Final stage: YOU ask the questions',
  'Salta → report': 'Skip → report', '🏁 Vai al report finale': '🏁 Go to the final report',
  '🔁 Riprova questo colloquio': '🔁 Retry this interview', 'Chiudi e vai al report': 'Close & go to report',
  '✏️ Modifica il CV e riprova': '✏️ Edit your CV and retry',
  '📋 Copia report': '📋 Copy report', '🖨️ Stampa / PDF': '🖨️ Print / PDF', '🚀 Nuova simulazione': '🚀 New simulation',
  '📊 Come hai risposto (analisi automatica)': '📊 How you answered (automatic analysis)',
  'Rileggi la trascrizione': 'Reread the transcript', 'messaggi': 'messages',
  '🎉 Processo superato: saresti passato!': '🎉 Process passed: you would have made it!',
  '✕ Scartato allo screening del CV': '✕ Rejected at CV screening',
  '✕ Scartato al colloquio conoscitivo': '✕ Rejected at the screening interview',
  '✕ Scartato al colloquio tecnico': '✕ Rejected at the technical interview',
  'Simulazione interrotta': 'Simulation interrupted',

  // Ripasso / storico / colloqui (superfici principali)
  'La guida di preparazione e tutte le domande incontrate nelle simulazioni': 'Your prep guide and every question met in the simulations',
  '📚 Guida di preparazione': '📚 Preparation guide', '✨ Genera la guida': '✨ Generate the guide',
  '🔄 Rigenera': '🔄 Regenerate', '📋 Copia': '📋 Copy',
  'Le tue simulazioni passate': 'Your past simulations', 'simulazioni': 'simulations',
  'I tuoi colloqui': 'Your interviews',
  'Tieni traccia delle candidature reali: appuntamenti, stato e info per decidere': 'Track your real applications: appointments, status and info to decide',
  '＋ Aggiungi candidatura': '＋ Add application',
};
