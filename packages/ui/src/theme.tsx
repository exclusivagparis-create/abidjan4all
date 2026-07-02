"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "a4a-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Script inline à placer dans <head> : applique data-theme avant l'hydratation
 * pour éviter le flash clair→sombre au chargement.
 */
export function ThemeScript() {
  const code = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // relit l'état posé par ThemeScript
    const current = document.documentElement.dataset.theme;
    if (current === "dark" || current === "light") setThemeState(current);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* stockage indisponible (navigation privée) : le thème reste en mémoire */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé sous <ThemeProvider>");
  return ctx;
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-pill)",
        padding: "7px 14px 7px 12px",
        cursor: "pointer",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink)",
        fontFamily: "inherit",
      }}
    >
      {theme === "light" ? "🌙 Sombre" : "☀️ Clair"}
    </button>
  );
}
