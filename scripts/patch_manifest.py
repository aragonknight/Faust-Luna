"""
Dipanggil dari .github/workflows/build-apk.yml setelah `cap add android`
(folder android/ di-gitignore, jadi di-generate ulang dari nol tiap build).

Capacitor generate AndroidManifest.xml default yang BELUM punya izin-izin
berikut, padahal notifikasi terjadwal (scheduleNativeReminders di
08-native-notif.js) butuh ini biar tetap AKURAT & TETAP JALAN walau app
ditutup atau HP lagi hemat baterai:

- SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM (Android 12+): tanpa ini, jadwal
  notifikasi yang jauh ke depan (H-1, H-2, dst) bisa digeser/didelay sama
  sistem, gak presisi di jam yang diminta.
- POST_NOTIFICATIONS (Android 13+): wajib biar app boleh nampilin notifikasi
  sama sekali di HP Android 13 ke atas.
- RECEIVE_BOOT_COMPLETED: biar jadwal notifikasi yang udah di-set tetap idup
  lagi setelah HP-nya di-restart (defaultnya alarm ke-reset kalau HP mati).
- REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: dipakai BatteryOptimizationPlugin
  buat nanya ke user apakah app ini boleh dikecualikan dari mode hemat
  baterai (Doze), yang sering jadi biang notif telat/gak muncul di HP
  Xiaomi/Oppo/Vivo dkk.
"""

path = "android/app/src/main/AndroidManifest.xml"
content = open(path).read()

permissions = [
    '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>',
    '<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
    '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>',
    '<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>',
]

added = []
for perm in permissions:
    # Ambil nama izinnya doang buat cek duplikat (misal plugin lain udah nambahin sendiri)
    perm_name = perm.split('android:name="')[1].split('"')[0]
    if perm_name not in content:
        added.append(perm)

if added:
    insert_block = "\n    " + "\n    ".join(added) + "\n"
    content = content.replace("<application", insert_block + "    <application", 1)
    open(path, "w").write(content)
    print(f"Berhasil nambahin {len(added)} izin ke AndroidManifest.xml:")
    for p in added:
        print(f"  - {p}")
else:
    print("Semua izin yang dibutuhkan sudah ada di AndroidManifest.xml, gak ada yang ditambah.")
