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

function buildTree(configs: AgentConfig[], runtimeAgents: AgentData[]): TreeNode[] {
  // Which agent IDs appear as sub-agents of another agent
  const referenced = new Set<string>();
  for (const a of configs) {
    for (const sub of a.subagents?.allowAgents ?? []) {
      referenced.add(sub);
    }
  }

  // Roots: not referenced as a sub-agent by anyone
  const roots = configs.filter((a) => !referenced.has(a.id));
  // If somehow no roots (circular?), fall back to default agent or all
  const effectiveRoots = roots.length > 0 ? roots : configs.filter((a) => a.default) || configs.slice(0, 1);

  const runtimeMap = new Map(runtimeAgents.map((r) => [r.agentId, r]));

  function makeNode(cfg: AgentConfig): TreeNode {
    const childIds = cfg.subagents?.allowAgents ?? [];
    const children = childIds
      .map((id) => configs.find((c) => c.id === id))
      .filter((c): c is AgentConfig => !!c)
      .map(makeNode);
    return { agent: cfg, runtime: runtimeMap.get(cfg.id) ?? null, children, x: 0, y: 0 };
  }

  return effectiveRoots.map(makeNode);
}

// Compute x positions using leaf-counting approach
function assignPositions(nodes: TreeNode[], startLeaf = 0): number {
  let leafCounter = startLeaf;
  for (const node of nodes) {
    node.y = 0; // will be set by depth
    if (node.children.length === 0) {
      node.x = leafCounter * (NODE_W + GAP_X);
      leafCounter++;
    } else {
      const before = leafCounter;
      leafCounter = assignChildPositions(node, leafCounter, 1);
      // center parent over its children
      const firstChild = node.children[0];
      const lastChild  = node.children[node.children.length - 1];
      node.x = (firstChild.x + lastChild.x) / 2;
    }
  }
  return leafCounter;
}

function assignChildPositions(node: TreeNode, leafCounter: number, depth: number): number {
  for (const child of node.children) {
    child.y = depth * (NODE_H + GAP_Y);
    if (child.children.length === 0) {
      child.x = leafCounter * (NODE_W + GAP_X);
      leafCounter++;
    } else {
      leafCounter = assignChildPositions(child, leafCounter, depth + 1);
      const first = child.children[0];
      const last  = child.children[child.children.length - 1];
      child.x = (first.x + last.x) / 2;
    }
  }
  return leafCounter;
}

// Flatten tree to a list of all nodes
function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(n: TreeNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

// Collect all edges (parent → child) for SVG lines
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

function modelShort(model?: string | null): string {
  if (!model) return "—";
  return model.split("/").pop() ?? model;
}

export function OrchestrationGraph({
  configs,
  runtimeAgents,
  onSelectAgent,
}: {
  configs: AgentConfig[];
  runtimeAgents: AgentData[];
  onSelectAgent?: (id: string) => void;
}) {
  const { roots, allNodes, edges, totalW, totalH } = useMemo(() => {
    if (configs.length === 0) return { roots: [], allNodes: [], edges: [], totalW: 0, totalH: 0 };

    const roots = buildTree(configs, runtimeAgents);

    // Assign root Y positions
    roots.forEach((r) => { r.y = 0; });

    // Offset multiple roots horizontally
    let offset = 0;
    for (const root of roots) {
      // temporarily assign positions starting from offset
      const subtreeLeaves = countLeaves(root);
      assignSubtree(root, offset, 0);
      offset += subtreeLeaves * (NODE_W + GAP_X);
    }

    const allNodes = flattenTree(roots);
    const edges    = collectEdges(roots);

    const maxX = Math.max(...allNodes.map((n) => n.x)) + NODE_W;
    const maxY = Math.max(...allNodes.map((n) => n.y)) + NODE_H;

    return { roots, allNodes, edges, totalW: maxX, totalH: maxY };
  }, [configs, runtimeAgents]);

  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-zinc-600">
        No agents configured.
      </div>
    );
  }

  const svgW = Math.max(totalW, 400);
  const svgH = Math.max(totalH, 200);

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative inline-block" style={{ width: svgW + 40, minWidth: "100%" }}>
        {/* SVG overlay for connection lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgW + 40}
          height={svgH + 40}
          style={{ zIndex: 0 }}
        >
          {edges.map(({ parent, child }, i) => {
            const x1 = parent.x + NODE_W / 2 + 20;
            const y1 = parent.y + NODE_H + 20;
            const x2 = child.x  + NODE_W / 2 + 20;
            const y2 = child.y  + 20;
            const my = (y1 + y2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`}
                fill="none"
                stroke="#3f3f46"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>

        {/* Node cards */}
        <div className="relative" style={{ height: svgH + 40 }}>
          {allNodes.map((node) => {
            const cfg     = node.agent;
            const accent  = agentAccent(cfg.id);
            const isRoot  = node.y === 0;
            const skills  = cfg.skills?.length ?? 0;

            return (
              <div
                key={cfg.id}
                className={cn(
                  "absolute bg-zinc-900 border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-black/30 group",
                  isRoot ? "border-zinc-600" : "border-zinc-800",
                )}
                style={{
                  left: node.x + 20,
                  top:  node.y + 20,
                  width: NODE_W,
                  zIndex: 1,
                }}
                onClick={() => onSelectAgent?.(cfg.id)}
              >
                {/* Color strip */}
                <div className={cn("h-0.5 w-full", accent.avatar)} />

                <div className="px-3 py-2.5 space-y-1.5">
                  {/* Name row */}
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

                  {/* Model + skills */}
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                    <Cpu className="w-3 h-3 shrink-0" />
                    <span className="truncate flex-1 font-mono">{modelShort(cfg.model)}</span>
                    {skills > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Package className="w-3 h-3" />
                        {skills}
                      </span>
                    )}
                  </div>

                  {/* Sub-agents count */}
                  {(cfg.subagents?.allowAgents?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-700">
                      <GitBranch className="w-3 h-3" />
                      <span>{cfg.subagents!.allowAgents!.length} sub-agent{cfg.subagents!.allowAgents!.length !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function countLeaves(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function assignSubtree(node: TreeNode, leafOffset: number, depth: number): void {
  node.y = depth * (NODE_H + GAP_Y);
  if (node.children.length === 0) {
    node.x = leafOffset * (NODE_W + GAP_X);
    return;
  }
  let offset = leafOffset;
  for (const child of node.children) {
    assignSubtree(child, offset, depth + 1);
    offset += countLeaves(child);
  }
  const first = node.children[0];
  const last  = node.children[node.children.length - 1];
  node.x = (first.x + last.x) / 2;
}
