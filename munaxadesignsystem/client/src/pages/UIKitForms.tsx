import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "lucide-react";

export default function UIKitForms() {
  return (
    <Layout currentPage="/uikit/forms">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Form Components</h1>
            <p className="text-lg text-foreground/70">
              Input fields, selects, date pickers, and other form controls. All components are fully accessible with proper labels and validation states.
            </p>
          </div>
        </section>

        {/* Text Input */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Text Input</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Default State</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="input-default">Email Address</Label>
                    <Input id="input-default" placeholder="Enter email" className="mt-2" />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">With Error</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="input-error">Email Address</Label>
                    <Input id="input-error" placeholder="Enter email" className="mt-2 border-error" />
                    <p className="text-error text-sm mt-1">Invalid email format</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Disabled State</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="input-disabled">Email Address</Label>
                    <Input id="input-disabled" placeholder="Enter email" disabled className="mt-2" />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">With Helper Text</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="input-helper">Password</Label>
                    <Input id="input-helper" type="password" placeholder="Enter password" className="mt-2" />
                    <p className="text-foreground/60 text-sm mt-1">At least 8 characters</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Textarea */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Textarea</h2>
            
            <Card className="p-6 max-w-2xl">
              <Label htmlFor="textarea">Message</Label>
              <Textarea id="textarea" placeholder="Enter your message here..." className="mt-2" rows={4} />
              <p className="text-foreground/60 text-sm mt-2">0 / 500 characters</p>
            </Card>
          </div>
        </section>

        {/* Select */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Select Dropdown</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Grade Selection</h3>
                <div>
                  <Label htmlFor="grade-select">Select Grade</Label>
                  <Select>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a grade..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grade-1">Grade 1</SelectItem>
                      <SelectItem value="grade-2">Grade 2</SelectItem>
                      <SelectItem value="grade-3">Grade 3</SelectItem>
                      <SelectItem value="grade-4">Grade 4</SelectItem>
                      <SelectItem value="grade-5">Grade 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Department Selection</h3>
                <div>
                  <Label htmlFor="dept-select">Department</Label>
                  <Select>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose department..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Mathematics</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="social">Social Studies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Checkbox */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Checkbox</h2>
            
            <Card className="p-6 max-w-2xl">
              <h3 className="font-semibold text-lg mb-4">Permissions</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="perm-1" />
                  <Label htmlFor="perm-1" className="font-normal cursor-pointer">View student records</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="perm-2" />
                  <Label htmlFor="perm-2" className="font-normal cursor-pointer">Edit grades</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="perm-3" />
                  <Label htmlFor="perm-3" className="font-normal cursor-pointer">Manage attendance</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="perm-4" disabled />
                  <Label htmlFor="perm-4" className="font-normal cursor-pointer text-foreground/50">Delete records (disabled)</Label>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Radio Group */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Radio Group</h2>
            
            <Card className="p-6 max-w-2xl">
              <h3 className="font-semibold text-lg mb-4">Attendance Status</h3>
              <RadioGroup defaultValue="present">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="present" id="present" />
                  <Label htmlFor="present" className="font-normal cursor-pointer">Present</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="absent" id="absent" />
                  <Label htmlFor="absent" className="font-normal cursor-pointer">Absent</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="late" id="late" />
                  <Label htmlFor="late" className="font-normal cursor-pointer">Late</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="excused" id="excused" />
                  <Label htmlFor="excused" className="font-normal cursor-pointer">Excused</Label>
                </div>
              </RadioGroup>
            </Card>
          </div>
        </section>

        {/* Date Picker */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Date Picker</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Date of Birth</h3>
                <div>
                  <Label htmlFor="dob">Select Date</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input type="date" id="dob" />
                    <Calendar className="w-5 h-5 text-foreground/50" />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Date Range</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input type="date" id="start-date" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input type="date" id="end-date" className="mt-2" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Form Example */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Complete Form Example</h2>
            
            <Card className="p-8 max-w-2xl">
              <h3 className="text-xl font-bold mb-6">Add New Student</h3>
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fname">First Name</Label>
                    <Input id="fname" placeholder="First name" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="lname">Last Name</Label>
                    <Input id="lname" placeholder="Last name" className="mt-2" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="student@example.com" className="mt-2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grade">Grade</Label>
                    <Select>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select grade..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Grade 1</SelectItem>
                        <SelectItem value="2">Grade 2</SelectItem>
                        <SelectItem value="3">Grade 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dob-form">Date of Birth</Label>
                    <Input id="dob-form" type="date" className="mt-2" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" placeholder="Student bio..." className="mt-2" rows={3} />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="agree" />
                  <Label htmlFor="agree" className="font-normal cursor-pointer">I agree to the terms and conditions</Label>
                </div>

                <div className="flex gap-3">
                  <Button>Submit</Button>
                  <Button variant="outline">Cancel</Button>
                </div>
              </form>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>Form Components • 8 Components • Fully Accessible</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
