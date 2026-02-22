import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Login = lazy(() => import('./pages/Login'));
const Dispatch = lazy(() => import('./pages/app/Dispatch'));
const RoutesPage = lazy(() => import('./pages/app/Routes'));
const RouteDetail = lazy(() => import('./pages/app/RouteDetail'));
const Drivers = lazy(() => import('./pages/app/Drivers'));
const Settings = lazy(() => import('./pages/app/Settings'));
const Reports = lazy(() => import('./pages/app/Reports'));
const CompanyPage = lazy(() => import('./pages/app/Company'));
const AdminPanel = lazy(() => import('./pages/app/AdminPanel'));
const Driver = lazy(() => import('./pages/Driver'));
const Track = lazy(() => import('./pages/Track'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<S><Login /></S>} />
            <Route path="/track/:token" element={<S><Track /></S>} />
            <Route path="/driver" element={<S><Driver /></S>} />

            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<S><Dispatch /></S>} />
              <Route path="routes" element={<S><RoutesPage /></S>} />
              <Route path="routes/:id" element={<S><RouteDetail /></S>} />
              <Route path="drivers" element={<S><Drivers /></S>} />
              <Route path="reports" element={<S><Reports /></S>} />
              <Route path="company" element={<S><CompanyPage /></S>} />
              <Route path="admin" element={<S><AdminPanel /></S>} />
              <Route path="dashboard" element={<Navigate to="/app" replace />} />
              <Route path="settings" element={<S><Settings /></S>} />
            </Route>

            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
