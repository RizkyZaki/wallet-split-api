# Wallet API

REST API sederhana untuk operasi wallet dan pembagian pengeluaran kelompok
(split bill), dibangun dengan Node.js dan Express. Seluruh data disimpan di
memori sesuai ketentuan tugas.

## Cara menjalankan

### Opsi A: Docker (tanpa perlu Node.js)

```bash
docker compose up --build
# Wallet API listening on http://localhost:3000
```

### Opsi B: Node.js 18 atau lebih baru

```bash
npm install
npm start
# Wallet API listening on http://localhost:3000
```

### Menjalankan test

```bash
npm install
npm test
# Test Suites: 3 passed, Tests: 47 passed
```

Tidak ada konfigurasi tambahan. Data hanya tersimpan di memori dan akan
hilang setiap kali server dijalankan ulang. Port dapat diubah dengan
`PORT=4000 npm start`.

## Coba dengan Postman

Import `postman_collection.json` (File → Import). Collection berisi satu
request per endpoint dengan contoh payload. Setelah membuat user atau
expense, salin `id` dari response ke variabel collection `userId`, `userId2`,
dan `expenseId` (klik nama collection → tab Variables) agar request
berikutnya bisa langsung dijalankan.

## Coba dengan curl

Skrip berikut mencakup semua fitur. ID dibuat oleh server, jadi ambil dari
response (contoh di bawah memakai `jq`, tetapi alat lain juga bisa).

```bash
BASE=http://localhost:3000/api

# 1. Buat dua wallet
ALICE=$(curl -s -X POST $BASE/users -H 'Content-Type: application/json' \
  -d '{"name":"Alice","initialBalance":100}' | jq -r .id)
BOB=$(curl -s -X POST $BASE/users -H 'Content-Type: application/json' \
  -d '{"name":"Bob"}' | jq -r .id)

# 2. Top-up Bob
curl -s -X POST $BASE/users/$BOB/topup -H 'Content-Type: application/json' \
  -d '{"amount":20}'

# 3. Transfer dari Alice ke Bob
curl -s -X POST $BASE/transfers -H 'Content-Type: application/json' \
  -d "{\"fromUserId\":\"$ALICE\",\"toUserId\":\"$BOB\",\"amount\":25}"

# 4. Alice membayar makan malam 10.00, dibagi rata berdua
curl -s -X POST $BASE/expenses -H 'Content-Type: application/json' \
  -d "{\"payerId\":\"$ALICE\",\"participantIds\":[\"$ALICE\",\"$BOB\"],\"totalAmount\":10}"

# 5. Cek saldo dan riwayat
curl -s $BASE/users/$ALICE/balance
curl -s $BASE/users/$BOB/transactions
```

## Daftar endpoint

Semua request dan response menggunakan JSON. Nilai uang berupa angka biasa
dengan maksimal dua angka di belakang koma (contoh: `10.5`).

### Membuat wallet

`POST /api/users`
```json
{ "name": "Alice", "initialBalance": 100 }
```
`initialBalance` opsional, default `0`. Response `201`:
```json
{ "id": "user_...", "name": "Alice", "balance": 100 }
```

### Top-up saldo

`POST /api/users/:id/topup`
```json
{ "amount": 50 }
```
Response `200` berisi record transaksi, termasuk `balanceAfter`.

### Transfer antar-user

`POST /api/transfers`
```json
{ "fromUserId": "user_...", "toUserId": "user_...", "amount": 25 }
```
Response `200` berisi saldo terbaru kedua user.

Untuk **melunasi bagian dari group expense**, sertakan `expenseId`:
```json
{ "fromUserId": "user_...", "toUserId": "user_...", "amount": 10, "expenseId": "exp_..." }
```
Transfer seperti ini divalidasi sebagai pelunasan: `toUserId` harus payer
expense tersebut, `fromUserId` harus participant, dan `amount` tidak boleh
melebihi sisa bagian yang belum dibayar (boleh dicicil). Transfer tanpa
`expenseId` adalah transfer biasa dan tidak dihitung sebagai pelunasan.

