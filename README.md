# BÃI XE MINH PHÚC

Website quản lý xe trên ô, tiền đóng tháng, lượt rửa xe, hạng mục công việc,
dịch vụ thuê, chiết khấu và số lượt rửa tặng cho xe tại bãi.

## Cấu hình Supabase

1. Mở **Supabase → SQL Editor**.
2. Chạy toàn bộ nội dung trong `supabase/parking.sql`.
3. Lấy hai giá trị tại **Project Settings → API**:
   - Project URL
   - Secret key (`sb_secret_...`)

Publishable key (`sb_publishable_...`) là tùy chọn. Nếu không khai báo, máy chủ
sẽ dùng secret key cho các yêu cầu xác thực và không gửi key này xuống trình
duyệt.

Tạo `.env.local` khi chạy trên máy:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SB_SECRET_KEY
SUPABASE_PUBLISHABLE_KEY=YOUR_OPTIONAL_SB_PUBLISHABLE_KEY
```

Không đưa `SUPABASE_SECRET_KEY` vào mã nguồn hoặc biến có tiền tố
`NEXT_PUBLIC_`.

## Tạo tài khoản và phân quyền

Trong **Supabase → Authentication → Users**, tạo ba người dùng và bật
**Auto Confirm User**. Đặt mật khẩu riêng trực tiếp trong Supabase, không gửi
mật khẩu qua tin nhắn:

- `admin@parking.local` — tên đăng nhập trên website: `admin`
- `nhanvien1@parking.local` — tên đăng nhập: `nhanvien1`
- `nhanvien2@parking.local` — tên đăng nhập: `nhanvien2`

Sau khi tạo xong, chạy ba lệnh sau trong SQL Editor:

```sql
select public.parking_assign_role_by_email('admin@parking.local', 'admin', 'Quản trị viên');
select public.parking_assign_role_by_email('nhanvien1@parking.local', 'staff_wash', 'Nhân viên 1');
select public.parking_assign_role_by_email('nhanvien2@parking.local', 'staff_wash', 'Nhân viên 2');
```

Admin được quản lý toàn bộ dữ liệu. Nhân viên chỉ thấy thông tin xe cần cho
việc rửa xe và chỉ được ghi lượt rửa; API phía máy chủ cũng chặn các thao tác
quản trị.

## Triển khai Vercel

Kết nối repository với Vercel, sau đó thêm hai Environment Variables bắt buộc:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Có thể thêm `SUPABASE_PUBLISHABLE_KEY`, nhưng không bắt buộc.

Vercel sẽ dùng lệnh `npm run vercel-build`. File `vercel.json` đã cấu hình sẵn
cho Next.js.

## Chạy thử

```bash
npm install
npm run dev
```

Khi chưa có đủ biến môi trường Supabase, màn hình đăng nhập sẽ báo thiếu cấu
hình và không cho truy cập dữ liệu.
