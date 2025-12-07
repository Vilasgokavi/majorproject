-- Add DELETE policy for patients table
CREATE POLICY "Allow public delete on patients"
ON public.patients
FOR DELETE
USING (true);

-- Add DELETE policy for patient_files table  
CREATE POLICY "Allow public delete on patient_files"
ON public.patient_files
FOR DELETE
USING (true);