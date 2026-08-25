// Helper khusus server: akses DB + validasi relasi.
// Jangan diimpor dari kode client — dipakai oleh src/lib/family.ts.
import { eq, inArray } from 'drizzle-orm'

import { db } from '#/db'
import {
  persons,
  parentLinks,
  partnerships,
  type ParentLink,
  type Partnership,
  type Person,
} from '#/db/schema'

export type FamilyData = {
  persons: Person[]
  parentLinks: ParentLink[]
  partnerships: Partnership[]
}

export async function getFamilyData(): Promise<FamilyData> {
  const [p, pl, ps] = await Promise.all([
    db.select().from(persons),
    db.select().from(parentLinks),
    db.select().from(partnerships),
  ])
  return { persons: p, parentLinks: pl, partnerships: ps }
}

export async function addPerson(values: typeof persons.$inferInsert): Promise<Person> {
  const [created] = await db.insert(persons).values(values).returning()
  return created
}

export async function editPerson(id: string, values: typeof persons.$inferInsert): Promise<Person> {
  const [updated] = await db
    .update(persons)
    .set(values)
    .where(eq(persons.id, id))
    .returning()
  if (!updated) throw new Error('Anggota keluarga tidak ditemukan')
  return updated
}

export async function removePerson(id: string): Promise<void> {
  // FK cascade menghapus parent_links & partnerships yang menautkan ke dia
  await db.delete(persons).where(eq(persons.id, id))
}

export async function addChild(
  personValues: typeof persons.$inferInsert,
  parentIds: string[],
): Promise<Person> {
  if (new Set(parentIds).size !== parentIds.length) {
    throw new Error('Orangtua tidak boleh sama')
  }
  if (parentIds.length > 2) {
    throw new Error('Seorang anak maksimal memiliki 2 orangtua')
  }
  const found = await db
    .select({ id: persons.id })
    .from(persons)
    .where(inArray(persons.id, parentIds))
  if (found.length !== parentIds.length) {
    throw new Error('Orangtua tidak ditemukan')
  }
  const child = await addPerson(personValues)
  await db
    .insert(parentLinks)
    .values(parentIds.map((parentId) => ({ parentId, childId: child.id })))
  return child
}

export async function addParent(
  personValues: typeof persons.$inferInsert,
  childId: string,
): Promise<Person> {
  const [child] = await db.select().from(persons).where(eq(persons.id, childId))
  if (!child) throw new Error('Anak tidak ditemukan')
  const existing = await db
    .select({ id: parentLinks.id })
    .from(parentLinks)
    .where(eq(parentLinks.childId, childId))
  if (existing.length >= 2) {
    throw new Error(`${child.fullName} sudah memiliki 2 orangtua`)
  }
  const parent = await addPerson(personValues)
  await db.insert(parentLinks).values({ parentId: parent.id, childId })
  return parent
}

export async function addPartner(
  personValues: typeof persons.$inferInsert,
  anchorId: string,
  relation: { status: string; marriedDate?: string | null },
): Promise<Person> {
  const [anchor] = await db.select().from(persons).where(eq(persons.id, anchorId))
  if (!anchor) throw new Error('Anggota keluarga tidak ditemukan')
  const partner = await addPerson(personValues)
  await db.insert(partnerships).values({
    partnerAId: anchorId,
    partnerBId: partner.id,
    status: relation.status,
    marriedDate: relation.marriedDate ?? null,
  })
  return partner
}
