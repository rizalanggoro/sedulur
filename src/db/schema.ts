import { pgTable, uuid, text, date, timestamp, unique } from 'drizzle-orm/pg-core'

export const persons = pgTable('persons', {
  id: uuid().primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  gender: text().notNull().default('-'),
  birthDate: date('birth_date'),
  deathDate: date('death_date'),
  photoUrl: text('photo_url'),
  notes: text(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const parentLinks = pgTable(
  'parent_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
  },
  (t) => [unique('parent_links_parent_child_unique').on(t.parentId, t.childId)],
)

export const partnerships = pgTable('partnerships', {
  id: uuid().primaryKey().defaultRandom(),
  partnerAId: uuid('partner_a_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  partnerBId: uuid('partner_b_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  status: text().notNull().default('menikah'),
  marriedDate: date('married_date'),
})

export type Person = typeof persons.$inferSelect
export type ParentLink = typeof parentLinks.$inferSelect
export type Partnership = typeof partnerships.$inferSelect
