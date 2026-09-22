import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type BadgeTone = "neutral" | "success" | "warning" | "accent";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("badge", `badge--${tone}`, className)} {...props} />;
}
