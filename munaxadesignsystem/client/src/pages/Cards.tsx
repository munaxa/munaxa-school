import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, DollarSign, Calendar } from "lucide-react";

export default function Cards() {
  return (
    <Layout currentPage="/cards">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Cards</h1>
            <p className="text-lg text-foreground/70">
              Cards are flexible containers for grouping related content. They provide structure and visual hierarchy.
            </p>
          </div>
        </section>

        {/* Basic Cards */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Basic Cards</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">Simple Card</h3>
                <p className="text-foreground/70 text-sm">
                  A basic card with title and description. Use for simple content grouping.
                </p>
              </Card>

              <Card className="p-6 border-primary/50 bg-accent/50">
                <h3 className="font-semibold text-lg mb-2">Highlighted Card</h3>
                <p className="text-foreground/70 text-sm">
                  Use accent background for featured or important content.
                </p>
              </Card>

              <Card className="p-6 border-error/50">
                <h3 className="font-semibold text-lg mb-2">Alert Card</h3>
                <p className="text-foreground/70 text-sm">
                  Use semantic borders for status indication or warnings.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">KPI Cards</h2>
            <p className="text-foreground/70 mb-6">
              Cards designed for displaying key performance indicators with metrics and trends.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-foreground/60 text-sm font-medium">Attendance Today</p>
                    <p className="text-3xl font-bold mt-2">94.6%</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-success text-sm font-medium">+3.2% from yesterday</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-foreground/60 text-sm font-medium">Total Students</p>
                    <p className="text-3xl font-bold mt-2">2,847</p>
                  </div>
                  <div className="p-2 bg-info/10 rounded-lg">
                    <Users className="w-5 h-5 text-info" />
                  </div>
                </div>
                <p className="text-info text-sm font-medium">+124 this semester</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-foreground/60 text-sm font-medium">Revenue</p>
                    <p className="text-3xl font-bold mt-2">$45.2K</p>
                  </div>
                  <div className="p-2 bg-success/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-success" />
                  </div>
                </div>
                <p className="text-success text-sm font-medium">+12.5% vs last month</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-foreground/60 text-sm font-medium">Events</p>
                    <p className="text-3xl font-bold mt-2">12</p>
                  </div>
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-warning" />
                  </div>
                </div>
                <p className="text-warning text-sm font-medium">3 upcoming this week</p>
              </Card>
            </div>
          </div>
        </section>

        {/* Content Cards */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Content Cards</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 flex flex-col">
                <div className="mb-4">
                  <div className="w-full h-40 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg mb-4"></div>
                  <h3 className="font-semibold text-lg mb-2">Card with Image</h3>
                  <p className="text-foreground/70 text-sm mb-4">
                    Cards can contain images, text, and interactive elements. Use them to organize related content.
                  </p>
                </div>
                <Button className="mt-auto">Learn More</Button>
              </Card>

              <Card className="p-6 flex flex-col">
                <h3 className="font-semibold text-lg mb-2">Interactive Card</h3>
                <p className="text-foreground/70 text-sm mb-4">
                  Cards can be interactive with buttons, links, and other controls.
                </p>
                <div className="flex gap-2 mt-auto">
                  <Button size="sm">Action</Button>
                  <Button size="sm" variant="outline">Cancel</Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Card Layouts */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Card Layouts</h2>
            
            <div className="space-y-6">
              <Card className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-foreground/60 text-sm mb-1">Label</p>
                    <p className="font-semibold text-lg">Value</p>
                  </div>
                  <div>
                    <p className="text-foreground/60 text-sm mb-1">Trend</p>
                    <p className="font-semibold text-lg text-success">+5.2%</p>
                  </div>
                  <div>
                    <p className="text-foreground/60 text-sm mb-1">Status</p>
                    <p className="font-semibold text-lg text-primary">Active</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground/60 text-sm mb-1">Title</p>
                    <p className="font-semibold text-lg">Description goes here</p>
                  </div>
                  <Button size="sm">Action</Button>
                </div>
              </Card>

              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <h3 className="font-semibold">Section Title</h3>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Badge</span>
                  </div>
                  <p className="text-foreground/70 text-sm">
                    Card content with structured layout and clear hierarchy.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Card Specifications */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Specifications</h2>
            
            <div className="bg-card border border-border rounded-lg p-8 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Property</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Background</td>
                    <td className="py-3 px-4 font-mono text-foreground">#FFFFFF (light mode)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Border</td>
                    <td className="py-3 px-4 font-mono text-foreground">#E5E7EB (1px)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Border Radius</td>
                    <td className="py-3 px-4 font-mono text-foreground">12px</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Padding</td>
                    <td className="py-3 px-4 font-mono text-foreground">24px</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Shadow</td>
                    <td className="py-3 px-4 font-mono text-foreground">0 1px 2px rgba(0,0,0,.05)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Card Guidelines */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Card Guidelines</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✓ Do</h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Group related content together
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use consistent spacing and padding
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Maintain visual hierarchy
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use semantic borders for status
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✗ Don't</h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Nest cards excessively
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use too many shadows
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Overload with content
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use inconsistent styling
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Cards are flexible containers that adapt to different content types and use cases.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
