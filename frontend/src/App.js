import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/sonner";
import { TranslationProvider } from "./contexts/TranslationContext";
import HomePage from "./pages/HomePage";
import WatchPage from "./pages/WatchPageV2";
import LibraryPage from "./pages/LibraryPage";
import VideoDetailPage from "./pages/VideoDetailPage";
import SubmitPage from "./pages/SubmitPage";
import UploadAndEarnPage from "./pages/UploadAndEarnPage";
import SchedulePage from "./pages/SchedulePage";
import StreamSubmitPage from "./pages/StreamSubmitPage";
import AdminDashboard from "./pages/AdminDashboardV2";
import AdminCreatorImport from "./pages/AdminCreatorImport";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import PushNotificationPrompt from "./components/PushNotificationPrompt";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AuthCallback from "./pages/AuthCallback";
import CreatorDashboard from "./pages/CreatorDashboard";
import CreatorLibraryPage from "./pages/CreatorLibraryPage";
import TVGuidePage from "./pages/TVGuidePage";
import CreatorProfilePage from "./pages/CreatorProfilePage";
import PromoPage from "./pages/PromoPage";
import TipCreatorPage, { TipSuccessPage, TipCancelPage } from "./pages/TipCreatorPage";
import AdKitPage from "./pages/AdKitPage";
import PromoPlaylistPage from "./pages/PromoPlaylistPage";
import BrowsePage from "./pages/BrowsePage";
import CreatorAgreementPage from "./pages/CreatorAgreementPage";
import ContentGuidelinesPage from "./pages/ContentGuidelinesPage";
import CreatorPartnersPage from "./pages/CreatorPartnersPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import PromoDownloadsPage from "./pages/PromoDownloadsPage";
import AppDownloadPage from "./pages/AppDownloadPage";
import PromoLibraryPage from "./pages/PromoLibraryPage";
import NotFoundPage from "./pages/NotFoundPage";
import PasswordResetPage from "./pages/PasswordResetPage";
import CreatorSchedulePage from "./pages/CreatorSchedulePage";
import YouTubeImportPage from "./pages/YouTubeImportPage";
import VotePage from "./pages/VotePage";
import RewardDemo from "./pages/RewardDemo";
import RewardsPage from "./pages/RewardsPage";
import PlayPage from "./pages/PlayPage";
import JoinPage from "./pages/JoinPage";
import DoorDashCertDemo from "./pages/DoorDashCertDemo";
import BigScreenTestPage from "./pages/BigScreenTestPage";
import IntroSequence from "./pages/IntroSequence";
import RokuStreamPage from "./pages/RokuStreamPage";
import RokuBroadcastFeed from "./pages/RokuBroadcastFeed";
import BroadcastTest from "./pages/BroadcastTest";
import OBSBroadcastPage from "./pages/OBSBroadcastPage";
import RokuTVBroadcast from "./pages/RokuTVBroadcast";
import RokuPreview from "./pages/RokuPreview";
import BlogPage from "./pages/BlogPage";
import GamePromoPage from "./pages/GamePromoPage";
import GameAdPopup from "./pages/GameAdPopup";
import GameAdInterstitial from "./pages/GameAdInterstitial";
import GameAdEmbed from "./pages/GameAdEmbed";
import HowToPlayPage from "./pages/HowToPlayPage";
import BroadcastView from "./pages/BroadcastView";
import OBSPlayerPage from "./pages/OBSPlayerPage";
import OBSCleanFeed from "./pages/OBSCleanFeed";
import OBSPromoFeed from "./pages/OBSPromoFeed";
import OBSCreatorFeed from "./pages/OBSCreatorFeed";
import AdminBroadcastControl from "./pages/AdminBroadcastControl";
import { RedirectToWatch, RedirectToLibrary, RedirectToHome, RedirectToTrending } from "./components/Redirects";
import ScrollToTop from "./components/ScrollToTop";
import SEOHead from "./components/SEOHead";
import GlobalCreatorBanner from "./components/GlobalCreatorBanner";
import GlobalNav from "./components/GlobalNav";
import AppDownloadPopup from "./components/AppDownloadPopup";

