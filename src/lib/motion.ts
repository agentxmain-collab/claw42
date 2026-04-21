import type { Variants } from "framer-motion";

export const motionViewport = { once: true, amount: 0.2 };

export const sectionTransition = {
  duration: 0.6,
  ease: "easeOut" as const,
};

export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: motionViewport,
  transition: sectionTransition,
};

export const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: motionViewport,
  transition: sectionTransition,
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.98 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: motionViewport,
  transition: sectionTransition,
};

export const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.08,
    },
  },
  viewport: motionViewport,
};

export const staggerItem = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: sectionTransition,
};

export function fadeUpVariants(reduceMotion?: boolean | null): Variants {
  return {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 24 },
    visible: { opacity: 1, y: 0 },
  };
}

export function fadeScaleVariants(reduceMotion?: boolean | null): Variants {
  return {
    hidden: { opacity: 0, scale: reduceMotion ? 1 : 0.98 },
    visible: { opacity: 1, scale: 1 },
  };
}

export function fadeOnlyVariants(): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };
}

export function getFadeUpTransition(delay = 0) {
  return {
    ...sectionTransition,
    delay,
  };
}
