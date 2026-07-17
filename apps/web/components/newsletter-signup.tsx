"use client";

import { useActionState } from "react";
import { subscribeNewsletterAction, type SignupResult } from "@/lib/actions/newsletter-signup-actions";

/** Bloc d'inscription à la newsletter — page d'accueil (CRM, DF-03). */
export function NewsletterSignup({ nom, description }: { nom: string; description: string }) {
  const [state, action, pending] = useActionState<SignupResult | undefined, FormData>(
    subscribeNewsletterAction,
    undefined
  );

  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[16px] bg-navy px-6 py-8 sm:px-10 sm:py-10">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#F5C24B]">
              Newsletter
            </div>
            <h2 className="font-serif text-[24px] font-semibold leading-[1.15] text-white sm:text-[28px]">{nom}</h2>
            <p className="mt-2 max-w-[52ch] font-serif text-[15px] leading-[1.5] text-[#AEB8CC]">{description}</p>
          </div>

          {state?.ok ? (
            <div className="rounded-[12px] border border-white/15 bg-white/5 px-5 py-4">
              <div className="text-[15px] font-bold text-white">C&apos;est noté.</div>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#AEB8CC]">
                Si cette adresse peut être inscrite, <b className="text-white">{state.email}</b> recevra nos prochaines
                éditions. Un lien de désinscription figure dans chaque envoi.
              </p>
            </div>
          ) : (
            <form action={action}>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <label className="sr-only" htmlFor="nl-email">
                  Votre adresse e-mail
                </label>
                <input
                  id="nl-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="votre@email.com"
                  className="min-w-0 flex-1 rounded-pill border border-white/20 bg-white/10 px-4 py-3 text-[14px] text-white outline-none placeholder:text-[#8894AC] focus:border-white/50"
                />
                {/* Pot de miel : invisible pour un humain, rempli par les robots. */}
                <input
                  name="site"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-none rounded-pill bg-red px-6 py-3 text-[14px] font-bold text-white disabled:opacity-60"
                >
                  {pending ? "…" : "S'inscrire"}
                </button>
              </div>
              {state?.ok === false ? (
                <p className="mt-2 text-[12.5px] font-semibold text-[#F5C24B]">{state.error}</p>
              ) : (
                <p className="mt-2 text-[11.5px] leading-[1.5] text-[#8894AC]">
                  Gratuit. Désinscription en un clic, à tout moment.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
