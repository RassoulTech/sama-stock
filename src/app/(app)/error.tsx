"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

/** Le menu de l'application reste affiché autour du message. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} homeHref="/tableau-de-bord" />;
}
