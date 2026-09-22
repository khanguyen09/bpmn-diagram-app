# Setup và vận hành

## Chạy trên máy cá nhân

Cài Node.js **24.18.0 trở lên nhưng dưới 25**, pnpm **10.12.4**, Git và Docker có Compose. Kiểm tra:

```bash
node --version
pnpm --version
docker compose version
```

Nếu đã có Node.js nhưng chưa có pnpm, cài đúng phiên bản:

```bash
npm install --global pnpm@10.12.4
```

Lấy mã nguồn và tạo cấu hình:

```bash
git clone https://github.com/khanguyen09/bpmn-diagram-app.git
cd bpmn-diagram-app
pnpm install --frozen-lockfile
pnpm setup:local
```

`pnpm setup:local` tạo `.env` nếu chưa tồn tại. Khoá xác thực và mật khẩu chủ sở hữu được tạo ngẫu nhiên, không in ra màn hình. Mở `.env` bằng trình soạn thảo trên máy để xem thông tin đăng nhập hoặc đổi `OWNER_EMAIL`, `OWNER_NAME`, `OWNER_PASSWORD` trước khi tạo tài khoản. Email mặc định là `owner@example.com`, tên mặc định là `Owner`.

Không đưa `.env` vào Git, issue, ảnh chụp hoặc log chia sẻ. Chạy lại setup không ghi đè cấu hình cũ. Có thể kiểm tra cấu hình mà không hiện giá trị bí mật:

```bash
pnpm setup:check
```

Khởi động database, áp dụng cấu trúc và tạo chủ sở hữu:

```bash
docker compose up -d --wait postgres
docker compose exec postgres pg_isready -U bpmn -d bpmn_studio
pnpm db:migrate
pnpm owner:provision
pnpm dev
```

