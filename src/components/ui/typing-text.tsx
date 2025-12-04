import { useState, useEffect } from "react";

interface TypingTextProps {
  texts?: string[];
  text?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  onComplete?: () => void;
  loop?: boolean;
  className?: string;
}

export function TypingText({ 
  texts, 
  text,
  typingSpeed = 100, 
  deletingSpeed = 50, 
  pauseDuration = 2000,
  onComplete,
  loop = true,
  className = ""
}: TypingTextProps) {
  // Use single text or texts array
  const allTexts = texts || (text ? [text] : []);
  
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isComplete || allTexts.length === 0) return;
    
    const fullText = allTexts[currentTextIndex];
    if (!fullText) return;
    
    const timeout = setTimeout(() => {
      if (isDeleting) {
        setCurrentText(prev => prev.slice(0, -1));
        
        if (currentText.length === 0) {
          if (loop) {
            setIsDeleting(false);
            setCurrentTextIndex(prev => (prev + 1) % allTexts.length);
          } else {
            // Single text mode - complete when deleted
            setIsComplete(true);
            onComplete?.();
          }
        }
      } else {
        setCurrentText(prev => fullText.slice(0, prev.length + 1));
        
        if (currentText === fullText) {
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentTextIndex, allTexts, typingSpeed, deletingSpeed, pauseDuration, onComplete, loop, isComplete]);

  // Cursor blinking effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <span className={className}>
      {currentText}
      <span className={`inline-block ml-0.5 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}>
        |
      </span>
    </span>
  );
}