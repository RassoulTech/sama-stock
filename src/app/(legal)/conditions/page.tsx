import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";
import { formatLimit, PAID_PLANS, PERIOD_DAYS, PLANS, TRIAL_DAYS } from "@/lib/domain/plans";
import { formatFCFA } from "@/lib/format";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Conditions d'utilisation et de vente",
  description: "Règles d'utilisation de Sama Stock, essai gratuit, formules, paiement et résiliation.",
};

export default function ConditionsPage() {
  return (
    <LegalPage
      title="Conditions d'utilisation et de vente"
      intro="Ces conditions encadrent l'utilisation de Sama Stock et la souscription aux formules payantes. En créant un compte, vous les acceptez."
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
          Le propriétaire du commerce peut inviter des employés et décide de leurs droits ; il reste responsable de leur
          utilisation du service.
        </li>
      </ul>

      <h2>3. Essai gratuit</h2>
      <p>
        Chaque nouveau commerce bénéficie de {TRIAL_DAYS} jours d&apos;essai gratuit, sans moyen de paiement, dans les limites
        de la formule Essai ({formatLimit(PLANS.trial.maxProducts)} produits, propriétaire seul). À la fin de
        l&apos;essai, rien n&apos;est débité : le compte passe simplement en consultation seule.
      </p>

      <h2>4. Formules et prix</h2>
      <ul>
        {PAID_PLANS.map((p) => (
          <li key={p.id}>
            <strong>
              {p.label} : {formatFCFA(p.price)} pour {PERIOD_DAYS} jours
            </strong>{" "}
            — {formatLimit(p.maxProducts)} produits, {p.maxEmployees === 0 ? "propriétaire seul" : `${formatLimit(p.maxEmployees)} employés`},{" "}
            {p.maxLocations} boutique{p.maxLocations > 1 ? "s ou dépôts" : ""}.
          </li>
        ))}
      </ul>
      <p>Les prix sont indiqués en francs CFA (FCFA). Ils peuvent évoluer ; un changement ne s&apos;applique qu&apos;à la période suivante.</p>

      <h2>5. Paiement</h2>
      <ul>
        <li>
          <strong>En ligne</strong>, par Wave ou Orange Money, sur la page de paiement sécurisée de SasPay. La formule
          s&apos;active dès que le paiement est confirmé par SasPay.
        </li>
        <li>
          <strong>En espèces</strong>, auprès de l&apos;équipe Sama Stock, qui active la formule et l&apos;enregistre dans
          votre historique.
        </li>
        <li>
          Chaque paiement ouvre une période de {PERIOD_DAYS} jours. Il n&apos;y a <strong>aucun prélèvement automatique</strong> :
          vous renouvelez quand vous le décidez. Un renouvellement de la même formule s&apos;ajoute à la fin de la période en
          cours.
        </li>
      </ul>

      <h2>6. Fin de période et remboursement</h2>
      <p>
        Sans renouvellement, le compte passe en consultation seule : vos données restent conservées et accessibles, et tout
        redevient modifiable dès le paiement suivant. Toute période commencée est due. En cas de double paiement ou
        d&apos;erreur technique, écrivez-nous : le montant concerné vous est remboursé.
      </p>

      <h2>7. Vos engagements</h2>
      <ul>
        <li>Utiliser Sama Stock pour une activité commerciale licite.</li>
        <li>
          Respecter la loi sur les données personnelles pour les informations de vos clients que vous enregistrez (vous en
          êtes responsable).
        </li>
        <li>Ne pas tenter de contourner la sécurité du service ni d&apos;accéder aux données d&apos;un autre commerce.</li>
      </ul>

      <h2>8. Nos engagements</h2>
      <ul>
        <li>Mettre tout en œuvre pour que le service soit disponible 24 h/24, hors maintenance et incidents indépendants de notre volonté.</li>
        <li>Protéger vos données comme décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>.</li>
        <li>Ne jamais vendre vos données ni celles de vos clients.</li>
      </ul>

      <h2>9. Responsabilité</h2>
      <p>
        Sama Stock est un outil d&apos;aide à la gestion : les chiffres affichés dépendent des informations que vous saisissez,
        et vos décisions commerciales restent les vôtres. L&apos;éditeur est tenu à une obligation de moyens. Sa
        responsabilité ne peut pas dépasser le montant payé pour le service au cours des 12 derniers mois.
      </p>

      <h2>10. Suspension et résiliation</h2>
      <p>
        Vous pouvez arrêter à tout moment, simplement en ne renouvelant pas, et demander la suppression de votre compte par
        email. L&apos;éditeur peut suspendre un compte en cas de fraude ou de manquement grave à ces conditions, après vous en
        avoir informé sauf urgence.
      </p>

      <h2>11. Modifications des conditions</h2>
      <p>
        Toute modification importante vous est annoncée dans l&apos;application ou par email au moins 15 jours avant son
        entrée en vigueur.
      </p>

      <h2>12. Droit applicable et litiges</h2>
      <p>
        Ces conditions sont soumises au droit sénégalais. En cas de désaccord, nous cherchons d&apos;abord une solution
        amiable ; à défaut, les tribunaux compétents de Thiès sont saisis.
      </p>
      <ContactLine />
    </LegalPage>
  );
}
