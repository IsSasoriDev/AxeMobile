import { useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<"enter" | "exit">("enter");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (location.pathname !== displayLocation.pathname) {
      setTransitionStage("exit");
    }
  }, [location, displayLocation]);

  useEffect(() => {
    if (transitionStage === "exit") {
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage("enter");
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [transitionStage, location]);

  return (
    <div
      className="w-full h-full"
      style={{
        opacity: transitionStage === "enter" ? 1 : 0,
        transform: transitionStage === "enter" ? "translateY(0) scale(1)" : "translateY(6px) scale(0.995)",
        transition: "opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "opacity, transform",
      }}
      key={displayLocation.pathname}
    >
      {children}
    </div>
  );
};
