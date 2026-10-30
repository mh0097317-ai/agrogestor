"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { CheckCircle, X } from "@phosphor-icons/react/dist/ssr";
/** One follow-up the person can take on the notice, such as undoing it. */
export interface ToastAction {
  label: string;
  run: () => void;
}
const Context = createContext<{
  toast: (message: string, action?: ToastAction) => void;
}>({
  toast: () => {},
});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{
    message: string;
    action?: ToastAction;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
  }, []);
  const toast = useCallback((message: string, action?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice({ message, action });
    // A notice with an action stays longer so there is time to use it.
    timer.current = setTimeout(() => setNotice(null), action ? 8000 : 4500);
  }, []);
  return (
    <Context.Provider value={{ toast }}>
      {children}
      {notice && (
        <div role="status" className="toast">
          <CheckCircle size={20} weight="fill" />
          <span>{notice.message}</span>
          {notice.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                close();
                notice.action?.run();
              }}
            >
              {notice.action.label}
            </button>
          )}
          <button type="button" onClick={close} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useToast = () => useContext(Context);
