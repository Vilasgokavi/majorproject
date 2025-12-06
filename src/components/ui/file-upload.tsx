import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  status?: 'pending' | 'processing' | 'valid' | 'invalid';
  nodeCount?: number;
}

interface PatientInfo {
  name: string;
  age: string;
  pid: string;
}

interface FileUploadProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  onFileRemoved?: (fileId: string) => void;
  onKnowledgeGraphGenerated?: (graphData: any) => void;
  patientInfo: PatientInfo | null;
  existingGraphData?: { nodes: any[]; edges: any[] } | null;
}

interface ProcessingStats {
  total: number;
  processed: number;
  valid: number;
  invalid: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesUploaded,
  onFileRemoved,
  onKnowledgeGraphGenerated,
  patientInfo,
  existingGraphData,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const { toast } = useToast();

  const mergeGraphData = (existing: { nodes: any[]; edges: any[] } | null, newData: { nodes: any[]; edges: any[] }) => {
    if (!existing || !existing.nodes?.length) {
      return newData;
    }

    // Create maps for deduplication based on node labels
    const existingNodeLabels = new Set(existing.nodes.map((n: any) => n.label?.toLowerCase()));
    const existingEdgeKeys = new Set(
      existing.edges.map((e: any) => `${e.source}-${e.target}-${e.label}`.toLowerCase())
    );

    // Filter new nodes that don't already exist
    const uniqueNewNodes = newData.nodes.filter(
      (n: any) => !existingNodeLabels.has(n.label?.toLowerCase())
    );

    // Filter new edges that don't already exist
    const uniqueNewEdges = newData.edges.filter(
      (e: any) => !existingEdgeKeys.has(`${e.source}-${e.target}-${e.label}`.toLowerCase())
    );

    // Merge nodes and edges
    return {
      nodes: [...existing.nodes, ...uniqueNewNodes],
      edges: [...existing.edges, ...uniqueNewEdges],
    };
  };

