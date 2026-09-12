import { prisma } from "@a4a/db";

/**
 * Réunit un compte et les inscriptions newsletter portant la même adresse.
 *
 * La rédaction peut inscrire une adresse avant que la personne n'ait un
 * compte : import d'un fichier de salon, demande reçue au téléphone.
 * L'inscription vit alors sans `userId`. Le jour où un compte naît avec cette
 * adresse, il faut les réunir — sinon la personne ne verrait pas ses lettres
 * dans son espace membre, s'y réinscrirait en doublon, et la rédaction
 * compterait deux fois le même lecteur.
 *
 * Appelé à chaque naissance de compte : inscription libre, création par
 * l'administration, première connexion par un fournisseur social.
 *
 * Ne jette jamais : un rattachement raté ne doit pas faire échouer
 * l'inscription elle-même, qui est l'opération que l'utilisateur attend.
 * Renvoie le nombre d'inscriptions rattachées.
 */
export async function rattacherInscriptionsNewsletter(userId: string, email: string): Promise<number> {
  const adresse = email.trim().toLowerCase();
  if (!adresse) return 0;

  try {
    const { count } = await prisma.newsletterSubscription.updateMany({
      where: { email: adresse, userId: null },
      data: { userId },
    });
    return count;
  } catch {
    return 0;
  }
}
