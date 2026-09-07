# AP-03 — Vérification

Reçoit la sélection d'AP-02, **va chercher le texte réel des articles**, le
recoupe entre sources, et rend un dossier de vérification par sujet.

C'est la première étape qui lit les articles. AP-01 n'avait que le résumé RSS —
trois cents caractères, avec quoi on ne vérifie rien.

---

## Ce qu'AP-03 ne peut pas faire, et qui gouverne tout le reste

**Un modèle de langage n'établit pas la vérité d'un fait.** Il ne peut que
comparer ce que disent les textes qu'on lui met sous les yeux. C'est une
distinction éditoriale, pas une nuance technique : « trois rédactions
indépendantes donnent le même chiffre » n'est pas « le chiffre est exact », et
un dossier qui confondrait les deux ferait courir un risque au journal.

Les verdicts sont donc énumérés dans le schéma, et **aucun ne dit « vrai »** :

| Verdict | Sens |
|---|---|
| `concordant` | au moins **deux domaines différents** disent la même chose |
| `source_unique` | une seule source l'affirme — pas une faute, mais à savoir |
| `divergent` | les sources se contredisent — **le verdict le plus précieux** |
| `inverifiable` | rien dans les textes obtenus ne permet de trancher |

La consigne interdit explicitement au modèle d'utiliser ses connaissances
générales : si les textes ne le disent pas, c'est invérifiable ici, même s'il
croit le savoir. Un souvenir de modèle présenté comme une vérification
tromperait la rédaction.

---

## La base documentaire est variable — et c'est le point délicat

Mesuré sur le jeu réel : **83 %** des articles de l'échantillon livrent leur
texte intégral. Pas tous.

| Source | Ce qu'on obtient |
|---|---|
| RFI, BBC, The Guardian, France 24, ONU Info | texte complet — 3 000 à 11 500 caractères |
| Jeune Afrique | le chapô libre seulement |
| **Le Monde** | **HTTP 402 — payant. 0 sur 8 articles** |
| L'Infodrome, Le Point Sur | page d'attente anti-robot (`class="isloading"`) |
| Google News | lien encodé, média d'origine masqué |

Chaque sujet porte donc sa `base_documentaire` : ce qui a été **réellement lu**.

```jsonc
"base_documentaire": {
  "sources_consultees": 2, "sources_lues": 1,
  "sources_independantes": 1, "caracteres_lus": 3390,
  "seulement_le_resume_rss": false,
  "detail": [{ "source": "AIP", "statut": "texte", "caracteres": 3390 },
             { "source": "AIP", "statut": "maigre", "motif": "moins de 400 caractères extraits…" }]
}
```

Un dossier qui ne dirait pas « je n'avais qu'un résumé de trois cents
caractères » serait pire qu'inutile : il inviterait la rédaction à se fier à une
vérification qui n'a pas eu lieu.

**Aucun paywall n'est contourné.** Un 402 est un refus, il est rapporté comme
tel.

### `sources_independantes` compte les domaines, pas les textes

Sur un sujet de l'essai, deux textes ont été lus — tous deux de la BBC. Le
compte reste à **1**. C'est exactement la fausse corroboration qu'il ne faut pas
compter, et le même piège vaut pour deux médias qui reprennent la même dépêche
d'agence : la consigne demande au modèle de le repérer et de classer en
`source_unique`.

---

## Montage dans Activepieces

Déclencheur **Webhook** (AP-02 envoie sa sélection), puis **étape Code** :
coller `ap03-code-step.js`, `packageJson` :

```json
{"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
```

| Entrée | Valeur |
|---|---|
| `selection` | `{{trigger.body}}` |
| `apiKey` | le secret Anthropic |
| `reglages` | facultatif — `{"mode":"direct"}` pour le mode immédiat |

Mêmes modes qu'AP-02 : **`lot`** par défaut (moitié prix), `direct`, et le
**repli**. Coût mesuré : ~7 000 jetons d'entrée, soit **2,75 $/mois** par lots,
5,51 $ en direct.

---

## Le repli

Sans modèle, AP-03 rend tout de même un service réel : il dit ce qui a été lu,
combien de rédactions indépendantes couvrent le sujet, et ce qui était
inaccessible. **Il ne prononce aucun verdict** — tout est `non_verifie`, et
`a_obtenir` porte : « Tout : ce dossier n'a pas été vérifié. »

La mention se **propage** depuis AP-02 : `selection_relue_par_un_modele` est
recopié dans la sortie. Sans cela, une sélection de repli passée par une
vérification réussie aurait l'air entièrement validée.

---

## Ce que le schéma ne garantit pas

Validé à la main, et éprouvé :

| Défaut simulé | Attrapé |
|---|---|
| Un sujet oublié | oui |
| Dossier pour un sujet inconnu | oui |
| `concordant` avec une seule source citée | oui |
| **`solide` alors qu'aucun texte n'a pu être lu** | oui |

Le dernier est le plus important : c'est la complaisance qu'on veut empêcher.
En cas de grief, une reprise avec le reproche exact, puis repli.

---

## Un défaut trouvé en exécutant, et corrigé dans AP-02

Au premier essai, `sources_independantes` valait **1 pour tous les sujets** : le
recoupement était impossible. La cause était dans AP-02 — son repli construisait
les reprises à partir d'identifiants de candidats, or `also_covered_by` d'AP-01
ne contient que `{source, url}`, jamais d'identifiant. Les reprises sortaient
donc vides.

AP-02 retombe désormais sur les rapprochements d'AP-01 quand le modèle n'en
fournit pas, avec leur `origine` notée (`modele` ou `ap01`) : un rapprochement
par recouvrement de mots n'a pas la valeur d'un rapprochement compris.

---

## Ce qui a été éprouvé, et ce qui ne l'est pas

**Éprouvé, avec récupération réelle** — vraies URL, vrais paywalls, vraies pages
anti-robot : les cinq états de récupération (`texte`, `payant`, `protege`,
`agregateur`, `injoignable`), le dossier complet de bout en bout sur les sept
sujets, les quatre contrôles de validation, les chemins vers le repli, et la
propagation de la mention d'AP-02.

**Non éprouvé, faute de clé** : les verdicts eux-mêmes. Que le modèle respecte
la discipline des quatre verdicts et refuse de conclure sur une base mince, cela
ne se vérifie qu'avec une vraie clé — et c'est ce qu'il faudra regarder en
premier, en mode `direct`.

---

## Essayer

```bash
node essai.mjs
```
