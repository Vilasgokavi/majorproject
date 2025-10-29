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
}

const getNodeColor = (type: string) => {
  switch (type) {
    case 'patient': return '#4A90E2'; // Blue for main entity
    case 'condition': return '#4A90E2'; // Blue for conditions
    case 'medication': return '#F5A623'; // Orange for treatments/medications
    case 'procedure': return '#7ED6DF'; // Light blue for tests/procedures
    case 'symptom': return '#7DB87E'; // Green for symptoms
    default: return '#B794F6'; // Purple for related/other
  }
};

const getNodeSize = (node: GraphNode, allNodes: GraphNode[]) => {
  // Make patient/central nodes larger
  if (node.type === 'patient' || node.type === 'condition') {
    const connectionCount = node.connections.length;
    // If node has many connections, it's likely central
    if (connectionCount >= 3) return 50;
  }
  return 30;
};

// Helper function to calculate radial positions
const calculateRadialPosition = (index: number, total: number, radius: number, centerX: number, centerY: number) => {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
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
}) => {
  // Use provided data or fallback to sample data
  const displayNodes = nodes && nodes.length > 0 ? nodes : sampleNodes;
  const displayEdges = edges && edges.length > 0 ? edges : sampleEdges;
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
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

            return (
              <g key={index}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#D1D5DB"
                  strokeWidth={1.5}
                  opacity={0.6}
                  className="transition-all duration-300"
                />
                {edge.label && (
                  <text
                    x={labelX}
                    y={labelY - 8}
                    textAnchor="middle"
                    className="text-[10px] select-none"
                    fill="#9CA3AF"
                    style={{ pointerEvents: 'none', fontWeight: 400 }}
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
            const baseRadius = getNodeSize(node, displayNodes);
            const nodeRadius = isHovered ? baseRadius * 1.1 : baseRadius;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => onNodeClick?.(node)}
                onMouseEnter={() => {
                  setHoveredNode(node.id);
                  onNodeHover?.(node);
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  onNodeHover?.(null);
                }}
              >
                {/* Main node circle - solid color */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius}
                  fill={getNodeColor(node.type)}
                  opacity={0.9}
                  className="transition-all duration-200"
                  style={{
                    filter: isHovered ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                  }}
                />
                
                {/* Node label - below the circle */}
                <text
                  x={node.x}
                  y={node.y + nodeRadius + 18}
                  textAnchor="middle"
                  className="select-none"
                  style={{ 
                    pointerEvents: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    fill: '#374151'
                  }}
                >
                  {node.label}
                </text>
                
                {/* Node type label - below the main label */}
                <text
                  x={node.x}
                  y={node.y + nodeRadius + 32}
                  textAnchor="middle"
                  className="select-none capitalize"
                  style={{ 
                    pointerEvents: 'none',
                    fontSize: '11px',
                    fontWeight: 400,
                    fill: '#9CA3AF'
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