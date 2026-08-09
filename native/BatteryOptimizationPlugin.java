package com.faustluna.store;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Plugin ini dipakai dari JS (08-native-notif.js) buat ngecek apakah app udah
// dikecualikan dari mode hemat baterai (Doze) Android, dan buat munculin dialog
// izin resminya kalau belum. Penting banget buat notifikasi terjadwal (reminder
// jatuh tempo, klaim WDP) supaya tetap dikirim tepat waktu walau HP-nya lagi
// "ngirit baterai" (sering jadi masalah di HP Xiaomi/Oppo/Vivo/Samsung).
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean ignoring = true; // di bawah Android 6 (M) gak ada konsep Doze, anggap aman
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
            } catch (Exception e) {
                // Fallback: sebagian HP (custom ROM) nolak intent di atas — buka
                // halaman daftar optimasi baterai biasa, user cari manual appnya.
                try {
                    getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                } catch (Exception ignored) { }
            }
        }
        call.resolve();
    }
}
