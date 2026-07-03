import { prisma } from "@a4a/db";
import { absoluteUrl, SITE_NAME, xmlEscape } from "@/lib/seo";

export const revalidate = 300;

// Sitemap Google News : articles publiés dans les dernières 48 h (max 1 000).
export async function GET() {
  const since = new Date(Date.now() - 48 * 3600 * 1000);
  // tolérant au build sans base : régénéré au runtime (ISR 5 min)
  const articles = await prisma.article
    .findMany({
      where: { status: "published", publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      take: 1000,
      select: {
        slug: true,
        title: true,
        publishedAt: true,
        tags: true,
        rubrique: { select: { slug: true } },
      },
    })
    .catch(() => []);

  const urls = articles
    .map(
      (a) => `  <url>
    <loc>${absoluteUrl(`/${a.rubrique.slug}/${a.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(SITE_NAME)}</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${a.publishedAt?.toISOString()}</news:publication_date>
      <news:title>${xmlEscape(a.title)}</news:title>
      ${a.tags.length ? `<news:keywords>${xmlEscape(a.tags.join(", "))}</news:keywords>` : ""}
    </news:news>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