### Membuat group expense

`POST /api/expenses`
```json
{
  "payerId": "user_...",
  "participantIds": ["user_...", "user_..."],
  "totalAmount": 100,
  "splitType": "equal"
}
```
`splitType` default `"equal"`. Untuk pembagian custom, isi `"custom"` dan
sertakan `splits`, satu entry per participant, dengan total yang harus sama
persis dengan `totalAmount`:
```json
{
  "payerId": "user_...",
  "participantIds": ["user_...", "user_..."],
  "totalAmount": 100,
  "splitType": "custom",
  "splits": [
    { "userId": "user_...", "amount": 60 },
    { "userId": "user_...", "amount": 40 }
  ]
}
```
Response `201` berisi expense yang tersimpan, termasuk `splits` hasil
perhitungan.

### Endpoint pembacaan data

- `GET /api/users` – daftar semua user beserta saldonya
- `GET /api/users/:id/balance`
- `GET /api/users/:id/transactions` – riwayat transaksi user, urut kronologis
- `GET /api/users/:id/debts` – ringkasan utang user ke tiap payer:
  ```json
  {
    "userId": "user_...",
    "debts": [
      { "toUserId": "user_...", "toUserName": "Alice", "owed": 10, "settled": 4, "outstanding": 6 }
    ]
  }
  ```
  `owed` = total bagian dari group expense, `settled` = total transfer
  pelunasan (yang menyertakan `expenseId`) ke payer tersebut, `outstanding` =
  sisa yang belum dibayar.
- `GET /api/expenses/:id`
- `GET /health`

### Format error

Semua error berbentuk `{ "error": "pesan" }` dengan status HTTP yang sesuai:
`400` untuk kegagalan validasi (termasuk body JSON yang tidak valid), `404`
untuk user atau expense yang tidak ditemukan, `500` hanya untuk error
internal yang tidak terduga.

## Aturan validasi

- Setiap amount (top-up, transfer, total expense, entry custom split) harus
  berupa angka positif dengan maksimal dua angka di belakang koma.
- Pengirim (transfer) atau payer (expense) harus memiliki saldo yang cukup.
  Validasi selesai sebelum ada saldo yang diubah, sehingga request yang
  ditolak tidak meninggalkan perubahan sebagian.
- Semua user ID yang dirujuk harus terdaftar; jika tidak, response `404`.
- `participantIds` tidak boleh kosong dan tidak boleh berisi duplikat.
- Custom split harus memuat setiap participant tepat satu kali, dan totalnya
  harus sama dengan total expense.
- User tidak dapat mentransfer ke dirinya sendiri.
- Transfer dengan `expenseId` harus ditujukan ke payer expense tersebut, berasal
  dari participant, dan tidak melebihi sisa bagian yang belum dibayar.

## Keputusan desain

**Uang dihitung dalam satuan sen (integer).** Amount masuk dan keluar API
sebagai desimal, tetapi setiap penjumlahan, pengurangan, perbandingan, dan
total di `src/utils/money.js` dikonversi ke sen terlebih dahulu. Aritmetika
float biasa menghasilkan selisih (`0.1 + 0.2 === 0.30000000000000004`), yang
tidak dapat diterima untuk saldo. Amount dengan lebih dari dua angka desimal
ditolak, bukan dibulatkan diam-diam, dan ada batas atas agar nilai sen selalu
berupa integer yang presisi.

**Cara group expense memindahkan uang.** Payer dianggap menalangi seluruh
tagihan (seperti membayar bill restoran), sehingga `totalAmount` langsung
dipotong dari wallet payer. Bagian tiap participant dicatat di riwayat
transaksinya sebagai entry `EXPENSE_SHARE` ("owes Alice for shared expense"),
tetapi **tidak** otomatis dipotong dari wallet mereka. Bagian payer sendiri
juga dicatat ("own share of group expense", tanpa `relatedUserId`) agar
riwayatnya menunjukkan berapa dari total yang memang porsinya.

