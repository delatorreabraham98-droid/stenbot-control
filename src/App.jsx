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
import Knowledge from '@/pages/Knowledge';
import SettingsPage from '@/pages/Settings';
import Register from '@/pages/Register';
import ClientDashboard from '@/pages/client/Dashboard';
import ClientSettings from '@/pages/client/Settings';
import ClientIntegrations from '@/pages/client/Integrations';

const AuthenticatedApp = () => {
  const {
    isLoadingAuth, isLoadingPublicSettings, authError,
    navigateToLogin, needsRegistration, isAdmin, loadingClient
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
          <Route path="/knowledge" element={<Knowledge />} />
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
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/knowledge" element={<Knowledge />} />
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
