import "./styles/globals.css";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router";

// Create a client
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </ThemeProvider>
);
