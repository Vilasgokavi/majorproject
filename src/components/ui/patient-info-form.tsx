import React, { useState } from 'react';
import { User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PatientInfo {
  name: string;
  age: string;
  pid: string;
}

interface PatientInfoFormProps {
  onSubmit: (patientInfo: PatientInfo) => void;
  onPatientCreated?: (patientId: string) => void;
}

export const PatientInfoForm: React.FC<PatientInfoFormProps> = ({ onSubmit, onPatientCreated }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const generatePID = (name: string, age: string): string => {
    // Generate PID: First 3 letters of name (uppercase) + Age + Random 4-digit number
    const namePrefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase().padEnd(3, 'X');
    const ageStr = age.padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${namePrefix}${ageStr}${randomNum}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !age.trim()) {
      return;
    }

    setIsSubmitting(true);
    const pid = generatePID(name, age);

    try {
      // Save patient to database
      const { data, error } = await supabase
        .from('patients')
        .insert({
          name: name.trim(),
          age: age.trim(),
          pid,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Patient registered",
        description: `Patient ID: ${pid}`,
      });

      onSubmit({ name: name.trim(), age: age.trim(), pid });
      if (onPatientCreated && data) {
        onPatientCreated(data.id);
      }
    } catch (error) {
      console.error('Error saving patient:', error);
      toast({
        title: "Error",
        description: "Failed to register patient. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = name.trim().length > 0 && age.trim().length > 0 && !isNaN(Number(age));

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Patient Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient-name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Patient Name
            </Label>
            <Input
              id="patient-name"
              type="text"
              placeholder="Enter patient name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background/50"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-age" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Patient Age
            </Label>
            <Input
              id="patient-age"
              type="number"
              placeholder="Enter patient age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="bg-background/50"
              min="0"
              max="150"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            variant="hero"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? 'Registering...' : 'Generate PID & Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
