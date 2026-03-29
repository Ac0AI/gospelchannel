import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Gospel Channel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
