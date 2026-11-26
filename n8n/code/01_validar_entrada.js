// Nó "Validar entrada" (harness de entrada).
// Lê o formulário e o resultado da geocodificação. Decide, sem modelo, se dá para avaliar.
// Se faltar dado ou o local não for encontrado no Brasil, marca parar=true e o fluxo
// vai para a página "Não é possível avaliar".

const f = $('Formulário de voo').first().json;
const geoItems = $('Geocodificar local').all().map(i => i.json);
const pick = (...keys) => { for (const k of keys) if (f[k] !== undefined && f[k] !== '') return f[k]; return undefined; };
const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const x = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};

const local = String(pick('local', 'Local do voo') ?? '').trim();
const finalidade = String(pick('finalidade', 'Finalidade do voo') ?? '').trim();
const pilotagem = String(pick('pilotagem', 'Como o drone será pilotado') ?? '').trim();
const altura = num(pick('altura_m', 'Altura máxima pretendida (m)'));
const pesoG = num(pick('peso_g', 'Peso de decolagem do drone (g)'));
const distPessoas = num(pick('dist_pessoas_m', 'Distância das pessoas não envolvidas mais próximas (m)'));
const distPiloto = num(pick('dist_piloto_m', 'Distância horizontal máxima do drone até o piloto (m)'));
const pergunta = String(pick('pergunta', 'Dúvida sobre as regras (opcional)') ?? '').trim();

const motivos = [];
if (!local) motivos.push('O local do voo não foi informado.');
if (!finalidade) motivos.push('A finalidade do voo não foi informada.');
if (!pilotagem) motivos.push('O modo de pilotagem não foi informado.');
if (altura === null || altura <= 0) motivos.push('A altura pretendida precisa ser um número maior que zero.');
if (altura !== null && altura > 3000) motivos.push('Altura acima de 3000 m está fora do que este sistema avalia.');
if (pesoG === null || pesoG <= 0) motivos.push('O peso do drone precisa ser um número maior que zero, em gramas.');
if (distPessoas === null || distPessoas < 0) motivos.push('A distância das pessoas precisa ser um número (0 ou mais), em metros.');

// Local: coordenadas digitadas ("-23.2289, -45.8711") ou resultado do geocodificador
let lat = null, lon = null, localEncontrado = '', origemLocal = '';
const m = local.match(/^\s*(-?\d{1,2}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)\s*$/);
if (m) {
  lat = parseFloat(m[1]); lon = parseFloat(m[2]);
  localEncontrado = `coordenadas ${lat.toFixed(5)}, ${lon.toFixed(5)}`; origemLocal = 'coordenadas digitadas';
} else {
  const g = geoItems.find(x => x && x.lat && x.lon);
  if (g) {
    lat = parseFloat(g.lat); lon = parseFloat(g.lon);
    localEncontrado = g.display_name || local; origemLocal = 'OpenStreetMap (Nominatim)';
  }
}
if (local && (lat === null || lon === null)) {
  motivos.push(`O local "${local}" não foi encontrado. Tente "bairro, cidade, UF" ou coordenadas no formato -23.2289, -45.8711.`);
}
const noBrasil = (a, b) => a > -34.5 && a < 5.5 && b > -74.5 && b < -28.5;
if (lat !== null && !noBrasil(lat, lon)) {
  let dica = '';
  if (noBrasil(-lat, lon) || noBrasil(lat, -lon) || noBrasil(-lat, -lon)) dica = ' Parece que faltou o sinal de menos: no Brasil a latitude (quase sempre) e a longitude são negativas, por exemplo -23.1925, -45.8930.';
  else if (noBrasil(lon, lat)) dica = ' Parece que latitude e longitude estão trocadas: escreva primeiro a latitude, por exemplo -23.1925, -45.8930.';
  motivos.push('O local fica fora do Brasil; as normas carregadas só valem para o espaço aéreo brasileiro.' + dica);
}

return [{ json: {
  parar: motivos.length > 0,
  motivos,
  entrada: { local, finalidade, pilotagem, altura_m: altura, peso_g: pesoG,
             dist_pessoas_m: distPessoas, dist_piloto_m: distPiloto, pergunta },
  posicao: { lat, lon, localEncontrado, origemLocal },
} }];
