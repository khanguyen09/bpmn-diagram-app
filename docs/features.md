# Tính năng BPMN Studio

Tài liệu này mô tả phạm vi của mã nguồn hiện tại. Một phần tử chỉ được dùng khi profile của mô hình cho phép; việc có tên trong danh mục không đồng nghĩa mọi mô hình cũ đều hỗ trợ.

## 1. Vẽ và chỉnh sửa

Canvas hỗ trợ thêm phần tử từ thư viện, kéo thả, kết nối, chọn phần tử để đổi tên/thuộc tính, copy/paste và undo/redo. Danh sách bước giúp tìm và chọn các phần tử trong sơ đồ lớn. Bạn có thể thu gọn các bảng để tập trung vào canvas.

Các nhóm phần tử được mở dần theo profile:

| Nhóm | Phạm vi có trong hệ thống profile |
| --- | --- |
| Luồng cơ bản | Start Event, End Event, Task, Sequence Flow |
| Loại công việc | User Task, Service Task, Manual Task, Receive Task |
| Gateway | Exclusive, Parallel, Inclusive, Event-based, Complex |
| Sự kiện | Intermediate Catch/Throw, Message, Timer và Boundary Event trong các trường hợp được bộ kiểm tra hỗ trợ |
| Cộng tác | Participant/Pool, Process, Lane, Lane lồng nhau, Message Flow, bên ngoài dạng black-box |
| Cấu trúc | Sub-process, Call Activity và các tham chiếu được hỗ trợ |
| Dữ liệu | Data Object/Reference, Data Store/Reference, Data Input/Output Association |
| Giải thích | Text Annotation, Association, Group/Category |

Pool biểu diễn bên tham gia; Lane phân trách nhiệm trong một quy trình. Sequence Flow đi trong cùng Process, có thể qua Lane. Message Flow thể hiện trao đổi giữa các Pool. Biểu tượng “người thực hiện” trên Task không thay thế Lane phân vai.

## 2. Profile và tương thích

Có 14 profile Core và 15 profile Collaboration, bao gồm các đời Starter, Structured/Conditional/Event Routing, Task Types, Intermediate/Boundary Events, Full Authoring, Activity Containers, Data Authoring, Complex Routing và Subprocess Timers. Collaboration còn có khả năng bố cục swimlane riêng.

- **Core:** quy trình đơn, phát triển dần từ luồng cơ bản đến các phần tử nâng cao.
- **Collaboration:** nhiều bên tham gia, Pool/Lane và thông điệp, kèm các khả năng nâng cao tương ứng.
- Các ID có tiền tố `teb-` được giữ để tương thích với mô hình đã lưu; chúng không yêu cầu chạy toàn bộ ứng dụng blog.
- Khi mô hình cần khả năng mới, dùng luồng nâng cấp được giao diện cung cấp. Không đổi profile ID trực tiếp trong database để vượt kiểm tra.

Nguồn chính: [Core profiles](../modules/process-modeling/domain/core-profile.ts), [Collaboration profiles](../modules/process-modeling/domain/collaboration-profile.ts), [thư viện phần tử](../modules/process-modeling/ui/bpmn-node-library-catalogue.ts).

## 3. Bố cục và trình bày

Studio có công cụ cân đối nhánh/bố cục, bố trí swimlane ngang hoặc dọc, màu phần tử, biểu tượng và chú thích. Các tuỳ chọn phụ thuộc phần tử đang chọn và profile.

Màu và biểu tượng giúp đọc sơ đồ, không bổ sung ngữ nghĩa thực thi BPMN. Sau khi cân đối tự động, hãy kiểm tra vị trí Task trong đúng Lane, đường nối và nhãn. Với sơ đồ lớn, phân rã thành quy trình con thường dễ đọc hơn việc thu nhỏ mọi chữ.

Màn hình dưới 768px dùng chế độ xem và danh sách bước. Chỉnh sửa đầy đủ nên thực hiện trên máy tính hoặc màn hình rộng.

## 4. Thư viện và thư mục

