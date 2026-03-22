import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import { UpdateBanner } from "@/components/UpdateBanner";

export const metadata: Metadata = {
  title: "Clawdesk — Mission Control",
  description: "Operator console for OpenClaw AI systems",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Inline script: apply theme class before first paint — prevents FOUC */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('clawdesk:theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <Providers>{children}</Providers>
        <Toaster />
        <UpdateBanner />
      </body>
    </html>
  );
}
