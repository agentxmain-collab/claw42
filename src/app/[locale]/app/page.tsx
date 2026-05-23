import type { Metadata } from "next";
import { EMPTY_LANDING_CONTEXT } from "@/lib/coinw/landingContext";
import ClientLandingPage from "../ClientLandingPage";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AppSurfacePage() {
  return (
    <div className="claw42-app-surface" data-surface="app">
      <ClientLandingPage landingContext={EMPTY_LANDING_CONTEXT} />
    </div>
  );
}
