import { ReactNode } from "react";
import { TopBar } from "./TopBar";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen">
      <div className="aurora" aria-hidden />
      <div className="aurora-veil" aria-hidden />
      <div className="relative z-10">
        <TopBar />
        {children}
      </div>
    </main>
  );
}
