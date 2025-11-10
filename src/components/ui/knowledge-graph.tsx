import React, { useEffect, useRef, useState } from 'react';
import { Search, Filter, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GraphNode {
  id: string;
  label: string;
  type: 'patient' | 'condition' | 'medication' | 'procedure' | 'symptom';
  x?: number;
  y?: number;
  connections: string[];
  data?: any;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  strength: number;
}

interface KnowledgeGraphProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  patientId?: string;
}

const getNodeColor = (type: string) => {
  switch (type) {
    case 'patient': return 'hsl(180 100% 50%)'; // Neon cyan
    case 'condition': return 'hsl(320 100% 50%)'; // Neon magenta
    case 'medication': return 'hsl(30 100% 55%)'; // Neon orange
    case 'procedure': return 'hsl(210 100% 60%)'; // Neon blue
    case 'symptom': return 'hsl(90 100% 50%)'; // Neon lime
    default: return 'hsl(270 100% 60%)'; // Neon purple
  }
};

const getNodeSize = (node: GraphNode, allNodes: GraphNode[]) => {
  // Make central nodes (most connections) larger
  const connectionCount = node.connections.length;
  if (connectionCount >= 3) return 50;
  return 30;
};

// Apply circular layout algorithm with disease/condition at center
const applyCircularLayout = (nodes: GraphNode[], centerX: number = 400, centerY: number = 300): GraphNode[] => {
  if (nodes.length === 0) return nodes;
  
  // Find condition/disease nodes
  const conditionNodes = nodes.filter(n => n.type === 'condition');
  
  // Select central node: prioritize condition nodes, then most connected
  let centralNode: GraphNode;
  if (conditionNodes.length > 0) {
    // If multiple conditions, pick the one with most connections
    centralNode = conditionNodes.reduce((prev, current) => 
      current.connections.length > prev.connections.length ? current : prev
    );
  } else {
    // Fallback to most connected node if no conditions exist
    centralNode = nodes.reduce((prev, current) => 
      current.connections.length > prev.connections.length ? current : prev
    );
  }
  
  // Separate central node from peripheral nodes
  const peripheralNodes = nodes.filter(n => n.id !== centralNode.id);
  
  // Position central node at center
  const layoutNodes = nodes.map(node => {
    if (node.id === centralNode.id) {
      return { ...node, x: centerX, y: centerY };
    }
    return node;
  });
  
  // Group peripheral nodes by type for color-based arrangement
  const nodesByType: { [key: string]: GraphNode[] } = {};
  peripheralNodes.forEach(node => {
    if (!nodesByType[node.type]) {
      nodesByType[node.type] = [];
    }
    nodesByType[node.type].push(node);
  });
  
  // Calculate radius based on number of nodes
  const radius = Math.max(180, 120 + peripheralNodes.length * 10);
  
  // Distribute nodes evenly in a circle
  let currentIndex = 0;
  const total = peripheralNodes.length;
  
  Object.values(nodesByType).forEach(typeNodes => {
    typeNodes.forEach(node => {
      const angle = (currentIndex / total) * 2 * Math.PI - Math.PI / 2;
      const nodeInLayout = layoutNodes.find(n => n.id === node.id);
      if (nodeInLayout) {
        nodeInLayout.x = centerX + radius * Math.cos(angle);
        nodeInLayout.y = centerY + radius * Math.sin(angle);
      }
      currentIndex++;
    });
  });
  
  return layoutNodes;
};

