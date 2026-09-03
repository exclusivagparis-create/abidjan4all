"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Éditeur de texte enrichi (contentEditable). Stocke du HTML nettoyé côté
 * serveur au save. Utilise document.execCommand (déprécié mais universellement
 * supporté et sans dépendance lourde) pour la mise en forme inline.
 *
 * Deux tenues, selon `compact`.
 *
 * En tenue pleine, c'est un bloc à part entière : encadré, barre d'outils
 * toujours visible, tableaux et alignements compris.
 *
 * En tenue compacte, il sert de paragraphe d'article : sans cadre, à même la
 * page, et sa barre n'apparaît qu'au moment où l'on écrit dedans. C'est ce qui
 * rend la mise en forme utilisable ici — un article de trente paragraphes
 * afficherait sinon trente barres d'outils empilées, et l'on ne verrait plus le
 * texte. Le jeu de boutons y est réduit à ce qu'on emploie dans un paragraphe :
 * ni tableau, ni alignement, ni retrait.
 *
 * `onChange` renvoie le HTML **et** le texte nu. Ce second n'est pas une
 * commodité : l'index de recherche du site lit le champ `text` des blocs
 * (colonne générée, migration fulltext_search). Un bloc qui ne porterait que du
 * HTML sortirait purement et simplement des résultats de recherche.
 */
const COLORS = ["#1a1a1a", "#F47920", "#006633", "#a01520", "#1a3a5c", "#7C3A8C", "#8B6914", "#ffffff"];

/**
 * Fonds de surlignage.
 *
 * Une liste à part, et non la palette éditoriale ci-dessus : celle-ci est
 * faite pour de l'encre, ses teintes sont franches. Employées en fond
 * derrière un texte noir, elles le rendent illisible — un vert bouteille ou
 * un bordeaux ne se lisent pas. Ici, des teintes claires, qui restent
 * lisibles dans les deux thèmes.
 *
 * `transparent` retire le surlignage. Il manquait : la palette proposait bien
 * un blanc, mais un blanc n'est pas une absence — il reste visible en thème
 * sombre, où il découpe une bande claire derrière le texte.
 */
const FONDS: Array<[string, string]> = [
  ["transparent", "Aucun fond"],
  ["#FDE68A", "Jaune"],
  ["#FED7AA", "Orange"],
  ["#BBF7D0", "Vert"],
  ["#BFDBFE", "Bleu"],
  ["#FBCFE8", "Rose"],
  ["#DDD6FE", "Violet"],
  ["#E5E7EB", "Gris"],
];
const FONT_SIZES: Array<[string, string]> = [
  ["2", "Petit"],
  ["3", "Normal"],
  ["5", "Grand"],
  ["6", "Titre"],
];

