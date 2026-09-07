# Bascule MCP — la chaîne sans clé API

Deuxième mode de fonctionnement de la chaîne éditoriale. Les flows API
(`ap01/` à `ap04/`) restent en place, **dormants**, pour le jour où vous
voudrez que tout tourne sans vous.

---

## Le principe, et sa limite

MCP va dans un seul sens : **Claude appelle Activepieces**, jamais l'inverse.
Un flow planifié à midi, sans personne devant l'écran, ne peut donc pas
« appeler Claude ». La bascule ne rend pas une chaîne *planifiée* gratuite ;
elle rend possible une chaîne *déclenchée par vous*.

Le partage devient :

| Qui | Fait quoi | Coût |
|---|---|---|
| **Activepieces** | la collecte, la lecture des articles | 0 $ — aucun modèle |
| **Claude, dans votre conversation** | sélection, vérification, rédaction | 0 $ — abonnement Pro |
| **Le connecteur du site** | le dépôt du brouillon | 0 $ |
| **Vous** | le déclencheur, chaque matin | — |

Ce qu'on perd : l'autonomie, et une part de la trace d'exécution. Ce qu'on
gagne, au-delà des ~12 $/mois : **vous êtes présent**. Toutes les protections
bâties pour les flows API compensaient précisément votre absence.

---

## Ce qu'il y a à faire — trois gestes

### 1. Créer le serveur MCP

Dans Activepieces, ouvrez la page **MCP** du projet. À ce jour la table `mcp`
de votre instance est **vide** : aucun serveur n'existe, et Claude, bien que
connecté à l'adresse, ne voit **aucun outil**. C'est ce qui explique que rien
ne se passe.

### 2. Deux flows, chacun exposé comme outil

Pour chaque flow : déclencheur **MCP Tool**, puis une étape **Code**, puis
l'action **Reply to MCP Client**. Cochez *Wait for Response* sur le
déclencheur, sinon Claude n'attend pas le résultat.

#### Outil 1 — `collecter_les_actualites`

*Description à saisir :* « Collecte les actualités du jour pour Abidjan4All :
39 sources RSS ivoiriennes, africaines et internationales, dédoublonnées,
classées par région et notées. »

| Paramètre | Type | Rôle |
|---|---|---|
| `limite` | nombre, facultatif | combien de candidats rendre — 60 par défaut |
| `format` | texte, facultatif | `compact` (défaut) ou `complet` |

Code : `outil-collecte.js`. **packageJson vide.**
Entrées : `limite` = `{{trigger['output'].limite}}`, `format` = `{{trigger['output'].format}}`.

#### Outil 2 — `lire_les_articles`

*Description à saisir :* « Récupère le texte d'articles de presse à partir de
leurs adresses, et indique pour chacun s'il a pu être lu, s'il est payant, ou
protégé. Sert à recouper plusieurs sources sur un même événement. »

| Paramètre | Type | Rôle |
|---|---|---|
| `urls` | texte long, obligatoire | les adresses, une par ligne (10 au plus) |

Code : `outil-lecture.js`. **packageJson vide.**
Entrée : `urls` = `{{trigger['output'].urls}}`.

### La syntaxe des références — le piège qui a coûté quatre allers-retours

**La sortie d'une étape est imbriquée sous `['output']`.** Une référence
`{{trigger.limite}}` ne résout donc rien : elle cherche `limite` sur l'objet de
l'étape, où il n'existe pas. Il faut écrire :

| Où | Valeur correcte |
|---|---|
| Entrée `limite` de l'étape Code | `{{trigger['output'].limite}}` |
| Entrée `urls` de l'étape Code | `{{trigger['output'].urls}}` |
| Valeur de la réponse MCP | `{{step_1['output']}}` |

Le symptôme d'une référence fautive est traître : **elle ne lève aucune erreur**.
Le paramètre arrive vide, le code se rabat sur sa valeur par défaut, et le flow
réussit. C'est pourquoi l'outil de collecte rend désormais `parametres_recus`,
avec un `branchement_ok` qui dit d'un coup d'œil si le câblage tient.

