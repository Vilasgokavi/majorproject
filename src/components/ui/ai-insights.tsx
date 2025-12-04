import React, { useState, useEffect } from 'react';
import { Brain, Lightbulb, TrendingUp, AlertTriangle, Pill, Activity, Loader2, TestTube, FileText, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface StructuredAnalysis {
  patientSummary: string;
  keyInsights: string[];
  treatmentRecommendations: Array<{
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
  }>;
  riskFactors: Array<{
    title: string;
    description: string;
    severity: 'High' | 'Medium' | 'Low';
  }>;
  suggestedTests: Array<{
    name: string;
    reason: string;
    urgency: 'Urgent' | 'Routine' | 'Follow-up';
  }>;
  icd10Codes: Array<{
    code: string;
    description: string;
  }>;
  diagnosisSummary: string;
  medicationAnalysis: string;
}

interface AIInsightsProps {
  selectedNode?: any;
  graphData?: { nodes: any[]; edges: any[] };
  graphAnalysis?: string;
  structuredAnalysis?: StructuredAnalysis | null;
}

export const AIInsights: React.FC<AIInsightsProps> = ({
  selectedNode,
  graphData,
  graphAnalysis,
  structuredAnalysis: propStructuredAnalysis,
}) => {
  const [nodeAnalysis, setNodeAnalysis] = useState<string>('');
  const [localGraphAnalysis, setLocalGraphAnalysis] = useState<string>('');
  const [structuredData, setStructuredData] = useState<StructuredAnalysis | null>(null);
  const [isLoadingNode, setIsLoadingNode] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const { toast } = useToast();

  // Use prop if provided, otherwise use local state
  const currentAnalysis = graphAnalysis || localGraphAnalysis;
  
  // Use prop structured data if provided, otherwise use local parsed data
  const effectiveStructuredData = propStructuredAnalysis || structuredData;

  // Parse structured analysis when it changes (only if no prop provided)
  useEffect(() => {
    if (!propStructuredAnalysis && currentAnalysis) {
      try {
        const parsed = JSON.parse(currentAnalysis);
        setStructuredData(parsed);
      } catch {
        // If not valid JSON, try to parse from text
        setStructuredData(null);
      }
    }
  }, [currentAnalysis, propStructuredAnalysis]);

  // Analyze selected node when it changes
  useEffect(() => {
    if (selectedNode && graphData) {
      analyzeNode();
    }
  }, [selectedNode]);

  // Auto-analyze graph when data is available and no analysis exists
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0 && !currentAnalysis && !isLoadingGraph) {
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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            nodes: graphData.nodes,
            edges: graphData.edges,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: 'Rate limit exceeded',
            description: 'Please wait a moment before trying again',
            variant: 'destructive',
          });
          return;
        }
        throw new Error('Failed to analyze graph');
      }

      const data = await response.json();
      
      if (data.structured) {
        setStructuredData(data.structured);
      }
      setLocalGraphAnalysis(data.analysis);
      
      toast({
        title: 'Analysis complete',
        description: 'Full knowledge graph analysis generated',
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-destructive text-destructive-foreground';
      case 'Medium': return 'bg-primary text-primary-foreground';
      case 'Low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Urgent': return 'bg-destructive text-destructive-foreground';
      case 'Routine': return 'bg-secondary text-secondary-foreground';
      case 'Follow-up': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const hasNoData = !graphData || graphData.nodes.length === 0;

  if (hasNoData && !isLoadingGraph) {
    return (
      <div className="space-y-6">
        <Card className="glass border-border/50">
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-muted mb-4">
              <Brain className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
            <p className="text-muted-foreground">
              Upload medical files and generate a knowledge graph to see AI-powered insights
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Summary */}
      {effectiveStructuredData?.patientSummary && (
        <Card className="glass border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Patient Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{effectiveStructuredData.patientSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-healthcare-blue/10">
              <Lightbulb className="w-5 h-5 text-healthcare-blue" />
            </div>
            <CardTitle>Key Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGraph ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Generating AI insights...</span>
            </div>
          ) : effectiveStructuredData?.keyInsights && effectiveStructuredData.keyInsights.length > 0 ? (
            <div className="space-y-3">
              {effectiveStructuredData.keyInsights.map((insight, idx) => (
                <div key={idx} className="p-4 bg-muted/30 border border-border/50 rounded-lg">
                  <p className="text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Analyzing medical data to generate insights...</p>
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
            ) : effectiveStructuredData?.treatmentRecommendations && effectiveStructuredData.treatmentRecommendations.length > 0 ? (
              <div className="space-y-4">
                {effectiveStructuredData.treatmentRecommendations.map((treatment, idx) => (
                  <div key={idx} className="p-4 bg-secondary/5 border border-secondary/20 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm flex-1 pr-2">{treatment.title}</h4>
                      <Badge className={getPriorityColor(treatment.priority)}>
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
            ) : effectiveStructuredData?.riskFactors && effectiveStructuredData.riskFactors.length > 0 ? (
              <div className="space-y-4">
                {effectiveStructuredData.riskFactors.map((risk, idx) => (
                  <div key={idx} className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm flex-1 pr-2">{risk.title}</h4>
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

      {/* Suggested Tests */}
      <Card className="glass border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-healthcare-green/10">
              <TestTube className="w-5 h-5 text-healthcare-green" />
            </div>
            <CardTitle>Suggested Tests</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGraph ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-healthcare-green" />
            </div>
          ) : effectiveStructuredData?.suggestedTests && effectiveStructuredData.suggestedTests.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {effectiveStructuredData.suggestedTests.map((test, idx) => (
                <div key={idx} className="p-4 bg-healthcare-green/5 border border-healthcare-green/20 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{test.name}</h4>
                    <Badge className={getUrgencyColor(test.urgency)}>
                      {test.urgency}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{test.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No test recommendations available</p>
          )}
        </CardContent>
      </Card>

      {/* Diagnosis & Medication Analysis */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Diagnosis Summary */}
        {effectiveStructuredData?.diagnosisSummary && (
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Stethoscope className="w-5 h-5 text-primary" />
                </div>
                <CardTitle>Diagnosis Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{effectiveStructuredData.diagnosisSummary}</p>
            </CardContent>
          </Card>
        )}

        {/* Medication Analysis */}
        {effectiveStructuredData?.medicationAnalysis && (
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Pill className="w-5 h-5 text-secondary" />
                </div>
                <CardTitle>Medication Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{effectiveStructuredData.medicationAnalysis}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ICD-10 Codes */}
      {effectiveStructuredData?.icd10Codes && effectiveStructuredData.icd10Codes.length > 0 && (
        <Card className="glass border-border/50 bg-gradient-to-r from-primary/10 to-secondary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>ICD-10 Codes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {effectiveStructuredData.icd10Codes.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50"
                >
                  <Badge 
                    className="px-3 py-1 text-sm font-mono bg-primary text-primary-foreground shrink-0"
                  >
                    {item.code}
                  </Badge>
                  <p className="text-sm text-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
