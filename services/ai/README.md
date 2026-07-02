# services/ai (placeholder)

Couche d'accès LLM prévue par le handoff (README §Stack, API_CONTRACTS.md §IA) :

- `GET /ai/summary/:articleId` — résumé automatique (keyPoints + long) → `Article.aiSummary`
- `POST /ai/translate` — traduction FR→EN (Africa in English)
- `POST /ai/chat` — assistant éditorial avec sources
- `POST /ai/moderate` — score de toxicité pour la modération des commentaires
- `GET /ai/recommendations` — feed « Pour vous » (User.interests)

À implémenter en phase DF-04/DF-05. Variables : `AI_API_KEY`, `AI_MODEL`.
