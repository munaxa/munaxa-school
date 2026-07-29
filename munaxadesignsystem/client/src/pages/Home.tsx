import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Accessibility, ArrowRight, Component, Globe2, Palette, Sparkles } from "lucide-react";

export default function Home() {
  const sections = [
    {
      title: "Design Tokens",
      description: "Colors, typography, spacing, and other design primitives",
      href: "/tokens",
      icon: Palette,
    },
    {
      title: "Components",
      description: "Interactive UI components and patterns",
      href: "/components",
      icon: Component,
    },
    {
      title: "Accessibility",
      description: "WCAG AA compliance and keyboard navigation",
      href: "/accessibility",
      icon: Accessibility,
    },
    {
      title: "RTL Support",
      description: "Arabic language and right-to-left layout support",
      href: "/rtl",
      icon: Globe2,
    },
  ];

  return (
    <Layout currentPage="/">
      <div className="min-h-full bg-gradient-to-br from-background via-background to-accent/20">
        {/* Hero Section */}
        <section className="px-6 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <img src="/munaxa-logo.svg" alt="Munaxa" className="mx-auto mb-6 h-28 w-auto object-contain" />
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground mb-6 text-sm font-medium">
              <Sparkles className="size-4" aria-hidden /> MUNAXA Design System
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Run Your School From One Operating System
            </h1>
            
            <p className="text-xl text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed">
              A comprehensive design system for MUNAXA, a unified school operating platform that brings together students, teachers, finance, communication, and more into one seamless experience.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/tokens">
                <Button size="lg" className="gap-2">
                  Explore Design Tokens
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/components">
                <Button size="lg" variant="outline">
                  View Components
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Brand Attributes */}
        <section className="px-6 py-16 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Brand Attributes</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-4 text-primary">Must Feel</h3>
                <ul className="space-y-2 text-foreground/70">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Professional
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Premium
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Trustworthy
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Modern
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Efficient
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Intelligent
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Calm
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-semibold text-lg mb-4 text-error">Never Feel</h3>
                <ul className="space-y-2 text-foreground/70">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-error rounded-full"></span>
                    Playful
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-error rounded-full"></span>
                    Cartoonish
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-error rounded-full"></span>
                    Childish
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-error rounded-full"></span>
                    Academic
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-error rounded-full"></span>
                    Government software
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-error rounded-full"></span>
                    Legacy ERP
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Navigation */}
        <section className="px-6 py-16 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Quick Navigation</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                <Link key={section.href} href={section.href}>
                  <div className="group block bg-card border border-border rounded-lg p-8 hover:border-primary/50 hover:shadow-lg transition-all duration-200 cursor-pointer">
                    <Icon className="mb-4 size-8 text-primary" aria-hidden />
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-foreground/60 mb-4">{section.description}</p>
                    <div className="flex items-center gap-2 text-primary text-sm font-medium">
                      Explore
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Design Principles */}
        <section className="px-6 py-16 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Design Principles</h2>
            
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="text-lg font-semibold mb-2 text-primary">Information First</h3>
                <p className="text-foreground/70">
                  Every screen exists to help administrators make decisions. Content is more important than decoration.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="text-lg font-semibold mb-2 text-primary">Calm Enterprise</h3>
                <p className="text-foreground/70">
                  Use whitespace. Reduce visual noise. Never overload screens.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="text-lg font-semibold mb-2 text-primary">Premium Simplicity</h3>
                <p className="text-foreground/70">
                  Every element must justify its existence. No unnecessary effects.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="text-lg font-semibold mb-2 text-primary">Accessibility First</h3>
                <p className="text-foreground/70">
                  Support WCAG AA, RTL, Arabic, English, keyboard navigation, and screen readers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 border-t border-border bg-card/50">
          <div className="max-w-4xl mx-auto text-center text-foreground/60 text-sm">
            <p>MUNAXA Design System • Built for enterprise school operations</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
