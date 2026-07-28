"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * BarChart — docs/09-ADMIN-DAD-MODE.md §4 Row 5: "Revenue over 30 days ·
 * orders by day of week · sales by category. Optional, collapsible,
 * remembered per user." This is a supplementary visual, never the primary
 * way the dashboard conveys anything — §4's own framing is explicit:
 * "Charts do not answer a shop owner's questions. The dashboard answers
 * them in words and numbers, and charts come further down." Callers should
 * always pair this with the actual number/sentence answer (a `MetricTile`,
 * a plain total) and treat this component as an optional collapsible
 * elaboration underneath it, not a replacement for it.
 *
 * A thin, styled wrapper around Recharts (v3.10.1 — this repo installed a
 * newer major than docs/03-TECHNOLOGY-STACK.md's Recharts mention
 * anticipated; the `data`/`dataKey`/`XAxis`/`YAxis`/`Tooltip`/
 * `ResponsiveContainer` props used below were confirmed against the
 * installed v3 `.d.ts` files rather than assumed from v2-era docs).
 * Recharts' own `BarChart` is imported aliased as `RechartsBarChart` to
 * avoid colliding with this file's own exported `BarChart`.
 *
 * Colours are read as literal hex strings pulled from `src/app/globals.css`
 * `:root` (Recharts' SVG `fill`/`stroke` props need real colour values, not
 * Tailwind classes): `--primary-container: #00d1ff` for the bar fill,
 * `--on-surface-variant: #bbc9cf` for axis/tick text, `--outline-variant:
 * #3c494e` for the (subtle) grid line, and `--surface-container-high:
 * #2a2a2c` / `--glass-stroke: rgba(255, 255, 255, 0.1)` for the tooltip
 * surface, so the tooltip matches this design system's panels instead of
 * Recharts' default white box.
 */
export interface BarChartProps {
  data: { label: string; value: number }[];
  valueFormatter?: (value: number) => string;
  className?: string;
  height?: number;
}

const PRIMARY_CONTAINER_HEX = "#00d1ff";
const ON_SURFACE_VARIANT_HEX = "#bbc9cf";
const OUTLINE_VARIANT_HEX = "#3c494e";
const SURFACE_CONTAINER_HIGH_HEX = "#2a2a2c";
const GLASS_STROKE = "rgba(255, 255, 255, 0.1)";

const axisTick = { fill: ON_SURFACE_VARIANT_HEX, fontSize: 12 };

export function BarChart({ data, valueFormatter, className, height = 240 }: BarChartProps) {
  return (
    <div className={cn(className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={OUTLINE_VARIANT_HEX} strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            axisLine={{ stroke: OUTLINE_VARIANT_HEX }}
            tickLine={false}
          />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={valueFormatter ? 64 : 32}
            tickFormatter={valueFormatter}
          />
          <Tooltip
            formatter={(value) =>
              typeof value === "number" && valueFormatter ? valueFormatter(value) : value
            }
            contentStyle={{
              backgroundColor: SURFACE_CONTAINER_HIGH_HEX,
              border: `1px solid ${GLASS_STROKE}`,
              borderRadius: 8,
            }}
            labelStyle={{ color: ON_SURFACE_VARIANT_HEX }}
            itemStyle={{ color: ON_SURFACE_VARIANT_HEX }}
            cursor={{ fill: OUTLINE_VARIANT_HEX, fillOpacity: 0.2 }}
          />
          <Bar dataKey="value" fill={PRIMARY_CONTAINER_HEX} radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
