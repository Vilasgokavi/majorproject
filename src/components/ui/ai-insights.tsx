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

  // Auto-analyze graph when data is available
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0 && !graphAnalysis && !isLoadingGraph) {
      analyzeFullGraph();
    }
  }, [graphData]);

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

  // Parse graph analysis into structured sections
  const parseAnalysis = (analysisText: string) => {
    if (!analysisText) return { keyInsights: [], treatments: [], risks: [], tests: [] };

    const sections = {
      keyInsights: [] as string[],
      treatments: [] as { title: string; description: string; priority: string }[],
      risks: [] as { title: string; description: string; severity: string }[],
      tests: [] as string[]
    };

    // Split by common section headers
    const lines = analysisText.split('\n').filter(line => line.trim());
    
    let currentSection = 'keyInsights';
    
    lines.forEach(line => {
      const lower = line.toLowerCase();
      
      if (lower.includes('treatment') || lower.includes('recommendation')) {
        currentSection = 'treatments';
      } else if (lower.includes('risk') || lower.includes('complication')) {
        currentSection = 'risks';
      } else if (lower.includes('test') || lower.includes('diagnostic')) {
        currentSection = 'tests';
      }
      
      // Extract content based on section
      if (line.startsWith('- ') || line.startsWith('• ') || line.match(/^\d+\./)) {
        const content = line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
        
        if (currentSection === 'keyInsights' && content.length > 20) {
          sections.keyInsights.push(content);
        } else if (currentSection === 'treatments' && content.length > 15) {
          sections.treatments.push({
            title: content.split(':')[0] || content.substring(0, 50),
            description: content.split(':')[1] || content,
            priority: content.toLowerCase().includes('urgent') || content.toLowerCase().includes('critical') ? 'High priority' : 'Medium priority'
          });
        } else if (currentSection === 'risks' && content.length > 15) {
          sections.risks.push({
            title: content.split(':')[0] || content.substring(0, 50),
            description: content.split(':')[1] || content,
            severity: content.toLowerCase().includes('severe') || content.toLowerCase().includes('high') ? 'High' : 'Medium'
          });
        } else if (currentSection === 'tests' && content.length > 10) {
          sections.tests.push(content);
        }
      }
    });

    // Fallback: if no structured data found, extract from full text
    if (sections.keyInsights.length === 0 && sections.treatments.length === 0) {
      const sentences = analysisText.match(/[^.!?]+[.!?]+/g) || [];
      sections.keyInsights = sentences.slice(0, 4).map(s => s.trim());
    }

    return sections;
  };

  const parsedAnalysis = parseAnalysis(graphAnalysis);

  return (
    <div className="space-y-6">
      {/* Key Insights Section */}
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="w-5 h-5 text-primary" />
            </div>
            <CardTitle>Key Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGraph ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : parsedAnalysis.keyInsights.length > 0 ? (
            <div className="space-y-3">
              {parsedAnalysis.keyInsights.map((insight, idx) => (
                <div key={idx} className="p-4 bg-muted/30 border border-border/50 rounded-lg">
                  <p className="text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Upload medical data to generate insights</p>
          )}
        </CardContent>
      </Card>

      {/* Two Column Layout for Treatment & Risk */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Treatment Recommendations */}
        <Card className="glass border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Activity className="w-5 h-5 text-secondary" />
              </div>
              <CardTitle>Treatment Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingGraph ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-secondary" />
              </div>
            ) : parsedAnalysis.treatments.length > 0 ? (
              <div className="space-y-4">
                {parsedAnalysis.treatments.map((treatment, idx) => (
                  <div key={idx} className="p-4 bg-secondary/5 border border-secondary/20 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm">{treatment.title}</h4>
                      <Badge className={treatment.priority.includes('High') ? 'bg-destructive' : 'bg-primary'}>
                        {treatment.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{treatment.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No treatment recommendations available</p>
            )}
          </CardContent>
        </Card>

        {/* Risk Factors */}
        <Card className="glass border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <CardTitle>Risk Factors</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingGraph ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-destructive" />
              </div>
            ) : parsedAnalysis.risks.length > 0 ? (
              <div className="space-y-4">
                {parsedAnalysis.risks.map((risk, idx) => (
                  <div key={idx} className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm">{risk.title}</h4>
                      <Badge variant={risk.severity === 'High' ? 'destructive' : 'secondary'}>
                        {risk.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{risk.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No risk factors identified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suggested Tests & Actions */}
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-healthcare-green/10">
              <TrendingUp className="w-5 h-5 text-healthcare-green" />
            </div>
            <CardTitle>Suggested Tests & Actions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGraph ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-healthcare-green" />
            </div>
          ) : parsedAnalysis.tests.length > 0 ? (
            <div>
              <h4 className="font-semibold mb-3 text-healthcare-green">Recommended Tests:</h4>
              <div className="space-y-2">
                {parsedAnalysis.tests.map((test, idx) => (
                  <div key={idx} className="p-3 bg-healthcare-green/5 border border-healthcare-green/20 rounded-lg">
                    <p className="text-sm">{test}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No test recommendations available</p>
          )}
        </CardContent>
      </Card>

      {/* Node-Specific Analysis - Only show when node is selected */}
      {selectedNode && (
        <Card className="glass border-border/50 border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-accent" />
              {selectedNode.label} - Detailed Node Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingNode ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <span className="ml-3 text-muted-foreground">Analyzing node...</span>
              </div>
            ) : nodeAnalysis ? (
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-accent" />
                  AI Node Summary
                </h4>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{nodeAnalysis}</div>
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
    </div>
  );
};