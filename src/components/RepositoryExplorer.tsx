"use client";

import * as React from "react";

export interface TreeNode {
  name: string;
  path: string;
  type: "blob" | "tree";
  children?: TreeNode[];
  depth: number;
  category: "frontend" | "backend" | "config" | "docs" | "test" | "other";
  isHighlighted: boolean;
}

interface RepositoryExplorerProps {
  tree: TreeNode[] | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  activeTaskBoundaries: string[];
  repoName?: string;
}

interface LayoutNode {
  id: string;
  name: string;
  path: string;
  type: "blob" | "tree";
  category: TreeNode["category"];
  isHighlighted: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  depth: number;
  childIds: string[];
  expanded: boolean;
  descendantCount: number;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: "hook" | "api" | "import";
}

/**
 * Determines the semantic category of a file/folder based on its path.
 */
function categorizeNode(path: string): TreeNode["category"] {
  const lowerPath = path.toLowerCase();
  if (/\/components?\//.test(lowerPath) || /\/pages?\//.test(lowerPath) || /\/views?\//.test(lowerPath) || /\.tsx$/.test(lowerPath) || /\.jsx$/.test(lowerPath) || /\/app\//.test(lowerPath) || /next\.config\./.test(lowerPath)) return "frontend";
  if (/\/api\//.test(lowerPath) || /\/server\//.test(lowerPath) || /\/routes?\//.test(lowerPath) || /\/controllers?\//.test(lowerPath) || /\/services?\//.test(lowerPath) || /\/models?\//.test(lowerPath) || /\/hooks\//.test(lowerPath) || /route\.ts$/.test(lowerPath)) return "backend";
  if (/\/tests?\//.test(lowerPath) || /\/__tests__\//.test(lowerPath) || /\.test\./.test(lowerPath) || /\.spec\./.test(lowerPath)) return "test";
  if (/package\.json$/.test(lowerPath) || /tsconfig/.test(lowerPath) || /\.config\./.test(lowerPath) || /\.env/.test(lowerPath) || /dockerfile/i.test(lowerPath) || /docker-compose/.test(lowerPath)) return "config";
  if (/\/docs?\//.test(lowerPath) || /\.md$/.test(lowerPath) || /\.mdx$/.test(lowerPath) || /readme/i.test(lowerPath)) return "docs";
  return "other";
}

/**
 * Checks if a path matches any of the active task boundaries.
 */
function checkHighlight(path: string, boundaries: string[]): boolean {
  if (boundaries.length === 0) return false;
  return boundaries.some((boundary) => {
    const normalized = boundary.replace(/^\//, "").replace(/\/$/, "");
    return path.startsWith(normalized) || normalized.startsWith(path);
  });
}

const nodeColors: Record<TreeNode["category"], { bg: string; border: string; text: string; glow: string; line: string }> = {
  frontend: { bg: "bg-teal-500", border: "border-teal-600", text: "text-white", glow: "shadow-teal-400/60", line: "#14b8a6" },
  backend: { bg: "bg-orange-500", border: "border-orange-600", text: "text-white", glow: "shadow-orange-400/60", line: "#f97316" },
  test: { bg: "bg-purple-500", border: "border-purple-600", text: "text-white", glow: "shadow-purple-400/60", line: "#a855f7" },
  config: { bg: "bg-zinc-500", border: "border-zinc-600", text: "text-white", glow: "shadow-zinc-400/60", line: "#71717a" },
  docs: { bg: "bg-blue-500", border: "border-blue-600", text: "text-white", glow: "shadow-blue-400/60", line: "#3b82f6" },
  other: { bg: "bg-zinc-400", border: "border-zinc-500", text: "text-white", glow: "shadow-zinc-300/60", line: "#a1a1aa" },
};

/**
 * Detects dependency edges between files based on naming patterns and paths.
 */
function detectDependencies(nodes: LayoutNode[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Group nodes by category
  const frontendNodes = nodes.filter((n) => n.category === "frontend" && n.type === "blob");
  const hookNodes = nodes.filter((n) => n.path.includes("/hooks/") || n.path.includes("hook") || n.name.startsWith("use"));
  const apiNodes = nodes.filter((n) => n.category === "backend" && n.type === "blob");

  // Connect frontend views to hooks (shared naming patterns)
  frontendNodes.forEach((fe) => {
    const feBase = fe.name.replace(/\.(tsx|jsx|ts|js)$/, "").toLowerCase();
    
    hookNodes.forEach((hook) => {
      const hookBase = hook.name.replace(/\.(ts|js)$/, "").toLowerCase().replace(/^use/, "");
      
      // Match if frontend name contains hook name or vice versa
      if (feBase.includes(hookBase) || hookBase.includes(feBase.replace("page", "").replace("view", ""))) {
        edges.push({ from: fe.id, to: hook.id, type: "hook" });
      }
    });
  });

  // Connect frontend to API endpoints (shared data handler names)
  frontendNodes.forEach((fe) => {
    const feName = fe.name.replace(/\.(tsx|jsx|ts|js)$/, "").toLowerCase();
    
    apiNodes.forEach((api) => {
      const apiName = api.name.replace(/\.(ts|js)$/, "").toLowerCase();
      
      // Match if they share a common data entity name
      const feWords = feName.split(/[-_]/);
      const apiWords = apiName.split(/[-_]/);
      const hasCommon = feWords.some((w) => apiWords.includes(w) && w.length > 2);
      
      if (hasCommon) {
        edges.push({ from: fe.id, to: api.id, type: "api" });
      }
    });
  });

  // Limit edges to avoid clutter
  return edges.slice(0, 20);
}

/**
 * Calculates the visible tree layout based on expanded state.
 * Uses a columnar layout where each depth level gets its own column area.
 */
function calculateLayout(
  tree: TreeNode[],
  repoName: string,
  expandedNodes: Set<string>
): { nodes: LayoutNode[]; structureLines: { x1: number; y1: number; x2: number; y2: number }[]; width: number; height: number } {
  const nodes: LayoutNode[] = [];
  const structureLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 36;
  const COL_SPACING = 32;
  const ROW_SPACING = 50;
  const LEFT_PADDING = 60;
  const TOP_PADDING = 80;

  // Build a flat list of visible nodes based on expanded state
  const visibleNodes: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  // Index all nodes by path
  const indexNodes = (nodeList: TreeNode[]) => {
    nodeList.forEach((n) => {
      nodeMap.set(n.path, n);
      if (n.children) indexNodes(n.children);
    });
  };
  indexNodes(tree);

  // Recursively collect visible nodes
  const collectVisible = (nodeList: TreeNode[], parentExpanded: boolean) => {
    if (!parentExpanded) return;
    
    nodeList.forEach((node) => {
      visibleNodes.push(node);
      const isExpanded = expandedNodes.has(node.path);
      
      if (node.children && isExpanded) {
        collectVisible(node.children, true);
      }
    });
  };

  // Root is always expanded
  collectVisible(tree, true);

  // Group visible nodes by depth
  const depthGroups = new Map<number, TreeNode[]>();
  visibleNodes.forEach((n) => {
    const group = depthGroups.get(n.depth) || [];
    group.push(n);
    depthGroups.set(n.depth, group);
  });

  // Calculate positions
  const maxDepth = Math.max(...Array.from(depthGroups.keys()), 0);
  const depthColumns = new Map<number, number>();
  
  // Assign column positions for each depth
  let currentCol = 0;
  for (let d = 1; d <= maxDepth; d++) {
    depthColumns.set(d, currentCol);
    const itemsAtDepth = depthGroups.get(d) || [];
    const maxInGroup = Math.max(...itemsAtDepth.map((n) => {
      const siblings = itemsAtDepth.filter((s) => {
        const sParent = s.path.split("/").slice(0, -1).join("/");
        const nParent = n.path.split("/").slice(0, -1).join("/");
        return sParent === nParent;
      });
      return siblings.length;
    }), 1);
    currentCol += maxInGroup;
  }

  // Position each visible node
  const layoutNodeMap = new Map<string, LayoutNode>();
  const depthRowCounters = new Map<number, number>();

  visibleNodes.forEach((item) => {
    const parentPath = item.path.split("/").slice(0, -1).join("/");
    const parentNode = item.depth === 0 ? null : layoutNodeMap.get(parentPath);
    const isExpanded = expandedNodes.has(item.path);
    const hasChildren = item.type === "tree" && item.children && item.children.length > 0;

    // Calculate x position
    let x: number;
    if (item.depth === 0) {
      x = LEFT_PADDING;
    } else {
      const col = depthColumns.get(item.depth) || 0;
      x = LEFT_PADDING + col * (NODE_WIDTH + COL_SPACING);
    }

    // Calculate y position based on row counter at this depth
    const rowCounter = depthRowCounters.get(item.depth) || 0;
    const y = TOP_PADDING + rowCounter * (NODE_HEIGHT + ROW_SPACING);
    depthRowCounters.set(item.depth, rowCounter + 1);

    const layoutNode: LayoutNode = {
      id: item.path,
      name: item.name.length > 18 ? item.name.slice(0, 16) + "…" : item.name,
      path: item.path,
      type: item.type,
      category: item.category,
      isHighlighted: item.isHighlighted,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      parentId: parentNode?.id,
      depth: item.depth,
      childIds: item.children?.map((c) => c.path) || [],
      expanded: isExpanded,
      descendantCount: item.children?.length || 0,
    };

    nodes.push(layoutNode);
    layoutNodeMap.set(item.path, layoutNode);

    // Add structure line from parent
    if (parentNode) {
      structureLines.push({
        x1: parentNode.x + parentNode.width / 2,
        y1: parentNode.y + parentNode.height,
        x2: x + NODE_WIDTH / 2,
        y2: y,
      });
    }
  });

  // Calculate bounds
  const allX = nodes.map((n) => n.x + n.width);
  const allY = nodes.map((n) => n.y + n.height);
  const maxX = Math.max(...allX, 800) + 100;
  const maxY = Math.max(...allY, 400) + 100;

  return { nodes, structureLines, width: maxX, height: maxY };
}

function NodeBlock({
  node,
  onHover,
  isHovered,
  onToggle,
}: {
  node: LayoutNode;
  onHover: (node: LayoutNode | null) => void;
  isHovered: boolean;
  onToggle: (path: string) => void;
}) {
  const colors = nodeColors[node.category];
  const isFolder = node.type === "tree";
  const hasChildren = isFolder && node.childIds.length > 0;

  return (
    <div
      className={`absolute flex cursor-pointer items-center justify-center rounded-lg border-2 text-center text-xs font-medium transition-all duration-200 ${colors.bg} ${colors.border} ${colors.text} ${
        node.isHighlighted ? `shadow-lg ${colors.glow} ring-2 ring-yellow-400 ring-offset-2 animate-pulse` : "hover:shadow-md"
      } ${isHovered ? "scale-110 shadow-xl" : ""} ${isFolder ? "rounded-xl" : "rounded-md"}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (hasChildren) onToggle(node.path);
      }}
    >
      <span className="truncate px-2">
        {isFolder ? (node.expanded ? "📂" : "📁") : "📄"} {node.name}
      </span>
      {hasChildren && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] text-zinc-600 ring-1 ring-zinc-300">
          {node.childIds.length}
        </span>
      )}
      {node.isHighlighted && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[8px] text-yellow-900 ring-2 ring-white">
          ⚡
        </span>
      )}
    </div>
  );
}

function FolderEnclosure({ node, children }: { node: LayoutNode; children: LayoutNode[] }) {
  if (children.length === 0) return null;

  const minX = Math.min(...children.map((c) => c.x)) - 16;
  const minY = Math.min(...children.map((c) => c.y)) - 16;
  const maxX = Math.max(...children.map((c) => c.x + c.width)) + 16;
  const maxY = Math.max(...children.map((c) => c.y + c.height)) + 16;

  return (
    <div
      className="absolute rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 dark:border-zinc-600 dark:bg-zinc-800/30"
      style={{
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
      }}
    />
  );
}

function SvgLines({
  structureLines,
  dependencyEdges,
  nodeMap,
  width,
  height,
}: {
  structureLines: { x1: number; y1: number; x2: number; y2: number }[];
  dependencyEdges: DependencyEdge[];
  nodeMap: Map<string, LayoutNode>;
  width: number;
  height: number;
}) {
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ width, height, zIndex: 0 }}>
      {/* Structure lines (solid gray) */}
      {structureLines.map((line, i) => (
        <line
          key={`s-${i}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#a1a1aa"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.5}
        />
      ))}
      {/* Dependency edges (colored dashed with arrowheads) */}
      {dependencyEdges.map((edge, i) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return null;

        const x1 = fromNode.x + fromNode.width / 2;
        const y1 = fromNode.y + fromNode.height;
        const x2 = toNode.x + toNode.width / 2;
        const y2 = toNode.y;

        const color = edge.type === "hook" ? "#14b8a6" : "#a855f7";
        const dashArray = edge.type === "hook" ? "6,3" : "4,4";

        return (
          <g key={`d-${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeDasharray={dashArray} opacity={0.7} markerEnd={`url(#arrowhead-${edge.type})`} />
          </g>
        );
      })}
      {/* Arrowhead markers */}
      <defs>
        <marker id="arrowhead-hook" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#14b8a6" />
        </marker>
        <marker id="arrowhead-api" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#a855f7" />
        </marker>
      </defs>
    </svg>
  );
}

function Tooltip({ node }: { node: LayoutNode | null }) {
  if (!node) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-xs text-white shadow-xl">
      <div className="font-mono">{node.path}</div>
      {node.isHighlighted && <div className="mt-1 text-yellow-400">⚡ Active task boundary</div>}
      {node.type === "tree" && <div className="mt-1 text-zinc-400">{node.expanded ? "Click to collapse" : "Click to expand"}</div>}
    </div>
  );
}

export function RepositoryExplorer({ tree, isLoading, error, onRefresh, activeTaskBoundaries, repoName }: RepositoryExplorerProps) {
  const [hoveredNode, setHoveredNode] = React.useState<LayoutNode | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Initialize with top-level folders expanded
  React.useEffect(() => {
    if (tree) {
      const initialExpanded = new Set<string>();
      tree.forEach((node) => {
        if (node.type === "tree" && node.depth <= 1) {
          initialExpanded.add(node.path);
        }
      });
      setExpandedNodes(initialExpanded);
    }
  }, [tree]);

  const toggleNode = React.useCallback((path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const layout = React.useMemo(() => {
    if (!tree) return null;
    return calculateLayout(tree, repoName || "Repository", expandedNodes);
  }, [tree, repoName, expandedNodes]);

  const dependencyEdges = React.useMemo(() => {
    if (!layout) return [];
    return detectDependencies(layout.nodes);
  }, [layout]);

  const nodeMap = React.useMemo(() => {
    if (!layout) return new Map<string, LayoutNode>();
    return new Map(layout.nodes.map((n) => [n.id, n]));
  }, [layout]);

  const highlightedNodeIds = React.useMemo(() => {
    if (!layout) return new Set<string>();
    return new Set(layout.nodes.filter((n) => n.isHighlighted).map((n) => n.id));
  }, [layout]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  const handleExpandAll = () => {
    if (!tree) return;
    const allFolders = new Set<string>();
    const collectFolders = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        if (n.type === "tree") {
          allFolders.add(n.path);
          if (n.children) collectFolders(n.children);
        }
      });
    };
    collectFolders(tree);
    setExpandedNodes(allFolders);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Mouse drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
        <p className="mt-4 text-sm text-zinc-500">Loading repository structure...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/30">
          ⚠️
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Failed to load repository</h3>
        <p className="mt-2 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">{error}</p>
        <button onClick={onRefresh} className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Try Again
        </button>
      </div>
    );
  }

  if (!tree || tree.length === 0 || !layout) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">
          📂
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No repository loaded</h3>
        <p className="mt-2 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
          Connect a GitHub repository in Settings to view its architecture map.
        </p>
      </div>
    );
  }

  // Group children by parent for enclosure rendering
  const childrenByParent = new Map<string, LayoutNode[]>();
  layout.nodes.forEach((n) => {
    if (n.parentId) {
      const siblings = childrenByParent.get(n.parentId) || [];
      siblings.push(n);
      childrenByParent.set(n.parentId, siblings);
    }
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400">
          {(Object.entries(nodeColors) as [TreeNode["category"], typeof nodeColors["frontend"]][]).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded ${config.bg} ${config.border} border`}></span>
              <span className="capitalize">{key}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 border-l border-zinc-300 pl-2 dark:border-zinc-600">
            <span className="h-0.5 w-4 bg-teal-500" style={{ borderTop: "2px dashed #14b8a6" }}></span>
            <span>Hook</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-0.5 w-4 bg-purple-500" style={{ borderTop: "2px dashed #a855f7" }}></span>
            <span>API</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExpandAll} className="rounded px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Expand All
          </button>
          <button onClick={handleCollapseAll} className="rounded px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Collapse All
          </button>
          <span className="text-[10px] text-zinc-500">{Math.round(zoom * 100)}%</span>
          <button
            onClick={onRefresh}
            className="rounded-md border border-zinc-300 bg-white p-1.5 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
          </button>
        </div>
      </div>

      {/* Interactive Node Map */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div className="min-h-full p-8" style={{ minWidth: layout.width * zoom + 200, minHeight: layout.height * zoom + 200, position: "relative" }}>
          <div
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: "top left",
              position: "relative",
              width: layout.width,
              height: layout.height,
            }}
          >
            {/* Folder enclosures */}
            {layout.nodes
              .filter((n) => n.type === "tree" && n.expanded && childrenByParent.has(n.id))
              .map((folder) => (
                <FolderEnclosure key={folder.id} node={folder} children={childrenByParent.get(folder.id)!} />
              ))}
            {/* Lines and nodes */}
            <SvgLines structureLines={layout.structureLines} dependencyEdges={dependencyEdges} nodeMap={nodeMap} width={layout.width} height={layout.height} />
            {layout.nodes.map((node) => (
              <NodeBlock key={node.id} node={node} onHover={setHoveredNode} isHovered={hoveredNode?.id === node.id} onToggle={toggleNode} />
            ))}
          </div>
        </div>
      </div>

      {/* Zoom/Pan Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
        <button onClick={handleZoomIn} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700" title="Zoom In">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
        <button onClick={handleZoomOut} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700" title="Zoom Out">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
        </button>
        <button onClick={handleResetView} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700" title="Reset View">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        </button>
      </div>

      {/* Tooltip */}
      <Tooltip node={hoveredNode} />

      {/* Stats */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        {layout.nodes.filter((n) => n.type === "blob").length} files, {layout.nodes.filter((n) => n.type === "tree").length} folders
        {activeTaskBoundaries.length > 0 && ` • ${highlightedNodeIds.size} active`}
        {dependencyEdges.length > 0 && ` • ${dependencyEdges.length} connections`}
        {" "}• Click folders to toggle
      </div>
    </div>
  );
}

/**
 * Transforms flat GitHub tree API response into nested TreeNode structure.
 */
export function buildTreeFromGitHubResponse(
  items: { path: string; type: "blob" | "tree" }[],
  activeBoundaries: string[] = []
): TreeNode[] {
  const root: TreeNode[] = [];
  const pathMap = new Map<string, TreeNode>();

  const sortedItems = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const item of sortedItems) {
    const parts = item.path.split("/");
    const name = parts[parts.length - 1];
    const depth = parts.length - 1;

    const node: TreeNode = {
      name,
      path: item.path,
      type: item.type,
      children: item.type === "tree" ? [] : undefined,
      depth,
      category: item.type === "tree" ? categorizeNode(item.path + "/") : categorizeNode(item.path),
      isHighlighted: item.type === "blob" && checkHighlight(item.path, activeBoundaries),
    };

    pathMap.set(item.path, node);

    if (depth === 0) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = pathMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  }

  return root;
}
