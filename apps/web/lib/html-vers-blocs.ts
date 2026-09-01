/**
 * Conversion d'un document HTML en blocs d'article.
 *
 * Sert à reprendre un texte déjà mis en forme ailleurs — page web, export d'un
 * traitement de texte, ancien site — sans avoir à le ressaisir.
 *
 * Le parti pris : produire de VRAIS blocs, et non un unique pavé de HTML. Un
 * intertitre importé doit devenir un intertitre de l'éditeur, une image un bloc
 * image, une citation une citation. Sans quoi on obtient un article qu'on ne
 * peut plus ni réordonner, ni corriger bloc par bloc, ni illustrer — et dont
 * les images échappent à la médiathèque.
 *
 * Tourne dans le navigateur : `DOMParser` y est natif et analyse le HTML comme
 * le ferait la page elle-même, y compris les balises mal fermées dont les
 * copier-coller sont coutumiers. Le document est inerte — aucun script ne
 * s'exécute, aucune image n'est chargée. Le nettoyage qui fait foi reste celui
 * du serveur, appliqué à l'enregistrement.
 */

export interface BlocImporte {
  type: "paragraph" | "richtext" | "h2" | "quote" | "image";
  text?: string;
  html?: string;
  url?: string;
  alt?: string;
}

/** Balises dont le contenu n'a rien à faire dans un article. */
const IGNOREES = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "FORM", "BUTTON", "NAV", "FOOTER", "ASIDE"]);

/**
 * Mise en forme qui mérite d'être conservée. Un paragraphe qui n'en contient
 * aucune devient un bloc `paragraph`, plus simple à relire et à corriger ;
 * ceux qui en contiennent deviennent `richtext`, seul type capable de porter du
 * HTML. On ne met pas tout en `richtext` par confort : un bloc de texte nu se
 * modifie dans un champ ordinaire, un bloc enrichi demande l'éditeur riche.
 */
const MISE_EN_FORME = "a,strong,b,em,i,u,s,sub,sup,ul,ol,table,br,mark,code";

/**
 * Adresses d'image acceptées : http(s) et chemins internes.
 *
 * Écarte `javascript:`, `data:` et consorts. Une `data:` d'image serait inerte
 * dans une balise `img`, mais elle embarquerait le visuel entier dans le corps
 * de l'article — plusieurs mégaoctets recopiés dans la base à chaque
 * enregistrement, invisibles à la médiathèque.
 */
function urlImageAcceptable(src: string): boolean {
  const v = src.trim();
  if (v.startsWith("/")) return !v.startsWith("//");
  return /^https?:\/\//i.test(v);
}

/** Texte lisible d'un élément, espaces normalisés. */
function texte(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Convertit du HTML en blocs. Renvoie une liste vide si rien d'exploitable
 * n'est trouvé — au appelant d'en informer le rédacteur.
 */
export function htmlVersBlocs(html: string): BlocImporte[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const racine = doc.body;
  if (!racine) return [];

  const blocs: BlocImporte[] = [];

  const parcourir = (element: Element) => {
    for (const noeud of Array.from(element.children)) {
      const balise = noeud.tagName;
      if (IGNOREES.has(balise)) continue;

      // Images : prises où qu'elles se trouvent, y compris enveloppées dans un
      // lien ou une figure — c'est la forme la plus répandue.
      if (balise === "IMG") {
        const src = noeud.getAttribute("src") ?? "";
        if (urlImageAcceptable(src)) {
          blocs.push({ type: "image", url: src.trim(), alt: noeud.getAttribute("alt") || undefined });
        }
        continue;
      }

      if (/^H[1-6]$/.test(balise)) {
        const t = texte(noeud);
        // L'éditeur n'a qu'un niveau d'intertitre : les six s'y ramènent.
        if (t) blocs.push({ type: "h2", text: t });
        continue;
      }

      if (balise === "BLOCKQUOTE") {
        const t = texte(noeud);
        if (t) blocs.push({ type: "quote", text: t });
        continue;
      }

      if (balise === "P" || balise === "UL" || balise === "OL" || balise === "TABLE" || balise === "PRE") {
        const image = noeud.querySelector("img");
        // Un paragraphe qui n'est qu'une image — cas courant des exports : on
        // prend l'image, pas le paragraphe vide qui l'entoure.
        if (image && !texte(noeud)) {
          const src = image.getAttribute("src") ?? "";
          if (urlImageAcceptable(src)) {
            blocs.push({ type: "image", url: src.trim(), alt: image.getAttribute("alt") || undefined });
          }
          continue;
        }
        const t = texte(noeud);
        if (!t) continue;
        const enrichi = balise !== "P" || noeud.querySelector(MISE_EN_FORME) !== null;
        blocs.push(enrichi ? { type: "richtext", html: noeud.outerHTML } : { type: "paragraph", text: t });
        continue;
      }

      // Conteneur (div, section, article, figure…) : on descend. Le contenu
      // utile d'une page est presque toujours emboîté à plusieurs niveaux.
      if (noeud.children.length > 0) {
        parcourir(noeud);
        continue;
      }

      // Feuille sans balise reconnue mais porteuse de texte : on la garde
      // plutôt que de la perdre.
      const t = texte(noeud);
      if (t) blocs.push({ type: "paragraph", text: t });
    }
  };

  parcourir(racine);

  // Texte laissé à la racine, sans balise autour — fréquent quand on colle un
  // fragment plutôt qu'un document complet.
  if (blocs.length === 0) {
    const brut = (racine.textContent ?? "").replace(/\s+/g, " ").trim();
    if (brut) return [{ type: "paragraph", text: brut }];
  }

  return blocs;
}

/** Ce que l'import a produit, pour l'annoncer avant d'insérer. */
export function resumeImport(blocs: BlocImporte[]): string {
  if (blocs.length === 0) return "Rien d'exploitable dans ce HTML.";
  const compte = (t: BlocImporte["type"]) => blocs.filter((b) => b.type === t).length;
  const parties = [
    [compte("paragraph") + compte("richtext"), "paragraphe"],
    [compte("h2"), "intertitre"],
    [compte("image"), "image"],
    [compte("quote"), "citation"],
  ] as const;
  return parties
    .filter(([n]) => n > 0)
    .map(([n, mot]) => `${n} ${mot}${n > 1 ? "s" : ""}`)
    .join(" · ");
}
