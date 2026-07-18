// ── HireReady: configurazione e prompt per l'LLM locale ─────────────────
const MODEL_PREFERITO = 'gemma3:4b';
const LIVELLI = ['Junior', 'Mid', 'Senior', 'Lead'];
const N_DOMANDE = { conoscitivo: 5, tecnico: 6, domande: 3 }; // default, configurabile nel setup
const SOGLIA = 60; // punteggio minimo per superare una fase

const FASI = [
  { id: 'screening',   label: 'Screening CV',  icon: '📄' },
  { id: 'conoscitivo', label: 'Conoscitivo',   icon: '💬' },
  { id: 'tecnico',     label: 'Tecnico',       icon: '🧪' },
  { id: 'domande',     label: 'Le tue domande', icon: '🙋' },
  { id: 'report',      label: 'Report',        icon: '🏁' },
];

const STILI = {
  cordiale: {
    label: '😊 Cordiale',
    prompt: 'Stile del colloquio: cordiale e incoraggiante. Metti il candidato a suo agio, ringrazia per le risposte, mantieni un tono caldo.',
  },
  neutro: {
    label: '💼 Professionale',
    prompt: 'Stile del colloquio: professionale e neutro. Cortese ma essenziale, senza commenti sulle risposte.',
  },
  pressione: {
    label: '🔥 Sotto pressione',
    prompt: 'Stile del colloquio: incalzante, come uno stress test. Fai domande dirette e scomode, incalza sui punti deboli del CV (buchi, esperienze brevi, competenze solo dichiarate), chiedi di argomentare le affermazioni generiche. Resta sempre professionale, mai offensivo.',
  },
};

const LINGUE = { it: 'Italiano', en: 'English' };

// Compat: sessioni create con versioni precedenti dell'app
const sessStile   = s => STILI[s.stile] ? s.stile : 'neutro';
const sessLingua  = s => s.lingua === 'en' ? 'en' : 'it';
const sessN       = (s, tipo) => s.nDomande?.[tipo] || N_DOMANDE[tipo];
const sessAnnuncio = s => (s.annuncio || '').trim();

function bloccoAnnuncio(s) {
  const a = sessAnnuncio(s);
  return a ? `\nAnnuncio di lavoro a cui il candidato risponde:\n---\n${a}\n---\n` : '';
}

function buildScreeningMessages(s) {
  const conAnnuncio = sessAnnuncio(s)
    ? 'Valuta il CV rispetto ai requisiti CONCRETI dell\'annuncio di lavoro fornito (requisiti indispensabili vs preferenziali) oltre che rispetto a posizione e livello.'
    : 'Valuta il CV rispetto alla posizione e al livello indicati.';
  return [
    {
      role: 'system',
      content: `Sei un recruiter senior di un'azienda italiana e stai facendo lo screening dei CV.
${conAnnuncio} Considera: pertinenza delle esperienze, competenze richieste, coerenza del percorso, completezza del CV.
Sii realistico e severo come un vero recruiter: se il profilo non è in linea, scartalo.
Rispondi SOLO con un oggetto JSON valido, senza alcun testo prima o dopo, con esattamente questa struttura:
{"punteggio": <numero 0-100>, "esito": "superato" oppure "scartato", "punti_in_linea": ["..."], "lacune": ["..."], "motivazione": "<2-3 frasi>", "consigli_cv": ["..."]}
Regole: esito "scartato" se punteggio < ${SOGLIA}. Tutti i testi in italiano.`,
    },
    {
      role: 'user',
      content: `Posizione per cui mi candido: ${s.posizione}
Livello: ${s.livello}
${bloccoAnnuncio(s)}
Il mio CV:
${s.cv}`,
    },
  ];
}

