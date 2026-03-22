"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { agentAccent, agentInitial, agentDisplayName } from "@/lib/agent-colors";
import { Crown, Package, Cpu, GitBranch } from "lucide-react";

interface AgentConfig {
  id: string;
  name?: string;
  default?: boolean;
  model?: string;
  skills?: string[];
  identity?: { name?: string; theme?: string; emoji?: string };
  subagents?: { allowAgents?: string[] };
}

interface AgentData {
  id: string;
  agentId: string;
  status: string | null;
  sessionCount: number;
}

interface TreeNode {
  agent: AgentConfig;
  runtime: AgentData | null;
  children: TreeNode[];
  x: number;
  y: number;
}

const NODE_W = 200;
const NODE_H = 86;
const GAP_X  = 32;
const GAP_Y  = 72;

function modelShort(model?: string | null): string {
  if (!model) return "—";
  return model.split("/").pop() ?? model;
}

// Count leaf nodes in a subtree
function countLeaves(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

// Assign x/y positions. leafIndex = which leaf slot (0,1,2…) this subtree starts at.
function assignPositions(node: TreeNode, leafIndex: number, depth: number): void {
  node.y = depth * (NODE_H + GAP_Y);
  if (node.children.length === 0) {
    node.x = leafIndex * (NODE_W + GAP_X);
    return;
  }
  let cursor = leafIndex;
  for (const child of node.children) {
    assignPositions(child, cursor, depth + 1);
    cursor += countLeaves(child);
  }
  // Center parent above its children
  const first = node.children[0];
  const last  = node.children[node.children.length - 1];
  node.x = (first.x + last.x) / 2;
}

// Flatten tree to list
function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(n: TreeNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

// Collect parent→child edges
function collectEdges(nodes: TreeNode[]): Array<{ parent: TreeNode; child: TreeNode }> {
  const edges: Array<{ parent: TreeNode; child: TreeNode }> = [];
  function walk(n: TreeNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

// Build tree with cycle protection
function buildTree(configs: AgentConfig[], runtimeAgents: AgentData[]): TreeNode[] {
  // IDs that appear as children of some other agent
  const referenced = new Set<string>();
  for (const a of configs) {
    for (const sub of a.subagents?.allowAgents ?? []) {
      referenced.add(sub);
    }
  }

  // Roots: agents not referenced by anyone else
  let roots = configs.filter((a) => !referenced.has(a.id));
  // Fallback: if everything is referenced (cycle), use default agent or first
  if (roots.length === 0) {
    const def = configs.find((a) => a.default);
    roots = def ? [def] : configs.slice(0, 1);
  }

  const runtimeMap = new Map(runtimeAgents.map((r) => [r.agentId, r]));
  const configMap  = new Map(configs.map((c) => [c.id, c]));

  // Build node recursively — visited set prevents infinite loops
  function makeNode(cfg: AgentConfig, visited: Set<string>): TreeNode {
    const childIds = cfg.subagents?.allowAgents ?? [];
    const children: TreeNode[] = [];
    for (const id of childIds) {
      if (visited.has(id)) continue; // skip circular refs
      const childCfg = configMap.get(id);
      if (!childCfg) continue;
      const nextVisited = new Set(visited);
      nextVisited.add(id);
      children.push(makeNode(childCfg, nextVisited));
    }
    return {
      agent:   cfg,
      runtime: runtimeMap.get(cfg.id) ?? null,
      children,
      x: 0,
      y: 0,
    };
  }

  return roots.map((r) => makeNode(r, new Set([r.id])));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrchestrationGraph({
  configs,
  runtimeAgents,
  onSelectAgent,
}: {
  configs: AgentConfig[];
  runtimeAgents: AgentData[];
  onSelectAgent?: (id: string) => void;
}) {
  const { allNodes, edges, svgW, svgH } = useMemo(() => {
    if (configs.length === 0) {
      return { allNodes: [], edges: [], svgW: 400, svgH: 200 };
    }

    const roots = buildTree(configs, runtimeAgents);

    // Assign positions for each root subtree, offset sequentially by leaf count
    let leafCursor = 0;
    for (const root of roots) {
      assignPositions(root, leafCursor, 0);
      leafCursor += countLeaves(root);
    }

    const allNodes = flattenTree(roots);
    const edges    = collectEdges(roots);

    const maxX = allNodes.length > 0 ? Math.max(...allNodes.map((n) => n.x)) + NODE_W : NODE_W;
    const maxY = allNodes.length > 0 ? Math.max(...allNodes.map((n) => n.y)) + NODE_H : NODE_H;

    return {
      allNodes,
      edges,
      svgW: Math.max(maxX, 400),
      svgH: Math.max(maxY, 200),
    };
  }, [configs, runtimeAgents]);

  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-zinc-600">
        No agents configured.
      </div>
    );
  }

  const PAD = 20; // padding around the graph

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="relative inline-block"
        style={{ width: svgW + PAD * 2, minWidth: "100%", height: svgH + PAD * 2 }}
      >
        {/* SVG lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgW + PAD * 2}
          height={svgH + PAD * 2}
        >
          {edges.map(({ parent, child }, i) => {
            const x1 = parent.x + NODE_W / 2 + PAD;
            const y1 = parent.y + NODE_H + PAD;
            const x2 = child.x  + NODE_W / 2 + PAD;
            const y2 = child.y  + PAD;
            const cy = (y1 + y2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`}
                fill="none"
                stroke="#3f3f46"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>

        {/* Node cards */}
        {allNodes.map((node) => {
          const cfg    = node.agent;
          const accent = agentAccent(cfg.id);
          const isRoot = node.y === 0;
          const skills = cfg.skills?.length ?? 0;
          const subCount = cfg.subagents?.allowAgents?.length ?? 0;

          return (
            <div
              key={cfg.id}
              className={cn(
                "absolute bg-zinc-900 border rounded-xl overflow-hidden cursor-pointer",
                "transition-all hover:border-zinc-500 hover:shadow-lg hover:shadow-black/40",
                isRoot ? "border-zinc-600" : "border-zinc-800",
              )}
              style={{ left: node.x + PAD, top: node.y + PAD, width: NODE_W }}
              onClick={() => onSelectAgent?.(cfg.id)}
            >
              {/* Accent strip */}
              <div className={cn("h-0.5 w-full", accent.avatar)} />

              <div className="px-3 py-2.5 space-y-1.5">
                {/* Name + crown */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0",
                    accent.avatar
                  )}>
                    {cfg.identity?.emoji ?? agentInitial(cfg.id)}
                  </span>
                  <span className={cn("text-xs font-semibold truncate flex-1", accent.text)}>
                    {cfg.name ?? agentDisplayName(cfg.id)}
                  </span>
                  {cfg.default && (
                    <Crown className={cn("w-3 h-3 shrink-0", accent.text)} />
                  )}
                </div>

                {/* Model + skills count */}
                <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                  <Cpu className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1 font-mono">{modelShort(cfg.model)}</span>
                  {skills > 0 && (
                    <span className="flex items-center gap-0.5 shrink-0 text-zinc-600">
                      <Package className="w-3 h-3" />
                      {skills}
                    </span>
                  )}
                </div>

                {/* Sub-agent count */}
                {subCount > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-zinc-700">
                    <GitBranch className="w-3 h-3" />
                    <span>{subCount} sub-agent{subCount !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
