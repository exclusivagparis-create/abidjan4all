import { offresPubliques } from "@/lib/offres";

// GET /api/v1/plans → [{ id, price, currency, features }] (contrat)
//
// `price` est le prix réellement dû, remise comprise : un client de l'API qui
// afficherait le prix catalogue annoncerait un montant que le checkout ne
// débiterait pas. Le prix barré reste disponible via `listPrice`.
export async function GET() {
  const offres = await offresPubliques();
  return Response.json(
    offres.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.prix,
      listPrice: o.prixCatalogue,
      discounted: o.remise,
      currency: "XOF",
      features: o.features,
    }))
  );
}
