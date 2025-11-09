-- Create patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  age TEXT NOT NULL,
  pid TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on patients table
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert patients (public facing)
CREATE POLICY "Allow public insert on patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow anyone to read patients
CREATE POLICY "Allow public read on patients" 
ON public.patients 
FOR SELECT 
USING (true);

-- Create patient_files table
CREATE TABLE public.patient_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on patient_files table
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert patient files
CREATE POLICY "Allow public insert on patient_files" 
ON public.patient_files 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow anyone to read patient files
CREATE POLICY "Allow public read on patient_files" 
ON public.patient_files 
FOR SELECT 
USING (true);

-- Create storage bucket for patient files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient-files', 'patient-files', true);

-- Create policy to allow anyone to upload files
CREATE POLICY "Allow public upload on patient-files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'patient-files');

-- Create policy to allow anyone to read files
CREATE POLICY "Allow public read on patient-files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'patient-files');