"use client";

import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { normalizeSearch } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CustomerDialog, type CustomerOption } from "./customer-dialog";

export function CustomerCombobox({
  customers,
  value,
  onChange,
  onCreated,
  invalid,
}: {
  customers: CustomerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreated: (c: CustomerOption) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const selected = customers.find((c) => c.id === value);

  return (
    <>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={invalid || undefined}
              className={cn("flex-1 justify-between font-medium", !selected && "text-muted-foreground")}
            >
              <span className="truncate">
                {selected ? `${selected.name}${selected.phone ? ` · ${formatPhone(selected.phone)}` : ""}` : "Choisir un client…"}
              </span>
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(92vw,24rem)] p-0" align="start">
            <Command filter={(v, s) => (normalizeSearch(v).includes(normalizeSearch(s)) ? 1 : 0)}>
              <CommandInput placeholder="Nom ou téléphone…" className="h-11" />
              <CommandList className="max-h-64">
                <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__new__ nouveau client"
                    onSelect={() => {
                      setOpen(false);
                      setCreating(true);
                    }}
                    className="font-semibold text-primary"
                  >
                    <UserPlus /> Nouveau client
                  </CommandItem>
                  {customers.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.phone ?? ""} ${c.id}`}
                      onSelect={() => {
                        onChange(c.id);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{c.name}</span>
                        {c.phone && <span className="text-xs text-muted-foreground">{formatPhone(c.phone)}</span>}
                      </span>
                      {value === c.id && <Check />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selected && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Retirer le client">
            <X />
          </Button>
        )}
      </div>
      <CustomerDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(c) => {
          onCreated(c);
          onChange(c.id);
        }}
      />
    </>
  );
}
