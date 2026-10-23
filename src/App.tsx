import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";

import { AuthGate } from "@/components/AuthGate";
import { BrandingProvider } from "@/hooks/useBranding";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const SearchPage = lazy(() => import("./pages/SearchPage").then((module) => ({ default: module.SearchPage })));
const DatabasePage = lazy(() => import("./pages/DatabasePage").then((module) => ({ default: module.DatabasePage })));
const LogsPage = lazy(() => import("./pages/LogsPage").then((module) => ({ default: module.LogsPage })));
const RecordView = lazy(() => import("./pages/RecordView").then((module) => ({ default: module.RecordView })));
const AssignedPage = lazy(() => import("./pages/AssignedPage").then((module) => ({ default: module.AssignedPage })));
const AgentsPage = lazy(() => import("./pages/AgentsPage").then((module) => ({ default: module.AgentsPage })));
const PublicationPipelinePage = lazy(() => import("./pages/PublicationPipelinePage").then((module) => ({ default: module.PublicationPipelinePage })));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-[#F0E8D0] font-mono font-bold text-[#6d6658]">LOADING…</div>}>
      <Switch>
        <Route path="/"              component={Dashboard} />
        <Route path="/search"        component={SearchPage} />
        <Route path="/database"      component={DatabasePage} />
        <Route path="/assigned"      component={AssignedPage} />
        <Route path="/agents"        component={AgentsPage} />
        <Route path="/publication"   component={PublicationPipelinePage} />
        <Route path="/record/:id"    component={RecordView} />
        <Route path="/logs"          component={LogsPage} />
        <Route                       component={NotFound} />
      </Switch>
    </Suspense>
  );
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <TooltipProvider>
          <AuthGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthGate>
          <Toaster />
        </TooltipProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}

export default App;
