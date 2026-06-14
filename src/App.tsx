import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminRoute } from "@/components/AdminRoute";
import { DriverRoute } from "@/components/DriverRoute";
import { AppLayout } from "@/components/AppLayout";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const ChooseMode = lazy(() => import('./pages/ChooseMode'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const DriverLogin = lazy(() => import('./pages/DriverLogin'));
const DriverActivate = lazy(() => import('./pages/DriverActivate'));
const Dispatch = lazy(() => import('./pages/app/Dispatch'));
const RoutesPage = lazy(() => import('./pages/app/Routes'));
const RouteDetail = lazy(() => import('./pages/app/RouteDetail'));
const Drivers = lazy(() => import('./pages/app/Drivers'));
const Settings = lazy(() => import('./pages/app/Settings'));
const Reports = lazy(() => import('./pages/app/Reports'));
const CompanyPage = lazy(() => import('./pages/app/Company'));
const AdminPanel = lazy(() => import('./pages/app/AdminPanel'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
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
            {/* Public routes */}
            <Route path="/choose-mode" element={<S><ChooseMode /></S>} />
            <Route path="/admin/login" element={<S><AdminLogin /></S>} />
            <Route path="/driver/login" element={<S><DriverLogin /></S>} />
            <Route path="/driver/activate" element={<S><DriverActivate /></S>} />
            <Route path="/track/:token" element={<S><Track /></S>} />

            {/* Legacy login redirect */}
            <Route path="/login" element={<Navigate to="/choose-mode" replace />} />

            {/* Admin/SaaS routes */}
            <Route
              path="/app"
              element={
                <AdminRoute>
                  <AppLayout />
                </AdminRoute>
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

            {/* Driver route */}
            <Route
              path="/driver"
              element={
                <DriverRoute>
                  <S><Driver /></S>
                </DriverRoute>
              }
            />

            {/* Super Admin (no AppLayout, standalone) */}
            <Route path="/superadmin" element={<S><SuperAdmin /></S>} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/choose-mode" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
