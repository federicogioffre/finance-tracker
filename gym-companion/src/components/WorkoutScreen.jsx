import React, { useState, useEffect, useRef } from "react";

function RestTimer({ seconds, onDone }) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef(null);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => r - 1);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [remaining, onDone]);

  const pct = ((seconds - remaining) / seconds) * 100;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-6">
      <div className="bg-[#1a1a1a] rounded-3xl p-8 w-full max-w-xs text-center border border-[#2a2a2a]">
        <p className="text-[#888] text-xs font-semibold tracking-widest uppercase mb-4">
          Rest Time
        </p>
        {/* Circle progress */}
        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#2a2a2a" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#E8FF5A"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">{remaining}</span>
          </div>
        </div>
        <p className="text-[#666] text-sm mb-6">seconds remaining</p>
        <button
          onClick={onDone}
          className="w-full py-3 rounded-xl bg-[#E8FF5A] text-black font-bold active:scale-[0.98] transition-transform"
        >
          Skip Rest
        </button>
      </div>
    </div>
  );
}

export default function WorkoutScreen({ workout, onNavigate, onSaveWorkout }) {
  const [weights, setWeights] = useState(
    () => workout.exercises.map(() => "")
  );
  const [completedSets, setCompletedSets] = useState(
    () => workout.exercises.map((ex) => Array(ex.sets).fill(false))
  );
  const [timer, setTimer] = useState(null); // { seconds, exerciseIndex }
  const [saved, setSaved] = useState(false);

  const handleSetDone = (exIdx, setIdx) => {
    const updated = completedSets.map((sets, i) =>
      i === exIdx ? sets.map((v, j) => (j === setIdx ? !v : v)) : sets
    );
    setCompletedSets(updated);
    // Start rest timer if checking (not unchecking)
    if (!completedSets[exIdx][setIdx]) {
      setTimer({ seconds: workout.exercises[exIdx].rest, exerciseIndex: exIdx });
    }
  };

  const handleTimerDone = () => setTimer(null);

  const handleSave = () => {
    const record = {
      id: Date.now(),
      date: new Date().toISOString(),
      goal: workout.goal,
      duration: workout.duration,
      level: workout.level,
      exercises: workout.exercises.map((ex, i) => ({
        name: ex.name,
        muscle: ex.muscle,
        sets: ex.sets,
        reps: ex.reps,
        weight: parseFloat(weights[i]) || 0,
        completedSets: completedSets[i].filter(Boolean).length,
      })),
    };
    onSaveWorkout(record);
    setSaved(true);
    setTimeout(() => onNavigate("home"), 1200);
  };

  const totalSets = completedSets.flat().length;
  const doneSets = completedSets.flat().filter(Boolean).length;
  const progress = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f] pb-24">
      {/* Header */}
      <div className="px-6 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate("home")}
            className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white active:bg-[#252525]"
          >
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white capitalize">
              {workout.goal} · {workout.duration} min
            </h2>
            <p className="text-[#666] text-xs capitalize">{workout.level}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-[#E8FF5A] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[#666] text-xs mt-1 text-right">
          {doneSets}/{totalSets} sets
        </p>
      </div>

      {/* Exercises */}
      <div className="flex flex-col gap-4 px-6">
        {workout.exercises.map((ex, exIdx) => (
          <div
            key={exIdx}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">{ex.name}</h3>
                <p className="text-[#888] text-xs">{ex.muscle}</p>
              </div>
              <div className="text-right">
                <span className="text-[#E8FF5A] text-sm font-semibold">
                  {ex.sets} × {ex.reps}
                </span>
                <p className="text-[#666] text-xs">{ex.rest}s rest</p>
              </div>
            </div>

            {/* Weight input */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-xl flex items-center px-4 gap-2">
                <input
                  type="number"
                  placeholder="Weight"
                  value={weights[exIdx]}
                  onChange={(e) => {
                    const updated = [...weights];
                    updated[exIdx] = e.target.value;
                    setWeights(updated);
                  }}
                  className="bg-transparent text-white py-3 flex-1 outline-none text-sm w-full"
                  inputMode="decimal"
                />
                <span className="text-[#666] text-sm shrink-0">kg</span>
              </div>
            </div>

            {/* Set checkboxes */}
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: ex.sets }).map((_, setIdx) => (
                <button
                  key={setIdx}
                  onClick={() => handleSetDone(exIdx, setIdx)}
                  className={`flex-1 min-w-[44px] py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.95] border ${
                    completedSets[exIdx][setIdx]
                      ? "bg-[#E8FF5A] text-black border-[#E8FF5A]"
                      : "bg-[#111] text-[#666] border-[#2a2a2a]"
                  }`}
                >
                  {setIdx + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-[#0f0f0f] to-transparent">
        <button
          onClick={handleSave}
          disabled={saved}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] ${
            saved
              ? "bg-green-500 text-white"
              : "bg-[#E8FF5A] text-black"
          }`}
        >
          {saved ? "Saved! ✓" : "Save Workout"}
        </button>
      </div>

      {/* Rest Timer overlay */}
      {timer && (
        <RestTimer seconds={timer.seconds} onDone={handleTimerDone} />
      )}
    </div>
  );
}
