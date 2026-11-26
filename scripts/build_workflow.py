"""Monta n8n/workflow.json a partir de n8n/code/*.js, corpus/chunks.json e data/aerodromos.json.

Uso: python3 -I scripts/build_workflow.py <pasta_do_projeto> [id_credencial_groq] [nome_credencial_groq]
Sem id de credencial, o JSON sai sem credencial (quem importar escolhe a sua no nó do Groq).
"""
import json, os, sys, uuid

base = sys.argv[1]
cred_id = sys.argv[2] if len(sys.argv) > 2 else None
cred_name = sys.argv[3] if len(sys.argv) > 3 else "Groq account"
code = lambda n: open(os.path.join(base, "n8n", "code", n), encoding="utf-8").read()

chunks = json.load(open(os.path.join(base, "corpus", "chunks.json"), encoding="utf-8"))
aer = json.load(open(os.path.join(base, "data", "aerodromos.json"), encoding="utf-8"))

c02 = code("02_aerodromo_proximo.js") \
    .replace("/*__AERODROMOS__*/[]", json.dumps(aer["itens"], ensure_ascii=False, separators=(",", ":"))) \
    .replace("/*__AERODROMOS_DATAS__*/{}", json.dumps(aer["datas"], ensure_ascii=False))
c04 = code("04_recuperar_trechos.js").replace("/*__CHUNKS__*/[]", json.dumps(chunks, ensure_ascii=False))

SYSTEM = """Você explica, em português, o resultado de uma verificação de voo de drone.
Regras obrigatórias:
1. O VEREDITO e a APLICABILIDADE já foram decididos pelo sistema. Não os altere, não os contradiga e nunca diga que o voo está autorizado ou liberado: a autorização é do DECEA, pelo SARPAS.
2. Use somente os TRECHOS DAS NORMAS fornecidos. Cite cada afirmação com o id do trecho entre colchetes, por exemplo [T037].
3. Não escreva nenhum número que não esteja no caso ou nos trechos.
4. Se a APLICABILIDADE diz que o RBAC nº 100 não se aplica, nenhum requisito do RBAC nº 100 vale para este voo; se a dúvida for sobre um requisito do RBAC nº 100, diga que ele não se aplica a este voo e cite o trecho de aplicabilidade.
5. Se não houver dúvida do usuário, escreva "DÚVIDA: (nenhuma)". Se a dúvida não puder ser respondida pelos trechos, responda exatamente: não está no material.
Formato da resposta (só isto):
EXPLICAÇÃO: até 5 frases explicando por que o resultado foi esse, com base nas REGRAS VERIFICADAS (não na dúvida), citando os trechos.
DÚVIDA: resposta em até 3 frases, citando os trechos, ou "não está no material"."""

L, B = "@n8n/n8n-nodes-langchain.", "n8n-nodes-base."
def node(name, typ, ver, pos, params, **extra):
    n = {"parameters": params, "id": str(uuid.uuid4()), "name": name, "type": typ, "typeVersion": ver, "position": pos}
    n.update(extra); return n

def field(label, name, ftype="text", req=True, ph="", opts=None):
    f = {"fieldLabel": label, "fieldName": name, "fieldType": ftype, "requiredField": req}
    if ph: f["placeholder"] = ph
    if opts: f["fieldOptions"] = {"values": [{"option": o} for o in opts]}
    return f

FIN = ["Recreativa (lazer)", "Não recreativa (trabalho, foto, inspeção etc.)"]
PIL = ["Vendo o drone a olho nu (VLOS)", "Com observador ajudando a ver o drone (EVLOS)",
       "Com óculos FPV, sem observador", "Fora da vista do piloto (BVLOS)"]

form = node("Formulário de voo", B + "formTrigger", 2.6, [0, 0], {
    "formTitle": "Verificador de voo de drone (TE-251)",
    "formDescription": "Informe o voo pretendido. O sistema confere os limites do RBAC nº 100 (ANAC) e da ICA 100-40/2026 (DECEA), "
                       "procura aeródromos próximos no cadastro da ANAC e cita os trechos das normas. Não é autorização de voo.",
    "formFields": {"values": [
        field("Local do voo", "local", ph="Ex.: Praça Afonso Pena, São José dos Campos, SP  ou  -23.2289, -45.8711"),
        field("Finalidade do voo", "finalidade", "dropdown", opts=FIN),
        field("Como o drone será pilotado", "pilotagem", "dropdown", opts=PIL),
        field("Altura máxima pretendida (m)", "altura_m", "number", ph="Ex.: 50"),
        field("Peso de decolagem do drone (g)", "peso_g", "number", ph="Ex.: 249 ou 900"),
        field("Distância das pessoas não envolvidas mais próximas (m)", "dist_pessoas_m", "number", ph="Ex.: 40"),
        field("Distância horizontal máxima do drone até o piloto (m)", "dist_piloto_m", "number", req=False, ph="Ex.: 150"),
        field("Dúvida sobre as regras (opcional)", "pergunta", "textarea", req=False, ph="Ex.: preciso de seguro?"),
    ]},
    "responseMode": "lastNode",
    "options": {"buttonLabel": "Verificar", "path": "verificar-voo-drone", "appendAttribution": False},
}, webhookId=str(uuid.uuid4()))

