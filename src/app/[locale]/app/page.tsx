import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AppSurfacePage() {
  return (
    <div className="claw42-app-surface" data-surface="app">
      <Home />
    </div>
  );
}