export function RichTextEditor({
  value,
  onChange,
  compact = false,
  reserveDroite = false,
  placeholder,
  className,
}: {
  value: string;
  onChange: (html: string, texte: string) => void;
  /** Tenue paragraphe : sans cadre, barre à la demande, boutons réduits. */
  compact?: boolean;
  /**
   * Laisse le coin haut-droit libre. Dans l'éditeur d'article, les commandes
   * du bloc — monter, descendre, fermer — sont ancrées à cet endroit précis :
   * sans cette réserve, la barre de mise en forme se déploie dessous et les
   * masque. Ailleurs (éditeur de page), il n'y a rien à cet endroit et cette
   * réserve ne serait qu'un blanc inutile.
   */
  reserveDroite?: boolean;
  placeholder?: string;
  /** Typographie de la zone d'écriture, en tenue compacte. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const boite = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState<false | "fore" | "back">(false);
  const [actif, setActif] = useState(false);

  /**
   * Dernière sélection connue dans la zone d'écriture.
   *
   * Les boutons de la barre retiennent le focus (leur `mousedown` est annulé),
   * mais un `select` ne le peut pas : l'annuler l'empêcherait de s'ouvrir. Le
   * focus passe donc au sélecteur, et avec lui la sélection du texte. On la
   * garde de côté pour la rendre à la zone avant d'exécuter la commande, sans
   * quoi la taille s'appliquerait au vide.
   */
  const selection = useRef<Range | null>(null);

  const memoriser = () => {
    const s = window.getSelection();
    if (s && s.rangeCount > 0 && ref.current?.contains(s.anchorNode)) {
      selection.current = s.getRangeAt(0).cloneRange();
    }
  };

  // n'écrit dans le DOM que si la valeur externe diffère (évite de casser le curseur)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const sync = () => onChange(ref.current?.innerHTML ?? "", ref.current?.textContent ?? "");

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    const s = window.getSelection();
    if (selection.current && (!s || s.rangeCount === 0 || !ref.current?.contains(s.anchorNode))) {
      s?.removeAllRanges();
      s?.addRange(selection.current);
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, arg);
    memoriser();
    sync();
  };

  const addLink = () => {
    const url = window.prompt("Adresse du lien (https://…) :", "https://");
    if (url) exec("createLink", url);
  };

  const insertTable = () => {
    const cols = Math.min(6, Math.max(1, Number(window.prompt("Nombre de colonnes ?", "3")) || 3));
    const rows = Math.min(20, Math.max(1, Number(window.prompt("Nombre de lignes ?", "3")) || 3));
    const th = `<th style="border:1px solid #ccc;padding:6px 10px;text-align:left">Titre</th>`.repeat(cols);
    const td = `<td style="border:1px solid #ccc;padding:6px 10px">—</td>`.repeat(cols);
    const body = `<tr>${td}</tr>`.repeat(rows - 1);
    const table = `<table style="border-collapse:collapse;width:100%;margin:12px 0"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table><p><br/></p>`;
    exec("insertHTML", table);
  };

  const outilsTexte = (
    <>
      <select
        onChange={(e) => { exec('fontSize', e.target.value); e.target.selectedIndex = 0; }}
        onMouseDown={(e) => e.stopPropagation()}
        // Le sélecteur prend le focus ; c'est donc à lui de refermer la barre
        // quand on la quitte pour de bon, la zone d'écriture l'ayant laissée
        // ouverte en le voyant recevoir le focus.
        onBlur={(e) => {
          if (boite.current?.contains(e.relatedTarget as Node | null)) return;
          setActif(false);
          setShowColors(false);
        }}
        title='Taille du texte'
        className='mx-0.5 h-7 rounded border border-line bg-surface px-1 text-[12px]'
        defaultValue=''
      >
        <option value='' disabled>Taille</option>
        {FONT_SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Sep />
      <Tb onClick={() => exec('bold')} title='Gras'><b>G</b></Tb>
      <Tb onClick={() => exec('italic')} title='Italique'><i>I</i></Tb>
      <Tb onClick={() => exec('underline')} title='Souligné'><u>S</u></Tb>
      <Tb onClick={() => exec('strikeThrough')} title='Barré'><s>B</s></Tb>
      <Sep />
      {/* Les deux commandes de couleur se ressemblaient trait pour trait —
          un « A » chacune — et rien ne disait qu'elles ouvrent un choix. Le
          chevron l'annonce, et le fond porte désormais sa pastille. */}
      <Tb onClick={() => setShowColors(showColors === 'fore' ? false : 'fore')} title='Couleur du texte'>
        <span style={{ color: '#F47920' }}>A</span>
        <span className='ml-0.5 text-[9px] text-ink-3'>▾</span>
      </Tb>
      <Tb onClick={() => setShowColors(showColors === 'back' ? false : 'back')} title='Couleur de fond'>
        <span className='rounded-sm px-0.5' style={{ background: '#FDE68A', color: '#1a1a1a' }}>A</span>
        <span className='ml-0.5 text-[9px] text-ink-3'>▾</span>
      </Tb>
      <Sep />
      <Tb onClick={() => exec('insertUnorderedList')} title='Puces'>•≡</Tb>
      <Tb onClick={() => exec('insertOrderedList')} title='Numérotation'>1.</Tb>
      <Sep />
      <Tb onClick={() => exec('justifyLeft')} title='Aligner à gauche'>⇤≡</Tb>
      <Tb onClick={() => exec('justifyCenter')} title='Centrer'>≡</Tb>
      <Tb onClick={() => exec('justifyRight')} title='Aligner à droite'>≡⇥</Tb>
      <Tb onClick={() => exec('justifyFull')} title='Justifier'>☰</Tb>
      <Sep />
      <Tb onClick={addLink} title='Insérer un lien'>🔗</Tb>
      <Tb onClick={() => exec('unlink')} title='Supprimer le lien'>⛓✕</Tb>
      <Sep />
      <Tb onClick={() => exec('removeFormat')} title='Supprimer la mise en forme'>⌫T</Tb>
    </>
  );

  // Ce qui reste propre au bloc : l'historique, les retraits et le tableau. La
  // taille et l'alignement sont passés dans le jeu commun — un paragraphe en a
  // l'usage autant qu'un bloc, et les dupliquer ici les aurait affichés deux
  // fois dans la barre pleine.
  const outilsBloc = (
    <>
      <Tb onClick={() => exec('undo')} title='Annuler'>↶</Tb>
      <Tb onClick={() => exec('redo')} title='Rétablir'>↷</Tb>
      <Sep />
      {outilsTexte}
      <Sep />
      <Tb onClick={() => exec('outdent')} title='Diminuer le retrait'>⇤</Tb>
      <Tb onClick={() => exec('indent')} title='Augmenter le retrait'>⇥</Tb>
      <Sep />
      <Tb onClick={insertTable} title='Insérer un tableau'>▦</Tb>
    </>
  );

  const palette = showColors ? (
    <div className='flex flex-wrap gap-1.5 border-b border-line-2 bg-surface-2 px-2.5 py-2'>
      {showColors === 'fore'
        ? COLORS.map((c) => (
            <button
              key={c}
              type='button'
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { exec('foreColor', c); setShowColors(false); }}
              className='h-5 w-5 rounded border border-line'
              style={{ background: c }}
              title={c}
            />
          ))
        : FONDS.map(([c, nom]) => (
            <button
              key={c}
              type='button'
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { exec('hiliteColor', c); setShowColors(false); }}
              className='h-5 w-5 rounded border border-line'
              style={
                c === 'transparent'
                  ? // barré en diagonale : c'est le retrait du surlignage, pas une couleur
                    { background: 'linear-gradient(to top right, transparent 44%, var(--ink-3) 44%, var(--ink-3) 56%, transparent 56%)' }
                  : { background: c }
              }
              title={nom}
            />
          ))}
    </div>
  ) : null;

  // Tenue paragraphe : la barre ne s'affiche qu'à la saisie. Les boutons
  // retiennent déjà le focus (onMouseDown annulé), un clic dessus ne la fait
  // donc pas disparaître sous le doigt.
  if (compact) {
    return (
      <div className='relative' ref={boite}>
        {actif ? (
          <div className={`mb-1.5 rounded-[8px] border border-line bg-surface-2 py-1 pl-2 ${reserveDroite ? 'pr-[76px]' : 'pr-2'}`}>
            <div className='flex flex-wrap items-center gap-0.5'>{outilsTexte}</div>
            {palette}
          </div>
        ) : null}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={sync}
          onKeyUp={memoriser}
          onMouseUp={memoriser}
          onFocus={() => setActif(true)}
          onBlur={(e) => {
            memoriser();
            // Le focus qui part vers la barre elle-même — le sélecteur de
            // taille est le seul élément qui le prenne — ne doit pas la
            // refermer : elle disparaîtrait sous le doigt avant que le clic
            // n'aboutisse, et le sélecteur resterait inatteignable.
            if (boite.current?.contains(e.relatedTarget as Node | null)) return;
            setActif(false);
            setShowColors(false);
            sync();
          }}
          className={className}
        />
      </div>
    );
  }

  return (
    <div className='rounded-md border border-line bg-surface' ref={boite}>
      <div
        className={`flex flex-wrap items-center gap-0.5 border-b border-line-2 bg-surface-2 py-1.5 pl-2 ${reserveDroite ? 'pr-[76px]' : 'pr-2'}`}
      >
        {outilsBloc}
      </div>
      {palette}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onKeyUp={memoriser}
        onMouseUp={memoriser}
        onBlur={() => { memoriser(); sync(); }}
        className='prose-editor min-h-[120px] px-4 py-3 font-serif text-[16px] leading-relaxed text-ink outline-none [&_a]:text-blue [&_a]:underline [&_table]:my-2 [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-2.5 [&_th]:py-1.5'
      />
    </div>
  );
}

function Tb({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // garde la sélection
      onClick={onClick}
      title={title}
      className="flex h-7 min-w-[28px] items-center justify-center rounded px-1.5 text-[13px] text-ink-2 hover:bg-surface hover:text-ink"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-line" />;
}
