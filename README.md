# KitaCall — Tactical Walkie-Talkie Transceiver

Sistem komunikasi Handy Talky (HT) taktis berbasis Progressive Web App (PWA) dengan kendali layar kunci (lockscreen ala Spotify) dan background audio keepalive, terintegrasi penuh dengan basis data organisasi & autentikasi Google Supabase.

---

## 🎨 Penyelarasan Design System KitaAtur
Aplikasi dibangun dengan 100% konsistensi token desain **KitaAtur**:
- **Brand Colors**: `#0087FF` (KitaAtur Primary Blue), `#01C4FB` (Cyan Accent), `#006BD1` (Dark Blue), `#E0F4FE` (Soft Background Pill).
- **Brand Gradient**: `linear-gradient(135deg, #0087FF 0%, #01C4FB 100%)`.
- **Background & Cards**: `bg-slate-50` (`#F8FAFC`) dengan kartu putih berpenjuru `rounded-2xl` dan `rounded-3xl` beraksen `border-slate-200`.
- **Ikonografi**: `@phosphor-icons/react` (`duotone` dan `bold`).
- **Tipografi**: `Inter`, clean sans-serif.
- **Tactical OLED Blackout Mode**: `#000000` AMOLED power-saving mode untuk saku rompi pengamanan.

---

## 🏢 Integrasi Database Workspace & Anggota (Supabase KitaAtur)

Aplikasi terhubung langsung ke basis data Supabase KitaAtur:
* **Tabel Terintegrasi**:
  - `organizations`: Memuat seluruh ruang kerja/organisasi (OSIS SMAN 2 Babelan, MPK, Paskibra, dsb.)
  - `organization_members` & `profiles`: Memuat daftar riil seluruh anggota per workspace lengkap dengan jabatan strukturalnya.
  - `kitacom_channels`: Frekuensi taktis yang dibuat khusus per workspace (`code`, `name`, `category`, `description`).
  - `kitacom_channel_members`: Personel yang ditugaskan ke frekuensi tertentu beserta `tactical_role` (Komandan / Satgas) dan `pos_jaga`.

---

## 🔐 Autentikasi Google OAuth & Simulasi Cepat
* **Google OAuth**: Masuk secara langsung menggunakan akun Google via Supabase OAuth (`signInWithOAuth({ provider: 'google' })`).
* **Simulator Profil Anggota**: Memungkinkan pengembang / penguji beralih identitas secara instan ke anggota mana pun di workspace untuk menguji skenario komunikasi antar-personel di lapangan.

---

## ⚡ 4-Lapis Rekayasa Audio Tembus Mode Silent (KitaCom Engine)

1. **Lapis 1 — Silent Audio Loop Keep-Alive**: Loop audio sub-audible (`40Hz`, `gain = 0.0001`) yang mempertahankan `AudioContext` tetap `running` sehingga sistem operasi Android Doze Mode tidak membekukan tab browser atau koneksi WebSocket.
2. **Lapis 2 — Pre-Flight Volume Guard & Audio Compressor Booster**: Pengalihan transmisi suara ke jalur `STREAM_MUSIC`, dilengkapi rantai pemrosesan suara:
   - `BiquadFilterNode` (Band-pass 300Hz–3400Hz vokal taktis)
   - `DynamicsCompressorNode` (penghilang distorsi dan desis keramaian)
   - `GainNode` (Penguatan 250% / 2.5x gain)
3. **Lapis 3 — Integrasi Media Session API**: Kontrol pemutaran di Lock Screen / Notification Drawer dan intersepsi tombol fisik headset/TWS bluetooth (`play`, `pause`, `nexttrack`) dialihfungsikan menjadi tombol PTT.
4. **Lapis 4 — Tactical Screen Wake Lock & SOS Push**: `navigator.wakeLock` untuk mencegah layar mati otomatis, dipadukan dengan getar darurat SOS `[600, 150, 600, 150, 1200]`.

---

## 📻 Floor Control State Machine (Half-Duplex) & Priority Override

- **Half-Duplex Floor Locking**: Mencegah tabrakan transmisi suara. Maksimal 60 detik Time-Out Timer (TOT) per penutur.
- **Priority Override Komandan**: Peran `KOORDINATOR_KEAMANAN` atau `KETUA_PELAKSANA` dapat memotong (preempt) transmisi anggota saat terjadi kondisi darurat.
- **Nada Sintetis Oscillator (Zero External Audio Files)**:
  - *Talk Permit Chirp*: 1200Hz $\rightarrow$ 1600Hz (50ms)
  - *Roger Beep*: 1050Hz (80ms)
  - *Channel Busy Tone*: 350Hz pulsing tone
  - *Emergency Siren*: 800Hz $\rightarrow$ 1400Hz sweep

---

## 🚀 Cara Menjalankan Proyek

### 1. Backend Relay Server (Port 4001)
```bash
cd backend
npm run dev
```
*Healthcheck*: `http://localhost:4001/health`  
*Workspaces API*: `http://localhost:4001/api/workspaces`

### 2. Frontend React PWA (Port 3000)
```bash
cd frontend
npm run dev
```
Buka browser pada: `http://localhost:3000/`  
Dapat juga diakses dari ponsel Android di satu jaringan Wi-Fi lokal untuk pengujian instalasi PWA WebAPK.

---

## 📱 Alur Penggunaan Fitur Baru
1. **Pilih Workspace**: Klik bar *"WORKSPACE AKTIF"* di atas frekuensi untuk berpindah ke unit lain (misal: *OSIS SMAN 2 Babelan*, *MPK*, dll.). Anggota dan saluran akan otomatis disinkronkan.
2. **Buat Saluran Baru**: Buka dropdown frekuensi, klik *"+ Buat Saluran Frekuensi Baru"*, tentukan kode (mis. `CH-04`), nama pos, dan centang anggota yang bertugas.
3. **Kelola Personel**: Klik ikon gear di sebelah frekuensi untuk menambahkan atau menghapus personel dari saluran yang sedang aktif.
4. **Login Google**: Klik nama/avatar di header untuk membuka modal autentikasi Google atau berganti profil anggota untuk pengujian.
