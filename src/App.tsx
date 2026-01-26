import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GlobalAudioPlayer } from "@/components/GlobalAudioPlayer";
import { PasswordGate } from "@/components/PasswordGate";
import Home from "./pages/Home";
import Generator from "./pages/Generator";
import Katalog from "./pages/Katalog";
import SocialTools from "./pages/SocialTools";
import AudioGenerator from "./pages/AudioGenerator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper for admin-only pages
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PasswordGate>
          <AudioPlayerProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/erweitern" element={<AdminRoute><Generator /></AdminRoute>} />
                <Route path="/katalog" element={<Katalog />} />
                <Route path="/social-tools" element={<AdminRoute><SocialTools /></AdminRoute>} />
                <Route path="/audio-generator" element={<AdminRoute><AudioGenerator /></AdminRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <GlobalAudioPlayer />
          </AudioPlayerProvider>
        </PasswordGate>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
