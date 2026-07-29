import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Search, Download } from "lucide-react";

export default function Tables() {
  return (
    <Layout currentPage="/tables">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Tables</h1>
            <p className="text-lg text-foreground/70">
              Data tables for displaying and managing large datasets. Support search, filter, export, pagination, and column visibility.
            </p>
          </div>
        </section>

        {/* Basic Table */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Basic Table</h2>
            
            <Card className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-foreground">John Doe</td>
                      <td className="py-3 px-4 text-foreground/70">john@example.com</td>
                      <td className="py-3 px-4 text-foreground">Admin</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-success/10 text-success text-xs font-medium rounded">Active</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-foreground">Jane Smith</td>
                      <td className="py-3 px-4 text-foreground/70">jane@example.com</td>
                      <td className="py-3 px-4 text-foreground">Teacher</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-success/10 text-success text-xs font-medium rounded">Active</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 text-foreground">Bob Johnson</td>
                      <td className="py-3 px-4 text-foreground/70">bob@example.com</td>
                      <td className="py-3 px-4 text-foreground">Student</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-warning/10 text-warning text-xs font-medium rounded">Pending</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>

        {/* Table with Controls */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Table with Controls</h2>
            
            <Card className="p-6">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/50" />
                  <Input placeholder="Search..." className="pl-10" />
                </div>
                <Button variant="outline" className="gap-2">
                  <ChevronDown className="w-4 h-4" />
                  Filter
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        <input type="checkbox" className="rounded" />
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Student</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Grade</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Attendance</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <input type="checkbox" className="rounded" />
                        </td>
                        <td className="py-3 px-4 text-foreground">Student {i}</td>
                        <td className="py-3 px-4 text-foreground">Grade {i}</td>
                        <td className="py-3 px-4 text-foreground">{95 - i}%</td>
                        <td className="py-3 px-4">
                          <Button size="sm" variant="ghost">View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-6 text-sm text-foreground/70">
                <p>Showing 1-5 of 100 results</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Previous</Button>
                  <Button size="sm" variant="outline">Next</Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Table Specifications */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Table Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">✓ Supported Features</h3>
                <ul className="space-y-2 text-foreground/70 text-sm">
                  <li>✓ Search and filter</li>
                  <li>✓ Export to CSV/Excel</li>
                  <li>✓ Pagination</li>
                  <li>✓ Column visibility toggle</li>
                  <li>✓ Sorting</li>
                  <li>✓ Row selection</li>
                  <li>✓ Responsive design</li>
                </ul>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Specifications</h3>
                <ul className="space-y-2 text-foreground/70 text-sm">
                  <li>Header Background: Gray-50</li>
                  <li>Header Hover: Primary-50</li>
                  <li>Row Hover: Muted</li>
                  <li>Border: Gray-200</li>
                  <li>Font Size: 14px (Body MD)</li>
                  <li>Padding: 12px 16px</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Tables are built with TanStack Table for powerful data management and accessibility.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
