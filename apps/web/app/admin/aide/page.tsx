import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "Aide & mode d'emploi · Studio" };
export const dynamic = "force-dynamic";

/**
 * Mode d'emploi du Studio — page statique rédigée, accessible à tous les
 * rôles du back-office (le Gestionnaire Régie y a aussi accès : exception
 * dans le middleware). Chaque module a son ancre pour être lié directement.
 */

const ROLES_BADGE: Record<string, { label: string; color: string }> = {
  tous: { label: "Toute la rédaction", color: "var(--green)" },
  publication: { label: "Rédaction en chef & admin", color: "var(--orange)" },
  admin: { label: "Administration seule", color: "var(--red)" },
  regie: { label: "Admin & Gestionnaire Régie", color: "var(--navy)" },
};

function Module({
  id,
  icon,
  title,
  acces,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  acces: keyof typeof ROLES_BADGE;
  children: React.ReactNode;
}) {
  const badge = ROLES_BADGE[acces]!;
  return (
    <section id={id} className="scroll-mt-24 rounded-[14px] border border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-[15px] font-bold">
          <span className="mr-2">{icon}</span>
          {title}
        </h3>
        <span
          className="rounded-pill border px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: badge.color, borderColor: "var(--line)" }}
        >
          {badge.label}
        </span>
      </div>
      <div className="grid gap-2.5 text-[13.5px] leading-[1.65] text-ink-2 [&_b]:text-ink [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}

function Astuce({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-[rgba(232,100,26,0.08)] px-4 py-2.5 text-[12.5px] font-medium text-ink-2">
      💡 {children}
    </p>
  );
}

const SOMMAIRE: Array<[string, Array<[string, string]>]> = [
  [
    "Premiers pas",
    [
      ["roles", "Rôles & permissions"],
      ["workflow", "Circuit de publication d'un article"],
    ],
  ],
  [
    "Contenu",
    [
      ["dashboard", "Tableau de bord"],
      ["articles", "Articles"],
      ["media", "Médiathèque"],
      ["rubriques", "Rubriques"],
      ["live", "Nos directs (live-blog)"],
      ["videos", "Vidéos"],
      ["podcasts", "Podcasts"],
      ["formation", "A4A Formation"],
      ["factchecks", "A4A Vérifie (fact-checking)"],
      ["pages", "Pages"],
      ["menu", "Menu du site"],
      ["alertes", "Alertes push"],
    ],
  ],
  [
    "Communauté",
    [
      ["comments", "Commentaires"],
      ["contact", "Messages"],
      ["newsletters", "Newsletters"],
      ["groupes", "Groupes"],
      ["subscribers", "Abonnés A4A+"],
      ["users", "Utilisateurs"],
    ],
  ],
  [
    "Business",
    [
      ["brand-content", "Brand Content"],
      ["affiliation", "Affiliation"],
      ["evenements", "Événements"],
      ["intelligence", "A4A Intelligence"],
      ["annonces", "Petites annonces"],
      ["regie", "Régie publicitaire"],
      ["tarifs", "Grille des prix des packs"],
      ["stats", "Statistiques"],
      ["kpi", "KPI Business Model"],
      ["redirections", "Redirections"],
    ],
  ],
];

export default async function AidePage() {
  const session = await auth();
  const role = session?.user?.role ?? "";

  return (
    <div className="max-w-[860px]">
      <h1 className="mb-1 text-lg font-bold">Aide &amp; mode d&apos;emploi du Studio</h1>
      <p className="mb-6 max-w-[72ch] text-[13px] text-ink-3">
        Tout ce qu&apos;il faut savoir pour faire vivre Abidjan4All au quotidien : publier, modérer, animer la
        communauté et gérer la publicité. Les pastilles indiquent qui a accès à chaque module
        {role === "ad_manager" ? " — votre compte Gestionnaire Régie n'accède qu'à la régie publicitaire et à cette page" : ""}.
      </p>

      {/* SOMMAIRE */}
      <nav className="mb-6 rounded-[14px] border border-line bg-surface-2 px-6 py-5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Sommaire</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOMMAIRE.map(([groupe, items]) => (
            <div key={groupe}>
              <div className="mb-1.5 text-[12px] font-bold text-ink">{groupe}</div>
              <ul className="grid gap-1">
                {items.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-[12.5px] text-ink-2 hover:text-ink hover:underline">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="grid gap-4">
        {/* ------------------------------------------------------------ */}
        {/* PREMIERS PAS                                                  */}
        {/* ------------------------------------------------------------ */}
        <h2 className="mt-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3">Premiers pas</h2>

        <Module id="roles" icon="🗝" title="Rôles & permissions" acces="tous">
          <p>Chaque compte du Studio a un rôle qui détermine ce qu&apos;il peut faire :</p>
          <ul>
            <li>
              <b>Journaliste</b> — écrit et illustre des articles, les envoie en relecture, anime les live-blogs,
              modère les commentaires, prévisualise ses brouillons sur le site.
            </li>
            <li>
              <b>Rédaction en chef</b> — tout ce que fait un journaliste, plus : <b>publier et programmer</b>,
              gérer rubriques, vidéos, podcasts, formation, fact-checks, pages, menu, alertes push, newsletters,
              messages, petites annonces et redirections.
            </li>
            <li>
              <b>Administration</b> — tous les droits, y compris les comptes utilisateurs, les abonnés A4A+, les
              groupes, la régie publicitaire et les statistiques.
            </li>
            <li>
              <b>Gestionnaire Régie</b> — un rôle spécialisé : il n&apos;accède qu&apos;à la <b>régie publicitaire</b>{" "}
              (campagnes, validations, grille des prix, rapports). Toute autre page du Studio le ramène à la régie.
            </li>
          </ul>
          <Astuce>
            Après un changement de rôle, la personne concernée doit se <b>déconnecter puis se reconnecter</b> pour que
            ses nouveaux droits prennent effet.
          </Astuce>
        </Module>

        <Module id="workflow" icon="🧭" title="Circuit de publication d'un article" acces="tous">
          <p>Un article passe par quatre états :</p>
          <ol>
            <li>
              <b>Brouillon</b> — l&apos;auteur écrit librement. Personne d&apos;autre que la rédaction ne peut le voir.
            </li>
            <li>
              <b>En relecture</b> — l&apos;auteur soumet son texte ; la rédaction en chef relit (le compteur en badge
              orange dans le menu « Articles » indique combien attendent).
            </li>
            <li>
              <b>Programmé</b> — la publication partira automatiquement à la date et l&apos;heure choisies (vérification
              chaque minute).
            </li>
            <li>
              <b>Publié</b> — visible du public. Un article publié peut être <b>masqué</b> (retiré du public sans le
              supprimer) ou repassé en brouillon.
            </li>
          </ol>
          <p>
            <b>Règle d&apos;or :</b> impossible de publier ou programmer sans une <b>vraie image de couverture</b> — le
            bouton reste grisé tant qu&apos;elle manque. C&apos;est voulu : aucun article ne doit paraître avec un aplat
            gris.
          </p>
        </Module>

        {/* ------------------------------------------------------------ */}
        {/* CONTENU                                                       */}
        {/* ------------------------------------------------------------ */}
        <h2 className="mt-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3">Contenu</h2>

        <Module id="dashboard" icon="▦" title="Tableau de bord" acces="tous">
          <p>
            La page d&apos;accueil du Studio : chiffres clés (articles, vues, commentaires en attente…) et raccourcis
            vers les derniers contenus. C&apos;est votre point de départ chaque matin — les badges orange dans le menu
            latéral signalent partout ce qui attend une action (relectures, commentaires, annonces, réservations pub).
          </p>
        </Module>

        <Module id="articles" icon="≣" title="Articles" acces="tous">
          <p>
            La liste montre tous les articles avec recherche par titre et filtre par rubrique. « Nouvel article » ouvre
            l&apos;éditeur.
          </p>
          <p>
            <b>L&apos;éditeur.</b> Un article = un titre, un chapô (le paragraphe d&apos;accroche), une rubrique, une
            image de couverture, et un corps composé de <b>blocs</b> que vous empilez :
          </p>
          <ul>
            <li><b>Paragraphe</b> — texte simple.</li>
            <li>
              <b>Texte riche</b> — le plus complet : gras, italique, souligné, couleurs, listes à puces et numérotées,
              alignements, liens, tableaux… comme dans un traitement de texte.
            </li>
            <li><b>Intertitre</b> — titre de section (filet doré sur le site).</li>
            <li><b>Exergue</b> — citation mise en valeur.</li>
            <li><b>Encadré</b> — pavé coloré pour un point clé, une alerte, un contexte (6 couleurs).</li>
            <li><b>Image</b> — une illustration prise dans la médiathèque, avec légende.</li>
            <li><b>Chiffres clés</b> — une barre sombre « Libellé | Valeur » pour les données.</li>
            <li><b>Note de vérification</b> — l&apos;encart vert « info vérifiée par la rédaction ».</li>
          </ul>
          <p>
            <b>Mise en valeur du titre :</b> entourez un mot d&apos;astérisques (<code>*mot*</code>) pour l&apos;afficher
            en orange sur le site. Les astérisques n&apos;apparaissent jamais dans Google ni dans les partages.
          </p>
          <p>
            <b>À la une :</b> le champ « Position à la Une » (1 à 5) place l&apos;article en tête de l&apos;accueil — le
            n°1 est la grande tête d&apos;affiche. Chaque position est unique : donner le n°1 à un article le retire au
            précédent.
          </p>
          <p>
            <b>Prévisualiser :</b> le bouton « Prévisualiser dans un onglet » ouvre l&apos;article tel qu&apos;il
            paraîtra, même en brouillon — un bandeau orange « Aperçu » vous rappelle que le public, lui, ne le voit pas.
          </p>
          <p>
            <b>Premium (A4A+) :</b> cochez « réservé aux abonnés » pour que seuls les deux premiers blocs restent en
            lecture libre, le reste étant derrière l&apos;abonnement. <b>Communiqué partenaire :</b> cochez
            « sponsorisé » pour afficher le bandeau réglementaire au-dessus du texte.
          </p>
          <Astuce>
            La publication envoie automatiquement la notification push aux lecteurs abonnés aux alertes de la rubrique —
            rien à faire de votre côté.
          </Astuce>
        </Module>

        <Module id="media" icon="▤" title="Médiathèque" acces="tous">
          <p>
            Toutes les images du site : téléversez (JPG, PNG, WebP, GIF), puis renseignez pour chaque visuel le{" "}
            <b>texte alternatif</b> (description pour les lecteurs d&apos;écran et Google) et le <b>crédit</b> (© du
            photographe ou de l&apos;agence — obligation légale). Une image peut être remplacée par un nouveau fichier
            sans casser les articles qui l&apos;utilisent.
          </p>
          <Astuce>
            Prenez l&apos;habitude de remplir alt + crédit au moment du téléversement : c&apos;est ce qui distingue un
            média professionnel.
          </Astuce>
        </Module>

        <Module id="rubriques" icon="◫" title="Rubriques" acces="publication">
          <p>
            Les sections éditoriales du site (Politique, Économie, Sport…). Vous pouvez modifier le nom, la couleur, le
            type (gratuit, freemium, premium) et l&apos;ordre d&apos;affichage ; créer une rubrique (son adresse web est
            générée automatiquement) ; supprimer une rubrique seulement si elle est vide. L&apos;adresse (slug)
            d&apos;une rubrique existante est verrouillée pour ne pas casser les liens déjà partagés.
          </p>
        </Module>

        <Module id="live" icon="◉" title="Nos directs (live-blog)" acces="tous">
          <p>
            Pour couvrir un événement minute par minute (élection, match, cérémonie) : ouvrez un direct, postez des
            entrées au fil de l&apos;eau (texte, citation, statistique, média), épinglez les faits marquants, puis
            clôturez. Côté public, la page se met à jour toute seule, sans recharger — le lecteur voit vos posts
            arriver en quelques secondes.
          </p>
        </Module>

        <Module id="videos" icon="▶" title="Vidéos" acces="publication">
          <p>
            Ajoutez une vidéo en collant simplement son <b>lien YouTube, Facebook, Vimeo ou Dailymotion</b> — jamais de
            code d&apos;intégration. Le Studio reconstruit lui-même un lecteur sûr et conforme (YouTube passe par la
            version sans cookies). Marquez une vidéo « à l&apos;antenne » pour la mettre en direct : il n&apos;y a
            toujours qu&apos;un seul direct à la fois, en choisir un nouveau libère l&apos;ancien.
          </p>
          <p>
            Les vidéos paraissent dans la fenêtre vidéo de l&apos;accueil (avec l&apos;historique des dernières) et sur
            la page <b>/videos</b>.
          </p>
        </Module>

        <Module id="podcasts" icon="🎙" title="Podcasts" acces="publication">
          <p>
            Organisez vos contenus audio en <b>émissions</b> contenant des <b>épisodes</b>. Créez l&apos;émission une
            fois (titre, description, visuel), puis ajoutez les épisodes au fil des semaines. Le tout alimente la page
            publique /podcasts.
          </p>
        </Module>

        <Module id="formation" icon="🎓" title="A4A Formation" acces="publication">
          <p>
            Le catalogue de cours en ligne : chaque <b>cours</b> contient des <b>leçons</b> ordonnées. Les membres
            s&apos;inscrivent depuis la page /formation et leur progression est suivie automatiquement. Utilisez-le pour
            les modules d&apos;éducation aux médias, de formation professionnelle ou les partenariats pédagogiques.
          </p>
          <p>
            <b>Cours payants :</b> donnez un prix au cours et l&apos;inscription passe par le paiement en ligne. Un
            prix à <b>0</b> laisse le cours gratuit. Les abonnés <b>A4A+ Pro et Corporate</b> accèdent à tous les cours
            payants <b>sans supplément</b> — c&apos;est un argument de leur abonnement.
          </p>
          <Astuce>
            Une inscription payée est <b>définitive</b> : l&apos;élève garde l&apos;accès au cours même si son
            abonnement s&apos;arrête. Ne baissez pas le prix d&apos;un cours déjà vendu sans y réfléchir — les
            premiers acheteurs ont payé plus cher.
          </Astuce>
        </Module>

        <Module id="factchecks" icon="✓" title="A4A Vérifie (fact-checking)" acces="publication">
          <p>
            La rubrique de vérification des faits. Pour chaque affirmation qui circule, créez une fiche : la citation,
            son origine, votre analyse, et un <b>verdict</b> — <b>Vrai</b>, <b>Faux</b>, <b>Trompeur</b> ou{" "}
            <b>À vérifier</b>. Les fiches paraissent sur la page publique <b>/verifie</b>, un vrai marqueur de sérieux
            pour la marque.
          </p>
        </Module>

        <Module id="pages" icon="▧" title="Pages" acces="publication">
          <p>
            Les pages fixes du site : mentions légales, à propos, contact, confidentialité, CGU… et toute page que vous
            voulez créer (dossier spécial, partenariat). L&apos;éditeur est le même texte riche que pour les articles.
            Une page publiée est servie à l&apos;adresse de son slug (ex. <code>/a-propos</code>) et peut être liée
            depuis le menu ou le pied de page.
          </p>
        </Module>

        <Module id="menu" icon="☰" title="Menu du site" acces="publication">
          <p>
            La barre de navigation publique : ajoutez, renommez, réordonnez (flèches), masquez ou supprimez des entrées.
            L&apos;autocomplétion propose vos rubriques, mais toute adresse du site fonctionne (une page, /videos,
            /verifie…).
          </p>
          <Astuce>
            Filet de sécurité : si le menu était entièrement vidé, le site afficherait automatiquement sa navigation par
            défaut — impossible de laisser les lecteurs sans menu. « Reprendre ce menu » recopie ce défaut pour repartir
            d&apos;une base propre.
          </Astuce>
        </Module>

        <Module id="alertes" icon="🔔" title="Alertes push" acces="publication">
          <p>
            Envoie une <b>notification immédiate</b> (breaking news) sur les téléphones et navigateurs des lecteurs qui
            ont activé les alertes : un titre, un texte court, un lien. À réserver aux vraies urgences — trop
            d&apos;alertes fait désabonner. Rappel : la publication d&apos;un article notifie déjà automatiquement les
            abonnés de sa rubrique.
          </p>
        </Module>

        {/* ------------------------------------------------------------ */}
        {/* COMMUNAUTÉ                                                    */}
        {/* ------------------------------------------------------------ */}
        <h2 className="mt-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3">Communauté</h2>

        <Module id="comments" icon="◎" title="Commentaires" acces="tous">
          <p>
            Tous les commentaires des lecteurs, avec leur statut : <b>en attente</b>, <b>approuvé</b>, <b>rejeté</b> ou{" "}
            <b>signalé</b>. Une modération automatique fait un premier tri ; à vous de trancher les cas en attente (le
            badge orange du menu les compte). Approuver publie le commentaire sous l&apos;article ; rejeter le masque
            définitivement.
          </p>
        </Module>

        <Module id="contact" icon="✍" title="Messages" acces="publication">
          <p>
            La boîte de réception du formulaire public /contact. Chaque message arrive ici <b>et</b> par e-mail à la
            rédaction ; répondre depuis votre messagerie écrit directement à l&apos;expéditeur (l&apos;adresse de
            réponse est la sienne).
          </p>
        </Module>

        <Module id="newsletters" icon="✉" title="Newsletters" acces="publication">
          <p>
            <b>Le catalogue.</b> Vous créez autant de newsletters que vous voulez (La Matinale quotidienne, une lettre
            hebdomadaire sur le cacao, une lettre diaspora…), chacune avec son nom, sa cadence et sa description. La
            description est ce que voient les membres au moment de choisir : soignez-la, c&apos;est un argument
            d&apos;inscription.
          </p>
          <ul>
            <li>
              <b>Les membres</b> cochent les lettres qu&apos;ils veulent recevoir depuis leur <i>espace membre</i>.
            </li>
            <li>
              <b>Vous</b> pouvez ajouter une adresse à la main sur n&apos;importe quelle lettre — inscription prise en
              salon, par téléphone, par courrier. Si l&apos;adresse correspond à un compte du site, l&apos;inscription
              s&apos;y rattache automatiquement.
            </li>
            <li>
              Le bouton <b>Retirer</b> de la liste des inscriptions désabonne une adresse d&apos;une lettre précise.
            </li>
          </ul>
          <Astuce>
            Une newsletter qui a des inscrits ne peut pas être supprimée : il faut d&apos;abord retirer les
            inscriptions. C&apos;est volontaire — une liste d&apos;audience se construit lentement et ne doit pas
            disparaître d&apos;un clic.
          </Astuce>
          <p>Composer et envoyer une lettre d&apos;information :</p>
          <ol>
            <li>Créez une édition : objet, texte d&apos;introduction (éditeur riche), sélection d&apos;articles.</li>
            <li>Vérifiez le rendu avec l&apos;aperçu intégré.</li>
            <li>
              Choisissez les destinataires par cases à cocher — <b>ne rien cocher = tous les inscrits</b>, y compris
              ceux qui s&apos;inscriraient entre-temps.
            </li>
            <li>Envoyez : l&apos;expédition part par lots, avec lien de désabonnement automatique.</li>
          </ol>
          <p>
            La liste des <b>inscrits</b> (via le bloc d&apos;inscription en bas de l&apos;accueil) est visible dans le
            module, avec leur date et leur éventuel compte lié. Les personnes désabonnées ne reçoivent plus rien, même
            si elles avaient été cochées avant leur désinscription.
          </p>
          <p>
            <b>Audience visée (La Matinale segmentée).</b> À l&apos;inscription, le lecteur peut cocher ce qui
            l&apos;intéresse : <b>Côte d&apos;Ivoire</b>, <b>Diaspora</b>, <b>Afrique</b>, <b>Business</b>. Sur une
            édition, vous cochez à votre tour les segments visés :
          </p>
          <ul>
            <li>Aucun segment coché sur l&apos;édition = <b>envoi à tous</b>, comme avant.</li>
            <li>
              Des segments cochés = l&apos;édition part aux inscrits ayant retenu <b>au moins un</b> de ces centres
              d&apos;intérêt, <b>plus</b> ceux qui n&apos;en ont coché aucun (ils veulent tout recevoir).
            </li>
          </ul>
          <Astuce>
            Le nombre de destinataires affiché en haut de l&apos;édition tient compte du ciblage <i>et</i> de la
            sélection manuelle : c&apos;est bien le nombre d&apos;envois qui partiront.
          </Astuce>
        </Module>

        <Module id="groupes" icon="◉" title="Groupes" acces="admin">
          <p>
            Les espaces communautaires (diaspora, entrepreneurs…) que les membres peuvent rejoindre depuis /groupes.
            Créez, décrivez et gérez les groupes ici ; le compteur de membres se met à jour tout seul.
          </p>
        </Module>

        <Module id="subscribers" icon="◍" title="Abonnés A4A+" acces="admin">
          <p>
            Le suivi de l&apos;abonnement payant : revenu mensuel récurrent (MRR), impayés, résiliations, et la liste
            des abonnements avec leurs factures (PDF téléchargeables). C&apos;est la vue « business » de votre lectorat
            payant — les paiements eux-mêmes (Mobile Money, carte, PayPal) sont traités automatiquement.
          </p>
          <p>Quatre offres sont proposées aux lecteurs :</p>
          <ul>
            <li>
              <b>Essentiel</b> (2 000 F/mois) — tout le journal sans publicité, archives et newsletter quotidienne.
            </li>
            <li>
              <b>Diaspora</b> (3 500 F/mois) — Essentiel, plus l&apos;accès prioritaire aux offres d&apos;emploi en
              Côte d&apos;Ivoire et le webinaire mensuel.
            </li>
            <li>
              <b>Pro</b> (4 000 F/mois) — Essentiel, plus l&apos;intelligence économique cacao et les rapports marchés.
            </li>
            <li>
              <b>Corporate</b> (50 000 F/mois) — Pro, plus la recherche IA sur l&apos;archive, deux interviews
              dirigeants par an et les licences multi-comptes.
            </li>
          </ul>
          <Astuce>
            Les tarifs et les avantages de chaque offre se modifient dans le code (<code>services/payments</code>) —
            demandez à votre développeur. Attention : le montant sert à retrouver l&apos;offre au moment du paiement,
            deux offres ne doivent jamais avoir le même prix.
          </Astuce>
        </Module>

        <Module id="users" icon="☺" title="Utilisateurs" acces="admin">
          <p>
            Tous les comptes du site. Vous pouvez <b>changer un rôle</b> (lecteur, membre, journaliste, rédaction en
            chef, administration, partenaire, Gestionnaire Régie), attribuer le badge « vérifié », <b>créer un compte</b>{" "}
            (la personne reçoit un e-mail d&apos;invitation pour définir son mot de passe — aucun mot de passe ne circule
            en clair) et <b>supprimer</b> un compte sans contenu ni paiement rattaché.
          </p>
          <ul>
            <li>Impossible de modifier ou supprimer votre propre compte — demandez à un autre admin.</li>
            <li>La suppression est bloquée si le compte a des articles, médias, annonces ou paiements.</li>
            <li>Un rôle changé prend effet à la <b>prochaine connexion</b> de la personne.</li>
          </ul>
        </Module>

        {/* ------------------------------------------------------------ */}
        {/* BUSINESS                                                      */}
        {/* ------------------------------------------------------------ */}
        <h2 className="mt-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3">Business</h2>

        <Module id="brand-content" icon="◆" title="Brand Content" acces="regie">
          <p>
            Les <b>contenus de marque</b> vendus aux entreprises : interview de dirigeant, reportage en entreprise,
            communiqué sponsorisé, sponsoring de newsletter, formats courts. Le module a deux parties.
          </p>
          <ul>
            <li>
              <b>Le catalogue</b> — les offres présentées sur la page publique <i>Publicité › Brand Content</i>, avec
              leur prix, l&apos;unité facturée et la liste des livrables (une ligne par élément). Un prix à <b>0</b>{" "}
              affiche « sur devis ».
            </li>
            <li>
              <b>Les demandes reçues</b> — chaque formulaire rempli sur le site arrive ici <i>et</i> par e-mail (avec
              l&apos;adresse du demandeur en réponse). Suivez l&apos;affaire avec les états <b>Nouveau → En cours →
              Gagné / Perdu</b> et gardez une note interne de la négociation.
            </li>
          </ul>
          <p>
            <b>Sponsor de newsletter :</b> il se règle dans le module <i>Newsletters</i>, sur l&apos;édition concernée
            (nom, accroche, logo, lien). L&apos;encart apparaît en tête du message, précédé de la mention obligatoire
            « Cet envoi vous est offert par ». Laissez le nom vide pour un envoi sans sponsor.
          </p>
          <Astuce>
            Supprimer une offre du catalogue ne supprime pas les demandes déjà reçues : votre historique commercial est
            conservé, la demande indique seulement « offre non précisée ».
          </Astuce>
        </Module>

        <Module id="evenements" icon="◷" title="Événements" acces="publication">
          <p>
            Forums, cérémonies, conférences et webinaires, avec <b>billetterie en ligne</b>. Un événement se construit
            en trois temps :
          </p>
          <ol>
            <li>
              <b>La fiche</b> — titre, accroche, dates, lieu (ou « en ligne »), programme, visuel et <b>jauge</b>
              globale. Elle reste invisible du public tant que vous ne l&apos;avez pas publiée.
            </li>
            <li>
              <b>Les catégories de billets</b> — « Standard », « VIP », « Étudiant »… chacune avec son prix, sa
              description et son quota. Un prix à <b>0 crée un billet gratuit</b> : l&apos;inscription est confirmée
              aussitôt, sans passer par le paiement.
            </li>
            <li>
              <b>Les partenaires</b> — logos et niveaux affichés en bas de la page. Le sponsoring d&apos;édition est
              une recette à part entière.
            </li>
          </ol>
          <p>
            <b>Le jour J :</b> chaque inscrit dispose d&apos;un <b>code d&apos;entrée</b> unique (visible dans son
            espace membre) à présenter à l&apos;accueil. Le bouton <b>Export des inscrits</b> vous donne la liste
            complète en tableur — noms, billets, codes, états — pour l&apos;émargement ou les badges.
          </p>
          <p>
            <b>Inscriptions « en attente » :</b> ce sont des billets payants dont le règlement n&apos;a pas abouti.
            Vous pouvez les confirmer à la main (paiement reçu autrement) ou les annuler — annuler <b>libère la
            place</b> pour quelqu&apos;un d&apos;autre.
          </p>
          <Astuce>
            Pour un webinaire, cochez « en ligne » et renseignez le lien de connexion : il n&apos;est révélé
            qu&apos;aux inscrits confirmés, jamais au public.
          </Astuce>
        </Module>

        <Module id="intelligence" icon="◲" title="A4A Intelligence" acces="publication">
          <p>
            Les <b>publications économiques vendues par abonnement</b> aux entreprises : rapport cacao, revue des
            investissements, classement des entreprises, études sur mesure, revue de presse corporate.
          </p>
          <p>Le module s&apos;organise à deux niveaux :</p>
          <ul>
            <li>
              <b>La publication</b> — le produit vendu : son titre, son prix, sa durée d&apos;abonnement, sa
              périodicité et le public visé. Vous pouvez la <b>retirer de la vente</b> sans rien supprimer.
            </li>
            <li>
              <b>Les éditions</b> — les livraisons successives. Chacune porte un <b>repère</b> (2026-07, T3-2026…), un
              titre, un <b>résumé public</b> et, au choix, un contenu en ligne et/ou un <b>PDF</b>.
            </li>
          </ul>
          <p>
            <b>Ce qui est public, ce qui ne l&apos;est pas :</b> le résumé d&apos;une édition est visible de tous —
            c&apos;est lui qui donne envie de s&apos;abonner. Le PDF n&apos;est jamais servi directement : il passe par
            une adresse qui vérifie l&apos;abonnement à chaque téléchargement. Une édition reste invisible tant que vous
            ne l&apos;avez pas <b>publiée</b>.
          </p>
          <p>
            <b>Les abonnés</b> apparaissent automatiquement après un paiement en ligne. Pour une vente conclue hors
            ligne (contrat, convention, gratuité), ouvrez l&apos;accès à la main depuis l&apos;adresse e-mail du compte.
            Un réabonnement anticipé ajoute les mois à l&apos;échéance en cours — l&apos;abonné ne perd rien.
          </p>
          <Astuce>
            Une publication qui a déjà des abonnés ne peut pas être supprimée : retirez-la de la vente. C&apos;est
            volontaire — un client payant ne doit jamais perdre l&apos;accès à ce qu&apos;il a acheté.
          </Astuce>
        </Module>

        <Module id="annonces" icon="▤" title="Petites annonces" acces="publication">
          <p>
            Les annonces déposées par les membres (emploi, immobilier, services) arrivent <b>en attente</b> — le badge
            orange les compte. Vous les approuvez ou les refusez ; une annonce publiée expire automatiquement après sa
            durée (les formules payantes passent par le paiement en ligne avant d&apos;arriver ici). La republication
            par le membre remet le compteur de jours à zéro.
          </p>
        </Module>

        <Module id="regie" icon="◈" title="Régie publicitaire" acces="regie">
          <p>La régie gère toute la publicité du site. Elle s&apos;articule en trois niveaux :</p>
          <ul>
            <li>
              <b>Campagnes</b> — le contrat avec un annonceur : période (ou diffusion permanente), priorité, ciblage
              (rubriques, pays, mots-clés), plafonds d&apos;affichages/clics, compte annonceur rattaché.
            </li>
            <li>
              <b>Bannières</b> — les visuels d&apos;une campagne, par format (bandeau, pavé, natif, interstitiel,
              habillage, vidéo). Plusieurs bannières d&apos;une même campagne tournent en rotation.
            </li>
            <li>
              <b>Emplacements</b> — les zones du site où la publicité peut paraître ; chacun s&apos;active ou se coupe
              d&apos;un clic, sans toucher aux campagnes.
            </li>
          </ul>
          <p>
            <b>Valider les réservations en ligne :</b> quand un annonceur réserve et paie sur le site, sa campagne
            arrive <b>« À valider »</b> (bandeau orange en haut de la régie + badge dans le menu + e-mail à la
            rédaction). Ouvrez la campagne, contrôlez le visuel et le lien, puis :
          </p>
          <ul>
            <li>
              <b>Approuver la diffusion</b> — elle démarre immédiatement, pour la durée complète payée (le temps de
              validation n&apos;est pas décompté à l&apos;annonceur) ;
            </li>
            <li>
              <b>Refuser</b> — la campagne est close sans diffusion (le remboursement éventuel se traite avec
              l&apos;annonceur).
            </li>
          </ul>
          <p>
            <b>Statuts d&apos;une campagne :</b> Brouillon → (À valider, pour les réservations en ligne) → Active → En
            pause / Terminée. Une campagne terminée peut être <b>reconduite</b> : rouvrez-la, donnez une date de fin
            future, elle repasse en brouillon prête à réactiver.
          </p>
          <p>
            <b>Suivi :</b> affichages, clics et CTR par bannière et par campagne, export CSV par campagne, et envoi des{" "}
            <b>rapports mensuels</b> aux comptes annonceurs d&apos;un clic (chaque annonceur a aussi son espace de suivi
            en temps réel sur le site).
          </p>
        </Module>

        <Module id="tarifs" icon="⛁" title="Grille des prix des packs" acces="regie">
          <p>
            Les <b>packs</b> sont les offres à prix forfaitaire que les annonceurs réservent seuls sur la page
            /publicite : un format × une durée = un prix. Ici, vous pouvez :
          </p>
          <ul>
            <li><b>modifier</b> un prix, un libellé, une durée ou l&apos;ordre d&apos;affichage — effet immédiat sur le site ;</li>
            <li><b>ajouter</b> un pack (par exemple un « Bandeau 45 jours » pour une opération spéciale) ;</li>
            <li>
              <b>retirer de la vente</b> un pack sans le supprimer : il disparaît du formulaire public mais reste dans
              l&apos;historique des commandes déjà passées (la suppression n&apos;est possible que s&apos;il n&apos;a
              jamais été commandé).
            </li>
          </ul>
          <Astuce>
            Le « À partir de … FCFA » de la page /publicite est calculé automatiquement sur le pack le moins cher en
            vente.
          </Astuce>
        </Module>

        <Module id="affiliation" icon="⇗" title="Affiliation" acces="regie">
          <p>
            Les <b>liens partenaires rémunérés à la commission</b> : transferts d&apos;argent, assurances, services
            utiles à la diaspora. Vous créez un lien, le Studio vous donne une <b>adresse courte</b> du type{" "}
            <code>abidjan4all.info/go/wave-transfert</code> à coller dans vos articles.
          </p>
          <p>
            Chaque clic est compté avant la redirection. Ce compteur est votre <b>moyen de vérifier</b> les commissions
            que le partenaire vous déclare.
          </p>
          <Astuce>
            Préférez <b>désactiver</b> un lien plutôt que le supprimer : l&apos;adresse courte vit dans des articles
            déjà publiés. Un lien désactivé ramène simplement le lecteur à l&apos;accueil ; un lien supprimé fait la
            même chose, mais vous perdez son compteur de clics.
          </Astuce>
        </Module>

        <Module id="stats" icon="▲" title="Statistiques" acces="admin">
          <p>
            L&apos;audience mesurée par le site lui-même, sans cookie et sans stocker d&apos;adresse IP (elle compte
            donc aussi les lecteurs qui refusent le bandeau cookies) : visites et pages vues par jour, visiteurs,
            répartition mobile, pays, vidéos et podcasts consultés, inscriptions. S&apos;y ajoutent le top des articles,
            la répartition par rubrique, les revenus mensuels et un <b>historique par année</b>.
          </p>
          <ul>
            <li>La mesure a démarré le 17 juillet 2026 — les mois antérieurs sont vides, c&apos;est normal.</li>
            <li>Les visiteurs sont comptés par jour (pas de suivi d&apos;une journée à l&apos;autre : choix de confidentialité).</li>
            <li>« Vidéos vues » compte les affichages de page, pas les lectures effectives.</li>
          </ul>
        </Module>

        <Module id="kpi" icon="◎" title="KPI Business Model" acces="admin">
          <p>
            Les douze indicateurs de pilotage du business plan 2026-2031, mesurés sur les données réelles du site et
            confrontés aux <b>cibles 2027, 2028 et 2030</b> du document : visiteurs, inscrits newsletter, abonnés
            Premium, churn, annonceurs actifs, interviews vendues, abonnés B2B, ARPU, LTV.
          </p>
          <p>
            <b>Trois indicateurs restent « non mesuré »</b> — taux d&apos;ouverture de la newsletter, NPS,
            téléchargements de l&apos;application mobile. Ils supposent respectivement un pixel de suivi dans les
            e-mails, une enquête de satisfaction, et une application mobile : aucun n&apos;existe aujourd&apos;hui. Le
            tableau le dit plutôt que d&apos;afficher une estimation.
          </p>
          <Astuce>
            Le churn et la LTV ne deviendront fiables qu&apos;après douze mois d&apos;exploitation : ils comparent le
            parc d&apos;abonnés d&apos;il y a un an aux résiliations de l&apos;année. D&apos;ici là, lisez-les comme
            des ordres de grandeur.
          </Astuce>
        </Module>

        <Module id="redirections" icon="↪" title="Redirections" acces="publication">
          <p>
            Pour rediriger une ancienne adresse vers une nouvelle (article renommé, page supprimée, lien historique de
            l&apos;ancien site) : saisissez le chemin source et la destination. Le compteur d&apos;utilisations vous dit
            si la règle sert encore. Les redirections sont définitives pour les moteurs de recherche — Google transfère
            le référencement vers la nouvelle adresse.
          </p>
        </Module>
      </div>

      <p className="mt-8 border-t border-line pt-4 text-[12.5px] text-ink-3">
        Une question qui n&apos;a pas sa réponse ici ? Écrivez-vous une note via{" "}
        <Link href="/admin/contact" className="font-semibold text-ink hover:underline">
          Messages
        </Link>{" "}
        ou contactez votre administrateur. Cette page évolue avec le Studio — chaque nouveau module y sera documenté.
      </p>
    </div>
  );
}
