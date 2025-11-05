import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { FileUpload } from '@/components/ui/file-upload';
import { KnowledgeGraph } from '@/components/ui/knowledge-graph';
import { AIInsights } from '@/components/ui/ai-insights';
import { Brain, Upload, Zap, TrendingUp, Loader2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [activeSection, setActiveSection] = useState<'upload' | 'graph' | 'insights' | 'settings'>('upload');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<any>(null);
  const [nodeAnalysis, setNodeAnalysis] = useState<string>('');
  const [isLoadingNode, setIsLoadingNode] = useState(false);
  const { toast } = useToast();

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
  };

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

  const renderContent = () => {
    switch (activeSection) {
      case 'upload':
        return (
          <div className="space-y-6">
            {/* Hero Section */}
            <div className="glass-card text-center py-12">
              <div className="max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-gradient-to-r from-healthcare-blue to-healthcare-green mb-6">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-healthcare-blue to-healthcare-green bg-clip-text text-transparent">
                  AI-Powered Healthcare Knowledge Graph
                </h1>
                <p className="text-xl text-muted-foreground mb-8">
                  Transform your medical data into intelligent, interactive 2D knowledge graphs
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button variant="hero" size="lg">
                    <Upload className="w-5 h-5" />
                    Start Upload
                  </Button>
                  <Button variant="glass" size="lg">
                    <Brain className="w-5 h-5" />
                    View Demo Graph
                  </Button>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Multi-format Support
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Upload CSV files, text notes, and medical images. Our AI extracts entities and relationships automatically.
                  </p>
                </CardContent>
              </Card>

              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-secondary" />
                    2D Visualization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Interactive 2D knowledge graphs with zoom, pan, and filtering capabilities.
                  </p>
                </CardContent>
              </Card>

              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-healthcare-green" />
                    AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Get intelligent summaries, treatment suggestions, and medication recommendations powered by Gemini AI.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Uploaded Files Display */}
            {uploadedFiles.length > 0 && (
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Uploaded Medical Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {uploadedFiles.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Badge variant="outline">Processed</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* File Upload Section */}
            <FileUpload
              onFilesUploaded={(files) => {
                setUploadedFiles(files);
              }}
              onFileRemoved={(fileId) => {
                setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
              }}
              onKnowledgeGraphGenerated={(data) => {
                setGraphData(data);
                // Auto-switch to graph view after extraction
                setTimeout(() => setActiveSection('graph'), 1500);
              }}
            />
          </div>
        );

      case 'graph':
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
            />

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
