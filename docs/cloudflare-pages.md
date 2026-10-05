# Deploy CloudStay lên Cloudflare Pages

Tài liệu được kiểm tra theo hướng dẫn chính thức ngày **05/10/2026**. Chỉ hướng dẫn được tạo; dự án này không tự kết nối tài khoản hoặc deploy.

> Cloudflare hiện định hướng Workers cho phần lớn dự án mới, nhưng Pages và Git integration vẫn được hỗ trợ và có tài liệu chính thức. Vì mục tiêu của đồ án là Cloudflare Pages, cấu hình dưới đây vẫn phù hợp.

## Cấu hình build

| Trường | Giá trị |
| --- | --- |
| Production branch | `main` |
| Framework preset | `React (Vite)` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | để trống hoặc `/` |
| Node version | `22.16.0` qua `.node-version` |

`package.json` nằm ở repo root và Vite tạo `dist/index.html`, nên không cần root directory khác.

## Kết nối GitHub/GitLab

1. Push feature branch, tạo Pull Request và merge vào `main` sau khi review.
2. Trong Cloudflare Dashboard, mở **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** / **Import an existing Git repository**.
3. Authorize GitHub hoặc GitLab và chỉ cấp quyền cho repository cần thiết.
4. Chọn repository, production branch `main`, preset **React (Vite)** và các giá trị build ở trên.
5. Thêm biến môi trường cho Production và Preview.
6. Chọn **Save and Deploy**.
7. Mở build log, xác nhận npm install/build thành công và deployment trỏ đúng commit.

Mỗi push vào production branch tạo production deployment. Branch/PR khác có preview deployment và status check trong Git provider.

Một Pages project tạo bằng Git integration không thể đổi trực tiếp thành Direct Upload project về sau. Có thể tắt auto deployment và deploy bằng Wrangler vào project đó nếu cần quy trình CI riêng.

## Biến môi trường

Thêm trong Pages project settings, tách giá trị Production và Preview:

```text
VITE_USE_MOCK_API=true
VITE_IDENTITY_API_URL=https://identity.example.com
VITE_BOOKING_API_URL=https://booking.example.com
VITE_NOTIFICATION_API_URL=https://notification.example.com
VITE_API_TIMEOUT_MS=10000
```

Khuyến nghị deploy demo đầu tiên với `VITE_USE_MOCK_API=true` vì backend hiện chưa có contract khách sạn.

Vite thay thế `VITE_*` ở **build time** và nhúng vào JavaScript browser. Đây là dữ liệu công khai, luôn được đọc như chuỗi. Không đặt password, database URL có credential, service key, private token hoặc JWT signing secret ở đây.

Secret thật phải nằm ở backend, Worker hoặc Pages Function server-side. Sau khi đổi biến build-time, tạo/retry deployment để bundle mới nhận giá trị.

Cloudflare tự cung cấp một số biến build như `CI`, `CF_PAGES`, `CF_PAGES_COMMIT_SHA`, `CF_PAGES_BRANCH`, `CF_PAGES_URL`.

## React Router và SPA fallback

Cloudflare Pages có SPA fallback mặc định: nếu output **không có `404.html` ở top-level**, route không khớp asset được phục vụ từ root. Vì vậy repo này:

- không cần `_redirects` catch-all;
- cần giữ `dist/index.html`;
- không tạo `dist/404.html` ở top-level nếu muốn deep link như `/rooms/...`, `/bookings`, `/admin/rooms` hoạt động.

Chỉ thêm `_redirects` khi có rule tùy chỉnh thật sự. Catch-all quá rộng có thể ảnh hưởng asset, và redirect rules không áp dụng cho request do Pages Functions xử lý.

## CORS khi dùng API thật

CORS phải cấu hình ở từng backend service. Không có cách an toàn để “tắt CORS” từ React/browser.

Backend nên allow chính xác:

- production URL `https://<project>.pages.dev` và custom domain;
- các preview origin cần thiết, hoặc một chiến lược preview an toàn;
- methods/headers thực dùng, gồm `Authorization`, `Content-Type`, `Idempotency-Key`.

Không dùng wildcard origin cùng credential.

## Checklist sau deploy

1. **Deployments:** status Success, đúng branch và commit SHA; nếu lỗi, mở **View details** → build log.
2. **Root:** mở `https://<project>.pages.dev`; lỗi 404 root thường do output directory sai hoặc thiếu `dist/index.html`.
3. **Deep link:** dán trực tiếp `/rooms`, `/login`, một room detail và refresh để xác nhận SPA fallback.
4. **Asset:** DevTools Console/Network không có lỗi module; JS/CSS trả `200` và không có mixed content.
5. **Environment:** xác nhận app dùng mock hoặc API URL đúng môi trường.
6. **Smoke test:** tìm phòng, validation ngày sai, login, route guard, đặt phòng, booking conflict, hủy, notification, admin và 404.
7. **Responsive:** kiểm tra desktop và viewport điện thoại; chú ý search form, room card, bảng admin và modal.
8. **Preview:** test URL preview trước khi merge. Preview mặc định public; bật Access policy nếu dữ liệu không nên công khai.
9. **Custom domain:** kiểm tra cả `pages.dev` và domain riêng để phân biệt lỗi app với DNS.

Preview URL hash cũ vẫn truy cập được; branch alias luôn trỏ deployment mới nhất. Preview mặc định có header `X-Robots-Tag: noindex`.

Nếu cần rollback, chọn một production deployment build thành công trước đó. Preview deployment không phải rollback target.

## Nguồn chính thức

- [Cloudflare Pages — Get started](https://developers.cloudflare.com/pages/get-started/)
- [Deploy a React site](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Build image and Node versions](https://developers.cloudflare.com/pages/configuration/build-image/)
- [SPA rendering](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering)
- [Redirects](https://developers.cloudflare.com/pages/configuration/redirects/)
- [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Debugging Pages](https://developers.cloudflare.com/pages/configuration/debugging-pages/)
- [Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Vite static deploy](https://vite.dev/guide/static-deploy.html)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)
