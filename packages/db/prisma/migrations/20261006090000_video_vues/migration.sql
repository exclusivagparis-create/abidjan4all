-- Compteur de lectures par vidéo.
--
-- La rubrique Vidéos n'avait aucune mesure : impossible de savoir quel format
-- retient, ni de le dire à un annonceur. Le compteur enregistre les lectures
-- lancées DEPUIS LE SITE — un clic sur une vignette, une interaction avec le
-- lecteur intégré. Les lectures faites sur YouTube ou Facebook, elles, ne nous
-- sont pas visibles : ce chiffre est donc un plancher, jamais un total.
--
-- Colonne sur Video plutôt qu'une table d'événements : on veut un nombre à
-- afficher, pas un historique à analyser, et la mesure d'audience du site
-- (PageView) reste le seul endroit où l'on compte des visites.

ALTER TABLE "Video" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
