/**
 * FRONTEND_REACT_EXAMPLES.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Documentation-only React hook examples for the J. Worden & Sons auth system.
 *
 * ⚠️  THIS FILE IS NOT WIRED INTO src/ — it is a reference document.
 *     Copy individual hooks into your project as needed.
 *
 * COPY THESE INTO YOUR PROJECT
 * ─────────────────────────────
 *   src/contexts/AuthContext.tsx   ← AuthProvider + useAuth
 *   src/hooks/useCrmLeads.ts       ← useCrmLeads
 *   src/hooks/useAuthGuard.ts      ← useAuthGuard
 *   src/hooks/useTokenRefresh.ts   ← useTokenRefresh (optional)
 *
 * DEPENDENCIES
 * ────────────
 *   react, react-dom
 *   @tanstack/react-query
 *   ./FRONTEND_AUTH_CLIENT (deployed as src/lib/auth.ts)
 *
 * USAGE SUMMARY
 * ─────────────
 *   1. Wrap your app in <AuthProvider> (see AuthContext section below).
 *   2. Call useAuth() in any component to get { isReady, error, retry }.
 *   3. Call useCrmLeads() to get leads data with full loading/error handling.
 *   4. Use useAuthGuard() in protected route wrappers.
 *
 * NOTE: This file uses TypeScript + JSX syntax.  If your project is plain JS,
 * remove the type annotations and rename to .jsx.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Imports (adjust paths to match your project structure)
// ─────────────────────────────────────────────────────────────────────────────

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
  getKpiWall,
  getAnalyticsDashboard,
  getFollowUps,
  cancelFollowUp,
  getCustomers,
  getCustomerStats,
  generateProposal,
  sendProposal,
  getPaymentStatus,
  createCheckoutSession,
  AuthError,
  type CrmLead,
  type CrmLeadsResponse,
  type FunnelResponse,
  type KpiWallResponse,
  type PipelineStage,
  type ScoreLabel,
  type FollowUpsResponse,
  type CustomersResponse,
  type CustomerStatsResponse,
  type ProposalResponse,
  type PaymentStatusResponse,
} from "./FRONTEND_AUTH_CLIENT";

// ─────────────────────────────────────────────────────────────────────────────
// AuthContext
//
// Provides auth state to the entire component tree.
//
// SETUP — wrap your app root:
//
//   // src/main.tsx
//   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
//   import { AuthProvider } from './contexts/AuthContext'
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

/**
 * AuthProvider — wrap your app root with this.
 *
 * On mount, calls initAuth() to fetch a JWT from the Netlify Function.
 * Exposes isReady, error, and retry via useAuth().
 *
 * @example
 * // src/main.tsx
 * <QueryClientProvider client={queryClient}>
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 * </QueryClientProvider>
 */
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
// @example
//   function CommandCenter() {
//     const { isReady, error, retry } = useAuth()
//
//     if (!isReady && !error) return <Spinner />
//     if (error) return <ErrorBanner message={error} onRetry={retry} />
//
//     return <Dashboard />
//   }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current auth state from AuthContext.
 * Must be used inside an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// useAuthGuard
//
// Returns a React node (spinner or error UI) while auth is initialising or
// has failed.  Returns null when auth is ready — render children normally.
//
// @example
//   function ProtectedRoute({ children }: { children: React.ReactNode }) {
//     const guard = useAuthGuard()
//     if (guard) return guard   // renders spinner or error UI
//     return <>{children}</>
//   }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a fallback UI node while auth is initialising or has failed.
 * Returns null when auth is ready — render children normally.
 *
 * @example
 * function ProtectedRoute({ children }) {
 *   const guard = useAuthGuard()
 *   if (guard) return guard
 *   return <>{children}</>
 * }
 */
