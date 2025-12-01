import React, { useState } from 'react';
import { Brain, Upload, BarChart3, Menu, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeSection?: 'upload' | 'graph' | 'insights' | 'settings';
  onSectionChange?: (section: 'upload' | 'graph' | 'insights' | 'settings') => void;
  uploadedFilesCount?: number;
  nodesCount?: number;
  edgesCount?: number;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeSection = 'upload',
  onSectionChange,
  uploadedFilesCount = 0,
  nodesCount = 0,
  edgesCount = 0,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const navigationItems = [
    {
      id: 'upload' as const,
      label: 'Upload Data',
      icon: Upload,
      description: 'Import medical files',
    },
    {
      id: 'graph' as const,
      label: 'Knowledge Graph',
      icon: Brain,
      description: '3D visualization',
    },
    {
      id: 'insights' as const,
      label: 'AI Insights',
      icon: BarChart3,
      description: 'Smart analysis',
    },
    {
      id: 'upload' as const,
      label: 'Patient Records',
      icon: Users,
      description: 'View patient history',
      navigateTo: '/patients'
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-b border-glass-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-healthcare-blue to-healthcare-green">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">HealthGraph AI</h1>
                <p className="text-sm text-muted-foreground">
                  Knowledge Graph for Healthcare
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="hero" size="sm" className="hidden sm:flex">
              Generate Graph
            </Button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-healthcare-blue to-healthcare-green" />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:relative lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="glass-card h-full border-r border-glass-border">
            <nav className="p-6 pt-8">
              <div className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  
                  return (
                    <button
                      key={item.id + item.label}
                      onClick={() => {
                        if ((item as any).navigateTo) {
                          navigate((item as any).navigateTo);
                        } else if ((item as any).scrollTo) {
                          const element = document.getElementById((item as any).scrollTo);
                          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                          onSectionChange?.(item.id);
                        }
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-smooth",
                        isActive && !(item as any).scrollTo && !(item as any).navigateTo
                          ? "bg-primary text-primary-foreground shadow-glow-primary"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs opacity-75">{item.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Stats Card */}
            <div className="mx-6 mb-6 p-4 rounded-lg bg-muted/30">
              <h4 className="font-semibold mb-2">Current Session</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Files uploaded:</span>
                  <span className="font-medium">{uploadedFilesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nodes generated:</span>
                  <span className="font-medium">{nodesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connections:</span>
                  <span className="font-medium">{edgesCount}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};