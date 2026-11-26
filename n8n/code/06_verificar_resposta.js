// Nó "Verificar resposta" (avaliação automática + harness de saída).
// Confere o texto do modelo antes de mostrar ao usuário:
//   1. toda citação [T###] tem de ser de um trecho que estava na janela;
//   2. pelo menos uma citação na explicação;
//   3. todo número de uma frase tem de estar no trecho citado na mesma frase ou nos dados
//      digitados/calculados (anti-invenção e anti-atribuição errada);
//   4. o texto não pode dizer que o voo está autorizado/liberado.
// Se falhar, a explicação do modelo é descartada e fica só o resultado das regras fixas.
// Se a dúvida não tinha fonte, a resposta é forçada para "não está no material".

const base = $('Montar prompt').first().json;
const bruto = String($input.first().json.text ?? '').trim();
const permitidos = new Set(base.rag.contexto.map(c => c.id));
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// separa as duas partes pedidas ao modelo
const mExp = bruto.match(/EXPLICA[ÇC][ÃA]O:\s*([\s\S]*?)(?=\n\s*D[ÚU]VIDA:|$)/i);
const mDuv = bruto.match(/D[ÚU]VIDA:\s*([\s\S]*)$/i);
let explicacao = (mExp ? mExp[1] : bruto).trim();
let duvida = (mDuv ? mDuv[1] : '').trim();

const nums = s => (s.replace(/\[T\d{3}\]/g, ' ').match(/\d+(?:[.,]\d+)?/g) || []).map(n => n.replace(',', '.').replace(/\.0+$/, ''));
const textoDe = new Map(base.rag.contexto.map(c => [c.id, c.texto + ' ' + c.ref]));
// números que o sistema conhece sem depender de norma: o que o usuário digitou e o que a ferramenta calculou
const e = base.entrada, fz = base.frz;
const numsSistema = new Set(nums([e.altura_m, e.peso_g, e.dist_pessoas_m, e.dist_piloto_m, e.pergunta,
  fz.limite_frz_ft, fz.limite_frz_m, ...fz.aerodromos_ate_7km.flatMap(a => [a.dist_m, a.piso_ft, a.piso_m])].join(' ')));
// cada número de uma frase tem de estar no trecho citado NAQUELA frase ou nos dados do sistema
// remove números que são nomes de norma ou de dispositivo, não valores ("RBAC nº 100", "ICA 100-40", "Art. 38", "§ 1º", "100.5(a)")
const semRotulos = s => s
  .replace(/RBAC\s*(n[º°o.]\s*)?\d+/gi, ' ').replace(/ICA\s*\d+\s*[-‑–]\s*\d+(\/\d+)?/gi, ' ')
  .replace(/Art\.?\s*\d+[º°]?/gi, ' ').replace(/§\s*\d+[º°]?/g, ' ')
  .replace(/\b100\.\d+(\s*\([a-zA-Z0-9]+\))*/g, ' ').replace(/\bEMD\s*\d+/gi, ' ');
const frases = txt => txt.split(/;\s+|\n+/).flatMap(p => p.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/));
const numsSemApoio = txt => {
  const ruins = [];
  for (let frase of frases(txt)) {
    frase = frase.replace(/^\s*\d+[).]\s+/, '').replace(/(^|\s)\d+\)\s/g, ' ');   // marcadores de lista "1)" "2."
    const ids = [...frase.matchAll(/\[(T\d{3})\]/g)].map(m => m[1]);
    const apoio = new Set([...numsSistema, ...nums(ids.map(id => textoDe.get(id) || '').join(' '))]);
    nums(semRotulos(frase)).forEach(n => { if (!apoio.has(n)) ruins.push(n); });
  }
  return [...new Set(ruins)];
};
const checar = (txt, exigeCitacao) => {
  const p = [];
  const ids = [...txt.matchAll(/\[(T\d{3})\]/g)].map(m => m[1]);
  const invalidos = [...new Set(ids.filter(id => !permitidos.has(id)))];
  if (invalidos.length) p.push(`citou trecho que não estava na janela: ${invalidos.join(', ')}`);
  if (exigeCitacao && !ids.length) p.push('não cita nenhum trecho');
  const inventados = numsSemApoio(txt);
  if (inventados.length) p.push(`número(s) sem apoio no trecho citado na mesma frase: ${inventados.join(', ')}`);
  if (/(est[áa]|fica|foi)\s+(autorizad|liberad)|voo\s+autorizado|pode\s+voar\s+(livremente|sem\s+autoriza)|autorizo/i.test(txt)) {
    p.push('diz que o voo está autorizado ou liberado');
  }
  // RBAC 100 fora do escopo: não pode usar requisito dele como obrigação deste voo
  if (base.regras.rbacNaoAplica) {
    const rbacIds = base.rag.contexto.filter(c => c.fonte.startsWith('RBAC') && c.ref !== '100.1 Aplicabilidade').map(c => c.id);
    const usados = ids.filter(id => rbacIds.includes(id));
    const reconhece = /n[ãa]o se aplica|n[ãa]o vale|fora do escopo|n[ãa]o est[áa] sujeit/i.test(txt);
    if (usados.length && !reconhece) p.push(`usa requisito do RBAC nº 100 (${[...new Set(usados)].join(', ')}), que não se aplica a este voo`);
  }
  return p;
};

