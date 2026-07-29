import Layout from "@/components/Layout";

const primaryColors = [
  { name: "primary-50", value: "#EEFBFF" },
  { name: "primary-100", value: "#DEF7FF" },
  { name: "primary-200", value: "#C1ECFD" },
  { name: "primary-300", value: "#9EDCF3" },
  { name: "primary-400", value: "#66B8D4" },
  { name: "primary-500", value: "#3093B2" },
  { name: "primary-600", value: "#007595" },
  { name: "primary-700", value: "#00607B" },
  { name: "primary-800", value: "#004B61" },
  { name: "primary-900", value: "#003444" },
];

const grayColors = [
  { name: "gray-50", value: "#FAFAFB" },
  { name: "gray-100", value: "#F3F4F6" },
  { name: "gray-200", value: "#E5E7EB" },
  { name: "gray-300", value: "#D1D5DB" },
  { name: "gray-400", value: "#9CA3AF" },
  { name: "gray-500", value: "#6B7280" },
  { name: "gray-600", value: "#4B5563" },
  { name: "gray-700", value: "#374151" },
  { name: "gray-800", value: "#1F2937" },
  { name: "gray-900", value: "#111827" },
];

const accentColors = [
  { name: "Coral (light)", value: "#D9534F" },
  { name: "Coral (dark)", value: "#FF8E6E" },
  { name: "Aqua (light)", value: "#0D9488" },
  { name: "Aqua (dark)", value: "#4DF4E1" },
];

const semanticColors = [
  { name: "Success", value: "#0D9488" },
  { name: "Warning", value: "#F59E0B" },
  { name: "Error", value: "#D9534F" },
  { name: "Info", value: "#3B82F6" },
];

const spacing = ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"];
const radius = ["8px", "12px", "14px", "22px", "32px"];

const typography = [
  { name: "Display XL", size: "56px" },
  { name: "Display LG", size: "48px" },
  { name: "H1", size: "40px" },
  { name: "H2", size: "32px" },
  { name: "H3", size: "24px" },
  { name: "H4", size: "20px" },
  { name: "H5", size: "18px" },
  { name: "H6", size: "16px" },
  { name: "Body LG", size: "16px" },
  { name: "Body MD", size: "14px" },
  { name: "Body SM", size: "12px" },
];

