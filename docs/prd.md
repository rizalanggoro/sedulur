# PRD — Sedulur

**Produk:** Sedulur — Website Family Tree
**Versi:** 0.1 (MVP)
**Tanggal:** 25 Agustus 2026
**Status:** Draft

---

## 1. Overview

Sedulur adalah website untuk membangun dan melihat **silsilah keluarga (family tree)** secara interaktif. Pengguna dapat menambahkan anggota keluarga, menghubungkan relasi orangtua–anak dan pasangan, lalu melihat seluruh silsilah dalam bentuk diagram node yang bisa di-pan, zoom, dan diedit langsung.

Untuk MVP, aplikasi bersifat **terbuka**: satu silsilah global tanpa login, semua pengunjung dapat melihat dan mengedit.

## 2. Tujuan & Non-Tujuan

### Tujuan MVP

1. Pengguna dapat menambah, mengubah, dan menghapus data anggota keluarga.
2. Pengguna dapat menghubungkan relasi: orangtua → anak, dan pasangan (menikah / cerai).
3. Silsilah tampil sebagai diagram interaktif dengan auto-layout per generasi.
4. Edit data cukup dengan klik node → modal form.

### Non-Tujuan (Fase 2+)

- Autentikasi & multi-user (login, sharing per family, role owner/viewer/editor).
- Upload foto (MVP hanya URL foto).
- Export gambar / print tree.
- Multi-tree per kelompok keluarga.
- Notifikasi, riwayat perubahan (audit log), GEDCOM import/export.

## 3. Tech Stack

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Fullstack framework | TanStack Start | Sudah ter-setup di repo |
| Database | PostgreSQL | |
| ORM | Drizzle ORM + drizzle-kit | Migrasi via `db:generate` / `db:migrate` |
| Data fetching | TanStack Query | Cache + invalidation setelah mutasi |
| UI | shadcn/ui + Tailwind CSS 4 | Dialog/form untuk modal edit |
| Visualisasi tree | **@xyflow/react (React Flow v12)** | Node kartu orang + custom edges |
| Auto-layout | **@dagrejs/dagre** | React Flow tidak punya layout bawaan; dagre resmi direkomendasikan dokumennya |

> **Catatan React Flow:** valid melalui riset — banyak project family tree open-source dibangun di atasnya (`reactflow-family-tree`, dsb). Fitur yang dipakai: custom nodes, multiple handles per node (ayah/ibu/pasangan/anak), custom edges (garis pasangan ≠ garis anak), MiniMap, pan/zoom built-in. React Flow berjalan murni client-side; SSR aman karena komponen hanya render di client (dynamic import / `ClientOnly` bila diperlukan).

## 4. Kebutuhan Fungsional

### 4.1 Anggota Keluarga (Person)

- **FR-1** Tambah anggota: minimal nama lengkap; opsional gender (laki-laki/perempuan/lainnya), tanggal lahir, tanggal wafat, URL foto, catatan.
- **FR-2** Edit anggota: klik node pada canvas → modal form (shadcn Dialog) berisi field yang sama.
- **FR-3** Hapus anggota: dari modal detail/edit, dengan konfirmasi. Menghapus person ikut menghapus semua relasinya (parent_links & partnerships yang menautkan ke dia).
- **FR-4** Tambah cepat dari konteks node: menu aksi pada node terpilih → "Tambah Anak", "Tambah Pasangan", "Tambah Orangtua" (form modal terbuka dengan relasi ter-pra-pilih).

### 4.2 Relasi

- **FR-5** Relasi orangtua–anak: satu anak maksimal **2 orangtua**; satu orangtua boleh banyak anak.
- **FR-6** Relasi pasangan: dua person terhubung sebagai pasangan dengan status `menikah` atau `cerai`. Satu person boleh memiliki lebih dari satu pasangan (pernikahan kedua, dll).
- **FR-7** Validasi server:
  - Tidak boleh ada siklus (seseorang tidak bisa menjadi leluhur dirinya sendiri).
  - Anak tidak boleh lebih dari 2 parent.
  - Person tidak bisa menjadi pasangan dirinya sendiri; duplikasi pasangan ditolak.
  - Relasi tidak valid (misal menambah orangtua pada root tanpa pasangan lain) ditangani dengan pesan error berbahasa Indonesia.

### 4.3 Visualisasi Tree

- **FR-8** Canvas React Flow menampilkan semua person sebagai node kartu (nama, tahun lahir–wafat, foto bila ada).
- **FR-9** Edge bergaya berbeda:
  - Garis horizontal antar pasangan.
  - Garis dari titik tengah pasangan turun ke anak-anaknya (gaya silsilah klasik), atau fallback garis parent→child bila parent tunggal.
