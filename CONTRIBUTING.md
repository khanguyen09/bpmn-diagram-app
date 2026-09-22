# Đóng góp cho BPMN Studio

Cảm ơn bạn đã giúp Studio dễ dùng và đáng tin cậy hơn. Có thể đóng góp sửa lỗi, cải thiện tài liệu, kiểm thử hoặc mở rộng khả năng mô hình hoá.

## Bắt đầu

1. Làm theo [hướng dẫn setup](docs/setup.md), dùng database phát triển riêng.
2. Tạo nhánh cho một thay đổi có mục tiêu rõ ràng.
3. Đối chiếu [phạm vi tính năng](docs/features.md), nhất là profile và giới hạn tương thích.
4. Cập nhật tài liệu cùng thay đổi hành vi, cấu hình hoặc cách sử dụng.

## Các vùng mã chính

| Vùng | Nội dung |
| --- | --- |
| `app/` | Trang Next.js và HTTP routes |
| `modules/process-modeling/` | Quy tắc BPMN, luồng ứng dụng, lưu trữ và Studio UI |
| `modules/identity-access/` | Đăng nhập, tài khoản và phiên |
| `platform/` | Cấu hình, database và hạ tầng dùng chung |
| `prisma/` | Schema và migration |
| `tests/` | Kiểm thử trình duyệt, hỗ trợ kiểm thử và fixture |

Giữ quy tắc miền tách khỏi UI và lớp lưu trữ. Khi thay đổi BPMN, kiểm tra loại phần tử, ID/tham chiếu, Pool/Process/Lane ownership, DI và save/reopen; một ảnh canvas đẹp chưa chứng minh dữ liệu đã lưu đúng.

## Kiểm tra trước khi gửi

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Thêm kiểm thử tái hiện cho bug hoặc hành vi mới khi phù hợp. Ưu tiên kiểm thử kết quả người dùng và các ranh giới dữ liệu; tránh kiểm thử chỉ lặp lại cấu trúc triển khai.

### Kiểm thử trình duyệt

```bash
pnpm test:e2e:install
```

Bộ E2E hiện có yêu cầu môi trường dùng riêng:

- `E2E_DATABASE_URL` trỏ tới PostgreSQL loopback, database mới có tên `experience_blogs_e2e_` và hậu tố hợp lệ. Tiền tố lịch sử này được giữ trong bộ bảo vệ dữ liệu.
- `DATABASE_URL` vẫn xác định database ứng dụng, phải khác database E2E.
- `E2E_RUN_ID` và `E2E_DATASTORE_MARKER` xác định lượt chạy và đánh dấu quyền ghi vào database thử.
- Database thử đã áp dụng migration, có owner thử và được chuẩn bị bằng `pnpm test:e2e:prepare`.
- Thông tin `OWNER_EMAIL`, `OWNER_PASSWORD` và cấu hình auth cho test được cấp qua môi trường của tiến trình chạy test.

Đọc [bộ bảo vệ datastore](tests/support/e2e-datastore-guard.ts), [script chuẩn bị](scripts/prepare-e2e-datastore.ts) và [Playwright config](playwright.config.ts) trước khi cấu hình. Không vô hiệu hoá guard, không dùng server production và không dùng database đang có sơ đồ thật.

Sau khi chuẩn bị đúng môi trường:

```bash
pnpm test:e2e
# Mỗi lượt đã hoàn tất sẽ thu hồi marker; chuẩn bị lại trước lượt kế tiếp.
pnpm test:e2e:prepare
pnpm test:e2e:mobile
```

Các bài kiểm thử có thể tạo/xoá dữ liệu trong database thử. Fixture trong `tests/fixtures/external/` được ghim theo nguồn và checksum; không chỉnh sửa byte gốc để làm test qua. Thêm fixture mới cùng provenance, license và phạm vi tuyên bố rõ ràng.

## Nội dung pull request

Mô tả vấn đề cụ thể, hành vi trước/sau, cách kiểm tra và giới hạn còn lại. Với giao diện, có thể kèm ảnh từ dữ liệu giả. Với nhập/xuất BPMN, nêu profile và tệp tái hiện đã loại dữ liệu riêng.

Không đưa vào Git `.env`, token, mật khẩu, cookie, trạng thái đăng nhập Playwright, database dump, báo cáo chứa dữ liệu thật hoặc tệp hệ thống như `._*`.

## License và nguồn bên thứ ba

Phần đóng góp do bạn sở hữu được cung cấp theo [MIT License](LICENSE) của dự án. Chỉ gửi nội dung bạn có quyền phân phối. Giữ thông báo bản quyền và điều kiện của các thành phần bên thứ ba theo [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Không gỡ hoặc che watermark bpmn.io. Đừng mô tả toàn bộ dependency/fixture là MIT hoặc tuyên bố chứng nhận BPMN/OMG chỉ vì test đang qua.
