// Helper khusus server: akses DB + validasi relasi.
// Jangan diimpor dari kode client — dipakai oleh src/lib/family.ts.
import { eq, inArray, or } from 'drizzle-orm'

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
  // ORDER BY stabil agar structural sharing TanStack Query bekerja
  // (data identik → referensi sama → tidak memicu render ulang sia-sia)
  const [p, pl, ps] = await Promise.all([
    db.select().from(persons).orderBy(persons.createdAt, persons.id),
    db.select().from(parentLinks).orderBy(parentLinks.id),
    db.select().from(partnerships).orderBy(partnerships.id),
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

/** Tautkan orangtua EXISTING ke anak (mis. istri ayah pada anak lahir sebelum menikah). */
export async function linkParent(parentId: string, childId: string): Promise<void> {
  if (parentId === childId) {
    throw new Error('Tidak bisa menjadi orangtua dirinya sendiri')
  }
  const found = await db
    .select()
    .from(persons)
    .where(inArray(persons.id, [parentId, childId]))
  if (found.length !== 2) throw new Error('Anggota keluarga tidak ditemukan')
  const child = found.find((f) => f.id === childId)!

  const existing = await db
    .select()
    .from(parentLinks)
    .where(eq(parentLinks.childId, childId))
  if (existing.some((l) => l.parentId === parentId)) {
    throw new Error('Sudah terdaftar sebagai orangtua anak ini')
  }
  if (existing.length >= 2) {
    throw new Error(`${child.fullName} sudah memiliki 2 orangtua`)
  }
  // Anti-siklus: parentId tidak boleh merupakan KETURUNAN childId
  // (menautkan anak/cucu sebagai orangtua = siklus).
  const seen = new Set<string>([childId])
  const frontier = [childId]
  while (frontier.length > 0) {
    const cur = frontier.pop()!
    const links = await db
      .select()
      .from(parentLinks)
      .where(eq(parentLinks.parentId, cur))
    for (const l of links) {
      if (l.childId === parentId) {
        throw new Error('Tidak boleh ada siklus dalam silsilah')
      }
      if (!seen.has(l.childId)) {
        seen.add(l.childId)
        frontier.push(l.childId)
      }
    }
  }
  await db.insert(parentLinks).values({ parentId, childId })
}

export async function linkPartners(
  aId: string,
  bId: string,
  relation: { status: string; marriedDate?: string | null },
): Promise<void> {
  if (aId === bId) {
    throw new Error('Tidak bisa menjadi pasangan dirinya sendiri')
  }
  const found = await db
    .select({ id: persons.id })
    .from(persons)
    .where(inArray(persons.id, [aId, bId]))
  if (found.length !== 2) {
    throw new Error('Anggota keluarga tidak ditemukan')
  }
  const existing = await db
    .select()
    .from(partnerships)
    .where(or(eq(partnerships.partnerAId, aId), eq(partnerships.partnerBId, aId)))
  const dup = existing.some(
    (ps) =>
      (ps.partnerAId === aId && ps.partnerBId === bId) ||
      (ps.partnerAId === bId && ps.partnerBId === aId),
  )
  if (dup) {
    throw new Error('Keduanya sudah terdaftar sebagai pasangan')
  }
  await db.insert(partnerships).values({
    partnerAId: aId,
    partnerBId: bId,
    status: relation.status,
    marriedDate: relation.marriedDate ?? null,
  })
}

export async function addPartner(
  personValues: typeof persons.$inferInsert,
  anchorId: string,
  relation: { status: string; marriedDate?: string | null },
): Promise<Person> {
  const [anchor] = await db.select().from(persons).where(eq(persons.id, anchorId))
  if (!anchor) throw new Error('Anggota keluarga tidak ditemukan')
  const partner = await addPerson(personValues)
  await linkPartners(anchorId, partner.id, relation)
  return partner
}
