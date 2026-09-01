# Comprendre le PEP — de zéro, sans rien supposer

> Ce document n'explique pas *comment lancer* le projet (c'est `lancer.md`). Il explique **ce qui se
> passe réellement** à chaque étape et **pourquoi** chaque choix a été fait, y compris sur les points
> qu'on croit avoir compris.
>
> À la fin : les questions qu'un jury pose, avec la réponse.
>
> Le pendant côté CWE : `cwe-finetuning/docs/comprendre-le-fine-tuning.md`.

---

## 1. La question exacte — et c'est tout le projet

Il y a **deux questions** qu'on confond en permanence dans la gestion de vulnérabilités :

| Question | Qui y répond |
|---|---|
| « Cette faille va-t-elle être **exploitée** dans les 30 prochains jours ? » | **EPSS** |
| « Un **exploit public existe-t-il déjà** pour cette faille ? » | **notre PEP** |

Ce ne sont **pas** les mêmes. La première demande d'observer le terrain — qui attaque quoi, en ce
moment. La seconde demande d'observer la faille elle-même.

> **Si vous ne retenez qu'une chose de ce document** : le PEP n'est pas un concurrent d'EPSS, c'est
> une réponse à une autre question. Toute la valeur du projet — et toutes ses limites — découle de
> cette distinction.

La cible technique s'appelle `has_exploit` : vrai si un exploit public est connu pour cette CVE.

---

## 2. Pourquoi ce n'est PAS du deep learning — et c'est un choix

Question de jury quasi certaine, surtout après avoir vu le projet CWE qui utilise un transformer.

**Le PEP est une régression logistique.** Un modèle linéaire, inventé dans les années 1950.

### Pourquoi ce choix

| Raison | Détail |
|---|---|
| **Explicabilité** | Chaque score se décompose en contributions de variables. On peut dire à un client *pourquoi* une CVE est à 0,87. Un transformer ne le permet pas. |
| **Les variables sont déjà structurées** | CVSS, produit, mots-clés : ce sont des colonnes propres. Le deep learning excelle sur des données brutes (texte, images), pas sur du tabulaire déjà nettoyé. |
| **Calibration** | On veut une **probabilité**, pas un rang. Un modèle simple se calibre bien (§6). |
| **Coût** | Quelques secondes d'entraînement sur processeur, quelques millisecondes par CVE en inférence, aucun GPU. |

> **La bonne réponse en soutenance** : « le deep learning n'aurait rien apporté ici, et aurait coûté
> l'explicabilité — qui est la moitié de la valeur du produit. » Ce n'est pas un aveu de faiblesse,
> c'est un arbitrage documenté.

---

## 3. Les variables — trois familles, trois traitements

Le modèle ne voit **jamais** la CVE brute. Il voit un vecteur de nombres, construit par un
`ColumnTransformer` qui applique un traitement différent à chaque famille.

### 3.1 Les catégorielles → encodage « one-hot »

Treize colonnes, essentiellement le vecteur CVSS décomposé :

```
attack_vector, attack_complexity, attack_requirements, privileges_required,
user_interaction, scope, impact_conf, impact_integ, impact_avail,
cvss_version, cpe_part, primary_cwe, vendor
```

**Le problème** : `attack_vector` vaut `NETWORK`, `LOCAL`, `ADJACENT` ou `PHYSICAL`. Un modèle ne
mange pas du texte. On pourrait coder `NETWORK=0, LOCAL=1, ADJACENT=2`… mais ce serait **faux** :
cela impose un ordre et une distance qui n'existent pas (`ADJACENT` n'est pas « deux fois »
`LOCAL`).

**La solution** — une colonne binaire par valeur possible :

```
attack_vector = NETWORK   →   [1, 0, 0, 0]
attack_vector = LOCAL     →   [0, 1, 0, 0]
```

Deux réglages, et leur raison :

- **`min_frequency=50`** — les valeurs vues moins de 50 fois sont regroupées dans un panier
  « rares ». Sans ça, `vendor` créerait des milliers de colonnes vues une seule fois : du bruit pur,
  et une porte ouverte au surapprentissage.
- **`handle_unknown='ignore'`** — en production, une valeur jamais vue à l'entraînement produit des
  zéros au lieu de faire planter le service. **Indispensable** : le catalogue CWE et la liste des
  éditeurs grandissent en permanence.