// Sample data with clean, organized layout
const sampleNodes: GraphNode[] = [
  {
    id: '1',
    label: 'Patient A',
    type: 'patient',
    x: 400,
    y: 300,
    connections: ['2', '3', '4'],
    data: { age: 45, gender: 'Male' }
  },
  {
    id: '2',
    label: 'Diabetes',
    type: 'condition',
    x: 550,
    y: 150,
    connections: ['1', '5'],
    data: { severity: 'Type 2', onset: '2019' }
  },
  {
    id: '3',
    label: 'Hypertension',
    type: 'condition',
    x: 250,
    y: 150,
    connections: ['1', '6'],
    data: { stage: 'Stage 1', controlled: true }
  },
  {
    id: '4',
    label: 'Fatigue',
    type: 'symptom',
    x: 400,
    y: 450,
    connections: ['1'],
    data: { severity: 'Moderate', frequency: 'Daily' }
  },
  {
    id: '5',
    label: 'Metformin',
    type: 'medication',
    x: 650,
    y: 100,
    connections: ['2'],
    data: { dosage: '500mg', frequency: 'Twice daily' }
  },
  {
    id: '6',
    label: 'ACE Inhibitor',
    type: 'medication',
    x: 150,
    y: 100,
    connections: ['3'],
    data: { dosage: '10mg', frequency: 'Once daily' }
  },
  {
    id: '7',
    label: 'Blood Test',
    type: 'procedure',
    x: 550,
    y: 450,
    connections: ['1', '2'],
    data: { frequency: 'Quarterly', lastDate: '2024-10-01' }
  },
  {
    id: '8',
    label: 'Dizziness',
    type: 'symptom',
    x: 250,
    y: 450,
    connections: ['3'],
    data: { severity: 'Mild', frequency: 'Occasional' }
  },
];

