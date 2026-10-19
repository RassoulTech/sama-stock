"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatFCFA } from "@/lib/format";

export interface DayPoint {
  day: string;
  revenue: number;
  profit?: number;
}

const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function compact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  return String(value);
}

const tooltipValue = (value: unknown, name: unknown, item: { color?: string }, _i: number, payload: unknown) => (
  <div className="flex w-full items-center justify-between gap-4">
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
      {name === "revenue" ? "Chiffre d'affaires" : "Bénéfice"}
    </span>
    <span className="num font-semibold text-foreground">{formatFCFA(Number(value))}</span>
  </div>
);

/** Une seule série (CA des 7 derniers jours) : pas de légende, le titre de la carte la nomme. */
export function WeekRevenueBars({ data }: { data: DayPoint[] }) {
  const config = { revenue: { label: "Chiffre d'affaires", color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(d: string) => dayLabel.format(new Date(d))}
        />
        <YAxis width={40} tickLine={false} axisLine={false} tickFormatter={compact} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, payload) => longDay.format(new Date(String(payload?.[0]?.payload?.day)))}
              formatter={tooltipValue}
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ChartContainer>
  );
}

/** Deux mesures de même unité (FCFA) sur un seul axe : CA et bénéfice. */
export function RevenueProfitChart({ data }: { data: DayPoint[] }) {
  const config = {
    revenue: { label: "Chiffre d'affaires", color: "var(--chart-1)" },
    profit: { label: "Bénéfice", color: "var(--chart-2)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="fill-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(d: string) => shortDay.format(new Date(d))}
        />
        <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={compact} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => longDay.format(new Date(String(payload?.[0]?.payload?.day)))}
              formatter={tooltipValue}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          fill="url(#fill-revenue)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
        />
        <Area
          dataKey="profit"
          type="monotone"
          stroke="var(--color-profit)"
          strokeWidth={2}
          fill="none"
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