### 3.2 Les numériques → `log1p` puis mise à l'échelle

```
desc_len, cwe_count, n_vuln_types, has_patch, has_vendor_advisory,
n_mitre, cpe_multi_condition, rce_profile  + 19 indicateurs de mots-clés
```

**`log1p`** — c'est `log(1 + x)`. Ces variables sont des **compteurs très asymétriques** : la plupart
des CVE ont 2 ou 3 références, quelques-unes en ont 400. Sans transformation, ces valeurs extrêmes
écrasent tout le signal. Le logarithme comprime la queue.

Pourquoi `log1p` et pas `log` ? Parce que `log(0)` est indéfini, et beaucoup de compteurs valent 0.
`log1p(0) = 0`, proprement.

**`StandardScaler(with_mean=False)`** — met toutes les variables à une échelle comparable. Une
régression logistique pénalisée (§5) traite ses coefficients de la même façon : sans mise à
l'échelle, une variable en milliers écraserait une variable en unités.

Pourquoi `with_mean=False` ? Parce que centrer détruirait la **parcimonie** de la matrice — la
plupart des valeurs sont des zéros, et les garder à zéro économise énormément de mémoire.

### 3.3 Le texte → unigrammes binaires

```python
CountVectorizer(binary=True, min_df=100)
```

**Ce que ça fait** : chaque mot présent au moins 100 fois dans le corpus devient une colonne, valant
1 si le mot apparaît dans cette description, 0 sinon.

**`binary=True` — et voici la leçon la plus intéressante du projet.** On ne compte pas les
occurrences, on note juste la **présence**. Et surtout : **pas de TF-IDF**.

Pourquoi ? Parce que TF-IDF pondère les mots par leur rareté. Or ce qui nous intéresse ici est
factuel : la description **dit-elle** « remote code execution » ? Le dire trois fois ne rend pas la
faille trois fois plus exploitable. La pondération TF-IDF ajoutait du bruit sans signal.

**`min_df=100`** — un mot vu 40 fois sur 370 000 CVE est du bruit (un nom de produit, une faute de
frappe). Le seuil évite des milliers de colonnes inutiles.

> **Question de jury** : « pourquoi ne pas utiliser un transformer sur la description, comme dans le
> projet CWE ? » Réponse : on l'a essayé côté CWE, et TF-IDF y atteignait **91 %** du score du
> transformer. Le signal des descriptions de CVE est **essentiellement lexical** — les mots
> déclencheurs sont là ou ils n'y sont pas. Un transformer coûte cher pour capter une nuance qui
> n'existe presque pas.

---

## 4. La régression logistique — ce qu'elle calcule vraiment

### En deux étapes

**Étape 1 — une somme pondérée.** Le modèle a un coefficient par variable. Il multiplie chaque
variable par son coefficient et additionne :

```
z = w₁·(attack_vector=NETWORK) + w₂·(has_patch) + w₃·(mot "remote" présent) + … + biais
```

`z` peut valoir n'importe quoi, de −∞ à +∞. Ce n'est pas encore une probabilité.

**Étape 2 — la fonction sigmoïde.** Elle écrase `z` dans l'intervalle [0, 1] :

```
p = 1 / (1 + e^(−z))
```

```
z = −4  →  p ≈ 0,02        z = 0  →  p = 0,50        z = +4  →  p ≈ 0,98
```

C'est tout. **La régression logistique est une somme pondérée passée dans une sigmoïde.**

### Pourquoi c'est explicable, concrètement

Chaque terme `wᵢ · xᵢ` est la **contribution** de la variable `i` au score. On peut trier ces
contributions et dire : *« cette CVE est à 0,87 parce qu'elle est exploitable à distance (+0,9),
sans authentification (+0,6), et que sa description contient "remote code execution" (+0,8) »*.

Aucun réseau de neurones ne donne ça.

### `class_weight='balanced'` — pourquoi c'est nécessaire

La cible est **déséquilibrée** : une minorité de CVE a un exploit public connu. Sans correction, le
modèle apprendrait que répondre « non » tout le temps donne déjà une bonne exactitude.

`balanced` donne à chaque classe un poids inversement proportionnel à sa fréquence : se tromper sur
un positif coûte plus cher que sur un négatif. Le modèle est **forcé** de s'intéresser à la classe
rare.

