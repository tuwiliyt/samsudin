# 🧩 AI-Free Credentials Exporter (Chrome Extension)

Ekstensi Google Chrome resmi untuk mengekstrak kredensial sesi (JWT, session token, dan cookies) dari seluruh 8 platform AI yang didukung oleh **AI-Free** secara instan dengan **satu kali klik**.

Tidak perlu lagi membuka `F12` $\rightarrow$ *Application* $\rightarrow$ *Local Storage* / *Cookies* secara manual untuk tiap platform!

---

## 🚀 Fitur Unggulan

- ⚡ **Deteksi Instan 8 Platform:**
  - 🐳 **DeepSeek** (`userToken` & `ds_session_id`)
  - 🌕 **Kimi AI / Moonshot** (`refresh_token` & `access_token`)
  - 🤖 **MiniMax Agent** (`_token`)
  - 📱 **Xiaomi MiMo Studio** (`userId`, `xiaomichatbot_ph`, `xiaomichatbot_serviceToken`)
  - 🔬 **InternLM / OpenXLab** (`uaa-token` & `ssouid`)
  - 🐉 **Tencent Hunyuan AI Studio** (`hunyuan_token`, `hunyuan_user`, `hunyuan_source`)
  - ⚡ **Zhipu AI (GLM / Z.ai)** (`token`)
  - 🟣 **Qwen AI** (`token` / cookies)
- 🚀 **Mode "Buka Semua & Ambil Token":**
  - Otomatis membuka tab latar belakang untuk platform yang belum login/terbaca, menunggu token diinisialisasi oleh web app, mengekstraknya, dan langsung menutup tabnya kembali.
- 💾 **One-Click Download:**
  - Menghasilkan file `credentials.json` siap pakai yang 100% kompatibel dengan wizard `npm run setup`.
- 🔒 **100% Privat & Lokal:**
  - Tidak ada server perantara atau telemetri. Seluruh data diproses murni di memori lokal peramban Anda.
  - Dilengkapi fitur sensor privasi (*token masking*) saat preview di layar.

---

## 📦 Cara Memasang (Install) di Chrome / Edge / Brave

1. Buka browser **Google Chrome** (atau Brave / Microsoft Edge).
2. Ketik di bilah alamat (address bar):
   ```text
   chrome://extensions/
   ```
3. Di pojok kanan atas, **aktifkan saklar "Developer mode"** (Mode Pengembang).
4. Klik tombol **"Load unpacked"** (Muat yang belum dibongkar) di pojok kiri atas.
5. Pilih folder:
   ```text
   ai-free/plugin-for-chrome
   ```
6. Ekstensi **AI-Free Credentials Exporter** akan langsung muncul di daftar ekstensi!
7. Klik ikon puzzle (Extensions) di toolbar Chrome, lalu klik ikon **Pin** 📌 agar ekstensi mudah diakses.

---

## 🎯 Cara Menggunakan

1. **Pastikan Anda Sudah Login di Web AI:**
   - Masuk ke akun Anda di browser seperti biasa (misal: DeepSeek, Kimi, Tencent Hunyuan, dsb.).
2. **Buka Popup Ekstensi:**
   - Klik ikon **AI-Free** di toolbar Chrome.
3. **Ekstrak Kredensial:**
   - **Opsi A (Scan Cepat):** Jika tab web AI sedang terbuka atau cookies sudah tersimpan, klik **"Scan Sesi Sekarang"**.
   - **Opsi B (Otomatis):** Klik **"Buka Semua & Ambil Token"**. Ekstensi akan membuka platform yang belum terdeteksi, mengambil tokennya, lalu menutup kembali tabnya secara otomatis.
4. **Export ke AI-Free:**
   - Klik tombol hijau **"Download credentials.json"**.
   - Pindahkan file `credentials.json` hasil unduhan ke folder root project `ai-free/`:
     ```bash
     mv ~/Downloads/credentials.json /path/to/ai-free/credentials.json
     ```
5. **Jalankan Setup di Terminal:**
   ```bash
   npm run setup
   ```
   *Sistem AI-Free akan langsung mendeteksi file tersebut dan mengimpor seluruh provider secara instan!*

---

## 📂 Struktur Berkas

```text
plugin-for-chrome/
├── manifest.json       # Konfigurasi Manifest V3
├── popup.html          # Antarmuka popup modern
├── popup.css           # Styling tema gelap responsif
├── popup.js            # Engine ekstraksi cookies & scripting
├── icons/              # Ikon resolusi 16x16, 32x32, 48x48, 128x128
└── README.md           # Panduan lengkap
```
