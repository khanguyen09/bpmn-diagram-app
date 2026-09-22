# BPMN Studio

**Vẽ quy trình rõ ràng, phân vai dễ hiểu và lưu lại từng mốc thay đổi.**

BPMN Studio là ứng dụng web giúp bạn biến một quy trình thành sơ đồ có thể chỉnh sửa: ai làm việc gì, quyết định ở đâu, khi nào cần chờ và các bên trao đổi với nhau như thế nào. Phù hợp cho Business Analyst, Product Manager, đội vận hành và người đang học BPMN.

Dự án được tách từ phần BPMN Studio của **The Experience Blogs**, giữ bộ tính năng mô hình hoá hiện có trong một ứng dụng độc lập. Bạn có thể tự chạy trên máy hoặc triển khai với PostgreSQL của mình.

> **English:** A self-hosted, Vietnamese-first BPMN modeling studio with a visual editor, role-based swimlanes, profile-aware validation, persistent drafts, version milestones, and BPMN/SVG/PNG export.

## Bắt đầu nhanh

Cần **Node.js 24.18+ thuộc nhánh 24**, **pnpm 10.12.4**, **Git** và **Docker Compose** đang hoạt động.

```bash
git clone https://github.com/khanguyen09/bpmn-diagram-app.git
cd bpmn-diagram-app
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d --wait postgres
pnpm db:migrate
pnpm owner:provision
pnpm dev
```

Mở [BPMN Studio trên máy](http://localhost:3000/studio/diagram). Đăng nhập bằng `OWNER_EMAIL` và `OWNER_PASSWORD` trong tệp `.env` vừa được tạo.

`pnpm setup:local` tạo cấu hình local, khoá xác thực và mật khẩu ngẫu nhiên; không in bí mật ra terminal và không ghi đè `.env` đã có. Email ban đầu là `owner@example.com`. Bạn có thể đổi email, tên và mật khẩu trong `.env` **trước** bước `pnpm owner:provision`. Tệp này được Git bỏ qua và cần giữ riêng trên máy.

Docker chỉ chạy PostgreSQL; ứng dụng chạy bằng Node.js. Nếu đã có PostgreSQL 17, điền `DATABASE_URL` của bạn trong `.env` và bỏ qua bước Docker. Xem [hướng dẫn setup](docs/setup.md) để cấu hình, chạy production hoặc xử lý lỗi.

## Có thể làm gì?

| Nhu cầu | Tính năng |
| --- | --- |
| Vẽ quy trình | Canvas kéo thả, thư viện phần tử, nối luồng, sửa tên/thuộc tính, undo/redo, copy/paste |
| Thể hiện quyết định và ngoại lệ | Task, các loại gateway, sự kiện message/timer, boundary event và quy trình con theo profile |
| Làm rõ trách nhiệm | Pool, Lane và Lane lồng nhau; bố cục ngang/dọc; Message Flow giữa các bên |
| Giải thích dễ đọc | Chú thích, nhóm, màu, biểu tượng, danh sách bước và công cụ cân đối bố cục |
| Quản lý công việc | Thư viện quy trình, thư mục, di chuyển nhiều sơ đồ và phân trang |
| Lưu và khôi phục | Tự lưu bản nháp, lưu thủ công, lịch sử, mốc phiên bản, khôi phục và xử lý xung đột lưu |
| Mang sơ đồ đi nơi khác | Nhập BPMN XML; xuất `.bpmn`, SVG hoặc PNG |
| Quản lý truy cập | Tài khoản chủ sở hữu, đổi mật khẩu, xác thực hai bước và quản lý phiên đăng nhập |

Studio nhận diện **29 profile tương thích: 14 Core và 15 Collaboration**. Profile quy định phần tử và quy tắc được hỗ trợ; đây không phải 29 mẫu quy trình. Danh mục tạo mới và nâng cấp được giao diện hướng dẫn. Xem [tính năng và giới hạn](docs/features.md).

## Sơ đồ đầu tiên

1. Vào **Thư viện quy trình** → **Tạo quy trình mới**, đặt tên và chọn kiểu phù hợp.
2. Thêm điểm bắt đầu, công việc, nhánh quyết định và điểm kết thúc. Nếu cần phân trách nhiệm, chọn kiểu cộng tác và tạo Pool/Lane.
3. Chạy **Kiểm tra**, đọc các lỗi hoặc lưu ý rồi điều chỉnh.
4. Chờ máy chủ xác nhận lưu. Dùng **Lưu thành mốc** khi cần một phiên bản cố định, hoặc **Tải tệp** để xuất sơ đồ.

## Phạm vi hiện tại

- Đây là công cụ mô hình hoá. Chưa có workflow engine, thực thi tự động hay mô phỏng token.
- “Collaboration” mô tả nhiều bên trong sơ đồ BPMN; chưa phải tính năng nhiều người cùng sửa theo thời gian thực.
- Việc nhập, kiểm tra và lưu phụ thuộc profile. Không cam kết toàn bộ BPMN 2.0.2 hay mọi extension của Camunda, Signavio và công cụ khác.
- Màn hình nhỏ ưu tiên xem sơ đồ và danh sách bước; dùng màn hình rộng từ 768px để chỉnh sửa.
- Bản độc lập dùng tài khoản chủ sở hữu, không có đăng ký công khai. Không kèm giao diện/route CMS của The Experience Blogs hay dữ liệu người dùng từ ứng dụng gốc.

## Dành cho người phát triển

Nền tảng: Next.js App Router, React, TypeScript, bpmn-js, Prisma, PostgreSQL và Better Auth. Phiên bản cụ thể được ghim trong [package.json](package.json) và [pnpm-lock.yaml](pnpm-lock.yaml).

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Kiểm thử trình duyệt dùng kho dữ liệu thử riêng. Xem [CONTRIBUTING.md](CONTRIBUTING.md) trước khi chạy E2E. Xem [kết quả kiểm chứng](docs/verification.md), [đặc tả phạm vi](docs/specification.md) và lần chạy CI của từng commit.

## License

Mã nguồn và tài liệu do dự án sở hữu được phát hành theo **[MIT License](LICENSE)**, cho phép sử dụng, sửa đổi và phân phối lại, bao gồm mục đích thương mại, khi giữ thông báo bản quyền và giấy phép.

Các thành phần bên thứ ba giữ giấy phép riêng. Đặc biệt, **bpmn-js dùng giấy phép bpmn.io có điều kiện giữ watermark**, không phải MIT thuần. Fixture kiểm thử cũng có nguồn MIT, bpmn.io và CC BY 3.0. Xem [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) trước khi phân phối lại.