- **FR-10** Auto-layout per generasi menggunakan dagre (top-to-bottom); pasangan diposisikan berdampingan pada generasi yang sama.
- **FR-11** Interaksi kanvas: pan, zoom, fit-view, MiniMap, tombol "reset view".
- **FR-12** State kosong (belum ada anggota): tampil layar ajakan "Tambah Anggota Pertama".

## 5. Draft Skema Database (Drizzle)

```ts
// persons
persons: {
  id: uuid pk,
  fullName: text not null,
  gender: text ('L' | 'P' | '-'),      // default '-'
  birthDate: date nullable,
  deathDate: date nullable,
  photoUrl: text nullable,
  notes: text nullable,
  createdAt: timestamp default now
}

// parent_links (relasi orangtua ↔ anak, many-to-many)
parentLinks: {
  id: uuid pk,
  childId: uuid fk -> persons.id (cascade delete),
  parentId: uuid fk -> persons.id (cascade delete),
  // batasan maks 2 baris per childId divalidasi di server function
}

// partnerships (relasi pasangan)
partnerships: {
  id: uuid pk,
  partnerAId: uuid fk -> persons.id (cascade delete),
  partnerBId: uuid fk -> persons.id (cascade delete),
  status: text ('menikah' | 'cerai') default 'menikah',
  marriedDate: date nullable
}
```

Catatan desain:

- Struktur flat ini sengaja dipilih agar penambahan multi-tree (fase 2) hanya perlu kolom `treeId`.
- Penentuan "siapa anak dari pasangan X" dihitung saat render: anak = person yang parent_links-nya mengarah ke salah satu/dua-duanya anggota partnership tersebut.

## 6. Arsitektur

```
Browser
 ├─ Route "/" : halaman utama (canvas React Flow)
 ├─ TanStack Query  ── fetch/invalidate ──┐
 ├─ React Flow + dagre layout (client)    │
 └─ shadcn Dialog untuk form              │
                                          │
TanStack Start (server functions)         ▼
 ├─ getFamily()        → baca persons + relasi
 ├─ createPerson/updatePerson/deletePerson
 ├─ linkParent/unlinkParent
 └─ createPartnership/updatePartnership/deletePartnership
          │
          ▼
     Drizzle ORM ── PostgreSQL
```

- Semua mutasi lewat `createServerFn` + validator (Zod); invalidasi query key `['family']` setelah sukses.
- Transformasi data DB → `{ nodes, edges }` React Flow dilakukan di client sebelum layout dagre dijalankan.
- Optimistic update opsional untuk rename/hapus ringan; relasi tetap await respons server (validasi siklus).

## 7. Milestone

| Fase | Isi | Selesai jika |
|---|---|---|
| **M1 — Fondasi data** | Skema Drizzle + migrasi, server functions CRUD + relasi, validasi anti-siklus | CRUD berhasil via devtools/endpoint |
| **M2 — Render tree** | Halaman kanvas React Flow, transform data → nodes/edges, layout dagre, edge pasangan vs anak | Tree tampil benar dari data seed |
| **M3 — Editing** | Modal form (shadcn Dialog), tambah/edit/hapus person, tambah relasi dari konteks node, error handling Indonesia | Alur tambah anak/pasangan/orangtua jalan end-to-end |
| **M4 — Polish** | Empty state, MiniMap + kontrol zoom, konfirmasi hapus, styling konsisten tema, cek lint/typecheck | Siap dipakai pengguna awal |

## 8. Risiko & Catatan Teknis

1. **Layout pasangan berdampingan**: dagre tidak memahami konsep "pasangan harus rapat". Strategi: gabungkan pasangan menjadi unit pseudo-node saat layout, lalu pecah kembali setelah posisi didapat — atau posisikan manual dengan offset. Ini bagian teknis paling rawan iterasi di M2.
2. **Anak dari dua pasangan berbeda** (pernikahan campuran): MVP menampilkan garis parent→child langsung tanpa titik tengah gabungan bila struktur ambigu.
3. **Kinerja**: untuk ribuan node, layout dihitung sekali per perubahan data (bukan per drag). Drag posisi manual node **tidak dipersistenkan** di MVP.
4. **React Flow & SSR**: pastikan komponen canvas hanya dirender client-side agar tidak error saat SSR TanStack Start.

## 9. Keputusan Produk Tertulis (untuk referensi tim)

- Bahasa UI: **Indonesia penuh**.
- Auth: **tidak ada di MVP**; semua orang bisa edit. Sharing/role menyusul fase 2.
- Foto: **URL saja** di MVP.
- Interaksi utama: **klik node → modal form**.
