// Nó "Regras fixas" (harness). Aqui NÃO há modelo de linguagem.
// Cada regra é um número tirado do texto oficial, com a referência do trecho.
// O veredito sai daqui e o modelo não pode mudá-lo.

const inp = $input.first().json;
const e = inp.entrada, frz = inp.frz;
const recreativa = /^recreativa/i.test(e.finalidade);
const p = e.pilotagem.toLowerCase();
const modo = p.includes('bvlos') ? 'BVLOS' : p.includes('fpv') ? 'FPV_SEM_OBS' : p.includes('evlos') ? 'EVLOS' : 'VLOS';
const visada = modo === 'VLOS' || modo === 'EVLOS';

const checks = [];
const add = (regra, status, detalhe, refs) => checks.push({ regra, status, detalhe, refs });
// status: "ok" | "falha" | "atencao" | "nao_se_aplica"

// RBAC 100 não se aplica a aeromodelo recreativo até 120 m em VLOS/EVLOS, nem a drone de até 250 g até 120 m (100.1 (d) e (e))
const rbacNaoAplica = visada && e.altura_m <= 120 && (recreativa || e.peso_g <= 250);

add('Autorização do DECEA (SARPAS)', 'atencao',
  'Toda aeronave não tripulada precisa de autorização para acessar o espaço aéreo, inclusive as de até 250 g. Este sistema não emite essa autorização.',
  ['Art. 19']);

add('Peso de decolagem até 25 kg', e.peso_g <= 25000 ? 'ok' : 'falha',
  `Peso informado: ${e.peso_g} g. Limite da categoria aberta: 25 kg (inclui carga, combustível e acessórios).`,
  ['Art. 38', '100.5 Categorias de operações de UAS', 'Art. 25']);

const limAlt = recreativa ? 60 : 120;
add(recreativa ? 'Altura máxima recreativa (60 m)' : 'Altura máxima da categoria aberta (120 m)',
  e.altura_m <= limAlt ? 'ok' : 'falha',
  `Altura informada: ${e.altura_m} m. Limite: ${limAlt} m acima do solo${recreativa ? ' para operação recreativa' : ''}.`,
  recreativa ? ['Art. 32', 'Art. 38'] : ['Art. 38', '100.5 Categorias de operações de UAS', 'Art. 25']);

if (recreativa) {
  if (e.dist_piloto_m === null) {
    add('Distância horizontal recreativa (300 m)', 'atencao',
      'Distância até o piloto não informada. Para operação recreativa o limite é de 300 m.', ['Art. 32']);
  } else {
    add('Distância horizontal recreativa (300 m)', e.dist_piloto_m <= 300 ? 'ok' : 'falha',
      `Distância informada: ${e.dist_piloto_m} m. Limite: 300 m.`, ['Art. 32']);
  }
}

const descModo = { VLOS: 'à vista (VLOS)', EVLOS: 'com observador (EVLOS)',
  FPV_SEM_OBS: 'com óculos FPV sem observador, o que conta como BVLOS', BVLOS: 'fora da linha de visada (BVLOS)' }[modo];
add('Linha de visada (VLOS/EVLOS)', visada ? 'ok' : 'falha',
  `Pilotagem ${descModo}.${visada ? '' : ' Operação fora da linha de visada exige segregação do espaço aéreo e não é categoria aberta.'}`,
  ['Art. 24', 'Art. 25', '100.5 Categorias de operações de UAS']);

if (rbacNaoAplica) {
  add('Distância de pessoas não envolvidas (30 m)', 'nao_se_aplica',
    `O RBAC nº 100 não se aplica a ${recreativa ? 'operação recreativa' : 'drone de até 250 g'} até 120 m em VLOS/EVLOS. Distância informada: ${e.dist_pessoas_m} m.`,
    ['100.1 Aplicabilidade']);
} else {
  add('Distância de pessoas não envolvidas (30 m)', e.dist_pessoas_m >= 30 ? 'ok' : 'falha',
    `Distância informada: ${e.dist_pessoas_m} m. A categoria aberta exige área distante de terceiros: no mínimo 30 m de pessoas não envolvidas e não anuentes, salvo barreira de proteção.`,
    ['100.3 Definições (parte 1)', '100.5 Categorias de operações de UAS']);
}

const TAB_AER = 'Art. 14, Figura 2 (tabela FRZ de aeroportos, transcrita)';
const TAB_HEL = 'Art. 15, Figura 4 (tabela FRZ de helipontos, transcrita)';
const tabelas = (frz.causa || '').startsWith('heliponto') ? [TAB_HEL, TAB_AER] : [TAB_AER, TAB_HEL];
if (frz.total_ate_7km === 0) {
  add('Zona de restrição de aeródromo (FRZ)', 'ok',
    'Nenhum aeródromo ou heliponto do cadastro da ANAC a menos de 7 km.', ['Art. 14, Figura 2 (tabela FRZ de aeroportos, transcrita)']);
} else {
  const dentro = e.altura_m > frz.limite_frz_m;
  const soNoCone = dentro && e.altura_m <= Math.round(frz.limite_se_fora_do_cone_ft * 0.3048);
  add('Zona de restrição de aeródromo (FRZ)', dentro ? (soNoCone ? 'atencao' : 'falha') : 'ok',
    `Mais restritivo: ${frz.causa}. Piso da FRZ ali: ${frz.limite_frz_ft} ft (≈${frz.limite_frz_m} m). Altura informada: ${e.altura_m} m.` +
    (dentro ? ' Voar acima do piso entra na FRZ: exige Termo de Coordenação e deixa de ser categoria aberta.' : '') +
    (soNoCone ? ' Só entra na FRZ se o local estiver no cone de aproximação da pista; o sistema não sabe a direção da pista.' : ''),
    [...tabelas, 'Art. 28', 'Art. 38']);
}

const falhas = checks.filter(c => c.status === 'falha');
const veredito = falhas.length
  ? 'FORA DOS LIMITES DA CATEGORIA ABERTA'
  : 'DENTRO DOS LIMITES VERIFICADOS (categoria aberta)';
const consequencia = falhas.length
  ? 'Este voo não se enquadra na categoria aberta. Ele exigiria categoria específica, segregação do espaço aéreo ou coordenação, conforme o item que falhou.'
  : 'Mesmo dentro dos limites verificados, o voo ainda precisa de autorização no SARPAS. Este resultado não é uma autorização.';

const naoVerificado = [
  'Espaços aéreos condicionados (áreas proibidas, restritas, perigosas, TRA/TSA) e rotas especiais de helicóptero',
  'NOTAM, Altitude Limite de Voo e condições meteorológicas',
  'Cadastro do drone, exame teórico do piloto e seguro',
  'Direção da pista dos aeródromos (por isso o cálculo usa o pior caso)',
];

return [{ json: { ...inp, regras: { recreativa, modo, rbacNaoAplica, checks, veredito, consequencia, naoVerificado } } }];
