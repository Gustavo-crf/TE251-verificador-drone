"""Gera data/aerodromos.json a partir dos CSVs de dados abertos da ANAC.

Formato compacto de cada item: [codigo, nome, municipio, UF, tipo, lat, lon, ifr]
tipo: "A" = aerodromo (publico ou privado), "H" = heliponto.
Uso: python3 -I scripts/build_aerodromos.py <pasta_do_projeto>
"""
import csv, json, os, sys, io

base = sys.argv[1]
raw = os.path.join(base, "corpus", "raw")


def rows(fn):
    text = open(os.path.join(raw, fn), encoding="latin-1").read()
    lines = text.splitlines()[1:]  # 1a linha = "Atualizado em/Criado em"
    return csv.DictReader(io.StringIO("\n".join(lines)), delimiter=";"), lines[0:0] or text.splitlines()[0]


def num(v):
    v = (v or "").strip().replace(",", ".")
    try:
        return round(float(v), 5)
    except ValueError:
        return None


out, datas = [], {}
for fn, tipo in [("AerodromosPublicos.csv", "A"), ("AerodromosPrivados.csv", "A"), ("Helipontos.csv", "H")]:
    reader, stamp = rows(fn)
    datas[fn] = stamp.strip()
    n = 0
    for r in reader:
        lat, lon = num(r.get("LATGEOPOINT")), num(r.get("LONGEOPOINT"))
        if lat is None or lon is None or not (-35 < lat < 6 and -75 < lon < -28):
            continue
        cod = (r.get("Código OACI") or r.get("CIAD") or "").strip()
        ifr = 1 if "IFR" in ((r.get("Operação Diurna") or "") + (r.get("Operação Noturna") or "")) else 0
        out.append([cod, (r.get("Nome") or "").strip(), (r.get("Município") or "").strip(),
                    (r.get("UF") or "").strip(), tipo, lat, lon, ifr])
        n += 1
    print(fn, n)

os.makedirs(os.path.join(base, "data"), exist_ok=True)
json.dump({"fonte": "ANAC, dados abertos (cadastro de aeródromos públicos, privados e helipontos)",
           "datas": datas, "itens": out},
          open(os.path.join(base, "data", "aerodromos.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print("total", len(out), datas)
