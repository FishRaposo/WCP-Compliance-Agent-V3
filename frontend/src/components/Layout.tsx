import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/decisions", label: "Decisions" },
  { href: "/review", label: "Review Queue" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
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
    <div className="flex min-h-screen bg-gray-50">
      <nav className="w-56 bg-white border-r border-gray-200 px-4 py-6 flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
          WCP Compliance
        </p>
        {navItems.map(({ href, label }) => (
          <Link
            key={href}
            to={href}
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              pathname === href
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </Link>
        ))}

        <div className="mt-auto pt-6 border-t border-gray-100">
          {user && (
            <div className="px-2">
              <p className="text-xs font-medium text-gray-700">{user.email}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
              <button
                onClick={handleLogout}
                className="mt-2 text-xs text-red-600 hover:text-red-700"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
