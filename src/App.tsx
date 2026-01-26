import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { GlobalAudioPlayer } from "@/components/GlobalAudioPlayer";
import Home from "./pages/Home";
import Generator from "./pages/Generator";
import Katalog from "./pages/Katalog";
import SocialTools from "./pages/SocialTools";
import AudioGenerator from "./pages/AudioGenerator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AudioPlayerProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/erweitern" element={<Generator />} />
            <Route path="/katalog" element={<Katalog />} />
            <Route path="/social-tools" element={<SocialTools />} />
            <Route path="/audio-generator" element={<AudioGenerator />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <GlobalAudioPlayer />
      </AudioPlayerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
