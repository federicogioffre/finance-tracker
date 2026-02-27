import React, { useState } from "react";
import { generateWorkout } from "../data/workoutData";

const GOALS = [
  { id: "strength", label: "Strength", icon: "⚡", desc: "Low reps, heavy weight" },
  { id: "hypertrophy", label: "Hypertrophy", icon: "💪", desc: "Muscle building" },
  { id: "fat loss", label: "Fat Loss", icon: "🔥", desc: "High intensity" },
];

const DURATIONS = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

const LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export default function GenerateWorkout({ onNavigate, onWorkoutGenerated }) {
  const [goal, setGoal] = useState("hypertrophy");
  const [duration, setDuration] = useState("45");
  const [level, setLevel] = useState("intermediate");

  const handleGenerate = () => {
    const exercises = generateWorkout({ goal, duration, level });
    onWorkoutGenerated({ exercises, goal, duration, level });
    onNavigate("workout");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f] px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate("home")}
          className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white active:bg-[#252525]"
        >
          ←
        </button>
        <h2 className="text-xl font-bold text-white">Generate Workout</h2>
      </div>

      <div className="flex flex-col gap-8">
        {/* Goal */}
        <section>
          <label className="text-xs font-semibold tracking-widest uppercase text-[#888] block mb-3">
            Goal
          </label>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all active:scale-[0.99] ${
                  goal === g.id
                    ? "border-[#E8FF5A] bg-[#E8FF5A]/10"
                    : "border-[#2a2a2a] bg-[#1a1a1a]"
                }`}
              >
                <span className="text-2xl">{g.icon}</span>
                <div>
                  <span
                    className={`font-semibold block ${goal === g.id ? "text-[#E8FF5A]" : "text-white"}`}
                  >
                    {g.label}
                  </span>
                  <span className="text-xs text-[#666]">{g.desc}</span>
                </div>
                {goal === g.id && (
                  <span className="ml-auto text-[#E8FF5A]">✓</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Duration */}
        <section>
          <label className="text-xs font-semibold tracking-widest uppercase text-[#888] block mb-3">
            Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] ${
                  duration === d.value
                    ? "bg-[#E8FF5A] text-black"
                    : "bg-[#1a1a1a] text-white border border-[#2a2a2a]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* Level */}
        <section>
          <label className="text-xs font-semibold tracking-widest uppercase text-[#888] block mb-3">
            Level
          </label>
          <div className="flex flex-col gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`py-3 px-4 rounded-xl font-semibold text-sm text-left transition-all active:scale-[0.99] border ${
                  level === l.id
                    ? "border-[#E8FF5A] bg-[#E8FF5A]/10 text-[#E8FF5A]"
                    : "border-[#2a2a2a] bg-[#1a1a1a] text-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  {l.label}
                  {level === l.id && <span className="text-[#E8FF5A]">✓</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Generate Button */}
      <div className="mt-auto pt-8">
        <button
          onClick={handleGenerate}
          className="w-full bg-[#E8FF5A] text-black font-bold py-4 rounded-2xl text-lg active:scale-[0.98] transition-transform"
        >
          Generate Workout →
        </button>
      </div>
    </div>
  );
}
