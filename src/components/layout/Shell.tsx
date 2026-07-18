import type { ReactNode } from "react";

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  return (
    <div className="sa-root">
      <div className="sa-grid" aria-hidden="true" />
      <div className="sa-scanline" aria-hidden="true" />

      <main className="sa-main">{children}</main>
    </div>
  );
}
