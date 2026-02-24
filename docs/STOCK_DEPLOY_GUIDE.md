# Trien khai app Co phieu (Google Apps Script + Google Sheets)

## 1) Tao Google Sheet
1. Tao 1 Google Sheet moi.
2. Doi ten sheet mac dinh thanh `transactions`.
3. O dong tieu de (row 1), tao cac cot:
   - `id | symbol | date | price | quantity | status`
4. Tao them 1 sheet moi ten `config`.
5. O `config`, them:
   - A1: `key`
   - B1: `value`
   - A2: `ACCESS_CODE`
   - B2: ma truy cap ban muon su dung (vi du `my-secret-2026`)

## 2) Tao Google Apps Script
1. Tu Google Sheet, vao `Extensions` -> `Apps Script`.
2. Xoa code mac dinh trong `Code.gs`.
3. Copy noi dung tu file:
   - `/Users/quangvlh/work/karaoke/docs/STOCK_APPS_SCRIPT.gs`
4. Paste vao `Code.gs` va Save.

## 3) Deploy Web App
1. Bam `Deploy` -> `New deployment`.
2. Chon type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone` (hoac `Anyone with link`).
5. Deploy va copy `Web app URL`.

## 4) Cau hinh frontend
1. Khong can sua URL trong frontend nua (da dung proxy cung domain).
2. Mo file env:
   - local: `/Users/quangvlh/work/karaoke/.env`
   - Render: Environment variables tren dashboard
3. Them bien:
   - `STOCK_APPS_SCRIPT_URL=<YOUR_APPS_SCRIPT_WEB_APP_URL>`
4. Khoi dong lai app sau khi cap nhat env.

## 5) Su dung
1. Truy cap:
   - `/co-phieu/index.html`
2. Dang nhap bang `ACCESS_CODE` trong sheet `config`.
3. Them lenh mua, cap nhat gia hien tai, xem lai/lo theo tung lenh.
4. Bam `Mark as Sold` de doi status sang `SOLD` tren Google Sheet.

## Ghi chu
- Frontend khong luu session; reload se dang nhap lai.
- Gia hien tai chi luu trong RAM tren trinh duyet (khong ghi vao Sheet).
- Cac lenh `SOLD` se khong hien thi.
- Frontend goi `/api/stocks` (same-origin) de tranh loi CORS voi `script.google.com`.
