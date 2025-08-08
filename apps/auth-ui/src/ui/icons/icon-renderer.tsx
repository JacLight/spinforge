import React from 'react';
import { 
  LucideIcon,
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  X,
  LogIn,
  LogOut,
  Key,
  Shield,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  RefreshCw,
} from 'lucide-react';

// Map of available icons
const iconMap: Record<string, LucideIcon> = {
  user: User,
  lock: Lock,
  mail: Mail,
  eye: Eye,
  eyeOff: EyeOff,
  alertCircle: AlertCircle,
  check: Check,
  x: X,
  logIn: LogIn,
  logOut: LogOut,
  key: Key,
  shield: Shield,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  home: Home,
  settings: Settings,
  refreshCw: RefreshCw,
};

interface IconRendererProps {
  icon: string;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

export const IconRenderer: React.FC<IconRendererProps> = ({
  icon,
  size = 24,
  color = 'currentColor',
  className = '',
  strokeWidth = 2,
}) => {
  const IconComponent = iconMap[icon];

  if (!IconComponent) {
    console.warn(`Icon "${icon}" not found in icon map`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      strokeWidth={strokeWidth}
    />
  );
};

// Export individual icons for direct use
export { 
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  X,
  LogIn,
  LogOut,
  Key,
  Shield,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  RefreshCw,
};