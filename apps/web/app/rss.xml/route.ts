import { prisma } from "@a4a/db";
import { absoluteUrl, SITE_NAME, SITE_URL, xmlEscape } from "@/lib/seo";

export const revalidate = 600;

// Flux RSS 2.0 — 30 derniers articles publiés.
export async function GET() {
  // tolérant au build sans base : flux vide, régénéré au runtime (ISR 10 min)
  const articles = await prisma.article
    .findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 30,
      select: {
        slug: true,
        title: true,
        dek: true,
        publishedAt: true,
        author: { select: { name: true } },
        rubrique: { select: { slug: true, name: true } },
      },
    })
    .catch(() => []);

  const items = articles
    .map((a) => {
      const url = absoluteUrl(`/${a.rubrique.slug}/${a.slug}`);
      return `    <item>
      <title>${xmlEscape(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      ${a.dek ? `<description>${xmlEscape(a.dek)}</description>` : ""}
      <category>${xmlEscape(a.rubrique.name)}</category>
      <dc:creator>${xmlEscape(a.author.name)}</dc:creator>
      ${a.publishedAt ? `<pubDate>${a.publishedAt.toUTCString()}</pubDate>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml"/>
    <description>Média numérique de la Côte d'Ivoire et de la diaspora</description>
    <language>fr</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