export default function Tokens() {
  return (
    <Layout currentPage="/tokens">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Design Tokens</h1>
            <p className="text-lg text-foreground/70">
              The foundational design elements that make up the MUNAXA design
              system. These tokens ensure consistency and scalability across all
              applications.
            </p>
          </div>
        </section>

        {/* Primary Colors */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Primary Color Palette</h2>
            <p className="text-foreground/70 mb-6">
              The primary brand color is <strong>#007595</strong> (Teal). Use
              this for primary actions, highlights, and key information.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {primaryColors.map(color => (
                <div key={color.name} className="text-center">
                  <div
                    className="w-full h-24 rounded-lg border border-border mb-3 shadow-sm"
                    style={{ backgroundColor: color.value }}
                  />
                  <p className="font-mono text-xs font-semibold text-foreground/70">
                    {color.name}
                  </p>
                  <p className="font-mono text-xs text-foreground/50">
                    {color.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Neutral Colors */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Neutral Palette</h2>
            <p className="text-foreground/70 mb-6">
              The neutral palette forms the backbone of the design. Use these
              for backgrounds, borders, and text.{" "}
              <strong>Rule: 80% neutral, 15% primary, 5% semantic.</strong>
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {grayColors.map(color => (
                <div key={color.name} className="text-center">
                  <div
                    className="w-full h-24 rounded-lg border border-border mb-3 shadow-sm"
                    style={{ backgroundColor: color.value }}
                  />
                  <p className="font-mono text-xs font-semibold text-foreground/70">
                    {color.name}
                  </p>
                  <p className="font-mono text-xs text-foreground/50">
                    {color.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Accent Colors */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Accent Colors</h2>
            <p className="text-foreground/70 mb-6">
              Theme-aware coral and aqua accents. Each brightens on the dark
              "ink" theme so it stays legible on both surfaces.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {accentColors.map(color => (
                <div
                  key={color.name}
                  className="bg-card border border-border rounded-lg p-6"
                >
                  <div
                    className="w-full h-16 rounded-lg border border-border mb-4"
                    style={{ backgroundColor: color.value }}
                  />
                  <p className="font-semibold text-foreground mb-1">
                    {color.name}
                  </p>
                  <p className="font-mono text-sm text-foreground/60">
                    {color.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Semantic Colors */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Semantic Colors</h2>
            <p className="text-foreground/70 mb-6">
              Use semantic colors for status indicators and feedback. These
              represent 5% of the color usage.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {semanticColors.map(color => (
                <div
                  key={color.name}
                  className="bg-card border border-border rounded-lg p-6"
                >
                  <div
                    className="w-full h-16 rounded-lg border border-border mb-4"
                    style={{ backgroundColor: color.value }}
                  />
                  <p className="font-semibold text-foreground mb-1">
                    {color.name}
                  </p>
                  <p className="font-mono text-sm text-foreground/60">
                    {color.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Typography Scale</h2>
            <p className="text-foreground/70 mb-6">
              <strong>Display:</strong> Sora · <strong>Body:</strong> Inter ·{" "}
              <strong>Arabic / RTL:</strong> Cairo (Sora &amp; Inter lack Arabic
              glyphs). Use weight variation to create hierarchy.
            </p>

            <div className="space-y-6">
              {typography.map(type => (
                <div
                  key={type.name}
                  className="bg-card border border-border rounded-lg p-6"
                >
                  <div
                    style={{ fontSize: type.size }}
                    className="font-semibold mb-2"
                  >
                    {type.name}
                  </div>
                  <p className="text-foreground/60 text-sm">
                    Font size: <strong>{type.size}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Spacing System</h2>
            <p className="text-foreground/70 mb-6">
              Consistent 4px base unit for all spacing. Use these values for
              padding, margins, and gaps.
            </p>

            <div className="space-y-4">
              {spacing.map(space => (
                <div key={space} className="flex items-center gap-6">
                  <div className="w-24 text-sm font-mono font-semibold text-foreground/70">
                    {space}
                  </div>
                  <div
                    className="bg-primary rounded"
                    style={{ width: space, height: "24px" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Border Radius */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Border Radius</h2>
            <p className="text-foreground/70 mb-6">
              Preferred radius values for different components. Cards use 12px,
              buttons and inputs use 8px, modals use 16px.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {radius.map(r => (
                <div
                  key={r}
                  className="bg-card border border-border rounded-lg p-6"
                >
                  <div
                    className="w-full h-24 bg-primary mb-4"
                    style={{ borderRadius: r }}
                  />
                  <p className="font-mono font-semibold text-foreground">{r}</p>
                  <p className="text-sm text-foreground/60">
                    {r === "12px" && "Cards"}
                    {r === "8px" && "Buttons, Inputs"}
                    {r === "16px" && "Modals"}
                    {r === "4px" && "Subtle elements"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Shadows */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Elevation & Shadows</h2>
            <p className="text-foreground/70 mb-6">
              <strong>Rule: Prefer borders over shadows.</strong> Use shadows
              sparingly for depth.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <div
                  className="w-full h-24 bg-white rounded-lg mb-4"
                  style={{ boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}
                />
                <p className="font-semibold text-foreground mb-1">
                  Shadow Small
                </p>
                <p className="font-mono text-xs text-foreground/60">
                  0 1px 2px rgba(0,0,0,.05)
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <div
                  className="w-full h-24 bg-white rounded-lg mb-4"
                  style={{ boxShadow: "0 4px 12px rgba(0,0,0,.08)" }}
                />
                <p className="font-semibold text-foreground mb-1">
                  Shadow Medium
                </p>
                <p className="font-mono text-xs text-foreground/60">
                  0 4px 12px rgba(0,0,0,.08)
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <div
                  className="w-full h-24 bg-white rounded-lg mb-4"
                  style={{ boxShadow: "0 10px 30px rgba(0,0,0,.10)" }}
                />
                <p className="font-semibold text-foreground mb-1">
                  Shadow Large
                </p>
                <p className="font-mono text-xs text-foreground/60">
                  0 10px 30px rgba(0,0,0,.10)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>
              All design tokens are implemented as CSS variables for easy
              theming and customization.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
