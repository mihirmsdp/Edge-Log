import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode
    color?: string
  }
}

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  config,
  children,
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ReactElement
}) {
  const uniqueId = React.useId().replace(/:/g, "")
  const chartId = `chart-${id ?? uniqueId}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "h-full w-full [&_.recharts-cartesian-axis-tick_text]:fill-[var(--text-muted)] [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-layer]:outline-none [&_.recharts-reference-line_line]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(([, value]) => value.color)

  if (!colorEntries.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {${colorEntries
          .map(([key, value]) => `--color-${key}: ${value.color};`)
          .join("")}}`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
  labelFormatter,
  formatter,
}: {
  active?: boolean
  payload?: Array<any>
  label?: React.ReactNode
  className?: string
  hideLabel?: boolean
  labelFormatter?: (label: React.ReactNode) => React.ReactNode
  formatter?: (value: number | string, name: string, item: any) => React.ReactNode
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "min-w-[10rem] rounded-2xl border border-border bg-[color:var(--dashboard-tooltip)] px-3 py-2 text-sm text-primary shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
        className
      )}
    >
      {!hideLabel ? (
        <div className="mb-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          const key = item.dataKey ?? item.name ?? `item-${index}`
          const itemConfig = config[String(item.dataKey)] ?? config[String(item.name)]
          const indicatorColor = item.color ?? item.fill ?? itemConfig?.color ?? "var(--accent)"

          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: indicatorColor }} />
                <span style={{ color: "var(--text-muted)" }}>{itemConfig?.label ?? item.name}</span>
              </div>
              <span className="mono font-medium text-primary">
                {formatter ? formatter(item.value, item.name, item) : item.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