Deuxième piège, plus discret : dans l'étape de réponse, le champ **Response** en
mode *Simple* est un éditeur **clé / valeur**. Y saisir `{{step_1['output']}}`
dans la colonne *clé* produit un corps `{"{{step_1['output']}}": ""}` — un 200
parfaitement vide. La référence va dans la colonne **valeur**, avec une clé
ordinaire à côté (`resultat`).

### 3. Un Projet Claude avec la procédure

Créez un Projet dans Claude, connectez-y les deux connecteurs (Activepieces et
le site), et collez **`PROCEDURE.md`** dans ses instructions.

C'est la pièce essentielle : en mode API, les garde-fous éditoriaux vivaient
dans le code et dans les consignes envoyées au modèle. Ici, **ils vivent dans
cette procédure**. Sans elle, la bascule perd tout ce qui faisait la valeur de
la chaîne — les verdicts qui ne disent jamais « vrai », le refus d'écrire un
dossier fragile, l'interdiction de citer ce qui n'a pas été lu.

Ensuite, chaque matin : « fais la revue du jour ».

---

## Les deux outils

Ils sont **dérivés** des modules éprouvés, jamais recopiés à la main :
`outil-collecte.js` vient d'`ap01/collecteur.mjs`, `outil-lecture.js` de
`ap03/verificateur.mjs`. Corriger la source puis `node emballer.mjs`.

Aucun des deux n'a de dépendance npm ni de clé : ils ne coûtent rien et ne
dépendent d'aucun service payant.

### Pourquoi 60 candidats et non 150

Le jeu entier pèse 157 ko, soit ~43 000 jetons — de quoi grever une
conversation dès la première minute. Les 150 candidats étaient dimensionnés
pour un appel d'API, qui devait tout recevoir d'un coup faute de seconde
chance. Une conversation peut en redemander.

| `limite` | Candidats | Poids | Jetons |
|---|---|---|---|
| 30 | 10 par région | 19 ko | ~5 000 |
| **60** *(défaut)* | **20 par région** | **37 ko** | **~11 000** |
| 150 | 50 par région | 90 ko | ~26 000 |

La répartition est égale entre régions, et non « les N meilleurs » : sinon une
région bavarde prend toute la place.

### Ce que rend `lire_les_articles`

Le statut compte autant que le texte — un article inaccessible est une
information utile, pas une panne. Éprouvé en conditions réelles :

```
texte          2963 car.  rfi.fr
payant            0 car.  lemonde.fr        le site refuse la lecture (HTTP 402)
injoignable       0 car.  abidjan4all.info  HTTP 404
```

Il rend aussi `domaines_distincts` — le nombre de **domaines**, pas d'articles.
Deux textes du même média ne se corroborent pas, pas plus que deux reprises
d'une même dépêche.

Aucun paywall n'est contourné : un refus est rapporté comme un refus.

---

## Ce qui a été éprouvé

Les deux étapes se chargent et exportent `code`. La collecte rend 60 candidats
équilibrés en 37 ko ; la lecture a été passée sur de vraies adresses, avec les
trois statuts ci-dessus, et refuse proprement une entrée vide.

**Non éprouvé** : le montage dans Activepieces lui-même — création du serveur
MCP, publication des deux flows, et la façon dont le déclencheur transmet ses
paramètres à l'étape Code. Cela demande votre interface. Si les paramètres
n'arrivent pas sous les noms attendus (`inputs.limite`, `inputs.urls`), le
premier appel le montrera tout de suite, et l'ajustement tient en une ligne.

---

## Les flows API, en sommeil

Rien n'est supprimé. `ap01/` à `ap04/` restent complets, éprouvés et
documentés. Le jour où vous voudrez la revue automatique à midi sans personne
devant l'écran, il suffira d'une clé Anthropic — environ 12 $/mois — et de
réactiver le flow planifié.

Les deux modes partagent leurs modules : une correction apportée au collecteur
profite aux deux.
