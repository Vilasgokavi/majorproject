import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Text, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Search, Filter, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GraphNode {
  id: string;
  label: string;
  type: 'patient' | 'condition' | 'medication' | 'procedure' | 'symptom';
  position: [number, number, number];
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

// Animated Graph Node Component
const GraphNodeComponent: React.FC<{
  node: GraphNode;
  isHovered: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}> = ({ node, isHovered, onClick, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      if (isHovered) {
        meshRef.current.scale.setScalar(1.2);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

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

  return (
    <group position={node.position}>
      <Sphere
        ref={meshRef}
        args={[0.5, 32, 32]}
        onClick={onClick}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <meshStandardMaterial 
          color={getNodeColor(node.type)}
          emissive={isHovered ? getNodeColor(node.type) : '#000000'}
          emissiveIntensity={isHovered ? 0.3 : 0}
        />
      </Sphere>
      <Text
        position={[0, 1, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {node.label}
      </Text>
    </group>
  );
};

// Sample data for demonstration
const sampleNodes: GraphNode[] = [
  {
    id: '1',
    label: 'Patient A',
    type: 'patient',
    position: [0, 0, 0],
    connections: ['2', '3', '4'],
    data: { age: 45, gender: 'Male' }
  },
  {
    id: '2',
    label: 'Diabetes',
    type: 'condition',
    position: [3, 2, 1],
    connections: ['1', '5'],
    data: { severity: 'Type 2', onset: '2019' }
  },
  {
    id: '3',
    label: 'Hypertension',
    type: 'condition',
    position: [-2, 1, 2],
    connections: ['1', '6'],
    data: { stage: 'Stage 1', controlled: true }
  },
  {
    id: '4',
    label: 'Fatigue',
    type: 'symptom',
    position: [1, -2, -1],
    connections: ['1'],
    data: { severity: 'Moderate', frequency: 'Daily' }
  },
  {
    id: '5',
    label: 'Metformin',
    type: 'medication',
    position: [5, 0, 2],
    connections: ['2'],
    data: { dosage: '500mg', frequency: 'Twice daily' }
  },
  {
    id: '6',
    label: 'ACE Inhibitor',
    type: 'medication',
    position: [-4, -1, 1],
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
  const controlsRef = useRef<any>(null);

  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || node.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const EdgeComponent: React.FC<{ edge: GraphEdge }> = ({ edge }) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return null;

    return (
      <Line
        points={[sourceNode.position, targetNode.position]}
        color="#64748b"
        lineWidth={2}
        opacity={0.6}
      />
    );
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

      {/* 3D Canvas */}
      <Canvas camera={{ position: [10, 10, 10], fov: 60 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <OrbitControls 
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          dampingFactor={0.05}
        />

        {/* Render Edges */}
        {edges.map((edge, index) => (
          <EdgeComponent key={index} edge={edge} />
        ))}

        {/* Render Nodes */}
        {filteredNodes.map((node) => (
          <GraphNodeComponent
            key={node.id}
            node={node}
            isHovered={hoveredNode === node.id}
            onClick={() => onNodeClick?.(node)}
            onHover={(hovered) => {
              setHoveredNode(hovered ? node.id : null);
              onNodeHover?.(hovered ? node : null);
            }}
          />
        ))}
      </Canvas>
    </div>
  );
};