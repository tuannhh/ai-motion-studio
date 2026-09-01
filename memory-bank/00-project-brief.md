# Project Brief — AI Motion Studio

**Là gì:** hệ thống tạo video motion-graphics dọc 1080×1920 tự động hoàn toàn bằng AI, có người duyệt kịch bản. Chuẩn thẩm mỹ tham chiếu: kênh TikTok/Facebook ainius.net (chữ động, sơ đồ, số liệu, hiệu ứng mượt — không talking head, không slideshow ảnh).

**Vì sao tồn tại:** dự án cũ `ai-video-studio` (Codex code, Claude audit — tại `/Users/tuanbui/Documents/MISA Event Management/ai-video-studio`) có backend/UI đạt chuẩn nhưng phần sáng tạo hình ảnh bằng FFmpeg rất xấu. User yêu cầu (2026-09-01) dựng **project mới độc lập** làm đúng phần sáng tạo, tận dụng được gì của dự án cũ thì vendor sang.

**Yêu cầu sản phẩm đầy đủ (lời user):**
1. Nhập ý tưởng + nguồn tư liệu (upload file / link Google Drive) hoặc AI tự tìm, hoặc kết hợp.
2. AI tạo 1 hoặc nhiều kịch bản: phong cách **đa chiều** (nhiều góc nhìn cùng chủ đề) hoặc **serie** (tập sau nối tập trước).
3. User duyệt kịch bản → AI render video với text motion, hình họa, hình khối, SFX, VFX.
4. Video xuất ra kết nối được Google Drive của creator.
5. **Template-from-video**: creator đưa video bất kỳ → AI phân tích → tạo format + style tương tự; trong template chỉnh được workflow pipeline.

**Kiến trúc đã chốt:** AI sinh JSON scene-spec (Zod + lint, fail-closed) → Remotion render. Xem `docs/ARCHITECTURE.md` (AD-01..06) và `docs/ROADMAP.md` (GĐ1 xong, GĐ2 server+web, GĐ3 template).

**Quy ước:**
- Backend GĐ2 phải theo skill `misa-backend-standard`; UI theo `misa-design-system` (MDS 2.0).
- Không import chéo với ai-video-studio — chỉ vendor file vào `packages/pipeline/src/vendor/`.
- `.env` chứa GEMINI_API_KEY (đã copy từ dự án cũ, gitignored).
