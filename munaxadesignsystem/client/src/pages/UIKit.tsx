import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, GraduationCap, LayoutPanelLeft, MessageSquareText, RefreshCw, TableProperties, TextCursorInput } from "lucide-react";
import { Link } from "wouter";

export default function UIKit() {
  const categories = [
    {
      title: "Form Components",
      description: "Inputs, selects, date pickers, and form controls",
      count: "8 components",
      href: "/uikit/forms",
      icon: TextCursorInput,
      color: "bg-blue-50 border-blue-200",
    },
    {
      title: "Data Display",
      description: "Tables, cards, lists, and data visualization",
      count: "7 components",
      href: "/uikit/data-display",
      icon: TableProperties,
      color: "bg-green-50 border-green-200",
    },
    {
      title: "School-Specific",
      description: "Student cards, attendance, fees, grades",
      count: "8 components",
      href: "/uikit/school-specific",
      icon: GraduationCap,
      color: "bg-purple-50 border-purple-200",
    },
    {
      title: "Navigation & Layout",
      description: "Sidebars, headers, breadcrumbs, navigation",
      count: "6 components",
      href: "/uikit/navigation",
      icon: LayoutPanelLeft,
      color: "bg-orange-50 border-orange-200",
    },
    {
      title: "Feedback & Overlays",
      description: "Modals, drawers, toasts, alerts",
      count: "6 components",
      href: "/uikit/feedback",
      icon: MessageSquareText,
      color: "bg-pink-50 border-pink-200",
    },
    {
      title: "States & Loading",
      description: "Empty states, loading, errors, skeletons",
      count: "5 components",
      href: "/uikit/states",
      icon: RefreshCw,
      color: "bg-yellow-50 border-yellow-200",
    },
  ];

  return (
    <Layout currentPage="/uikit">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">MUNAXA UI Kit</h1>
            <p className="text-lg text-foreground/70 max-w-2xl">
              A comprehensive collection of 40+ production-ready components designed specifically for school management systems. Each component is fully accessible, responsive, and follows MUNAXA design principles.
            </p>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="px-6 py-12 border-b border-border bg-card/50">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-primary mb-2">40+</div>
                <p className="text-foreground/70 text-sm">Production Components</p>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-primary mb-2">6</div>
                <p className="text-foreground/70 text-sm">Component Categories</p>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-primary mb-2">100%</div>
                <p className="text-foreground/70 text-sm">Accessible (WCAG AA)</p>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-3xl font-bold text-primary mb-2">∞</div>
                <p className="text-foreground/70 text-sm">Customizable</p>
              </Card>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="px-6 py-12">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12">Component Categories</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                <Link key={category.href} href={category.href}>
                  <Card className={`p-8 hover:shadow-lg transition-all duration-200 cursor-pointer border-2 ${category.color}`}>
                    <Icon className="mb-4 size-8 text-primary" aria-hidden />
                    <h3 className="text-xl font-bold mb-2 text-foreground">{category.title}</h3>
                    <p className="text-foreground/70 text-sm mb-4">{category.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">{category.count}</span>
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </div>
                  </Card>
                </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="px-6 py-12 border-t border-border bg-card/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12">Why Use MUNAXA UI Kit?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary"><Check className="size-5" aria-hidden />School-Focused</h3>
                <p className="text-foreground/70">
                  Components designed specifically for school management workflows including attendance, fees, grades, and student management.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary"><Check className="size-5" aria-hidden />Accessible</h3>
                <p className="text-foreground/70">
                  WCAG AA compliant with keyboard navigation, screen reader support, and proper ARIA labels on all components.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary"><Check className="size-5" aria-hidden />Responsive</h3>
                <p className="text-foreground/70">
                  Mobile-first design that works seamlessly on phones, tablets, and desktops. All components are fully responsive.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary"><Check className="size-5" aria-hidden />Customizable</h3>
                <p className="text-foreground/70">
                  Built with Tailwind CSS and shadcn/ui. Easily customize colors, sizes, and behavior to match your needs.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary"><Check className="size-5" aria-hidden />Production-Ready</h3>
                <p className="text-foreground/70">
                  Every component is tested, documented, and ready for production use. No placeholder components here.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary"><Check className="size-5" aria-hidden />RTL Support</h3>
                <p className="text-foreground/70">
                  Full support for right-to-left languages like Arabic. All components automatically mirror for RTL layouts.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="px-6 py-12 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">Getting Started</h2>
            
            <div className="space-y-6">
              <Card className="p-6 border-l-4 border-l-primary">
                <h3 className="font-bold text-lg mb-2">1. Browse Components</h3>
                <p className="text-foreground/70">
                  Start by exploring the component categories above. Each category contains multiple components with interactive examples.
                </p>
              </Card>

              <Card className="p-6 border-l-4 border-l-primary">
                <h3 className="font-bold text-lg mb-2">2. View Examples</h3>
                <p className="text-foreground/70">
                  Each component page shows multiple variations, states, and use cases. See how components behave in different scenarios.
                </p>
              </Card>

              <Card className="p-6 border-l-4 border-l-primary">
                <h3 className="font-bold text-lg mb-2">3. Copy & Customize</h3>
                <p className="text-foreground/70">
                  Use the components in your own projects. Customize colors, sizes, and behavior using Tailwind CSS utilities.
                </p>
              </Card>

              <Card className="p-6 border-l-4 border-l-primary">
                <h3 className="font-bold text-lg mb-2">4. Refer to Design Tokens</h3>
                <p className="text-foreground/70">
                  All components use MUNAXA design tokens. Check the Design Tokens page for the complete color palette and typography system.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>MUNAXA UI Kit • 40+ Components • 6 Categories • 100% Accessible</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
