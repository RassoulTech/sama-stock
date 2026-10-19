import { LEGAL } from "@/lib/legal";

/** Gabarit d'une page légale : titre, date de mise à jour et texte mis en forme. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <article>
      <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">Informations légales</p>
      <h1 className="mt-3 text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] sm:text-[2.5rem]">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Dernière mise à jour : {LEGAL.updatedAt}</p>
      <p className="mt-6 text-[1.0625rem] leading-relaxed text-muted-foreground">{intro}</p>
      <div className="legal mt-4">{children}</div>
    </article>
  );
}

export function ContactLine() {
  return (
    <p>
      Pour toute question : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
    </p>
  );
}
