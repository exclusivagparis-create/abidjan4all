# @a4a/ai

Couche IA du cahier des charges (API Claude via le SDK officiel `@anthropic-ai/sdk`).

Implémenté :
- `summarizeArticle` → `GET /api/v1/ai/summary/:articleId` (cache dans `Article.aiSummary`)
- `moderateText` → `POST /api/v1/ai/moderate` + modération auto des commentaires
- `answerFromSources` → `GET /api/v1/ai/search` + bloc « Réponse A4A » sur /recherche

Sans `AI_API_KEY`, chaque fonction bascule sur un repli heuristique déterministe
(champ `engine: "heuristique"`) — l'app reste testable hors ligne.

Variables : `AI_API_KEY` (clé Anthropic), `AI_MODEL` (défaut `claude-opus-4-8`).

Restent (contrat §IA) : `POST /ai/translate` (FR→EN), `POST /ai/chat`,
`GET /ai/recommendations` (feed « Pour vous »).
