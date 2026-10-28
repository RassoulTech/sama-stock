import type { Instrumentation } from "next";

/** Chaque panne du serveur (page, route, action) est enregistrée et l'administrateur est prévenu. */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerError } = await import("./server/services/app-errors");
  await reportServerError(error, request.path);
};
