import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import Layout from "./components/Layout.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Analyze from "./pages/Analyze.tsx";
import Decisions from "./pages/Decisions.tsx";
import ReviewQueue from "./pages/ReviewQueue.tsx";
import Analytics from "./pages/Analytics.tsx";
import Contracts from "./pages/contracts/Contracts.tsx";
import Ingestion from "./pages/ingestion/Ingestion.tsx";
import Payrolls from "./pages/payrolls/Payrolls.tsx";
import Settings from "./pages/Settings.tsx";
import Login from "./pages/Login.tsx";
import { lazy, Suspense } from "react";

// V4 Analytics pages - lazy loaded
const AnalyticsIndex = lazy(() => import("./pages/analytics/index"));
const AnalyticsCompliance = lazy(() => import("./pages/analytics/compliance"));
const AnalyticsWages = lazy(() => import("./pages/analytics/wages"));
const AnalyticsLLM = lazy(() => import("./pages/analytics/llm"));

function LoadingFallback() {
  return <div className="flex items-center justify-center h-full"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
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
