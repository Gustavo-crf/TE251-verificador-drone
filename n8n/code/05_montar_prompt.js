// Nó "Montar prompt" (Context Engineering).
// Monta exatamente o que o modelo vê: o veredito já decidido, as regras verificadas
// e os trechos recuperados, cada um com seu id [T###]. Nada além disso entra.

const inp = $input.first().json;
const r = inp.regras, e = inp.entrada;
const st = { ok: 'OK', falha: 'FALHOU', atencao: 'ATENÇÃO', nao_se_aplica: 'NÃO SE APLICA' };

const linhasRegras = r.checks.map(c => `- [${st[c.status]}] ${c.regra}: ${c.detalhe}`).join('\n');
const trechos = inp.rag.contexto.map(c => `[${c.id}] ${c.fonte}, ${c.ref}:\n${c.texto}`).join('\n\n');
const idAplic = (inp.rag.contexto.find(c => c.ref === '100.1 Aplicabilidade') || {}).id;
const aplicabilidade = r.rbacNaoAplica
  ? `APLICABILIDADE (decidida pelo sistema): o RBAC nº 100 NÃO se aplica a este voo${idAplic ? ` [${idAplic}]` : ''}. Nenhum requisito do RBAC nº 100 (seguro, cadastro, distância de 30 m etc.) vale para este caso; para este voo valem as regras da ICA 100-40.`
  : 'APLICABILIDADE (decidida pelo sistema): o RBAC nº 100 se aplica a este voo, junto com a ICA 100-40.';

const prompt = `CASO
Finalidade: ${e.finalidade}. Pilotagem: ${e.pilotagem}. Altura: ${e.altura_m} m. Peso: ${e.peso_g} g.
Distância de pessoas não envolvidas: ${e.dist_pessoas_m} m. Local: ${inp.posicao.localEncontrado}.

VEREDITO (decidido pelo sistema, não altere): ${r.veredito}
${r.consequencia}
${aplicabilidade}

REGRAS VERIFICADAS PELO SISTEMA
${linhasRegras}

DÚVIDA DO USUÁRIO: ${e.pergunta ? e.pergunta : '(nenhuma)'}
${e.pergunta && inp.rag.perguntaSemFonte ? 'ATENÇÃO: nenhum trecho recuperado cobre essa dúvida.' : ''}

TRECHOS DAS NORMAS (única fonte permitida)
${trechos}`;

return [{ json: { ...inp, prompt } }];