  const updateFileStatus = (fileId: string, status: UploadedFile['status'], nodeCount?: number) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status, nodeCount } : f
    ));
  };

  const processWithAI = async (file: UploadedFile, accumulatedGraph: { nodes: any[]; edges: any[] } | null): Promise<{ graph: { nodes: any[]; edges: any[] } | null; isValid: boolean }> => {
    updateFileStatus(file.id, 'processing');
    
    try {
      const formData = new FormData();
      formData.append('file', file.file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-knowledge`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const graphData = await response.json();

      // Check if non-medical data
      if (!response.ok || graphData.error || graphData.isMedical === false) {
        updateFileStatus(file.id, 'invalid');
        return { graph: accumulatedGraph, isValid: false };
      }
      
      // Valid medical data - merge with accumulated graph
      const mergedGraph = mergeGraphData(accumulatedGraph, graphData);
      const newNodesCount = graphData.nodes?.length || 0;
      updateFileStatus(file.id, 'valid', newNodesCount);
      
      return { graph: mergedGraph, isValid: true };
    } catch (error) {
      console.error('Error processing file:', error);
      updateFileStatus(file.id, 'invalid');
      return { graph: accumulatedGraph, isValid: false };
    }
  };

  const processAllFiles = async (files: UploadedFile[]) => {
    setIsProcessing(true);
    setProcessingStats({ total: files.length, processed: 0, valid: 0, invalid: 0 });
    
    let accumulatedGraph = existingGraphData || null;
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await processWithAI(file, accumulatedGraph);
      accumulatedGraph = result.graph;
      
      if (result.isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
      
      setProcessingStats({
        total: files.length,
        processed: i + 1,
        valid: validCount,
        invalid: invalidCount,
      });
    }

    // Show final summary
    if (validCount > 0 && accumulatedGraph && accumulatedGraph.nodes?.length > 0) {
      toast({
        title: "Processing Complete",
        description: `${validCount} medical file(s) processed. ${invalidCount > 0 ? `${invalidCount} non-medical file(s) skipped.` : ''} Graph has ${accumulatedGraph.nodes.length} nodes.`,
      });
      onKnowledgeGraphGenerated?.(accumulatedGraph);
    } else if (invalidCount > 0 && validCount === 0) {
      toast({
        title: "No Medical Data Found",
        description: `All ${invalidCount} file(s) were non-medical and skipped. Please upload medical records, prescriptions, or lab results.`,
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!patientInfo) return;

    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      status: 'pending' as const,
    }));

    // Upload files to storage and save metadata
    for (const fileData of newFiles) {
      setUploadProgress(prev => ({ ...prev, [fileData.id]: 0 }));
      
      try {
        // Find or create patient in database
        let patientId: string | null = null;
        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('id')
          .eq('pid', patientInfo.pid)
          .single();

        if (patientError || !patient) {
          const { data: inserted, error: insertError } = await supabase
            .from('patients')
            .insert({
              pid: patientInfo.pid,
              name: patientInfo.name,
              age: patientInfo.age,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          patientId = inserted.id;
        } else {
          patientId = patient.id;
        }

        // Upload file to storage
        const filePath = `${patientInfo.pid}/${fileData.name}`;
        const { error: uploadError } = await supabase.storage
          .from('patient-files')
          .upload(filePath, fileData.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Save file metadata to database
        const { error: metadataError } = await supabase
          .from('patient_files')
          .insert({
            patient_id: patientId as string,
            file_name: fileData.name,
            file_size: fileData.size,
            file_type: fileData.type,
            file_path: filePath,
          });

        if (metadataError) throw metadataError;

        // Update progress to 100%
        setUploadProgress(prev => ({ ...prev, [fileData.id]: 100 }));
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${fileData.name}`,
          variant: "destructive",
        });
        continue;
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    onFilesUploaded?.(newFiles);

    toast({
      title: "Files uploaded",
      description: `${newFiles.length} file(s) uploaded. Processing...`,
    });

    // Process ALL files with AI and merge results
    if (newFiles.length > 0) {
      setTimeout(() => processAllFiles(newFiles), 500);
    }
  }, [onFilesUploaded, toast, onKnowledgeGraphGenerated, patientInfo]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
    },
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
    onFileRemoved?.(fileId);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (type.includes('csv')) return <FileSpreadsheet className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Don't allow file upload if patient info is not provided
  if (!patientInfo) {
    return (
      <div className="glass-card text-center py-12">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-muted mb-4">
          <Upload className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Patient Information Required</h3>
        <p className="text-muted-foreground">
          Please provide patient information before uploading files
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Info Display */}
      <div className="glass-card p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Patient ID</p>
            <p className="font-mono font-bold text-lg text-primary">{patientInfo.pid}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-semibold">{patientInfo.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Age</p>
            <p className="font-semibold">{patientInfo.age} years</p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          glass-card border-2 border-dashed cursor-pointer transition-all duration-300
          ${isDragActive 
            ? 'border-primary bg-primary/5 scale-105' 
            : 'border-border hover:border-primary/50 hover:bg-primary/5'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Upload className={`w-12 h-12 mb-4 transition-colors ${
            isDragActive ? 'text-primary' : 'text-muted-foreground'
          }`} />
          <h3 className="text-lg font-semibold mb-2">
            {isDragActive ? 'Drop files here' : isProcessing ? 'Processing Files...' : 'Upload Medical Data'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {isProcessing && processingStats 
              ? `Processing ${processingStats.processed}/${processingStats.total} files (${processingStats.valid} valid, ${processingStats.invalid} skipped)` 
              : 'Drag and drop multiple files or click to browse. Non-medical files will be automatically filtered.'}
          </p>
          <div className="flex flex-wrap gap-2 justify-center text-sm text-muted-foreground">
            <span className="px-2 py-1 bg-muted rounded-md">CSV</span>
            <span className="px-2 py-1 bg-muted rounded-md">Text Notes</span>
            <span className="px-2 py-1 bg-muted rounded-md">Medical Images</span>
          </div>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="glass-card">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Uploaded Files ({uploadedFiles.length})
            {processingStats && (
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {processingStats.valid} medical, {processingStats.invalid} skipped
              </span>
            )}
          </h4>
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div 
                key={file.id} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  file.status === 'valid' 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : file.status === 'invalid' 
                    ? 'bg-red-500/10 border border-red-500/30' 
                    : file.status === 'processing'
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-muted/50'
                }`}
              >
                <div className={`${
                  file.status === 'valid' ? 'text-green-500' : 
                  file.status === 'invalid' ? 'text-red-500' : 'text-primary'
                }`}>
                  {file.status === 'processing' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : file.status === 'valid' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : file.status === 'invalid' ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {file.status === 'valid' && file.nodeCount 
                      ? `${file.nodeCount} entities extracted` 
                      : file.status === 'invalid' 
                      ? 'Non-medical data - skipped'
                      : file.status === 'processing'
                      ? 'Analyzing content...'
                      : formatFileSize(file.size)}
                  </p>
                  {uploadProgress[file.id] !== undefined && uploadProgress[file.id] < 100 && (
                    <Progress 
                      value={uploadProgress[file.id]} 
                      className="h-2 mt-2"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {file.status === 'valid' && (
                    <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">
                      Medical
                    </Badge>
                  )}
                  {file.status === 'invalid' && (
                    <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/30">
                      Skipped
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};