Nếu database chưa sẵn sàng, đợi đến khi `pg_isready` báo nhận kết nối rồi chạy migration. Mở [trang đăng nhập](http://localhost:3000/studio/login) và dùng thông tin trong `.env`. Sau khi đăng nhập, đến [thư viện quy trình](http://localhost:3000/studio/diagram).

`owner:provision` dành cho database mới, chỉ chạy một lần. Khi đã có user, lệnh sẽ từ chối để tránh tạo thêm chủ sở hữu. Thay `OWNER_PASSWORD` trong `.env` sau thời điểm này không đổi mật khẩu tài khoản đã lưu; dùng trang Tài khoản để đổi mật khẩu.

## PostgreSQL và dữ liệu

Compose dùng PostgreSQL 17, database `bpmn_studio`, user `bpmn`, cổng local `54339`. Cấu hình database trong quickstart chỉ dành cho máy phát triển. Dữ liệu nằm trong volume Docker và còn sau khi dừng container.

```bash
docker compose stop postgres
docker compose start postgres
```

Nếu dùng PostgreSQL riêng, bỏ bước Docker và cập nhật `DATABASE_URL` trước khi chạy `db:migrate`. Dùng database mới dành riêng cho Studio; không trỏ bản thử nghiệm vào database production của ứng dụng khác.

Cần sao lưu database để giữ cả tài khoản, thư mục, lịch sử và mốc phiên bản. Xuất `.bpmn` là bản sao của sơ đồ, không thay bản sao lưu toàn bộ database. Không dùng lệnh xoá volume khi muốn giữ dữ liệu.

Schema và migration giữ một số bảng/tham chiếu lịch sử của ứng dụng gốc. Đây là lựa chọn tương thích cấu trúc, không kích hoạt CMS và không mang theo nội dung người dùng.

## Các biến cấu hình

| Biến | Công dụng |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL; bắt đầu bằng `postgresql://` |
| `BETTER_AUTH_SECRET` | Bí mật xác thực riêng của môi trường, ít nhất 32 ký tự |
| `BETTER_AUTH_URL` | Origin chính của ứng dụng, mặc định `http://localhost:3000` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Các origin được tin cậy, phân cách bằng dấu phẩy; phải gồm origin chính |
| `OWNER_EMAIL` | Email dùng khi khởi tạo tài khoản |
| `OWNER_NAME` | Tên dùng khi khởi tạo tài khoản |
| `OWNER_PASSWORD` | Mật khẩu khởi tạo, từ 12 đến 128 ký tự |

Origin chỉ gồm giao thức, host và cổng nếu có. Không thêm `/studio/diagram`, query hoặc fragment. `localhost` và `127.0.0.1` là hai origin khác nhau; hãy mở đúng địa chỉ đã cấu hình. Khi đổi cổng hoặc domain, cập nhật cả URL chính và danh sách trusted origins rồi khởi động lại ứng dụng.

## Build và chạy production

Trước hết hoàn tất setup, migration và provisioning cho môi trường đó. Sau đó:

```bash
pnpm build
pnpm start
```

Khi triển khai ra Internet:

- Dùng PostgreSQL có thông tin truy cập riêng và cơ chế backup/restore.
- Cấp các biến môi trường qua hệ thống quản lý bí mật của nơi triển khai; không commit cấu hình thật.
- Đặt `BETTER_AUTH_URL` và `BETTER_AUTH_TRUSTED_ORIGINS` theo domain HTTPS thực tế. Bộ kiểm tra cấu hình yêu cầu HTTPS trong production, ngoại trừ loopback.
- Giữ `BETTER_AUTH_SECRET` ổn định và dùng giá trị khác môi trường phát triển.
- Chạy `pnpm db:migrate` cho mỗi đợt cập nhật có migration, rồi build/start bản mã tương ứng.
- Kiểm tra đăng nhập, lưu sơ đồ, mở lại, tạo mốc và xuất tệp sau triển khai.

Docker Compose trong quickstart cung cấp database cho phát triển, không phải bộ triển khai production hoàn chỉnh. Ứng dụng cần Node.js server; không thể chỉ xuất thành website HTML tĩnh vì có đăng nhập và lưu database.

Font giao diện hiện được tải từ Google Fonts. Khi không tải được, trình duyệt dùng font dự phòng; môi trường cần hoàn toàn offline phải tự cung cấp font phù hợp và giữ giấy phép tương ứng.

## Kiểm tra bản cài

```bash
pnpm setup:check
pnpm db:status
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Kiểm tra bằng giao diện: tạo quy trình → thêm Task → đợi lưu → quay lại thư viện → mở lại đúng mô hình → tạo mốc → xuất `.bpmn`. Như vậy bạn xác nhận cả giao diện và lưu dữ liệu, thay vì chỉ thấy trang chủ mở được.

Các bài E2E tạo dữ liệu thử và cần database riêng. Xem [CONTRIBUTING.md](../CONTRIBUTING.md); không dùng database đang chứa sơ đồ thật cho E2E.

## Xử lý lỗi thường gặp

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Không tìm thấy `pnpm` hoặc engine không phù hợp | Kiểm tra Node thuộc nhánh 24, tối thiểu 24.18.0, và pnpm 10.12.4 |
| `pnpm install --frozen-lockfile` báo lockfile không khớp | Dùng các tệp của cùng một commit; không bỏ frozen mode để che một bản checkout thiếu tệp |
| Không kết nối database | Kiểm tra container, `pg_isready`, cổng `54339` và `DATABASE_URL` |
| Cổng database đã được dùng | Đổi cổng host trong Compose và đổi cổng tương ứng trong `DATABASE_URL` |
| Migration báo lỗi | Xem `pnpm db:status`; xác nhận đúng database và quyền của user trước khi xử lý |
| Provision báo đã có user | Đăng nhập bằng tài khoản đã tạo; không xoá database chỉ để chạy lại provisioning |
| Đăng nhập báo origin không hợp lệ | So địa chỉ trình duyệt với hai biến auth origin; khởi động lại sau khi sửa |
| Mô hình không lưu được | Giữ tab, kiểm tra phiên đăng nhập/kết nối, đọc lỗi kiểm tra hoặc xung đột, xuất bản dự phòng nếu khả dụng |
| Tệp BPMN bị từ chối | Đọc thông báo profile và phần tử/extension không hỗ trợ; xem [giới hạn nhập tệp](features.md#6-nhập-xuất-và-kiểm-tra) |

Khi báo lỗi, ghi phiên bản/commit, hệ điều hành và các bước tái hiện. Dùng sơ đồ ví dụ đã loại dữ liệu riêng; không gửi mật khẩu, cookie hoặc chuỗi kết nối.
