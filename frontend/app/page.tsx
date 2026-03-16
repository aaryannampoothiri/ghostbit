"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform
} from "framer-motion";

function SectionReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function RadarVisual() {
  return (
    <div className="relative h-24 overflow-hidden rounded-lg border border-emerald-400/30 bg-slate-950/80">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.3)_0%,_transparent_70%)]" />
      <motion.div
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent"
        animate={{ x: ["-20%", "120%"] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
      />
      <div className="absolute inset-3 grid grid-cols-6 gap-1 opacity-70">
        {Array.from({ length: 36 }).map((_, index) => (
          <div key={index} className="rounded-sm bg-emerald-400/20" />
        ))}
      </div>
    </div>
  );
}

function ShuffleVisual() {
  return (
    <div className="grid h-24 grid-cols-6 gap-1 rounded-lg border border-emerald-400/30 bg-slate-950/80 p-3">
      {Array.from({ length: 24 }).map((_, index) => (
        <motion.div
          key={index}
          className="rounded-sm bg-emerald-400/70"
          animate={{
            y: [0, index % 2 === 0 ? 8 : -8, 0],
            x: [0, index % 3 === 0 ? 5 : -5, 0]
          }}
          transition={{ duration: 1.8 + (index % 6) * 0.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function LosslessVisual() {
  return (
    <div className="flex h-24 items-center justify-between rounded-lg border border-emerald-400/30 bg-slate-950/80 px-4">
      <span className="text-sm font-semibold text-slate-300">JPG</span>
      <div className="relative h-8 w-16 rounded-full bg-slate-800 p-1">
        <motion.div
          className="h-6 w-6 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/40"
          initial={{ x: 0 }}
          animate={{ x: 32 }}
          transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.6, ease: "easeInOut" }}
        />
      </div>
      <span className="text-sm font-semibold text-emerald-300">PNG</span>
    </div>
  );
}

type ModalPayload =
  | {
      kind: "feature";
      title: string;
      summary: string;
      detail: string;
    }
  | {
      kind: "comparison";
      title: string;
      summary: string;
      ghostbit: string;
      conventional: string;
      impact: string;
    };

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const cursorX = useMotionValue(-300);
  const cursorY = useMotionValue(-300);
  const smoothX = useSpring(cursorX, { stiffness: 190, damping: 28, mass: 0.25 });
  const smoothY = useSpring(cursorY, { stiffness: 190, damping: 28, mass: 0.25 });
  const [activeModal, setActiveModal] = useState<ModalPayload | null>(null);

  const featureCards = useMemo(
    () => [
      {
        title: "Dynamic Entropy Mapping",
        summary:
          "A radar-style entropy pass locates texture and edge zones, avoiding smooth pixel fields where LSB edits become detectable.",
        detail:
          "GhostBit computes local variance in 8x8 blocks, then prioritizes high-noise regions for embedding. This keeps payload changes aligned with natural image complexity and helps preserve visual quality.",
        visual: <RadarVisual />
      },
      {
        title: "Ghost-Bit Scattering",
        summary:
          "Embedding coordinates are shuffled with a Secret Key seed and image fingerprint, producing a unique non-linear traversal map.",
        detail:
          "The embedding path is generated from key + image fingerprint. Even with the same algorithm, a different key or image creates a different coordinate sequence, making extraction without exact pairing highly impractical.",
        visual: <ShuffleVisual />
      },
      {
        title: "Lossless Integrity",
        summary:
          "GhostBit outputs PNG to preserve every bit. Lossy formats like JPG can destroy embedded payloads during recompression.",
        detail:
          "Stego output is constrained to PNG to protect hidden bits from quantization artifacts introduced by lossy encoders. This ensures payload survival between encode and decode workflows.",
        visual: <LosslessVisual />
      }
    ],
    []
  );

  const comparisonCards = useMemo(
    () => [
      {
        title: "Embedding Path",
        summary: "Randomized entropy-aware traversal vs predictable linear pixel walk.",
        ghostbit:
          "GhostBit shuffles eligible coordinates using a seed derived from Secret Key + image fingerprint.",
        conventional: "Many tools embed sequentially from top-left in fixed order.",
        impact: "Lower detectability and stronger extraction resistance without the correct map seed."
      },
      {
        title: "Region Selection",
        summary: "Adaptive high-variance targeting vs uniform all-region writing.",
        ghostbit:
          "GhostBit embeds in texture-rich blocks while skipping smooth surfaces.",
        conventional: "Traditional LSB methods often modify pixels across smooth and noisy areas alike.",
        impact: "Fewer visible artifacts and reduced statistical signature in flat backgrounds."
      },
      {
        title: "Format Safety",
        summary: "PNG-locked workflow vs weak lossy-format tolerance.",
        ghostbit:
          "Output is intentionally lossless to preserve bit-level payload integrity.",
        conventional: "Some workflows save in lossy formats, risking payload corruption.",
        impact: "More reliable decode outcomes and lower accidental payload destruction."
      },
      {
        title: "Key Linkage",
        summary: "Image-bound seed rotation vs static key-only extraction paths.",
        ghostbit:
          "Map generation changes with both key and source image fingerprint.",
        conventional: "Extraction often relies on static key and fixed traversal assumptions.",
        impact: "Brute-force strategy becomes harder because map topology shifts per image-key pair."
      }
    ],
    []
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      cursorX.set(event.clientX - 120);
      cursorY.set(event.clientY - 120);
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [cursorX, cursorY]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <motion.div
        style={{ x: smoothX, y: smoothY }}
        className="pointer-events-none fixed left-0 top-0 z-10 hidden h-60 w-60 rounded-full bg-emerald-400/20 blur-3xl md:block"
      />
      <motion.div
        style={{ y: orbY }}
        className="pointer-events-none absolute left-1/2 top-16 -z-0 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-400/35 via-emerald-500/15 to-transparent blur-3xl"
      />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-start px-6">
          <a href="/" aria-label="GhostBit home">
            <img src="/logo.png" alt="GhostBit logo" className="h-[3.75rem] w-auto object-contain" />
          </a>
        </div>
      </header>

      <section className="hero-grid relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SectionReveal>
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-emerald-400">Invisible by Design</p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-slate-50 md:text-6xl">
              GhostBit: The Science of Invisible Security.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              GhostBit hides data only in high-entropy image regions and scatters the payload path with key-seeded
              traversal, making extraction without the key computationally improbable.
            </p>
          </SectionReveal>

          <SectionReveal>
            <div className="flex items-center justify-center lg:justify-end">
              <motion.a
                href="/dashboard"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="group relative flex h-56 w-56 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-center shadow-xl shadow-emerald-500/20 backdrop-blur-xl"
              >
                <span className="px-6 text-base font-semibold leading-snug text-emerald-100 transition group-hover:text-white">
                  Open GhostBit Workspace
                </span>
              </motion.a>
            </div>
          </SectionReveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <SectionReveal>
          <div className="grid gap-5 md:grid-cols-3">
            {featureCards.map((card) => (
              <motion.button
                key={card.title}
                type="button"
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() =>
                  setActiveModal({
                    kind: "feature",
                    title: card.title,
                    summary: card.summary,
                    detail: card.detail
                  })
                }
                className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-lg"
              >
                <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/80 p-4 text-emerald-300 shadow-lg shadow-emerald-500/10 transition-colors duration-300 group-hover:border-emerald-400/40">
                  {card.visual}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-100">{card.title}</h3>
                <p className="text-sm leading-relaxed text-slate-300">{card.summary}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-emerald-400">Click to inspect</p>
              </motion.button>
            ))}
          </div>
        </SectionReveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-6">
        <SectionReveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg">
            <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
            <h2 className="text-2xl font-semibold text-slate-100">Why GhostBit Stands Out</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Most steganography tools write bits in linear pixel order, which leaves statistical signatures. GhostBit
              is built to avoid that pattern with entropy-aware, key-bound scattering.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {comparisonCards.map((card, index) => (
                <motion.button
                  key={card.title}
                  type="button"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 + index * 0.05, ease: "easeOut" }}
                  whileHover={{ y: -3 }}
                  onClick={() =>
                    setActiveModal({
                      kind: "comparison",
                      title: card.title,
                      summary: card.summary,
                      ghostbit: card.ghostbit,
                      conventional: card.conventional,
                      impact: card.impact
                    })
                  }
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-left"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Contrast Node</p>
                  <h3 className="mt-2 text-base font-semibold text-slate-100">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{card.summary}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </SectionReveal>
      </section>

      <AnimatePresence>
        {activeModal ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-emerald-500/10"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                    {activeModal.kind === "feature" ? "GhostBit Feature" : "GhostBit vs Conventional"}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-100">{activeModal.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-300 hover:border-emerald-400/40 hover:text-emerald-300"
                >
                  Close
                </button>
              </div>

              <p className="text-sm text-slate-300">{activeModal.summary}</p>

              {activeModal.kind === "feature" ? (
                <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-200">
                  {activeModal.detail}
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">GhostBit</p>
                    <p className="mt-2 text-sm text-slate-100">{activeModal.ghostbit}</p>
                  </div>
                  <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-rose-300">Conventional Tools</p>
                    <p className="mt-2 text-sm text-slate-100">{activeModal.conventional}</p>
                  </div>
                  <div className="md:col-span-2 rounded-xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Practical Impact</p>
                    <p className="mt-2 text-sm text-slate-200">{activeModal.impact}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
