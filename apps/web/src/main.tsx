import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { App } from "@/app/App";
import { ThemeProvider } from "@/theme/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/index.css";

const storedTheme = window.localStorage.getItem("edgelog-theme");
const initialTheme =
  storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

document.documentElement.dataset.theme = initialTheme;
document.documentElement.classList.toggle("dark", initialTheme === "dark");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
