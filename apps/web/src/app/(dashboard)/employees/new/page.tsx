'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  employeeType: z.enum(['security_guard', 'armed_guard', 'supervisor', 'housekeeper', 'housekeeping_supervisor']),
  joiningDate: z.string(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankName: z.string().optional(),
  uanNumber: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewEmployeePage() {
  const router = useRouter()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { joiningDate: new Date().toISOString().split('T')[0] },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => api.post('/employees', data),
    onSuccess: () => router.push('/employees'),
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/employees" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-lg font-semibold text-gray-900">Add New Employee</h2>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-white rounded-xl border border-gray-200 p-6 space-y-8">
        {/* Personal Info */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name *" error={errors.name?.message}>
              <input {...register('name')} className="input" placeholder="Ramesh Kumar" />
            </Field>
            <Field label="Phone Number *" error={errors.phone?.message}>
              <input {...register('phone')} className="input" placeholder="9876543210" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register('email')} type="email" className="input" placeholder="ramesh@email.com" />
            </Field>
            <Field label="Date of Birth">
              <input {...register('dob')} type="date" className="input" />
            </Field>
            <Field label="Gender">
              <select {...register('gender')} className="input">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Employee Type *" error={errors.employeeType?.message}>
              <select {...register('employeeType')} className="input">
                <option value="">Select type</option>
                <option value="security_guard">Security Guard</option>
                <option value="armed_guard">Armed Guard</option>
                <option value="supervisor">Supervisor</option>
                <option value="housekeeper">Housekeeper</option>
                <option value="housekeeping_supervisor">Housekeeping Supervisor</option>
              </select>
            </Field>
            <Field label="Joining Date *" error={errors.joiningDate?.message}>
              <input {...register('joiningDate')} type="date" className="input" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Address">
              <textarea {...register('address')} rows={2} className="input" placeholder="Full residential address" />
            </Field>
          </div>
        </section>

        {/* Emergency Contact */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact Name">
              <input {...register('emergencyContactName')} className="input" placeholder="Father / Spouse name" />
            </Field>
            <Field label="Contact Phone">
              <input {...register('emergencyContactPhone')} className="input" placeholder="9876543210" />
            </Field>
          </div>
        </section>

        {/* Bank Details */}
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Bank & Statutory Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bank Name">
              <input {...register('bankName')} className="input" placeholder="SBI / HDFC / ICICI" />
            </Field>
            <Field label="Account Number">
              <input {...register('bankAccountNumber')} className="input" placeholder="XXXXXXXXXXXX" />
            </Field>
            <Field label="IFSC Code">
              <input {...register('bankIfsc')} className="input" placeholder="SBIN0001234" />
            </Field>
            <Field label="UAN Number">
              <input {...register('uanNumber')} className="input" placeholder="100XXXXXXXXX" />
            </Field>
          </div>
        </section>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            Failed to create employee. Please try again.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/employees">
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" loading={mutation.isPending}>
            Save Employee
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

// Tailwind input style injected via global CSS
