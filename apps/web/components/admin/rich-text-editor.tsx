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
  placeholder,
  className,
}: {
  value: string;
  onChange: (html: string, texte: string) => void;
  /** Tenue paragraphe : sans cadre, barre à la demande, boutons réduits. */
  compact?: boolean;
  placeholder?: string;
  /** Typographie de la zone d'écriture, en tenue compacte. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState<false | "fore" | "back">(false);
  const [actif, setActif] = useState(false);

  // n'écrit dans le DOM que si la valeur externe diffère (évite de casser le curseur)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const sync = () => onChange(ref.current?.innerHTML ?? "", ref.current?.textContent ?? "");

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, arg);
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
      <Tb onClick={() => exec('bold')} title='Gras'><b>G</b></Tb>
      <Tb onClick={() => exec('italic')} title='Italique'><i>I</i></Tb>
      <Tb onClick={() => exec('underline')} title='Souligné'><u>S</u></Tb>
      <Tb onClick={() => exec('strikeThrough')} title='Barré'><s>B</s></Tb>
      <Sep />
      <Tb onClick={() => setShowColors(showColors === 'fore' ? false : 'fore')} title='Couleur du texte'>
        <span style={{ color: '#F47920' }}>A</span>
      </Tb>
      <Tb onClick={() => setShowColors(showColors === 'back' ? false : 'back')} title='Couleur de fond'>
        <span className='rounded-sm px-0.5' style={{ background: '#F5C24B' }}>A</span>
      </Tb>
      <Sep />
      <Tb onClick={() => exec('insertUnorderedList')} title='Puces'>•≡</Tb>
      <Tb onClick={() => exec('insertOrderedList')} title='Numérotation'>1.</Tb>
      <Sep />
      <Tb onClick={addLink} title='Insérer un lien'>🔗</Tb>
      <Tb onClick={() => exec('unlink')} title='Supprimer le lien'>⛓✕</Tb>
      <Sep />
      <Tb onClick={() => exec('removeFormat')} title='Supprimer la mise en forme'>⌫T</Tb>
    </>
  );

  // Les outils que seul un bloc à part entière justifie : on ne compose pas un
  // tableau ni un alignement au fil d'un paragraphe.
  const outilsBloc = (
    <>
      <Tb onClick={() => exec('undo')} title='Annuler'>↶</Tb>
      <Tb onClick={() => exec('redo')} title='Rétablir'>↷</Tb>
      <Sep />
      <select
        onChange={(e) => { exec('fontSize', e.target.value); e.target.selectedIndex = 0; }}
        title='Taille du texte'
        className='mx-0.5 h-7 rounded border border-line bg-surface px-1 text-[12px]'
        defaultValue=''
      >
        <option value='' disabled>Taille</option>
        {FONT_SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Sep />
      {outilsTexte}
      <Sep />
      <Tb onClick={() => exec('outdent')} title='Diminuer le retrait'>⇤</Tb>
      <Tb onClick={() => exec('indent')} title='Augmenter le retrait'>⇥</Tb>
      <Sep />
      <Tb onClick={() => exec('justifyLeft')} title='Aligner à gauche'>⇤≡</Tb>
      <Tb onClick={() => exec('justifyCenter')} title='Centrer'>≡</Tb>
      <Tb onClick={() => exec('justifyRight')} title='Aligner à droite'>≡⇥</Tb>
      <Tb onClick={() => exec('justifyFull')} title='Justifier'>☰</Tb>
      <Sep />
      <Tb onClick={insertTable} title='Insérer un tableau'>▦</Tb>
    </>
  );

  const palette = showColors ? (
    <div className='flex flex-wrap gap-1.5 border-b border-line-2 bg-surface-2 px-2.5 py-2'>
      {COLORS.map((c) => (
        <button
          key={c}
          type='button'
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { exec(showColors === 'fore' ? 'foreColor' : 'hiliteColor', c); setShowColors(false); }}
          className='h-5 w-5 rounded border border-line'
          style={{ background: c }}
          title={c}
        />
      ))}
    </div>
  ) : null;

  // Tenue paragraphe : la barre ne s'affiche qu'à la saisie. Les boutons
  // retiennent déjà le focus (onMouseDown annulé), un clic dessus ne la fait
  // donc pas disparaître sous le doigt.
  if (compact) {
    return (
      <div className='relative'>
        {actif ? (
          <div className='mb-1.5 rounded-[8px] border border-line bg-surface-2 px-2 py-1'>
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
          onFocus={() => setActif(true)}
          onBlur={() => { setActif(false); setShowColors(false); sync(); }}
          className={className}
        />
      </div>
    );
  }

  return (
    <div className='rounded-md border border-line bg-surface'>
      <div className='flex flex-wrap items-center gap-0.5 border-b border-line-2 bg-surface-2 px-2 py-1.5'>{outilsBloc}</div>
      {palette}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
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
