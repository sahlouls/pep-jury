# Comment lancer le projet

> Guide operationnel : installer, entrainer, scorer, servir l'API, enrichir un bundle.
> Tout passe par **`uv`** (rien a activer a la main). Depuis la racine du repo.
> Sections marquees *(Phase A/B - a venir)* seront completees au fil du build (voir
> `docs/plan-service-monitoring.md`).

## 0. Prerequis

- **uv** (Astral) installe. Python 3.12 est gere par uv.
- Le dossier **`cve_threat_intel/`** (370k JSON, git-ignore) present a la racine pour
  (re)construire le dataset ou enrichir un bundle. Pas necessaire pour scorer une CVE fournie en JSON.

```bash
uv sync            # installe toutes les dependances depuis uv.lock
```

## 1. Construire le dataset (offline)

Parse les JSON -> `data/dataset.parquet` (features + labels). A refaire quand les donnees changent.

```bash
uv run python -m cve_exploit.dataset --limit 5000   # echantillon rapide (test)
uv run python -m cve_exploit.dataset                # dataset complet (~370k, plusieurs minutes)
```

## 2. Entrainer le modele

Entraine le pipeline calibre (LogReg + texte, CalibratedClassifierCV sigmoide) -> `models/model.joblib`
+ sidecar `models/model_meta.json` (metriques, **model_version de l'artefact**, distribution PEP de reference).

```bash
uv run python -m cve_exploit.train                  # echantillon d'entrainement par defaut (150k)
uv run python -m cve_exploit.train --train-sample 20000   # plus rapide (pedagogie / debug)
```

Verifier l'artefact produit :

```bash
uv run python -c "import json;m=json.load(open('models/model_meta.json'));print(m['model_version'], m['roc_auc'])"
# -> cve-exploit@<git>+<date>+369677rows-<sig>  0.92  (modele livre L2, C=0.1)
```

> `model_version` = **code + date d'entrainement + revision des donnees**. Il change a chaque
> re-entrainement sur de nouvelles donnees (indispensable au champion/challenger et au suivi du drift).
> La partie "code" utilise `git describe` si le repo est sous git, sinon retombe sur la version du package.

## 3. Scorer une CVE (bibliotheque Python)

```bash
uv run python -c "
import json
from cve_exploit.score import score_cve
cve = json.load(open('cve_threat_intel/CVE-2021-44228.json'))   # exemple : Log4Shell
print(score_cve(cve))
# -> {'cve': 'CVE-...', 'pep': 0.9x, 'reliability': 'ok', 'immature': False,
#     'immaturity_reasons': [], 'model_version': '...', 'signals': [...]}
# fiche sans desc/CVSS/CWE -> {'pep': None, 'reliability': 'insufficient',
#                              'verdict': 'pas assez d'informations pour juger cette CVE'}
"
```

`pep` = Predicted Exploit Probability (proba calibree [0-1] qu'un exploit public existe).
`reliability` : `ok` / `low` (fiche immature -> estimation peu fiable) / `insufficient` (pas assez d'info
-> pas de score, `pep=None`). On ne renvoie jamais un chiffre trompeur sur une fiche vide.

## 4. Lancer l'API REST

```bash
uv run uvicorn cve_exploit.api:app --reload          # http://127.0.0.1:8000  (docs: /docs)
```

Endpoints actuels :

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/score/CVE-2021-44228                 # CVE lue dans cve_threat_intel/
curl -X POST http://127.0.0.1:8000/score \
     -H 'Content-Type: application/json' \
     -d @cve_threat_intel/CVE-2021-44228.json                   # CVE fournie en JSON
```

Lecture de la DB (pour le dashboard ; DB requise) :

```bash
curl "http://127.0.0.1:8000/drift?days=30"          # tendance PSI/Brier + alertes ouvertes
curl http://127.0.0.1:8000/history/CVE-2021-44228   # etat courant + serie PEP/label d'une CVE
```

Variable d'env : `CVE_DATA_DIR` (defaut `cve_threat_intel`) = ou l'API lit les CVE par identifiant.

## 5. Enrichir en masse (batch / bundle)

### Enrichir la base locale (colonne PEP en parquet)

```bash
uv run python -m cve_exploit.batch --limit 3000     # echantillon
uv run python -m cve_exploit.batch                  # base complete
```

### Enrichir un bundle -> memes JSON + champ `specific.pep`

```bash
uv run python -m cve_exploit.enrich --in cve_threat_intel --out cve_threat_intel_pep
uv run python -m cve_exploit.enrich --in bundle.tar.gz --out bundle_pep.tar.gz
```

Chaque CVE recoit `specific.pep = {score, reliability, modelVersion, computedAt}` (score=None si
`reliability=insufficient` : fiche sans description ni CVSS ni CWE -> on ne juge pas).
C'est la voie **gros volume** (370k / 6h). L'API/GUI reste limitee a **20 CVE** par appel interactif.

## 6. Re-entrainer (champion/challenger)

Entraine un candidat, le compare au champion sur le meme hold-out, ne le promeut que s'il est meilleur.

```bash
uv run python -m cve_exploit.retrain                # sur data/dataset.parquet existant
uv run python -m cve_exploit.retrain --rebuild      # reconstruit le dataset depuis le bundle d'abord
```

Cadence conseillee ~6 mois, ou declenchee par une alerte de drift (voir section 8).

---

## 7. Enrichissement 1..20 CVE + interface graphique *(Phase B - a venir)*

- `POST /enrich` : 1..20 CVE en JSON -> memes JSON enrichis du champ `pep`.
- Front React/Vite/Tailwind (`frontend/`) : coller/uploader du JSON -> jauge PEP + JSON enrichi.

## 8. Base de donnees + monitoring de drift

### Demarrer la DB et creer les tables *(Phase A - fait)*

```bash
cp .env.example .env                 # DATABASE_URL (defaut = Postgres local du docker-compose)
docker compose up -d db              # Postgres sur localhost:5432
uv run python -m cve_exploit.db      # cree les 4 tables (idempotent) + recap des lignes
```

Tables : `pep_current` (etat courant), `pep_history` (append seulement sur changement = le diff
des CVE), `drift_daily` (tendance PSI + Brier glissant), `drift_alert` (alerte au franchissement
de seuil).

### Monitoring de drift *(Phase A - fait : monitor.py)*

A lancer apres chaque bundle (cadence ~6h). Score le bundle -> historise le diff (pep_current /
pep_history) -> PSI (distribution des PEP vs reference d'entrainement) + Brier glissant (cohorte
muree >= 90j) -> ecrit `drift_daily` (1 ligne/jour) et leve une `drift_alert` au franchissement de
seuil (PSI > 0.2 ou Brier glissant > 1.2x le Brier de reference). Idempotent par jour.

**`--in` accepte un DOSSIER de `*.json` OU une archive `.tar.gz`** (extraction + recherche des JSON
automatiques, meme imbriques). Le bundle peut etre n'importe ou : on passe juste son chemin.

Options :

| Option | Role |
|---|---|
| `--in <dossier\|.tar.gz>` | source : le bundle (dossier ou archive) |
| `--day YYYY-MM-DD` | date du bundle (defaut : aujourd'hui) -> 1 point de la courbe |
| `--reset` | vide les 4 tables avant (repartir propre) |
| `--every K` | echantillon **DETERMINISTE** : 1 CVE sur K (memes CVE chaque jour) -> multi-jours |
| `--sample N` | echantillon **ALEATOIRE** de N CVE (un seul jour ; sinon fausse les diffs) |
| `--limit N` | les N premiers fichiers (debug uniquement) |

```bash
docker compose up -d db                                                 # DB requise
uv run python -m cve_exploit.monitor --in cve_threat_intel              # bundle complet, aujourd'hui
uv run python -m cve_exploit.monitor --in bundle.tar.gz --reset --every 10   # archive, ~1/10, propre
```

**Construire une vraie serie sur plusieurs jours** (courbe du dashboard) : rejouer les bundles du
plus ancien au plus recent, `--reset` **seulement le premier**, meme `--every` partout, `--day` = la
date de chaque bundle. `--every K` est indispensable ici : il garde **les memes CVE** chaque jour, donc
les diffs (n_new / n_flipped) sont **reels** (une CVE ajoutee ou un exploit apparu = vrai changement).

```bash
uv run python -m cve_exploit.monitor --in bundle_2026-07-06.tar.gz --day 2026-07-06 --reset --every 10
uv run python -m cve_exploit.monitor --in bundle_2026-07-07.tar.gz --day 2026-07-07 --every 10
# ... jusqu'au plus recent
```

Choix de `--every` : 20 (~17k, tres rapide) / 10 (~35k, rapide) / 5 (~70k) / absent (370k, max fidelite).

Alerte-seule : une `drift_alert` ouverte signale qu'il faut lancer `retrain.py` (section 6) ;
le re-entrainement n'est jamais automatique (garde-fou champion/challenger). Dashboard PSI/Brier +
alertes dans le front (page Monitoring).

## 9. Tout lancer pour la demo (docker-compose)

Une seule commande demarre **db + api + front**. Prerequis : avoir entraine le modele au moins
une fois (`models/model.joblib` existe) -- il est monte en volume, pas embarque dans l'image.

```bash
docker compose up --build       # build + demarre les 3 services
# front : http://localhost:5173  |  api : http://localhost:8000  |  db : localhost:5432
docker compose down             # tout arreter (le volume pgdata est conserve)
```

Details :
- **api** : image Python (uv, sans le groupe dev). `models/` et `cve_threat_intel/` montes en
  read-only (`cve_threat_intel` optionnel, seulement pour `GET /score/{id}`). `DATABASE_URL` pointe
  le service `db`.
- **front** : build Vite -> statique servi par nginx. `VITE_API_URL=http://localhost:8000` est fige
  au build (le navigateur appelle l'API cote hote).

### Mode developpement (hot-reload)
Pour coder avec rechargement a chaud, ne pas tout dockeriser : lancer seulement la DB en conteneur,
l'API et le front en local.

```bash
docker compose up -d db
uv run uvicorn cve_exploit.api:app --reload          # api :8000
cd frontend && npm run dev                            # front :5173 (HMR)
```
