import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Accessibility() {
  return (
    <Layout currentPage="/accessibility">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Accessibility</h1>
            <p className="text-lg text-foreground/70">
              MUNAXA is built with accessibility in mind. We support WCAG AA
              compliance, keyboard navigation, screen readers, and RTL
              languages.
            </p>
          </div>
        </section>

        {/* WCAG AA Compliance */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">WCAG AA Compliance</h2>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-3 text-foreground">
                  Contrast Requirements
                </h3>
                <p className="text-foreground/70 mb-4">
                  Minimum contrast ratio of <strong>4.5:1</strong> for normal
                  text and <strong>3:1</strong> for large text.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-foreground text-background rounded">
                      <span className="font-semibold">✓ Pass</span>
                    </div>
                    <p className="text-sm text-foreground/70">
                      Foreground on background: 4.5:1
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-primary text-white rounded">
                      <span className="font-semibold">✓ Pass</span>
                    </div>
                    <p className="text-sm text-foreground/70">
                      Primary on white: 4.5:1
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-3 text-foreground">
                  Color Independence
                </h3>
                <p className="text-foreground/70 mb-4">
                  Never rely on color alone to convey information. Always use
                  text labels or icons.
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-success rounded-full"></div>
                    <span className="text-sm">Success</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-error rounded-full"></div>
                    <span className="text-sm">Error</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-warning rounded-full"></div>
                    <span className="text-sm">Warning</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Keyboard Navigation */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Keyboard Navigation</h2>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  Keyboard Support
                </h3>
                <div className="space-y-3 text-foreground/70 text-sm">
                  <p>
                    <strong>Tab:</strong> Move focus to next interactive element
                  </p>
                  <p>
                    <strong>Shift + Tab:</strong> Move focus to previous
                    interactive element
                  </p>
                  <p>
                    <strong>Enter:</strong> Activate buttons and links
                  </p>
                  <p>
                    <strong>Space:</strong> Toggle checkboxes and radio buttons
                  </p>
                  <p>
                    <strong>Arrow Keys:</strong> Navigate within dropdowns and
                    radio groups
                  </p>
                  <p>
                    <strong>Escape:</strong> Close modals and dropdowns
                  </p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  Focus Management
                </h3>
                <p className="text-foreground/70 mb-4">
                  All interactive elements have visible focus states. Try
                  tabbing through the form below:
                </p>
                <div className="space-y-4 max-w-md">
                  <div>
                    <Label htmlFor="kb-input">Name</Label>
                    <Input
                      id="kb-input"
                      placeholder="Enter your name"
                      className="mt-2"
                    />
                  </div>
                  <Button>Submit</Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Screen Readers */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Screen Reader Support</h2>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  Semantic HTML
                </h3>
                <p className="text-foreground/70 mb-4">
                  We use semantic HTML elements like{" "}
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    &lt;button&gt;
                  </code>
                  ,{" "}
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    &lt;nav&gt;
                  </code>
                  , and{" "}
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    &lt;main&gt;
                  </code>{" "}
                  for proper structure.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  ARIA Labels
                </h3>
                <p className="text-foreground/70 mb-4">
                  We provide ARIA labels for interactive elements that don't
                  have visible text labels.
                </p>
                <div className="space-y-2 text-sm text-foreground/70">
                  <p>
                    <code className="bg-muted px-2 py-1 rounded">
                      aria-label
                    </code>{" "}
                    - Provides accessible name
                  </p>
                  <p>
                    <code className="bg-muted px-2 py-1 rounded">
                      aria-describedby
                    </code>{" "}
                    - Provides description
                  </p>
                  <p>
                    <code className="bg-muted px-2 py-1 rounded">
                      aria-live
                    </code>{" "}
                    - Announces dynamic content
                  </p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  Supported Screen Readers
                </h3>
                <ul className="space-y-2 text-foreground/70 text-sm">
                  <li>✓ NVDA (Windows)</li>
                  <li>✓ JAWS (Windows)</li>
                  <li>✓ VoiceOver (macOS, iOS)</li>
                  <li>✓ TalkBack (Android)</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* RTL Support */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">
              RTL & Internationalization
            </h2>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  RTL Support
                </h3>
                <p className="text-foreground/70 mb-4">
                  All components support right-to-left (RTL) layouts using the{" "}
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    dir="rtl"
                  </code>{" "}
                  attribute.
                </p>
                <div className="p-4 bg-muted rounded-lg" dir="rtl">
                  <p className="font-semibold text-foreground mb-2">
                    مثال على النص العربي
                  </p>
                  <p className="text-foreground/70 text-sm">
                    هذا مثال على دعم اللغة العربية والتخطيطات من اليمين إلى
                    اليسار.
                  </p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  Language Support
                </h3>
                <ul className="space-y-2 text-foreground/70 text-sm">
                  <li>✓ English (LTR)</li>
                  <li>✓ Arabic (RTL)</li>
                  <li>✓ Cairo font for optimal Arabic/RTL readability</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">
              Accessibility Best Practices
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  ✓ Do
                </h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use semantic HTML elements
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Provide alt text for images
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use proper heading hierarchy
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Test with keyboard navigation
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Provide form labels
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use sufficient color contrast
                  </li>
                </ul>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  ✗ Don't
                </h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use color alone for meaning
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Skip heading levels
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use auto-playing media
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Disable zoom or scaling
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use placeholder as label
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Create keyboard traps
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Testing */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">
              Testing for Accessibility
            </h2>

            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">
                  Keyboard Testing
                </h3>
                <p className="text-foreground/70 text-sm">
                  Navigate the entire application using only the keyboard. All
                  functionality should be accessible.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">
                  Screen Reader Testing
                </h3>
                <p className="text-foreground/70 text-sm">
                  Test with NVDA, JAWS, or VoiceOver to ensure content is
                  properly announced.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">
                  Contrast Checking
                </h3>
                <p className="text-foreground/70 text-sm">
                  Use tools like WebAIM Contrast Checker to verify color
                  contrast ratios meet WCAG AA standards.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-foreground">
                  Automated Testing
                </h3>
                <p className="text-foreground/70 text-sm">
                  Use tools like axe DevTools, Lighthouse, or WAVE to identify
                  accessibility issues.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>
              Accessibility is not an afterthought—it's built into every
              component and page of MUNAXA.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
