// Nó "Ferramenta: aeródromos próximos" (cálculo determinístico, sem modelo).
// Procura no cadastro da ANAC os aeródromos e helipontos até 7 km do local e calcula,
// pela tabela da FRZ (ICA 100-40/2026, Art. 14 e 15, Figuras 2 e 4), a altura máxima
// que não entra na zona de restrição de voo.

const AER = /*__AERODROMOS__*/[];
const DATAS = /*__AERODROMOS_DATAS__*/{};

const inp = $input.first().json;
const { lat, lon } = inp.posicao;
const R = 6371000, rad = d => d * Math.PI / 180;
const dist = (a, b, c, d) => {
  const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// Tabelas da FRZ: [distância limite em m, altura do piso da FRZ em pés] para operação padrão/recreativa
const ZEA = [[1740, 0], [2350, 100], [2960, 200], [3570, 300]];   // aeroporto, fora do cone da pista
const ZAD = [[3550, 0], [4480, 100], [5400, 200], [6320, 300]];   // aeroporto, dentro do cone de aproximação
const ZEH_IFR = [[1740, 0], [2350, 100], [2960, 200], [3570, 300]];
const ZEH_VFR = [[1130, 0], [1740, 100], [2350, 200], [2960, 300]];
const pisoFt = (tab, d) => { for (const [lim, ft] of tab) if (d <= lim) return ft; return 400; };
const ftToM = ft => Math.round(ft * 0.3048);

const perto = [];
for (const a of AER) {
  const d = dist(lat, lon, a[5], a[6]);
  if (d <= 7000) perto.push({ codigo: a[0], nome: a[1], municipio: a[2], uf: a[3],
    tipo: a[4] === 'H' ? 'heliponto' : 'aeródromo', ifr: !!a[7], dist_m: Math.round(d) });
}
perto.sort((a, b) => a.dist_m - b.dist_m);

let limiteFt = 400, limiteZeaFt = 400, causa = null;
for (const p of perto) {
  if (p.tipo === 'heliponto') {
    p.tabela = p.ifr ? 'ZEH (IFR)' : 'ZEH (VFR)';
    p.piso_ft = pisoFt(p.ifr ? ZEH_IFR : ZEH_VFR, p.dist_m);
    p.piso_zea_ft = p.piso_ft;
  } else {
    // o sistema não sabe a direção da pista: usa o pior caso (ZAD) e informa também a ZEA
    p.piso_zea_ft = pisoFt(ZEA, p.dist_m);
    p.piso_ft = Math.min(p.piso_zea_ft, pisoFt(ZAD, p.dist_m));
    p.tabela = 'ZEA/ZAD (pior caso)';
  }
  p.piso_m = ftToM(p.piso_ft);
  if (p.piso_ft < limiteFt) { limiteFt = p.piso_ft; causa = p; }
  limiteZeaFt = Math.min(limiteZeaFt, p.piso_zea_ft);
}

return [{ json: { ...inp, frz: {
  aerodromos_ate_7km: perto.slice(0, 5),
  total_ate_7km: perto.length,
  limite_frz_ft: limiteFt, limite_frz_m: ftToM(limiteFt),
  limite_se_fora_do_cone_ft: limiteZeaFt,
  causa: causa ? `${causa.tipo} ${causa.codigo} ${causa.nome} (${causa.municipio}/${causa.uf}), a ${causa.dist_m} m` : null,
  base_de_dados: DATAS,
} } }];
