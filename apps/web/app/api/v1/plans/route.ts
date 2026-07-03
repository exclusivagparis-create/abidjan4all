import { PLANS } from "@a4a/payments";

// GET /api/v1/plans → [{ id, price, currency, features }] (contrat)
export async function GET() {
  return Response.json(
    PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: "XOF",
      features: p.features,
    }))
  );
}
