"use client";

import { useState } from "react";
import { RichTextEditor } from "./rich-text-editor";

/** Éditeur riche pour le corps d'une page statique, avec champ caché pour le form. */
export function PageBodyEditor({ initial = "" }: { initial?: string }) {
  const [html, setHtml] = useState(initial);
  return (
    <>
      <input type="hidden" name="body" value={html} />
      <RichTextEditor value={html} onChange={setHtml} />
    </>
  );
}
