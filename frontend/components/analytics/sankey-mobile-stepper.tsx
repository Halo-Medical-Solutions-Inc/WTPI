"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SankeyNode, SankeyLink } from "@/components/analytics/sankey-diagram";

interface SankeyMobileStepperProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  onNodeClick?: (node: SankeyNode) => void;
  selectedNodeId?: string | null;
}

const NODE_WIDTH = 10;
const NODE_GAP = 10;
const MIN_NODE_HEIGHT = 4;
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 460;
const PADDING = { top: 20, bottom: 20, left: 120, right: 120 };

function computeLayout(
  nodes: SankeyNode[],
  links: SankeyLink[],
) {
  if (nodes.length === 0) return { positionedNodes: [], positionedLinks: [], layerXPositions: [] };

  const layers: Map<number, SankeyNode[]> = new Map();
  for (const node of nodes) {
    if (!layers.has(node.layer)) layers.set(node.layer, []);
    layers.get(node.layer)!.push(node);
  }

  const layerNumbers = Array.from(layers.keys()).sort((a, b) => a - b);
  const layerCount = layerNumbers.length;
  const drawWidth = CHART_WIDTH - PADDING.left - PADDING.right - NODE_WIDTH;

  const layerXMap: Map<number, number> = new Map();
  layerNumbers.forEach((layerNum, idx) => {
    const x = PADDING.left + (layerCount <= 1 ? 0 : (idx / (layerCount - 1)) * drawWidth);
    layerXMap.set(layerNum, x);
  });

  const maxNodeCount = Math.max(...layerNumbers.map((l) => layers.get(l)!.length));
  const maxGapsHeight = Math.max(0, maxNodeCount - 1) * NODE_GAP;
  const drawHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const availableNodeHeight = Math.max(50, drawHeight - maxGapsHeight);

  const layerTotals: Map<number, number> = new Map();
  for (const layerNum of layerNumbers) {
    const total = layers.get(layerNum)!.reduce((sum, n) => sum + n.value, 0);
    layerTotals.set(layerNum, total);
  }
  const maxTotal = Math.max(1, ...Array.from(layerTotals.values()));
  const scale = availableNodeHeight / maxTotal;

  const positionedNodes: { x: number; y: number; height: number; id: string; label: string; value: number; layer: number; color: string }[] = [];
  const nodeMap: Map<string, typeof positionedNodes[0]> = new Map();

  for (const layerNum of layerNumbers) {
    const layerNodes = [...layers.get(layerNum)!].sort((a, b) => b.value - a.value);
    const x = layerXMap.get(layerNum)!;
    const totalNodeHeight = layerNodes.reduce(
      (sum, n) => sum + Math.max(MIN_NODE_HEIGHT, n.value * scale), 0,
    );
    const totalGapHeight = Math.max(0, layerNodes.length - 1) * NODE_GAP;
    const layerTotalHeight = totalNodeHeight + totalGapHeight;
    const startY = PADDING.top + (drawHeight - layerTotalHeight) / 2;

    let currentY = startY;
    for (const node of layerNodes) {
      const height = Math.max(MIN_NODE_HEIGHT, node.value * scale);
      const positioned = { ...node, x, y: currentY, height };
      positionedNodes.push(positioned);
      nodeMap.set(node.id, positioned);
      currentY += height + NODE_GAP;
    }
  }

  const sortedLinks = [...links].sort((a, b) => {
    const sA = nodeMap.get(a.source);
    const sB = nodeMap.get(b.source);
    if (!sA || !sB) return 0;
    if (sA.y !== sB.y) return sA.y - sB.y;
    const tA = nodeMap.get(a.target);
    const tB = nodeMap.get(b.target);
    if (!tA || !tB) return 0;
    return tA.y - tB.y;
  });

  const sourceOffsets: Map<string, number> = new Map();
  const targetOffsets: Map<string, number> = new Map();
  const positionedLinks: { sourceNode: typeof positionedNodes[0]; targetNode: typeof positionedNodes[0]; value: number; linkHeight: number; targetLinkHeight: number; path: string; color: string }[] = [];

  for (const link of sortedLinks) {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    if (!source || !target || link.value <= 0) continue;

    const sourceOffset = sourceOffsets.get(link.source) || 0;
    const targetOffset = targetOffsets.get(link.target) || 0;
    const linkHeight = Math.max(1, (link.value / Math.max(1, source.value)) * source.height);
    const targetLinkHeight = Math.max(1, (link.value / Math.max(1, target.value)) * target.height);

    const sy = source.y + sourceOffset;
    const ty = target.y + targetOffset;
    const sx = source.x + NODE_WIDTH;
    const tx = target.x;
    const midX = sx + (tx - sx) * 0.3;

    const path = [
      `M ${sx} ${sy}`,
      `C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`,
      `L ${tx} ${ty + targetLinkHeight}`,
      `C ${midX} ${ty + targetLinkHeight}, ${midX} ${sy + linkHeight}, ${sx} ${sy + linkHeight}`,
      "Z",
    ].join(" ");

    positionedLinks.push({
      sourceNode: source, targetNode: target, value: link.value,
      linkHeight, targetLinkHeight, path, color: source.color,
    });

    sourceOffsets.set(link.source, sourceOffset + linkHeight);
    targetOffsets.set(link.target, targetOffset + targetLinkHeight);
  }

  const layerXPositions = layerNumbers.map((l) => layerXMap.get(l)!);

  return { positionedNodes, positionedLinks, layerXPositions };
}

