-- Create function to update timestamps first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for storing knowledge graphs
CREATE TABLE public.knowledge_graphs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  icd10_codes JSONB,
  graph_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_graphs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read on knowledge_graphs" 
ON public.knowledge_graphs 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on knowledge_graphs" 
ON public.knowledge_graphs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on knowledge_graphs" 
ON public.knowledge_graphs 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on knowledge_graphs" 
ON public.knowledge_graphs 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_knowledge_graphs_updated_at
BEFORE UPDATE ON public.knowledge_graphs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();