geo = node("Geocodificar local", B + "httpRequest", 4.2, [220, 0], {
    "url": "https://nominatim.openstreetmap.org/search",
    "sendQuery": True, "queryParameters": {"parameters": [
        {"name": "q", "value": "={{ $json.local }}"}, {"name": "format", "value": "jsonv2"},
        {"name": "limit", "value": "1"}, {"name": "countrycodes", "value": "br"}]},
    "sendHeaders": True, "headerParameters": {"parameters": [
        {"name": "User-Agent", "value": "TE251-verificador-drone/1.0 (projeto academico)"}]},
    "options": {"timeout": 10000},
}, alwaysOutputData=True, onError="continueRegularOutput")

def codenode(name, js, pos):
    return node(name, B + "code", 2, pos, {"jsCode": js})

val = codenode("Validar entrada", code("01_validar_entrada.js"), [440, 0])
cond = node("Dá para avaliar?", B + "if", 2.2, [660, 0], {
    "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                   "conditions": [{"id": str(uuid.uuid4()), "leftValue": "={{ $json.parar }}", "rightValue": "",
                                   "operator": {"type": "boolean", "operation": "false", "singleValue": True}}],
                   "combinator": "and"}, "options": {}})
aer_n = codenode("Ferramenta: aeródromos próximos", c02, [880, -120])
reg = codenode("Regras fixas", code("03_regras_fixas.js"), [1100, -120])
rag = codenode("Recuperar trechos (RAG)", c04, [1320, -120])
pr = codenode("Montar prompt", code("05_montar_prompt.js"), [1540, -120])
MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
llm = node("Redator", L + "chainLlm", 1.9, [1760, -120], {
    "promptType": "define", "text": "={{ $json.prompt }}", "hasOutputParser": False,
    "messages": {"messageValues": [{"type": "SystemMessagePromptTemplate", "message": SYSTEM}]}},
    retryOnFail=True, maxTries=3, waitBetweenTries=5000, onError="continueRegularOutput")
groq = node("Groq", L + "lmChatGroq", 1, [1760, 100], {"model": MODEL,
            "options": {"temperature": 1, "maxTokensToSample": 3500}})
if cred_id:
    groq["credentials"] = {"groqApi": {"id": cred_id, "name": cred_name}}
ver = codenode("Verificar resposta", code("06_verificar_resposta.js"), [2060, -120])
fim = node("Resultado", B + "form", 2.5, [2280, -120], {
    "operation": "completion", "respondWith": "showText", "responseText": "={{ $json.html }}"})
rec = codenode("Montar recusa", code("00_nao_avaliavel.js"), [880, 140])
fim2 = node("Não é possível avaliar", B + "form", 2.5, [1100, 140], {
    "operation": "completion", "respondWith": "showText", "responseText": "={{ $json.html }}"})

nodes = [form, geo, val, cond, aer_n, reg, rag, pr, llm, groq, ver, fim, rec, fim2]
m = lambda a, b, i=0: {a: {"main": [[{"node": b, "type": "main", "index": 0}]]}}
conn = {}
for a, b in [("Formulário de voo", "Geocodificar local"), ("Geocodificar local", "Validar entrada"),
             ("Validar entrada", "Dá para avaliar?"), ("Ferramenta: aeródromos próximos", "Regras fixas"),
             ("Regras fixas", "Recuperar trechos (RAG)"), ("Recuperar trechos (RAG)", "Montar prompt"),
             ("Montar prompt", "Redator"), ("Redator", "Verificar resposta"), ("Verificar resposta", "Resultado"),
             ("Montar recusa", "Não é possível avaliar")]:
    conn.update(m(a, b))
conn["Dá para avaliar?"] = {"main": [[{"node": "Ferramenta: aeródromos próximos", "type": "main", "index": 0}],
                                     [{"node": "Montar recusa", "type": "main", "index": 0}]]}
conn["Groq"] = {"ai_languageModel": [[{"node": "Redator", "type": "ai_languageModel", "index": 0}]]}

wf = {"name": "TE251 Exame - Verificador de voo de drone", "nodes": nodes, "connections": conn,
      "settings": {"executionOrder": "v1"}, "active": False, "pinData": {}}
out = os.path.join(base, "n8n", "workflow.json")
json.dump(wf, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", out, os.path.getsize(out) // 1024, "KB")
