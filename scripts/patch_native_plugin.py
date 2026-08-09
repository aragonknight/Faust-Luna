"""
Dipanggil dari .github/workflows/build-apk.yml setelah `cap add android`
(folder android/ digenerate ulang dari nol tiap build, jadi plugin native
custom kayak gini gak bisa langsung "nempel" di situ, harus dipasang ulang
tiap kali).

1. Nyalin native/BatteryOptimizationPlugin.java ke folder Java project
   Android-nya (path-nya ngikutin appId di capacitor.config.json).
2. Nyisipin pemanggilan registerPlugin(BatteryOptimizationPlugin.class) ke
   MainActivity.java, karena Capacitor 6 gak auto-detect plugin native custom
   tanpa didaftarin manual di situ.
"""

import json
import shutil
import re

config = json.load(open("capacitor.config.json"))
app_id = config["appId"]  # contoh: com.faustluna.store
package_path = app_id.replace(".", "/")

java_dir = f"android/app/src/main/java/{package_path}"
shutil.copy("native/BatteryOptimizationPlugin.java", f"{java_dir}/BatteryOptimizationPlugin.java")
print(f"BatteryOptimizationPlugin.java disalin ke {java_dir}/")

main_activity_path = f"{java_dir}/MainActivity.java"
content = open(main_activity_path).read()

if "BatteryOptimizationPlugin" not in content:
    # Pastikan import Bundle & BridgeActivity ada (default generate Capacitor 6
    # biasanya sudah import BridgeActivity, Bundle belum tentu).
    if "import android.os.Bundle;" not in content:
        content = content.replace(
            "import com.getcapacitor.BridgeActivity;",
            "import android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;",
        )

    # MainActivity default kosong (cuma "public class MainActivity extends
    # BridgeActivity {}"), sisipin method onCreate yang daftarin plugin
    # SEBELUM super.onCreate() dipanggil (syarat wajib dari Capacitor).
    class_pattern = re.search(r"public class MainActivity extends BridgeActivity\s*\{", content)
    if class_pattern:
        insert_at = class_pattern.end()
        on_create = """
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BatteryOptimizationPlugin.class);
        super.onCreate(savedInstanceState);
    }
"""
        content = content[:insert_at] + on_create + content[insert_at:]
        open(main_activity_path, "w").write(content)
        print("BatteryOptimizationPlugin berhasil didaftarin ke MainActivity.java")
    else:
        raise SystemExit("Gagal nemuin class MainActivity di MainActivity.java — cek manual formatnya.")
else:
    print("BatteryOptimizationPlugin udah terdaftar di MainActivity.java, gak ada yang diubah.")
