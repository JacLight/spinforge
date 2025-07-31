import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  Upload,
  BarChart3,
  Settings,
  Rocket,
  Menu,
  X,
  Home,
  Monitor,
  ChevronRight,
  Layers,
  Shield,
  Activity,
  Archive,
  Users,
  UserCog,
  HardDrive,
} from "lucide-react";
import { classNames } from "@/utils/helpers";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  {
    path: "/admin",
    icon: Shield,
    label: "Admin Console",
    color: "from-red-500 to-red-600",
  },
  {
    path: "/welcome",
    icon: Home,
    label: "Overview",
    color: "from-blue-500 to-blue-600",
  },
  {
    path: "/applications",
    icon: Package,
    label: "Applications",
    color: "from-green-500 to-green-600",
  },
  {
    path: "/active-spinlets",
    icon: Activity,
    label: "Active Spinlets",
    color: "from-cyan-500 to-cyan-600",
  },
  {
    path: "/deploy",
    icon: Upload,
    label: "Deploy",
    color: "from-orange-500 to-orange-600",
  },
  {
    path: "/deployments",
    icon: Archive,
    label: "Deployments",
    color: "from-yellow-500 to-yellow-600",
  },
  {
    path: "/hosting",
    icon: HardDrive,
    label: "Hosting Management",
    color: "from-violet-500 to-violet-600",
  },
  {
    path: "/customers",
    icon: Users,
    label: "Customers",
    color: "from-teal-500 to-teal-600",
  },
  {
    path: "/admin-users",
    icon: UserCog,
    label: "Admin Users",
    color: "from-rose-500 to-rose-600",
  },
  {
    path: "/analytics",
    icon: BarChart3,
    label: "Analytics",
    color: "from-pink-500 to-pink-600",
  },
  {
    path: "/modern-dashboard",
    icon: Monitor,
    label: "Dashboard",
    color: "from-purple-500 to-purple-600",
  },
  {
    path: "/metrics",
    icon: Layers,
    label: "System Metrics",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    path: "/settings",
    icon: Settings,
    label: "Settings",
    color: "from-gray-500 to-gray-600",
  },
];

export default function ModernLayout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={classNames(
          "fixed left-0 top-0 z-40 h-screen w-72 bg-white shadow-xl",
          "lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                SpinForge
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={classNames(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <div
                    className={classNames(
                      "mr-3 p-2 rounded-lg",
                      isActive
                        ? "bg-white/20"
                        : `bg-gradient-to-r ${item.color} text-white opacity-80 group-hover:opacity-100`
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 opacity-60" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4">
            <a
              href="/control-center"
              className="flex items-center justify-center rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl"
            >
              <Monitor className="mr-2 h-4 w-4" />
              Control Center
            </a>
          </div>
        </div>
      </motion.aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-white p-2 shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <main
        className={classNames(
          "transition-all duration-300 pt-16 lg:pt-0",
          sidebarOpen ? "lg:ml-72" : "lg:ml-0"
        )}
      >
        <div className="min-h-screen p-6">{children}</div>
      </main>

      {/* Toggle sidebar button for desktop */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={classNames(
          "fixed top-4 z-30 hidden rounded-lg bg-white p-2 shadow-lg transition-all lg:block",
          sidebarOpen ? "left-[18.5rem]" : "left-4"
        )}
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>
    </div>
  );
}
