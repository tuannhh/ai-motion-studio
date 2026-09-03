/**
 * Chuyển tiêu đề tiếng Việt thành slug URL (bỏ dấu, thường, nối gạch ngang).
 * Chỉ để URL đẹp/dễ đọc — việc tra dữ liệu luôn dựa vào publicId đi kèm, nên
 * slug lệch (đổi tên sau khi tạo link) không làm hỏng link cũ.
 */
export const slugify = (text: string, fallback = "video"): string => {
  const slug = text
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || fallback;
};

/** Ghép slug + publicId thành 1 segment URL, ví dụ "xu-huong-agentic-ai/1234abcd". */
export const entityPath = (feature: string, title: string, publicId: string): string =>
  `/${feature}/${slugify(title)}/${publicId}`;
