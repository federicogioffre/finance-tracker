import React from "react";

export default function HomeScreen({ onNavigate }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f] px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <p className="text-[#888] text-sm font-medium tracking-widest uppercase mb-1">
          Welcome back
        </p>
        <h1 className="text-4xl font-bold text-white leading-tight">
          Gym<br />
          <span className="text-[#E8FF5A]">Companion</span>
        </h1>
      </div>

      {/* Main CTA */}
      <div className="flex flex-col gap-4 flex-1">
        <button
          onClick={() => onNavigate("generate")}
          className="relative w-full bg-[#E8FF5A] text-black rounded-2xl p-6 text-left overflow-hidden active:scale-[0.98] transition-transform"
        >
          <div className="relative z-10">
            <span className="text-xs font-semibold tracking-widest uppercase text-black/60 block mb-1">
              Personalized
            </span>
            <span className="text-2xl font-bold block">Generate Workout</span>
            <span className="text-sm text-black/60 mt-1 block">
              Custom plan based on your goal
            </span>
          </div>
          <div className="absolute right-4 bottom-4 text-6xl opacity-10 font-black">
            AI
          </div>
        </button>

        <button
          onClick={() => onNavigate("quick")}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-2xl p-6 text-left active:scale-[0.98] transition-transform"
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-[#888] block mb-1">
            No setup
          </span>
          <span className="text-2xl font-bold block">Quick Workout</span>
          <span className="text-sm text-[#666] mt-1 block">
            Random full-body session
          </span>
        </button>

        <button
          onClick={() => onNavigate("progress")}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-2xl p-6 text-left active:scale-[0.98] transition-transform"
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-[#888] block mb-1">
            Analytics
          </span>
          <span className="text-2xl font-bold block">My Progress</span>
          <span className="text-sm text-[#666] mt-1 block">
            Track gains & estimate 1RM
          </span>
        </button>
      </div>

      {/* Footer */}
      <p className="text-center text-[#333] text-xs mt-8">
        All data stored locally on your device
      </p>
    </div>
  );
}
