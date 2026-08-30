# PEP - Predicted Exploit Probability (Alyra, Bloc 3)

Service scikit-learn qui produit, pour chaque CVE, une **probabilite calibree [0-1] qu'un exploit public
existe**, a partir des seules caracteristiques intrinseques de la faille (CVSS, CWE, description, produit).

> Depot **jury** (version epuree) : le notebook, le code source, le front et la partie MLOps (Docker).
> Les **donnees lourdes ne sont pas incluses** (voir plus bas) ; le notebook est **livre pre-execute**
> (toutes les figures et tous les chiffres sont visibles a l'ouverture, sans rien relancer).

## Contenu

```
notebooks/pipeline_ml.ipynb   le livrable ML (EDA -> preproc -> modeles -> calibration -> evaluation)
src/cve_exploit/              le code partage : features (JSON->tabulaire), dataset, train, score,
                              api (FastAPI), batch/enrich (masse), monitor (derive), retrain
frontend/                     application React + Vite + Tailwind (jauge PEP, analyse, drift)
Dockerfile, docker-compose.yml   deploiement : db (Postgres) + api (:8000) + front (:5173)
docs/                         lancer.md (guide operationnel)
```

## Prerequis

- [uv](https://docs.astral.sh/uv/) (Astral), Python 3.12 (gere par uv).

```bash
uv sync                       # installe toutes les dependances (dont le paquet local cve_exploit)
```

## Lancer le notebook

```bash
uv run jupyter lab            # ouvrir notebooks/pipeline_ml.ipynb
```

Le notebook s'ouvre **avec ses sorties** : rien a relancer pour voir les resultats. Pour le **re-executer**,
il faut le jeu de donnees (voir "Donnees non incluses").

## Lancer l'application (API + front)

```bash
# 1) entrainer une fois le modele (necessite le dataset, cf. ci-dessous) -> models/model.joblib
uv run python -m cve_exploit.train
# 2) tout demarrer (db + api + front)
docker compose up --build     # front: http://localhost:5173  |  api: http://localhost:8000
```

Scorer une CVE fournie en JSON (API) :

```bash
curl -X POST http://127.0.0.1:8000/score -H 'Content-Type: application/json' -d @ma_cve.json
# ma_cve.json = une fiche CVE au format du feed (voir features_feed.py) ou au schema NVD (features_nvd.py)
```

## Donnees non incluses (a fournir pour re-executer)

Volontairement hors du depot (taille / confidentialite) :

- **`cve_threat_intel/`** - le feed brut (~370 000 fichiers JSON, ~4,9 Go). Source des features.
- **`data/dataset_soutenance.parquet`** - le jeu de donnees pre-bati (~54 Mo), produit a partir du feed.
- **`models/model.joblib`** - l'artefact entraine (produit par `cve_exploit.train`).

Pour reconstituer la chaine : placer le feed dans `cve_threat_intel/`, puis
`uv run python -m cve_exploit.dataset` (construit le parquet) et `uv run python -m cve_exploit.train`.

## Verdict honnete (resume)

Classification de l'**existence** d'un exploit : ROC-AUC **0,905**, PR-AUC **0,818**, Brier **0,103**
(test 2025, jamais vu). Le score est surtout **descriptif** (92 % des exploits existent deja a T0). Valeur
reelle : trier la **zone aveugle d'EPSS** (~10 300 CVE exploitees notees < 0,01, ~x14 le hasard) +
explicabilite + hors-ligne.
