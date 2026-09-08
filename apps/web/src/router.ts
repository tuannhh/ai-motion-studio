import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

/**
 * Router "địa chỉ" thuần — không có <router-view> nào mount route.component.
 * Shell.vue/MobileShell.vue tự đọc useRoute() và render bằng v-if sẵn có của
 * chúng (giữ nguyên logic cũ), router chỉ làm nguồn sự thật cho URL/back-forward
 * để mỗi trang tính năng + mỗi sản phẩm (video/template) có link riêng, xem
 * lại được, chia sẻ được. Component dưới đây chỉ là stub bắt buộc của kiểu route.
 */
const stub = { render: () => null };

export const FEATURE_ROUTES = {
  create: "/tao-video",
  studio: "/ban-dung",
  projects: "/video-da-tao",
  series: "/serie",
  templates: "/video-template",
  watermark: "/watermark",
  music: "/nhac-nen",
  users: "/nguoi-dung",
} as const;

/** Màn "Thêm" của bottom-nav mobile — thuần điều hướng UI (không phải trang
 * tính năng thật), chỉ mobile dùng nên tách khỏi FEATURE_ROUTES của desktop. */
export const MOBILE_MORE_ROUTE = "/them";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: FEATURE_ROUTES.create },
  { path: "/tai-dung/:templateId", name: "reconstruction", component: stub },
  { path: "/ban-dung/:scriptId", name: "studio", component: stub },
  { path: FEATURE_ROUTES.create, name: "create", component: stub },
  { path: FEATURE_ROUTES.projects, name: "projects", component: stub },
  {
    path: `${FEATURE_ROUTES.projects}/:slug/:id`,
    name: "project-detail",
    component: stub,
  },
  { path: FEATURE_ROUTES.series, name: "series", component: stub },
  { path: FEATURE_ROUTES.templates, name: "templates", component: stub },
  {
    path: `${FEATURE_ROUTES.templates}/:slug/:id`,
    name: "template-detail",
    component: stub,
  },
  { path: FEATURE_ROUTES.watermark, name: "watermark", component: stub },
  { path: FEATURE_ROUTES.music, name: "music", component: stub },
  { path: FEATURE_ROUTES.users, name: "users", component: stub },
  { path: MOBILE_MORE_ROUTE, name: "mobile-more", component: stub },
  { path: "/:pathMatch(.*)*", redirect: FEATURE_ROUTES.create },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
