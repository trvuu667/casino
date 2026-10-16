# Casino VN
Gồm: Texas Hold'em, Co-op 2D 3 màn, Đào vàng, Co-op 2D (dính dây, 2-4 người), Phòng nhập mã (Xì dách miền Tây, Tiến lên), Bầu cua, Tài xỉu, Long hổ (bàn chung realtime), Blackjack (vs nhà cái), chat theo phòng, kiếm xu bằng giải Toán 10-12 / Tiếng Anh.
## Deploy
1. Supabase → SQL Editor → chạy `schema.sql`. Lấy `Project URL` và `service_role key` (Settings → API).
2. Push repo lên GitHub → Render → New → Blueprint (đọc `render.yaml`).
3. Thêm env `SUPABASE_URL`, `SUPABASE_KEY` (service_role, KHÔNG để lộ ra client). `SECRET` tự sinh.
Chạy local: `npm i && npm start` (không có env Supabase thì lưu tạm trong RAM).
