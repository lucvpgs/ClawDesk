"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BudgetWatcher } from "@/components/BudgetWatcher";
import { BackupScheduler } from "@/components/BackupScheduler";
import { LicenseProvider } from "@/contexts/LicenseContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LicenseProvider>
          <BudgetWatcher />
          <BackupScheduler />
          {children}
        </LicenseProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
