import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Eye, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Patient {
  id: string;
  pid: string;
  name: string;
  age: string;
  created_at: string;
}

interface PatientListProps {
  onViewPatient: (patientId: string) => void;
}

export const PatientList = ({ onViewPatient }: PatientListProps) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletePatientId, setDeletePatientId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePatientId) return;

    try {
      setDeleting(true);

      // Delete patient files from storage
      const { data: files } = await supabase
        .from("patient_files")
        .select("file_path")
        .eq("patient_id", deletePatientId);

      if (files && files.length > 0) {
        const filePaths = files.map((f) => f.file_path);
        await supabase.storage.from("patient-files").remove(filePaths);
      }

      // Delete patient (cascade will handle patient_files and knowledge_graphs)
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", deletePatientId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Patient deleted successfully",
      });

      setPatients(patients.filter((p) => p.id !== deletePatientId));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeletePatientId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPatients = patients.filter((patient) => {
    const query = searchQuery.toLowerCase();
    return (
      patient.name.toLowerCase().includes(query) ||
      patient.pid.toLowerCase().includes(query) ||
      patient.age.toLowerCase().includes(query)
    );
  });

  if (patients.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No patients found. Upload files to create a patient record.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, PID, or age..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      
      {filteredPatients.length === 0 ? (
        <div className="text-center p-8">
          <p className="text-muted-foreground">No patients match your search.</p>
        </div>
      ) : (
        <div className="grid gap-4">
        {filteredPatients.map((patient) => (
          <Card
            key={patient.id}
            className="p-4 bg-card border-border/50 hover:border-primary/50 transition-all"
          >
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">{patient.name}</h3>
                <p className="text-sm text-muted-foreground">PID: {patient.pid}</p>
                <p className="text-sm text-muted-foreground">Age: {patient.age}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created: {new Date(patient.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onViewPatient(patient.id)}
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Graph
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeletePatientId(patient.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      )}

      <AlertDialog open={!!deletePatientId} onOpenChange={() => setDeletePatientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this patient? This will permanently delete all
              associated files and knowledge graphs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
