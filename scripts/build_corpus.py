"""Gera corpus/chunks.json a partir do texto extraido dos PDFs oficiais.

Cada trecho guarda: id, fonte (norma e versao), ref (artigo/secao citavel) e texto.
Uso: python3 -I scripts/build_corpus.py <pasta_do_projeto>
"""
import json, re, sys, os

base = sys.argv[1]
txt = os.path.join(base, "corpus", "txt")

ICA_SRC = "ICA 100-40/2026 (DECEA, Portaria nº 2.094/DNOR8, vigência 01/07/2026)"
RBAC_SRC = "RBAC nº 100, Emenda 00 (ANAC, Resolução nº 805/2026)"


def clean(s):
    s = re.sub(r"<<<PAGINA \d+>>>", " ", s)
    s = re.sub(r"https://www\.anac\.gov\.br/\S+\s*\d+/\d+", " ", s)  # rodape do RBAC
    s = re.sub(r"\d{2}/\d{2}/\d{4},? \d{2}:\d{2}\s+RBAC.*?\n", " ", s)  # cabecalho do RBAC
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\n\s*", "\n", s)
    return s.strip()


def split_long(ref, text, limit=320):
    words = text.split()
    if len(words) <= limit:
        return [(ref, text)]
    parts, cur = [], []
    for line in text.split("\n"):
        cur.append(line)
        if len(" ".join(cur).split()) >= limit:
            parts.append("\n".join(cur)); cur = []
    if cur:
        parts.append("\n".join(cur))
    return [(f"{ref} (parte {i+1})", p) for i, p in enumerate(parts)]


chunks = []

# ---------- ICA 100-40 ----------
ica = open(os.path.join(txt, "ICA100-40_2026.txt"), encoding="utf-8").read()
body = ica[ica.index("Art. 1º  Esta Portaria"):]
body = body[: body.find("ANEXO II")] if "ANEXO II" in body else body
body = clean(body)
# fatia por artigo
pieces = re.split(r"\n(?=Art\. ?\d+[º°]?\.? )", "\n" + body)
for p in pieces:
    p = p.strip()
    m = re.match(r"Art\. ?(\d+)", p)
    if not m:
        continue
    # remove titulos de capitulo/secao que ficam no fim do artigo anterior
    p = re.sub(r"\n(CAPÍTULO [IVX]+|Seção [IVX]+|Subseção [IVX]+)\n.*$", "", p, flags=re.S)
    for ref, t in split_long(f"Art. {m.group(1)}", p):
        chunks.append({"fonte": ICA_SRC, "ref": ref, "texto": t})

# trecho manual: tabelas das Figuras 2 e 4 (imagem no PDF, transcrita)
chunks.append({
    "fonte": ICA_SRC,
    "ref": "Art. 14, Figura 2 (tabela FRZ de aeroportos, transcrita)",
    "texto": (
        "FRZ - Zona de Restrição de Voo de aeroportos. Coluna IFR e VFR (1) = operação padrão, aerolevantamento, "
        "aeroagrícola, atípica e recreativa. ZEA (Zona de Entorno de Aeródromo): setor A, altura 0 ft, até 1740 m; "
        "setor B, 100 ft, além de 1740 m; setor C, 200 ft, além de 2350 m; setor D, 300 ft, além de 2960 m; "
        "setor E, 400 ft, além de 3570 m. ZAD (zona de aproximação e decolagem, cone de 20 graus a partir da "
        "cabeceira, alinhado com a pista): setor F, 0 ft, até 3550 m; setor G, 100 ft, além de 3550 m; setor H, "
        "200 ft, além de 4480 m; setor I, 300 ft, além de 5400 m; setor J, 400 ft, além de 6320 m."
    ),
})
chunks.append({
    "fonte": ICA_SRC,
    "ref": "Art. 15, Figura 4 (tabela FRZ de helipontos, transcrita)",
    "texto": (
        "FRZ - Zona de Restrição de Voo de helipontos. ZEH (Zona de Entorno de Heliponto). Coluna IFR (1) = "
        "operação padrão, aerolevantamento, aeroagrícola, atípica e recreativa: setor A, 0 ft, até 1740 m; "
        "setor B, 100 ft, além de 1740 m; setor C, 200 ft, além de 2350 m; setor D, 300 ft, além de 2960 m; "
        "setor E, 400 ft, além de 3570 m. Coluna VFR (3) = operação padrão, aerolevantamento, aeroagrícola, "
        "atípica, recreativa e aérea especial: setor A, 0 ft, até 1130 m; B, 100 ft, além de 1130 m; "
        "C, 200 ft, além de 1740 m; D, 300 ft, além de 2350 m; E, 400 ft, além de 2960 m."
    ),
})

# ---------- RBAC 100 ----------
rb = open(os.path.join(txt, "RBAC100EMD00.txt"), encoding="utf-8").read()
start = rb.index("100.1 Aplicabilidade\n(a)")
rbody = clean(rb[start:])
heads = list(re.finditer(r"\n(100\.\d{1,3}) ([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]{3,120})\n", "\n" + rbody))
for i, h in enumerate(heads):
    end = heads[i + 1].start() if i + 1 < len(heads) else len(rbody) + 1
    seg = ("\n" + rbody)[h.start():end].strip()
    seg = re.sub(r"\nSUBPARTE [A-Z].*$", "", seg, flags=re.S)
    for ref, t in split_long(f"{h.group(1)} {h.group(2).strip()}", seg):
        chunks.append({"fonte": RBAC_SRC, "ref": ref, "texto": t})

for i, c in enumerate(chunks):
    c["id"] = f"T{i+1:03d}"
json.dump(chunks, open(os.path.join(base, "corpus", "chunks.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print(len(chunks), "trechos;", sum(len(c["texto"].split()) for c in chunks), "palavras")
for c in chunks[:3] + chunks[-3:]:
    print(c["id"], c["ref"], "|", c["texto"][:90].replace("\n", " "))
