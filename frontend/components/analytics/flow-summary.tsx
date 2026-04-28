"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SankeyNode, SankeyLink } from "@/components/analytics/sankey-diagram";

interface FlowSummaryProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  onNodeClick?: (node: SankeyNode) => void;
}

export default function FlowSummary({ nodes, links, onNodeClick }: FlowSummaryProps) {
  const layers = useMemo(() => {
    const layerMap = new Map<number, SankeyNode[]>();
    for (const node of nodes) {
      const existing = layerMap.get(node.layer) || [];
      existing.push(node);
      layerMap.set(node.layer, existing);
    }

    const sorted = [...layerMap.entries()].sort((a, b) => a[0] - b[0]);
    return sorted
      .filter(([, layerNodes]) => layerNodes.length > 1 || sorted.length <= 2)
      .map(([layer, layerNodes]) => ({
        layer,
        nodes: layerNodes.sort((a, b) => b.value - a.value),
        total: layerNodes.reduce((sum, n) => sum + n.value, 0),
      }));
  }, [nodes]);

  const layerLabels: Record<number, string> = useMemo(() => {
    if (layers.length === 0) return {};
    const labels: Record<number, string> = {};
    layers.forEach(({ layer }, idx) => {
      if (idx === 0 && layers.length > 2) labels[layer] = "Outcome";
      else if (idx === 0) labels[layer] = "Breakdown";
      else if (idx === 1 && layers.length > 2) labels[layer] = "Destination";
      else labels[layer] = idx === 0 ? "Outcome" : "Destination";
    });
    return labels;
  }, [layers]);

  const leafLayer = useMemo(() => {
    if (layers.length === 0) return -1;
    return layers[layers.length - 1].layer;
  }, [layers]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-[13px] text-neutral-400">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-3">
      {layers.map(({ layer, nodes: layerNodes, total }) => (
        <div key={layer}>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              {layerLabels[layer] || "Breakdown"}
            </span>
            <span className="text-[11px] text-neutral-400">{total} total</span>
          </div>

          <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
            {layerNodes.map((node) => (
              <div
                key={node.id}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${Math.max(2, (node.value / total) * 100)}%`,
                  backgroundColor: node.color,
                  opacity: 0.75,
                }}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {layerNodes.map((node) => {
              const isClickable = onNodeClick && layer === leafLayer;
              const pct = total > 0 ? Math.round((node.value / total) * 100) : 0;

              return (
                <button
                  key={node.id}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onNodeClick(node)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-left",
                    isClickable && "hover:bg-neutral-50 active:bg-neutral-100"
                  )}
                >
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: node.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-neutral-600">{node.label}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-neutral-900">
                    {node.value}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
