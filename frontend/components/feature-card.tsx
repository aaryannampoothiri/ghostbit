"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  description: string;
  visual: ReactNode;
};

export function FeatureCard({ title, description, visual }: FeatureCardProps) {
  return (
    <motion.article
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 240, damping: 18 }}
      className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg"
    >
      <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/80 p-4 text-emerald-300 shadow-lg shadow-emerald-500/10 transition-colors duration-300 group-hover:border-emerald-400/40">
        {visual}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-slate-100">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-300">{description}</p>
    </motion.article>
  );
}
