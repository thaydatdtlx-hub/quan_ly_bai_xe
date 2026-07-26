# Hệ thống quản lý bãi xe

Website quản lý xe trên ô, tiền đóng tháng, lượt rửa xe, hạng mục công việc,
dịch vụ thuê, chiết khấu và số lượt rửa tặng cho xe tại bãi.

## Cấu hình Supabase

1. Mở **Supabase → SQL Editor**.
2. Chạy toàn bộ nội dung trong `supabase/parking.sql`.
3. Lấy hai giá trị tại **Project Settings → API**:
   - Project URL
   - Secret key (`sb_secret_...`)

Tạo `.env.local` khi chạy trên máy:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SB_SECRET_KEY
```

Không đưa `SUPABASE_SECRET_KEY` vào mã nguồn hoặc biến có tiền tố
`NEXT_PUBLIC_`.

## Triển khai Vercel

Kết nối repository với Vercel, sau đó thêm hai Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Vercel sẽ dùng lệnh `npm run vercel-build`. File `vercel.json` đã cấu hình sẵn
cho Next.js.

## Chạy thử

```bash
npm install
npm run dev
```

Khi chưa có biến môi trường Supabase, website hiển thị dữ liệu mẫu để kiểm tra
giao diện; các thao tác ghi sẽ yêu cầu cấu hình Supabase.
