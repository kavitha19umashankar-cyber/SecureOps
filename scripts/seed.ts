/**
 * Seed script — creates super admin + one demo agency tenant with admin user.
 * Run: npx tsx scripts/seed.ts
 */
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../packages/db/src/schema/index.js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const DATABASE_URL = process.env['DATABASE_URL']
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env')
  process.exit(1)
}

const client = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(client, { schema })

async function hash(password: string) {
  return bcrypt.hash(password, 12)
}

async function seed() {
  console.log('🌱 Seeding SecureOps database...\n')

  // ── 1. Super Admin (no tenant) ──────────────────────────────────────────
  const existingSuperAdmin = await db.query.users.findFirst({
    where: eq(schema.users.role, 'super_admin'),
  })

  if (!existingSuperAdmin) {
    const [superAdmin] = await db.insert(schema.users).values({
      tenantId: null,
      role: 'super_admin',
      name: 'Super Admin',
      email: 'admin@secureops.in',
      passwordHash: await hash('Admin@123'),
      isActive: true,
    }).returning()
    console.log('✅ Super Admin created')
    console.log('   Email   : admin@secureops.in')
    console.log('   Password: Admin@123\n')
  } else {
    console.log('ℹ️  Super Admin already exists, skipping\n')
  }

  // ── 2. Demo Agency Tenant ───────────────────────────────────────────────
  const existingTenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.subdomain, 'quickguard'),
  })

  let tenantId: string

  if (!existingTenant) {
    const [tenant] = await db.insert(schema.tenants).values({
      name: 'QuickGuard Security Services',
      subdomain: 'quickguard',
      plan: 'trial',
      status: 'active',
      gstNumber: '27AABCU9603R1ZX',
      address: '101, Sector 12, Mumbai, Maharashtra 400001',
      contactEmail: 'ops@quickguard.in',
      contactPhone: '9876543210',
      maxEmployees: 200,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }).returning()
    tenantId = tenant!.id
    console.log('✅ Demo tenant created: QuickGuard Security Services')
    console.log(`   Subdomain: quickguard\n`)
  } else {
    tenantId = existingTenant.id
    console.log('ℹ️  Demo tenant already exists, skipping\n')
  }

  // ── 3. Agency Admin user ─────────────────────────────────────────────────
  const existingAdmin = await db.query.users.findFirst({
    where: eq(schema.users.email, 'admin@quickguard.in'),
  })

  if (!existingAdmin) {
    await db.insert(schema.users).values({
      tenantId,
      role: 'agency_admin',
      name: 'Rajesh Kumar',
      email: 'admin@quickguard.in',
      phone: '9876543210',
      passwordHash: await hash('Admin@123'),
      isActive: true,
    })
    console.log('✅ Agency Admin created')
    console.log('   Email   : admin@quickguard.in')
    console.log('   Password: Admin@123\n')
  } else {
    console.log('ℹ️  Agency Admin already exists, skipping\n')
  }

  // ── 4. HR Manager ────────────────────────────────────────────────────────
  const existingHR = await db.query.users.findFirst({
    where: eq(schema.users.email, 'hr@quickguard.in'),
  })

  if (!existingHR) {
    await db.insert(schema.users).values({
      tenantId,
      role: 'hr_manager',
      name: 'Priya Sharma',
      email: 'hr@quickguard.in',
      phone: '9876543211',
      passwordHash: await hash('Admin@123'),
      isActive: true,
    })
    console.log('✅ HR Manager created')
    console.log('   Email   : hr@quickguard.in')
    console.log('   Password: Admin@123\n')
  }

  // ── 5. Demo Client ────────────────────────────────────────────────────────
  const existingClient = await db.query.clients.findFirst({
    where: eq(schema.clients.contactEmail, 'facilities@infosysmock.in'),
  })

  let clientId: string

  if (!existingClient) {
    const [demoClient] = await db.insert(schema.clients).values({
      tenantId,
      name: 'Infosys Technologies (Demo)',
      gstNumber: '29AABCI1682H1ZN',
      billingAddress: 'Electronics City, Bengaluru, Karnataka 560100',
      billingState: 'Karnataka',
      contactEmail: 'facilities@infosysmock.in',
      contactPhone: '8012345678',
      contactPersonName: 'Arjun Nair',
      isActive: true,
      portalAccessEnabled: true,
    }).returning()
    clientId = demoClient!.id
    console.log('✅ Demo client created: Infosys Technologies (Demo)\n')
  } else {
    clientId = existingClient.id
    console.log('ℹ️  Demo client already exists, skipping\n')
  }

  // ── 6. Demo Site ──────────────────────────────────────────────────────────
  const existingSite = await db.query.sites.findFirst({
    where: eq(schema.sites.name, 'Infosys Gate 1 - Main Entrance'),
  })

  let siteId: string

  if (!existingSite) {
    const [site] = await db.insert(schema.sites).values({
      tenantId,
      clientId,
      name: 'Infosys Gate 1 - Main Entrance',
      address: 'Electronics City Phase 1, Bengaluru 560100',
      lat: 12.8441,
      lng: 77.6603,
      radiusMeters: 150,
      siteType: 'office',
      photoUrls: [],
      postOrders: 'Check all vehicles for gate passes. No unauthorized entry. Report suspicious activity immediately.',
      emergencyContacts: [
        { name: 'Security Control Room', phone: '080-12345678', role: 'Control Room' },
        { name: 'Site Manager - Arjun', phone: '9876500001', role: 'Site Manager' },
      ],
      photoCheckinIntervalMinutes: 120,
      isActive: true,
    }).returning()
    siteId = site!.id
    console.log('✅ Demo site created: Infosys Gate 1\n')
  } else {
    siteId = existingSite.id
    console.log('ℹ️  Demo site already exists, skipping\n')
  }

  // ── 7. Demo Contract ──────────────────────────────────────────────────────
  const existingContract = await db.query.contracts.findFirst({
    where: eq(schema.contracts.siteId, siteId),
  })

  if (!existingContract) {
    await db.insert(schema.contracts).values({
      tenantId,
      siteId,
      clientId,
      startDate: '2025-01-01',
      billingRatePerDay: '800.00',
      overtimeBillingRate: '150.00',
      currency: 'INR',
      requiredHeadcount: 3,
      agencyState: 'Karnataka',
      isActive: true,
    })
    console.log('✅ Contract created: ₹800/day per guard, 3 guards required\n')
  } else {
    console.log('ℹ️  Contract already exists, skipping\n')
  }

  // ── 8. Demo Employees ─────────────────────────────────────────────────────
  const guardEmails = ['guard1@quickguard.in', 'guard2@quickguard.in', 'guard3@quickguard.in']
  const guardData = [
    { name: 'Suresh Babu', phone: '9000000001', email: guardEmails[0]!, code: 'EMP-00001' },
    { name: 'Ravi Shankar', phone: '9000000002', email: guardEmails[1]!, code: 'EMP-00002' },
    { name: 'Anand Singh', phone: '9000000003', email: guardEmails[2]!, code: 'EMP-00003' },
  ]

  const employeeIds: string[] = []

  for (const g of guardData) {
    const existing = await db.query.employees.findFirst({
      where: eq(schema.employees.phone, g.phone),
    })

    if (!existing) {
      const [emp] = await db.insert(schema.employees).values({
        tenantId,
        employeeCode: g.code,
        name: g.name,
        phone: g.phone,
        email: g.email,
        employeeType: 'security_guard',
        status: 'active',
        joiningDate: '2024-06-01',
        skills: ['access_control', 'cctv_monitoring'],
        performanceScore: 85,
        backgroundVerificationStatus: 'cleared',
        bankAccountNumber: '12345678901',
        bankIfsc: 'SBIN0001234',
        bankName: 'State Bank of India',
      }).returning()
      employeeIds.push(emp!.id)

      // Create app user for this employee (for OTP login)
      await db.insert(schema.users).values({
        tenantId,
        role: 'employee',
        name: g.name,
        phone: g.phone,
        email: g.email,
        employeeId: emp!.id,
        isActive: true,
      })
    } else {
      employeeIds.push(existing.id)
    }
  }
  console.log('✅ 3 demo guards created (Suresh, Ravi, Anand)\n')

  // ── 9. Default Salary Structure ───────────────────────────────────────────
  const existingStructure = await db.query.salaryStructures.findFirst({
    where: eq(schema.salaryStructures.tenantId, tenantId),
  })

  if (!existingStructure) {
    await db.insert(schema.salaryStructures).values({
      tenantId,
      name: 'Standard Guard CTC',
      components: [
        { name: 'Basic', type: 'earning', calculationType: 'fixed', value: 8000, isStatutory: false },
        { name: 'HRA', type: 'earning', calculationType: 'percentage_of_basic', value: 0.4, isStatutory: false },
        { name: 'Conveyance', type: 'earning', calculationType: 'fixed', value: 1600, isStatutory: false },
        { name: 'Special Allowance', type: 'earning', calculationType: 'fixed', value: 2400, isStatutory: false },
        { name: 'PF Employee', type: 'deduction', calculationType: 'percentage_of_basic', value: 0.12, isStatutory: true },
        { name: 'ESI Employee', type: 'deduction', calculationType: 'percentage_of_gross', value: 0.0075, isStatutory: true },
        { name: 'Professional Tax', type: 'deduction', calculationType: 'fixed', value: 200, isStatutory: true },
      ],
    })
    console.log('✅ Default salary structure created: ₹14,000 CTC/month\n')
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('━'.repeat(50))
  console.log('🚀 Seed complete! You can now log in:\n')
  console.log('  Super Admin')
  console.log('  URL      : http://localhost:3000/login')
  console.log('  Email    : admin@secureops.in')
  console.log('  Password : Admin@123\n')
  console.log('  Agency Admin (QuickGuard)')
  console.log('  URL      : http://localhost:3000/login')
  console.log('  Email    : admin@quickguard.in')
  console.log('  Password : Admin@123\n')
  console.log('  HR Manager')
  console.log('  Email    : hr@quickguard.in')
  console.log('  Password : Admin@123\n')
  console.log('  Guard employees (OTP login via mobile):')
  console.log('  Phones   : 9000000001, 9000000002, 9000000003')
  console.log('  Agency code: quickguard')
  console.log('━'.repeat(50))

  await client.end()
}

seed().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
