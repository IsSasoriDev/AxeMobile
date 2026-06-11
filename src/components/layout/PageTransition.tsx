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
        transform: transitionStage === "enter" ? "translateY(0) scale(1)" : "translateY(8px) scale(0.992)",
        filter: transitionStage === "enter" ? "blur(0px)" : "blur(2px)",
        transition: "opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1), transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), filter 0.28s ease",
        willChange: "opacity, transform",
      }}
      key={displayLocation.pathname}
    >
      {children}
    </div>
  );
};
