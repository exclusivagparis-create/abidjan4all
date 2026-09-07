# AP-01b — Recherche web

Complète le jeu d'AP-01 avec ce que les flux n'ont pas vu, en confiant à Claude
l'outil de recherche web d'Anthropic. **Se place entre AP-01 et AP-02.**

```
AP-01 (flux RSS)  →  AP-01b (recherche web)  →  AP-02 (sélection)  →  AP-03
```

---

## Pourquoi un module séparé, et non une partie d'AP-01

AP-01 n'a **aucune dépendance npm ni clé API** — c'est délibéré, et c'est ce qui
le rend increvable : il tourne même quand tout le reste est en panne. Y ajouter
le SDK et une clé lui ferait perdre cette propriété pour une fonction qui n'est
qu'un complément.

Ici, si la recherche échoue, **le jeu d'AP-01 passe intact à AP-02**. Éprouvé
sur les quatre chemins d'échec : clé absente, API en panne, réponse illisible,
aucune trouvaille. Dans les quatre cas, `candidates` est inchangé.

---

## Ce que la recherche apporte

Un flux RSS répond à « qu'a publié ce média ». Une recherche répond à « que se
dit-il sur ce sujet », **y compris chez des médias absents du registre**.

Elle comble donc précisément le trou constaté : **Koaci, Fraternité Matin,
Abidjan.net, RTI, 7info n'ont aucun flux RSS**, mais leurs articles sont
indexés. La consigne le dit explicitement au modèle et l'oriente là.

Elle cherche aussi ce qui touche la **diaspora** — consulats, visas, transferts
d'argent, élections vues de l'étranger — et les sujets économiques ivoiriens.

Les résultats restent **non primaires** et portent `piste_a_verifier` : une page
trouvée par recherche n'a été lue par personne de la rédaction. AP-03 ira en
chercher le texte, comme pour les autres.

---

## Le garde-fou principal : des URL qui existent

Le pire défaut possible ici serait qu'un modèle **invente une URL** ou rende une
page d'accueil en guise d'article. Cinq contrôles, tous éprouvés :

| Trouvaille | Sort |
|---|---|
| `https://www.koaci.com/` | écartée — pas l'adresse d'un article |
| `https://www.fratmat.info/politique` | écartée — c'est une rubrique |
| `javascript:alert(1)` | écartée |
| Article déjà collecté par les flux | écartée |
| Même sujet qu'un article collecté (titre différent) | écartée |
| Publication de l'an dernier | écartée |
| Doublon interne aux trouvailles | écartée |

Sur six trouvailles simulées, **une seule** a passé les contrôles.

Le rapprochement des titres et la canonisation des URL réutilisent **les
fonctions d'AP-01 elles-mêmes** : elles doivent se faire exactement de la même
façon des deux côtés, sinon un doublon passe entre les mailles. L'emballeur les
recopie à la source dans l'étape Activepieces, qui n'a pas de système de
fichiers partagé — elles ne peuvent donc pas diverger.

---

## Coût

**10 $ pour 1 000 recherches**, soit 0,01 $ l'unité, au même prix en lot. Le
plafond `maxRecherches` (8) est la seule bride dure : sans lui, un modèle
curieux enchaîne vingt recherches.

| Mode | Par jour | Par mois |
|---|---|---|
| `lot` (défaut) | 0,13 $ | **3,90 $** |
| `direct` | 0,18 $ | 5,40 $ |

La remise de 50 % des lots porte sur les jetons, pas sur les recherches — d'où
un écart plus faible qu'ailleurs.

---

## Montage dans Activepieces

Entre l'étape AP-01 et l'envoi à AP-02. **Étape Code**, `packageJson` :

```json
{"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
```

| Entrée | Valeur |
|---|---|
| `dataset` | `{{step_2}}` — la sortie d'AP-01 |
| `apiKey` | le secret Anthropic |
| `reglages` | facultatif — `{"mode":"direct"}`, `{"maxRecherches":4}` |

---

## Ce qui a été éprouvé, et ce qui ne l'est pas

**Éprouvé** : la reconnaissance des URL d'article (7 cas), les sept motifs
d'écartement, l'assemblage d'une trouvaille en candidat, les quatre chemins
d'échec laissant le jeu intact, et l'autonomie de l'étape engendrée. L'appel
réel atteint l'API d'Anthropic — `401` avec une fausse clé.

**Non éprouvé, faute de clé — et un point mérite d'être signalé.** Ce module
combine l'outil de recherche (`tools`) avec la sortie structurée
(`output_config`). La documentation ne l'interdit pas mais ne le montre pas non
plus, et je n'ai pas pu le vérifier. **Si l'API refusait la combinaison**, la
requête échouerait avec une erreur 400 — et le module rendrait alors le jeu
d'AP-01 intact, avec le motif. La chaîne continuerait ; seul l'enrichissement
serait perdu.

C'est précisément pour cela que la recherche est un module séparé dont l'échec
est sans conséquence. Si le cas se produit, la parade est simple : deux appels
au lieu d'un — le premier cherche, le second met en forme.

**À faire dès que la clé existe**, en mode `direct` : vérifier que la
combinaison passe, et regarder les URL rendues une à une. C'est le seul endroit
de la chaîne où un modèle pourrait fabriquer une référence qui n'existe pas.

---

## Essayer

```bash
node essai.mjs
```
