import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, ilike, count } from 'drizzle-orm'
import { getDb, employees, employeeDocuments } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { generateEmployeeCode } from '@secureops/utils'
import { uploadFile, fileUrl } from '../lib/storage.js'
import { notFound, forbidden, badRequest } from '../lib/errors.js'
import { writeAuditLog } from '../lib/audit.js'

const createEmployeeSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  employeeType: z.enum([
    'security_guard', 'armed_guard', 'supervisor', 'housekeeper', 'housekeeping_supervisor',
  ]),
  joiningDate: z.string(),
  skills: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankName: z.string().optional(),
  uanNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  salaryStructureId: z.string().uuid().optional(),
})

const AGENCY_ROLES = [
  UserRole.AGENCY_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SUPER_ADMIN,
]

export const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // List employees
  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (!AGENCY_ROLES.includes(role as UserRole)) forbidden()

    const query = req.query as { page?: string; pageSize?: string; search?: string; status?: string }
    const page = Number(query.page ?? 1)
    const pageSize = Math.min(Number(query.pageSize ?? 20), 100)
    const offset = (page - 1) * pageSize

    const whereConditions = [eq(employees.tenantId, tenantId)]
    if (query.search) {
      whereConditions.push(ilike(employees.name, `%${query.search}%`))
    }
    if (query.status) {
      whereConditions.push(eq(employees.status, query.status as 'active' | 'on_leave' | 'suspended' | 'terminated'))
    }

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(employees).where(and(...whereConditions)).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(employees).where(and(...whereConditions)),
    ])

    return {
      success: true,
      data: {
        items: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

  // Get single employee
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, sub } = req.user
    const { id } = req.params as { id: string }

    const employee = await db.query.employees.findFirst({
      where: and(eq(employees.id, id), eq(employees.tenantId, tenantId)),
    })
    if (!employee) notFound('Employee')

    // Employees can only view their own record
    if (role === UserRole.EMPLOYEE && employee!.id !== req.user.employeeId) {
      forbidden()
    }

    return { success: true, data: employee }
  })

  // Create employee
  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role, sub } = req.user
    if (![UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN].includes(role as UserRole)) {
      forbidden()
    }

    const body = createEmployeeSchema.parse(req.body)

    // Generate sequential code
    const [{ total }] = await db.select({ total: count() }).from(employees).where(eq(employees.tenantId, tenantId))
    const code = generateEmployeeCode(total + 1)

    const [created] = await db.insert(employees).values({
      tenantId,
      employeeCode: code,
      name: body.name,
      phone: body.phone,
      email: body.email,
      dob: body.dob,
      gender: body.gender,
      address: body.address,
      employeeType: body.employeeType,
      joiningDate: body.joiningDate,
      skills: body.skills ?? [],
      emergencyContactName: body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhone,
      bankAccountNumber: body.bankAccountNumber,
      bankIfsc: body.bankIfsc,
      bankName: body.bankName,
      uanNumber: body.uanNumber,
      esiNumber: body.esiNumber,
      salaryStructureId: body.salaryStructureId,
    }).returning()

    await writeAuditLog(db, {
      tenantId,
      userId: sub,
      action: 'INSERT',
      tableName: 'employees',
      recordId: created!.id,
      newValues: body,
      ipAddress: req.ip,
    })

    return reply.status(201).send({ success: true, data: created })
  })

  // Update employee
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role, sub } = req.user
    if (![UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN].includes(role as UserRole)) {
      forbidden()
    }

    const { id } = req.params as { id: string }
    const existing = await db.query.employees.findFirst({
      where: and(eq(employees.id, id), eq(employees.tenantId, tenantId)),
    })
    if (!existing) notFound('Employee')

    const body = createEmployeeSchema.partial().parse(req.body)
    const [updated] = await db.update(employees).set({ ...body, updatedAt: new Date() })
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
      .returning()

    await writeAuditLog(db, {
      tenantId,
      userId: sub,
      action: 'UPDATE',
      tableName: 'employees',
      recordId: id,
      oldValues: existing,
      newValues: body,
      ipAddress: req.ip,
    })

    return reply.send({ success: true, data: updated })
  })

  // Upload employee document
  fastify.post('/:id/documents', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role, sub } = req.user
    const { id } = req.params as { id: string }

    const isOwnRecord = role === UserRole.EMPLOYEE && req.user.employeeId === id
    const isHR = [UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN].includes(role as UserRole)
    if (!isOwnRecord && !isHR) forbidden()

    const employee = await db.query.employees.findFirst({
      where: and(eq(employees.id, id), eq(employees.tenantId, tenantId)),
    })
    if (!employee) notFound('Employee')

    const data = await req.file()
    if (!data) badRequest('No file uploaded')

    const docType = req.query as { docType: string; expiryDate?: string }

    const validDocTypes = [
      'aadhaar', 'pan', 'passport', 'driving_license', 'voter_id',
      'police_verification', 'security_license', 'educational_certificate',
      'training_certificate', 'medical_certificate', 'employment_contract', 'bank_passbook',
    ]
    if (!validDocTypes.includes(docType.docType)) badRequest('Invalid document type')

    const buffer = await data!.toBuffer()
    const key = await uploadFile(tenantId, `employees/${id}/docs`, data!.filename, buffer, data!.mimetype)

    const [doc] = await db.insert(employeeDocuments).values({
      employeeId: id,
      tenantId,
      docType: docType.docType as 'aadhaar',
      fileUrl: key,
      fileName: data!.filename,
      fileSize: buffer.length,
      expiryDate: docType.expiryDate,
    }).returning()

    return reply.status(201).send({ success: true, data: { ...doc, fileUrl: fileUrl(key) } })
  })

  // List employee documents
  fastify.get('/:id/documents', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    const { id } = req.params as { id: string }

    const isOwnRecord = role === UserRole.EMPLOYEE && req.user.employeeId === id
    const isStaff = AGENCY_ROLES.includes(role as UserRole)
    if (!isOwnRecord && !isStaff) forbidden()

    const docs = await db.select().from(employeeDocuments)
      .where(and(eq(employeeDocuments.employeeId, id), eq(employeeDocuments.tenantId, tenantId)))

    return { success: true, data: docs.map((d) => ({ ...d, fileUrl: fileUrl(d.fileUrl) })) }
  })

  // Verify / reject a document (HR only)
  fastify.patch('/documents/:docId/status', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, sub } = req.user
    if (![UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN].includes(role as UserRole)) {
      forbidden()
    }

    const { docId } = req.params as { docId: string }
    const { status, rejectionReason } = z.object({
      status: z.enum(['verified', 'rejected']),
      rejectionReason: z.string().optional(),
    }).parse(req.body)

    const [updated] = await db.update(employeeDocuments)
      .set({
        status,
        verifiedBy: sub,
        verifiedAt: new Date(),
        rejectionReason: status === 'rejected' ? rejectionReason : null,
      })
      .where(and(eq(employeeDocuments.id, docId), eq(employeeDocuments.tenantId, tenantId)))
      .returning()

    if (!updated) notFound('Document')

    return { success: true, data: updated }
  })
}
