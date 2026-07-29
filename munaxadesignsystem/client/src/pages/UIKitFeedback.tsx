import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

export default function UIKitFeedback() {
  return (
    <Layout currentPage="/uikit/feedback">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Feedback & Overlay Components</h1>
            <p className="text-lg text-foreground/70">
              Modals, drawers, toasts, alerts, and other components for providing feedback to users.
            </p>
          </div>
        </section>

        {/* Alerts */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Alerts</h2>
            
            <div className="space-y-4 max-w-2xl">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>
                  Your attendance record has been updated. Please review the changes in your dashboard.
                </AlertDescription>
              </Alert>

              <Alert className="border-success bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle className="text-success">Success</AlertTitle>
                <AlertDescription className="text-foreground/70">
                  Your fee payment has been processed successfully. Receipt has been sent to your email.
                </AlertDescription>
              </Alert>

              <Alert className="border-warning bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning">Warning</AlertTitle>
                <AlertDescription className="text-foreground/70">
                  Your assignment is due tomorrow. Please submit it before 11:59 PM.
                </AlertDescription>
              </Alert>

              <Alert className="border-error bg-error/5">
                <AlertCircle className="h-4 w-4 text-error" />
                <AlertTitle className="text-error">Error</AlertTitle>
                <AlertDescription className="text-foreground/70">
                  Failed to update your profile. Please try again later.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </section>

        {/* Toast Notifications */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Toast Notifications</h2>
            
            <Card className="p-6 max-w-2xl">
              <p className="text-foreground/70 mb-6">
                Click the buttons below to see toast notifications. They appear in the bottom-right corner.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => toast.success("Student record updated successfully!")}>
                  Success Toast
                </Button>
                <Button variant="outline" onClick={() => toast.error("Failed to save changes. Please try again.")}>
                  Error Toast
                </Button>
                <Button variant="outline" onClick={() => toast.warning("Your session will expire in 5 minutes.")}>
                  Warning Toast
                </Button>
                <Button variant="outline" onClick={() => toast.info("New announcement: School will close early today.")}>
                  Info Toast
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* Modal Variations */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Modal Variations</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Confirmation Modal</h3>
                <p className="text-foreground/70 text-sm mb-4">
                  Used for confirming important actions like deleting records or submitting forms.
                </p>
                <Button variant="destructive">Delete Student</Button>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Form Modal</h3>
                <p className="text-foreground/70 text-sm mb-4">
                  Contains forms for adding or editing records without leaving the current page.
                </p>
                <Button>Add New Grade</Button>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Information Modal</h3>
                <p className="text-foreground/70 text-sm mb-4">
                  Displays detailed information or instructions that need user attention.
                </p>
                <Button variant="outline">View Instructions</Button>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Success Modal</h3>
                <p className="text-foreground/70 text-sm mb-4">
                  Confirms successful completion of an action with next steps.
                </p>
                <Button variant="outline">View Result</Button>
              </Card>
            </div>
          </div>
        </section>

        {/* Drawer Component */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Drawer Component</h2>
            
            <Card className="p-6 max-w-2xl">
              <h3 className="font-semibold text-lg mb-4">Slide-out Drawer</h3>
              <p className="text-foreground/70 text-sm mb-4">
                Drawers slide in from the side and are used for navigation, filters, or detailed forms without covering the entire screen.
              </p>
              <Button>Open Drawer</Button>
            </Card>
          </div>
        </section>

        {/* Command Palette */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Command Palette</h2>
            
            <Card className="p-6 max-w-2xl">
              <h3 className="font-semibold text-lg mb-4">Quick Command Search</h3>
              <p className="text-foreground/70 text-sm mb-4">
                Press <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono">Cmd+K</kbd> (or <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono">Ctrl+K</kbd>) to open the command palette. Quickly navigate to any page or perform actions.
              </p>
              <div className="p-4 bg-muted rounded-lg text-sm text-foreground/70">
                <p className="mb-2">Available commands:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Go to Dashboard</li>
                  <li>• Go to Students</li>
                  <li>• Go to Grades</li>
                  <li>• Add New Student</li>
                  <li>• View Reports</li>
                </ul>
              </div>
            </Card>
          </div>
        </section>

        {/* Loading States */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Loading States</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Loading Button</h3>
                <Button disabled className="gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Saving...
                </Button>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Loading Spinner</h3>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-foreground/70">Loading data...</span>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Tooltip */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Tooltips</h2>
            
            <Card className="p-6 max-w-2xl">
              <p className="text-foreground/70 text-sm mb-6">
                Hover over elements to see tooltips with helpful information.
              </p>
              <div className="flex gap-4 flex-wrap">
                <div className="relative group">
                  <button className="px-4 py-2 bg-primary text-white rounded-lg">
                    Hover me
                  </button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-foreground text-background rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    This is a tooltip
                  </div>
                </div>
                <div className="relative group">
                  <button className="px-4 py-2 border border-border rounded-lg">
                    Hover me too
                  </button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-foreground text-background rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Another tooltip
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Feedback & Overlay Components • 6 Components • User-Focused</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
