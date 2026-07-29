import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RTL() {
  return (
    <Layout currentPage="/rtl">
      <div className="min-h-full bg-background">
        {/* Header */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">RTL & Arabic Support</h1>
            <p className="text-lg text-foreground/70">
              MUNAXA supports right-to-left languages like Arabic. All
              components are fully mirrored and optimized for RTL layouts.
            </p>
          </div>
        </section>

        {/* RTL Overview */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">RTL Implementation</h2>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-3 text-foreground">
                  How to Enable RTL
                </h3>
                <p className="text-foreground/70 mb-4">
                  Add the{" "}
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    dir="rtl"
                  </code>{" "}
                  attribute to the HTML element or any container:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm text-foreground/70">
                  &lt;html dir="rtl"&gt; ... &lt;/html&gt;
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-3 text-foreground">
                  Automatic Mirroring
                </h3>
                <p className="text-foreground/70">
                  When RTL is enabled, the following are automatically mirrored:
                </p>
                <ul className="space-y-2 text-foreground/70 text-sm mt-3">
                  <li>✓ Layout direction (left ↔ right)</li>
                  <li>✓ Padding and margin (left ↔ right)</li>
                  <li>✓ Icon alignment</li>
                  <li>✓ Text alignment</li>
                  <li>✓ Sidebar position</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Arabic Text Example */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Arabic Text Example</h2>

            <Card className="p-8" dir="rtl">
              <h3 className="text-2xl font-bold mb-4">
                مرحبا بك في نظام MUNAXA
              </h3>
              <p className="text-foreground/70 mb-6">
                نظام MUNAXA هو نظام تشغيل موحد للمدارس. يجمع بين الطلاب
                والمعلمين والمالية والاتصالات وأكثر من ذلك في منصة واحدة سلسة.
              </p>
              <div className="space-y-3">
                <p className="font-semibold text-foreground">
                  المميزات الرئيسية:
                </p>
                <ul className="space-y-2 text-foreground/70 text-sm">
                  <li>• إدارة الطلاب والمعلمين</li>
                  <li>• تتبع الحضور</li>
                  <li>• إدارة المالية</li>
                  <li>• التواصل الموحد</li>
                  <li>• إدارة النقل</li>
                </ul>
              </div>
            </Card>
          </div>
        </section>

        {/* RTL Form Example */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">RTL Form Example</h2>

            <Card className="p-8" dir="rtl">
              <h3 className="text-xl font-bold mb-6 text-foreground">
                نموذج التسجيل
              </h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="ar-name">الاسم الكامل</Label>
                  <Input
                    id="ar-name"
                    placeholder="أدخل اسمك الكامل"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="ar-email">البريد الإلكتروني</Label>
                  <Input
                    id="ar-email"
                    type="email"
                    placeholder="أدخل بريدك الإلكتروني"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="ar-phone">رقم الهاتف</Label>
                  <Input
                    id="ar-phone"
                    placeholder="أدخل رقم هاتفك"
                    className="mt-2"
                  />
                </div>
                <div className="flex gap-3 justify-start">
                  <Button>إرسال</Button>
                  <Button variant="outline">إلغاء</Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Typography in RTL */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Typography in RTL</h2>

            <div className="space-y-6" dir="rtl">
              <Card className="p-6">
                <h3 className="text-3xl font-bold mb-2">عنوان رئيسي</h3>
                <p className="text-foreground/70 text-sm">Display LG 48px</p>
              </Card>

              <Card className="p-6">
                <h3 className="text-2xl font-bold mb-2">عنوان فرعي</h3>
                <p className="text-foreground/70 text-sm">H2 32px</p>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold mb-2">نص عادي</h3>
                <p className="text-foreground/70 text-sm">
                  هذا نص عادي بحجم 16px. يجب أن يكون سهل القراءة والفهم في كل من
                  الاتجاهات من اليسار إلى اليمين ومن اليمين إلى اليسار.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* RTL Components */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">RTL Components</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6" dir="rtl">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  الأزرار
                </h3>
                <div className="space-y-3">
                  <Button className="w-full">زر أساسي</Button>
                  <Button variant="outline" className="w-full">
                    زر ثانوي
                  </Button>
                  <Button variant="destructive" className="w-full">
                    حذف
                  </Button>
                </div>
              </Card>

              <Card className="p-6" dir="rtl">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  البطاقات
                </h3>
                <div className="space-y-3">
                  <Card className="p-4 bg-accent/50 border-primary/50">
                    <p className="font-semibold mb-1">عنوان البطاقة</p>
                    <p className="text-sm text-foreground/70">
                      وصف محتوى البطاقة
                    </p>
                  </Card>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* RTL Guidelines */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">RTL Guidelines</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 text-foreground">
                  ✓ Do
                </h3>
                <ul className="space-y-3 text-foreground/70 text-sm">
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use proper dir attribute
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Test with Arabic text
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Mirror layouts properly
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Use Cairo for Arabic text
                  </li>
                  <li className="flex gap-2">
                    <span className="text-success">✓</span>
                    Test icon alignment
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
                    Use hardcoded left/right
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Forget to mirror icons
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use unsupported fonts
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Ignore text direction
                  </li>
                  <li className="flex gap-2">
                    <span className="text-error">✗</span>
                    Use CSS transforms for RTL
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Font Support */}
        <section className="px-6 py-12 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Font Support</h2>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 text-foreground">
                Cairo (Arabic / RTL)
              </h3>
              <p className="text-foreground/70 mb-4">
                In RTL/Arabic, both display and body type resolve to Cairo — the
                website&apos;s Sora and Inter families lack Arabic glyphs.
              </p>
              <div className="p-4 bg-muted rounded-lg" dir="rtl">
                <p className="font-semibold mb-2">نموذج على خط Cairo</p>
                <p className="text-sm text-foreground/70">
                  هذا النص مكتوب بخط Cairo الذي يوفر قراءة واضحة وسهلة باللغة
                  العربية.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <section className="px-6 py-12 bg-card/50 border-t border-border">
          <div className="max-w-6xl mx-auto text-center text-foreground/60 text-sm">
            <p>
              MUNAXA supports both LTR and RTL languages with full feature
              parity.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
