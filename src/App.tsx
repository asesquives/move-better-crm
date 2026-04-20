import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import AgendaPage from "@/pages/Agenda";
import ClientesPage from "@/pages/Clientes";
import PaquetesPage from "@/pages/Paquetes";
import IngresosPage from "@/pages/Ingresos";
import DisponibilidadPage from "@/pages/Disponibilidad";
import EquipoPage from "@/pages/Equipo";
import CatalogoPage from "@/pages/Catalogo";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
    <Route path="/clientes" element={<ProtectedRoute><ClientesPage /></ProtectedRoute>} />
    <Route path="/paquetes" element={<ProtectedRoute><PaquetesPage /></ProtectedRoute>} />
    <Route path="/ingresos" element={<ProtectedRoute><IngresosPage /></ProtectedRoute>} />
    <Route path="/disponibilidad" element={<ProtectedRoute><DisponibilidadPage /></ProtectedRoute>} />
    <Route path="/equipo" element={<ProtectedRoute><EquipoPage /></ProtectedRoute>} />
    <Route path="/catalogo" element={<ProtectedRoute><CatalogoPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
