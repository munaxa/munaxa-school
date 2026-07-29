import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Download,
  LoaderCircle,
  Trash2,
  Plus,
} from "lucide-react";

export default function Buttons() {
  return (
    <Layout currentPage="/buttons">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Buttons</h1>
            <p className="text-lg text-foreground/70">
              Buttons are the primary call-to-action elements. They should be
              clear, accessible, and responsive to user interactions.
            </p>
          </div>
        </section>

        {/* Primary Buttons */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Primary Buttons</h2>
            <p className="text-foreground/70 mb-6">
              Use primary buttons for the main action on a page. Primary
              resolves from the brand violet (#5B1FD6 on light, #B97BFF on dark)
              via the <code>--primary</code> token.
            </p>

            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Default State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button>Primary Button</Button>
                    <Button size="sm">Small</Button>
                    <Button size="lg">Large</Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    With Icons
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add New
                    </Button>
                    <Button>
                      Download
                      <Download className="w-4 h-4 ml-2" />
                    </Button>
                    <Button>
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Disabled State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button disabled>Disabled</Button>
                    <Button disabled size="lg">
                      Large Disabled
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Loading State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button disabled>
                      <LoaderCircle
                        className="me-2 size-4 animate-spin"
                        aria-hidden
                      />
                      Loading...
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary Buttons */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Secondary Buttons</h2>
            <p className="text-foreground/70 mb-6">
              Use secondary buttons for alternative actions. Background: White,
              Border: Gray-200
            </p>

            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Default State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="outline">Secondary Button</Button>
                    <Button variant="outline" size="sm">
                      Small
                    </Button>
                    <Button variant="outline" size="lg">
                      Large
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    With Icons
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                    <Button variant="outline">
                      Export
                      <Download className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Disabled State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="outline" disabled>
                      Disabled
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Danger Buttons */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Danger Buttons</h2>
            <p className="text-foreground/70 mb-6">
              Use danger buttons for destructive actions like delete.
              Background: #EF4444, Color: White
            </p>

            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Default State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="destructive">Delete</Button>
                    <Button variant="destructive" size="sm">
                      Remove
                    </Button>
                    <Button variant="destructive" size="lg">
                      Delete All
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    With Icons
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Record
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Disabled State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="destructive" disabled>
                      Disabled
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ghost Buttons */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Ghost Buttons</h2>
            <p className="text-foreground/70 mb-6">
              Use ghost buttons for tertiary actions or links that look like
              text.
            </p>

            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    Default State
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="ghost">Ghost Button</Button>
                    <Button variant="ghost" size="sm">
                      Small
                    </Button>
                    <Button variant="ghost" size="lg">
                      Large
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground/70 mb-4">
                    With Icons
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="ghost">
                      <Plus className="w-4 h-4 mr-2" />
                      Learn More
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Button Guidelines */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Button Guidelines</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  ✓ Do
                </h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use clear, action-oriented labels
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Provide visual feedback on hover/active
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use consistent sizing and spacing
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Make buttons keyboard accessible
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use icons to reinforce meaning
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  ✗ Don't
                </h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use vague labels like "Click here"
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Mix button styles inconsistently
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Disable buttons without explanation
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use too many primary buttons
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Forget focus states for keyboard users
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Specifications */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Specifications</h2>

            <div className="bg-card border border-border rounded-lg p-8 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Property
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Height</td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      40px (default)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">
                      Border Radius
                    </td>
                    <td className="py-3 px-4 font-mono text-foreground">8px</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Font Size</td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      14px (Body MD)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">
                      Font Weight
                    </td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      600 (semibold)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Padding</td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      12px 16px
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Transition</td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      150ms ease-out
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>
              Buttons should provide clear visual feedback and be accessible via
              keyboard and screen readers.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
