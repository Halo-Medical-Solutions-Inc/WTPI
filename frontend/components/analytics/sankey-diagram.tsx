"use client";

import { useEffect, useMemo, useState } from "react";

export interface SankeyNode {
  id: string;
  label: string;
  value: number;
  layer: number;
  color: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface PositionedNode extends SankeyNode {
  x: number;
  y: number;
  height: number;
}

interface PositionedLink {
  sourceNode: PositionedNode;
  targetNode: PositionedNode;
  value: number;
  sourceY: number;
  targetY: number;
  linkHeight: number;
  targetLinkHeight: number;
  path: string;
  color: string;
}

const NODE_WIDTH = 10;
const NODE_GAP = 10;
const MIN_NODE_HEIGHT = 4;
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 560;
const PADDING = { top: 20, bottom: 20, left: 120, right: 120 };

function computeLayout(
  nodes: SankeyNode[],
  links: SankeyLink[],
): { positionedNodes: PositionedNode[]; positionedLinks: PositionedLink[] } {
  if (nodes.length === 0) {
    return { positionedNodes: [], positionedLinks: [] };
  }

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

  const positionedNodes: PositionedNode[] = [];
  const nodeMap: Map<string, PositionedNode> = new Map();

  for (const layerNum of layerNumbers) {
    const layerNodes = [...layers.get(layerNum)!];
    layerNodes.sort((a, b) => b.value - a.value);

    const x = layerXMap.get(layerNum)!;
    const totalNodeHeight = layerNodes.reduce(
      (sum, n) => sum + Math.max(MIN_NODE_HEIGHT, n.value * scale),
      0,
    );
    const totalGapHeight = Math.max(0, layerNodes.length - 1) * NODE_GAP;
    const layerTotalHeight = totalNodeHeight + totalGapHeight;
    const startY = PADDING.top + (drawHeight - layerTotalHeight) / 2;

    let currentY = startY;
    for (const node of layerNodes) {
      const height = Math.max(MIN_NODE_HEIGHT, node.value * scale);
      const positioned: PositionedNode = { ...node, x, y: currentY, height };
      positionedNodes.push(positioned);
      nodeMap.set(node.id, positioned);
      currentY += height + NODE_GAP;
    }
  }

  const sortedLinks = [...links].sort((a, b) => {
    const sourceA = nodeMap.get(a.source);
    const sourceB = nodeMap.get(b.source);
    if (!sourceA || !sourceB) return 0;
    if (sourceA.y !== sourceB.y) return sourceA.y - sourceB.y;
    const targetA = nodeMap.get(a.target);
    const targetB = nodeMap.get(b.target);
    if (!targetA || !targetB) return 0;
    return targetA.y - targetB.y;
  });

  const sourceOffsets: Map<string, number> = new Map();
  const targetOffsets: Map<string, number> = new Map();
  const positionedLinks: PositionedLink[] = [];

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
      sourceY: sy, targetY: ty, linkHeight, targetLinkHeight, path,
      color: source.color,
    });

    sourceOffsets.set(link.source, sourceOffset + linkHeight);
    targetOffsets.set(link.target, targetOffset + targetLinkHeight);
  }

  return { positionedNodes, positionedLinks };
}

export function SankeyDiagram({
  nodes,
  links,
  onNodeClick,
  selectedNodeId,
}: {
  nodes: SankeyNode[];
  links: SankeyLink[];
  onNodeClick?: (node: SankeyNode) => void;
  selectedNodeId?: string | null;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  useEffect(() => {
    setInternalSelected(null);
  }, [nodes, links]);

  const selectedNode = selectedNodeId ?? internalSelected;

  const { positionedNodes, positionedLinks } = useMemo(
    () => computeLayout(nodes, links),
    [nodes, links],
  );

  const layerNumbers = useMemo(() => {
    const layerSet = new Set(nodes.map((n) => n.layer));
    return Array.from(layerSet).sort((a, b) => a - b);
  }, [nodes]);

  const minLayer = layerNumbers.length > 0 ? layerNumbers[0] : 0;
  const isAnyHighlighted = hoveredNode !== null || selectedNode !== null;

  const sourceNodeIds = useMemo(() => new Set(links.map((l) => l.source)), [links]);
  const isLeafNode = (nodeId: string) => !sourceNodeIds.has(nodeId);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-[13px] text-neutral-400">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <div style={{ minWidth: 700, height: CHART_HEIGHT }}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-full cursor-default"
        preserveAspectRatio="xMidYMid meet"
        onClick={() => setInternalSelected(null)}
      >
        {positionedLinks.map((link, i) => {
          const isHighlightedByHover =
            hoveredNode === link.sourceNode.id || hoveredNode === link.targetNode.id;
          const isHighlightedBySelection =
            selectedNode === link.sourceNode.id || selectedNode === link.targetNode.id;
          const isHighlighted = hoveredNode
            ? isHighlightedByHover
            : isHighlightedBySelection;

          return (
            <g
              key={`link-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                setInternalSelected(link.targetNode.id);
                if (onNodeClick && isLeafNode(link.targetNode.id)) {
                  onNodeClick(link.targetNode);
                }
              }}
              onMouseEnter={() => setHoveredNode(link.targetNode.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <path
                d={link.path}
                fill={link.color}
                fillOpacity={isAnyHighlighted ? (isHighlighted ? 0.4 : 0.04) : 0.18}
                stroke="none"
                style={{ transition: "fill-opacity 150ms" }}
              />
              <path
                d={link.path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
              />
            </g>
          );
        })}

        {positionedNodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          const isSelected = selectedNode === node.id;
          const connectedToSelected = positionedLinks.some(
            (l) =>
              (l.sourceNode.id === selectedNode && l.targetNode.id === node.id) ||
              (l.targetNode.id === selectedNode && l.sourceNode.id === node.id),
          );
          const shouldHighlight =
            hoveredNode
              ? isHovered
              : isSelected || connectedToSelected;

          const isLeft = node.layer === minLayer;
          const labelX = isLeft ? node.x - 6 : node.x + NODE_WIDTH + 6;
          const anchor = isLeft ? "end" : "start";

          const isClickable = onNodeClick && isLeafNode(node.id);

          const hitPadding = 6;
          const labelExtend = 60;
          const hitX = isLeft ? node.x - labelExtend - hitPadding : node.x - hitPadding;
          const hitWidth = NODE_WIDTH + labelExtend + hitPadding * 2;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => {
                e.stopPropagation();
                setInternalSelected(node.id);
                if (isClickable) onNodeClick(node);
              }}
              className="cursor-pointer"
            >
              <rect
                x={Math.max(0, hitX)}
                y={node.y - hitPadding}
                width={hitWidth}
                height={node.height + hitPadding * 2}
                fill="transparent"
              />
              <rect
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={node.height}
                fill={node.color}
                fillOpacity={isAnyHighlighted ? (shouldHighlight ? 0.9 : 0.15) : 0.7}
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
                  fontSize: "12px",
                  fontWeight: shouldHighlight ? 600 : 400,
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
    </div>
  );
}