export function useAuthGuard(): React.ReactNode | null {
  const { isReady, error, retry } = useAuth();

  if (!isReady && !error) {
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
// useCrmLeads
//
// Fetches CRM leads (GET /api/v1/crm/leads) and the funnel
// (GET /api/v1/crm/funnel) with optional stage filter.
// Automatically waits for auth to be ready before fetching.
// Provides a stage update mutation that invalidates both queries on success.
//
// @example
//   function CRMPanel() {
//     const [stageFilter, setStageFilter] = useState<PipelineStage | ''>('')
//     const { leads, funnel, isLoading, error, updateStage, isUpdating } =
//       useCrmLeads(stageFilter || undefined)
//
//     if (isLoading) return <Spinner />
//     if (error) return <ErrorBanner message={error} />
//
//     return (
//       <div>
//         <FunnelChart data={funnel} />
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
  /** Move a lead to a new pipeline stage. */
  updateStage: (args: {
    leadId: number;
    stage: PipelineStage;
    closedReason?: string;
  }) => Promise<void>;
  /** Force-refetch leads and funnel. */
  refetch: () => void;
}

/**
 * Fetches CRM leads and funnel data.  Provides a stage update mutation.
 *
 * @param stageFilter  Optional pipeline stage to filter by
 * @param scoreFilter  Optional score label to filter by
 */
export function useCrmLeads(
  stageFilter?: PipelineStage,
  scoreFilter?: ScoreLabel
): UseCrmLeadsReturn {
  const { isReady } = useAuth();
  const queryClient = useQueryClient();

  // ── Leads query ────────────────────────────────────────────────────────────
  const leadsQuery = useQuery<CrmLeadsResponse, Error>({
    queryKey: ["crm-leads", stageFilter ?? "", scoreFilter ?? ""],
    queryFn: () =>
      getCrmLeads({
        pipeline_stage: stageFilter,
        score_label: scoreFilter,
      }),
    // Don't fetch until auth is ready.
    enabled: isReady,
    // Don't retry on auth errors — apiFetch handles those internally.
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
      stage: PipelineStage;
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
    async (args: { leadId: number; stage: PipelineStage; closedReason?: string }) => {
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
// useKpiWall
//
// Fetches the KPI wall aggregate (GET /api/v1/kpi-wall).
// Refreshes every 5 minutes automatically.
//
// @example
//   function KpiDashboard() {
//     const { kpis, trend, isLoading, error } = useKpiWall()
//
//     if (isLoading) return <Spinner />
//     if (error) return <ErrorBanner message={error} />
//
//     return (
//       <div>
//         <KpiCard label={kpis.bid_win_rate.label} value={kpis.bid_win_rate.value} status={kpis.bid_win_rate.status} />
//         <KpiCard label={kpis.on_time_delivery.label} value={kpis.on_time_delivery.value} status={kpis.on_time_delivery.status} />
//         <MonthlyTrendChart data={trend} />
//       </div>
//     )
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface UseKpiWallReturn {
  kpis: KpiWallResponse["kpis"] | undefined;
  trend: KpiWallResponse["monthly_lead_trend"];
  generatedAt: string | undefined;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches the KPI wall aggregate.  Auto-refreshes every 5 minutes.
 */
export function useKpiWall(): UseKpiWallReturn {
  const { isReady } = useAuth();

  const query = useQuery<KpiWallResponse, Error>({
    queryKey: ["kpi-wall"],
    queryFn: getKpiWall,
    enabled: isReady,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });

  return {
    kpis: query.data?.kpis,
    trend: query.data?.monthly_lead_trend ?? [],
    generatedAt: query.data?.generated_at,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useAnalyticsDashboard
//
// Fetches the full BI dashboard (GET /api/v1/analytics/dashboard).
//
// @example
//   function CommandCenter() {
//     const { data, isLoading, error } = useAnalyticsDashboard()
//     if (isLoading) return <Spinner />
//     if (error) return <ErrorBanner message={error} />
//     return <DashboardLayout data={data} />
//   }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the full analytics dashboard payload.
 */
export function useAnalyticsDashboard() {
  const { isReady } = useAuth();

  const query = useQuery<unknown, Error>({
    queryKey: ["analytics-dashboard"],
    queryFn: getAnalyticsDashboard,
    enabled: isReady,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 60_000, // 1 minute
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useFollowUps
//
// Fetches follow-up tasks (GET /api/v1/followups) with optional filters.
// Provides a cancel mutation.
//
// @example
//   function FollowUpQueue() {
//     const { tasks, total, isLoading, error, cancel, isCancelling } =
//       useFollowUps({ status: 'pending' })
//
//     return tasks.map(task => (
//       <TaskRow
//         key={task.id}
//         task={task}
//         onCancel={() => cancel(task.id)}
//         isCancelling={isCancelling}
//       />
//     ))
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface UseFollowUpsReturn {
  tasks: FollowUpsResponse["tasks"];
  total: number;
  isLoading: boolean;
  error: string | null;
  isCancelling: boolean;
  cancel: (taskId: number) => Promise<void>;
  refetch: () => void;
}

/**
 * Fetches follow-up tasks with optional filters.  Provides a cancel mutation.
 */
export function useFollowUps(params?: {
  status?: "pending" | "sent" | "cancelled";
  lead_id?: number;
  task_type?: string;
}): UseFollowUpsReturn {
  const { isReady } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<FollowUpsResponse, Error>({
    queryKey: ["followups", params?.status ?? "", params?.lead_id ?? "", params?.task_type ?? ""],
    queryFn: () => getFollowUps(params),
    enabled: isReady,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (taskId: number) => cancelFollowUp(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });

  const cancel = useCallback(
    async (taskId: number) => {
      await cancelMutation.mutateAsync(taskId);
    },
    [cancelMutation]
  );

  return {
    tasks: query.data?.tasks ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error?.message ?? cancelMutation.error?.message ?? null,
    isCancelling: cancelMutation.isPending,
    cancel,
    refetch: query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useCustomers
//
// Fetches customers (GET /api/v1/customers) with optional filters.
//
// @example
//   function CustomerList() {
//     const { customers, stats, isLoading, error } = useCustomers({ state_code: 'OH' })
//     if (isLoading) return <Spinner />
//     return <CustomerTable rows={customers} stats={stats} />
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface UseCustomersReturn {
  customers: CustomersResponse["items"];
  stats: CustomerStatsResponse | undefined;
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches customers and CRM stats overview.
 */
export function useCustomers(params?: {
  state_code?: string;
  customer_type?: string;
  is_franchise?: 0 | 1;
  search?: string;
  limit?: number;
  offset?: number;
}): UseCustomersReturn {
  const { isReady } = useAuth();

  const customersQuery = useQuery<CustomersResponse, Error>({
    queryKey: ["customers", JSON.stringify(params ?? {})],
    queryFn: () => getCustomers(params),
    enabled: isReady,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });

  const statsQuery = useQuery<CustomerStatsResponse, Error>({
    queryKey: ["customer-stats"],
    queryFn: getCustomerStats,
    enabled: isReady,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });

  const refetch = useCallback(() => {
    customersQuery.refetch();
    statsQuery.refetch();
  }, [customersQuery, statsQuery]);

  return {
    customers: customersQuery.data?.items ?? [],
    stats: statsQuery.data,
    total: customersQuery.data?.total ?? 0,
    isLoading: customersQuery.isLoading || statsQuery.isLoading,
    error: customersQuery.error?.message ?? statsQuery.error?.message ?? null,
    refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useProposal
//
// Generates a proposal for a lead (POST /api/v1/proposals/generate) and
// optionally sends it by email (POST /api/v1/proposals/{id}/send).
//
// @example
//   function ProposalButton({ leadId }: { leadId: number }) {
//     const { generate, send, proposal, isGenerating, isSending, error } =
//       useProposal()
//
//     return (
//       <div>
//         <button onClick={() => generate(leadId)} disabled={isGenerating}>
//           {isGenerating ? 'Generating…' : 'Generate Proposal'}
//         </button>
//         {proposal && (
//           <button onClick={() => send(leadId)} disabled={isSending}>
//             {isSending ? 'Sending…' : 'Email to Lead'}
//           </button>
//         )}
//         {error && <p style={{ color: 'red' }}>{error}</p>}
//       </div>
//     )
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface UseProposalReturn {
  proposal: ProposalResponse | null;
  isGenerating: boolean;
  isSending: boolean;
  error: string | null;
  generate: (leadId: number, includePdf?: boolean) => Promise<void>;
  send: (leadId: number) => Promise<void>;
}

/**
 * Provides generate and send mutations for proposals.
 */
export function useProposal(): UseProposalReturn {
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);

  const generateMutation = useMutation({
    mutationFn: ({ leadId, includePdf }: { leadId: number; includePdf?: boolean }) =>
      generateProposal(leadId, includePdf),
    onSuccess: (data) => {
      setProposal(data);
    },
  });

  const sendMutation = useMutation({
    mutationFn: (leadId: number) => sendProposal(leadId),
  });

  const generate = useCallback(
    async (leadId: number, includePdf = true) => {
      await generateMutation.mutateAsync({ leadId, includePdf });
    },
    [generateMutation]
  );

  const send = useCallback(
    async (leadId: number) => {
      await sendMutation.mutateAsync(leadId);
    },
    [sendMutation]
  );

  return {
    proposal,
    isGenerating: generateMutation.isPending,
    isSending: sendMutation.isPending,
    error:
      generateMutation.error?.message ?? sendMutation.error?.message ?? null,
    generate,
    send,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// usePayment
//
// Creates a Stripe checkout session and polls payment status.
//
// @example
//   function PaymentButton({ leadId }: { leadId: number }) {
//     const { status, checkout, isCreating, error } = usePayment(leadId)
//
//     return (
//       <div>
//         <p>Payment status: {status?.status ?? 'none'}</p>
//         <button onClick={checkout} disabled={isCreating}>
//           {isCreating ? 'Creating session…' : 'Collect Deposit'}
//         </button>
//         {error && <p style={{ color: 'red' }}>{error}</p>}
//       </div>
//     )
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface UsePaymentReturn {
  status: PaymentStatusResponse | undefined;
  isCreating: boolean;
  isLoadingStatus: boolean;
  error: string | null;
  /** Creates a checkout session and redirects to Stripe. */
  checkout: (successUrl?: string, cancelUrl?: string) => Promise<void>;
}

/**
 * Manages Stripe checkout session creation and payment status polling.
 */
export function usePayment(leadId: number): UsePaymentReturn {
  const { isReady } = useAuth();

  const statusQuery = useQuery<PaymentStatusResponse, Error>({
    queryKey: ["payment-status", leadId],
    queryFn: () => getPaymentStatus(leadId),
    enabled: isReady && leadId > 0,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      return failureCount < 2;
    },
    staleTime: 30_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: ({
      successUrl,
      cancelUrl,
    }: {
      successUrl?: string;
      cancelUrl?: string;
    }) => createCheckoutSession(leadId, successUrl, cancelUrl),
    onSuccess: (data) => {
      // Redirect to Stripe checkout.
      window.location.href = data.checkout_url;
    },
  });

  const checkout = useCallback(
    async (successUrl?: string, cancelUrl?: string) => {
      await checkoutMutation.mutateAsync({ successUrl, cancelUrl });
    },
    [checkoutMutation]
  );

  return {
    status: statusQuery.data,
    isCreating: checkoutMutation.isPending,
    isLoadingStatus: statusQuery.isLoading,
    error:
      statusQuery.error?.message ?? checkoutMutation.error?.message ?? null,
    checkout,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useTokenRefresh
//
// Low-level hook that exposes the refresh function and tracks whether a
// refresh is currently in flight.  Useful for building custom auth UIs or
// for manually triggering a refresh after a user action.
//
// @example
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

/**
 * Exposes the token refresh function with loading and error state.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Complete component example — CRM Command Center panel
//
// This shows how all the hooks compose together in a real component.
// Copy and adapt this into your project.
// ─────────────────────────────────────────────────────────────────────────────

/*
// src/components/commandCenter/CRMPanel.tsx

import { useState } from 'react'
import { useAuthGuard } from '../hooks/useAuthGuard'
import { useCrmLeads } from '../hooks/useCrmLeads'
import type { PipelineStage } from '../lib/auth'

const STAGES: PipelineStage[] = [
  'new', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost'
]

export default function CRMPanel() {
  // Guard renders a spinner or error UI while auth initialises.
  const guard = useAuthGuard()
  if (guard) return guard

  const [stageFilter, setStageFilter] = useState<PipelineStage | ''>('')
  const { leads, funnel, total, isLoading, error, updateStage, isUpdating, refetch } =
    useCrmLeads(stageFilter || undefined)

  if (isLoading) return <div>Loading leads…</div>
  if (error) return <div style={{ color: 'red' }}>{error} <button onClick={refetch}>Retry</button></div>

  return (
    <div>
      <h2>CRM Pipeline ({total} leads)</h2>

      <select value={stageFilter} onChange={e => setStageFilter(e.target.value as PipelineStage | '')}>
        <option value="">All stages</option>
        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {funnel && (
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          {funnel.funnel.map(row => (
            <div key={row.stage} style={{ textAlign: 'center', padding: 8, background: '#f3f4f6', borderRadius: 4 }}>
              <div style={{ fontWeight: 600 }}>{row.count}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{row.stage}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center', padding: 8, background: '#dcfce7', borderRadius: 4 }}>
            <div style={{ fontWeight: 600 }}>{funnel.win_rate_pct}%</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>win rate</div>
          </div>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Name</th><th>Service</th><th>Score</th><th>Stage</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id}>
              <td>{lead.name}</td>
              <td>{lead.service_type}</td>
              <td style={{ color: lead.score_label === 'HOT' ? '#dc2626' : lead.score_label === 'WARM' ? '#f59e0b' : '#6b7280' }}>
                {lead.score_label ?? '—'}
              </td>
              <td>{lead.pipeline_stage}</td>
              <td>
                <select
                  value={lead.pipeline_stage}
                  disabled={isUpdating}
                  onChange={e => updateStage({ leadId: lead.id, stage: e.target.value as PipelineStage })}
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
*/