### `C=0.1` — la régularisation

`C` contrôle la **pénalisation** des coefficients : plus `C` est petit, plus le modèle est contraint
à garder des coefficients faibles, donc plus il est **simple** et moins il surapprend.

Ce n'est pas une valeur inventée : elle vient d'un réglage par grille (`GridSearchCV` avec
`TimeSeriesSplit`, notebook `6bis`). La plage 0,03–0,1 formait un **plateau** — donc on a retenu
`C=0.1`, la valeur stable au bord du plateau. La pénalité L2 (défaut) est ressortie meilleure ; L1
était à égalité, dans le bruit.

> `max_iter=1000` n'est **pas** un hyperparamètre à régler : c'est un simple budget de convergence
> pour l'algorithme d'optimisation. Le dire évite une question piège.

---

## 5. La calibration — la partie que tout le monde saute

C'est le concept le moins intuitif du projet, et probablement celui qui vous manque le plus.

### Le problème : bien classer ≠ donner une probabilité juste

Un modèle peut parfaitement **ordonner** les CVE (les plus risquées devant) tout en donnant des
probabilités **fausses**. Exemple : il annonce 0,9 sur un groupe de CVE dont seulement 60 % ont
réellement un exploit. Le classement est bon, le nombre est mensonger.

**Pourquoi ça compte ici** : on veut livrer un score qu'un client lit comme une probabilité et sur
lequel il fixe un seuil métier. « Traiter tout ce qui est au-dessus de 0,7 » n'a de sens que si
0,7 veut dire *70 % de chances*.

Effet de bord à connaître : `class_weight='balanced'` **dérègle** volontairement les probabilités
(il exagère la classe rare pour forcer le modèle à l'apprendre). Il faut donc les recaler après.

### Ce que fait `CalibratedClassifierCV`

```python
model = CalibratedClassifierCV(build_pipeline(), method="sigmoid", cv=3)
```

Il enveloppe le pipeline et procède en deux temps :

1. Il découpe l'entraînement en **3 plis**. Pour chaque pli, il entraîne le modèle sur les deux
   autres et prédit sur celui-ci — donc sur des données que ce modèle n'a **pas** vues.
2. Sur ces prédictions honnêtes, il ajuste une petite fonction correctrice (une sigmoïde, méthode
   dite de *Platt*) qui transforme « score brut » en « probabilité réelle ».

Le résultat : `predict_proba` renvoie un nombre qu'on peut lire comme une probabilité.

> **Détail à connaître, un jury attentif peut le demander** : `CalibratedClassifierCV` refait
> l'entraînement en interne. Les pipelines réellement entraînés ne sont donc pas dans
> `model.estimator` (qui est le modèle *non* entraîné, le gabarit) mais dans
> `model.calibrated_classifiers_[i].estimator`. C'est un piège classique quand on veut inspecter les
> coefficients.

### Comment on vérifie que c'est calibré : le score de Brier

Le **Brier** est l'erreur quadratique moyenne entre la probabilité annoncée et la réalité (0 ou 1).
Plus bas est meilleur. **Le nôtre vaut 0,103.**

Sa force : il punit à la fois le mauvais classement **et** la mauvaise calibration. Un modèle qui
annoncerait 0,99 partout aurait un Brier catastrophique même avec un bon classement.

---

## 6. Le découpage temporel — le même principe que côté CWE

| Rôle | Période |
|---|---|
| Entraînement | ≤ 2024 (échantillon de 150 000) |
| Test | **2025**, jamais vu |

**Pourquoi pas un tirage aléatoire ?** Deux raisons, et la seconde est spécifique au PEP :

1. Les CVE arrivent **par grappes** — mêmes produits, mêmes formulations, à quelques jours
   d'intervalle. Un tirage aléatoire éclate ces grappes et le modèle reconnaît des quasi-jumelles au
   lieu de généraliser. **C'est une fuite invisible** : rien ne la signale, les chiffres sont juste
   trop beaux.
2. **Les labels mûrissent.** Un exploit peut être publié des mois après la CVE. Une CVE de 2025 vue
   aujourd'hui a eu moins de temps pour « devenir positive » qu'une CVE de 2020. Le découpage
   temporel reproduit exactement la situation de production : on juge du récent avec un modèle
   entraîné sur de l'ancien.

---

## 7. Les métriques — laquelle dit quoi

Trois chiffres, trois questions différentes. Savoir laquelle répond à quoi est souvent demandé.

| Métrique | Ce qu'elle mesure | Notre score | EPSS |
|---|---|---|---|
| **ROC-AUC** | qualité du **classement** global | **0,917** | 0,634 |
| **PR-AUC** | qualité du classement **sur la classe rare** | **0,837** | 0,414 |
| **Brier** | qualité de la **calibration** | **0,103** | — |

### ROC-AUC — et son piège

Elle vaut la probabilité que, sur un positif et un négatif tirés au hasard, le modèle donne un score
plus élevé au positif. 0,5 = hasard, 1,0 = parfait.

**Son défaut** : sur une cible très déséquilibrée, elle est **optimiste**. Elle peut afficher 0,9
alors que le modèle est inutilisable en pratique, parce qu'elle est portée par la facilité à écarter
les nombreux négatifs évidents.

### PR-AUC — la plus honnête ici

Précision contre rappel. Elle ne s'intéresse qu'à la classe positive et **ne bénéficie pas** de la
masse des négatifs faciles. Sur cible rare, c'est celle qu'il faut regarder.

> **Repère indispensable** : la PR-AUC d'un modèle au hasard vaut le **taux de base** (la part de
> positifs). Un PR-AUC de 0,3 est excellent si la base est à 1 %, médiocre si la base est à 25 %.
> Toujours citer la base avec la PR-AUC.

