import React, { useState, useEffect } from 'react';
import { Brain, Lightbulb, TrendingUp, AlertTriangle, Pill, Activity, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface Insight {
  id: string;
  type: 'summary' | 'medication' | 'treatment' | 'risk' | 'trend';
  title: string;
  content: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  relatedNodes?: string[];
}

interface AIInsightsProps {
  selectedNode?: any;
  insights?: Insight[];
  graphData?: { nodes: any[]; edges: any[] };
}

// Sample insights data
const sampleInsights: Insight[] = [
  {
    id: '1',
    type: 'summary',
    title: 'Knowledge Graph Summary',
    content: 'The current graph shows a 45-year-old male patient with comorbid diabetes and hypertension. Both conditions are well-managed with appropriate medications.',
    confidence: 0.92,
    priority: 'medium',
    relatedNodes: ['1', '2', '3']
  },
  {
    id: '2',
    type: 'medication',
    title: 'Medication Optimization',
    content: 'Consider adding a statin for cardiovascular protection given the patient\'s diabetes and hypertension combination. Current medication adherence appears good.',
    confidence: 0.87,
    priority: 'medium',
    relatedNodes: ['5', '6']
  },
  {
    id: '3',
    type: 'risk',
    title: 'Risk Assessment',
    content: 'Patient shows increased cardiovascular risk due to diabetes-hypertension combination. Regular monitoring of HbA1c and blood pressure recommended.',
    confidence: 0.94,
    priority: 'high',
    relatedNodes: ['2', '3']
  },
  {
    id: '4',
    type: 'treatment',
    title: 'Treatment Recommendations',
    content: 'Lifestyle interventions including diet modification and regular exercise could help improve both diabetic and hypertensive control.',
    confidence: 0.78,
    priority: 'medium',
    relatedNodes: ['2', '3', '4']
  }
];

export const AIInsights: React.FC<AIInsightsProps> = ({
  selectedNode,
  insights = sampleInsights,
  graphData,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  const [nodeAnalysis, setNodeAnalysis] = useState<string>('');
  const [graphAnalysis, setGraphAnalysis] = useState<string>('');
  const [isLoadingNode, setIsLoadingNode] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const { toast } = useToast();

  // Analyze selected node when it changes
  useEffect(() => {
    if (selectedNode && graphData) {
      analyzeNode();
    }
  }, [selectedNode]);

  const analyzeNode = async () => {
    if (!selectedNode || !graphData) return;
    
    setIsLoadingNode(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-node`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node: selectedNode,
            allNodes: graphData.nodes,
            allEdges: graphData.edges,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to analyze node');

      const data = await response.json();
      setNodeAnalysis(data.analysis);
    } catch (error) {
      console.error('Error analyzing node:', error);
      toast({
        title: 'Analysis failed',
        description: 'Failed to generate AI analysis for this node',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingNode(false);
    }
  };

  const analyzeFullGraph = async () => {
    if (!graphData) return;
    
    setIsLoadingGraph(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-graph`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: graphData.nodes,
            edges: graphData.edges,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to analyze graph');

      const data = await response.json();
      setGraphAnalysis(data.analysis);
      
      toast({
        title: 'Analysis complete',
        description: 'Full knowledge graph analysis generated with ICD-10 codes',
      });
    } catch (error) {
      console.error('Error analyzing graph:', error);
      toast({
        title: 'Analysis failed',
        description: 'Failed to generate full graph analysis',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingGraph(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'summary': return <Brain className="w-5 h-5" />;
      case 'medication': return <Pill className="w-5 h-5" />;
      case 'treatment': return <Activity className="w-5 h-5" />;
      case 'risk': return <AlertTriangle className="w-5 h-5" />;
      case 'trend': return <TrendingUp className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-primary text-primary-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-healthcare-green';
    if (confidence >= 0.7) return 'text-primary';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI-Powered Insights</h3>
            <p className="text-sm text-muted-foreground">
              Intelligent analysis of medical knowledge graph
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </Button>
          <Button
            variant={activeTab === 'details' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('details')}
            disabled={!selectedNode}
          >
            Node Details
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Full Graph Analysis Button */}
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold mb-1">Complete Graph Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Get comprehensive AI analysis with ICD-10 codes
                  </p>
                </div>
                <Button 
                  onClick={analyzeFullGraph} 
                  disabled={isLoadingGraph || !graphData}
                  variant="medical"
                >
                  {isLoadingGraph ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Analyze Graph
                    </>
                  )}
                </Button>
              </div>
              
              {graphAnalysis && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <div className="whitespace-pre-wrap text-sm">{graphAnalysis}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {insights.map((insight) => (
            <Card key={insight.id} className="glass border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {getInsightIcon(insight.type)}
                    {insight.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(insight.priority)}>
                      {insight.priority}
                    </Badge>
                    <span className={`text-sm font-medium ${getConfidenceColor(insight.confidence)}`}>
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {insight.content}
                </p>
                {insight.relatedNodes && insight.relatedNodes.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Related nodes:</span>
                      <div className="flex gap-1">
                        {insight.relatedNodes.map((nodeId) => (
                          <Badge key={nodeId} variant="outline" className="text-xs">
                            Node {nodeId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'details' && selectedNode && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {selectedNode.label} Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Analysis Section */}
            {isLoadingNode ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Generating AI analysis...</span>
              </div>
            ) : nodeAnalysis ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  AI Analysis & ICD-10 Codes
                </h4>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap text-sm">{nodeAnalysis}</div>
                </div>
              </div>
            ) : null}

            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Entity Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium capitalize">{selectedNode.type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ID:</span>
                  <p className="font-medium">{selectedNode.id}</p>
                </div>
              </div>
            </div>

            {selectedNode.data && (
              <div>
                <h4 className="font-semibold mb-2">Additional Data</h4>
                <div className="space-y-2">
                  {Object.entries(selectedNode.data).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{key}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2">Connections</h4>
              <p className="text-sm text-muted-foreground">
                Connected to {selectedNode.connections?.length || 0} other entities
              </p>
              {selectedNode.connections && selectedNode.connections.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedNode.connections.map((connId: string) => (
                    <Badge key={connId} variant="outline" className="text-xs">
                      {connId}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      )}

      {activeTab === 'details' && !selectedNode && (
        <Card className="glass border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="w-12 h-12 text-muted-foreground mb-4" />
            <h4 className="font-semibold mb-2">No Node Selected</h4>
            <p className="text-sm text-muted-foreground">
              Click on a node in the knowledge graph to view detailed insights
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};