export default function SankeyMobileStepper({
  nodes,
  links,
  onNodeClick,
  selectedNodeId = null,
}: SankeyMobileStepperProps) {
  const [step, setStep] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const swiping = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { positionedNodes, positionedLinks, layerXPositions } = useMemo(
    () => computeLayout(nodes, links),
    [nodes, links],
  );

  const layerNumbers = useMemo(() => {
    const s = new Set(nodes.map((n) => n.layer));
    return Array.from(s).sort((a, b) => a - b);
  }, [nodes]);

  const totalSteps = Math.max(1, layerNumbers.length - 1);

  useEffect(() => {
    if (!selectedNodeId || layerNumbers.length < 2) return;
    const selectedNode = positionedNodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode) return;
    const layerIdx = layerNumbers.indexOf(selectedNode.layer);
    if (layerIdx === -1) return;
    const targetStep = Math.max(0, Math.min(totalSteps - 1, layerIdx > 0 ? layerIdx - 1 : 0));
    setStep(targetStep);
  }, [selectedNodeId, layerNumbers, positionedNodes, totalSteps]);

  const stepLabels = useMemo(() => {
    if (layerNumbers.length <= 1) return ["Overview"];
    const labels: string[] = [];
    for (let i = 0; i < layerNumbers.length - 1; i++) {
      const leftNodes = positionedNodes.filter((n) => n.layer === layerNumbers[i]);
      const rightNodes = positionedNodes.filter((n) => n.layer === layerNumbers[i + 1]);
      const leftLabel = leftNodes.length === 1 ? leftNodes[0].label : `${leftNodes.length} categories`;
      const rightLabel = `${rightNodes.length} destinations`;
      if (i === 0) labels.push(`${leftLabel} → Outcomes`);
      else labels.push(`Outcomes → ${rightLabel}`);
    }
    return labels;
  }, [layerNumbers, positionedNodes]);

  const viewBox = useMemo(() => {
    if (layerXPositions.length < 2) return `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;

    const leftX = layerXPositions[step];
    const rightX = layerXPositions[step + 1] || layerXPositions[layerXPositions.length - 1];

    const viewLeft = Math.max(0, leftX - PADDING.left);
    const viewRight = Math.min(CHART_WIDTH, rightX + NODE_WIDTH + PADDING.right);
    const viewWidth = viewRight - viewLeft;

    return `${viewLeft} 0 ${viewWidth} ${CHART_HEIGHT}`;
  }, [step, layerXPositions]);

  const sourceNodeIds = useMemo(() => new Set(links.map((l) => l.source)), [links]);
  const isLeafNode = useCallback((nodeId: string) => !sourceNodeIds.has(nodeId), [sourceNodeIds]);

  const visibleLayers = useMemo(() => {
    if (layerNumbers.length < 2) return new Set(layerNumbers);
    return new Set([layerNumbers[step], layerNumbers[step + 1]]);
  }, [step, layerNumbers]);

  function handlePrev(): void {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleNext(): void {
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-[13px] text-neutral-400">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={handlePrev}
          disabled={step === 0}
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[12px] font-medium text-neutral-500">
          {stepLabels[step]}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={step >= totalSteps - 1}
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-md"
        style={{ height: CHART_HEIGHT, touchAction: "pan-y" }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
          touchDeltaX.current = 0;
          swiping.current = false;
        }}
        onTouchMove={(e) => {
          if (touchStartX.current === null || touchStartY.current === null) return;
          const dx = touchStartX.current - e.touches[0].clientX;
          const dy = touchStartY.current - e.touches[0].clientY;
          touchDeltaX.current = dx;
          if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            swiping.current = true;
          }
          if (swiping.current) {
            e.preventDefault();
          }
        }}
        onTouchEnd={() => {
          if (swiping.current && Math.abs(touchDeltaX.current) > 40) {
            if (touchDeltaX.current > 0) handleNext();
            else handlePrev();
          }
          touchStartX.current = null;
          touchStartY.current = null;
          touchDeltaX.current = 0;
          swiping.current = false;
        }}
      >
        <svg
          viewBox={viewBox}
          className="w-full h-full cursor-default transition-all duration-300 ease-in-out"
          preserveAspectRatio="xMidYMid meet"
        >
          {positionedLinks.map((link, i) => {
            const visible =
              visibleLayers.has(link.sourceNode.layer) && visibleLayers.has(link.targetNode.layer);
            if (!visible) return null;

            const isHighlighted = selectedNodeId
              ? link.sourceNode.id === selectedNodeId || link.targetNode.id === selectedNodeId
              : false;

            return (
              <g key={`link-${i}`}>
                <path
                  d={link.path}
                  fill={link.color}
                  fillOpacity={selectedNodeId ? (isHighlighted ? 0.4 : 0.04) : 0.18}
                  stroke="none"
                  style={{ transition: "fill-opacity 150ms" }}
                />
              </g>
            );
          })}

          {positionedNodes.map((node) => {
            if (!visibleLayers.has(node.layer)) return null;

            const minLayer = Math.min(...visibleLayers);
            const isLeft = node.layer === minLayer;
            const labelX = isLeft ? node.x - 6 : node.x + NODE_WIDTH + 6;
            const anchor = isLeft ? "end" : "start";
            const isLeaf = isLeafNode(node.id);
            const canDrillDown = onNodeClick && isLeaf;
            const canNavigateForward = !isLeaf && !isLeft && step < totalSteps - 1;

            const isSelected = node.id === selectedNodeId;
            const isConnected = selectedNodeId
              ? positionedLinks.some(
                  (l) =>
                    (l.sourceNode.id === selectedNodeId && l.targetNode.id === node.id) ||
                    (l.targetNode.id === selectedNodeId && l.sourceNode.id === node.id)
                )
              : false;
            const shouldHighlight = isSelected || isConnected;

            return (
              <g
                key={node.id}
                onClick={() => {
                  if (canDrillDown) onNodeClick(node);
                  else if (canNavigateForward) handleNext();
                }}
                className={canDrillDown || canNavigateForward ? "cursor-pointer" : "cursor-default"}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={node.height}
                  fill={node.color}
                  fillOpacity={selectedNodeId ? (shouldHighlight ? 0.9 : 0.15) : 0.7}
                  rx={1}
                  style={{ transition: "fill-opacity 150ms" }}
                />
                <text
                  x={labelX}
                  y={node.y + node.height / 2}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="fill-neutral-600 select-none"
                  style={{
                    fontSize: "13px",
                    fontWeight: selectedNodeId ? (shouldHighlight ? 600 : 400) : 500,
                    transition: "font-weight 150ms",
                  }}
                >
                  {node.label} · {node.value.toLocaleString()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {totalSteps > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-4 bg-neutral-900" : "w-1.5 bg-neutral-300"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
