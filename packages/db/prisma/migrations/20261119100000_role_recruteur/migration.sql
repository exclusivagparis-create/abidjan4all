-- Rôle « recruteur » : accès permanent à la CVthèque, accordé depuis le Studio.
--
-- L'accès payant (table RecruiterAccess) reste le chemin normal, et il porte
-- une échéance. Ce rôle couvre l'autre cas : le partenaire, la contrepartie
-- d'un échange, l'essai avant achat — des accès qu'on accorde à la main et
-- qu'on veut voir écrits quelque part, plutôt que simulés en repoussant une
-- date d'échéance dans la table des abonnements payés.
--
-- `ADD VALUE` sur un type énuméré : PostgreSQL 12+ l'accepte dans une
-- transaction tant que la valeur n'est pas utilisée dans la même transaction.
-- C'est le cas ici — aucune ligne n'est écrite avec ce rôle par cette
-- migration. (Le serveur tourne en PostgreSQL 15.)

ALTER TYPE "Role" ADD VALUE 'recruteur';