Bạn có thể tạo và mở mô hình, đặt tên/mục đích, tổ chức theo thư mục, lọc theo thư mục và xem theo trang. Thao tác chọn nhiều cho phép di chuyển tối đa 100 mô hình trong một lượt chọn.

Xoá khỏi thư viện là thao tác lưu trữ mềm có xác nhận. Lịch sử được giữ trong kho dữ liệu; không nên hiểu nút này là xoá vật lý mọi dấu vết của mô hình.

## 5. Lưu nháp, mốc và khôi phục

| Khái niệm | Ý nghĩa |
| --- | --- |
| Bản nháp | Nội dung đang chỉnh sửa, có tự lưu và lưu thủ công |
| Revision | Lần thay đổi được máy chủ dùng để kiểm tra phiên bản khi ghi |
| Mốc phiên bản | Bản được lưu có chủ đích để tham chiếu về sau |
| Khôi phục | Đưa nội dung của mốc đã chọn về luồng chỉnh sửa hiện tại |
| Xung đột | Máy chủ đã có thay đổi khác so với phiên bản mà tab đang giữ |

Tự lưu cần kết nối, phiên đăng nhập hợp lệ và dữ liệu được máy chủ chấp nhận. Chỉ coi là đã lưu khi giao diện nhận xác nhận. Nếu lỗi lưu hoặc xung đột xuất hiện, giữ tab hiện tại, xem lựa chọn phục hồi và xuất bản dự phòng khi khả dụng trước khi tải lại. Hệ thống không cam kết chỉnh sửa offline hay tự hợp nhất mọi thay đổi.

## 6. Nhập, xuất và kiểm tra

Nhập BPMN XML cho phép tiếp tục làm việc với tệp ngoài. Xuất `.bpmn` giữ mô hình có thể chỉnh sửa; SVG phù hợp hình vector, PNG phù hợp chèn vào tài liệu hoặc bản trình bày.

Kiểm tra xem xét cấu trúc, tham chiếu, phạm vi profile và các quy tắc mô hình hoá được triển khai. Tệp có XML hợp lệ vẫn có thể bị từ chối vì phần tử/extension chưa hỗ trợ hoặc quy tắc an toàn. Không xem “0 lỗi” là bằng chứng quy trình đúng toàn bộ nghiệp vụ hay có thể chạy trên workflow engine.

Các [fixture bên ngoài](../tests/fixtures/external/THIRD_PARTY_NOTICES.md) có manifest ghi rõ nguồn, checksum và phạm vi kiểm thử. Một số mẫu được giữ để kiểm tra hành vi từ chối có chủ đích; chúng không phải bộ template đảm bảo nhập thành công.

## 7. Tài khoản và dữ liệu

Ứng dụng có một tài khoản chủ sở hữu được khởi tạo qua lệnh setup/provision, đăng nhập bằng email/mật khẩu và tuỳ chọn xác thực hai bước. Trang tài khoản hỗ trợ tên hiển thị, URL ảnh đại diện HTTPS, đổi mật khẩu và quản lý phiên đăng nhập. Chưa có tải tệp ảnh đại diện, đổi email qua xác minh hay đăng ký công khai.

Dữ liệu sơ đồ, bản nháp, mốc và tài khoản lưu trong PostgreSQL. Schema/migration lịch sử còn giữ một số cấu trúc từ ứng dụng gốc để tương thích tham chiếu; bản độc lập không có giao diện/route xuất bản blog và không đi kèm dữ liệu production.

## 8. Giới hạn cần hiểu

Ứng dụng chưa cung cấp workflow engine, tích hợp thực thi, mô phỏng token, cộng tác thời gian thực hoặc phân quyền tổ chức nhiều người dùng. Không tuyên bố chứng nhận OMG hay tương thích mọi nhà cung cấp. Khi chuyển qua công cụ khác, kiểm tra lại mô hình và extension tại công cụ đích.

Xem [README](../README.md) để bắt đầu và [setup](setup.md) để tự vận hành.
