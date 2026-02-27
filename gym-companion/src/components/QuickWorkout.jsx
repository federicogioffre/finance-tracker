import React from "react";
import { generateWorkout } from "../data/workoutData";

const QUICK_PRESETS = [
  { goal: "hypertrophy", duration: "30", level: "intermediate", label: "Upper Body Pump", desc: "Chest, back & arms" },
  { goal: "strength", duration: "45", level: "intermediate", label: "Power Session", desc: "Compound movements" },
  { goal: "fat loss", duration: "30", level: "intermediate", label: "Cardio Burn", desc: "High intensity circuit" },
  { goal: "hypertrophy", duration: "45", level: "beginner", label: "Full Body", desc: "Beginner friendly" },
];

export default function QuickWorkout({ onNavigate, onWorkoutGenerated }) {
  const handlePreset = (preset) => {
    const exercises = generateWorkout(preset);
    onWorkoutGenerated({ exercises, ...preset });
    onNavigate("workout");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f] px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate("home")}
          className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white active:bg-[#252525]"
        >
          ←
        </button>
        <h2 className="text-xl font-bold text-white">Quick Workout</h2>
      </div>

      <p className="text-[#888] text-sm mb-6">Choose a preset to start immediately</p>

      <div className="flex flex-col gap-3">
        {QUICK_PRESETS.map((preset, i) => (
          <button
            key={i}
            onClick={() => handlePreset(preset)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 text-left active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-bold text-base">{preset.label}</p>
                <p className="text-[#666] text-xs mt-0.5">{preset.desc}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="text-[#E8FF5A] text-xs font-semibold block capitalize">
                  {preset.goal}
                </span>
                <span className="text-[#666] text-xs">{preset.duration} min</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
