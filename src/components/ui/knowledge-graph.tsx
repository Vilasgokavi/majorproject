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

// Sample data for demonstration
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
    x: 600,
    y: 200,
    connections: ['1', '5'],
    data: { severity: 'Type 2', onset: '2019' }
  },
  {
    id: '3',
    label: 'Hypertension',
    type: 'condition',
    x: 250,
    y: 250,
    connections: ['1', '6'],
    data: { stage: 'Stage 1', controlled: true }
  },
  {
    id: '4',
    label: 'Fatigue',
    type: 'symptom',
    x: 450,
    y: 450,
    connections: ['1'],
    data: { severity: 'Moderate', frequency: 'Daily' }
  },
  {
    id: '5',
    label: 'Metformin',
    type: 'medication',
    x: 750,
    y: 150,
    connections: ['2'],
    data: { dosage: '500mg', frequency: 'Twice daily' }
  },
  {
    id: '6',
    label: 'ACE Inhibitor',
    type: 'medication',
    x: 150,
    y: 200,
    connections: ['3'],
    data: { dosage: '10mg', frequency: 'Once daily' }
  },
];

const sampleEdges: GraphEdge[] = [
  { source: '1', target: '2', label: 'diagnosed with', strength: 1 },
  { source: '1', target: '3', label: 'has condition', strength: 0.8 },
  { source: '1', target: '4', label: 'experiences', strength: 0.6 },
  { source: '2', target: '5', label: 'treated with', strength: 0.9 },
  { source: '3', target: '6', label: 'managed by', strength: 0.9 },
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

            return (
              <line
                key={index}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="#64748b"
                strokeWidth={2}
                opacity={0.4}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Render Nodes */}
          {filteredNodes.map((node) => {
            if (!node.x || !node.y) return null;
            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer transition-transform duration-200"
                style={{ transform: isHovered ? 'scale(1.2)' : 'scale(1)' }}
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
                <circle
                  r={isHovered ? 35 : 30}
                  fill={getNodeColor(node.type)}
                  stroke={isHovered ? '#ffffff' : 'none'}
                  strokeWidth={3}
                  className="transition-all duration-200"
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 10px ${getNodeColor(node.type)})` : 'none'
                  }}
                />
                <text
                  y={-40}
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-sm font-medium select-none"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};