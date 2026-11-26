"""Resume a saída de `n8n execute --rawOutput`: veredito, texto do modelo, verificador e traço do RAG."""
import json, sys

t = open(sys.argv[1], encoding="utf-8").read()
d = json.loads(t[t.index("{"):])
run = d["data"]["resultData"]["runData"]
print("status:", d.get("status"))
for nome in ("Montar recusa", "Verificar resposta"):
    if nome in run:
        j = run[nome][0]["data"]["main"][0][0]["json"]
        print("veredito:", j.get("veredito"))
        if "motivos" in j:
            print("motivos:", j["motivos"])
        if "verificador" in j:
            print("verificador:", json.dumps(j["verificador"], ensure_ascii=False))
            print("trechos na janela:", j["traco_rag"]["total_na_janela"], "| busca:", json.dumps(j["traco_rag"]["busca_pergunta"], ensure_ascii=False))
            print("--- texto do modelo ---\n" + j["saida_bruta_do_modelo"])
err = d["data"]["resultData"].get("error")
if err:
    print("ERRO:", json.dumps(err, ensure_ascii=False)[:800])
