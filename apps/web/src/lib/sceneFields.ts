/**
 * Mô tả các field "chữ trên hình" sửa được cho từng loại scene — khớp với
 * SCENE_CONTENT_FIELDS phía server (packages/pipeline/src/scene-content.ts),
 * chỉ khác là ở đây có thêm nhãn tiếng Việt + loại input cho UI. Server mới là
 * nguồn sự thật cuối cùng (allow-list + validate lại bằng planSchema) — file
 * này chỉ quyết định hình dạng form, không phải bảo mật.
 */

export type ListSubfield = { key: string; label: string; textarea?: boolean };

export type FieldDescriptor =
  | { kind: "text"; key: string; label: string }
  | { kind: "textarea"; key: string; label: string }
  | { kind: "stringlist"; key: string; label: string; itemLabel: (i: number) => string }
  | { kind: "list"; key: string; label: string; itemLabel: (i: number) => string; subfields: ListSubfield[] }
  | { kind: "group"; key: string; label: string; fields: FieldDescriptor[] };

export const SCENE_FIELD_DESCRIPTORS: Record<string, FieldDescriptor[]> = {
  hook: [
    { kind: "text", key: "badge", label: "Nhãn nhỏ (badge)" },
    { kind: "textarea", key: "headline", label: "Tiêu đề chính" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
  ],
  points: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
    { kind: "list", key: "items", label: "Các mục", itemLabel: (i) => `Mục ${i + 1}`, subfields: [{ key: "text", label: "Nội dung" }] },
  ],
  flow: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
    { kind: "list", key: "nodes", label: "Các bước", itemLabel: (i) => `Bước ${i + 1}`, subfields: [{ key: "label", label: "Nhãn" }] },
    { kind: "list", key: "edges", label: "Nhãn mũi tên nối", itemLabel: (i) => `Mũi tên ${i + 1}`, subfields: [{ key: "label", label: "Nhãn" }] },
  ],
  diagram: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
    { kind: "list", key: "nodes", label: "Các nút", itemLabel: (i) => `Nút ${i + 1}`, subfields: [{ key: "label", label: "Nhãn" }] },
    { kind: "list", key: "edges", label: "Nhãn cạnh nối", itemLabel: (i) => `Cạnh ${i + 1}`, subfields: [{ key: "label", label: "Nhãn" }] },
  ],
  timeline: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
    {
      kind: "list", key: "steps", label: "Các mốc", itemLabel: (i) => `Mốc ${i + 1}`,
      subfields: [
        { key: "time", label: "Thời điểm" },
        { key: "label", label: "Nhãn" },
        { key: "desc", label: "Mô tả" },
      ],
    },
  ],
  compare: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    {
      kind: "group", key: "left", label: "Bên trái",
      fields: [
        { kind: "text", key: "label", label: "Nhãn" },
        { kind: "stringlist", key: "points", label: "Các ý", itemLabel: (i) => `Ý ${i + 1}` },
      ],
    },
    {
      kind: "group", key: "right", label: "Bên phải",
      fields: [
        { kind: "text", key: "label", label: "Nhãn" },
        { kind: "stringlist", key: "points", label: "Các ý", itemLabel: (i) => `Ý ${i + 1}` },
      ],
    },
  ],
  versus: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    {
      kind: "group", key: "left", label: "Bên trái",
      fields: [
        { kind: "text", key: "label", label: "Nhãn" },
        { kind: "text", key: "value", label: "Giá trị chốt" },
        { kind: "textarea", key: "detail", label: "Chi tiết" },
      ],
    },
    {
      kind: "group", key: "right", label: "Bên phải",
      fields: [
        { kind: "text", key: "label", label: "Nhãn" },
        { kind: "text", key: "value", label: "Giá trị chốt" },
        { kind: "textarea", key: "detail", label: "Chi tiết" },
      ],
    },
  ],
  stat: [
    { kind: "textarea", key: "label", label: "Nhãn số liệu" },
    { kind: "text", key: "unit", label: "Đơn vị (vd %, x, tỷ)" },
    { kind: "text", key: "source", label: "Nguồn số liệu" },
  ],
  quote: [
    { kind: "textarea", key: "text", label: "Nội dung trích dẫn" },
    { kind: "text", key: "author", label: "Tác giả" },
  ],
  rank: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
    { kind: "text", key: "source", label: "Nguồn số liệu" },
    {
      kind: "list", key: "items", label: "Các dòng xếp hạng", itemLabel: (i) => `Dòng ${i + 1}`,
      subfields: [
        { key: "label", label: "Nhãn" },
        { key: "unit", label: "Đơn vị" },
      ],
    },
  ],
  chart: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
    { kind: "text", key: "unit", label: "Đơn vị" },
    { kind: "text", key: "source", label: "Nguồn số liệu" },
    { kind: "list", key: "points", label: "Nhãn các điểm", itemLabel: (i) => `Điểm ${i + 1}`, subfields: [{ key: "label", label: "Nhãn" }] },
  ],
  media: [
    { kind: "text", key: "title", label: "Tiêu đề" },
    { kind: "textarea", key: "sub", label: "Phụ đề" },
    { kind: "textarea", key: "caption", label: "Chú thích ảnh" },
    { kind: "text", key: "credit", label: "Nguồn/giấy phép ảnh" },
  ],
  bigword: [
    { kind: "list", key: "phrases", label: "Các cụm từ", itemLabel: (i) => `Cụm ${i + 1}`, subfields: [{ key: "text", label: "Nội dung" }] },
  ],
  annotate: [
    { kind: "text", key: "kicker", label: "Kicker (nhãn nhỏ trên tiêu đề)" },
    { kind: "textarea", key: "headline", label: "Tiêu đề" },
    { kind: "textarea", key: "note", label: "Nội dung chú thích" },
  ],
  terminal: [
    { kind: "text", key: "title", label: "Tiêu đề cửa sổ" },
    { kind: "list", key: "lines", label: "Các dòng lệnh/output", itemLabel: (i) => `Dòng ${i + 1}`, subfields: [{ key: "text", label: "Nội dung" }] },
  ],
  screenshot: [
    { kind: "text", key: "kicker", label: "Kicker (nhãn nhỏ trên tiêu đề)" },
    { kind: "textarea", key: "headline", label: "Tiêu đề" },
    { kind: "text", key: "url", label: "Địa chỉ URL giả trên thanh trình duyệt" },
    { kind: "list", key: "markers", label: "Nhãn các chấm chú thích", itemLabel: (i) => `Chấm ${i + 1}`, subfields: [{ key: "label", label: "Nhãn" }] },
  ],
  outro: [
    { kind: "textarea", key: "headline", label: "Tiêu đề kết" },
    { kind: "text", key: "cta", label: "Kêu gọi hành động (CTA)" },
    { kind: "text", key: "handle", label: "Tên tài khoản/handle" },
  ],
};
