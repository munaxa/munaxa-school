import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const data = [
  { name: "Jan", value: 400, value2: 240 },
  { name: "Feb", value: 300, value2: 221 },
  { name: "Mar", value: 200, value2: 229 },
  { name: "Apr", value: 278, value2: 200 },
  { name: "May", value: 189, value2: 220 },
  { name: "Jun", value: 239, value2: 250 },
];

export default function Charts() {
  return (
    <Layout currentPage="/charts">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Charts</h1>
            <p className="text-lg text-foreground/70">
              Data visualization components for displaying trends, comparisons, and distributions. Built with Recharts.
            </p>
          </div>
        </section>

        {/* Line Chart */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Line Chart</h2>
            
            <Card className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis stroke="var(--foreground)" />
                  <YAxis stroke="var(--foreground)" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} />
                  <Line type="monotone" dataKey="value2" stroke="var(--chart-2)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </section>

        {/* Area Chart */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Area Chart</h2>
            
            <Card className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis stroke="var(--foreground)" />
                  <YAxis stroke="var(--foreground)" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="value" fill="var(--primary)" stroke="var(--primary)" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="value2" fill="var(--chart-2)" stroke="var(--chart-2)" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </section>

        {/* Bar Chart */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Bar Chart</h2>
            
            <Card className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis stroke="var(--foreground)" />
                  <YAxis stroke="var(--foreground)" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="var(--primary)" />
                  <Bar dataKey="value2" fill="var(--chart-2)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </section>

        {/* Chart Guidelines */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Chart Guidelines</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✓ Allowed Chart Types</h3>
                <ul className="space-y-2 text-foreground/70 text-sm">
                  <li>✓ Line charts (trends over time)</li>
                  <li>✓ Area charts (cumulative trends)</li>
                  <li>✓ Bar charts (comparisons)</li>
                  <li>✓ Stacked bar charts (composition)</li>
                </ul>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✗ Avoid</h3>
                <ul className="space-y-2 text-foreground/70 text-sm">
                  <li>✗ 3D charts (hard to read)</li>
                  <li>✗ Pie-heavy dashboards (use bars)</li>
                  <li>✗ Decorative charts (data first)</li>
                  <li>✗ Too many colors (use palette)</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Chart Colors */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Chart Color Palette</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                { name: "Chart 1", color: "#9EDCF3" },
                { name: "Chart 2", color: "#66B8D4" },
                { name: "Chart 3", color: "#3093B2" },
                { name: "Chart 4", color: "#007595" },
                { name: "Chart 5", color: "#00607B" },
              ].map((item) => (
                <Card key={item.name} className="p-6 text-center">
                  <div
                    className="w-full h-24 rounded-lg mb-3"
                    style={{ backgroundColor: item.color }}
                  />
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="font-mono text-xs text-foreground/60">{item.color}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Best Practices</h2>
            
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">Clear Labels & Legends</h3>
                <p className="text-foreground/70 text-sm">
                  Always include axis labels, legends, and tooltips. Make it easy to understand what the data represents.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">Consistent Color Usage</h3>
                <p className="text-foreground/70 text-sm">
                  Use the MUNAXA color palette. Maintain consistency across all charts to help users recognize patterns.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">Responsive Design</h3>
                <p className="text-foreground/70 text-sm">
                  Charts should adapt to different screen sizes. Use ResponsiveContainer to ensure proper scaling.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">Data Accuracy</h3>
                <p className="text-foreground/70 text-sm">
                  Ensure data is accurate and up-to-date. Use appropriate scales and avoid misleading visualizations.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Charts are built with Recharts for responsive, accessible data visualization.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