function buildIntervistaSystem(tipo, s) {
  const lingua = sessLingua(s) === 'en'
    ? 'Conduci il colloquio INTERAMENTE in inglese (tutte le tue battute in inglese), come in una selezione internazionale.'
    : 'Conduci il colloquio in italiano.';
  if (tipo === 'domande') {
    return `Sei il recruiter alla FINE di un colloquio per la posizione di ${s.posizione}, livello ${s.livello}. Le domande al candidato sono finite: ora è LUI a fare domande a te.${bloccoAnnuncio(s)}
${STILI[sessStile(s)].prompt}
${lingua}
Regole:
- Alla prima battuta di' che le tue domande sono finite e chiedigli se ha domande per te.
- Rispondi alle sue domande in modo realistico e concreto (team, progetti, processo di selezione, cultura, crescita): se un dettaglio non è nell'annuncio, inventalo in modo plausibile e coerente.
- Risposte brevi (2-4 frasi), poi chiedi se ha altre domande.
- NON valutare le sue domande e non dare giudizi.`;
  }
  const comune = `Hai già letto il suo CV:
---
${s.cv}
---${bloccoAnnuncio(s)}
${STILI[sessStile(s)].prompt}
${lingua}
Regole del colloquio:
- Fai UNA sola domanda per volta e attendi la risposta del candidato.
- Domande brevi e concrete.
- Adatta le domande al CV${sessAnnuncio(s) ? ', ai requisiti dell\'annuncio' : ''} e alle risposte ricevute; se una risposta è vaga o interessante, puoi chiedere un approfondimento.
- NON dare giudizi, voti o valutazioni durante il colloquio.
- Non elencare le domande future e non numerarle.
- Non scrivere mai le risposte al posto del candidato.`;
  if (tipo === 'conoscitivo') {
    return `Sei un HR recruiter e stai conducendo un colloquio CONOSCITIVO (non tecnico) con un candidato per la posizione di ${s.posizione}, livello ${s.livello}.
${comune}
- In totale farai circa ${sessN(s, 'conoscitivo')} domande su: motivazione per il ruolo, percorso professionale, soft skill, situazioni comportamentali vissute, aspettative.
Alla prima battuta presentati in una frase e fai subito la prima domanda.`;
  }
  return `Sei un intervistatore tecnico e stai conducendo il colloquio TECNICO di un candidato per la posizione di ${s.posizione}, livello ${s.livello}.
${comune}
- In totale farai circa ${sessN(s, 'tecnico')} domande tecniche mirate alla posizione "${s.posizione}": un mix di teoria, casi pratici e ragionamento su scenari reali.
- Calibra la difficoltà sul livello ${s.livello}: per un Junior parti dalle basi, per un Senior/Lead vai in profondità su architetture, trade-off e decisioni.
- Non fornire tu le soluzioni durante il colloquio.
Alla prima battuta presentati in una frase e fai subito la prima domanda.`;
}

// ── Giuria: tre giudici indipendenti valutano ogni risposta ──────────────
const GIUDICI = [
  { id: 'hr',  nome: 'HR',             icona: '🧑‍💼', temp: 0.2,
    focus: 'motivazione, soft skill, chiarezza espositiva e struttura della risposta' },
  { id: 'tec', nome: 'Esperto tecnico', icona: '🧪', temp: 0.3, conModello: true,
    focus: 'correttezza, concretezza e profondità della risposta rispetto alla posizione e al livello richiesto' },
  { id: 'hm',  nome: 'Hiring manager', icona: '🎯', temp: 0.4,
    focus: 'pragmatismo: questa risposta dimostra impatto reale? Vorrei questa persona nel mio team?' },
];

function buildGiudiceMessages(giudice, tipo, s, domanda, risposta, tempo) {
  const nomeFase = tipo === 'tecnico' ? 'colloquio tecnico' : 'colloquio conoscitivo';
  const ann = sessAnnuncio(s) ? `\nAnnuncio di riferimento (estratto):\n${sessAnnuncio(s).slice(0, 600)}\n` : '';
  const en = sessLingua(s) === 'en' ? ' Il colloquio si svolge in inglese: pesa anche la qualità dell\'inglese.' : '';
  const modello = giudice.conModello
    ? `, "risposta_modello": "<2-3 frasi: come risponderebbe un candidato forte${sessLingua(s) === 'en' ? ', scritte in inglese' : ''}>"` : '';
  return [
    {
      role: 'system',
      content: `Sei "${giudice.nome}", uno dei tre giudici indipendenti di una giuria che valuta un ${nomeFase} per la posizione di ${s.posizione} (livello ${s.livello}).${ann}
Il tuo criterio di giudizio: ${giudice.focus}.${en}
Valuta SOLO la risposta del candidato alla domanda fornita, non fare altre domande.
Scala voti: 0-3 insufficiente, 4-5 debole, 6-7 buona, 8-10 eccellente (rara). Risposte vuote, evasive o generiche meritano voti bassi. Sii severo e realistico come in una vera selezione.
Rispondi SOLO con un oggetto JSON valido: {"voto": <0-10>, "commento": "<1-2 frasi in italiano: cosa andava bene e cosa mancava>"${modello}}`,
    },
    {
      role: 'user',
      content: `Domanda del recruiter: ${domanda}

Risposta del candidato${tempo ? ` (data in ${tempo}s)` : ''}: ${risposta}`,
    },
  ];
}

