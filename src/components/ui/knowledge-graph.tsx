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
    case 'patient': return '#2563eb';
    case 'condition': return '#dc2626';
    case 'medication': return '#10b981';
    case 'procedure': return '#f59e0b';
    case 'symptom': return '#8b5cf6';
    default: return '#6b7280';
  }
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
  nodes = sampleNodes,
  edges = sampleEdges,
  onNodeClick,
  onNodeHover,
}) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const filteredNodes = nodes.filter(node => {
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
    <div className="glass-card h-[600px] relative overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-4 items-center">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/80 backdrop-blur-sm"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 bg-background/80 backdrop-blur-sm">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="patient">Patients</SelectItem>
              <SelectItem value="condition">Conditions</SelectItem>
              <SelectItem value="medication">Medications</SelectItem>
              <SelectItem value="procedure">Procedures</SelectItem>
              <SelectItem value="symptom">Symptoms</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Graph Status */}
      <div className="absolute bottom-4 left-4 z-10 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {filteredNodes.length} nodes • {edges.length} connections
        </p>
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
          {edges.map((edge, index) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            
            if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return null;

            // Calculate midpoint for edge label
            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;

            return (
              <g key={index}>
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={edge.strength * 2}
                  opacity={0.3}
                  className="transition-all duration-300"
                  strokeDasharray={edge.strength < 0.7 ? "5,5" : "none"}
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 5}
                    textAnchor="middle"
                    className="text-xs fill-muted-foreground select-none"
                    style={{ pointerEvents: 'none' }}
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
            const nodeRadius = isHovered ? 40 : 35;

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
                {/* Node shadow/glow effect */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius + 5}
                  fill={getNodeColor(node.type)}
                  opacity={isHovered ? 0.2 : 0}
                  className="transition-all duration-200"
                />
                
                {/* Main node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius}
                  fill={getNodeColor(node.type)}
                  stroke="hsl(var(--background))"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-200"
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 12px ${getNodeColor(node.type)})` : 'none'
                  }}
                />
                
                {/* Node type indicator (smaller circle) */}
                <circle
                  cx={node.x + 20}
                  cy={node.y - 20}
                  r={8}
                  fill="hsl(var(--background))"
                  stroke={getNodeColor(node.type)}
                  strokeWidth={2}
                />
                
                {/* Node label */}
                <text
                  x={node.x}
                  y={node.y - nodeRadius - 15}
                  textAnchor="middle"
                  className="text-sm font-semibold fill-foreground select-none"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.label}
                </text>
                
                {/* Node type label */}
                <text
                  x={node.x}
                  y={node.y - nodeRadius - 2}
                  textAnchor="middle"
                  className="text-xs fill-muted-foreground select-none capitalize"
                  style={{ pointerEvents: 'none' }}
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