import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, History, AlertCircle, BarChart3, Settings, LogOut } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyze", label: "Analyze", icon: Upload },
  { href: "/decisions", label: "Decisions", icon: History },
  { href: "/review", label: "Review Queue", icon: AlertCircle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("wcp_user") || "null");
  } catch {
    return null;
  }
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    localStorage.removeItem("wcp_token");
    localStorage.removeItem("wcp_user");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <nav className="w-60 bg-card border-r px-4 py-6 flex flex-col">
        <div className="px-2 mb-6">
          <h1 className="text-lg font-bold">WCP Agent</h1>
          <p className="text-xs text-muted-foreground">v3.0</p>
        </div>
        <div className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-auto">
          <Separator className="mb-4" />
          {user && (
            <div className="px-2 space-y-2">
              <p className="text-xs font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </div>
          )}
        </div>
      </nav>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
