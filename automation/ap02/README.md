# AP-02 — Sélection éditoriale

Reçoit le jeu de candidats d'AP-01, le soumet à Claude, et rend la sélection du
jour : **2 sujets Côte d'Ivoire, 2 Afrique, 3 International**.

## Ce qu'AP-02 fait, et ce qu'il ne fait pas

Il **sélectionne** et **rapproche sémantiquement** — AP-01 ne rapprochait que
des mots, lui comprend que « Ouattara reçoit… » et « le chef de l'État ivoirien
s'entretient… » sont le même événement.

Il ne **vérifie** pas (AP-03), il n'**écrit** pas (AP-04), et il ne publie rien.

---

## ⚠️ Il manque une clé API Anthropic

**Rien ne peut tourner sans elle**, et elle n'existe nulle part aujourd'hui :
`AI_API_KEY` est vide côté site, Activepieces n'en déclare aucune.

À obtenir sur `console.anthropic.com`, puis à ranger **dans un secret
Activepieces** — jamais en clair dans le champ d'une étape, et jamais collée
dans une conversation.

**Coût attendu** : environ 21 000 jetons d'entrée par exécution quotidienne, soit
de l'ordre de **0,15 $ par jour, ~4,50 $ par mois** avec Opus 5, jetons de
réflexion compris. Un modèle plus léger diviserait ce coût ; je ne le recommande
pas pour un arbitrage éditorial, qui est précisément la tâche où la qualité de
jugement se voit.

---

## Montage dans Activepieces

Le flow AP-02 est déclenché par **Webhook** (AP-01 lui envoie son jeu en POST).

**Étape Code** — coller `ap02-code-step.js`, et dans le champ `packageJson` :

```json
{"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
```

Version **épinglée**, et non `^0.124.0` : sur un flux quotidien, une mise à jour
mineure qui change un comportement passerait inaperçue jusqu'au jour où la
sélection casse.

Entrées de l'étape :

| Entrée | Valeur |
|---|---|
| `dataset` | `{{trigger.body}}` — ou `{{step_1}}` si AP-01 et AP-02 sont dans le même flow |
| `apiKey` | le secret Anthropic |

---

## Trois partis pris

**Un seul appel à Claude, pas cent cinquante.** Choisir sept sujets parmi cent
cinquante suppose de les comparer entre eux : un modèle qui ne voit qu'un
article à la fois ne peut ni arbitrer, ni repérer que trois d'entre eux
racontent la même chose. Et cent cinquante appels coûteraient cent cinquante
fois plus cher pour un résultat plus faible.

**Sortie structurée** (`output_config.format`, sans en-tête bêta). Demander du
JSON dans la consigne et espérer, c'est accepter qu'un jour la réponse arrive
entourée de « Voici la sélection : » et casse l'étape suivante.

**Réflexion adaptative** (`thinking: {type: "adaptive"}`), le modèle réglant
lui-même son effort. À noter : `budget_tokens` est **refusé par Opus 5** — une
requête qui le porte reçoit une erreur 400.

---

## Ce que le schéma ne garantit pas — et qui est donc validé à la main

Une sortie structurée impose la **forme** : sept objets avec les bons champs.
Elle n'empêche pas les erreurs qui casseraient AP-03 en silence. Chacune est
vérifiée, et **éprouvée** :

| Défaut simulé | Attrapé |
|---|---|
| Identifiant de candidat inventé | oui |
| Six sujets au lieu de sept | oui |
| Même sujet retenu deux fois | oui |
| Région reclassée pour satisfaire le quota | oui |
| Reprise citant un identifiant inexistant | oui |
| Réponse qui n'est pas du JSON | oui |

En cas de grief, **une** reprise — avec le reproche exact, car renvoyer
« recommence » sans dire ce qui cloche produit souvent la même erreur. Au-delà,
échec franc plutôt qu'une boucle.

---

## Ce qui a été éprouvé, et ce qui ne l'est pas

**Éprouvé**, sur le vrai jeu d'AP-01 (150 candidats), avec un modèle simulé :
les sept contrôles ci-dessus, la reprise (2 appels : un fautif, un correct),
l'échec franc après deux essais ratés, l'absence de clé, l'absence de jeu, et la
lecture d'un corps de webhook. L'appel réel atteint bien l'API d'Anthropic — il
répond `401 authentication_error`, ce qui prouve que la requête part et que
l'erreur est rattrapée proprement.

**Non éprouvé, faute de clé** : que l'API accepte le schéma, la réflexion
adaptative et la sortie structurée tels qu'écrits. Ce sera le premier essai à
faire dès que la clé existera.

---

## Le chargement transmis

Le jeu d'AP-01 pèse 146 ko ; seul ce qui sert à choisir est transmis — ni
empreinte SHA-256, ni méthode de collecte, ni URL canonique. **74 ko, soit la
moitié**, environ 21 000 jetons.

Le dossier complet est **ré-attaché après la sélection** : AP-03 a besoin de
l'URL et de la source pour vérifier, et le modèle n'en avait reçu qu'un extrait.

---

## Sortie

```jsonc
{
  "workflow_id": "A4A-2026-09-07-120000",
  "source": "AP-02",
  "status": "SUCCESS",
  "model": "claude-opus-5",
  "statistics": {
    "candidates_received": 150,
    "selected": 7,
    "by_region": { "Cote_Ivoire": 2, "Afrique": 2, "International": 3 },
    "grouped_duplicates": 0,
    "repaired": false,
    "input_tokens": 21000,
    "output_tokens": 1200
  },
  "reserves": "…",              // ce qui manquait, dit franchement
  "selection": [
    {
      "candidate_id": "A4A-CAND-000004",
      "region": "Cote_Ivoire",
      "priorite": 1,
      "angle": "…",
      "justification": "…",
      "interet_diaspora": "…",
      "verification_requise": ["…"],   // feuille de route d'AP-03
      "reprises": ["A4A-CAND-000031"],
      "reprises_detail": [ /* titre, source, url de chaque reprise */ ],
      "title": "…", "url": "…", "source": { }, "published_at": "…"
    }
  ]
}
```

Le champ `reserves` est délibéré : si une région n'offre aucun sujet qui mérite
son quota, la consigne demande de le dire plutôt que de présenter un sujet
faible comme fort.

---

## Essayer hors d'Activepieces

```bash
npm i @anthropic-ai/sdk@0.124.0
ANTHROPIC_API_KEY=... node -e "
  import('../ap01/collecteur.mjs').then(async ap01 =>
  import('./selecteur.mjs').then(async ap02 =>
    console.log(JSON.stringify((await ap02.executer(await ap01.executer())).selection, null, 1))))"
```
