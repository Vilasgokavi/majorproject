import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
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
  const [processingQueue, setProcessingQueue] = useState<UploadedFile[]>([]);
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

  const processWithAI = async (file: UploadedFile, accumulatedGraph: { nodes: any[]; edges: any[] } | null) => {
    try {
      const formData = new FormData();
      formData.append('file', file.file);

      toast({
        title: "Processing file",
        description: `Extracting entities from ${file.name}...`,
      });

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

      if (!response.ok || graphData.error || graphData.isMedical === false) {
        removeFile(file.id);
        toast({
          title: "Invalid file",
          description: graphData.error || 'Failed to process file. Please upload medical data only.',
          variant: "destructive",
        });
        return accumulatedGraph;
      }
      
      // Merge new data with accumulated graph
      const mergedGraph = mergeGraphData(accumulatedGraph, graphData);
      
      toast({
        title: "File processed",
        description: `Added ${graphData.nodes?.length || 0} entities from ${file.name}`,
      });

      return mergedGraph;
    } catch (error) {
      console.error('Error processing file:', error);
      removeFile(file.id);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to extract knowledge graph",
        variant: "destructive",
      });
      return accumulatedGraph;
    }
  };

  const processAllFiles = async (files: UploadedFile[]) => {
    setIsProcessing(true);
    
    // Start with existing graph data if available
    let accumulatedGraph = existingGraphData || null;

    for (const file of files) {
      accumulatedGraph = await processWithAI(file, accumulatedGraph);
    }

    if (accumulatedGraph && accumulatedGraph.nodes?.length > 0) {
      toast({
        title: "All files processed!",
        description: `Knowledge graph now has ${accumulatedGraph.nodes.length} nodes and ${accumulatedGraph.edges.length} relationships`,
      });
      onKnowledgeGraphGenerated?.(accumulatedGraph);
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
            {isDragActive ? 'Drop files here' : isProcessing ? 'Processing...' : 'Upload Medical Data'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {isProcessing ? 'Extracting knowledge graph with AI...' : 'Drag and drop your files or click to browse'}
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
          </h4>
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="text-primary">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                  {uploadProgress[file.id] !== undefined && uploadProgress[file.id] < 100 && (
                    <Progress 
                      value={uploadProgress[file.id]} 
                      className="h-2 mt-2"
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};