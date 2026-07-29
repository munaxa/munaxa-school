import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, BookOpen, Clock, GraduationCap, Mail, Phone } from "lucide-react";

export default function UIKitDataDisplay() {
  return (
    <Layout currentPage="/uikit/data-display">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Data Display Components</h1>
            <p className="text-lg text-foreground/70">
              Tables, cards, lists, and data visualization components for displaying school information.
            </p>
          </div>
        </section>

        {/* KPI Card */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">KPI Cards</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 border-l-4 border-l-primary">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-foreground/70 text-sm">Total Students</p>
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-2">1,245</div>
                <div className="flex items-center gap-1 text-success text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+12% from last month</span>
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-success">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-foreground/70 text-sm">Attendance Rate</p>
                  <Clock className="w-4 h-4 text-success" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-2">94.2%</div>
                <div className="flex items-center gap-1 text-success text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+2.1% from last week</span>
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-warning">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-foreground/70 text-sm">Pending Fees</p>
                  <BookOpen className="w-4 h-4 text-warning" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-2">$45,320</div>
                <div className="flex items-center gap-1 text-error text-sm">
                  <TrendingDown className="w-4 h-4" />
                  <span>+8% from last month</span>
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-error">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-foreground/70 text-sm">Absent Today</p>
                  <Users className="w-4 h-4 text-error" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-2">23</div>
                <div className="flex items-center gap-1 text-error text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+5 from yesterday</span>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Student Card */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Student Cards</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary mb-3">
                      JD
                    </div>
                    <h3 className="font-bold text-lg">John Doe</h3>
                    <p className="text-foreground/70 text-sm">Grade 5 • Section A</p>
                  </div>
                  <Badge>Active</Badge>
                </div>
                <div className="space-y-2 text-sm text-foreground/70">
                  <p className="flex items-center gap-2"><Mail className="size-4" aria-hidden />john.doe@school.com</p>
                  <p className="flex items-center gap-2"><Phone className="size-4" aria-hidden />+1 (555) 123-4567</p>
                  <p className="flex items-center gap-2"><GraduationCap className="size-4" aria-hidden />GPA: 3.8/4.0</p>
                </div>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center text-lg font-bold text-success mb-3">
                      SM
                    </div>
                    <h3 className="font-bold text-lg">Sarah Miller</h3>
                    <p className="text-foreground/70 text-sm">Grade 5 • Section B</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="space-y-2 text-sm text-foreground/70">
                  <p className="flex items-center gap-2"><Mail className="size-4" aria-hidden />sarah.miller@school.com</p>
                  <p className="flex items-center gap-2"><Phone className="size-4" aria-hidden />+1 (555) 234-5678</p>
                  <p className="flex items-center gap-2"><GraduationCap className="size-4" aria-hidden />GPA: 3.9/4.0</p>
                </div>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center text-lg font-bold text-warning mb-3">
                      MJ
                    </div>
                    <h3 className="font-bold text-lg">Mike Johnson</h3>
                    <p className="text-foreground/70 text-sm">Grade 4 • Section C</p>
                  </div>
                  <Badge variant="secondary">Inactive</Badge>
                </div>
                <div className="space-y-2 text-sm text-foreground/70">
                  <p className="flex items-center gap-2"><Mail className="size-4" aria-hidden />mike.johnson@school.com</p>
                  <p className="flex items-center gap-2"><Phone className="size-4" aria-hidden />+1 (555) 345-6789</p>
                  <p className="flex items-center gap-2"><GraduationCap className="size-4" aria-hidden />GPA: 3.2/4.0</p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Teacher Card */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Teacher Cards</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                    ER
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">Emily Rodriguez</h3>
                    <p className="text-foreground/70 text-sm">Mathematics Teacher</p>
                    <Badge className="mt-2">Experience: 8 years</Badge>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-foreground/70 border-t border-border pt-4">
                  <p><strong>Classes:</strong> Grade 5 (A, B), Grade 6 (A)</p>
                  <p><strong>Students:</strong> 95</p>
                  <p><strong>Email:</strong> emily.rodriguez@school.com</p>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center text-2xl font-bold text-success">
                    DK
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">David Kim</h3>
                    <p className="text-foreground/70 text-sm">English Teacher</p>
                    <Badge className="mt-2">Experience: 5 years</Badge>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-foreground/70 border-t border-border pt-4">
                  <p><strong>Classes:</strong> Grade 4 (A, B, C), Grade 5 (B)</p>
                  <p><strong>Students:</strong> 112</p>
                  <p><strong>Email:</strong> david.kim@school.com</p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Attendance Widget */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Attendance Widget</h2>
            
            <Card className="p-6 max-w-2xl">
              <h3 className="font-bold text-lg mb-4">Today's Attendance - Grade 5A</h3>
              <div className="space-y-3">
                {[
                  { name: "John Doe", status: "Present", time: "08:15 AM" },
                  { name: "Sarah Miller", status: "Present", time: "08:22 AM" },
                  { name: "Mike Johnson", status: "Late", time: "08:45 AM" },
                  { name: "Emma Wilson", status: "Absent", time: "—" },
                  { name: "Alex Brown", status: "Excused", time: "—" },
                ].map((student) => (
                  <div key={student.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{student.name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={
                        student.status === "Present" ? "default" :
                        student.status === "Late" ? "secondary" :
                        student.status === "Absent" ? "destructive" : "outline"
                      }>
                        {student.status}
                      </Badge>
                      <span className="text-sm text-foreground/70 min-w-20 text-right">{student.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-primary/10 rounded-lg text-sm text-foreground/70">
                <p><strong>Summary:</strong> 3 Present • 1 Late • 1 Absent • 1 Excused</p>
              </div>
            </Card>
          </div>
        </section>

        {/* Grade Card */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Grade Card</h2>
            
            <Card className="p-6 max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg">John Doe</h3>
                  <p className="text-foreground/70 text-sm">Grade 5 • Mathematics</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">92</div>
                  <p className="text-foreground/70 text-sm">Overall Grade</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { subject: "Midterm Exam", grade: 88, weight: "30%" },
                  { subject: "Quizzes", grade: 94, weight: "20%" },
                  { subject: "Homework", grade: 95, weight: "20%" },
                  { subject: "Class Participation", grade: 92, weight: "15%" },
                  { subject: "Final Project", grade: 90, weight: "15%" },
                ].map((item) => (
                  <div key={item.subject} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.subject}</p>
                      <p className="text-sm text-foreground/70">{item.weight} weight</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.grade >= 90 ? "default" : item.grade >= 80 ? "secondary" : "destructive"}>
                        {item.grade}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Data Display Components • 7 Components • School-Focused</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
