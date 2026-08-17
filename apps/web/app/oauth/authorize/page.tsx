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

function Refus({ titre, detail }: { titre: string; detail: string }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-[560px] place-items-center px-5">
      <div className="w-full rounded-[14px] border border-line bg-surface p-7 shadow-[var(--shadow-sm)]">
        <h1 className="mb-2 font-serif text-[22px] font-semibold text-red">{titre}</h1>
        <p className="text-[14px] leading-[1.6] text-ink-2">{detail}</p>
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

  if (!STUDIO_ROLES.includes(session.user.role as (typeof STUDIO_ROLES)[number])) {
    return (
      <Refus
        titre="Compte sans accès au Studio"
        detail="Seuls les membres de la rédaction peuvent autoriser une application à se connecter au site."
      />
    );
  }

  // Ce que le compte connecté peut réellement accorder : une portée qu'il n'a
  // pas lui-même dans le Studio n'est même pas proposée.
  const moi: ApiIdentity = {
    userId: session.user.id,
    name: session.user.name ?? "",
    role: session.user.role as string,
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
