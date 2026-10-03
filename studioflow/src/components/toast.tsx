"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { CheckCircle, X } from "@phosphor-icons/react/dist/ssr";
const Context = createContext<{ toast: (message: string) => void }>({
  toast: () => {},
});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const toast = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 4500);
  }, []);
  return (
    <Context.Provider value={{ toast }}>
      {children}
      {message && (
        <div role="status" className="toast">
          <CheckCircle size={20} weight="fill" />
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useToast = () => useContext(Context);
