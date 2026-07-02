import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Carte de base : surface + filet + ombre douce (cf. Design System.dc.html). */
export function Card({ children, style, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
