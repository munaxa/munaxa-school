import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Blocks,
  Box,
  ChartNoAxesCombined,
  PanelTop,
  Table2,
  TextCursorInput,
} from "lucide-react";

export default function Components() {
  return (
    <Layout currentPage="/components">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Components</h1>
            <p className="text-lg text-foreground/70">
              Interactive UI components built with shadcn/ui and Radix UI. All
              components are accessible, responsive, and follow MUNAXA design
              principles.
            </p>
          </div>
        </section>

        {/* Buttons */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Buttons</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-6 text-foreground">
                  Primary Button
                </h3>
                <div className="space-y-4">
                  <Button>Primary Button</Button>
                  <Button disabled>Disabled</Button>
                  <p className="text-sm text-foreground/60 mt-4">
                    Brand teal #007595 (primary resolves to #007595 on light,
                    #00B8DB on dark) | Radius: 14px
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-6 text-foreground">
                  Secondary Button
                </h3>
                <div className="space-y-4">
                  <Button variant="outline">Secondary Button</Button>
                  <Button variant="outline" disabled>
                    Disabled
                  </Button>
                  <p className="text-sm text-foreground/60 mt-4">
                    Background: White | Border: Gray-200 | Radius: 8px
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-6 text-foreground">
                  Danger Button
                </h3>
                <div className="space-y-4">
                  <Button variant="destructive">Delete</Button>
                  <Button variant="destructive" disabled>
                    Disabled
                  </Button>
                  <p className="text-sm text-foreground/60 mt-4">
                    Background: #EF4444 | Color: White
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-6 text-foreground">
                  Button Sizes
                </h3>
                <div className="space-y-4">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>
            </div>

            <Link href="/buttons">
              <a className="inline-flex items-center gap-2 text-primary font-medium mt-8 hover:gap-3 transition-all">
                View detailed button showcase
                <ArrowRight className="w-4 h-4" />
              </a>
            </Link>
          </div>
        </section>

        {/* Inputs */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Inputs</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-6 text-foreground">
                  Text Input
                </h3>
                <div className="space-y-4">
                  <Input placeholder="Enter text..." />
                  <Input placeholder="Disabled" disabled />
                  <p className="text-sm text-foreground/60 mt-4">
                    Height: 40px | Radius: 8px | Border: Gray-300 | Focus:
                    Primary-600
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-6 text-foreground">
                  Input States
                </h3>
                <div className="space-y-4">
                  <Input placeholder="Default state" />
                  <Input placeholder="Focus state (click here)" />
                  <p className="text-sm text-foreground/60 mt-4">
                    No glow effect. Clean, minimal focus ring.
                  </p>
                </div>
              </div>
            </div>

            <Link href="/inputs">
              <a className="inline-flex items-center gap-2 text-primary font-medium mt-8 hover:gap-3 transition-all">
                View detailed input showcase
                <ArrowRight className="w-4 h-4" />
              </a>
            </Link>
          </div>
        </section>

        {/* Cards */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Cards</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">Card Title</h3>
                <p className="text-foreground/70 mb-4">
                  Cards are the primary container for content. Use them to
                  organize related information.
                </p>
                <p className="text-xs text-foreground/50">
                  Background: White | Border: Gray-200 | Radius: 12px
                </p>
              </Card>

              <Card className="p-6 border-primary/50 bg-accent/50">
                <h3 className="font-semibold text-lg mb-2">Highlighted Card</h3>
                <p className="text-foreground/70 mb-4">
                  Use accent background for highlighted or featured content.
                </p>
                <p className="text-xs text-foreground/50">
                  Background: Primary-50 | Border: Primary-200
                </p>
              </Card>

              <Card className="p-6 border-error/50">
                <h3 className="font-semibold text-lg mb-2">Alert Card</h3>
                <p className="text-foreground/70 mb-4">
                  Use semantic borders for status indication.
                </p>
                <p className="text-xs text-foreground/50">
                  Border: Error-300 | Use for warnings
                </p>
              </Card>
            </div>

            <Link href="/cards">
              <a className="inline-flex items-center gap-2 text-primary font-medium mt-8 hover:gap-3 transition-all">
                View detailed card showcase
                <ArrowRight className="w-4 h-4" />
              </a>
            </Link>
          </div>
        </section>

        {/* Badges & Status */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">
              Badges & Status Indicators
            </h2>

            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-3">
                    Status Badges
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Badge className="bg-success text-white">Success</Badge>
                    <Badge className="bg-warning text-white">Warning</Badge>
                    <Badge className="bg-error text-white">Error</Badge>
                    <Badge className="bg-info text-white">Info</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-3">
                    Status Icons
                  </p>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span className="text-sm">Success</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      <span className="text-sm">Warning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-error" />
                      <span className="text-sm">Error</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="w-5 h-5 text-info" />
                      <span className="text-sm">Info</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Component Grid */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">All Components</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: "Buttons", href: "/buttons", icon: Blocks },
                { name: "Inputs", href: "/inputs", icon: TextCursorInput },
                { name: "Cards", href: "/cards", icon: PanelTop },
                { name: "Tables", href: "/tables", icon: Table2 },
                { name: "Modals", href: "/modals", icon: Box },
                { name: "Charts", href: "/charts", icon: ChartNoAxesCombined },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <a className="block bg-card border border-border rounded-lg p-6 hover:border-primary/50 hover:shadow-lg transition-all">
                      <Icon className="mb-3 size-7 text-primary" aria-hidden />
                      <h3 className="font-semibold text-foreground">
                        {item.name}
                      </h3>
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>
              All components are built with accessibility in mind. Use keyboard
              navigation and screen readers.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
