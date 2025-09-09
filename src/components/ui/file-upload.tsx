import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

interface FileUploadProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  onFileRemoved?: (fileId: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesUploaded,
  onFileRemoved,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));

    // Simulate upload progress
    newFiles.forEach(file => {
      setUploadProgress(prev => ({ ...prev, [file.id]: 0 }));
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const currentProgress = prev[file.id] || 0;
          if (currentProgress >= 100) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [file.id]: currentProgress + 10 };
        });
      }, 100);
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
    onFilesUploaded?.(newFiles);

    toast({
      title: "Files uploaded",
      description: `${newFiles.length} file(s) uploaded successfully`,
    });
  }, [onFilesUploaded, toast]);

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

  return (
    <div className="space-y-6">
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
            {isDragActive ? 'Drop files here' : 'Upload Medical Data'}
          </h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop your files or click to browse
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