Dengan demikian "mencatat expense" dan "melunasi utang" adalah dua langkah
terpisah: pelunasan dilakukan lewat `POST /api/transfers` dengan `expenseId`.
Transfer yang membawa `expenseId` diperlakukan sebagai pelunasan dan divalidasi
terhadap sisa bagian participant, sehingga tidak mungkin membayar lebih dari
yang terutang; transfer biasa tanpa `expenseId` tidak menyentuh hitungan utang.
`GET /api/users/:id/debts` merangkum keduanya per payer.
Pendekatan ini dipilih karena spesifikasi hanya mensyaratkan pengecekan saldo
*payer*, bukan tiap participant; auto-debit participant yang saldonya kosong
akan gagal dengan cara yang tidak dijelaskan spesifikasi. Payer tidak wajib
ada di `participantIds` (bisa saja ia membayar murni untuk orang lain);
masukkan ID payer jika ia ikut dalam pembagian.

**Sisa pembagian equal split.** 10.00 dibagi tiga orang tidak bisa tepat dalam
mata uang. Bagian dihitung dalam sen; sisa sen diberikan satu per satu ke
participant paling awal di daftar (`[3.34, 3.33, 3.33]`). Ini menjamin total
bagian selalu sama persis dengan `totalAmount`.

**Penyimpanan in-memory.** Tiga `Map` di `src/store.js` (users, transactions,
expenses). Hanya service layer yang menyentuhnya, sehingga penggantian ke
database sungguhan cukup mengubah store dan service, bukan HTTP layer.

**Transaction log sebagai sumber riwayat.** Setiap operasi yang mengubah saldo
(saldo awal, top-up, dua sisi transfer, pembayaran expense) menambahkan record
immutable beserta `balanceAfter`. `GET /api/users/:id/transactions` hanya
memfilter log tersebut; karena `Map` mempertahankan urutan insert, hasilnya
sudah kronologis.

**Atomisitas dan konkurensi.** Semua handler sinkron dan Node.js menjalankan
JavaScript pada satu thread, sehingga sebuah request tidak dapat disela
request lain di antara "cek saldo" dan "potong saldo". Dikombinasikan dengan
urutan validasi-dulu-baru-mutasi, setiap request efektif bersifat atomik.
Jika berpindah ke database sungguhan, jaminan ini perlu dipertahankan dengan
transaksi eksplisit dan row locking (atau optimistic versioning).

**Penanganan error.** Satu class `AppError` membawa status HTTP dan ditangkap
oleh satu middleware error Express. Error validasi dari semua service karena
itu punya bentuk `{ "error": "..." }` yang sama tanpa `try/catch` di tiap
route. Exception tak terduga dicatat ke log dan dikembalikan sebagai `500`
generik agar detail internal tidak bocor.

## Struktur project

```
src/
  app.js                        # setup Express (routes + middleware)
  server.js                     # entry point
  store.js                      # Map in-memory + pembuatan ID
  utils/
    money.js                    # aritmetika berbasis sen
    validation.js               # assertion input yang dipakai bersama
  errors/AppError.js
  services/
    userService.js              # create, top-up, saldo, riwayat, utang, cek debit/kredit
    walletService.js            # transfer + pelunasan expense
    expenseService.js           # group expense, equal/custom split
    transactionService.js       # transaction log append-only
  controllers/                  # adapter HTTP tipis di atas service
  routes/
  middleware/errorHandler.js
tests/
  api.test.js                   # end-to-end test via Supertest, satu per aturan validasi
  money.test.js                 # unit test helper uang
  splitEqually.test.js          # unit test distribusi sisa sen
Dockerfile, compose.yaml        # build container dan menjalankan dengan satu perintah
postman_collection.json         # satu request per endpoint, siap import
```
