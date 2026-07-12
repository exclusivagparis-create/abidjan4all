import { absoluteUrl } from "@/lib/seo";

/**
 * Boutons de partage réseaux sociaux (liens de partage officiels — pas de
 * script tiers, respectueux de la vie privée). Rendu serveur, sans JS.
 */
export function ShareButtons({ path, title }: { path: string; title: string }) {
  const url = absoluteUrl(path);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const links: Array<{ label: string; href: string; bg: string; icon: string }> = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, bg: "#1877F2", icon: "f" },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, bg: "#111", icon: "𝕏" },
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, bg: "#25D366", icon: "✆" },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, bg: "#0A66C2", icon: "in" },
    { label: "Email", href: `mailto:?subject=${t}&body=${u}`, bg: "#555", icon: "✉" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Partager</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Partager sur ${l.label}`}
          title={l.label}
          className="flex h-8 w-8 items-center justify-center rounded-pill text-[13px] font-bold text-white transition-transform hover:scale-110"
          style={{ background: l.bg }}
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}
