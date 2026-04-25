import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/decisions", label: "Decisions" },
  { href: "/review", label: "Review Queue" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
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
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
