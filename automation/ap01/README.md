# AP-01 — News Collector

Collecte, normalise, filtre, dédoublonne et classe les actualités du jour, puis
produit le jeu de candidats destiné à **AP-02 — Sélection éditoriale**.

Tourne dans Activepieces, sur `https://automation.abidjan4all.info`.

---

## Ce que contient ce dossier

| Fichier | Rôle |
|---|---|
| `collecteur.mjs` | **La source de vérité.** Le pipeline complet, testable hors d'Activepieces. |
| `ap01-code-step.js` | Engendré depuis le précédent. C'est ce qu'on colle dans l'étape Code. |
| `emballer.mjs` | Fabrique le second à partir du premier. |
| `registre-sources.json` | Le registre exporté, pour consultation et administration. |

**Ne jamais modifier `ap01-code-step.js` à la main** : corriger `collecteur.mjs`,
puis `node emballer.mjs`. Deux copies éditées séparément divergent en silence,
et c'est celle qui tourne en production qu'on oublie.

---

## Montage dans Activepieces

### 1. Déclencheur

Pièce **Schedule** → *Every day*, `12:00`, fuseau **Europe/Paris**.

### 2. Étape « Code »

Coller le contenu intégral de `ap01-code-step.js`.
Champ `packageJson` : **laisser vide**. Le collecteur n'a aucune dépendance npm —
c'est délibéré : un `npm install` au démarrage d'une étape dépend du réseau, du
cache du conteneur et du registre npm, et c'est le point de panne le plus banal
de ce genre de flow.

Aucune entrée n'est obligatoire. Deux entrées facultatives permettent d'agir
sans rouvrir le code :

- `registre` — remplace la liste des sources ;
- `reglages` — remplace les réglages (fenêtre temporelle, quotas, délais).

### 3. Transmission à AP-02

Non encore branchée : AP-02 n'existe pas. Quand il existera, ajouter une étape
**HTTP → POST** vers son webhook, avec `{{step_2}}` en corps.

Le plan proposait deux options ; la seconde (webhook interne) est la bonne ici,
et pour une raison précise : un déclenchement direct de flow à flow lie les deux
cycles de vie, si bien qu'AP-01 échoue quand AP-02 est en cours d'édition.

---

## Ce que produit le flow

```jsonc
{
  "workflow_id": "A4A-2026-09-07-120000",
  "source": "AP-01",
  "version": "1.0.0",
  "status": "SUCCESS",            // ou WARNING (sources en échec), ou FAILED (aucune)
  "quota": { "cote_ivoire": 2, "afrique": 2, "international": 3 },
  "statistics": { /* voir plus bas */ },
  "errors": [ /* une ligne par source en échec */ ],
  "candidates": [ /* 150 au plus, triés par score technique */ ]
}
```

Exécution réelle du 7 septembre 2026, 03 h 55 :

```
sources_attempted    39
sources_success      39
articles_collected  943
unique_topics       438
candidates          150   (50 Côte d'Ivoire · 50 Afrique · 50 International)
dont pistes          13   (blogs, vidéos, réseaux sociaux)
duration            7 s
```

### La réserve de découverte

Sans elle, l'élargissement n'aurait rien changé : mesuré, les fils sociaux
rendaient **zéro candidat sur cent cinquante**, les rédactions mieux notées
prenant toutes les places. Cinq places par région sont donc tenues pour les
sources non primaires, dont deux réservées aux réseaux sociaux en Côte d'Ivoire.

