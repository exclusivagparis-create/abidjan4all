"use client";

import { useActionState } from "react";
import { saveCvAction, type CvResult } from "@/lib/actions/cv-actions";

export type CvInitial = {
  headline: string;
  summary: string;
  phone: string;
  contactEmail: string;
  location: string;
  skills: string;
  experiences: string; // « Poste | Entreprise | Période | Détail » par ligne
  education: string; // « École | Diplôme | Année » par ligne
  isPublic: boolean;
};

const field = "w-full rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-ink-3";
const label = "grid gap-1.5 text-xs font-semibold text-ink-2";

export function CvForm({ initial }: { initial: CvInitial }) {
  const [result, action, pending] = useActionState<CvResult | undefined, FormData>(saveCvAction, undefined);

  return (
    <form action={action} className="grid gap-4 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-sm)]">
      <label className={label}>
        Métier / intitulé recherché *
        <input name="headline" required maxLength={140} defaultValue={initial.headline} placeholder="Développeur web full-stack" className={field} />
      </label>

      <label className={label}>
        Présentation
        <textarea name="summary" rows={4} maxLength={3000} defaultValue={initial.summary} placeholder="Quelques lignes sur votre profil et vos objectifs." className={`${field} resize-y`} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={label}>Localisation<input name="location" maxLength={120} defaultValue={initial.location} placeholder="Abidjan" className={field} /></label>
        <label className={label}>Téléphone<input name="phone" maxLength={40} defaultValue={initial.phone} placeholder="+225 …" className={field} /></label>
        <label className={label}>E-mail de contact<input name="contactEmail" type="email" maxLength={140} defaultValue={initial.contactEmail} className={field} /></label>
      </div>

      <label className={label}>
        Compétences (séparées par des virgules)
        <input name="skills" defaultValue={initial.skills} placeholder="React, Node.js, gestion de projet" className={field} />
      </label>

      <label className={label}>
        Expériences — une par ligne : <span className="font-normal text-ink-3">Poste | Entreprise | Période | Détail</span>
        <textarea name="experiences" rows={4} defaultValue={initial.experiences} placeholder={"Développeur | Orange CI | 2022–2024 | Refonte de l'app mobile"} className={`${field} resize-y font-mono text-[12.5px]`} />
      </label>

      <label className={label}>
        Formation — une par ligne : <span className="font-normal text-ink-3">École | Diplôme | Année</span>
        <textarea name="education" rows={3} defaultValue={initial.education} placeholder={"INP-HB | Master informatique | 2021"} className={`${field} resize-y font-mono text-[12.5px]`} />
      </label>

      <label className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-2">
        <input type="checkbox" name="isPublic" defaultChecked={initial.isPublic} className="h-4 w-4" />
        Rendre mon CV visible dans la banque de CV (recruteurs)
      </label>

      {result?.ok ? <p className="text-[13px] font-semibold text-green">✓ CV enregistré.</p> : null}
      {result && !result.ok ? <p className="text-[12.5px] font-semibold text-red">{result.error}</p> : null}

      <button type="submit" disabled={pending} className="justify-self-start rounded-pill bg-red px-6 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
        {pending ? "Enregistrement…" : "Enregistrer mon CV"}
      </button>
    </form>
  );
}
