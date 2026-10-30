import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BlogRoutes from './blog-routes';
import Index from './pages/Index';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import SessionPage from './pages/SessionPage';
import NotFound from './components/NotFound';
import { PrefsProvider } from './lib/prefs';
// MODULE_IMPORTS_START
// MODULE_IMPORTS_END

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    {/* <Route path="/blog/*" element={<BlogRoutes />} /> */}
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route path="/s/:shareId" element={<SessionPage />} />
    <Route path="*" element={<NotFound appId="companion" />} />
    {/* MODULE_ROUTES_START */}
    {/* MODULE_ROUTES_END */}
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* MODULE_PROVIDERS_START */}
    {/* MODULE_PROVIDERS_END */}
    <PrefsProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </PrefsProvider>
    {/* MODULE_PROVIDERS_CLOSE */}
  </QueryClientProvider>
);

export default App;
export { AppRoutes };