Ces candidats portent `piste_a_verifier: true`. Ce qu'un fil social apporte
n'est pas de l'information, c'est **ce qui circule** — le fil ivoirien suivi
relaie des rumeurs (« prétendue arrestation du chef d'état-major », « prétendu
projet d'assassinat »). Une rédaction qui ignore la rumeur ne peut pas la
démentir. AP-02 reçoit la consigne expresse : une telle piste peut mériter un
article qui la **vérifie**, jamais un article qui la reprend.

**Trois défauts trouvés en exécutant, et corrigés** — sans eux, l'élargissement
serait resté lettre morte :

1. Les billets Mastodon **n'ont pas de titre** : tout est dans la description.
   Le filtre les rejetait tous pour « titre absent ». Le début du message en
   tient désormais lieu.
2. La fenêtre de 24 h excluait des fils qui publient quelques messages par
   semaine. Les sources de découverte ont une fenêtre élargie (96 h pour le
   social, 72 h pour les blogs) : une rumeur vieille de deux jours circule
   toujours.
3. Les titres sociaux arrivent en **Unicode stylisé** (« 𝗦𝗼𝘂𝗽𝗰̧𝗼𝗻𝘀 » plutôt que
   « Soupçons ») — invisible à l'œil, mais ni le classement géographique ni le
   rapprochement des titres ne les reconnaissaient. Normalisation NFKC ajoutée.

---

## Les sources, et ce que la réalité en dit

**41 sources inscrites, 39 actives.** Le registre a été élargi aux blogs, aux
chaînes de télévision par leur flux YouTube, et aux réseaux sociaux ouverts.

| Famille | Actives | Primaires ? |
|---|---|---|
| Médias Côte d'Ivoire | 6 | oui |
| Médias Afrique | 5 | oui |
| Médias International | 6 | oui |
| Institution (ONU) | 1 | oui |
| Google News | 6 | **non** |
| Blogs et magazines | 10 | **non** |
| Chaînes YouTube | 3 | **non** |
| Réseaux sociaux | 2 | **non** |

### La notion qui compte : `primaire`

Une rédaction qui envoie un journaliste, recueille une déclaration et engage sa
signature est une source **primaire**. Un agrégateur, un blog qui commente, un
fil social qui relaie ne le sont pas — même excellents, même rapides. Ils font
**découvrir** un sujet ; le fait, lui, doit venir d'ailleurs.

AP-02 le lit pour ne jamais fonder sa sélection sur ces sources sans le
signaler ; AP-03 pour ne pas compter deux relais du même article comme deux
corroborations.

### Ce qui n'existe pas, vérifié plutôt que supposé

**Médias ivoiriens** — dix-neuf adresses sondées : Koaci répond 404 sur quatre
chemins, Fraternité Matin et Abidjan.net servent un flux sans articles, **RTI a
un certificat TLS expiré**, la Présidence une chaîne de certificats incomplète.
Six médias fonctionnent : **AIP**, **L'Infodrome**, **Afriksoir**, **Le Point
Sur**, **Yeclo**, **Connectionivoirienne**.

**7info et NCI**, sans flux RSS sur leur site, sont récupérables **par leur
chaîne YouTube** — c'est le seul moyen de les suivre.

**Réseaux sociaux fermés.** X/Twitter n'expose plus aucun flux public et son API
coûte plus de 100 $/mois ; Nitter est mort (HTTP 410) ; Facebook a supprimé les
flux de pages (404) ; Instagram et TikTok interdisent l'extraction. **Aucune de
ces portes ne s'ouvrira par astuce** — elles sont inscrites au registre,
désactivées, avec leur motif.

**Reddit** répond HTTP 429 à toute requête venue d'une adresse de centre de
données, agent navigateur compris. Désactivé pour ne pas encombrer chaque jour
le rapport d'erreurs ; ces flux fonctionnent depuis une connexion ordinaire.

Restent ouverts : **Mastodon** (fils par mot-dièse) et Bluesky.

---

## Quatre décisions d'architecture

**Une seule étape de code, pas quatorze.** Le plan le recommandait déjà pour les
dix branches de collecte ; la même raison vaut pour la suite. Quatorze étapes
chaînées recopient le jeu complet à chaque passage — 147 ko sérialisés treize
fois, sur une machine qui dispose de 1,8 Go et qui fait tourner le site.

**Parallélisme borné à six.** En série, 24 sources à 15 s de délai maximal font
six minutes dans le pire cas ; toutes en même temps saturent les deux cœurs que
le site partage.

**Un nouvel essai, et un seul.** Ajouté après la première exécution réelle :
l'AIP — la source ivoirienne la plus précieuse — a répondu 500 alors qu'elle
fonctionnait quelques minutes plus tôt. Une panne passagère privait le
collecteur de sa meilleure source pour la journée entière. On ne réessaie que ce
qui a des chances d'aboutir : un 500, un 429 ou une coupure réseau — jamais un
404 ni un 403, qui ne changeront pas.

**Le texte prime sur la source pour le classement géographique.** La première
version retombait sur la région du média quand aucun mot-clé ne correspondait :
un article de L'Infodrome intitulé « À court de munitions contre Téhéran, le
Pentagone… » était classé ivoirien et occupait une des cinquante places du quota
Côte d'Ivoire. Un média national parle du monde entier ; sa nationalité ne dit
rien du sujet.

---

## Déduplication : trois niveaux, et ce qu'ils ne font pas

1. **URL canonique** — paramètres de traçage (`utm_*`, `fbclid`…) retirés. C'est
   ce qui fait que le même article, vu par deux chemins, porte la même adresse.
2. **Empreinte SHA-256** du titre normalisé + la date.
3. **Recouvrement de mots** entre titres (Jaccard ≥ 0,62), qui attrape « Ouattara
   reçoit… » et « le chef de l'État ivoirien s'entretient… ».

Le troisième niveau reste **approximatif, et c'est assumé** : la déduplication
sémantique véritable relève d'AP-02, qui seul comprend le sens. Ici on réduit le
volume, on ne décide pas.

Chaque candidat porte `also_covered_by` : les autres rédactions qui couvrent le
même sujet. Un événement repris par cinq médias mérite l'examen — c'est un des
trois termes du score technique, avec la priorité de la source et la fraîcheur.

---

## Les trois règles du plan, et où elles sont appliquées

1. **Une source indisponible n'arrête jamais AP-01** → `Promise.allSettled` par
   lot, chaque échec devient une ligne d'`errors`, le flow continue.
2. **Un article d'agrégateur n'est pas une information vérifiée** → priorité 50,
   et surtout `source.is_aggregator: true` porté dans chaque candidat, pour
   qu'AP-02 sache qu'il faut remonter au média d'origine.
3. **AP-01 collecte, AP-02 sélectionne, AP-03 vérifie** → ce flow ne crée aucun
   article et n'appelle jamais l'API d'Abidjan4All.

---

## Essayer hors d'Activepieces

```bash
node -e "import('./collecteur.mjs').then(async m => console.log((await m.executer()).statistics))"
```

Nécessite Node 18+ (`fetch` natif). Aucune installation.
