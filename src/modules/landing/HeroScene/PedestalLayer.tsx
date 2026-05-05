"use client";

import { motion } from "framer-motion";

interface PedestalLayerProps {
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

const LIGHT_PARTICLES = [
  { left: "22%", size: 6, delay: 0.0, duration: 2.3 },
  { left: "34%", size: 4, delay: 0.55, duration: 1.9 },
  { left: "46%", size: 7, delay: 0.22, duration: 2.6 },
  { left: "54%", size: 5, delay: 0.85, duration: 2.0 },
  { left: "66%", size: 6, delay: 0.3, duration: 2.4 },
  { left: "78%", size: 4, delay: 1.0, duration: 2.1 },
];

const LIGHT_RAYS = [
  { left: "18%", width: "14%", rotate: -10, opacity: 0.26 },
  { left: "36%", width: "16%", rotate: -4, opacity: 0.34 },
  { left: "52%", width: "15%", rotate: 3, opacity: 0.3 },
  { left: "68%", width: "13%", rotate: 10, opacity: 0.24 },
];

export function PedestalLayer({ mouseX, mouseY, reduceMotion }: PedestalLayerProps) {
  const parallaxX = reduceMotion ? 0 : mouseX * 0.1 * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * 0.1 * 12;

  return (
    <div className="claw42-hero-pedestal-layer pointer-events-none absolute inset-0">
      <motion.div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "20%",
          width: "min(340px, 29vw)",
          height: "min(230px, 19vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 15,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 48% 100% at 50% 100%, rgba(160,134,255,0.72) 0%, rgba(124,92,255,0.48) 28%, rgba(88,58,215,0.24) 52%, transparent 76%)",
            filter: "blur(12px)",
          }}
          animate={reduceMotion ? { opacity: 0.65 } : { opacity: [0.45, 0.85, 0.45] }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "27%",
          width: "min(206px, 17vw)",
          height: "min(286px, 24vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 17,
          background:
            "linear-gradient(180deg, rgba(198,182,255,0) 0%, rgba(198,182,255,0.24) 18%, rgba(149,121,255,0.52) 42%, rgba(96,73,246,0.46) 66%, rgba(73,201,255,0.14) 82%, rgba(73,201,255,0) 100%)",
          filter: "blur(26px)",
          borderRadius: "999px",
        }}
        animate={reduceMotion ? { opacity: 0.9 } : { opacity: [0.48, 0.92, 0.48] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 overflow-visible"
        style={{
          bottom: "28%",
          width: "min(232px, 19vw)",
          height: "min(292px, 24vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 18,
        }}
      >
        {LIGHT_RAYS.map((ray) => (
          <motion.div
            key={`ray-${ray.left}`}
            className="absolute bottom-0 rounded-full"
            style={{
              left: ray.left,
              width: ray.width,
              height: "100%",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(220,212,255,0.24) 22%, rgba(140,114,255,0.42) 62%, rgba(73,201,255,0.08) 100%)",
              filter: "blur(10px)",
              opacity: ray.opacity,
              transform: `skewX(${ray.rotate}deg)`,
              transformOrigin: "bottom center",
            }}
            animate={
              reduceMotion
                ? { opacity: ray.opacity }
                : { opacity: [ray.opacity * 0.7, ray.opacity * 1.25, ray.opacity * 0.7] }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 2.1, repeat: Infinity, ease: "easeInOut" }
            }
          />
        ))}

        {LIGHT_PARTICLES.map((particle) => (
          <motion.span
            key={`particle-${particle.left}`}
            className="absolute bottom-[4%] rounded-full"
            style={{
              left: particle.left,
              width: particle.size,
              height: particle.size,
              background: "rgba(237, 232, 255, 0.92)",
              boxShadow: "0 0 12px rgba(196, 183, 255, 0.8), 0 0 22px rgba(73,201,255,0.42)",
              filter: "blur(0.4px)",
            }}
            animate={
              reduceMotion
                ? { opacity: 0.8, y: -88 }
                : {
                    y: [0, -188],
                    opacity: [0, 0.95, 0],
                    scale: [0.6, 1.05, 0.42],
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: particle.duration,
                    delay: particle.delay,
                    repeat: Infinity,
                    ease: "easeOut",
                  }
            }
          />
        ))}
      </div>

      <motion.div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "33%",
          width: "min(260px, 22vw)",
          height: "min(132px, 10vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 18,
          background:
            "radial-gradient(ellipse 52% 68% at 50% 56%, rgba(207,190,255,0.98) 0%, rgba(154,125,255,0.72) 24%, rgba(108,79,244,0.46) 44%, rgba(73,201,255,0.18) 64%, transparent 82%)",
          filter: "blur(24px)",
        }}
        animate={reduceMotion ? { opacity: 0.88 } : { opacity: [0.62, 1, 0.62] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "32%",
          width: "min(196px, 16vw)",
          height: "min(196px, 16vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 19,
          background:
            "radial-gradient(circle, rgba(228,218,255,0.98) 0%, rgba(176,152,255,0.72) 28%, rgba(111,86,248,0.28) 54%, transparent 78%)",
          filter: "blur(20px)",
        }}
        animate={reduceMotion ? { opacity: 0.96 } : { opacity: [0.76, 1, 0.76] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 1.7, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <div
        className="pointer-events-none absolute left-1/2"
        style={{
          bottom: "20%",
          width: "min(456px, 40vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 10,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero/pedestal.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-auto w-full select-none"
        />
        <motion.div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            top: "-10%",
            width: "74%",
            height: "46%",
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(160,136,255,0.7), rgba(124,92,255,0.32) 48%, transparent 74%)",
            filter: "blur(10px)",
          }}
          animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.4, 0.8, 0.4] }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>
    </div>
  );
}
