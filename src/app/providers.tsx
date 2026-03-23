"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BudgetWatcher } from "@/components/BudgetWatcher";
import { BackupScheduler } from "@/components/BackupScheduler";
import { SkillUpdater } from "@/components/SkillUpdater";
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
          <SkillUpdater />
          {children}
        </LicenseProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
