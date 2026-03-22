"use client";

import { createContext, useContext, ReactNode, useState } from "react";
import { useLicense, UseLicense } from "@/lib/license";
import { LicenseModal } from "@/components/LicenseModal";

interface LicenseContextValue extends UseLicense {
  openModal: () => void;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const license = useLicense();
  const [modalOpen, setModalOpen] = useState(false);

  const value: LicenseContextValue = {
    ...license,
    openModal: () => setModalOpen(true),
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
      <LicenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isPro={license.isPro}
        storedKey={license.storedKey}
        activate={license.activate}
        deactivate={license.deactivate}
      />
    </LicenseContext.Provider>
  );
}

export function useLicenseContext(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error("useLicenseContext must be used inside LicenseProvider");
  return ctx;
}
