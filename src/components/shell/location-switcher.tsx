"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { switchLocation } from "@/server/actions/business";

export function LocationSwitcher({
  locations,
  currentId,
}: {
  locations: { id: string; name: string }[];
  currentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (locations.length < 2) return null;

  return (
    <Select
      value={currentId}
      disabled={pending}
      onValueChange={(id) =>
        startTransition(async () => {
          const res = await switchLocation(id);
          if (!res.ok) toast.error(res.error);
          router.refresh();
        })
      }
    >
      <SelectTrigger size="sm" className="max-w-[11rem] gap-2 bg-card" aria-label="Boutique active">
        <MapPin className="size-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
