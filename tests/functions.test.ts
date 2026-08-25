import assert from 'node:assert'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

const mod = await import('../src/lib/family.server')

const created: string[] = []
async function track<T extends { id: string }>(p: Promise<T>): Promise<T> {
  const person = await p
  created.push(person.id)
  return person
}

try {
  // Validasi input person
  const kakek = await track(
    mod.addPerson({
      fullName: 'Uji Kakek',
      gender: 'L',
      birthDate: '1940-05-01',
      deathDate: null,
      photoUrl: null,
      notes: null,
    }),
  )
  const nenek = await track(
    mod.addPerson({ fullName: 'Uji Nenek', gender: 'P' }),
  )

  // Anak dari dua orangtua
  const anak = await track(mod.addChild({ fullName: 'Uji Anak' }, [kakek.id, nenek.id]))
  const family1 = await mod.getFamilyData()
  assert.equal(
    family1.parentLinks.filter((l) => l.childId === anak.id).length,
    2,
    'anak tepat punya 2 orangtua',
  )

  // Batas 2 orangtua ditolak saat menambah orangtua ketiga
  await assert.rejects(
    () => mod.addParent({ fullName: 'Orangtua Ketiga' }, anak.id),
    /sudah memiliki 2 orangtua/,
  )

  // Orangtua tidak dikenal ditolak
  await assert.rejects(
    () =>
      mod.addChild({ fullName: 'Y' }, ['00000000-0000-0000-0000-000000000000']),
    /tidak ditemukan/,
  )
  await assert.rejects(
    () => mod.editPerson('00000000-0000-0000-0000-000000000000', { fullName: 'Hantu' }),
    /tidak ditemukan/,
  )

  // Pasangan (cerai) + tanggal menikah tersimpan
  const mantan = await track(
    mod.addPartner({ fullName: 'Uji Mantan' }, anak.id, {
      status: 'cerai',
      marriedDate: '2020-01-01',
    }),
  )
  const family2 = await mod.getFamilyData()
  const ps = family2.partnerships.find((p) => p.partnerBId === mantan.id)
  assert.equal(ps?.status, 'cerai')
  assert.equal(ps?.marriedDate, '2020-01-01')

  // Validasi penautan pasangan existing
  await assert.rejects(
    () => mod.linkPartners(anak.id, anak.id, { status: 'menikah' }),
    /dirinya sendiri/,
  )
  await assert.rejects(
    () => mod.linkPartners(anak.id, mantan.id, { status: 'menikah' }),
    /sudah terdaftar sebagai pasangan/,
  )
  await assert.rejects(
    () => mod.linkPartners(mantan.id, anak.id, { status: 'menikah' }),
    /sudah terdaftar sebagai pasangan/,
    'duplikasi terdeteksi walau urutan dibalik',
  )

  // Hapus kakek → parent link cascade terhapus
  await mod.removePerson(kakek.id)
  created.splice(created.indexOf(kakek.id), 1)
  const family3 = await mod.getFamilyData()
  assert.ok(!family3.persons.some((p) => p.id === kakek.id))
  assert.ok(
    !family3.parentLinks.some((l) => l.parentId === kakek.id || l.childId === kakek.id),
    'relasi kakek ikut terhapus',
  )

  console.log('server functions OK')
} finally {
  for (const id of created) {
    try {
      await mod.removePerson(id)
    } catch {}
  }
}
