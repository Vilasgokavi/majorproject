import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { FileUpload } from '@/components/ui/file-upload';
import { KnowledgeGraph } from '@/components/ui/knowledge-graph';
import { AIInsights } from '@/components/ui/ai-insights';
import { PatientInfoForm } from '@/components/ui/patient-info-form';
import { PatientList } from '@/components/ui/patient-list';
import { Brain, Upload, Zap, TrendingUp, Loader2, Activity, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [activeSection, setActiveSection] = useState<'upload' | 'graph' | 'insights' | 'settings'>('upload');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any>(null);
  const [nodeAnalysis, setNodeAnalysis] = useState<string>('');
  const [isLoadingNode, setIsLoadingNode] = useState(false);
  const [graphAnalysis, setGraphAnalysis] = useState<string>('');
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [patientInfo, setPatientInfo] = useState<{ name: string; age: string; pid: string } | null>(null);
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);
  const [viewingPatient, setViewingPatient] = useState(false);
  const { toast } = useToast();

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
  };

  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    toast({
      title: 'File deleted',
      description: 'The uploaded file has been removed',
    });
  };

  const saveKnowledgeGraph = async (patientId: string, nodes: any[], edges: any[], analysis: string) => {
    try {
      const icd10 = extractICD10Codes(analysis);
      
      const { data: existing } = await supabase
        .from("knowledge_graphs")
        .select("id")
        .eq("patient_id", patientId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("knowledge_graphs")
          .update({
            nodes,
            edges,
            icd10_codes: icd10,
            graph_analysis: analysis,
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("knowledge_graphs")
          .insert({
            patient_id: patientId,
            nodes,
            edges,
            icd10_codes: icd10,
            graph_analysis: analysis,
          });
      }
    } catch (error: any) {
      console.error("Error saving knowledge graph:", error);
    }
  };

  const loadPatientGraph = async (patientId: string) => {
    try {
      const { data: patient } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();

      const { data: graph } = await supabase
        .from("knowledge_graphs")
        .select("*")
        .eq("patient_id", patientId)
        .maybeSingle();

      if (graph) {
        setGraphData({ nodes: graph.nodes, edges: graph.edges });
        setGraphAnalysis(graph.graph_analysis || "");
      }

      const { data: files } = await supabase
        .from("patient_files")
        .select("*")
        .eq("patient_id", patientId);

      if (files) {
        setUploadedFiles(
          files.map((f) => ({
            id: f.id,
            name: f.file_name,
            size: f.file_size,
            type: f.file_type,
          }))
        );
      }

      setPatientInfo({
        name: patient.name,
        age: patient.age,
        pid: patient.pid,
      });
      setCurrentPatientId(patientId);
      setViewingPatient(true);
      setActiveSection("graph");

      toast({
        title: "Patient Loaded",
        description: `Viewing ${patient?.name}'s knowledge graph`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNewPatient = () => {
    setUploadedFiles([]);
    setGraphData(null);
    setGraphAnalysis("");
    setNodeAnalysis("");
    setSelectedNode(null);
    setPatientInfo(null);
    setCurrentPatientId(null);
    setViewingPatient(false);
    setActiveSection("upload");
  };

  const extractICD10Codes = (analysisText: string): Array<{ code: string; description: string }> => {
    if (!analysisText) return [];
    
    // Pattern to match ICD-10 code followed by description (up to the next code or end of line)
    const icdPattern = /([A-Z]\d{2}(?:[.]\d{1,2})?)\s*[-–:]\s*([^.\n]+?)(?=\s*[A-Z]\d{2}[.:]|\n|$)/g;
    const results: Array<{ code: string; description: string }> = [];
    const seen = new Set<string>();
    
    let match;
    while ((match = icdPattern.exec(analysisText)) !== null) {
      const code = match[1].trim();
      const description = match[2].trim();
      
      if (!seen.has(code)) {
        results.push({ code, description });
        seen.add(code);
      }
    }
    
    return results;
  };

  // Analyze full knowledge graph when it changes
  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return;

    const analyzeGraph = async () => {
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

        if (!response.ok) throw new Error('Failed to analyze graph');

        const data = await response.json();
        setGraphAnalysis(data.analysis);

        // Save to database if we have a current patient
        if (currentPatientId) {
          await saveKnowledgeGraph(
            currentPatientId,
            graphData.nodes,
            graphData.edges,
            data.analysis
          );
        }
      } catch (error) {
        console.error('Error analyzing graph:', error);
        toast({
          title: 'Graph analysis failed',
          description: 'Failed to generate AI analysis for the knowledge graph',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingGraph(false);
      }
    };

    analyzeGraph();
  }, [graphData, currentPatientId, toast]);

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
          headers: {
            'Content-Type': 'application/json',
            // Required for calling Supabase Edge Functions from the browser
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

  const renderContent = () => {
    switch (activeSection) {
      case 'upload':
        return (
          <div className="space-y-8">
            {/* Welcome Section */}
            <Card className="glass border-border/50 overflow-hidden">
              <CardContent className="pt-8 pb-12">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-r from-healthcare-blue/20 to-healthcare-green/20">
                    <Brain className="w-12 h-12 text-primary" />
                  </div>
                  
                  <div>
                    <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-healthcare-blue to-healthcare-green bg-clip-text text-transparent">
                      Welcome to HealthGraph AI
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      Transform medical data into intelligent knowledge graphs with AI-powered insights
                    </p>
                  </div>

                  {/* Features Highlight */}
                  <div className="grid md:grid-cols-3 gap-6 mt-8 max-w-4xl mx-auto">
                    <div className="p-6 rounded-lg bg-muted/30 space-y-3">
                      <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">Upload Medical Data</h3>
                      <p className="text-sm text-muted-foreground">
                        Import patient records, lab results, and medical documents for analysis
                      </p>
                    </div>

                    <div className="p-6 rounded-lg bg-muted/30 space-y-3">
                      <div className="inline-flex items-center justify-center p-3 rounded-full bg-secondary/10">
                        <Brain className="w-6 h-6 text-secondary" />
                      </div>
                      <h3 className="font-semibold text-lg">3D Knowledge Graph</h3>
                      <p className="text-sm text-muted-foreground">
                        Visualize relationships between medical entities in an interactive graph
                      </p>
                    </div>

                    <div className="p-6 rounded-lg bg-muted/30 space-y-3">
                      <div className="inline-flex items-center justify-center p-3 rounded-full bg-accent/10">
                        <Zap className="w-6 h-6 text-accent" />
                      </div>
                      <h3 className="font-semibold text-lg">AI-Powered Insights</h3>
                      <p className="text-sm text-muted-foreground">
                        Get intelligent analysis, ICD-10 codes, and clinical recommendations
                      </p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button onClick={() => setActiveSection('graph')} variant="hero" size="lg" className="group">
                      <Brain className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                      Get Started
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'graph':
        if (!uploadedFiles.length && !graphData) {
          return (
            <div className="space-y-6">
              <Card className="glass border-border/50">
                <CardContent className="pt-6 py-12 text-center">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-muted mb-4">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
                  <p className="text-muted-foreground mb-6">
                    Upload medical files to generate and visualize a knowledge graph
                  </p>
                  <Button onClick={() => setActiveSection('upload')} variant="hero">
                    <Upload className="w-4 h-4" />
                    Go to Upload
                  </Button>
                </CardContent>
              </Card>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">2D Knowledge Graph</h2>
                <p className="text-muted-foreground">
                  Interactive visualization of medical entities and relationships
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="medical">
                  <TrendingUp className="w-4 h-4" />
                  Analyze
                </Button>
                <Button variant="hero">
                  <Zap className="w-4 h-4" />
                  Generate Insights
                </Button>
              </div>
            </div>
            <KnowledgeGraph 
              onNodeClick={handleNodeClick}
              nodes={graphData?.nodes}
              edges={graphData?.edges}
              patientId={patientInfo?.pid}
            />

            {/* ICD-10 Codes Section */}
            {graphAnalysis && !isLoadingGraph && (
              <Card className="glass border-border/50 bg-gradient-to-r from-primary/10 to-secondary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="w-5 h-5 text-primary" />
                    ICD-10 Codes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingGraph ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {extractICD10Codes(graphAnalysis).length > 0 ? (
                        extractICD10Codes(graphAnalysis).map((item, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                          >
                            <Badge 
                              className="px-3 py-1 text-sm font-mono bg-primary text-primary-foreground shrink-0"
                            >
                              {item.code}
                            </Badge>
                            <p className="text-sm text-foreground leading-relaxed">{item.description}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No ICD-10 codes identified in this analysis</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Node Analysis Section */}
            {selectedNode && (
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    {selectedNode.label} - AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  {selectedNode.data && Object.keys(selectedNode.data).length > 0 && (
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

      case 'insights':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">AI-Powered Insights</h2>
              <p className="text-muted-foreground">
                Intelligent analysis and recommendations based on your knowledge graph
              </p>
            </div>
            <AIInsights selectedNode={selectedNode} graphData={graphData} />
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Settings</h2>
              <p className="text-muted-foreground">
                Configure your healthcare knowledge graph preferences
              </p>
            </div>
            <Card className="glass border-border/50">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Settings panel coming soon...
                </p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      uploadedFilesCount={uploadedFiles.length}
      nodesCount={graphData?.nodes?.length || 0}
      edgesCount={graphData?.edges?.length || 0}
    >
      {renderContent()}
    </DashboardLayout>
  );
};

export default Index;
