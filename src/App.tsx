import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { PageTransition } from "@/components/layout/PageTransition";
import Home from "./pages/Home";
import FlashFirmware from "./pages/FlashFirmware";
import GitHub from "./pages/GitHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-14 flex items-center justify-between border-b px-4">
                <SidebarTrigger />
                <ThemeSelector />
              </header>
              <main className="flex-1 overflow-hidden">
                <PageTransition>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/flash" element={<FlashFirmware />} />
                    <Route path="/github" element={<GitHub />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </PageTransition>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
