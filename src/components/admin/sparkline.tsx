"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/**
 * Sparkline — a tiny inline trend line with no axes, labels, or tooltip (a
 * true sparkline), meant to be embedded inside a `MetricTile` or a
 * `DataTable`/product-list cell for an at-a-glance trend, per docs/09-
 * ADMIN-DAD-MODE.md §4's framing that charts are a secondary elaboration,
 * never the primary way a number is explained — a sparkline here is the
 * smallest, quietest form that framing can take.
 *
 * Built on Recharts v3.10.1's `LineChart`/`Line` (this repo installed a
 * newer major than docs/03-TECHNOLOGY-STACK.md's Recharts mention
 * anticipated; the props used below were confirmed against the installed
 * v3 `.d.ts` files, not assumed from v2-era docs). No `XAxis`, `YAxis`,
 * `Tooltip`, or `CartesianGrid` are rendered at all.
 *
 * `ResponsiveContainer` wants percentage dimensions from its parent rather
 * than fighting a fixed pixel size directly, so the standard pattern is
 * used here: a plain `div` sized to the requested `width`/`height` in
 * pixels, with a 100%-sized `ResponsiveContainer` inside it.
 *
 * The line is stroked with the `--primary-container` hex pulled directly
 * from `src/app/globals.css` (`#00d1ff`) since Recharts' SVG `stroke` prop
 * needs a real colour string, not a Tailwind class. `strokeWidth={1.5}`
 * keeps the line thin enough to read as a sparkline rather than a chart.
 */
export interface SparklineProps {
  data: number[];
  className?: string;
  height?: number;
  width?: number;
}

const PRIMARY_CONTAINER_HEX = "#00d1ff";

export function Sparkline({ data, className, height = 32, width = 96 }: SparklineProps) {
  const points = data.map((value, index) => ({ index, value }));

  return (
    <div className={cn(className)} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            dataKey="value"
            stroke={PRIMARY_CONTAINER_HEX}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
