import { lazy, Suspense, useEffect, useState } from 'react';
import ReactGA from 'react-ga4';
import { Toaster } from "@/components/ui/toaster"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import RouteLoader from '@/components/RouteLoader';
import SplashScreen from '@/components/SplashScreen';
import AdvisoryGate from '@/components/AdvisoryGate';
import ChatWidget from '@/components/ChatWidget';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { publicAIPages, internalAIPages } from '@/generated/aiPageRegistry';
import { FEATURES } from '@/lib/featureFlags';

// Home is eagerly loaded (it's the landing page — we want zero TTI delay).
import Home from './pages/Home';

// All other pages are code-split so the initial bundle stays small.
const LeadConsultant = lazy(() => import('./pages/LeadConsultant'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const CrewReporting = lazy(() => import('./pages/CrewReporting'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Quote = lazy(() => import('./pages/Quote'));
const Projects = lazy(() => import('./pages/Projects'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Reviews = lazy(() => import('./pages/Reviews'));
const Services = lazy(() => import('./pages/Services'));
const ServiceAreas = lazy(() => import('./pages/ServiceAreas'));
const CityPage = lazy(() => import('./pages/CityPage'));
const StatePavingPage = lazy(() => import('./pages/StatePavingPage'));
const LocationsIndex = lazy(() => import('./pages/LocationsIndex'));
const LocationPage = lazy(() => import('./pages/LocationPage'));
const RichmondCommercial = lazy(() => import('./pages/RichmondCommercial'));
const ResidentialAsphalt = lazy(() => import('./pages/ResidentialAsphalt'));
const HomeServices = lazy(() => import('./pages/HomeServices'));
const GeneralContracting = lazy(() => import('./pages/GeneralContracting'));
const VirginiaStatewide = lazy(() => import('./pages/VirginiaStatewide'));
const AutonomyDashboard = lazy(() => import('./pages/AutonomyDashboard'));
const TarAndChip = lazy(() => import('./pages/TarAndChip'));
const ContractorAIPlatform = lazy(() => import('./pages/ContractorAIPlatform'));
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const JwordenAI = lazy(() => import('./pages/JwordenAI'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DnsMigration = lazy(() => import('./pages/DnsMigration'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const StaffPortal = lazy(() => import('./pages/StaffPortal'));
const AdminDocuments = lazy(() => import('./pages/AdminDocuments'));
const AdminSlackSettings = lazy(() => import('./pages/AdminSlackSettings'));
const LeadInbox = lazy(() => import('./pages/LeadInbox'));
const VoiceCalls = lazy(() => import('./pages/VoiceCalls'));
const RevenueDashboard = lazy(() => import('./pages/RevenueDashboard'));
const CrewEta = lazy(() => import('./pages/CrewEta'));
const CrewFieldApp = lazy(() => import('./pages/CrewFieldApp'));
const FloorPlanStudio = lazy(() => import('./pages/FloorPlanStudio'));
const PlansInbox = lazy(() => import('./pages/PlansInbox'));
const AsphaltPaving = lazy(() => import('./pages/AsphaltPaving'));
const Hardscapes = lazy(() => import('./pages/Hardscapes'));
const VirginiaSealcoating = lazy(() => import('./pages/VirginiaSealcoating'));
const VirginiaConcrete = lazy(() => import('./pages/VirginiaConcrete'));
const VirginiaShingles = lazy(() => import('./pages/VirginiaShingles'));
const MillingsAndFines = lazy(() => import('./pages/MillingsAndFines'));
const ParkingLots = lazy(() => import('./pages/ParkingLots'));
const RichmondPaving = lazy(() => import('./pages/RichmondPaving'));
const CrackRepair = lazy(() => import('./pages/CrackRepair'));
const ChesterfieldPaving = lazy(() => import('./pages/ChesterfieldPaving'));
const HamptonRoadsPaving = lazy(() => import('./pages/HamptonRoadsPaving'));
const FredericksburgPaving = lazy(() => import('./pages/FredericksburgPaving'));
const NorthernVirginiaPaving = lazy(() => import('./pages/NorthernVirginiaPaving'));
const ShenandoahValleyPaving = lazy(() => import('./pages/ShenandoahValleyPaving'));
const AdvisoryHub = lazy(() => import('./pages/advisory/AdvisoryHub'));

// AI workspace (gated behind feature flags — see src/lib/featureFlags.js)
const DispatchBoard = lazy(() => import('./ai/dispatch/DispatchBoard'));
const AdvisoryCategoryHub = lazy(() => import('./pages/advisory/CategoryHub'));
const AdvisoryStateDetail = lazy(() => import('./pages/advisory/StateDetail'));
const AdvisoryStateCompare = lazy(() => import('./pages/advisory/StateCompare'));
const AdvisoryUtilitiesHub = lazy(() => import('./pages/advisory/UtilitiesHub'));
const AdvisoryLegalStrategy = lazy(() => import('./pages/advisory/LegalStrategyAdvisor'));
const AdvisoryContractorRanker = lazy(() => import('./pages/advisory/ContractorRanker'));
const AdvisoryTaxCompliance = lazy(() => import('./pages/advisory/TaxComplianceAdvisory'));
// Add page imports here

// Initialise GA4 once — silently skipped when the measurement ID is not set.
const GA4_ID = import.meta.env.VITE_GA4_ID
if (GA4_ID) {
  ReactGA.initialize(GA4_ID)
}

const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AdminPinGate = () => {
  const { loginWithPin } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitPin = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('Enter the 4-digit admin PIN.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithPin(pin);
    } catch (err) {
      setError(err.message || 'Incorrect PIN.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <form onSubmit={submitPin} className="w-full max-w-sm border border-border bg-card p-6 shadow-lg">
        <p className="font-display text-primary text-xs tracking-widest uppercase mb-2">Admin Access</p>
        <h1 className="font-display text-2xl font-black text-foreground mb-4">Enter PIN</h1>
        <Input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-label="Admin PIN"
          className="h-12 text-center text-xl tracking-widest"
        />
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <Button type="submit" className="mt-5 w-full" disabled={submitting}>
          {submitting ? 'Checking...' : 'Unlock'}
        </Button>
      </form>
    </div>
  );
};

// Gate only back-office pages behind auth. Public pages render without any auth check.
const RequireAuth = ({ children }) => {
  const { authRequired, isAuthenticated, isLoadingAuth, authError } = useAuth();

  if (!authRequired) return children;

  if (isLoadingAuth) return <LoadingSpinner />;

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return <AdminPinGate />;
  }

  return children;
};

const RequireInternalAdvisory = ({ children }) => (
  <RequireAuth>
    <AdvisoryGate>{children}</AdvisoryGate>
  </RequireAuth>
);

const PublicLayout = ({ children }) => (
  <div className="min-h-screen bg-background font-body text-foreground">
    <Navbar />
    {children}
    <Footer />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingPublicSettings } = useAuth();

  // Fire a GA4 pageview on every navigation when GA4 is configured.
  useEffect(() => {
    if (GA4_ID) ReactGA.send({ hitType: 'pageview', page: window.location.pathname + window.location.search });
  });

  // Wait for app public settings to load before rendering routes
  if (isLoadingPublicSettings) {
    return <LoadingSpinner />;
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/quote" element={<PublicLayout><Quote /></PublicLayout>} />
        <Route path="/projects" element={<PublicLayout><Projects /></PublicLayout>} />
        <Route path="/gallery" element={<PublicLayout><Gallery /></PublicLayout>} />
        <Route path="/reviews" element={<PublicLayout><Reviews /></PublicLayout>} />
        <Route path="/services" element={<PublicLayout><Services /></PublicLayout>} />
        <Route path="/service-areas" element={<PublicLayout><ServiceAreas /></PublicLayout>} />
        <Route path="/service-areas/:slug" element={<PublicLayout><CityPage /></PublicLayout>} />
        <Route path="/states/:stateSlug" element={<PublicLayout><StatePavingPage /></PublicLayout>} />
        <Route path="/locations" element={<LocationsIndex />} />
        <Route path="/locations/:slug" element={<LocationPage />} />
        <Route path="/paving" element={<AsphaltPaving />} />
        <Route path="/residential" element={<ResidentialAsphalt />} />
        <Route path="/home-services" element={<HomeServices />} />
        <Route path="/hardscapes" element={<Hardscapes />} />
        <Route path="/sealcoating" element={<VirginiaSealcoating />} />
        <Route path="/concrete" element={<VirginiaConcrete />} />
        <Route path="/shingles" element={<VirginiaShingles />} />
        <Route path="/parking-lots" element={<ParkingLots />} />
        <Route path="/richmond-paving" element={<RichmondPaving />} />
        <Route path="/crack-repair" element={<CrackRepair />} />
        <Route path="/chesterfield-paving" element={<ChesterfieldPaving />} />
        <Route path="/hampton-roads-paving" element={<HamptonRoadsPaving />} />
        <Route path="/fredericksburg-paving" element={<FredericksburgPaving />} />
        <Route path="/northern-virginia-paving" element={<NorthernVirginiaPaving />} />
        <Route path="/shenandoah-valley-paving" element={<ShenandoahValleyPaving />} />
        <Route path="/millings-fines" element={<MillingsAndFines />} />
        <Route path="/tar-and-chip" element={<TarAndChip />} />
        <Route path="/driveway-ai" element={<Navigate to="/jwordenai" replace />} />
        <Route path="/commercial/richmond-va" element={<RichmondCommercial />} />
        <Route path="/jwordenai" element={<JwordenAI />} />
        <Route path="/general-contracting" element={<GeneralContracting />} />
        <Route path="/visualizer" element={<Navigate to="/jwordenai" replace />} />
        <Route path="/floor-plan-studio" element={<FloorPlanStudio />} />
        <Route path="/plans-inbox" element={<PlansInbox />} />
        <Route path="/lp/:slug" element={<LandingPage />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/crew-eta" element={<RequireAuth><CrewEta /></RequireAuth>} />
        <Route path="/crew-mode" element={<RequireAuth><CrewFieldApp /></RequireAuth>} />
        {FEATURES.DISPATCH && (
          <Route path="/dispatch" element={<RequireAuth><DispatchBoard /></RequireAuth>} />
        )}
        {publicAIPages.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}

        {/* Back-office (auth required) */}
        {internalAIPages.map(({ path, Component }) => (
          <Route key={path} path={path} element={<RequireAuth><Component /></RequireAuth>} />
        ))}
        <Route path="/command-center" element={<RequireAuth><CommandCenter /></RequireAuth>} />
        <Route path="/virginia-statewide" element={<RequireAuth><VirginiaStatewide /></RequireAuth>} />
        <Route path="/autonomy" element={<RequireAuth><AutonomyDashboard /></RequireAuth>} />
        <Route path="/contractor-ai" element={<RequireAuth><ContractorAIPlatform /></RequireAuth>} />
        <Route path="/consultant" element={<RequireAuth><LeadConsultant /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/job" element={<RequireAuth><JobDetail /></RequireAuth>} />
        <Route path="/crew-reporting" element={<RequireAuth><CrewReporting /></RequireAuth>} />
        <Route path="/dns-migration" element={<RequireAuth><DnsMigration /></RequireAuth>} />
        <Route path="/portal" element={<RequireAuth><CustomerPortal /></RequireAuth>} />
        <Route path="/admin/documents" element={<RequireAuth><AdminDocuments /></RequireAuth>} />
        <Route path="/admin/slack" element={<RequireAuth><AdminSlackSettings /></RequireAuth>} />
        <Route path="/leads" element={<RequireAuth><LeadInbox /></RequireAuth>} />
        <Route path="/voice-calls" element={<RequireAuth><VoiceCalls /></RequireAuth>} />
        <Route path="/revenue" element={<RequireAuth><RevenueDashboard /></RequireAuth>} />
        <Route path="/advisory" element={<RequireInternalAdvisory><AdvisoryHub /></RequireInternalAdvisory>} />
        <Route path="/advisory/compare" element={<RequireInternalAdvisory><AdvisoryStateCompare /></RequireInternalAdvisory>} />
        <Route path="/advisory/utilities" element={<RequireInternalAdvisory><AdvisoryUtilitiesHub /></RequireInternalAdvisory>} />
        <Route path="/advisory/legal-strategy" element={<RequireInternalAdvisory><AdvisoryLegalStrategy /></RequireInternalAdvisory>} />
        <Route path="/advisory/contractor-ranker" element={<RequireInternalAdvisory><AdvisoryContractorRanker /></RequireInternalAdvisory>} />
        <Route path="/advisory/tax-compliance" element={<RequireInternalAdvisory><AdvisoryTaxCompliance /></RequireInternalAdvisory>} />
        <Route path="/advisory/state/:stateCode" element={<RequireInternalAdvisory><AdvisoryStateDetail /></RequireInternalAdvisory>} />
        <Route path="/advisory/:category" element={<RequireInternalAdvisory><AdvisoryCategoryHub /></RequireInternalAdvisory>} />

        <Route path="/staff" element={<StaffPortal />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <SplashScreen />
            <AuthenticatedApp />
            <ChatWidget />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
