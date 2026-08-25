import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  addChild,
  addParent,
  addPartner,
  addPerson,
  editPerson,
  getFamilyData,
  linkPartners,
  removePerson,
} from './family.server'

const emptyToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid')

const optionalDate = z.preprocess(emptyToNull, dateStr.nullable())

export const personInput = z
  .object({
    fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(200),
    gender: z.enum(['L', 'P', '-']).default('-'),
    birthDate: optionalDate,
    deathDate: optionalDate,
    photoUrl: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
    notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
  })
  .refine(
    (d) => !d.birthDate || !d.deathDate || d.deathDate >= d.birthDate,
    { message: 'Tanggal wafat tidak boleh sebelum tanggal lahir', path: ['deathDate'] },
  )

const idInput = z.object({ id: z.uuid('ID tidak valid') })

export type FamilyData = ReturnType<typeof getFamilyData> extends Promise<infer T>
  ? T
  : never

export const getFamily = createServerFn({ method: 'GET' }).handler(() => getFamilyData())

export const createPerson = createServerFn({ method: 'POST' })
  .validator(personInput)
  .handler(async ({ data }) => addPerson(data))

export const updatePerson = createServerFn({ method: 'POST' })
  .validator(personInput.extend({ id: z.uuid('ID tidak valid') }))
  .handler(async ({ data }) => {
    const { id, ...values } = data
    return editPerson(id, values)
  })

export const deletePerson = createServerFn({ method: 'POST' })
  .validator(idInput)
  .handler(async ({ data }) => {
    await removePerson(data.id)
    return { ok: true }
  })

const createChildInput = personInput.extend({
  parentIds: z
    .array(z.uuid('ID tidak valid'))
    .min(1, 'Minimal satu orangtua')
    .max(2, 'Seorang anak maksimal memiliki 2 orangtua'),
})

export const createChildOf = createServerFn({ method: 'POST' })
  .validator(createChildInput)
  .handler(async ({ data }) => {
    const { parentIds, ...personValues } = data
    return addChild(personValues, parentIds)
  })

const createParentInput = personInput.extend({
  childId: z.uuid('ID tidak valid'),
})

export const createParentOf = createServerFn({ method: 'POST' })
  .validator(createParentInput)
  .handler(async ({ data }) => {
    const { childId, ...personValues } = data
    return addParent(personValues, childId)
  })

const createPartnerInput = personInput
  .extend({
    personId: z.uuid('ID tidak valid'),
    status: z.enum(['menikah', 'cerai']).default('menikah'),
    marriedDate: z.preprocess(emptyToNull, dateStr.nullable()),
  })
  .refine(
    (d) => !d.marriedDate || !d.birthDate || d.marriedDate >= d.birthDate,
    { message: 'Tanggal menikah tidak boleh sebelum tanggal lahir', path: ['marriedDate'] },
  )

export const createPartnerOf = createServerFn({ method: 'POST' })
  .validator(createPartnerInput)
  .handler(async ({ data }) => {
    const { personId, status, marriedDate, ...personValues } = data
    return addPartner(personValues, personId, { status, marriedDate })
  })

const partnershipInput = z.object({
  aId: z.uuid('ID tidak valid'),
  bId: z.uuid('ID tidak valid'),
  status: z.enum(['menikah', 'cerai']).default('menikah'),
  marriedDate: z.preprocess(emptyToNull, dateStr.nullable()),
})

export const createPartnership = createServerFn({ method: 'POST' })
  .validator(partnershipInput)
  .handler(async ({ data }) => {
    await linkPartners(data.aId, data.bId, {
      status: data.status,
      marriedDate: data.marriedDate,
    })
    return { ok: true }
  })
