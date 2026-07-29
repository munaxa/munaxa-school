import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Modals() {
  return (
    <Layout currentPage="/modals">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Modals & Dialogs</h1>
            <p className="text-lg text-foreground/70">
              Modal dialogs for capturing user attention and collecting input. Support confirmation, forms, and alerts.
            </p>
          </div>
        </section>

        {/* Basic Modal */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Basic Modal</h2>
            
            <Card className="p-8">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open Modal</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modal Title</DialogTitle>
                    <DialogDescription>
                      This is a basic modal dialog. It captures user attention and can contain forms, messages, or other content.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-foreground/70">Modal content goes here.</p>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline">Cancel</Button>
                      <Button>Confirm</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          </div>
        </section>

        {/* Confirmation Modal */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Confirmation Modal</h2>
            
            <Card className="p-8">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive">Delete Item</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Delete</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete this item? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline">Cancel</Button>
                    <Button variant="destructive">Delete</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          </div>
        </section>

        {/* Form Modal */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Form Modal</h2>
            
            <Card className="p-8">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Add New Student</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Student</DialogTitle>
                    <DialogDescription>
                      Fill in the form below to add a new student to the system.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="Enter full name" className="mt-2" />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="Enter email" className="mt-2" />
                    </div>
                    <div>
                      <Label htmlFor="grade">Grade</Label>
                      <Input id="grade" placeholder="Enter grade" className="mt-2" />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline">Cancel</Button>
                      <Button>Add Student</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          </div>
        </section>

        {/* Modal Specifications */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Modal Specifications</h2>
            
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
                    <td className="py-3 px-4 text-foreground/70">Width (Standard)</td>
                    <td className="py-3 px-4 font-mono text-foreground">640px</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Width (Large)</td>
                    <td className="py-3 px-4 font-mono text-foreground">900px</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Border Radius</td>
                    <td className="py-3 px-4 font-mono text-foreground">16px</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Backdrop</td>
                    <td className="py-3 px-4 font-mono text-foreground">rgba(0,0,0,0.5)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Animation</td>
                    <td className="py-3 px-4 font-mono text-foreground">Fade + Scale (200-250ms)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-foreground/70">Padding</td>
                    <td className="py-3 px-4 font-mono text-foreground">24px</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Modal Guidelines */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Modal Guidelines</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✓ Do</h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use for important user actions
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Provide clear titles and descriptions
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Include escape key support
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Focus on first interactive element
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use semantic button colors
                  </li>
                </ul>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">✗ Don't</h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use for minor information
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Nest modals excessively
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Disable backdrop click
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use overly long content
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Forget focus management
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Modals are built with Radix UI for accessibility and keyboard support.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
