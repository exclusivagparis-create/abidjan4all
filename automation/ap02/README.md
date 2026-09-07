# AP-02 — Sélection éditoriale

Reçoit le jeu de candidats d'AP-01, le soumet à Claude, et rend la sélection du
jour : **2 sujets Côte d'Ivoire, 2 Afrique, 3 International**.

Il **sélectionne** et **rapproche sémantiquement** — AP-01 ne rapprochait que
des mots, lui comprend que « Ouattara reçoit… » et « le chef de l'État ivoirien
s'entretient… » sont le même événement. Il ne **vérifie** pas (AP-03), il
n'**écrit** pas (AP-04), et il ne publie rien.

---

## Deux modes et un repli

| Mode | Coût mensuel | Latence | Quand |
|---|---|---|---|
| **`lot`** (par défaut) | **2,32 $** | quelques minutes à ~1 h | le fonctionnement normal |
| `direct` | 4,63 $ | 1 à 2 min | mise au point, ou besoin immédiat |
| `repli` | 0 $ | instantané | le modèle est hors d'atteinte |

**Pourquoi les lots par défaut.** L'API des lots offre **50 % de remise** contre
un traitement asynchrone. La sélection quotidienne n'a aucune urgence de
latence — attendre vingt minutes ne change rien à un journal qui paraît dans la
journée. Cette patience vaut la moitié de la facture.

**Le repli** prend la main quand le modèle est inatteignable — clé absente, API
en panne, crédit épuisé, lot trop lent. La sélection se fait alors sur le seul
score technique d'AP-01. La chaîne continue au lieu de s'arrêter, **et la sortie
dit qu'elle est dégradée** :

```jsonc
"status": "DEGRADED",
"relue_par_un_modele": false,
"model": null,
"motif_repli": "Appel au modèle en échec : 529 overloaded_error",
"selection": [{ "angle": null, "justification": null,
  "verification_requise": ["Sélection de repli : aucun modèle ne l'a relue. …"] }]
```

C'est le point important. Un score technique mesure la qualité de la **source**
et la fraîcheur, pas l'intérêt du sujet pour un lecteur ivoirien. Une sélection
de repli qui se ferait passer pour une sélection relue serait pire que pas de
sélection du tout — d'où `relue_par_un_modele: false`, les champs éditoriaux
laissés à `null` plutôt que remplis d'à-peu-près, et l'avertissement porté dans
`verification_requise`, là où AP-03 le lira.

Pour l'interdire et échouer franchement : `reglages.repliAutorise = false`.

---

## ⚠️ Il manque une clé API Anthropic

Sans elle, AP-02 tourne mais **toujours en repli**. Un abonnement Claude Pro
n'ouvre aucun droit sur l'API : ce sont deux produits, deux facturations.

