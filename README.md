# AI HIỂU MÌNH – CHINH PHỤC BẢN THÂN
Trò chơi quiz nhiều người chơi theo chủ đề 2 “Khám phá bản thân” (HĐTN, hướng nghiệp – Kết nối tri thức).

## Chạy thử trên máy tính
1. Cài Node.js 18 trở lên.
2. Giải nén thư mục.
3. Mở Terminal/CMD trong thư mục dự án.
4. Chạy `npm install`
5. Chạy `npm start`
6. Mở http://localhost:3000

Để học sinh cùng mạng Wi-Fi truy cập, giáo viên có thể dùng địa chỉ IP nội bộ của máy chủ kèm `:3000`. Để chơi từ xa, cần triển khai lên máy chủ công khai.

## Triển khai Render
- Tạo Git repository từ thư mục này và đẩy lên GitHub.
- Trên Render, tạo Web Service kết nối repository.
- Build Command: `npm install`
- Start Command: `npm start`
- Chọn Node runtime nếu được hỏi.
- Sau khi triển khai, dùng URL Render cấp phát làm liên kết học sinh truy cập.

## Cách chơi
- Giáo viên mở trang, chọn “Tạo phòng”, lưu mã PIN và mã quản trị.
- Học sinh mở cùng URL, nhập mã PIN và biệt danh.
- Giáo viên bấm bắt đầu, rồi bấm “Câu tiếp theo” để điều khiển nhịp chơi.
- Mỗi học sinh chỉ gửi một đáp án cho mỗi câu; phản hồi hiện ngay sau khi trả lời.
- Giáo viên có thể mở đáp án, xem bảng xếp hạng và tải CSV.

## Lưu ý vận hành
- Phiên bản này đồng bộ trực tiếp qua Socket.IO; phòng và điểm số lưu trong bộ nhớ máy chủ, phù hợp cho một phiên chơi trực tiếp. Dữ liệu phòng sẽ mất khi máy chủ khởi động lại hoặc dịch vụ ngủ/khởi động lại. Tải CSV sau buổi chơi để lưu kết quả.
- Đây là bản MVP dùng một tiến trình máy chủ; không dùng nhiều instance đồng thời nếu chưa cấu hình adapter và kho lưu trữ dùng chung.
- Mã PIN là mã tham gia; mã quản trị phòng cần được giữ riêng, không chia sẻ cho học sinh.
- Không yêu cầu học sinh nhập thông tin cá nhân nhạy cảm.