// Router component that handles auth callback detection
function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment for session_id (OAuth callback) - must be synchronous
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <>
      <SEOHead />
      <Routes>
        <Route path="/" element={<HomePage />} />
      <Route path="/watch" element={<WatchPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/video/:id" element={<VideoDetailPage />} />
      <Route path="/submit" element={<SubmitPage />} />
      <Route path="/upload" element={<UploadAndEarnPage />} />
      <Route path="/upload-and-earn" element={<UploadAndEarnPage />} />
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="/stream-submit" element={<StreamSubmitPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/broadcast" element={<AdminBroadcastControl />} />
      <Route path="/admin/creator-import" element={<AdminCreatorImport />} />
      <Route path="/broadcast-control" element={<AdminBroadcastControl />} />
      
      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      
      {/* Social Game Deep Links */}
      <Route path="/play" element={<PlayPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      
      {/* TV Guide */}
      <Route path="/guide" element={<TVGuidePage />} />
      <Route path="/tv-guide" element={<TVGuidePage />} />
      <Route path="/epg" element={<TVGuidePage />} />
      
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Creator Routes */}
      <Route path="/creator/dashboard" element={<CreatorDashboard />} />
      <Route path="/creator/library" element={<CreatorLibraryPage />} />
      <Route path="/creator/schedule" element={<CreatorSchedulePage />} />
      <Route path="/creator/import" element={<YouTubeImportPage />} />
      <Route path="/creator/youtube-import" element={<YouTubeImportPage />} />
      <Route path="/creator" element={<CreatorDashboard />} />
      <Route path="/creator/:username" element={<CreatorProfilePage />} />
      <Route path="/c/:username" element={<CreatorProfilePage />} />
      <Route path="/dashboard" element={<CreatorDashboard />} />
      <Route path="/browse" element={<BrowsePage />} />
      <Route path="/schedule-slot" element={<CreatorSchedulePage />} />
      
      {/* Payment Routes */}
      <Route path="/tip/:creatorId" element={<TipCreatorPage />} />
      <Route path="/tip/success" element={<TipSuccessPage />} />
      <Route path="/tip/cancel" element={<TipCancelPage />} />
      
      {/* Promo Page */}
      <Route path="/promo" element={<PromoPage />} />
      
      {/* Ad Kit Page */}
      <Route path="/ad-kit" element={<AdKitPage />} />
      
      {/* Promo Playlist - 24/7 Loop */}
      <Route path="/promos" element={<PromoPlaylistPage />} />
      
      {/* Legal Pages */}
      <Route path="/creator-agreement" element={<CreatorAgreementPage />} />
      <Route path="/content-guidelines" element={<ContentGuidelinesPage />} />
      <Route path="/guidelines" element={<ContentGuidelinesPage />} />
      <Route path="/creators" element={<CreatorPartnersPage />} />
      <Route path="/partner" element={<CreatorPartnersPage />} />
      <Route path="/partners" element={<CreatorPartnersPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/tos" element={<TermsOfServicePage />} />
      
      {/* Password Reset */}
      <Route path="/password/reset" element={<PasswordResetPage />} />
      <Route path="/forgot-password" element={<PasswordResetPage />} />
      <Route path="/reset-password" element={<PasswordResetPage />} />
      
      {/* Legacy URL Redirects - Old URLs that Google indexed */}
      <Route path="/stream/*" element={<RedirectToWatch />} />
      <Route path="/watch/stream/*" element={<RedirectToWatch />} />
      <Route path="/category/*" element={<RedirectToLibrary />} />
      <Route path="/on-demand" element={<RedirectToLibrary />} />
      <Route path="/on-demand/*" element={<RedirectToLibrary />} />
      <Route path="/trending" element={<RedirectToTrending />} />
      <Route path="/live" element={<RedirectToWatch />} />
      <Route path="/tv" element={<RedirectToWatch />} />
      
      {/* Promo Library */}
      <Route path="/promo-library" element={<PromoLibraryPage />} />
      <Route path="/promo-downloads" element={<PromoDownloadsPage />} />
      <Route path="/promo-videos" element={<PromoDownloadsPage />} />
      
      {/* App Download - Device-specific installation */}
      <Route path="/download" element={<AppDownloadPage />} />
      <Route path="/downloads" element={<AppDownloadPage />} />
      <Route path="/get-app" element={<AppDownloadPage />} />
      <Route path="/install" element={<AppDownloadPage />} />
      
      {/* Game Show Voting */}
      <Route path="/vote/:gameId" element={<VotePage />} />
      <Route path="/reward-demo" element={<RewardDemo />} />
      <Route path="/rewards" element={<RewardsPage />} />
      <Route path="/doordash-demo" element={<DoorDashCertDemo />} />
      
      {/* Game Promo Page */}
      <Route path="/game" element={<GamePromoPage />} />
      <Route path="/game-promo" element={<GamePromoPage />} />
      <Route path="/trivia" element={<GamePromoPage />} />
      <Route path="/game-ad" element={<GameAdPopup />} />
      <Route path="/ad" element={<GameAdPopup />} />
      <Route path="/ad-interstitial" element={<GameAdInterstitial />} />
      <Route path="/interstitial" element={<GameAdInterstitial />} />
      <Route path="/embed-ad" element={<GameAdEmbed />} />
      <Route path="/game-embed" element={<GameAdEmbed />} />
      <Route path="/howtoplay" element={<HowToPlayPage />} />
      <Route path="/how-to-play" element={<HowToPlayPage />} />
      <Route path="/tutorial" element={<HowToPlayPage />} />
      <Route path="/broadcast-view" element={<BroadcastView />} />
      <Route path="/obs" element={<BroadcastView />} />
      <Route path="/obs-player" element={<OBSPlayerPage />} />
      
      {/* OBS Clean Feed - Pure HLS stream, no overlays, no YouTube */}
      <Route path="/obs-clean" element={<OBSCleanFeed />} />
      <Route path="/broadcast-feed" element={<OBSCleanFeed />} />
      <Route path="/clean-feed" element={<OBSCleanFeed />} />
      
      {/* OBS Promo Feed - Local promo video loop for filling gaps */}
      <Route path="/obs-promo" element={<OBSPromoFeed />} />
      <Route path="/promo-feed" element={<OBSPromoFeed />} />
      
      {/* OBS Creator Feed - TV scheduler sync with heavy YouTube overlays */}
      <Route path="/obs-creator" element={<OBSCreatorFeed />} />
      <Route path="/creator-feed" element={<OBSCreatorFeed />} />
      
      <Route path="/fb-live" element={<BroadcastView />} />
      <Route path="/stream-overlay" element={<BroadcastView />} />
      <Route path="/bigscreen-test" element={<BigScreenTestPage />} />
      <Route path="/intro" element={<IntroSequence />} />
      
      {/* RTMP Streaming Pages - for Roku/Fire TV broadcast capture */}
      <Route path="/roku-stream" element={<RokuStreamPage />} />
      <Route path="/broadcast" element={<RokuBroadcastFeed />} />
      <Route path="/roku-feed" element={<RokuBroadcastFeed />} />
      <Route path="/broadcast-test" element={<BroadcastTest />} />
      <Route path="/tv" element={<RokuTVBroadcast />} />
      <Route path="/roku-tv" element={<RokuTVBroadcast />} />
      <Route path="/obs-broadcast" element={<OBSBroadcastPage />} />
      <Route path="/roku-preview" element={<RokuPreview />} />
      
      {/* Blog Routes */}
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPage />} />
      
      {/* 404 - Catch all unmatched routes */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}

// Component that checks if we're on an OBS route
function AppShell() {
  const location = useLocation();
  const isOBSRoute = location.pathname.startsWith('/obs-') || 
                     location.pathname === '/broadcast-feed' || 
                     location.pathname === '/clean-feed' ||
                     location.pathname === '/creator-feed' ||
                     location.pathname === '/promo-feed';
  
  return (
    <>
      <ScrollToTop />
      {/* Hide all overlays/popups/nav on OBS routes */}
      {!isOBSRoute && <GlobalCreatorBanner />}
      <AppRouter />
      {!isOBSRoute && <GlobalNav />}
      {!isOBSRoute && <AppDownloadPopup />}
    </>
  );
}

function App() {
  return (
    <HelmetProvider>
      <div className="App min-h-screen bg-background">
        <TranslationProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </TranslationProvider>
        {/* PWA prompt - also hide on OBS routes */}
        {!window.location.pathname.startsWith('/obs-') && <PWAInstallPrompt />}
        {/* PushNotificationPrompt disabled per user request */}
        {/* <PushNotificationPrompt showAfterSeconds={15} /> */}
        <Toaster position="bottom-right" theme="dark" />
      </div>
    </HelmetProvider>
  );
}

export default App;