const problemas = checar(explicacao, true).map(x => 'explicação: ' + x);
const temDuvida = !!base.entrada.pergunta;
const duvidaNaoSabe = /n[ãa]o est[áa] no material/i.test(duvida);
const problemasDuvida = temDuvida && !duvidaNaoSabe ? checar(duvida, true).map(x => 'dúvida: ' + x) : [];
if (temDuvida && base.rag.perguntaSemFonte && !duvidaNaoSabe) problemasDuvida.push('dúvida: a busca não achou trecho que cubra a pergunta');

const aprovado = problemas.length === 0 && explicacao.length > 0;
if (!aprovado) {
  explicacao = 'A explicação escrita pelo modelo foi descartada pelo verificador (' + (problemas.join('; ') || 'resposta vazia') +
    '). O resultado acima vem só das regras fixas e dos trechos listados abaixo.';
}
if (temDuvida && (problemasDuvida.length || !duvida)) duvida = 'não está no material';
problemas.push(...problemasDuvida);
const citados = [...(explicacao + ' ' + duvida).matchAll(/\[(T\d{3})\]/g)].map(m => m[1]);

// ----- página de resultado -----
const r = base.regras, f = base.frz;
const cor = r.checks.some(c => c.status === 'falha') ? '#b42318' : '#067647';
const icon = { ok: '✅', falha: '❌', atencao: '⚠️', nao_se_aplica: '➖' };
const linhas = r.checks.map(c => `<tr><td>${icon[c.status]}</td><td><b>${esc(c.regra)}</b><br><small>${esc(c.detalhe)}</small></td><td><small>${esc(c.refs.join('; '))}</small></td></tr>`).join('');
const comCit = s => esc(s).replace(/\[(T\d{3})\]/g, '<b>[$1]</b>').replace(/\n/g, '<br>');
const usados = base.rag.contexto.filter(c => citados.includes(c.id) || !aprovado);
const fontes = usados.map(c => `<li><b>[${c.id}]</b> ${esc(c.fonte)}, ${esc(c.ref)}</li>`).join('');
const aer = f.aerodromos_ate_7km.map(a => `<li>${esc(a.tipo)} ${esc(a.codigo)} ${esc(a.nome)} (${esc(a.municipio)}/${esc(a.uf)}): ${a.dist_m} m, piso FRZ ${a.piso_ft} ft</li>`).join('') || '<li>nenhum a menos de 7 km</li>';

const html = `
<div style="text-align:left;font-size:14px;line-height:1.45">
<div style="background:${cor};color:#fff;padding:12px 14px;border-radius:8px;font-weight:700;font-size:16px">${esc(r.veredito)}</div>
<p style="margin:8px 0">${esc(r.consequencia)}</p>
<p><small>Local: ${esc(base.posicao.localEncontrado)} (${esc(base.posicao.origemLocal)})</small></p>
<h3 style="margin:12px 0 4px">Regras verificadas pelo sistema</h3>
<table style="width:100%;border-collapse:collapse" cellpadding="4">${linhas}</table>
<h3 style="margin:12px 0 4px">Explicação ${aprovado ? '(modelo, verificada)' : '(descartada)'}</h3>
<p>${comCit(explicacao)}</p>
${base.entrada.pergunta ? `<h3 style="margin:12px 0 4px">Sua dúvida</h3><p><i>${esc(base.entrada.pergunta)}</i></p><p>${comCit(duvida)}</p>` : ''}
<h3 style="margin:12px 0 4px">Trechos citados</h3><ul>${fontes}</ul>
<h3 style="margin:12px 0 4px">Aeródromos e helipontos até 7 km</h3><ul>${aer}</ul>
<h3 style="margin:12px 0 4px">O que este sistema NÃO verificou</h3><ul>${r.naoVerificado.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<p><small>Ferramenta acadêmica (TE-251). Não é autorização nem orientação oficial. Consulte o SARPAS/DECEA e a ANAC.</small></p>
</div>`;

return [{ json: {
  veredito: r.veredito,
  verificador: { aprovado, problemas, citados: [...new Set(citados)], permitidos: [...permitidos] },
  traco_rag: base.rag.traco,
  saida_bruta_do_modelo: bruto,
  html,
} }];
