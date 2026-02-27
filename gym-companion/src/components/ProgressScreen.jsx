import React, { useState, useMemo } from "react";

// Epley formula: 1RM = weight × (1 + reps/30)
function calculate1RM(weight, reps) {
  if (!weight || weight <= 0) return null;
  const numReps = parseInt(reps);
  if (isNaN(numReps) || numReps <= 0) return null;
  if (numReps === 1) return weight;
  return Math.round(weight * (1 + numReps / 30));
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function ExerciseCard({ name, records }) {
  const best = records.reduce((acc, r) => {
    const rm = calculate1RM(r.weight, r.reps);
    return rm && (!acc || rm > acc) ? rm : acc;
  }, null);

  const lastWeight = records[records.length - 1]?.weight;
  const prevWeight = records[records.length - 2]?.weight;
  const trend =
    lastWeight && prevWeight
      ? lastWeight > prevWeight
        ? "up"
        : lastWeight < prevWeight
        ? "down"
        : "flat"
      : null;

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-base">{name}</h3>
          <p className="text-[#666] text-xs">{records.length} session{records.length !== 1 ? "s" : ""}</p>
        </div>
        {best && (
          <div className="text-right">
            <p className="text-[#888] text-xs">Est. 1RM</p>
            <p className="text-[#E8FF5A] font-bold text-lg">{best} kg</p>
          </div>
        )}
      </div>

      {/* Progress sparkline-style history */}
      <div className="flex flex-col gap-2">
        {records.slice(-5).map((r, i) => {
          const maxWeight = Math.max(...records.map((x) => x.weight || 0));
          const barPct = maxWeight > 0 ? ((r.weight || 0) / maxWeight) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[#555] text-xs w-14 shrink-0">{formatDate(r.date)}</span>
              <div className="flex-1 bg-[#111] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[#E8FF5A]/70 rounded-full"
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className="text-white text-xs font-medium w-16 text-right shrink-0">
                {r.weight ? `${r.weight}kg` : "—"} × {r.reps}
              </span>
            </div>
          );
        })}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-xs font-semibold ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-[#666]"}`}>
            {trend === "up" ? "↑ Progressing" : trend === "down" ? "↓ Regressing" : "→ Maintaining"}
          </span>
          {lastWeight && prevWeight && (
            <span className="text-[#555] text-xs">
              ({trend === "up" ? "+" : ""}{(lastWeight - prevWeight).toFixed(1)} kg)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProgressScreen({ history, onNavigate }) {
  const [filter, setFilter] = useState("all");

  // Build per-exercise history from all saved workouts
  const exerciseMap = useMemo(() => {
    const map = {};
    history.forEach((session) => {
      session.exercises.forEach((ex) => {
        if (!map[ex.name]) map[ex.name] = [];
        map[ex.name].push({
          date: session.date,
          weight: ex.weight,
          reps: ex.reps,
          sets: ex.sets,
          completedSets: ex.completedSets,
        });
      });
    });
    return map;
  }, [history]);

  const allGoals = [...new Set(history.map((h) => h.goal))];

  const filteredSessions =
    filter === "all" ? history : history.filter((h) => h.goal === filter);

  const filteredExerciseNames = new Set(
    filteredSessions.flatMap((s) => s.exercises.map((e) => e.name))
  );

  const visibleExercises = Object.entries(exerciseMap).filter(([name]) =>
    filteredExerciseNames.has(name)
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f] pb-10">
      {/* Header */}
      <div className="px-6 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => onNavigate("home")}
            className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white active:bg-[#252525]"
          >
            ←
          </button>
          <h2 className="text-xl font-bold text-white">My Progress</h2>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 text-center">
            <p className="text-[#E8FF5A] text-2xl font-bold">{history.length}</p>
            <p className="text-[#666] text-xs mt-0.5">Workouts</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 text-center">
            <p className="text-[#E8FF5A] text-2xl font-bold">
              {Object.keys(exerciseMap).length}
            </p>
            <p className="text-[#666] text-xs mt-0.5">Exercises</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 text-center">
            <p className="text-[#E8FF5A] text-2xl font-bold">
              {history.reduce(
                (acc, s) =>
                  acc + s.exercises.reduce((a, e) => a + (e.completedSets || 0), 0),
                0
              )}
            </p>
            <p className="text-[#666] text-xs mt-0.5">Total Sets</p>
          </div>
        </div>

        {/* Filter chips */}
        {allGoals.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setFilter("all")}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === "all"
                  ? "bg-[#E8FF5A] text-black"
                  : "bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]"
              }`}
            >
              All
            </button>
            {allGoals.map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                  filter === g
                    ? "bg-[#E8FF5A] text-black"
                    : "bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🏋️</p>
            <p className="text-white font-semibold mb-1">No workouts yet</p>
            <p className="text-[#666] text-sm">Complete a workout to see your progress here</p>
            <button
              onClick={() => onNavigate("generate")}
              className="mt-6 px-6 py-3 bg-[#E8FF5A] text-black font-bold rounded-xl active:scale-[0.98] transition-transform"
            >
              Start First Workout
            </button>
          </div>
        ) : visibleExercises.length === 0 ? (
          <p className="text-[#666] text-sm text-center py-8">
            No exercises found for this filter.
          </p>
        ) : (
          <>
            <p className="text-[#888] text-xs font-semibold tracking-widest uppercase mb-4">
              Exercise History
            </p>
            {visibleExercises.map(([name, records]) => (
              <ExerciseCard key={name} name={name} records={records} />
            ))}

            {/* Recent sessions */}
            <p className="text-[#888] text-xs font-semibold tracking-widest uppercase mb-4 mt-6">
              Recent Sessions
            </p>
            {filteredSessions
              .slice()
              .reverse()
              .slice(0, 5)
              .map((session) => (
                <div
                  key={session.id}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 mb-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-semibold capitalize text-sm">
                        {session.goal} · {session.duration} min
                      </p>
                      <p className="text-[#666] text-xs capitalize">{session.level}</p>
                    </div>
                    <p className="text-[#555] text-xs">{formatDate(session.date)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {session.exercises.map((ex, i) => (
                      <span
                        key={i}
                        className="text-xs bg-[#111] border border-[#2a2a2a] text-[#888] rounded-lg px-2 py-0.5"
                      >
                        {ex.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
