import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { pageMetadata } from "@/lib/seo";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Politique de confidentialité",
  description: "Quelles données Sama Stock collecte, pourquoi, combien de temps, et comment exercer vos droits selon la loi sénégalaise n° 2008-12.",
  path: "/confidentialite",
});

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Vos données et celles de votre commerce vous appartiennent. Cette page explique simplement ce que Sama Stock collecte, pourquoi, qui y a accès et comment exercer vos droits, conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel."
    >
      <h2>1. Responsable du traitement</h2>
      <p>
        {LEGAL.editor}, éditeur de Sama Stock, NINEA {LEGAL.ninea}, RCCM {LEGAL.rccm}, {LEGAL.city}. Contact :{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>

      <h2>2. Les données que nous collectons</h2>
      <ul>
        <li>
          <strong>Votre compte</strong> : nom, adresse email, mot de passe (jamais stocké en clair, uniquement sous forme
          chiffrée), rôle dans le commerce.
        </li>
        <li>
          <strong>Votre commerce</strong> : nom, activité, téléphone, adresse, ville, logo, boutiques et dépôts.
        </li>
        <li>
          <strong>Votre activité</strong> : produits, stocks, ventes, commandes, fournisseurs, dépenses, et votre
          licence avec ses paiements.
        </li>
        <li>
          <strong>Les données de vos clients</strong> que vous saisissez (nom, téléphone, crédits). Pour ces données, c&apos;est
          vous qui êtes responsable du traitement : Sama Stock les traite uniquement pour votre compte et selon vos
          instructions.
        </li>
        <li>
          <strong>Données techniques</strong> : cookie de connexion, adresse IP et journaux techniques conservés par
          l&apos;hébergeur pour la sécurité du service.
        </li>
        <li>
          <strong>Paiements</strong> : pour votre licence, nous conservons seulement le montant, la date, le moyen de
          paiement et sa référence. Jamais votre code secret mobile money.
        </li>
      </ul>

      <h2>3. Pourquoi nous les utilisons</h2>
      <ul>
        <li>Fournir le service : gérer votre stock, vos ventes, vos commandes et vos crédits clients.</li>
        <li>Gérer votre licence et ses paiements, et respecter nos obligations comptables.</li>
        <li>Sécuriser les comptes, prévenir la fraude et corriger les pannes.</li>
        <li>Vous répondre quand vous nous contactez.</li>
      </ul>
      <p>
        <strong>Aucune publicité, aucune revente, aucun profilage.</strong> Vos données ne sont jamais vendues ni louées.
      </p>

      <h2>4. Qui y a accès</h2>
      <ul>
        <li>Vous, et les membres de votre équipe selon les droits que vous leur donnez.</li>
        <li>L&apos;éditeur de Sama Stock, uniquement pour le support et la sécurité.</li>
        <li>
          Nos prestataires techniques, chacun pour sa seule mission : Vercel (hébergement de l&apos;application) et Neon
          (base de données).
        </li>
      </ul>

      <h2>5. Où sont stockées vos données</h2>
      <p>
        Vos données sont hébergées sur des serveurs professionnels situés à Francfort (Allemagne). Certains prestataires
        étant des sociétés étrangères, des données peuvent être traitées hors du Sénégal, avec des garanties de sécurité :
        connexion chiffrée, accès restreints et engagements de confidentialité.
      </p>

      <h2>6. Combien de temps</h2>
      <ul>
        <li>Tant que votre compte existe, vos données sont conservées pour vous rendre le service.</li>
        <li>Après une demande de suppression de compte, elles sont effacées dans un délai de 90 jours.</li>
        <li>
          Les justificatifs de paiement des licences sont conservés 10 ans, comme l&apos;exige le droit comptable OHADA.
        </li>
        <li>Les journaux techniques sont conservés pour une durée limitée, au plus 12 mois.</li>
      </ul>

      <h2>7. Comment nous protégeons vos données</h2>
      <ul>
        <li>Connexion chiffrée (HTTPS) sur tout le site.</li>
        <li>Mots de passe chiffrés : personne, pas même l&apos;éditeur, ne peut les lire.</li>
        <li>Chaque commerce ne voit que ses propres données ; chaque employé n&apos;a que les droits donnés par le patron.</li>
      </ul>

      <h2>8. Vos droits</h2>
      <p>Conformément à la loi n° 2008-12, vous pouvez à tout moment :</p>
      <ul>
        <li>accéder à vos données et en obtenir une copie ;</li>
        <li>les faire corriger si elles sont inexactes ;</li>
        <li>vous opposer à un traitement pour un motif légitime ;</li>
        <li>demander leur suppression.</li>
      </ul>
      <p>
        Écrivez à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : nous répondons dans un délai d&apos;un mois. Si vous
        estimez que vos droits ne sont pas respectés, vous pouvez saisir la Commission de protection des données
        personnelles (CDP) du Sénégal.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Sama Stock n&apos;utilise que les cookies indispensables à son fonctionnement : le cookie qui vous garde connecté et
        ceux qui protègent votre session. Votre choix d&apos;affichage (clair ou sombre) est enregistré dans votre navigateur.
        Aucun cookie publicitaire ni de mesure d&apos;audience.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Si cette politique change de façon importante, nous vous prévenons dans l&apos;application ou par email avant
        l&apos;entrée en vigueur des changements.
      </p>
      <ContactLine />
    </LegalPage>
  );
}