---

## 8. Le résultat central — et il est inconfortable

C'est ce qu'il faut savoir raconter, et le raconter **avant** qu'on vous le demande.

### La mesure qui a tout changé

On croyait avoir construit un outil d'**anticipation**. Vérification faite sur la distribution des
labels :

> **92,2 % des exploits publics existent déjà le jour de publication de la CVE.**

Donc le modèle ne « prédit » presque rien : il **décrit** un état déjà présent. La valeur
« anticipation » affichée était portée par la nature **statique** du label, pas par une capacité
prédictive.

### Le test décisif

Pour trancher, on a changé de cible : `functional_within_90d` — un exploit **armé** (weaponisé)
publié dans les 90 jours. Celui-là est réellement tourné vers l'avenir (délai médian 26 jours).

| Cible : armement sous 90 jours, test 2025 | PEP | EPSS |
|---|---|---|
| PR-AUC | **0,040** | **0,435** |
| Précision @20 | 0,15 | 0,90 |

**Le PEP ne prédit pas l'armement.** EPSS garde une avance écrasante, parce qu'il observe le terrain
et que nous n'observons que la faille.

### On a aussi vérifié qu'il n'y avait pas de levier caché

Inventaire des signaux de télémétrie datés dans nos données : KEV 0,44 %, botnet 0,17 %, ransomware
0,16 %. **Ultra-rares.** Et surtout, **61 à 83 % arrivent APRÈS** l'armement — ce sont des
conséquences, pas des signaux précoces. Les utiliser pour prédire serait une fuite.

> **Conclusion mesurée** : le plafond n'est pas un défaut d'entraînement, c'est une limite
> **intrinsèque** aux caractéristiques disponibles à T0.

### La position défendable — et la formulation exacte

> Un signal de priorisation **descriptif, calibré, explicable** pour la masse des CVE qu'EPSS ne
> distingue pas. **Pas** un prédicteur d'armement. Complément d'EPSS, pas concurrent.

**Et voici où ça devient réellement utile.** Sur l'année de test, **99 % des CVE** ont un score EPSS
sous 0,1 : dans cette zone, EPSS ne hiérarchise plus. On y pose notre question :

| Cohorte EPSS ⩽ 0,1 — « lesquelles ont déjà un exploit ? » | |
|---|---|
| Précision @100 | **100 %** |
| Précision @1000 | **99 %** |
| Taux de base de la cohorte | 25,9 % |

Et sur les **100 736** exploits confirmés que compte cette zone plate, le score en remonte
**70 957** — soit 70,4 %.

> **Ce qu'il ne faut pas dire** : « on bat EPSS », « on anticipe les attaques ». Ce serait faux et
> ça s'effondrerait à la première question précise. Le projet le note noir sur blanc dans son
> journal : *sur-vendre = bullshit*.

