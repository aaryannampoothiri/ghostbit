type CapacityMeterProps = {
  capacityBits: number;
  usedBits: number;
};

export function CapacityMeter({ capacityBits, usedBits }: CapacityMeterProps) {
  const safeCapacity = Math.max(capacityBits, 1);
  const percentage = Math.min(100, Math.max(0, (usedBits / safeCapacity) * 100));
  const remainingBits = Math.max(0, capacityBits - usedBits);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">Capacity Meter</span>
        <span className="font-medium text-emerald-300">{percentage.toFixed(1)}% used</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900/80">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
        <p>Total: {capacityBits.toLocaleString()} bits</p>
        <p>Used: {usedBits.toLocaleString()} bits</p>
        <p>Free: {remainingBits.toLocaleString()} bits</p>
      </div>
    </div>
  );
}
