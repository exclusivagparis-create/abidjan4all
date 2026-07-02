import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "accent";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--brand-fill)",
    color: "var(--brand-on)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "var(--surface-2)",
    color: "var(--ink)",
    border: "1px solid var(--line)",
  },
  accent: {
    background: "var(--accent)",
    color: "#fff",
    border: "1px solid transparent",
  },
};

/** Bouton pill du design system (cf. Design System.dc.html §Composants). */
export function Button({ variant = "primary", children, style, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "11px 18px",
        borderRadius: "var(--radius-pill)",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
