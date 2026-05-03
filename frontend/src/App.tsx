import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Analyze from "./pages/Analyze";
import Decisions from "./pages/Decisions";
import ReviewQueue from "./pages/ReviewQueue";
import Analytics from "./pages/Analytics";
import Contracts from "./pages/contracts/Contracts";
import Ingestion from "./pages/ingestion/Ingestion";
import Payrolls from "./pages/payrolls/Payrolls";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { lazy, Suspense } from "react";

// V4 Analytics pages - lazy loaded
const AnalyticsIndex = lazy(() => import("./pages/analytics/index"));
const AnalyticsCompliance = lazy(() => import("./pages/analytics/compliance"));
const AnalyticsWages = lazy(() => import("./pages/analytics/wages"));
const AnalyticsLLM = lazy(() => import("./pages/analytics/llm"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full" role="status" aria-label="Loading">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" aria-hidden="true" />
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <button
        onClick={() => navigate("/")}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Go Home
      </button>
    </div>
  );
}

function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("wcp_token"));
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/analyze" element={<Analyze />} />
                    <Route path="/decisions" element={<Decisions />} />
                    <Route path="/review" element={<ReviewQueue />} />
                    <Route path="/contracts" element={<Contracts />} />
                    <Route path="/payrolls" element={<Payrolls />} />
                    <Route path="/ingestion" element={<Ingestion />} />
                    <Route path="/analytics" element={<Analytics />} />
                    {/* V4 Analytics sub-routes */}
                    <Route path="/analytics/overview" element={
                      <Suspense fallback={<LoadingFallback />}><AnalyticsIndex /></Suspense>
                    } />
                    <Route path="/analytics/compliance" element={
                      <Suspense fallback={<LoadingFallback />}><AnalyticsCompliance /></Suspense>
                    } />
                    <Route path="/analytics/wages" element={
                      <Suspense fallback={<LoadingFallback />}><AnalyticsWages /></Suspense>
                    } />
                    <Route path="/analytics/llm" element={
                      <Suspense fallback={<LoadingFallback />}><AnalyticsLLM /></Suspense>
                    } />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
