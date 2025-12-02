import React from 'react';
import { PatientList } from '@/components/ui/patient-list';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PatientRecords = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-b border-glass-border sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-healthcare-blue to-healthcare-green">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Patient Records</h1>
                <p className="text-sm text-muted-foreground">
                  View and manage patient history
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        <PatientList onViewPatient={(patientId) => {
          navigate('/', { state: { selectedPatient: { id: patientId } } });
        }} />
      </main>
    </div>
  );
};

export default PatientRecords;
