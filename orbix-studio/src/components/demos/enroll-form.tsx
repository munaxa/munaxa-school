'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Enter a valid email.'),
  grade: z
    .string()
    .min(1, 'Grade is required.')
    .regex(/^\d{1,2}$/, 'Grade must be a number.'),
});

type FormValues = z.infer<typeof schema>;

export function EnrollForm() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', grade: '' },
  });

  async function onSubmit(values: FormValues) {
    await new Promise((r) => setTimeout(r, 600));
    void values;
    setDone(true);
    reset();
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="f-name">Full name</Label>
        <Input id="f-name" placeholder="Lina Haddad" {...register('name')} />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="f-email">Email</Label>
        <Input id="f-email" placeholder="guardian@example.com" {...register('email')} />
        {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="f-grade">Grade</Label>
        <Input id="f-grade" placeholder="9" {...register('grade')} />
        {errors.grade && <p className="text-destructive text-xs">{errors.grade.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {done ? (
          <>
            <Check /> Enrolled
          </>
        ) : isSubmitting ? (
          'Submitting…'
        ) : (
          'Enroll student'
        )}
      </Button>
    </form>
  );
}
