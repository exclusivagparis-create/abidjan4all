/**
 * GET /oauth/authorize — écran d'autorisation.
 *
 * C'est le point où un humain décide. La page n'accorde rien par elle-même :
 * elle vérifie la demande, montre qui demande quoi, et attend un clic.
 *
 * Une erreur sur `client_id` ou `redirect_uri` s'affiche ici plutôt que de
 * partir en redirection : renvoyer vers une adresse non vérifiée serait
 * précisément la faille que la vérification cherche à fermer.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@a4a/db";
import { auth, STUDIO_ROLES } from "@/auth";
import { SCOPES, autorise, type ApiIdentity, type Scope } from "@/lib/api-auth";
import { portéesDemandées } from "@/lib/oauth";
import { changerDeCompteAction } from "@/lib/actions/oauth-actions";
import { FormulaireAutorisation } from "@/components/oauth-consent";

export const metadata: Metadata = { title: "Autoriser une application · Abidjan4All" };
export const dynamic = "force-dynamic";

interface Params {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

function Refus({
  titre,
  detail,
  enfants,
}: {
  titre: string;
  detail: string;
  enfants?: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-screen max-w-[560px] place-items-center px-5 py-10">
      <div className="w-full rounded-[14px] border border-line bg-surface p-7 shadow-[var(--shadow-sm)]">
        <h1 className="mb-2 font-serif text-[22px] font-semibold text-red">{titre}</h1>
        <p className="text-[14px] leading-[1.6] text-ink-2">{detail}</p>
        {enfants}
        <p className="mt-4 text-[12.5px] text-ink-3">
          Aucun accès n&apos;a été accordé. Vous pouvez fermer cette fenêtre.
        </p>
      </div>
    </main>
  );
}

export default async function AutorisationPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;

  // --- Vérifications qui ne doivent JAMAIS rediriger ------------------------
  if (!p.client_id) return <Refus titre="Demande incomplète" detail="Le paramètre client_id est absent." />;

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: p.client_id },
    select: { id: true, name: true, redirectUris: true, clientId: true },
  });
  if (!client) {
    return (
      <Refus
        titre="Application inconnue"
        detail="Cette application ne s'est pas enregistrée auprès du site, ou son enregistrement a été supprimé."
      />
    );
  }

  const redirectUri = p.redirect_uri ?? "";
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return (
      <Refus
        titre="Adresse de retour non reconnue"
        detail={`L'application demande un retour vers « ${redirectUri || "(aucune)"} », qui ne figure pas parmi les adresses qu'elle a enregistrées.`}
      />
    );
  }

  // --- Vérifications qui peuvent, elles, repartir vers le client ------------
  const erreurVersClient = (code: string, description: string) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", code);
    u.searchParams.set("error_description", description);
    if (p.state) u.searchParams.set("state", p.state);
    redirect(u.toString());
  };

  if (p.response_type !== "code") {
    erreurVersClient("unsupported_response_type", "Seul le type de réponse « code » est pris en charge.");
  }
  if (!p.code_challenge) {
    erreurVersClient("invalid_request", "PKCE est obligatoire : code_challenge manquant.");
  }
  if ((p.code_challenge_method ?? "plain") !== "S256") {
    erreurVersClient("invalid_request", "Seule la méthode PKCE « S256 » est acceptée.");
  }

  // --- L'utilisateur doit être connecté au Studio ---------------------------
  const session = await auth();
  if (!session?.user) {
    const suite = new URLSearchParams({
      client_id: p.client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: p.code_challenge!,
      code_challenge_method: "S256",
      ...(p.scope ? { scope: p.scope } : {}),
      ...(p.state ? { state: p.state } : {}),
    });
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${suite}`)}`);
  }

  // Le rôle est relu en base plutôt que pris dans le jeton de session : celui-ci
  // peut dater d'avant un changement de rôle. L'action d'autorisation fait la
  // même vérification — mais si l'écran se fiait au jeton, un compte rétrogradé
  // verrait l'écran de consentement puis serait éjecté au clic, sans un mot
  // d'explication. Autant dire la vérité tout de suite.
  const compte = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true },
  });

  if (!compte || !STUDIO_ROLES.includes(compte.role as (typeof STUDIO_ROLES)[number])) {
    // Cas fréquent : on est connecté au site avec son compte de lecture, alors
    // que le compte de rédaction est un autre. On le dit, et on propose de
    // changer sans repartir de zéro depuis l'application.
    return (
      <Refus
        titre="Ce compte ne peut pas autoriser l’application"
        detail="Seuls les membres de la rédaction — journaliste, rédaction en chef, administration, gestion de la régie — peuvent connecter une application au site."
        enfants={
          <>
            <p className="mt-4 rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
              Vous êtes connecté en tant que{" "}
              <b className="text-ink">{compte?.email ?? session.user.email ?? "compte sans adresse"}</b>
              {compte?.name ? ` (${compte.name})` : ""}. Si votre compte de rédaction est différent,
              changez-en&nbsp;: la demande en cours sera conservée.
            </p>
            <form action={changerDeCompteAction} className="mt-4">
              <input type="hidden" name="client_id" value={p.client_id} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="scope" value={p.scope ?? ""} />
              <input type="hidden" name="state" value={p.state ?? ""} />
              <input type="hidden" name="code_challenge" value={p.code_challenge ?? ""} />
              <input type="hidden" name="code_challenge_method" value="S256" />
              <button
                type="submit"
                className="rounded-pill bg-brand-fill px-5 py-2.5 text-[13px] font-bold text-brand-on"
              >
                Changer de compte
              </button>
            </form>
          </>
        }
      />
    );
  }

  // Ce que le compte connecté peut réellement accorder : une portée qu'il n'a
  // pas lui-même dans le Studio n'est même pas proposée.
  const moi: ApiIdentity = {
    userId: session.user.id,
    name: compte.name,
    role: compte.role,
    scopes: SCOPES.map((s) => s.id) as Scope[],
    via: "session",
  };

  const demandées = portéesDemandées(p.scope ?? null);
  const proposées = SCOPES.filter((s) => demandées.includes(s.id) && autorise(moi, s.id));

  if (proposées.length === 0) {
    return (
      <Refus
        titre="Aucune portée disponible"
        detail={`L'application demande « ${demandées.join(", ")} », or votre rôle (${moi.role}) ne permet d'en accorder aucune. Demandez à l'administration de se charger de la connexion.`}
      />
    );
  }

  return (
    <FormulaireAutorisation
      client={{ clientId: client.clientId, name: client.name }}
      redirectUri={redirectUri}
      state={p.state ?? ""}
      codeChallenge={p.code_challenge!}
      utilisateur={{ nom: moi.name, role: moi.role }}
      portées={proposées.map((s) => ({ ...s }))}
    />
  );
}
