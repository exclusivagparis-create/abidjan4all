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
  // seules ces propriétés de style sont conservées (couleurs, alignement, taille)
  allowedStyles: {
    "*": {
      color: [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-z]+$/],
      "background-color": [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-z]+$/],
      "text-align": [/^(left|right|center|justify)$/],
      "font-size": [/^\d{1,2}(\.\d+)?(px|em|rem|%)$/],
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
