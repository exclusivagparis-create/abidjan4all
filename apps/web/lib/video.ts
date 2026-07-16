/**
 * Reconnaissance des URLs de vidéo et construction des URLs d'intégration.
 *
 * Règle de sécurité : on n'accepte JAMAIS un code <iframe> collé par la
 * rédaction — ce serait une injection de HTML arbitraire (XSS) dans toutes
 * les pages du site. On accepte une URL, on vérifie que son domaine fait
 * partie d'une liste blanche, on en extrait un identifiant au format strict,
 * et c'est NOUS qui fabriquons l'URL d'intégration à partir de cet identifiant.
 */

export type VideoProvider = "youtube" | "facebook" | "vimeo" | "dailymotion";

export const PROVIDER_LABEL: Record<VideoProvider, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  vimeo: "Vimeo",
  dailymotion: "Dailymotion",
};

/** Identifiant de vidéo : lettres, chiffres, tiret, souligné (aucun / ni ?). */
const ID_SUR = /^[A-Za-z0-9_-]{1,64}$/;

const HOTES: Record<VideoProvider, string[]> = {
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"],
  facebook: ["facebook.com", "www.facebook.com", "web.facebook.com", "fb.watch"],
  vimeo: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
  dailymotion: ["dailymotion.com", "www.dailymotion.com", "dai.ly"],
};

function hoteVers(provider: VideoProvider, hostname: string): boolean {
  return HOTES[provider].includes(hostname.toLowerCase());
}

export type VideoParsed = { provider: VideoProvider; providerRef: string };

/**
 * Analyse une URL saisie au Studio. Renvoie null si la plateforme n'est pas
 * reconnue ou si l'identifiant n'a pas un format sûr — l'appelant refuse alors
 * l'enregistrement plutôt que de stocker quelque chose d'inexploitable.
 */
export function parseVideoUrl(raw: string): VideoParsed | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const segments = u.pathname.split("/").filter(Boolean);

  // YouTube — watch?v=ID, youtu.be/ID, /live/ID, /embed/ID, /shorts/ID
  if (hoteVers("youtube", host)) {
    let id: string | null = null;
    if (host === "youtu.be") id = segments[0] ?? null;
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else if (["live", "embed", "shorts", "v"].includes(segments[0] ?? "")) id = segments[1] ?? null;
    return id && ID_SUR.test(id) ? { provider: "youtube", providerRef: id } : null;
  }

  // Vimeo — vimeo.com/123456789 (identifiant numérique)
  if (hoteVers("vimeo", host)) {
    const id = segments[0] === "video" ? segments[1] : segments[0];
    return id && /^\d{6,15}$/.test(id) ? { provider: "vimeo", providerRef: id } : null;
  }

  // Dailymotion — /video/ID ou dai.ly/ID
  if (hoteVers("dailymotion", host)) {
    const id = host === "dai.ly" ? segments[0] : segments[0] === "video" ? segments[1] : null;
    return id && ID_SUR.test(id) ? { provider: "dailymotion", providerRef: id } : null;
  }

  // Facebook — le lecteur exige l'URL complète d'origine, pas un identifiant.
  // On reconstruit une URL propre : domaine vérifié + chemin, en ne gardant
  // que le paramètre `v` (facebook.com/watch/?v=123 : l'identifiant est là,
  // le supprimer casserait la lecture) et en jetant les traceurs.
  if (hoteVers("facebook", host)) {
    if (segments.length === 0) return null;
    const v = u.searchParams.get("v");
    let propre = `https://${host}${u.pathname}`;
    if (v) {
      if (!/^\d{1,32}$/.test(v)) return null;
      propre += `?v=${v}`;
    } else if (segments[0] === "watch") {
      return null; // /watch sans identifiant : rien à lire
    }
    return { provider: "facebook", providerRef: propre };
  }

  return null;
}

/**
 * URL d'intégration, construite par nous à partir de l'identifiant stocké.
 * YouTube passe par youtube-nocookie : pas de cookie publicitaire avant
 * lecture, cohérent avec le bandeau de consentement du site.
 */
export function embedUrl(provider: string, ref: string): string | null {
  switch (provider) {
    case "youtube":
      return ID_SUR.test(ref) ? `https://www.youtube-nocookie.com/embed/${ref}?rel=0` : null;
    case "vimeo":
      return /^\d{6,15}$/.test(ref) ? `https://player.vimeo.com/video/${ref}` : null;
    case "dailymotion":
      return ID_SUR.test(ref) ? `https://www.dailymotion.com/embed/video/${ref}` : null;
    case "facebook": {
      // Re-vérifié à l'affichage : une entrée en base ne dispense pas de valider.
      try {
        const u = new URL(ref);
        if (u.protocol !== "https:" || !hoteVers("facebook", u.hostname)) return null;
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(ref)}&show_text=false`;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}

/** Vignette : seul YouTube en expose une d'adresse prévisible. */
export function thumbnailUrl(provider: string, ref: string): string | null {
  if (provider === "youtube" && ID_SUR.test(ref)) return `https://i.ytimg.com/vi/${ref}/hqdefault.jpg`;
  return null;
}
