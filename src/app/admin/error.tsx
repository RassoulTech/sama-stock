"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} homeHref="/admin" />;
}
