import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import Bots from '@/pages/Bots';
import Channels from '@/pages/Channels';
import Conversations from '@/pages/Conversations';
import Leads from '@/pages/Leads';
import LeadsKanban from '@/pages/LeadsKanban';
import Workflows from '@/pages/Workflows';
import Calendar from '@/pages/Calendar';
import Availability from '@/pages/Availability';
import Knowledge from '@/pages/Knowledge';
import SettingsPage from '@/pages/Settings';
import Help from '@/pages/Help';
import Analytics from '@/pages/Analytics';
import Templates from '@/pages/Templates';
import ActivityLogs from '@/pages/ActivityLogs';
import Billing from '@/pages/Billing';
import ClientProfile from '@/pages/ClientProfile';
import Register from '@/pages/Register';
import ClientDashboard from '@/pages/client/Dashboard';
import ClientSettings from '@/pages/client/Settings';
import ClientIntegrations from '@/pages/client/Integrations';
import ClientBot from '@/pages/client/Bot';

const AuthenticatedApp = () => {
  const {
    isLoadingAuth, isLoadingPublicSettings, authError,
    navigateToLogin, needsRegistration, isAdmin, loadingClient, authChecked,
    isAuthenticated
  } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth || loadingClient) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Cargando STEN Platform...</p>
        </div>
      </div>
    );
  }

  if (authChecked && !isAuthenticated && !authError) {
    navigateToLogin();
    return null;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (needsRegistration) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Register />} />
      </Routes>
    );
  }

  if (isAdmin) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads-kanban" element={<LeadsKanban />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/availability" element={<Availability />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/activity-logs" element={<ActivityLogs />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/help" element={<Help />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ClientDashboard />} />
        <Route path="/bot" element={<ClientBot />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/client-profile" element={<ClientProfile />} />
        <Route path="/integrations" element={<ClientIntegrations />} />
        <Route path="/settings" element={<ClientSettings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;