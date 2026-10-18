"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useMemo, useState } from "react";
import { motion, AnimatePresence, useInView, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { CapacityMeter } from "@/components/capacity-meter";

type AnalyzeResult = {
  capacity_bits: number;
  capacity_bytes: number;
  eligible_pixels: number;
  variance_threshold: number;
  image_fingerprint: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (err.message.toLowerCase().includes("failed to fetch")) {
      return "Unable to connect to the GhostBit backend. Please ensure the backend server is running and NEXT_PUBLIC_API_BASE is configured.";
    }
    return err.message;
  }
  return fallback;
}

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
  const [activeTab, setActiveTab] = useState<"encode" | "decode" | "purge">("encode");

  const [coverImage, setCoverImage] = useState<File | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [secretMessage, setSecretMessage] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [usedBits, setUsedBits] = useState(0);
  const [stegoUrl, setStegoUrl] = useState<string | null>(null);

  const [extractFile, setExtractFile] = useState<File | null>(null);
  const extractFileInputRef = useRef<HTMLInputElement>(null);
  const [decodeKey, setDecodeKey] = useState("");
  const [showDecodeKey, setShowDecodeKey] = useState(false);
  const [extractedMessage, setExtractedMessage] = useState<string>("");
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Purge panel state
  const [purgeFile, setPurgeFile] = useState<File | null>(null);
  const purgeFileInputRef = useRef<HTMLInputElement>(null);
  const [purgeKey, setPurgeKey] = useState("");
  const [showPurgeKey, setShowPurgeKey] = useState(false);
  const [purgedUrl, setPurgedUrl] = useState<string | null>(null);
  const [purgedBits, setPurgedBits] = useState<number | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeLoading, setPurgeLoading] = useState(false);

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
      setError(formatApiError(analyzeError, "Analyze failed"));
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
      setError(formatApiError(embedError, "Embed failed"));
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const extract = async () => {
    if (!extractFile) {
      setExtractError("Please select a stego image to extract from.");
      return;
    }
    if (!extractFile.name.toLowerCase().endsWith(".png")) {
      setExtractError("Invalid file format: Stego images must be PNG (.png). JPEG/compressed formats corrupt hidden data.");
      return;
    }
    if (!decodeKey.trim()) {
      setExtractError("Please enter the secret key.");
      return;
    }

    setLoading(true);
    setError("");
    setExtractError(null);
    setStatus("Extracting message...");

    try {
      const formData = new FormData();
      formData.append("file", extractFile);
      formData.append("key", decodeKey);

      const response = await fetch(`${API_BASE}/api/extract`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({ detail: "Extraction failed" }));
        throw new Error(details.detail ?? "Extraction failed");
      }

      const data = (await response.json()) as { message: string };
      setExtractedMessage(data.message);
      setStatus("Message extracted successfully.");
      setExtractError(null);
      setError("");
    } catch (err) {
      setExtractError(formatApiError(err, "Extraction failed"));
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleDecodeAction = async () => {
    await extract();
  };

  const resetEncode = () => {
    setCoverImage(null);
    setSecretMessage("");
    setSecretKey("");
    setShowSecretKey(false);
    setAnalysis(null);
    setUsedBits(0);
    setStegoUrl(null);
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = "";
    }
  };

  const resetDecode = () => {
    setExtractFile(null);
    setDecodeKey("");
    setShowDecodeKey(false);
    setExtractedMessage("");
    setCopiedMessage(false);
    setExtractError(null);
    setError("");
    setStatus("");
    if (extractFileInputRef.current) {
      extractFileInputRef.current.value = "";
    }
  };

  const handleTabChange = (nextTab: "encode" | "decode" | "purge") => {
    if (nextTab === activeTab) return;
    resetEncode();
    resetDecode();
    resetPurge();
    setStatus("");
    setError("");
    setActiveTab(nextTab);
  };

  const copyExtractedToClipboard = async () => {
    if (!extractedMessage) return;
    try {
      await navigator.clipboard.writeText(extractedMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  const purge = async () => {
    if (!purgeFile) {
      setPurgeError("Please select a stego image to purge from.");
      return;
    }
    if (!purgeFile.name.toLowerCase().endsWith(".png")) {
      setPurgeError("Invalid file format: Stego images must be PNG (.png). JPEG/compressed formats corrupt hidden data.");
      return;
    }
    if (!purgeKey.trim()) {
      setPurgeError("Please enter the secret key.");
      return;
    }

    setPurgeLoading(true);
    setPurgeError(null);
    setStatus("Scrubbing hidden payload from image...");

    try {
      const formData = new FormData();
      formData.append("file", purgeFile);
      formData.append("key", purgeKey);

      const response = await fetch(`${API_BASE}/api/purge`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({ detail: "Purge failed" }));
        throw new Error(details.detail ?? "Purge failed");
      }

      const bitsHeader = response.headers.get("X-GhostBit-Purged-Bits");
      const bits = bitsHeader ? parseInt(bitsHeader, 10) : 0;
      setPurgedBits(bits);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPurgedUrl(url);
      setStatus("Message purged successfully. Download your clean image.");
      setPurgeError(null);
    } catch (err) {
      setPurgeError(formatApiError(err, "Purge failed"));
      setStatus("");
    } finally {
      setPurgeLoading(false);
    }
  };

  const resetPurge = () => {
    setPurgeFile(null);
    setPurgeKey("");
    setPurgedUrl(null);
    setPurgedBits(null);
    setPurgeError(null);
    if (purgeFileInputRef.current) {
      purgeFileInputRef.current.value = "";
    }
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
        <div className="flex h-16 items-center justify-between pr-4">
          <a href="/" aria-label="GhostBit home" className="ml-0">
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

      <div className="w-full max-w-4xl mx-auto px-4 pb-16 pt-8 md:pt-10">
        <SectionReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-emerald-400 md:text-4xl">GhostBit Dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">Entropy-scattered LSB steganography engine.</p>
            </div>

            {/* Tab Bar */}
            <div className="inline-flex items-center rounded-2xl border border-white/10 bg-slate-900/80 p-1.5 backdrop-blur-xl shadow-lg shadow-black/40">
              <button
                type="button"
                onClick={() => handleTabChange("encode")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === "encode"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Encode
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("decode")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === "decode"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Decode
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("purge")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === "purge"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Purge
              </button>
            </div>
          </div>
        </SectionReveal>

        <AnimatePresence mode="wait">
          {activeTab === "encode" && (
            <motion.section
              key="encode"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-medium text-slate-100 flex items-center gap-2">
                    <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Encode Panel
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Encrypt and scatter hidden message payload into high-entropy image pixels.</p>
                </div>
              </div>

              <form onSubmit={embed} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300">Cover Image</label>
                    {coverImage && (
                      <button
                        type="button"
                        onClick={resetEncode}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
                      >
                        Clear Form
                      </button>
                    )}
                  </div>
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-2.5 text-sm text-slate-200 backdrop-blur"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">Secret Message</label>
                  <textarea
                    rows={4}
                    value={secretMessage}
                    onChange={(event) => setSecretMessage(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-100 backdrop-blur focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Enter the message to hide"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">Secret Key</label>
                  <div className="relative">
                    <input
                      type={showSecretKey ? "text" : "password"}
                      value={secretKey}
                      onChange={(event) => setSecretKey(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/70 p-3 pr-11 text-sm text-slate-100 backdrop-blur focus:border-emerald-500/50 focus:outline-none"
                      placeholder="Used for payload scattering + encryption"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                      title={showSecretKey ? "Hide key" : "Show key"}
                    >
                      {showSecretKey ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <CapacityMeter capacityBits={analysis?.capacity_bits ?? 0} usedBits={usedBits || estimatedUsedBits} />
                {analysis ? (
                  <p className="text-xs text-slate-400">
                    Eligible Pixels: {analysis.eligible_pixels.toLocaleString()} · Threshold: {analysis.variance_threshold.toFixed(2)}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3 items-center pt-2">
                  <motion.button
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => analyze()}
                    disabled={loading}
                    className="rounded-md border border-white/10 bg-slate-800/90 px-4 py-2.5 text-sm font-medium text-white transition hover:border-emerald-400/40 disabled:opacity-50"
                  >
                    Analyze Capacity
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {loading ? "Embedding..." : "Hide Message"}
                  </motion.button>
                  {stegoUrl && (
                    <a
                      href={stegoUrl}
                      download="ghostbit-stego.png"
                      className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                    >
                      Download Stego Image
                    </a>
                  )}
                </div>
              </form>
            </motion.section>
          )}

          {activeTab === "decode" && (
            <motion.section
              key="decode"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-medium text-slate-100 flex items-center gap-2">
                    <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Decode Panel
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Extract and decrypt hidden messages using the secret key.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-200">Stego Image (PNG)</label>
                    {extractFile && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                            extractFile.name.toLowerCase().endsWith(".png")
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {extractFile.name.toLowerCase().endsWith(".png") ? "PNG (Lossless)" : "Non-PNG Detected"}
                        </span>
                        <button
                          type="button"
                          onClick={resetDecode}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    ref={extractFileInputRef}
                    type="file"
                    accept="image/png,image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setExtractFile(file);
                      setExtractedMessage("");
                      setExtractError(null);
                      setError("");
                    }}
                    className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-2.5 text-sm text-slate-200 backdrop-blur focus:border-emerald-500/50 focus:outline-none"
                  />
                  {extractFile && !extractFile.name.toLowerCase().endsWith(".png") && (
                    <p className="mt-2 text-xs text-amber-300/90 flex items-center gap-1.5">
                      <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      JPEG/WebP compression alters LSB bits. Make sure to use the downloaded lossless PNG.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-200">Decode Key</label>
                    {decodeKey.length > 0 && decodeKey.trim() !== decodeKey && (
                      <button
                        type="button"
                        onClick={() => setDecodeKey(decodeKey.trim())}
                        className="text-xs text-amber-300 hover:underline"
                      >
                        Trim outer spaces
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showDecodeKey ? "text" : "password"}
                      value={decodeKey}
                      onChange={(event) => {
                        setDecodeKey(event.target.value);
                        if (extractError) setExtractError(null);
                      }}
                      placeholder="Enter exact decode key used when hiding"
                      className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-3 pr-11 text-sm text-slate-200 backdrop-blur focus:border-emerald-500/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDecodeKey(!showDecodeKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                      title={showDecodeKey ? "Hide key" : "Show key"}
                    >
                      {showDecodeKey ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {extractedMessage ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-lg shadow-emerald-950/30"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Extracted Message ({extractedMessage.length} characters)
                      </span>
                      <button
                        type="button"
                        onClick={copyExtractedToClipboard}
                        className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 transition"
                      >
                        {copiedMessage ? "Copied!" : "Copy Text"}
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-100 font-mono bg-slate-950/50 p-3 rounded-lg border border-white/5">
                      {extractedMessage}
                    </p>
                  </motion.div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <motion.button
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleDecodeAction}
                    disabled={loading}
                    className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {loading ? "Extracting..." : "Extract Message"}
                  </motion.button>
                  {extractFile && (
                    <motion.button
                      whileHover={{ y: -1, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={resetDecode}
                      disabled={loading}
                      className="rounded-md border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    >
                      Clear Image
                    </motion.button>
                  )}
                </div>

                {/* Direct Single Error Alert */}
                {extractError && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium">{extractError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExtractError(null)}
                      className="rounded p-1 text-rose-400/70 hover:bg-white/10 hover:text-white transition"
                      aria-label="Dismiss"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.section>
          )}

          {activeTab === "purge" && (
            <motion.section
              key="purge"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg shadow-xl"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-medium text-slate-100 flex items-center gap-2">
                    <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Purge Panel
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Permanently scrub and sanitize a hidden message from a stego image using its secret key.</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  Key-Targeted Scrub
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-200">Stego Image to Purge (PNG)</label>
                    {purgeFile && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                            purgeFile.name.toLowerCase().endsWith(".png")
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {purgeFile.name.toLowerCase().endsWith(".png") ? "PNG (Lossless)" : "Non-PNG Detected"}
                        </span>
                        <button
                          type="button"
                          onClick={resetPurge}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    ref={purgeFileInputRef}
                    type="file"
                    accept="image/png,image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setPurgeFile(file);
                      setPurgedUrl(null);
                      setPurgedBits(null);
                      setPurgeError(null);
                      setError("");
                    }}
                    className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-2.5 text-sm text-slate-200 backdrop-blur focus:border-emerald-500/50 focus:outline-none"
                  />
                  {purgeFile && !purgeFile.name.toLowerCase().endsWith(".png") && (
                    <p className="mt-2 text-xs text-amber-300/90 flex items-center gap-1.5">
                      <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Stego images must be PNG. Please select a PNG file.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-200">Secret Key</label>
                    {purgeKey.length > 0 && purgeKey.trim() !== purgeKey && (
                      <button
                        type="button"
                        onClick={() => setPurgeKey(purgeKey.trim())}
                        className="text-xs text-amber-300 hover:underline"
                      >
                        Trim outer spaces
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPurgeKey ? "text" : "password"}
                      value={purgeKey}
                      onChange={(event) => {
                        setPurgeKey(event.target.value);
                        if (purgeError) setPurgeError(null);
                      }}
                      placeholder="Enter secret key used when hiding the message"
                      className="block w-full rounded-xl border border-white/10 bg-slate-900/70 p-3 pr-11 text-sm text-slate-200 backdrop-blur focus:border-emerald-500/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPurgeKey(!showPurgeKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                      title={showPurgeKey ? "Hide key" : "Show key"}
                    >
                      {showPurgeKey ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {purgedUrl ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-lg shadow-emerald-950/30"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Message Purged Successfully
                      </span>
                      {purgedBits !== null && (
                        <span className="text-xs text-slate-300 font-mono">
                          {purgedBits.toLocaleString()} bits sanitized
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">
                      The payload header and encrypted bits have been zeroed out along the key-seeded path. Extracting from this sanitized image with this key will no longer yield any data.
                    </p>
                    <a
                      href={purgedUrl}
                      download="ghostbit-purged.png"
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Sanitized Image
                    </a>
                  </motion.div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <motion.button
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={purge}
                    disabled={purgeLoading}
                    className="rounded-md bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-500 disabled:opacity-50"
                  >
                    {purgeLoading ? "Purging Message..." : "Purge Hidden Message"}
                  </motion.button>
                  {purgeFile && (
                    <motion.button
                      whileHover={{ y: -1, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={resetPurge}
                      disabled={purgeLoading}
                      className="rounded-md border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    >
                      Clear Image
                    </motion.button>
                  )}
                </div>

                {/* Direct Single Error Alert */}
                {purgeError && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium">{purgeError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPurgeError(null)}
                      className="rounded p-1 text-rose-400/70 hover:bg-white/10 hover:text-white transition"
                      aria-label="Dismiss"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {(status || (error && !extractError && !purgeError)) && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-sm backdrop-blur-lg">
            {status ? <p className="text-slate-300">{status}</p> : null}
            {error && !extractError && !purgeError ? <p className="mt-1 text-rose-400">{error}</p> : null}
          </div>
        )}
      </div>
    </main>
  );
}
