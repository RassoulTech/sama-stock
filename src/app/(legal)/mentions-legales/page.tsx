import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { pageMetadata } from "@/lib/seo";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Mentions légales",
  description: "Éditeur, immatriculation (NINEA, RCCM), hébergement et contact de Sama Stock, logiciel de gestion de stock édité à Thiès, Sénégal.",
  path: "/mentions-legales",
});

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Sama Stock est un service en ligne de gestion de stock, de caisse, de commandes et de crédits clients destiné aux commerçants. Voici qui l'édite et où il est hébergé."
    >
      <h2>Éditeur du site</h2>
      <dl>
        <dt>Éditeur</dt>
        <dd>{LEGAL.editor}</dd>
        <dt>NINEA</dt>
        <dd className="num">{LEGAL.ninea}</dd>
        <dt>RCCM</dt>
        <dd className="num">{LEGAL.rccm}</dd>
        <dt>Siège</dt>
        <dd>{LEGAL.city}</dd>
        <dt>Email</dt>
        <dd>
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </dd>
        <dt>Téléphone et WhatsApp</dt>
        <dd className="num">
          <a href={`tel:+${LEGAL.whatsapp}`}>{LEGAL.phone}</a>
        </dd>
        <dt>Directeur de la publication</dt>
        <dd>{LEGAL.director}</dd>
      </dl>
      <p>
        L&apos;entreprise est immatriculée au Registre du commerce et du crédit mobilier (RCCM) de Thiès et identifiée au
        Numéro d&apos;identification nationale des entreprises et associations (NINEA).
      </p>

      <h2>Hébergement</h2>
      <ul>
        <li>
          <strong>Application</strong> : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
          (vercel.com). Les serveurs qui font tourner Sama Stock sont situés à Francfort (Allemagne).
        </li>
        <li>
          <strong>Base de données</strong> : Neon (neon.tech), serveurs situés à Francfort (Allemagne).
        </li>
      </ul>

      <h2>Paiements</h2>
      <p>
        Les licences se paient à l&apos;équipe Sama Stock par Wave, Orange Money, espèces ou virement, contre une facture à
        votre nom. Sama Stock ne reçoit ni ne conserve votre code secret ou vos identifiants mobile money.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom Sama Stock, son logo, ses textes, ses visuels, ses vidéos et son interface sont protégés. Toute reproduction
        sans autorisation écrite de l&apos;éditeur est interdite. Les logos Wave et Orange Money appartiennent à leurs
        propriétaires respectifs et ne sont utilisés que pour indiquer les moyens de paiement acceptés.
      </p>

      <h2>Données personnelles</h2>
      <p>
        La manière dont vos données sont collectées et protégées est décrite dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>. Les règles d&apos;utilisation du service et
        de vente des licences figurent dans les <Link href="/conditions">conditions d&apos;utilisation et de vente</Link>.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Le site est soumis au droit sénégalais, notamment à la loi n° 2008-08 du 25 janvier 2008 sur les transactions
        électroniques et à la loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel.
      </p>
      <ContactLine />
    </LegalPage>
  );
}