const sampleEdges: GraphEdge[] = [
  { source: '1', target: '2', label: 'diagnosed with', strength: 1 },
  { source: '1', target: '3', label: 'has condition', strength: 0.8 },
  { source: '1', target: '4', label: 'experiences', strength: 0.6 },
  { source: '2', target: '5', label: 'treated with', strength: 0.9 },
  { source: '3', target: '6', label: 'managed by', strength: 0.9 },
  { source: '1', target: '7', label: 'undergoes', strength: 0.7 },
  { source: '2', target: '7', label: 'monitors', strength: 0.8 },
  { source: '3', target: '8', label: 'causes', strength: 0.5 },
];

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  nodes,
  edges,
  onNodeClick,
  onNodeHover,
  patientId,
}) => {
  // Use provided data or fallback to sample data
  const rawNodes = nodes && nodes.length > 0 ? nodes : sampleNodes;
  const displayEdges = edges && edges.length > 0 ? edges : sampleEdges;
  
  // Apply circular layout to nodes
  const displayNodes = applyCircularLayout(rawNodes);
  
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const filteredNodes = displayNodes.filter(node => {
    const matchesSearch = node.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || node.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="glass-card h-[600px] relative overflow-hidden bg-background">
      {/* Patient ID Header */}
      {patientId && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-background/90 backdrop-blur-sm border border-neon-cyan/40 rounded-lg px-4 py-2">
            <h3 className="text-sm font-semibold text-neon-cyan" style={{ textShadow: '0 0 10px hsl(var(--neon-cyan))' }}>
              Knowledge Graph of PID: {patientId}
            </h3>
          </div>
        </div>
      )}
      
      {/* Minimal Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button variant="outline" size="sm" onClick={handleZoomIn} className="bg-background/80 backdrop-blur-sm">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleZoomOut} className="bg-background/80 backdrop-blur-sm">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={resetView} className="bg-background/80 backdrop-blur-sm">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* 2D SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render Edges */}
          {displayEdges.map((edge, index) => {
            const sourceNode = displayNodes.find(n => n.id === edge.source);
            const targetNode = displayNodes.find(n => n.id === edge.target);
            
            if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return null;

            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const angle = Math.atan2(dy, dx);
            
            // Offset from node center to edge of circle
            const sourceRadius = getNodeSize(sourceNode, displayNodes);
            const targetRadius = getNodeSize(targetNode, displayNodes);
            
            const startX = sourceNode.x + Math.cos(angle) * sourceRadius;
            const startY = sourceNode.y + Math.sin(angle) * sourceRadius;
            const endX = targetNode.x - Math.cos(angle) * targetRadius;
            const endY = targetNode.y - Math.sin(angle) * targetRadius;

            // Calculate label position (closer to the line)
            const labelX = (startX + endX) / 2;
            const labelY = (startY + endY) / 2;

            // Check if edge is connected to selected node
            const isConnectedToSelected = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
            const edgeOpacity = selectedNode ? (isConnectedToSelected ? 0.8 : 0.15) : 0.4;
            const edgeGlow = isConnectedToSelected;

            return (
              <g key={index}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="hsl(var(--neon-cyan))"
                  strokeWidth={isConnectedToSelected ? 3 : 2}
                  opacity={edgeOpacity}
                  className="transition-all duration-300"
                  style={{
                    filter: edgeGlow ? 'drop-shadow(0 0 8px hsl(var(--neon-cyan))) drop-shadow(0 0 16px hsl(var(--neon-cyan)))' : 'none'
                  }}
                />
                {edge.label && (
                  <text
                    x={labelX}
                    y={labelY - 8}
                    textAnchor="middle"
                    className="text-[10px] select-none"
                    fill="hsl(var(--neon-cyan))"
                    opacity={edgeOpacity}
                    style={{ 
                      pointerEvents: 'none', 
                      fontWeight: 500,
                      textShadow: edgeGlow ? '0 0 12px hsl(var(--neon-cyan))' : 'none'
                    }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Render Nodes */}
          {filteredNodes.map((node) => {
            if (!node.x || !node.y) return null;
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id;
            const baseRadius = getNodeSize(node, displayNodes);
            const nodeRadius = isHovered ? baseRadius * 1.1 : baseRadius;
            
            // Dim nodes when something is selected and this isn't it
            const nodeOpacity = selectedNode ? (isSelected ? 1 : 0.25) : 0.8;
            const labelOpacity = selectedNode ? (isSelected ? 1 : 0.4) : 1;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedNode(isSelected ? null : node.id);
                  onNodeClick?.(node);
                }}
                onMouseEnter={() => {
                  setHoveredNode(node.id);
                  onNodeHover?.(node);
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  onNodeHover?.(null);
                }}
              >
                {/* Main node circle - neon glow */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius}
                  fill={getNodeColor(node.type)}
                  opacity={nodeOpacity}
                  className="transition-all duration-300"
                  style={{
                    filter: isSelected 
                      ? `drop-shadow(0 0 30px ${getNodeColor(node.type)}) drop-shadow(0 0 60px ${getNodeColor(node.type)})` 
                      : isHovered 
                      ? `drop-shadow(0 0 20px ${getNodeColor(node.type)}) drop-shadow(0 0 40px ${getNodeColor(node.type)})` 
                      : `drop-shadow(0 0 10px ${getNodeColor(node.type)})`
                  }}
                />
                
                {/* Node label - below the circle */}
                <text
                  x={node.x}
                  y={node.y + nodeRadius + 18}
                  textAnchor="middle"
                  className="select-none transition-all duration-300"
                  style={{ 
                    pointerEvents: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    fill: 'hsl(var(--foreground))',
                    opacity: labelOpacity,
                    textShadow: isSelected ? `0 0 12px ${getNodeColor(node.type)}` : `0 0 8px ${getNodeColor(node.type)}`
                  }}
                >
                  {node.label}
                </text>
                
                {/* Node type label - below the main label */}
                <text
                  x={node.x}
                  y={node.y + nodeRadius + 32}
                  textAnchor="middle"
                  className="select-none capitalize transition-all duration-300"
                  style={{ 
                    pointerEvents: 'none',
                    fontSize: '11px',
                    fontWeight: 500,
                    fill: getNodeColor(node.type),
                    opacity: labelOpacity,
                    textShadow: isSelected ? `0 0 10px ${getNodeColor(node.type)}` : `0 0 6px ${getNodeColor(node.type)}`
                  }}
                >
                  {node.type}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};