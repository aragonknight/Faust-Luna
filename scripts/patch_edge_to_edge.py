import os
import glob

# 1. Bersihkan styles.xml dari item yang bikin error sebelumnya
styles_path = "android/app/src/main/res/values/styles.xml"
if os.path.exists(styles_path):
    with open(styles_path, "r") as f:
        content = f.read()
    for bad_item in [
        '\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>',
        '\n        <item name="android:fitsSystemWindows">true</item>',
        '\n        <item name="android:windowFitsSystemWindows">true</item>',
    ]:
        content = content.replace(bad_item, "")
    with open(styles_path, "w") as f:
        f.write(content)
    print("styles.xml dibersihkan")

# 2. Cari file MainActivity.java, patch langsung lewat kode
matches = glob.glob("android/app/src/main/java/**/MainActivity.java", recursive=True)

if matches:
    main_activity = matches[0]
    with open(main_activity, "r") as f:
        content = f.read()

    if "setDecorFitsSystemWindows" not in content:
        # Tambah import
        if "import androidx.core.view.WindowCompat;" not in content:
            content = content.replace(
                "package ",
                "package ", 1
            )
            content = content.replace(
                content.split("\n")[0] + "\n",
                content.split("\n")[0] + "\n\nimport androidx.core.view.WindowCompat;\n",
                1
            )

        # Tambah pemanggilan di onCreate, setelah super.onCreate(...)
        content = content.replace(
            "super.onCreate(savedInstanceState);",
            "super.onCreate(savedInstanceState);\n"
            "        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);"
        )

        with open(main_activity, "w") as f:
            f.write(content)
        print(f"Berhasil patch {main_activity}")
    else:
        print("Sudah ada, tidak perlu patch")
else:
    print("MainActivity.java tidak ditemukan")