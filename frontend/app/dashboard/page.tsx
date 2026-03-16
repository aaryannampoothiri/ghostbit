"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useMemo, useState } from "react";
import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { CapacityMeter } from "@/components/capacity-meter";

type AnalyzeResult = {
  capacity_bits: number;
  capacity_bytes: number;
  eligible_pixels: number;
  variance_threshold: number;
  image_fingerprint: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function SectionReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function DashboardPage() {
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [secretMessage, setSecretMessage] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [usedBits, setUsedBits] = useState(0);
  const [stegoUrl, setStegoUrl] = useState<string | null>(null);
  const [extractFile, setExtractFile] = useState<File | null>(null);
  const [decodeKey, setDecodeKey] = useState("");
  const [extractedMessage, setExtractedMessage] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { scrollYProgress } = useScroll();
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const cursorX = useMotionValue(-300);
  const cursorY = useMotionValue(-300);
  const smoothX = useSpring(cursorX, { stiffness: 190, damping: 28, mass: 0.25 });
  const smoothY = useSpring(cursorY, { stiffness: 190, damping: 28, mass: 0.25 });

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      cursorX.set(event.clientX - 120);
      cursorY.set(event.clientY - 120);
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [cursorX, cursorY]);

  const estimatedUsedBits = useMemo(() => {
    if (!secretMessage) {
      return 0;
    }
    const utf8ByteLength = new TextEncoder().encode(secretMessage).length;
    const encryptionOverheadBytes = 4 + 12 + 16;
    return (utf8ByteLength + encryptionOverheadBytes) * 8;
  }, [secretMessage]);

  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCoverImage(file);
    setAnalysis(null);
    setUsedBits(0);
    setStegoUrl(null);
    setError("");
    setStatus("");

    if (file) {
      await analyze(file);
    }
  };

  const analyze = async (fileArg?: File) => {
    const file = fileArg ?? coverImage;
    if (!file) {
      setError("Upload a cover image first.");
      return;
    }
    setLoading(true);
    setError("");
    setStatus("Analyzing entropy map...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({ detail: "Analyze failed" }));
        throw new Error(details.detail ?? "Analyze failed");
      }

      const data: AnalyzeResult = await response.json();
      setAnalysis(data);
      setStatus("Entropy map ready.");
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Analyze failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const embed = async (event: FormEvent) => {
    event.preventDefault();
    if (!coverImage) {
      setError("Upload a cover image first.");
      return;
    }
    if (!secretMessage.trim()) {
      setError("Enter a secret message.");
      return;
    }
    if (!secretKey.trim()) {
      setError("Enter a secret key.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Embedding with adaptive payload scattering...");

    try {
      const formData = new FormData();
      formData.append("file", coverImage);
      formData.append("message", secretMessage);
      formData.append("key", secretKey);

      const response = await fetch(`${API_BASE}/api/embed`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({ detail: "Embed failed" }));
        throw new Error(details.detail ?? "Embed failed");
      }

      const usedBitsHeader = response.headers.get("X-GhostBit-Used-Bits");
      const used = usedBitsHeader ? Number(usedBitsHeader) : estimatedUsedBits;
      setUsedBits(Number.isFinite(used) ? used : estimatedUsedBits);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setStegoUrl(objectUrl);
      setStatus("Stego image generated in PNG format.");
    } catch (embedError) {
      setError(embedError instanceof Error ? embedError.message : "Embed failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const extract = async () => {
    if (!extractFile) {
      setError("Select a stego image to extract from.");
      return;
    }
    if (!decodeKey.trim()) {
      setError("Enter the decode key used for embedding.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Extracting message using Ghost-Bit traversal map...");

    try {
      const formData = new FormData();
      formData.append("file", extractFile);
      formData.append("key", decodeKey);

      const response = await fetch(`${API_BASE}/api/extract`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({ detail: "Extract failed" }));
        throw new Error(details.detail ?? "Extract failed");
      }

      const data = (await response.json()) as { message: string };
      setExtractedMessage(data.message);
      setStatus("Message extracted successfully.");
    } catch (extractError) {
      setError(extractError instanceof Error ? extractError.message : "Extract failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleDecodeAction = async () => {
    if (extractedMessage) {
      setExtractFile(null);
      setExtractedMessage("");
      setStatus("Ready to decode a new message.");
      setError("");
      return;
    }

    await extract();
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <motion.div
        style={{ x: smoothX, y: smoothY }}
        className="pointer-events-none fixed left-0 top-0 z-10 hidden h-60 w-60 rounded-full bg-emerald-400/20 blur-3xl md:block"
      />
      <motion.div
        style={{ y: orbY }}
        className="pointer-events-none absolute left-1/2 top-20 -z-0 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-400/35 via-emerald-500/15 to-transparent blur-3xl"
      />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="/" aria-label="GhostBit home" className="mr-4">
            <img src="/logo.png" alt="GhostBit logo" className="h-[5rem] w-auto object-contain" />
          </a>
          <Link
            href="/"
            aria-label="Go to landing page"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500/25 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                d="M3 11.5L12 4L21 11.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 10.5V20H18V10.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 20V14H14V20"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      <div className="w-full px-4 pb-10 pt-10 md:pt-12">
        <SectionReveal>
          <h1 className="mb-8 text-3xl font-semibold tracking-tight text-emerald-400 md:text-4xl">GhostBit Dashboard</h1>
        </SectionReveal>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionReveal>
            <motion.section
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg"
            >
              <h2 className="mb-4 text-lg font-medium text-slate-100">Encode Panel</h2>

              <form onSubmit={embed} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Cover Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-2 text-sm text-slate-200 backdrop-blur"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Secret Message</label>
                <textarea
                  rows={5}
                  value={secretMessage}
                  onChange={(event) => setSecretMessage(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100 backdrop-blur"
                  placeholder="Enter the message to hide"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Secret Key</label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(event) => setSecretKey(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100 backdrop-blur"
                  placeholder="Used for payload scattering + encryption"
                />
              </div>

              <CapacityMeter capacityBits={analysis?.capacity_bits ?? 0} usedBits={usedBits || estimatedUsedBits} />
              {analysis ? (
                <p className="text-xs text-slate-400">
                  Eligible Pixels: {analysis.eligible_pixels.toLocaleString()} · Threshold: {analysis.variance_threshold.toFixed(2)}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3 items-center">
                <motion.button
                  whileHover={{ y: -1, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => analyze()}
                  disabled={loading}
                  className="rounded-md border border-white/10 bg-slate-800/90 px-4 py-2 text-sm font-medium text-white transition hover:border-emerald-400/40 disabled:opacity-50"
                >
                  Analyze Capacity
                </motion.button>
                <motion.button
                  whileHover={{ y: -1, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  Hide Message
                </motion.button>
                {stegoUrl && (
                  <a
                    href={stegoUrl}
                    download="stego-image.png"
                    className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white ml-2"
                  >
                    Download Image
                  </a>
                )}
              </div>
            </form>
            </motion.section>
          </SectionReveal>

          <SectionReveal>
            <motion.section
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg"
            >
              <h2 className="mb-4 text-lg font-medium text-slate-100">Decode Panel</h2>

            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <h3 className="text-sm font-medium text-slate-200">Decode Test</h3>
              <input
                type="file"
                accept="image/png,image/*"
                onChange={(event) => {
                  setExtractFile(event.target.files?.[0] ?? null);
                  setExtractedMessage("");
                }}
                className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-2 text-sm text-slate-200 backdrop-blur"
              />
              <input
                type="password"
                value={decodeKey}
                onChange={(event) => setDecodeKey(event.target.value)}
                placeholder="Enter decode key"
                className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-2 text-sm text-slate-200 backdrop-blur"
              />
              {extractedMessage ? (
                <p className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">
                  {extractedMessage}
                </p>
              ) : null}
              <motion.button
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleDecodeAction}
                disabled={loading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {extractedMessage ? "Extract New Message" : "Extract Message"}
              </motion.button>
            </div>
            </motion.section>
          </SectionReveal>
        </div>

        {(status || error) && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-sm backdrop-blur-lg">
            {status ? <p className="text-slate-300">{status}</p> : null}
            {error ? <p className="mt-1 text-rose-400">{error}</p> : null}
          </div>
        )}
      </div>
    </main>
  );
}
