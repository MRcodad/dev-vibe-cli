# ⚡ MRCODAD V2Ray Subscription Platform

[![Auto Update Subscriptions & Deploy Dashboard](https://github.com/MRcodad/dev-vibe-cli/actions/workflows/update-sub.yml/badge.svg)](https://github.com/MRcodad/dev-vibe-cli/actions/workflows/update-sub.yml)
![Node Version](https://img.shields.io/badge/node-20.x-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

یک پلتفرم هوشمند، خودکار و بدون قطع برای جمع‌آوری، فیلتر و برندسازی کانفیگ‌های **V2Ray / VLESS / REALITY** با به‌روزرسانی ۲ ساعته.

---

## 🌐 وب‌سایت زنده و داشبورد پروکسی

برای مشاهده آنلاین وضعیت سرورها و اسکن QR Code مستقیماً وارد لینک زیر شوید:

👉 **[https://mrcodad.github.io/dev-vibe-cli/](https://mrcodad.github.io/dev-vibe-cli/)**

---

## 🚀 لینک‌های مستقیم سابسکریپشن

| اپلیکیشن / نرم‌افزار | نوع فرمت | لینک سابسکریپشن مستقیم |
| :--- | :--- | :--- |
| **V2RayNG / MahsaNG / Streisand** | Base64 | `https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/sub.txt` |
| **Sing-box** | JSON | `https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/singbox.json` |
| **Clash Meta / Stash** | YAML | `https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/clash.yaml` |
| **متن معمولی (Plain Text)** | Text | `https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/sub_plain.txt` |

---

## 📖 راهنمای استفاده سریع

### ۱. استفاده در V2RayNG (اندروید)
1. لینک Base64 بالا را کپی کنید.
2. برنامه **v2rayNG** را باز کنید.
3. منوی کشویی سمت چپ را باز کرده و وارد بخش **Subscription group setting** شوید.
4. دکمه **+** را بزنید، نام را `MRCODAD` و لینک کپی‌شده را قرار دهید و ذخیره کنید.
5. از منوی اصلی گزینه‌ی **Update subscription** را انتخاب کنید.

### ۲. استفاده در Sing-box (آیفون / اندروید / ویندوز)
1. لینک **Sing-box JSON** را کپی کنید.
2. وارد اپلیکیشن **Sing-box** شوید و به تب **Profiles** بروید.
3. گزینه‌ی **Add Profile** را زده، نوع را روی **Remote** بگذارید و لینک را وارد کنید.

---

## 🛠 توسعه محلی (Local Development)

```bash
# کلون کردن ریپازیتوری
git clone [https://github.com/MRcodad/dev-vibe-cli.git](https://github.com/MRcodad/dev-vibe-cli.git)
cd dev-vibe-cli

# نصب وابستگی‌ها
npm install

# اجرای دستور جمع‌آوری کانفیگ‌ها
node src/index.mjs fetch-configs