"""Cria uma variante do workflow para rodar pela CLI do n8n (n8n execute), sem formulário.

O nó "Formulário de voo" vira um Code que devolve o caso de teste; as páginas finais viram NoOp.
Uso: python3 -I tests/make_cli_variant.py n8n/workflow.json tests/casos.json <indice> <saida.json>
"""
import json, sys, uuid

wf = json.load(open(sys.argv[1], encoding="utf-8"))
caso = json.load(open(sys.argv[2], encoding="utf-8"))[int(sys.argv[3])]
form = dict(caso["form"])

for n in wf["nodes"]:
    if n["name"] == "Formulário de voo":
        n["type"], n["typeVersion"] = "n8n-nodes-base.code", 2
        n["parameters"] = {"jsCode": "return [{ json: " + json.dumps(form, ensure_ascii=False) + " }];"}
        n.pop("webhookId", None)
    elif n["type"] == "n8n-nodes-base.form":
        n["type"], n["typeVersion"], n["parameters"] = "n8n-nodes-base.noOp", 1, {}

wf["nodes"].append({"parameters": {}, "id": str(uuid.uuid4()), "name": "Início (teste)",
                    "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [-220, 0]})
wf["connections"]["Início (teste)"] = {"main": [[{"node": "Formulário de voo", "type": "main", "index": 0}]]}
wf["name"] = "TESTE CLI - " + caso["nome"][:60]
wf["id"] = "testecli" + sys.argv[3].zfill(8)
json.dump(wf, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False)
print("ok", wf["id"])
