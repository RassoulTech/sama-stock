import Link from "next/link";
import { Progress } from "@/components/ui/progress";

export function PlanUsage({
  label,
  used,
  limit,
  showUpgrade,
}: {
  label: string;
  used: number;
  limit: number | null;
  showUpgrade: boolean;
}) {
  if (limit === null) return null;
  const pct = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const full = used >= limit;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/[0.07]">
      <p className="text-sm">
        <span className="num font-bold">
          {used} / {limit}
        </span>{" "}
        <span className="text-muted-foreground">{label}</span>
      </p>
      <Progress value={pct} className={`h-2 min-w-24 flex-1 ${full ? "[&>*]:bg-destructive" : ""}`} />
      {showUpgrade && full && (
        <Link href="/abonnement" className="text-sm font-semibold text-primary hover:underline">
          Augmenter la limite
        </Link>
      )}
    </div>
  );
}
