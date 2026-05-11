import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installLogger } from './lib/logger'

installLogger();

createRoot(document.getElementById("root")!).render(<App />);
