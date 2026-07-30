import { createContext, useContext, useState } from "react";

type TourContextValue = {
  isTourOpen: boolean;
  startTour: () => void;
  stopTour: () => void;
};

const TOUR_CONTEXT = createContext<TourContextValue | null>(null);

export const useTour = () => {
  const context = useContext(TOUR_CONTEXT);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
};

export default function TourProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [isTourOpen, setIsTourOpen] = useState(false);

  return (
    <TOUR_CONTEXT.Provider
      value={{
        isTourOpen,
        startTour: () => setIsTourOpen(true),
        stopTour: () => setIsTourOpen(false),
      }}
    >
      {children}
    </TOUR_CONTEXT.Provider>
  );
}
