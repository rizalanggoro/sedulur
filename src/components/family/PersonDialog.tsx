import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'

import {
  createChildOf,
  createParentOf,
  createPartnership,
  createPartnerOf,
  createPerson,
  deletePerson,
  updatePerson,
} from '#/lib/family'
import type { Person } from '#/db/schema'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/components/ui/combobox'

export type DialogRelation = {
  kind: 'child' | 'parent' | 'partner'
  person: Person
  /** Untuk kind 'child': orangtua lain (pasangan) yang ikut ditautkan. */
  parentIds?: string[]
}

export type PersonDialogState =
  | { mode: 'create'; relation?: DialogRelation }
  | { mode: 'edit'; person: Person }
  | null

function errorMessage(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e)
  // Error validasi zod terserialisasi sebagai daftar issue JSON
  if (raw.trim().startsWith('[')) return 'Data tidak valid, periksa kembali isian.'
  return raw
}

const emptyForm = {
  fullName: '',
  gender: '-' as '-' | 'L' | 'P',
  birthDate: '',
  deathDate: '',
  photoUrl: '',
  notes: '',
}

export function PersonDialog({
  state,
  persons = [],
  onClose,
}: {
  state: NonNullable<PersonDialogState>
  persons?: Person[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(() => {
    if (state.mode !== 'edit') return emptyForm
    const p = state.person
    return {
      fullName: p.fullName,
      gender: (p.gender as typeof emptyForm.gender) ?? '-',
      birthDate: p.birthDate ?? '',
      deathDate: p.deathDate ?? '',
      photoUrl: p.photoUrl ?? '',
      notes: p.notes ?? '',
    }
  })
  const [status, setStatus] = useState<'menikah' | 'cerai'>('menikah')
  const [marriedDate, setMarriedDate] = useState('')
  // 'child': orangtua kedua (existing); 'partner': '' = buat baru, selain itu id anggota existing
  const [secondParent, setSecondParent] = useState('')
  const [existingPartner, setExistingPartner] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => setErr(null), [form])

  const invalidateThenClose = () => {
    void qc.invalidateQueries({ queryKey: ['family'] })
    onClose()
  }

  const relation = state.mode === 'create' ? state.relation : undefined
  const isEdit = state.mode === 'edit'

  // Default orangtua kedua: pasangan dari node yang diklik.
  useEffect(() => {
    if (relation?.kind === 'child') {
      setSecondParent(relation.parentIds?.[1] ?? '')
    }
  }, [])
  useEffect(() => setErr(null), [form, secondParent, existingPartner])

  const save = useMutation({
    mutationFn: async () => {
      if (state.mode === 'edit') {
        await updatePerson({ data: { id: state.person.id, ...form } })
        return
      }
      if (!relation) {
        await createPerson({ data: form })
        return
      }
      if (relation.kind === 'child') {
        const parentIds = [
          relation.person.id,
          ...(secondParent ? [secondParent] : []),
        ]
        await createChildOf({ data: { ...form, parentIds } })
        return
      }
      if (relation.kind === 'parent') {
        await createParentOf({ data: { ...form, childId: relation.person.id } })
        return
      }
      if (existingPartner) {
        await createPartnership({
          data: { aId: relation.person.id, bId: existingPartner, status, marriedDate },
        })
        return
      }
      await createPartnerOf({
        data: { ...form, personId: relation.person.id, status, marriedDate },
      })
    },
    onSuccess: invalidateThenClose,
    onError: (e) => setErr(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: () => deletePerson({ data: { id: (state as { person: Person }).person.id } }),
    onSuccess: invalidateThenClose,
    onError: (e) => setErr(errorMessage(e)),
  })

  // "Tambah Anak" pada node berpasangan otomatis menautkan kedua orangtua.
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (
      form.birthDate &&
      form.deathDate &&
      form.deathDate < form.birthDate
    ) {
      setErr('Tanggal wafat tidak boleh sebelum tanggal lahir')
      return
    }
    save.mutate()
  }

  const title = isEdit
    ? 'Ubah Anggota Keluarga'
    : relation
      ? relation.kind === 'child'
        ? `Tambah Anak dari ${relation.person.fullName}`
        : relation.kind === 'parent'
          ? `Tambah Orangtua dari ${relation.person.fullName}`
          : `Tambah Pasangan untuk ${relation.person.fullName}`
      : 'Tambah Anggota Keluarga'

  return (
    <Dialog open modal={false} onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <div className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs" aria-hidden="true" />
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Perbarui data anggota keluarga ini.'
              : 'Lengkapi data anggota keluarga baru.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          {relation?.kind === 'child' && (
            <div className="grid gap-2">
              <Label>Orangtua Kedua (opsional)</Label>
              <Combobox
                items={['', ...persons.filter((p) => p.id !== relation.person.id).map((p) => p.id)]}
                value={secondParent}
                onValueChange={(v) => setSecondParent(v ?? '')}
                itemToStringLabel={(id) =>
                  id === '' ? 'Tidak ada' : persons.find((p) => p.id === id)?.fullName ?? ''
                }
              >
                <ComboboxInput placeholder="Cari nama…" />
                <ComboboxContent>
                  <ComboboxEmpty>Tidak ditemukan.</ComboboxEmpty>
                  <ComboboxList>
                    {(id: string) => (
                      <ComboboxItem key={id} value={id}>
                        {id === '' ? '— Tidak ada —' : persons.find((p) => p.id === id)?.fullName}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                Pilih pasangan dari {relation.person.fullName} agar anak tertaut ke
                ayah &amp; ibu sekaligus.
              </p>
            </div>
          )}

          {relation?.kind === 'partner' && (
            <div className="grid gap-2">
              <Label>Pasangan</Label>
              <Combobox
                items={['', ...persons.filter((p) => p.id !== relation.person.id).map((p) => p.id)]}
                value={existingPartner}
                onValueChange={(v) => setExistingPartner(v ?? '')}
                itemToStringLabel={(id) =>
                  id === '' ? 'Buat anggota baru' : persons.find((p) => p.id === id)?.fullName ?? ''
                }
              >
                <ComboboxInput placeholder="Cari nama…" />
                <ComboboxContent>
                  <ComboboxEmpty>Tidak ditemukan.</ComboboxEmpty>
                  <ComboboxList>
                    {(id: string) => (
                      <ComboboxItem key={id} value={id}>
                        {id === '' ? '— Buat anggota baru —' : persons.find((p) => p.id === id)?.fullName}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                Sudah ada datanya? Pilih nama di atas untuk menautkan langsung.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="fullName">
              Nama Lengkap {existingPartner ? '' : '*'}
            </Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder={
                existingPartner ? 'Tidak diperlukan' : 'cth. Rizal Anggoro'
              }
              disabled={Boolean(existingPartner)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Jenis Kelamin</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm({ ...form, gender: v as typeof form.gender })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">—</SelectItem>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="photoUrl">URL Foto</Label>
              <Input
                id="photoUrl"
                type="url"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="birthDate">Tanggal Lahir</Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deathDate">Tanggal Wafat</Label>
              <Input
                id="deathDate"
                type="date"
                value={form.deathDate}
                onChange={(e) => setForm({ ...form, deathDate: e.target.value })}
              />
            </div>
          </div>

          {!isEdit && relation?.kind === 'partner' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as typeof status)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="menikah">Menikah</SelectItem>
                    <SelectItem value="cerai">Cerai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="marriedDate">Tanggal Menikah</Label>
                <Input
                  id="marriedDate"
                  type="date"
                  value={marriedDate}
                  onChange={(e) => setMarriedDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {err && <p className="m-0 text-sm font-medium text-[var(--destructive)]">{err}</p>}

          <DialogFooter className={isEdit ? 'sm:justify-between' : ''}>
            {isEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-[var(--destructive)] hover:text-[var(--destructive)]"
                    disabled={remove.isPending || save.isPending}
                  >
                    <Trash2 size={16} /> Hapus
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus anggota ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {(state as { person: Person }).person.fullName} akan dihapus beserta
                      seluruh relasi orangtua–anak dan pasangannya. Tindakan ini tidak bisa
                      dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate()}>
                      Ya, hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
