import type { MetadataRoute } from "next";
import { prisma } from "@a4a/db";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // tolérant au build sans base (docker build/CI) : régénéré au runtime (ISR 1 h)
  const [articles, rubriques] = await Promise.all([
    prisma.article.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true, rubrique: { select: { slug: true } } },
      orderBy: { publishedAt: "desc" },
      take: 5000,
    }),
    prisma.rubrique.findMany({ select: { slug: true }, orderBy: { order: "asc" } }),
  ]).catch(() => [[], []] as const);

  const statics: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/en-direct"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/recherche"), changeFrequency: "weekly", priority: 0.3 },
    { url: absoluteUrl("/abonnement"), changeFrequency: "monthly", priority: 0.6 },
  ];

  return [
    ...statics,
    ...rubriques.map((r) => ({
      url: absoluteUrl(`/${r.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...articles.map((a) => ({
      url: absoluteUrl(`/${a.rubrique.slug}/${a.slug}`),
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
