"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ProductThumb } from "@/components/products/product-thumb";
import { normalizeSearch } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatFCFA, formatQty } from "@/lib/format";

export interface PickerProduct {
  id: string;
  name: string;
  reference?: string | null;
  unit: string;
  available: number;
  salePrice: number;
  costPrice: number | null;
  imageUrl: string | null;
}

export function ProductPicker({
  products,
  onSelect,
  excludeIds = [],
  label = "Ajouter un produit",
  showPrice = "sale",
  className,
}: {
  products: PickerProduct[];
  onSelect: (product: PickerProduct) => void;
  excludeIds?: string[];
  label?: string;
  showPrice?: "sale" | "cost" | "none";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const choices = products.filter((p) => !excludeIds.includes(p.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={className ?? "w-full border-dashed"}>
          <Plus /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,26rem)] p-0" align="start">
        <Command
          filter={(value, search) => (normalizeSearch(value).includes(normalizeSearch(search)) ? 1 : 0)}
        >
          <CommandInput placeholder="Nom ou référence…" className="h-11" />
          <CommandList className="max-h-72">
            <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
            {choices.map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.name} ${p.reference ?? ""} ${p.id}`}
                onSelect={() => {
                  onSelect(p);
                  setOpen(false);
                }}
                className="gap-3 py-2"
              >
                <ProductThumb name={p.name} imageUrl={p.imageUrl} className="size-9 rounded-lg text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="num text-xs text-muted-foreground">
                    Dispo : {formatQty(p.available, p.unit)}
                  </span>
                </span>
                {showPrice !== "none" && (
                  <span className="num text-xs font-semibold">
                    {formatFCFA(showPrice === "cost" ? (p.costPrice ?? 0) : p.salePrice)}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