À obtenir sur `console.claude.com`, puis à ranger **dans un secret
Activepieces** — jamais en clair dans le champ d'une étape. Posez un plafond de
dépense mensuel dans la Console (5 ou 10 $ suffisent largement pour 2,32 $
d'usage) : c'est ce qui rend tout dérapage impossible.

---

## Montage dans Activepieces

Déclencheur **Webhook** — AP-01 lui envoie son jeu en POST.

**Étape Code** : coller `ap02-code-step.js`, et dans `packageJson` :

```json
{"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
```

Version **épinglée**, et non `^0.124.0` : sur un flux quotidien, une mise à jour
mineure qui change un comportement passerait inaperçue jusqu'au jour où la
sélection casse.

| Entrée | Valeur |
|---|---|
| `dataset` | `{{trigger.body}}`, ou `{{step_1}}` si AP-01 et AP-02 partagent le flow |
| `apiKey` | le secret Anthropic |
| `reglages` | facultatif — `{"mode":"direct"}` pour forcer le mode immédiat |

### Réglage serveur, indispensable au mode par lots

`AP_FLOW_TIMEOUT_SECONDS` **a été porté de 600 à 3600** dans
`/root/activepieces/.env`. Sans cela, Activepieces coupe le flow au bout de dix
minutes, avant que le lot n'ait abouti — et AP-02 basculerait en repli sans
raison valable. Sauvegarde : `/root/activepieces-env.avant-lots`.

Le coût de ce réglage : un flow qui attend occupe une des **deux** places de
travail (concurrence fixée à 2). Avec un seul flow quotidien, c'est sans
conséquence ; à surveiller le jour où AP-03 à AP-06 tourneront en parallèle.

---

## Trois partis pris

**Un seul appel à Claude, pas cent cinquante.** Choisir sept sujets parmi cent
cinquante suppose de les comparer entre eux : un modèle qui ne voit qu'un
article à la fois ne peut ni arbitrer, ni repérer que trois d'entre eux
racontent la même chose. Un lot d'une seule requête peut sembler absurde — c'est
pourtant ce que la remise récompense : on renonce à l'immédiateté, pas au volume.

**Sortie structurée** (`output_config.format`, sans en-tête bêta). Demander du
JSON dans la consigne et espérer, c'est accepter qu'un jour la réponse arrive
entourée de « Voici la sélection : » et casse l'étape suivante.

**Réflexion adaptative** (`thinking: {type: "adaptive"}`). À noter :
`budget_tokens` est **refusé par Opus 5** — une requête qui le porte reçoit 400.

---

## Ce que le schéma ne garantit pas

Une sortie structurée impose la **forme** : sept objets avec les bons champs.
Elle n'empêche pas les erreurs qui casseraient AP-03 en silence. Chacune est
validée, et **éprouvée** :

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
repli.

---

## Ce qui a été éprouvé, et ce qui ne l'est pas

**Éprouvé**, sur le vrai jeu d'AP-01 (150 candidats) avec un modèle doublé :

- les six contrôles ci-dessus ;
- la reprise (2 appels : un fautif, un correct) ;
- **les quatre chemins vers le repli** — clé absente, API en panne (529), lot
  trop lent, sélection invalide après reprise — chacun rendant `DEGRADED`,
  `relue_par_un_modele: false`, et conservant l'identifiant du lot quand il y en
  a un, pour ne rien perdre ;
- l'interdiction du repli (`FAILED` franc) ;
- le mode `lot` de bout en bout ;
- la lecture d'un corps de webhook.

Les **deux chemins atteignent réellement l'API d'Anthropic** : avec une fausse
clé, `direct` comme `lot` répondent `401 authentication_error`, ce qui prouve
que la requête part et que l'erreur est rattrapée. Et avec le repli actif, la
chaîne rend malgré tout ses sept sujets.

**Non éprouvé, faute de clé** : que l'API accepte le schéma, la réflexion
adaptative et la sortie structurée tels qu'écrits, et le sondage réel d'un lot
jusqu'à `processing_status: "ended"`. Ce sera le premier essai dès que la clé
existera — à faire en mode `direct` d'abord, qui répond en deux minutes.

---

## Le chargement transmis

Le jeu d'AP-01 pèse 146 ko ; seul ce qui sert à choisir est transmis — ni
empreinte SHA-256, ni méthode de collecte, ni URL canonique. **73 ko, soit la
moitié**, environ 21 000 jetons.

Le dossier complet est **ré-attaché après** la sélection : AP-03 a besoin de
l'URL et de la source pour vérifier, et le modèle n'en avait reçu qu'un extrait.
Le repli fait de même — un sujet retenu sans modèle garde son titre et son URL.

---

## Essayer

Sans clé, tous les chemins sauf l'appel réel :

```bash
node essai.mjs
```

Avec une clé :

```bash
npm i @anthropic-ai/sdk@0.124.0
ANTHROPIC_API_KEY=... node -e "
  import('../ap01/collecteur.mjs').then(ap01 =>
  import('./selecteur.mjs').then(async ap02 => {
    const r = await ap02.executer(await ap01.executer(), { reglages: { mode: 'direct' } });
    console.log(r.status, r.mode, r.relue_par_un_modele);
    console.log(JSON.stringify(r.selection.map(s => ({ region: s.region, titre: s.title, angle: s.angle })), null, 1));
  }))"
```
