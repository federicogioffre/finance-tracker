import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders home screen with main buttons', () => {
  render(<App />);
  expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  expect(screen.getByText(/Companion/i)).toBeInTheDocument();
  expect(screen.getByText(/Generate Workout/i)).toBeInTheDocument();
  expect(screen.getByText(/Quick Workout/i)).toBeInTheDocument();
  expect(screen.getByText(/My Progress/i)).toBeInTheDocument();
});

test('navigates to Generate Workout screen', () => {
  render(<App />);
  fireEvent.click(screen.getByText(/Generate Workout/i));
  expect(screen.getByText(/Goal/i)).toBeInTheDocument();
  expect(screen.getByText(/Duration/i)).toBeInTheDocument();
  expect(screen.getByText(/Level/i)).toBeInTheDocument();
});

test('navigates to Progress screen and shows empty state', () => {
  render(<App />);
  fireEvent.click(screen.getByText(/My Progress/i));
  expect(screen.getByText(/My Progress/i)).toBeInTheDocument();
  expect(screen.getByText(/No workouts yet/i)).toBeInTheDocument();
});
