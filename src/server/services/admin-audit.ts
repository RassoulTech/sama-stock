import "server-only";
import type { DbOrTx } from "@/db";
import { adminAuditLog } from "@/db/schema";
import type { AdminAction } from "@/lib/domain/admin";
import type { AppContext } from "../context";

/** Inscrit une action d'administrateur dans le journal (à appeler dans la même transaction que l'action). */
export async function logAdmin(
  exec: DbOrTx,
  ctx: AppContext,
  entry: { action: AdminAction; summary: string; businessId?: string | null; targetUserId?: string | null },
) {
  await exec.insert(adminAuditLog).values({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    action: entry.action,
    summary: entry.summary,
    businessId: entry.businessId ?? null,
    targetUserId: entry.targetUserId ?? null,
  });
}