---

## 9. Les questions que le jury va poser

### « Pourquoi ne pas simplement utiliser EPSS ? »

Parce qu'il répond à une autre question, et qu'il est **plat sur 99 % du flux**. Nos deux scores
sont complémentaires : EPSS dit « va-t-elle être attaquée », nous disons « un exploit existe-t-il
déjà ». Un analyste a besoin des deux.

À quoi s'ajoutent trois propriétés qu'EPSS n'a pas : **hors ligne** (aucun appel externe),
**explicable** (contribution par variable), **recalculable** sur vos propres données.

### « Votre modèle utilise-t-il EPSS comme variable ? »

**Non, jamais.** EPSS est stocké à part pour la comparaison, il n'entre pas dans les variables. Sinon
la démonstration d'additivité serait circulaire.

### « Comment savez-vous que vous ne surapprenez pas ? »

Trois garde-fous : le **découpage temporel** (test sur une année jamais vue), la **régularisation**
`C=0.1` réglée par validation croisée temporelle, et la **calibration** en 3 plis qui n'évalue jamais
sur des données d'entraînement.

### « Le CWE prédit améliorerait-il le PEP ? »

**Non, et c'est mesuré** — ce qui est le résultat le plus contre-intuitif des deux projets. Retirer
`primary_cwe` du modèle — le **vrai** CWE, pas un prédit — **améliore** la PR-AUC : 0,8369 → 0,8492.

L'explication probable : le signal « CWE manquant » duplique le signal `nvd_status`, et les 121
colonnes créées par l'encodage one-hot ajoutent plus de bruit que d'information.

**Conséquence honnête** : l'usage qui justifiait le projet CWE — enrichir le PEP — **ne tient pas**.
Le dire est plus solide que de le taire : le jury le trouverait.

### « Vos données sont-elles reproductibles ? »

Oui. Une variante s'entraîne uniquement sur des **labels publics** — un agrégat de 5 sources ouvertes
retenues après ablation (CISA-KEV, VulnCheck-KEV, ExploitDB, Metasploit, Nuclei). Elle atteint ROC
**0,779**.

Détail qui montre le sérieux de l'ablation : la sixième source candidate, `poc_github`, a été
**exclue** parce qu'elle dégradait le résultat (ROC 0,77 → 0,73). C'est du bruit, pas du signal.

### « Qu'est-ce que vous referiez autrement ? »

**Tester la valeur prédictive réelle en premier.** On a construit tout le pipeline avant de vérifier
que le label était statique à 92 %. Cette vérification coûtait une journée et aurait recadré le
projet dès le départ : on aurait visé « descriptif et explicable » tout de suite, au lieu d'y arriver
par élimination.

---

## 10. Le schéma complet, à mémoriser

```
  une fiche CVE (JSON du feed)
        │
        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ ColumnTransformer — trois familles, trois traitements       │
  │                                                             │
  │  13 catégorielles  → OneHot (min_frequency=50)              │
  │  27 numériques     → log1p → StandardScaler                 │
  │  1 texte           → CountVectorizer(binary, min_df=100)    │
  └─────────────────────────────────────────────────────────────┘
        │  un grand vecteur creux de nombres
        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ LogisticRegression(C=0.1, class_weight='balanced')          │
  │   z = Σ wᵢ·xᵢ + biais   puis   p = sigmoïde(z)              │
  └─────────────────────────────────────────────────────────────┘
        │  un score brut, bien classé mais mal calibré
        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ CalibratedClassifierCV(method='sigmoid', cv=3)              │
  │   recale le score en probabilité lisible                    │
  └─────────────────────────────────────────────────────────────┘
        │
        ▼
  PEP ∈ [0, 1] — « un exploit public existe-t-il déjà ? »
  + les contributions par variable, pour l'expliquer
```

---

## En une phrase, si on ne retient qu'une chose

> Le PEP répond très bien à une question modeste — *« un exploit existe-t-il déjà ? »* — sur la masse
> de CVE que personne d'autre ne hiérarchise. Le plus dur n'a pas été de l'entraîner, mais
> **d'établir honnêtement ce qu'il ne sait pas faire** : il ne prédit pas l'armement, et on l'a
> mesuré au lieu de l'espérer.
