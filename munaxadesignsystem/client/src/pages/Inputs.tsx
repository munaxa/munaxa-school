import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function Inputs() {
  return (
    <Layout currentPage="/inputs">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Input Components</h1>
            <p className="text-lg text-foreground/70">
              Form inputs for collecting user data. All inputs are accessible, support keyboard navigation, and provide clear focus states.
            </p>
          </div>
        </section>

        {/* Text Inputs */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Text Inputs</h2>
            
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6 max-w-md">
                <div>
                  <Label htmlFor="input-default">Default Input</Label>
                  <Input id="input-default" placeholder="Enter text..." className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="input-filled">Filled Input</Label>
                  <Input id="input-filled" placeholder="Enter text..." defaultValue="Sample text" className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="input-disabled">Disabled Input</Label>
                  <Input id="input-disabled" placeholder="Disabled" disabled className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="input-error">Input with Error</Label>
                  <Input id="input-error" placeholder="Invalid input" className="mt-2 border-error" />
                  <p className="text-error text-sm mt-1">This field is required</p>
                </div>

                <div>
                  <Label htmlFor="input-success">Input with Success</Label>
                  <Input id="input-success" placeholder="Valid input" defaultValue="Valid" className="mt-2 border-success" />
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm text-foreground/70">
                  <strong>Specifications:</strong> Height: 40px | Radius: 8px | Border: Gray-300 | Focus: Primary-600 with no glow effect
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Textarea */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Textarea</h2>
            
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6 max-w-md">
                <div>
                  <Label htmlFor="textarea-default">Default Textarea</Label>
                  <Textarea id="textarea-default" placeholder="Enter your message..." className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="textarea-filled">Textarea with Content</Label>
                  <Textarea id="textarea-filled" defaultValue="This is a sample message that spans multiple lines." className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="textarea-disabled">Disabled Textarea</Label>
                  <Textarea id="textarea-disabled" placeholder="Disabled" disabled className="mt-2" />
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm text-foreground/70">
                  <strong>Specifications:</strong> Min height: 100px | Radius: 8px | Resizable
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Select */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Select Dropdown</h2>
            
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6 max-w-md">
                <div>
                  <Label htmlFor="select-default">Select an option</Label>
                  <Select>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose an option..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="select-grouped">Select with groups</Label>
                  <Select>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cat1">Category 1</SelectItem>
                      <SelectItem value="cat2">Category 2</SelectItem>
                      <SelectItem value="cat3">Category 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm text-foreground/70">
                  <strong>Specifications:</strong> Height: 40px | Radius: 8px | Keyboard accessible with arrow keys
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Checkboxes */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Checkboxes</h2>
            
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6 max-w-md">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox id="checkbox1" />
                    <Label htmlFor="checkbox1" className="font-normal cursor-pointer">Option 1</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="checkbox2" defaultChecked />
                    <Label htmlFor="checkbox2" className="font-normal cursor-pointer">Option 2 (checked)</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="checkbox3" disabled />
                    <Label htmlFor="checkbox3" className="font-normal cursor-pointer opacity-50">Option 3 (disabled)</Label>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm text-foreground/70">
                  <strong>Specifications:</strong> Size: 20px | Radius: 4px | Keyboard accessible with Space key
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Radio Buttons */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Radio Buttons</h2>
            
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="space-y-6 max-w-md">
                <RadioGroup defaultValue="option1">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="option1" id="radio1" />
                    <Label htmlFor="radio1" className="font-normal cursor-pointer">Option 1</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="option2" id="radio2" />
                    <Label htmlFor="radio2" className="font-normal cursor-pointer">Option 2</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="option3" id="radio3" />
                    <Label htmlFor="radio3" className="font-normal cursor-pointer">Option 3</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm text-foreground/70">
                  <strong>Specifications:</strong> Size: 20px | Keyboard accessible with arrow keys
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Input Guidelines */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Input Guidelines</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✓ Do</h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Provide clear labels for all inputs
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Show validation errors clearly
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use appropriate input types
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Provide helpful placeholder text
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Make focus states visible
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✗ Don't</h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use placeholder as label
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Disable inputs without reason
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use color alone for validation
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Make inputs too small
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Forget about keyboard navigation
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>All input components support keyboard navigation and provide clear focus states for accessibility.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
