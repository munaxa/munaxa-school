import { Link } from "wouter";
import { Accessibility, BellRing, Blocks, BookOpenCheck, Bot, Box, Boxes, ChartNoAxesCombined, CircleDot, Component, GitBranch, Globe2, Home, Landmark, LayoutDashboard, LibraryBig, Menu, Moon, Network, Palette, PanelTop, Rows3, School, ShieldCheck, Sun, Table2, TextCursorInput, Type, X } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tokens", label: "Design Tokens", icon: Palette },
  { href: "/colors", label: "Colors", icon: CircleDot },
  { href: "/typography", label: "Typography", icon: Type },
  { href: "/components", label: "Components", icon: Component },
  { href: "/school-components", label: "School Components", icon: School },
  { href: "/patterns", label: "Patterns", icon: Rows3 },
  { href: "/templates", label: "Templates", icon: LayoutDashboard },
  { href: "/examples", label: "Examples", icon: BookOpenCheck },
  { href: "/school-domain", label: "School Domain", icon: Landmark },
  { href: "/enterprise-workspaces", label: "Workspaces", icon: Network },
  { href: "/enterprise-standards", label: "Enterprise Standards", icon: LibraryBig },
  { href: "/product-architecture/permissions", label: "Permissions", icon: ShieldCheck },
  { href: "/product-architecture/workflows", label: "Workflows", icon: GitBranch },
  { href: "/product-architecture/notifications", label: "Notifications", icon: BellRing },
  { href: "/product-architecture/domain-components", label: "Domain Components", icon: Boxes },
  { href: "/product-architecture/ai-rules", label: "AI Rules", icon: Bot },
  { href: "/buttons", label: "Buttons", icon: Blocks },
  { href: "/inputs", label: "Inputs", icon: TextCursorInput },
  { href: "/cards", label: "Cards", icon: PanelTop },
  { href: "/tables", label: "Tables", icon: Table2 },
  { href: "/modals", label: "Modals", icon: Box },
  { href: "/charts", label: "Charts", icon: ChartNoAxesCombined },
  { href: "/accessibility", label: "Accessibility", icon: Accessibility },
  { href: "/rtl", label: "RTL Support", icon: Globe2 },
];

export default function Layout({ children, currentPage }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 w-80 border-e border-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          {/* Logo */}
          <div className="border-b border-sidebar-border px-6 py-6">
            <Link href="/">
              <a className="flex items-center gap-3 font-bold text-xl hover:opacity-80 transition-opacity">
                <img src="/munaxa-logo.svg" alt="" className="h-10 w-7 shrink-0 object-contain" />
                <span>MUNAXA</span>
              </a>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
              <Link key={item.href} href={item.href}>
                <a
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item.href
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <Icon className="me-3 inline size-4" aria-hidden />
                  {item.label}
                </a>
              </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border px-6 py-4">
            <p className="text-xs text-sidebar-foreground/60">
              MUNAXA Design System
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card text-card-foreground px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <h1 className="text-lg font-semibold">Design System</h1>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
