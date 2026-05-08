"use client";

import { useEffect } from "react";
import { registerWebVitals } from "@/lib/observability/web-vitals";

const OPTOUT_KEY = "claw42_observability_optout";

export function WebVitalsBeacon() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (process.env.NEXT_PUBLIC_TEST_ENV === "true") return;

    try {
      if (window.localStorage.getItem(OPTOUT_KEY) === "true") return;
    } catch {
      return;
    }

    registerWebVitals();
  }, []);

  return null;
}
