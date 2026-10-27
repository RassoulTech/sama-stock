import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { pageMetadata } from "@/lib/seo";
import { formatLimit, LICENSE_ORDER, LICENSE_PACKS, limitLabel, MAINTENANCE_INCLUDED_MONTHS, TRIAL, TRIAL_DAYS } from "@/lib/domain/plans";
import { formatFCFA } from "@/lib/format";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Conditions d'utilisation et de vente",
  description: "Règles d'utilisation de Sama Stock : essai gratuit de 14 jours, licences achetées une fois, paiement Wave, Orange Money ou espèces, maintenance.",
  path: "/conditions",
});

export default function ConditionsPage() {
  return (
    <LegalPage
      title="Conditions d'utilisation et de vente"
      intro="Ces conditions encadrent l'utilisation de Sama Stock, l'essai gratuit et l'achat d'une licence. En créant un compte, vous les acceptez."
    >
      <h2>1. Le service</h2>
      <p>
        Sama Stock est un logiciel en ligne, édité par {LEGAL.editor} (NINEA {LEGAL.ninea}, RCCM {LEGAL.rccm}), qui
        permet aux commerçants de suivre leur stock, d&apos;encaisser leurs ventes, de gérer leurs commandes et les crédits
        de leurs clients. Il fonctionne sur téléphone, tablette et ordinateur, avec une connexion internet.
      </p>

      <h2>2. Votre compte</h2>
      <ul>
        <li>Les informations que vous donnez à l&apos;inscription doivent être exactes.</li>
        <li>
          Votre mot de passe est personnel : gardez-le secret. Les actions faites depuis votre compte sont réputées faites
          par vous.
        </li>
        <li>
          Le propriétaire du commerce peut ajouter des employés et décide de leurs droits ; il reste responsable de leur
          utilisation du service.
        </li>
      </ul>

      <h2>3. Essai gratuit</h2>
      <p>
        Chaque nouveau commerce peut essayer Sama Stock {TRIAL_DAYS} jours gratuitement, sans moyen de paiement, dans les
        limites de l&apos;essai ({formatLimit(TRIAL.limits.maxProducts)} produits, propriétaire seul). À la fin de l&apos;essai,
        rien n&apos;est débité : le compte passe simplement en consultation seule, et tout redevient modifiable dès que votre
        licence est activée.
      </p>

      <h2>4. Licences et prix</h2>
      <p>Sama Stock se vend une seule fois, sous forme de licence, installée et personnalisée pour votre commerce :</p>
      <ul>
        {LICENSE_ORDER.map((id) => {
          const p = LICENSE_PACKS[id];
          return (
            <li key={id}>
              <strong>
                Licence {p.label} : {formatFCFA(p.price)}
              </strong>{" "}
              — {p.limits.maxEmployees === 0 ? "propriétaire seul" : limitLabel(p.limits.maxEmployees, "employés", { lowercase: true })},{" "}
              {p.limits.maxLocations} boutique{p.limits.maxLocations > 1 ? "s ou dépôts" : ""} ; maintenance ensuite {formatFCFA(p.maintenancePrice)} par an.
            </li>
          );
        })}
      </ul>
      <ul>
        <li>
          Le prix comprend l&apos;installation, la personnalisation (logo, couleur), l&apos;import de vos produits, la formation
          et <strong>{MAINTENANCE_INCLUDED_MONTHS} mois de maintenance</strong>.
        </li>
        <li>
          Les prix sont indiqués en francs CFA (FCFA). Le prix peut être convenu avec vous : il figure sur votre devis.
        </li>
        <li>
          <strong>L&apos;application ne s&apos;arrête jamais</strong>, même sans maintenance. Il n&apos;y a pas d&apos;abonnement
          ni de prélèvement automatique.
        </li>
      </ul>

      <h2>5. Paiement</h2>
      <ul>
        <li>
          Par Wave, Orange Money, espèces ou virement, à l&apos;équipe Sama Stock. Vous recevez une facture à votre nom.
        </li>
        <li>
          Le paiement peut se faire en plusieurs fois, par exemple un acompte à la commande et le solde à l&apos;installation.
        </li>
        <li>Si le solde convenu n&apos;est pas payé, l&apos;accès peut être suspendu jusqu&apos;au paiement ; vos données sont conservées.</li>
      </ul>

      <h2>6. Maintenance et remboursement</h2>
      <p>
        Après la première année, la maintenance (assistance, nouveautés, sauvegardes) est facultative et se renouvelle par
        année. En cas de double paiement ou d&apos;erreur, écrivez-nous : le montant concerné vous est remboursé.
      </p>

      <h2>7. Données de l&apos;essai</h2>
      <p>
        Tout ce que vous saisissez pendant l&apos;essai (produits, ventes, clients) est gardé quand votre licence est activée.
      </p>

      <h2>8. Vos engagements</h2>
      <ul>
        <li>Utiliser Sama Stock pour une activité commerciale licite.</li>
        <li>
          Respecter la loi sur les données personnelles pour les informations de vos clients que vous enregistrez (vous en
          êtes responsable).
        </li>
        <li>Ne pas tenter de contourner la sécurité du service ni d&apos;accéder aux données d&apos;un autre commerce.</li>
      </ul>

      <h2>9. Nos engagements</h2>
      <ul>
        <li>Mettre tout en œuvre pour que le service soit disponible 24 h/24, hors maintenance et incidents indépendants de notre volonté.</li>
        <li>Protéger vos données comme décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>.</li>
        <li>Ne jamais vendre vos données ni celles de vos clients.</li>
      </ul>

      <h2>10. Responsabilité</h2>
      <p>
        Sama Stock est un outil d&apos;aide à la gestion : les chiffres affichés dépendent des informations que vous saisissez,
        et vos décisions commerciales restent les vôtres. L&apos;éditeur est tenu à une obligation de moyens. Sa
        responsabilité ne peut pas dépasser le montant payé pour le service au cours des 12 derniers mois.
      </p>

      <h2>11. Suspension et résiliation</h2>
      <p>
        Vous pouvez arrêter à tout moment, simplement en ne renouvelant pas, et demander la suppression de votre compte par
        email. L&apos;éditeur peut suspendre un compte en cas de fraude ou de manquement grave à ces conditions, après vous en
        avoir informé sauf urgence.
      </p>

      <h2>12. Modifications des conditions</h2>
      <p>
        Toute modification importante vous est annoncée dans l&apos;application ou par email au moins 15 jours avant son
        entrée en vigueur.
      </p>

      <h2>13. Droit applicable et litiges</h2>
      <p>
        Ces conditions sont soumises au droit sénégalais. En cas de désaccord, nous cherchons d&apos;abord une solution
        amiable ; à défaut, les tribunaux compétents de Thiès sont saisis.
      </p>
      <ContactLine />
    </LegalPage>
  );
}
