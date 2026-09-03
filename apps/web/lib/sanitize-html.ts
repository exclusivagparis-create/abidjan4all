import sanitizeHtml from "sanitize-html";

/**
 * Nettoyage du HTML produit par l'éditeur enrichi avant stockage. Liste
 * blanche stricte : mise en forme éditoriale uniquement, jamais de script,
 * d'iframe ni de gestionnaire d'événement. Les auteurs sont de confiance
 * (rôles Studio) mais on ne stocke que du HTML sûr, par principe.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "span", "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "a", "ul", "ol", "li", "blockquote",
    "h3", "h4",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["style"],
    p: ["style"],
    td: ["style", "colspan", "rowspan"],
    th: ["style", "colspan", "rowspan"],
    "*": ["style"],
  },
  /**
   * Styles conservés.
   *
   * La liste n'admettait que les couleurs, l'alignement et une taille en
   * unités. Or l'éditeur produit sa mise en forme par `execCommand` en mode
   * `styleWithCSS`, qui écrit `font-weight: bold`, `font-style: italic`,
   * `text-decoration-line: underline` et `font-size: x-large` — aucun de ces
   * styles n'était accepté. Le gras, l'italique, le souligné, le barré et la
   * taille étaient donc SILENCIEUSEMENT effacés à l'enregistrement : le
   * rédacteur les voyait à l'écran et les retrouvait absents après sauvegarde.
   *
   * Les valeurs restent strictement énumérées : on autorise ce que l'éditeur
   * produit, non une propriété ouverte où n'importe quoi passerait.
   */
  allowedStyles: {
    "*": {
      color: [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-z]+$/],
      "background-color": [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-z]+$/],
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/],
      "font-style": [/^(normal|italic|oblique)$/],
      "text-decoration": [/^(none|underline|line-through|underline line-through)$/],
      "text-decoration-line": [/^(none|underline|line-through|underline line-through)$/],
      // Unités, et mots-clés : la commande `fontSize` écrit « x-large ».
      "font-size": [
        /^\d{1,2}(\.\d+)?(px|em|rem|%)$/,
        /^(xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/,
      ],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    // liens toujours en nouvel onglet, sans fuite de référent
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
