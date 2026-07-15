"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@a4a/db";
import { auth, PUBLISH_ROLES } from "@/auth";

async function requirePublisher() {
  const session = await auth();
  if (!session?.user || !PUBLISH_ROLES.includes(session.user.role as (typeof PUBLISH_ROLES)[number])) {
    redirect("/login?next=/admin/menu");
  }
}

/** L'en-tête est sur toutes les pages : on purge le cache de tout le site. */
function rafraichir() {
  revalidatePath("/admin/menu");
  revalidatePath("/", "layout");
}

export async function createMenuItemAction(formData: FormData): Promise<void> {
  await requirePublisher();
  const label = String(formData.get("label") ?? "").trim().slice(0, 40);
  let href = String(formData.get("href") ?? "").trim().slice(0, 300);
  if (href && !href.startsWith("/") && !/^https?:\/\//.test(href)) href = `/${href}`;

  if (!label) redirect("/admin/menu?erreur=label");
  if (!href) redirect("/admin/menu?erreur=href");

  const dernier = await prisma.menuItem.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  await prisma.menuItem.create({ data: { label, href, order: (dernier?.order ?? 0) + 10 } });
  rafraichir();
  redirect("/admin/menu");
}

export async function updateMenuItemAction(id: string, formData: FormData): Promise<void> {
  await requirePublisher();
  const label = String(formData.get("label") ?? "").trim().slice(0, 40);
  let href = String(formData.get("href") ?? "").trim().slice(0, 300);
  if (href && !href.startsWith("/") && !/^https?:\/\//.test(href)) href = `/${href}`;

  if (!label) redirect("/admin/menu?erreur=label");
  if (!href) redirect("/admin/menu?erreur=href");

  await prisma.menuItem.update({ where: { id }, data: { label, href } }).catch(() => {});
  rafraichir();
  redirect("/admin/menu");
}

export async function toggleMenuItemAction(id: string): Promise<void> {
  await requirePublisher();
  const item = await prisma.menuItem.findUnique({ where: { id }, select: { visible: true } });
  if (item) await prisma.menuItem.update({ where: { id }, data: { visible: !item.visible } });
  rafraichir();
  redirect("/admin/menu");
}

/** Échange la position avec l'entrée voisine, dans la direction demandée. */
export async function moveMenuItemAction(id: string, direction: "up" | "down"): Promise<void> {
  await requirePublisher();
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (item) {
    const voisin = await prisma.menuItem.findFirst({
      where: direction === "up" ? { order: { lt: item.order } } : { order: { gt: item.order } },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
    });
    if (voisin) {
      await prisma.$transaction([
        prisma.menuItem.update({ where: { id: item.id }, data: { order: voisin.order } }),
        prisma.menuItem.update({ where: { id: voisin.id }, data: { order: item.order } }),
      ]);
    }
  }
  rafraichir();
  redirect("/admin/menu");
}

export async function deleteMenuItemAction(id: string): Promise<void> {
  await requirePublisher();
  await prisma.menuItem.delete({ where: { id } }).catch(() => {});
  rafraichir();
  redirect("/admin/menu");
}

/** Recopie le menu par défaut en base, pour partir d'une base modifiable. */
export async function seedMenuAction(): Promise<void> {
  await requirePublisher();
  if ((await prisma.menuItem.count()) === 0) {
    await prisma.menuItem.createMany({
      data: [
        { label: "À la une", href: "/", order: 10 },
        { label: "En Direct", href: "/en-direct", order: 20 },
        { label: "Vidéos", href: "/videos", order: 30 },
        { label: "Diaspora", href: "/diaspora", order: 40 },
        { label: "Business", href: "/business", order: 50 },
      ],
    });
  }
  rafraichir();
  redirect("/admin/menu");
}
