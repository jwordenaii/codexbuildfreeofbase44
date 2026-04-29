/**
 * FRONTEND_REACT_HOOKS.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook examples for the J. Worden & Sons auth system.
 *
 * These hooks wrap the auth primitives from FRONTEND_AUTH_EXAMPLE.ts and
 * integrate with @tanstack/react-query (already in package.json) for
 * caching, background refetching, and loading/error states.
 *
 * COPY THESE FILES INTO YOUR PROJECT
 * ────────────────────────────────────
 *   src/hooks/useAuth.ts        ← useAuth hook
 *   src/hooks/useCrmLeads.ts    ← useCrmLeads hook
 *   src/contexts/AuthContext.tsx ← AuthContext provider (wrap your app root)
 *
 * DEPENDENCIES (all already in package.json)
 * ───────────────────────────────────────────
 *   react, react-dom
 *   @tanstack/react-query
 *
 * USAGE SUMMARY
 * ─────────────
 *   1. Wrap your app in <AuthProvider> (see AuthContext section below).
 *   2. Call useAuth() in any component to get { isReady, error, retry }.
 *   3. Call useCrmLeads() to get leads data with full loading/error handling.
 */

// NOTE: This file uses TypeScript syntax.  If your project is plain JS,
// remove the type annotations and rename to .js / .jsx.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  initAuth,
  refreshToken,
  getCrmLeads,
  getCrmFunnel,
  updateLeadStage,
  AuthError,
  type CrmLead,
  type CrmLeadsResponse,
  type FunnelResponse,
} from "./FRONTEND_AUTH_EXAMPLE";

