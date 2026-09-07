# AP-04 — Rédaction

Reçoit les dossiers de vérification d'AP-03, écrit les brouillons, et les dépose
dans le Studio par l'API du site.

C'est le bout de la chaîne : **le seul module qui écrit dans la base du
journal**.

---

## Trois garde-fous, par ordre d'importance

### 1. Il n'écrit pas ce qui n'est pas vérifié

Un dossier dont AP-03 a dit **`fragile`** ou **`non_verifie`** n'est pas rédigé.
Il ressort dans `ecartes`, avec son motif, pour la rédaction.

C'est le contraire du réflexe naturel d'un modèle, qui écrira volontiers un
article sur trois lignes de résumé RSS. Éprouvé : sur quatre dossiers portant
les quatre verdicts, deux sont rédigés, deux écartés.

### 2. Il ne cite que ce qui existe

Chaque citation de l'article doit se retrouver dans celles qu'AP-03 a relevées
**dans les textes réellement lus**. Le contrôle est mécanique, pas déclaratif.

| Citation proposée | Sort |
|---|---|
| Exacte, telle qu'AP-03 l'a relevée | acceptée |
| Reformulée de près (fragment de la vraie) | acceptée |
| **« Je démissionnerai avant la fin du mois »** — jamais prononcée | **refusée** |

Une citation inventée fait repartir la copie en correction ; à la seconde
tentative, l'article est écarté. C'est le risque le plus grave de toute la
chaîne : prêter à un ministre une phrase qu'il n'a pas dite.

### 3. Il ne publie jamais

**Trois barrières indépendantes**, et c'est délibéré — une seule aurait suffi,
trois signifient qu'aucune erreur de configuration ne met un texte en ligne :

1. La **simulation est active par défaut** : AP-04 rend ce qu'il aurait déposé.
2. La route `POST /api/v1/articles` **force `status: "draft"`** quel que soit
   l'appelant.
3. Le jeton est adossé au compte `activepieces@abidjan4all.info`, de rôle
   **journaliste**, qui n'a pas le droit de publier.

---

## Sans modèle, il n'écrit pas

Contrairement à AP-02 et AP-03, **il n'y a pas de repli utile ici**. Une
sélection peut se faire au score technique, une vérification peut se réduire à
un inventaire de sources. Un article, non. Sans clé, AP-04 échoue franchement
en le disant.

---

## Ce que voit le rédacteur en chef

Le brouillon déposé porte **en tête du corps** un bloc `note` — celui que le
site affiche en vert. Les réserves sont donc visibles avant le texte, sans
ouvrir un autre outil :

```
Brouillon produit automatiquement (AP-04). À relire et à retirer avant publication.
Réserves : il manque une confirmation officielle du ministère
Vérification AP-03 : a_completer — deux sources concordantes, une donnée isolée
À obtenir : la confirmation du chiffre auprès du CCC
Source retenue : https://…
```

Les mentions d'amont **se propagent** : `selection_relue_par_un_modele` et
`verification_par_un_modele` traversent toute la chaîne. Un article écrit sur
une sélection jamais relue le dit jusqu'au bout.

---

## La consigne d'écriture

Elle interdit d'ajouter le moindre fait venu des connaissances du modèle — ni
une date, ni un titre de fonction, ni un contexte historique. Ce que le dossier
ne dit pas n'existe pas.

Elle règle aussi le traitement des points incertains :

| Verdict AP-03 | Ce que fait l'article |
|---|---|
| `concordant` | l'écrit comme un fait |
| `source_unique` | l'attribue explicitement (« selon RFI ») |
| `divergent` | rapporte le désaccord — souvent le meilleur passage |
| `inverifiable` | ne l'écrit pas du tout |

Et elle proscrit les tics d'écriture automatique, d'après le référentiel que
vous employez : la tournure « ce n'est pas X, c'est Y », les adjectifs empilés
par trois, les incises entre tirets cadratins à répétition, la conclusion
récapitulative sur un texte de 400 mots, et le vocabulaire passe-partout
(crucial, déterminant, paysage au figuré, s'inscrire dans, il convient de
noter…). Attaque par le fait, longueurs de phrases variées, noms et chiffres
plutôt qu'abstractions.

---

## Montage dans Activepieces

Déclencheur **Webhook** (AP-03 envoie ses dossiers), puis **étape Code** avec
`packageJson` :

```json
{"dependencies":{"@anthropic-ai/sdk":"0.124.0"}}
```

| Entrée | Valeur |
|---|---|
| `dossiers` | `{{trigger.body}}` |
| `apiKey` | le secret Anthropic |
| `jeton` | le jeton du site — **seulement** si la simulation est désactivée |
| `reglages` | `{"simulation": false}` pour déposer réellement |

Le jeton se lit sur le serveur :

```bash
ssh root@212.227.205.163 "cat /root/activepieces/jeton-api-abidjan4all.txt"
```

Les rubriques sont **lues au vol** sur `/api/v1/rubriques`, jamais figées : une
rubrique créée dans le Studio devient disponible sans redéployer l'étape. C'est
ainsi que « Santé » est apparue.

---

## Ce qui a été éprouvé

**Un dépôt réel** sur `abidjan4all.info`, puis supprimé. L'article est bien
arrivé : `status: draft`, auteur `activepieces@abidjan4all.info`, rubrique
« Cacao & Marchés », 5 blocs dont la note en tête, temps de lecture calculé.

Le reste, avec un modèle doublé et les rubriques réelles du site (20 lues) : le
tri par verdict, les trois cas du contrôle des citations, les quatre autres
contrôles (rubrique inexistante, un seul paragraphe, titre trop court, dossier
inconnu), le cas « aucun dossier rédigeable » (`RIEN_A_ECRIRE`), le refus
d'écrire sans modèle, le refus de déposer sans jeton, et la propagation des
mentions d'amont.

**Non éprouvé, faute de clé** : la qualité de l'écriture elle-même. Que le
modèle tienne la consigne — qu'il n'ajoute aucun fait, attribue correctement les
points à source unique, et écrive dans un français qui ne sente pas la machine —
ne se juge qu'en lisant de vrais articles.

**C'est ici que votre relecture comptera le plus.** Les premiers brouillons
doivent être lus ligne à ligne, en mode `direct`, simulation comprise, avant
d'autoriser le moindre dépôt.

---

## Coût

**3 $/mois** en lot (6 $ en direct), pour 7 articles par jour.

---

## Essayer

```bash
node essai.mjs
```
