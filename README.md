# Verificador de voo de drone (TE-251, Exame 2026.2)

Fluxo n8n que recebe um voo de drone pretendido (local, altura, peso, finalidade, modo de pilotagem,
distância de pessoas) e responde se ele fica **dentro ou fora dos limites da categoria aberta**, citando
os trechos das normas brasileiras em vigor. **Não é autorização de voo**: a autorização é do DECEA, pelo SARPAS.

## Técnicas da disciplina usadas

| Técnica | Onde está |
|---|---|
| RAG com citação | `Recuperar trechos (RAG)`: BM25 sobre 159 trechos (um por artigo/seção) do RBAC nº 100 e da ICA 100-40/2026; o texto final cita `[T###]` |
| RAG com avaliação | `Verificar resposta`: confere citações, números e frases proibidas antes de mostrar o texto do modelo |
| Context Engineering | `Montar prompt`: só entram na janela os trechos das regras que rodaram e até 3 trechos da busca; o traço fica registrado |
| Harness | `Validar entrada` (parada), `Regras fixas` (o veredito é calculado em código, não pelo modelo), `Verificar resposta` (descarta a explicação ruim) |
| Agente com ferramenta / ferramenta | `Ferramenta: aeródromos próximos`: distância até 6.081 aeródromos e helipontos do cadastro da ANAC e piso da FRZ |
| Fluxo n8n com modelo, ferramenta e parada | formulário → validação → (parada) ou ferramenta → regras → RAG → modelo → verificador → resultado |

## O que o modelo decide e o que o sistema força

- **O modelo decide** só a redação da explicação e da resposta à dúvida.
- **O sistema força**: o veredito (regras em código), quais trechos o modelo vê, que toda frase cite um trecho
  da janela, que todo número tenha apoio no trecho citado ou nos dados digitados, que o texto nunca diga
  "autorizado/liberado", e a resposta "não está no material" quando a busca não cobre a dúvida.

## Fontes

- RBAC nº 100, Emenda 00 — ANAC, Resolução nº 805/2026 (`corpus/raw/RBAC100EMD00.pdf`)
  https://pergamum.anac.gov.br/pergamum/vinculos/RBAC100EMD00.pdf
- ICA 100-40/2026 — DECEA, Portaria nº 2.094/DNOR8, vigência 01/07/2026 (`corpus/raw/ICA100-40_2026.pdf`)
  https://www.gov.br/defesa/pt-br/assuntos/aerolevantamento/arquivos/2026/ica-100-40-publicada-port-2094-dnor8-18-03-2026-bca-058-30-03-2026.pdf
- Cadastro de aeródromos públicos, privados e helipontos — ANAC, dados abertos (baixados em 26/11/2026)
  https://sistemas.anac.gov.br/dadosabertos/Aerodromos/
- As tabelas das FRZ (Figuras 2 e 4 da ICA) são imagens no PDF; foram transcritas à mão em `scripts/build_corpus.py`.

## Como rodar

Pré-requisitos: Docker Desktop e uma chave do Groq (camada gratuita).

1. Suba o n8n (uma vez):
   ```bash
   docker volume create n8n_data
   docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
   ```
2. Abra http://localhost:5678, crie a conta local e importe `n8n/workflow.json` (menu ⋯ → Import from File).
3. No nó **Groq**, crie a credencial com a sua chave (nunca coloque a chave em arquivo do repositório).
   Modelo usado nos testes: `openai/gpt-oss-20b`, temperatura 1, até 3500 tokens de saída.
4. Clique em **Publish** e abra o formulário: http://localhost:5678/form/verificar-voo-drone

O formulário aceita endereço ("Parque X, Cidade, UF", geocodificado pelo OpenStreetMap/Nominatim, precisa de internet)
ou coordenadas `-23.1925, -45.8930` (não usa o geocodificador).

## Casos de teste

`tests/casos.json` tem os casos da apresentação. Para rodar só a parte determinística (sem modelo):

```bash
docker cp n8n/workflow.json n8n:/tmp/ex.json
docker cp tests/run_offline.js n8n:/tmp/run.js
docker cp tests/casos.json n8n:/tmp/casos.json
docker exec n8n node /tmp/run.js /tmp/ex.json /tmp/casos.json
```

Para rodar um caso com o modelo de verdade, pela CLI do n8n: `sh tests/rodar_caso.sh <indice> <pasta_temporaria>`.

## Regerar os dados

```bash
python3 scripts/build_corpus.py .        # corpus/chunks.json a partir de corpus/txt
python3 scripts/build_aerodromos.py .    # data/aerodromos.json a partir dos CSVs da ANAC
python3 scripts/build_workflow.py .      # n8n/workflow.json (sem credencial)
```

## Limites conhecidos (detalhados no artigo)

- Não verifica espaços aéreos condicionados, NOTAM, Altitude Limite de Voo, meteorologia, cadastro, exame do piloto nem seguro.
- Não sabe a direção das pistas: para aeródromos usa o pior caso entre ZEA e ZAD.
- Considera que todo aeródromo e heliponto do cadastro tem FRZ pelo modelo das Figuras 2 e 4.
- O verificador confere citações e números, não o sentido da frase: uma frase com citação válida pode afirmar algo que o trecho não diz.
- A camada gratuita do Groq limita a cerca de 8.000 tokens por minuto; cada consulta usa ~3.000 a 4.000.

Ferramenta acadêmica. Não substitui a consulta ao SARPAS/DECEA e à ANAC.
