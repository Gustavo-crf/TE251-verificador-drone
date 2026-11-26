// Nó "Recuperar trechos (RAG)".
// Corpus: trechos do RBAC nº 100 (EMD 00) e da ICA 100-40/2026, um por artigo/seção.
// Context Engineering: entram na janela do modelo SÓ
//   (a) os trechos citados pelas regras que rodaram e
//   (b) até 3 trechos recuperados por BM25 para a dúvida digitada.
// O resto do corpus fica de fora. O traço (ids e notas) vai junto para a auditoria.

const CHUNKS = /*__CHUNKS__*/[];

const inp = $input.first().json;
const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma para por com sem que se ao aos à às ou é ser são como mais menos qual quais quando onde meu minha preciso posso pode devo tem ter isso este esta essa drone drones voar voo uas ua'.split(' '));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const toks = s => norm(s).match(/[a-z0-9]+/g)?.filter(t => t.length > 1 && !STOP.has(t)) ?? [];

// BM25
const docs = CHUNKS.map(c => toks(c.ref + ' ' + c.texto));
const N = docs.length, avg = docs.reduce((s, d) => s + d.length, 0) / N;
const df = {};
docs.forEach(d => new Set(d).forEach(t => { df[t] = (df[t] || 0) + 1; }));
const bm25 = (q) => docs.map((d, i) => {
  const tf = {}; d.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  let s = 0, hit = 0;
  for (const t of new Set(q)) {
    if (!tf[t]) continue; hit++;
    const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
    s += idf * (tf[t] * 2.2) / (tf[t] + 1.2 * (1 - 0.75 + 0.75 * d.length / avg));
  }
  return { i, s, cobertura: q.length ? hit / new Set(q).size : 0 };
}).sort((a, b) => b.s - a.s);

// (a) trechos exigidos pelas regras: regra OK leva só o trecho principal;
//     regra que falhou, pede atenção ou não se aplica leva todos os trechos dela
const refsRegras = [...new Set(inp.regras.checks.flatMap(c => c.status === 'ok' ? c.refs.slice(0, 1) : c.refs))];
const forcados = refsRegras.map(r => CHUNKS.findIndex(c => c.ref === r)).filter(i => i >= 0);
const refsNaoAchadas = refsRegras.filter(r => !CHUNKS.some(c => c.ref === r));

// (b) busca pela dúvida do usuário
const pergunta = inp.entrada.pergunta;
let recuperados = [], perguntaSemFonte = false;
if (pergunta) {
  const q = toks(pergunta);
  const rank = bm25(q).slice(0, 3);
  recuperados = rank.filter(r => r.s > 0);
  // sem fonte: nenhum trecho cobre ao menos metade dos termos da dúvida
  perguntaSemFonte = !recuperados.length || recuperados[0].cobertura < 0.5 || q.length === 0;
}

const ids = [...new Set([...forcados, ...recuperados.map(r => r.i)])];
const contexto = ids.map(i => CHUNKS[i]);

return [{ json: { ...inp, rag: {
  contexto,
  perguntaSemFonte,
  traco: {
    trechos_das_regras: forcados.map(i => CHUNKS[i].id + ' ' + CHUNKS[i].ref),
    refs_nao_achadas: refsNaoAchadas,
    busca_pergunta: recuperados.map(r => ({ id: CHUNKS[r.i].id, ref: CHUNKS[r.i].ref, nota: +r.s.toFixed(2), cobertura: +r.cobertura.toFixed(2) })),
    total_no_corpus: N, total_na_janela: contexto.length,
  },
} } }];
