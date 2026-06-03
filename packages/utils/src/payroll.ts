export interface PayrollInput {
  ctcMonthly: number
  basicPercent: number      // e.g. 0.5 = 50% of CTC
  hraPercent: number        // e.g. 0.2 = 20% of basic
  conveyanceFixed: number
  totalWorkingDays: number
  daysPresent: number
  lopDays: number
  overtimeHours: number
  overtimeMultiplier: number // 1.5 or 2.0
  pfApplicable: boolean
  esiApplicable: boolean
  professionalTaxMonthly: number
  advanceDeduction: number
  otherDeductions: number
}

export interface PayrollOutput {
  basicSalary: number
  hra: number
  conveyance: number
  otherEarnings: number
  grossEarnings: number
  overtimePay: number
  pfEmployee: number
  pfEmployer: number
  esi: number
  professionalTax: number
  advanceDeduction: number
  otherDeductions: number
  totalDeductions: number
  netSalary: number
  effectiveDays: number
}

const PF_EMPLOYEE_RATE = 0.12
const PF_EMPLOYER_RATE = 0.12
const PF_WAGE_CEILING = 15000  // PF calculated on max ₹15,000 basic
const ESI_EMPLOYEE_RATE = 0.0075
const ESI_EMPLOYER_RATE = 0.0325
const ESI_WAGE_CEILING = 21000  // ESI applicable only if gross <= ₹21,000

export function computePayroll(input: PayrollInput): PayrollOutput {
  const {
    ctcMonthly,
    basicPercent,
    hraPercent,
    conveyanceFixed,
    totalWorkingDays,
    daysPresent,
    lopDays,
    overtimeHours,
    overtimeMultiplier,
    pfApplicable,
    esiApplicable,
    professionalTaxMonthly,
    advanceDeduction,
    otherDeductions,
  } = input

  const effectiveDays = daysPresent - lopDays
  const attendanceRatio = effectiveDays / totalWorkingDays

  const fullBasic = ctcMonthly * basicPercent
  const basic = fullBasic * attendanceRatio

  const fullHra = fullBasic * hraPercent
  const hra = fullHra * attendanceRatio

  const conveyance = conveyanceFixed * attendanceRatio

  const otherEarnings =
    (ctcMonthly - fullBasic - fullHra - conveyanceFixed) * attendanceRatio

  const perHourRate = fullBasic / (totalWorkingDays * 8)
  const overtimePay = overtimeHours * perHourRate * overtimeMultiplier

  const grossEarnings = basic + hra + conveyance + otherEarnings + overtimePay

  // PF is on basic (capped at ₹15,000)
  const pfWage = Math.min(basic, PF_WAGE_CEILING)
  const pfEmployee = pfApplicable ? pfWage * PF_EMPLOYEE_RATE : 0
  const pfEmployer = pfApplicable ? pfWage * PF_EMPLOYER_RATE : 0

  // ESI is on gross (only if gross <= ₹21,000)
  const esi =
    esiApplicable && grossEarnings <= ESI_WAGE_CEILING
      ? grossEarnings * ESI_EMPLOYEE_RATE
      : 0

  const totalDeductions =
    pfEmployee + esi + professionalTaxMonthly + advanceDeduction + otherDeductions

  const netSalary = grossEarnings - totalDeductions

  return {
    basicSalary: round2(basic),
    hra: round2(hra),
    conveyance: round2(conveyance),
    otherEarnings: round2(otherEarnings),
    grossEarnings: round2(grossEarnings),
    overtimePay: round2(overtimePay),
    pfEmployee: round2(pfEmployee),
    pfEmployer: round2(pfEmployer),
    esi: round2(esi),
    professionalTax: professionalTaxMonthly,
    advanceDeduction,
    otherDeductions,
    totalDeductions: round2(totalDeductions),
    netSalary: round2(netSalary),
    effectiveDays,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
