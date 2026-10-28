"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { restoreImpact } from "@/lib/backup/compare";
import { isBackupPath, parseRunId } from "@/lib/backup/format";
import { ActionError, parse, runAction } from "../action";
import { currentShopCounts } from "../backup/export";
import { restoreAdminPayload, restoreShopPayload } from "../backup/restore";
import { readManifest, readPayload, runBackup } from "../backup/runs";
import { requireSuperAdminAction } from "../context";
import { logAdmin } from "../services/admin-audit";
import { reportError } from "../services/app-errors";

const pathSchema = z.string().refine(isBackupPath, "Fichier de sauvegarde inconnu.");

async function payloadAt(path: string) {
  const payload = await readPayload(parse(pathSchema, path));
  if (!payload) throw new ActionError("Fichier de sauvegarde introuvable.");
  return payload;
}

/** « Sauvegarder maintenant » : toutes les boutiques et l'admin. */
export async function backupNow() {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const manifest = await runBackup("manuelle");
    await logAdmin(db, ctx, { action: "backup", summary: `Sauvegarde manuelle : ${manifest.files.length} fichiers (${manifest.state})` });
    if (manifest.state !== "ok") {
      await reportError({ source: "sauvegarde", route: "/admin/sauvegardes", message: `Sauvegarde manuelle incomplète : ${manifest.errors.map((e) => `${e.name} (${e.message})`).join(", ")}` });
    }
    revalidatePath("/admin/sauvegardes");
    return { state: manifest.state, files: manifest.files.length, errors: manifest.errors.length };
  });
}

/** Fichiers d'une sauvegarde (liste dépliée). */
export async function getRunFiles(runId: string) {
  return runAction(async () => {
    await requireSuperAdminAction();
    if (!parseRunId(runId)) throw new ActionError("Sauvegarde inconnue.");
    const manifest = await readManifest(runId);
    if (!manifest) throw new ActionError("Sommaire introuvable.");
    return manifest.files.map((f) => ({ type: f.type, name: f.name, path: f.path, bytes: f.bytes, counts: f.counts, reused: f.sameAs !== null }));
  });
}

/** Ce que la restauration d'une boutique changerait, pour la fenêtre de confirmation. */
export async function previewShopRestore(path: string) {
  return runAction(async () => {
    await requireSuperAdminAction();
    const payload = await payloadAt(path);
    if (payload.type !== "boutique" || !payload.businessId) throw new ActionError("Ce fichier n'est pas la sauvegarde d'une boutique.");
    return { name: payload.name, savedAt: payload.createdAt, lines: restoreImpact(payload.counts, await currentShopCounts(payload.businessId)) };
  });
}

/** Remet une boutique dans l'état de la sauvegarde, après une copie de sécurité de son état actuel. */
export async function restoreShop(input: { path: string; confirmName: string }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const payload = await payloadAt(input.path);
    if (payload.type !== "boutique" || !payload.businessId) throw new ActionError("Ce fichier n'est pas la sauvegarde d'une boutique.");
    if (input.confirmName.trim().toLowerCase() !== payload.name.trim().toLowerCase()) {
      throw new ActionError("Retapez exactement le nom de la boutique pour confirmer.");
    }
    const safety = await runBackup("avant-restauration", { businessIds: [payload.businessId], admin: false });
    if (safety.state !== "ok") throw new ActionError("La copie de sécurité d'avant restauration a échoué : rien n'a été changé.");
    await restoreShopPayload(payload, ctx);
    revalidatePath("/admin", "layout");
    return { safetyRun: safety.runId };
  });
}

/** Remet licences, paiements, notes et journal dans l'état de la sauvegarde. */
export async function restoreAdmin(input: { path: string; confirm: string }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    if (input.confirm.trim().toUpperCase() !== "ADMIN") throw new ActionError("Tapez ADMIN pour confirmer.");
    const payload = await payloadAt(input.path);
    if (payload.type !== "admin") throw new ActionError("Ce fichier n'est pas la sauvegarde de l'espace admin.");
    const safety = await runBackup("avant-restauration", { businessIds: [], admin: true });
    if (safety.state !== "ok") throw new ActionError("La copie de sécurité d'avant restauration a échoué : rien n'a été changé.");
    await restoreAdminPayload(payload, ctx);
    revalidatePath("/admin", "layout");
    return { safetyRun: safety.runId };
  });
}
