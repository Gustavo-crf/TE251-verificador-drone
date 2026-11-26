// Teste offline dos nós de código do workflow (sem n8n e sem modelo).
// Executa os nós na ordem, com $ e $input simulados, e usa uma resposta fixa no lugar do modelo.
// Uso: node tests/run_offline.js n8n/workflow.json tests/casos.json
const fs = require('fs');
const wf = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const casos = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const js = name => wf.nodes.find(n => n.name === name).parameters.jsCode;

async function runCode(name, out, input) {
  const $ = n => ({ first: () => ({ json: out[n] }), all: () => (Array.isArray(out[n]) ? out[n] : [out[n]]).map(j => ({ json: j })) });
  const $input = { first: () => ({ json: input }), all: () => [{ json: input }] };
  const fn = new Function('$', '$input', `return (async () => { ${js(name)} })();`);
  const r = await fn($, $input);
  return r[0].json;
}

(async () => {
  for (const c of casos) {
    const out = { 'Formulário de voo': c.form, 'Geocodificar local': c.geo || {} };
    let j = await runCode('Validar entrada', out, {});
    out['Validar entrada'] = j;
    console.log(`\n### ${c.nome}`);
    if (j.parar) { const r = await runCode('Montar recusa', out, j); console.log(r.veredito, r.motivos); continue; }
    for (const n of ['Ferramenta: aeródromos próximos', 'Regras fixas', 'Recuperar trechos (RAG)', 'Montar prompt']) {
      j = await runCode(n, out, j); out[n] = j;
    }
    const r = await runCode('Verificar resposta', out, { text: c.modelo_simulado || '' });
    console.log('Local:', j.posicao.localEncontrado);
    console.log('FRZ:', j.frz.total_ate_7km, 'até 7 km; limite', j.frz.limite_frz_ft, 'ft;', j.frz.causa);
    j.regras.checks.forEach(ch => console.log(`  [${ch.status}] ${ch.regra} :: ${ch.detalhe.slice(0, 140)}`));
    console.log('VEREDITO:', r.veredito);
    console.log('RAG:', JSON.stringify(r.traco_rag));
    console.log('Verificador:', JSON.stringify(r.verificador.problemas), 'aprovado=', r.verificador.aprovado);
    if (c.mostrar_prompt) console.log('--- PROMPT ---\n' + j.prompt.slice(0, 1800));
  }
})().catch(e => { console.error(e); process.exit(1); });
