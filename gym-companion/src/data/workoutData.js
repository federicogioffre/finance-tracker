// Exercise database organized by muscle group and level
export const exerciseDatabase = {
  strength: {
    beginner: [
      { name: "Barbell Squat", muscle: "Legs", sets: 4, reps: "5", rest: 180 },
      { name: "Bench Press", muscle: "Chest", sets: 4, reps: "5", rest: 180 },
      { name: "Deadlift", muscle: "Back", sets: 3, reps: "5", rest: 240 },
      { name: "Overhead Press", muscle: "Shoulders", sets: 3, reps: "5", rest: 180 },
      { name: "Barbell Row", muscle: "Back", sets: 4, reps: "5", rest: 180 },
      { name: "Romanian Deadlift", muscle: "Legs", sets: 3, reps: "6", rest: 180 },
    ],
    intermediate: [
      { name: "Low Bar Squat", muscle: "Legs", sets: 5, reps: "5", rest: 210 },
      { name: "Incline Bench Press", muscle: "Chest", sets: 4, reps: "5", rest: 180 },
      { name: "Sumo Deadlift", muscle: "Back", sets: 4, reps: "3", rest: 240 },
      { name: "Push Press", muscle: "Shoulders", sets: 4, reps: "5", rest: 180 },
      { name: "Pendlay Row", muscle: "Back", sets: 5, reps: "5", rest: 180 },
      { name: "Front Squat", muscle: "Legs", sets: 4, reps: "4", rest: 210 },
    ],
    advanced: [
      { name: "Competition Squat", muscle: "Legs", sets: 6, reps: "3", rest: 300 },
      { name: "Close Grip Bench", muscle: "Chest", sets: 5, reps: "3", rest: 240 },
      { name: "Deficit Deadlift", muscle: "Back", sets: 5, reps: "3", rest: 300 },
      { name: "Strict Press", muscle: "Shoulders", sets: 5, reps: "3", rest: 240 },
      { name: "Weighted Pull-Up", muscle: "Back", sets: 5, reps: "4", rest: 210 },
      { name: "Pause Squat", muscle: "Legs", sets: 4, reps: "4", rest: 240 },
    ],
  },
  hypertrophy: {
    beginner: [
      { name: "Dumbbell Chest Press", muscle: "Chest", sets: 3, reps: "10-12", rest: 90 },
      { name: "Lat Pulldown", muscle: "Back", sets: 3, reps: "10-12", rest: 90 },
      { name: "Leg Press", muscle: "Legs", sets: 3, reps: "12-15", rest: 90 },
      { name: "Dumbbell Curl", muscle: "Biceps", sets: 3, reps: "12-15", rest: 60 },
      { name: "Tricep Pushdown", muscle: "Triceps", sets: 3, reps: "12-15", rest: 60 },
      { name: "Lateral Raise", muscle: "Shoulders", sets: 3, reps: "15", rest: 60 },
    ],
    intermediate: [
      { name: "Barbell Bench Press", muscle: "Chest", sets: 4, reps: "8-10", rest: 90 },
      { name: "Cable Row", muscle: "Back", sets: 4, reps: "10-12", rest: 90 },
      { name: "Hack Squat", muscle: "Legs", sets: 4, reps: "10-12", rest: 90 },
      { name: "Preacher Curl", muscle: "Biceps", sets: 3, reps: "10-12", rest: 60 },
      { name: "Skull Crusher", muscle: "Triceps", sets: 3, reps: "10-12", rest: 60 },
      { name: "Arnold Press", muscle: "Shoulders", sets: 4, reps: "10-12", rest: 75 },
    ],
    advanced: [
      { name: "Weighted Dips", muscle: "Chest", sets: 4, reps: "8-10", rest: 90 },
      { name: "T-Bar Row", muscle: "Back", sets: 5, reps: "8-10", rest: 90 },
      { name: "Bulgarian Split Squat", muscle: "Legs", sets: 4, reps: "10", rest: 90 },
      { name: "Incline Dumbbell Curl", muscle: "Biceps", sets: 4, reps: "10-12", rest: 60 },
      { name: "Close-Grip Bench", muscle: "Triceps", sets: 4, reps: "8-10", rest: 75 },
      { name: "Cable Lateral Raise", muscle: "Shoulders", sets: 4, reps: "15", rest: 60 },
    ],
  },
  "fat loss": {
    beginner: [
      { name: "Goblet Squat", muscle: "Legs", sets: 3, reps: "15", rest: 45 },
      { name: "Push-Up", muscle: "Chest", sets: 3, reps: "12-15", rest: 45 },
      { name: "Dumbbell Row", muscle: "Back", sets: 3, reps: "15", rest: 45 },
      { name: "Lunge", muscle: "Legs", sets: 3, reps: "12 each", rest: 45 },
      { name: "Shoulder Press", muscle: "Shoulders", sets: 3, reps: "12", rest: 45 },
      { name: "Plank", muscle: "Core", sets: 3, reps: "30s", rest: 30 },
    ],
    intermediate: [
      { name: "Kettlebell Swing", muscle: "Full Body", sets: 4, reps: "15", rest: 60 },
      { name: "Box Jump", muscle: "Legs", sets: 3, reps: "10", rest: 60 },
      { name: "Medicine Ball Slam", muscle: "Full Body", sets: 3, reps: "12", rest: 45 },
      { name: "Burpee", muscle: "Full Body", sets: 3, reps: "10", rest: 60 },
      { name: "Jump Lunge", muscle: "Legs", sets: 3, reps: "10 each", rest: 60 },
      { name: "Mountain Climber", muscle: "Core", sets: 3, reps: "20", rest: 45 },
    ],
    advanced: [
      { name: "Barbell Complex", muscle: "Full Body", sets: 5, reps: "6", rest: 90 },
      { name: "Thruster", muscle: "Full Body", sets: 4, reps: "10", rest: 60 },
      { name: "Weighted Burpee", muscle: "Full Body", sets: 4, reps: "8", rest: 75 },
      { name: "Single-Leg Deadlift", muscle: "Legs", sets: 4, reps: "10 each", rest: 60 },
      { name: "Tuck Jump", muscle: "Legs", sets: 4, reps: "12", rest: 60 },
      { name: "Ab Wheel Rollout", muscle: "Core", sets: 4, reps: "10", rest: 45 },
    ],
  },
};

export function generateWorkout({ goal, duration, level }) {
  const pool = exerciseDatabase[goal]?.[level] ?? [];
  const count = duration === "30" ? 4 : duration === "45" ? 5 : 6;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
