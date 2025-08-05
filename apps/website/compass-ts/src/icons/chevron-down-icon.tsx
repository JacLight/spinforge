/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import clsx from "clsx";
import type React from "react";

export function ChevronDownIcon({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 8 4"
      fill="none"
      className={clsx(className, "h-1 shrink-0")}
      {...props}
    >
      <path
        fill="none"
        d="M1 0.5L4 3.5L7 0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