// ─────────────────────────────────────────────────────────────────────────────
// AuthContext
//
// Provides auth state to the entire component tree.  Wrap your app root:
//
//   // src/main.tsx
//   import { AuthProvider } from './contexts/AuthContext'
//   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
//
//   const queryClient = new QueryClient()
//
//   ReactDOM.createRoot(document.getElementById('root')!).render(
//     <QueryClientProvider client={queryClient}>
//       <AuthProvider>
//         <App />
//       </AuthProvider>
//     </QueryClientProvider>
//   )
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** True once the initial token has been fetched successfully. */
  isReady: boolean;
  /** Set if the initial token fetch (or a refresh) failed permanently. */
  error: string | null;
  /** Manually trigger a token refresh (e.g. after the user clicks "Retry"). */
  retry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isReady: false,
  error: null,
  retry: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Prevent double-init in React 18 StrictMode (effects run twice in dev).
  const initialised = useRef(false);

  const init = useCallback(async () => {
    setError(null);
    try {
      await initAuth();
      setIsReady(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      setIsReady(false);
      console.error("[AuthProvider] initAuth failed:", err);
    }
  }, []);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    init();
  }, [init]);

  const retry = useCallback(async () => {
    initialised.current = false;
    await init();
  }, [init]);

  return (
    <AuthContext.Provider value={{ isReady, error, retry }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useAuth
//
// Returns the current auth state.  Use this in any component that needs to
// know whether the user is authenticated before rendering protected content.
//
// Example:
//   function CommandCenter() {
//     const { isReady, error, retry } = useAuth()
//
//     if (!isReady && !error) return <Spinner />
//     if (error) return <ErrorBanner message={error} onRetry={retry} />
//
//     return <Dashboard />
//   }
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// useCrmLeads
//
// Fetches CRM leads from GET /api/v1/crm/leads with optional stage filter.
// Automatically waits for auth to be ready before fetching.
//
// Example:
//   function CRMPanel() {
//     const [stageFilter, setStageFilter] = useState('')
//     const { leads, funnel, isLoading, error, updateStage, isUpdating } =
//       useCrmLeads(stageFilter)
//
//     if (isLoading) return <Spinner />
//     if (error) return <ErrorBanner message={error} />
//
//     return (
//       <div>
//         {leads.map(lead => (
//           <LeadRow
//             key={lead.id}
//             lead={lead}
//             onStageChange={(stage) => updateStage({ leadId: lead.id, stage })}
//             isUpdating={isUpdating}
//           />
//         ))}
//       </div>
//     )
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface UseCrmLeadsReturn {
  leads: CrmLead[];
  funnel: FunnelResponse | undefined;
  total: number;
  isLoading: boolean;
  /** Human-readable error message, or null if no error. */
  error: string | null;
  /** True while a stage update mutation is in flight. */
  isUpdating: boolean;
  /** Call to move a lead to a new pipeline stage. */
  updateStage: (args: {
    leadId: number;
    stage: string;
    closedReason?: string;
  }) => Promise<void>;
  /** Force-refetch leads and funnel. */
  refetch: () => void;
}

export function useCrmLeads(stageFilter?: string): UseCrmLeadsReturn {
  const { isReady } = useAuth();
  const queryClient = useQueryClient();

  // ── Leads query ────────────────────────────────────────────────────────────
  const leadsQuery = useQuery<CrmLeadsResponse, Error>({
    queryKey: ["crm-leads", stageFilter ?? ""],
    queryFn: () =>
      getCrmLeads(stageFilter ? { pipeline_stage: stageFilter } : undefined),
    // Don't fetch until auth is ready.
    enabled: isReady,
    // Retry up to 2 times on failure, but not on auth errors (those need a
    // token refresh, which apiFetch handles internally).
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 30_000, // Consider data fresh for 30 seconds.
  });

  // ── Funnel query ───────────────────────────────────────────────────────────
  const funnelQuery = useQuery<FunnelResponse, Error>({
    queryKey: ["crm-funnel"],
    queryFn: getCrmFunnel,
    enabled: isReady,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 30_000,
  });

  // ── Stage update mutation ──────────────────────────────────────────────────
  const stageMutation = useMutation({
    mutationFn: ({
      leadId,
      stage,
      closedReason,
    }: {
      leadId: number;
      stage: string;
      closedReason?: string;
    }) => updateLeadStage(leadId, stage, closedReason),
    onSuccess: () => {
      // Invalidate both queries so the UI reflects the new stage immediately.
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["crm-funnel"] });
    },
  });

  // ── Derived state ──────────────────────────────────────────────────────────
  const isLoading = leadsQuery.isLoading || funnelQuery.isLoading;

  const error =
    leadsQuery.error?.message ??
    funnelQuery.error?.message ??
    stageMutation.error?.message ??
    null;

  const updateStage = useCallback(
    async (args: { leadId: number; stage: string; closedReason?: string }) => {
      await stageMutation.mutateAsync(args);
    },
    [stageMutation]
  );

  const refetch = useCallback(() => {
    leadsQuery.refetch();
    funnelQuery.refetch();
  }, [leadsQuery, funnelQuery]);

  return {
    leads: leadsQuery.data?.leads ?? [],
    funnel: funnelQuery.data,
    total: leadsQuery.data?.total ?? 0,
    isLoading,
    error,
    isUpdating: stageMutation.isPending,
    updateStage,
    refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useAuthGuard
//
// Redirects to a fallback UI if auth fails.  Use this in protected route
// wrappers.
//
// Example:
//   function ProtectedRoute({ children }: { children: React.ReactNode }) {
//     const guard = useAuthGuard()
//     if (guard) return guard   // renders spinner or error UI
//     return <>{children}</>
//   }
// ─────────────────────────────────────────────────────────────────────────────

export function useAuthGuard(): React.ReactNode | null {
  const { isReady, error, retry } = useAuth();

  if (!isReady && !error) {
    // Auth is still initialising — show a minimal spinner.
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "12px",
          color: "#6b7280",
          fontSize: "14px",
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            border: "2px solid #f59e0b",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        Authenticating…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "16px",
          color: "#dc2626",
          fontSize: "14px",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <strong>Authentication failed</strong>
        <p style={{ color: "#6b7280", maxWidth: 400 }}>{error}</p>
        <button
          onClick={retry}
          style={{
            padding: "8px 20px",
            background: "#1e3a5f",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Auth is ready — render children normally.
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// useTokenRefresh
//
// Low-level hook that exposes the refresh function and tracks whether a
// refresh is currently in flight.  Useful for building custom auth UIs or
// for manually triggering a refresh after a user action.
//
// Example:
//   function SessionWarning() {
//     const { refresh, isRefreshing } = useTokenRefresh()
//     return (
//       <button onClick={refresh} disabled={isRefreshing}>
//         {isRefreshing ? 'Refreshing…' : 'Extend session'}
//       </button>
//     )
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface UseTokenRefreshReturn {
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  error: string | null;
}

export function useTokenRefresh(): UseTokenRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await refreshToken();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Token refresh failed";
      setError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { refresh, isRefreshing, error };
}
