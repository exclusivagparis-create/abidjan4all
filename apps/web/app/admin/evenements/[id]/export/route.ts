import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

export const dynamic = "force-dynamic";

function csv(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /admin/evenements/:id/export — liste des inscrits, en CSV (accueil, badges).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!PUBLISH_ROLES.includes(session?.user?.role as (typeof PUBLISH_ROLES)[number])) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const { id } = await params;
  const ev = await prisma.event.findUnique({
    where: { id },
    include: {
      registrations: {
        orderBy: { user: { name: "asc" } },
        include: { user: { select: { name: true, email: true } }, ticket: { select: { label: true, prix: true } } },
      },
    },
  });
  if (!ev) return new Response("Introuvable", { status: 404 });

  const header = ["Nom", "Email", "Billet", "Montant (FCFA)", "Code d'entrée", "État", "Inscrit le"];
  const etat: Record<string, string> = { confirmed: "Confirmé", pending: "En attente", cancelled: "Annulé" };
  const lignes = ev.registrations.map((r) =>
    [
      r.user.name,
      r.user.email,
      r.ticket.label,
      r.ticket.prix,
      r.code,
      etat[r.status] ?? r.status,
      r.createdAt.toISOString().slice(0, 10),
    ]
      .map(csv)
      .join(";")
  );
  // BOM : Excel ouvre le fichier en UTF-8 sans le demander.
  const corps = "﻿" + [header.join(";"), ...lignes].join("\r\n");
  const nom = `inscrits-${ev.slug}.csv`;

  return new Response(corps, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
    },
  });
}
