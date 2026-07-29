import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, Home, Users, BookOpen, Settings } from "lucide-react";

export default function UIKitNavigation() {
  return (
    <Layout currentPage="/uikit/navigation">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Navigation & Layout Components</h1>
            <p className="text-lg text-foreground/70">
              Sidebars, headers, breadcrumbs, tabs, and other navigation components for organizing content.
            </p>
          </div>
        </section>

        {/* Breadcrumb */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Breadcrumb Navigation</h2>
            
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Simple Breadcrumb</h3>
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/students">Students</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>John Doe</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Deep Navigation</h3>
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/academics">Academics</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/grades">Grades</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Grade 5A - Mathematics</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </Card>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Tabs Navigation</h2>
            
            <Card className="p-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="grades">Grades</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Student Overview</h3>
                    <p className="text-foreground/70">
                      John Doe is a Grade 5 student with excellent academic performance. He maintains a GPA of 3.8/4.0 and has perfect attendance.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded">
                        <p className="text-sm text-foreground/70">GPA</p>
                        <p className="text-2xl font-bold">3.8</p>
                      </div>
                      <div className="p-4 bg-muted rounded">
                        <p className="text-sm text-foreground/70">Attendance</p>
                        <p className="text-2xl font-bold">97%</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="grades" className="mt-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Academic Grades</h3>
                    <div className="space-y-3">
                      {[
                        { subject: "Mathematics", grade: 92 },
                        { subject: "English", grade: 88 },
                        { subject: "Science", grade: 95 },
                        { subject: "Social Studies", grade: 90 },
                      ].map((item) => (
                        <div key={item.subject} className="flex justify-between items-center p-3 bg-muted rounded">
                          <span className="font-medium">{item.subject}</span>
                          <span className="text-lg font-bold text-primary">{item.grade}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="attendance" className="mt-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Attendance Record</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-success/10 rounded">
                        <p className="text-sm text-foreground/70">Present</p>
                        <p className="text-2xl font-bold text-success">92</p>
                      </div>
                      <div className="text-center p-4 bg-warning/10 rounded">
                        <p className="text-sm text-foreground/70">Late</p>
                        <p className="text-2xl font-bold text-warning">3</p>
                      </div>
                      <div className="text-center p-4 bg-error/10 rounded">
                        <p className="text-sm text-foreground/70">Absent</p>
                        <p className="text-2xl font-bold text-error">2</p>
                      </div>
                      <div className="text-center p-4 bg-primary/10 rounded">
                        <p className="text-sm text-foreground/70">Rate</p>
                        <p className="text-2xl font-bold text-primary">97%</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="documents" className="mt-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Documents</h3>
                    <div className="space-y-2">
                      {[
                        "Report Card - Term 1",
                        "Admission Certificate",
                        "Medical Records",
                        "Parent Consent Forms",
                      ].map((doc) => (
                        <div key={doc} className="flex items-center justify-between p-3 bg-muted rounded">
                          <span className="font-medium">{doc}</span>
                          <ChevronRight className="w-4 h-4 text-foreground/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </section>

        {/* Header Component */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Header Component</h2>
            
            <Card className="p-0 overflow-hidden">
              <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5" />
                  <h1 className="text-xl font-bold">MUNAXA School Management</h1>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">Welcome, Admin</span>
                  <div className="w-8 h-8 rounded-full bg-white/20"></div>
                </div>
              </div>
              <div className="p-6 text-foreground/70 text-sm">
                This is the main header component that appears at the top of every page. It includes the logo, navigation, and user menu.
              </div>
            </Card>
          </div>
        </section>

        {/* Sidebar Navigation */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Sidebar Navigation</h2>
            
            <Card className="p-0 overflow-hidden">
              <div className="flex">
                <div className="w-64 bg-card border-r border-border p-6 space-y-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary font-medium">
                    <Home className="w-4 h-4" />
                    <span>Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted text-foreground/70 font-medium cursor-pointer">
                    <Users className="w-4 h-4" />
                    <span>Students</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted text-foreground/70 font-medium cursor-pointer">
                    <BookOpen className="w-4 h-4" />
                    <span>Academics</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted text-foreground/70 font-medium cursor-pointer">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </div>
                </div>
                <div className="flex-1 p-6">
                  <h3 className="font-semibold text-lg mb-2">Sidebar Navigation</h3>
                  <p className="text-foreground/70 text-sm">
                    The sidebar provides persistent navigation throughout the application. It shows the current page highlighted and allows quick access to main sections.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Pagination */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Pagination</h2>
            
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Showing 1-10 of 245 students</span>
                <div className="flex gap-2">
                  <button className="px-3 py-2 border border-border rounded-lg text-foreground/70 hover:bg-muted">
                    Previous
                  </button>
                  {[1, 2, 3, "...", 24, 25].map((page) => (
                    <button
                      key={page}
                      className={`px-3 py-2 rounded-lg ${
                        page === 1
                          ? "bg-primary text-white"
                          : "border border-border text-foreground/70 hover:bg-muted"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button className="px-3 py-2 border border-border rounded-lg text-foreground/70 hover:bg-muted">
                    Next
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Navigation & Layout Components • 6 Components • Responsive</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
