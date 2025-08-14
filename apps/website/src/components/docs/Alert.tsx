import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, XCircle, AlertTriangle } from "lucide-react";

interface AlertProps {
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const alertStyles = {
  info: {
    container: "bg-blue-50 border-blue-200",
    icon: Info,
    iconColor: "text-blue-600",
    title: "text-blue-900",
    content: "text-blue-800",
  },
  success: {
    container: "bg-green-50 border-green-200",
    icon: CheckCircle,
    iconColor: "text-green-600",
    title: "text-green-900",
    content: "text-green-800",
  },
  warning: {
    container: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    title: "text-amber-900",
    content: "text-amber-800",
  },
  error: {
    container: "bg-red-50 border-red-200",
    icon: XCircle,
    iconColor: "text-red-600",
    title: "text-red-900",
    content: "text-red-800",
  },
};

export function Alert({ type = "info", title, children, className }: AlertProps) {
  const styles = alertStyles[type];
  const Icon = styles.icon;

  return (
    <div className={cn(
      "rounded-lg border p-4 flex gap-3",
      styles.container,
      className
    )}>
      <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", styles.iconColor)} />
      <div className="flex-1">
        {title && (
          <h4 className={cn("font-semibold mb-1", styles.title)}>{title}</h4>
        )}
        <div className={cn("text-sm", styles.content)}>{children}</div>
      </div>
    </div>
  );
}