import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

type Tone = "ok" | "err" | "info";
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; tone: Tone; show: boolean }>({ msg: "", tone: "info", show: false });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const toast = useCallback((msg: string, tone: Tone = "info") => {
    clearTimeout(timer.current);
    setT({ msg, tone, show: true });
    timer.current = setTimeout(() => setT((x) => ({ ...x, show: false })), 3200);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div id="toast" className={`${t.show ? "show" : ""} ${t.tone}`} role="status">
        {t.msg}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
