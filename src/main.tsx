import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import App from './App.tsx'
import './index.css'
import { LoadingScreen } from './components/ui/loading-screen'

function Root() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      {!isLoading && <App />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
