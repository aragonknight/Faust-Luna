import os

styles_path = "android/app/src/main/res/values/styles.xml"

if os.path.exists(styles_path):
    with open(styles_path, "r") as f:
        content = f.read()

    if "windowOptOutEdgeToEdgeEnforcement" not in content:
        content = content.replace(
            "<style name=\"AppTheme\" parent=\"Theme.AppCompat.Light.DarkActionBar\">",
            "<style name=\"AppTheme\" parent=\"Theme.AppCompat.Light.DarkActionBar\">\n"
            "        <item name=\"android:windowOptOutEdgeToEdgeEnforcement\">true</item>"
        )
        with open(styles_path, "w") as f:
            f.write(content)
        print("Berhasil patch styles.xml")
    else:
        print("Sudah ada, tidak perlu patch")
else:
    print(f"File tidak ditemukan: {styles_path}")