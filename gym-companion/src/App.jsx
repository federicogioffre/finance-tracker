import React, { useState } from "react";
import "./index.css";
import { useLocalStorage } from "./hooks/useLocalStorage";
import HomeScreen from "./components/HomeScreen";
import GenerateWorkout from "./components/GenerateWorkout";
import QuickWorkout from "./components/QuickWorkout";
import WorkoutScreen from "./components/WorkoutScreen";
import ProgressScreen from "./components/ProgressScreen";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [history, setHistory] = useLocalStorage("gymHistory", []);

  const handleWorkoutGenerated = (workout) => {
    setCurrentWorkout(workout);
  };

  const handleSaveWorkout = (record) => {
    setHistory((prev) => [...prev, record]);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0f0f0f]">
      {screen === "home" && (
        <HomeScreen onNavigate={setScreen} />
      )}
      {screen === "generate" && (
        <GenerateWorkout
          onNavigate={setScreen}
          onWorkoutGenerated={handleWorkoutGenerated}
        />
      )}
      {screen === "quick" && (
        <QuickWorkout
          onNavigate={setScreen}
          onWorkoutGenerated={handleWorkoutGenerated}
        />
      )}
      {screen === "workout" && currentWorkout && (
        <WorkoutScreen
          workout={currentWorkout}
          onNavigate={setScreen}
          onSaveWorkout={handleSaveWorkout}
        />
      )}
      {screen === "progress" && (
        <ProgressScreen history={history} onNavigate={setScreen} />
      )}
    </div>
  );
}
