import os

styles_path = "android/app/src/main/res/values/styles.xml"

if os.path.exists(styles_path):
    with open(styles_path, "r") as f:
        content = f.read()

    # Hapus item lama yang bikin error (butuh SDK 35)
    if "windowOptOutEdgeToEdgeEnforcement" in content:
        content = content.replace(
            '\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>',
            ""
        )

    # Tambah item versi lama yang kompatibel ke semua Android
    if "windowFitsSystemWindows" not in content:
        content = content.replace(
            '<style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">',
            '<style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">\n'
            '        <item name="android:fitsSystemWindows">true</item>\n'
            '        <item name="android:windowFitsSystemWindows">true</item>'
        )
        with open(styles_path, "w") as f:
            f.write(content)
        print("Berhasil patch styles.xml (versi kompatibel)")
    else:
        print("Sudah ada, tidak perlu patch")
else:
    print(f"File tidak ditemukan: {styles_path}")