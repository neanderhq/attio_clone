import "./style.css";
import type { ReactNode } from "react";
export const metadata = { title: "Ledger CRM · Workspaces" };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