// Valutazione delle domande fatte dal candidato al recruiter (fase bonus)
function buildEvalDomandeMessages(s, transcript) {
  const testo = transcript
    .map(m => (m.role === 'assistant' ? 'RECRUITER: ' : 'CANDIDATO: ') + m.content)
    .join('\n\n');
  return [
    {
      role: 'system',
      content: `Sei un career coach esperto. A fine colloquio per la posizione di ${s.posizione} (livello ${s.livello}) il candidato ha fatto delle domande al recruiter: valuta la QUALITÀ delle sue domande.${bloccoAnnuncio(s)}
Domande forti: mostrano interesse genuino, preparazione sull'azienda/ruolo, orientamento alla crescita e all'impatto. Domande deboli: solo ferie/orari/stipendio come prima domanda, generiche, o nessuna domanda.
Rispondi SOLO con un oggetto JSON valido:
{"punteggio": <0-100>, "feedback": "<2-3 frasi rivolte al candidato (dai del tu)>", "punti_forza": ["..."], "aree_miglioramento": ["..."], "domande_modello": ["<3 esempi di ottime domande da fare per questa posizione>"]}
Tutti i testi in italiano.`,
    },
    { role: 'user', content: `Trascrizione della fase finale:\n\n${testo}` },
  ];
}

// Guida di preparazione pre-colloquio generata da posizione + CV + annuncio
function buildGuidaMessages(s) {
  return [
    {
      role: 'system',
      content: `Sei un career coach esperto. Prepara una guida di preparazione al colloquio per la posizione di ${s.posizione} (livello ${s.livello}), su misura del CV del candidato${sessAnnuncio(s) ? ' e dell\'annuncio' : ''}.
Rispondi SOLO con un oggetto JSON valido:
{"punti_chiave": ["<4-6 cose da sapere/valorizzare in questo colloquio>"],
"domande_conoscitivo": ["<5 domande motivazionali/comportamentali probabili>"],
"domande_tecniche": [{"domanda": "<domanda tecnica probabile>", "cosa_ripassare": "<argomento da studiare>"}, … 5-6 voci],
"gap": ["<lacune del CV rispetto alla posizione, con come compensarle a voce>"],
"domande_da_fare": ["<3 ottime domande da fare al recruiter>"]}
Tutti i testi in italiano, concreti e specifici per questa posizione.`,
    },
    {
      role: 'user',
      content: `Posizione: ${s.posizione}\nLivello: ${s.livello}\n${bloccoAnnuncio(s)}\nCV del candidato:\n${s.cv}`,
    },
  ];
}

function buildSintesiMessages(tipo, s, dettaglio) {
  const nomeFase = tipo === 'tecnico' ? 'colloquio tecnico' : 'colloquio conoscitivo';
  const righe = dettaglio.map((d, i) =>
    `${i + 1}. "${d.domanda}" — mediana ${d.voto}/10\n` +
    (d.giudici || []).map(g => `   - ${g.nome} (${g.voto}/10): ${g.commento}`).join('\n')
  ).join('\n');
  return [
    {
      role: 'system',
      content: `Sei il portavoce di una giuria di tre giudici (HR, esperto tecnico, hiring manager) che ha appena valutato un ${nomeFase} per la posizione di ${s.posizione} (livello ${s.livello}).
Ti fornisco voti e commenti dei giudici per ogni domanda. Sintetizza il verdetto complessivo per il candidato, basandoti SOLO sui commenti dei giudici.
Rispondi SOLO con un oggetto JSON valido:
{"punti_forza": ["..."], "aree_miglioramento": ["..."], "feedback": "<3-4 frasi rivolte direttamente al candidato (dai del tu), che riflettano il giudizio della giuria>", "consigli": ["..."]}
Tutti i testi in italiano.`,
    },
    { role: 'user', content: righe },
  ];
}
