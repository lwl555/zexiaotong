# 择校通 · 单平台 + 设备自适应改版（2026-08-21）

## 本次改动
把"手机 H5 / 后台 / 桌面 AI 站"三套分离入口，合并为**一个平台、同一套 URL、设备自适应**：
- 检测到手机 → 自动套 H5 手机壳（底部 5 个 Tab：首页/发布/二手/社区/我的）
- 桌面 → 套桌面壳（顶部导航 + 更多下拉）
- 后台 `/admin` 仍是平台内的模块，且自身响应式（手机上侧栏变顶部横向菜单）
- **功能不变**：原桌面 AI 功能（AI百事通/实时资讯台/文档工坊/避雷清单/搞钱项目/关于）、新增的悬赏/二手/社区/钱包/私信/通知/我的，在同一套 URL 下两端都能用。手机端「我的」里加了 AI 工具九宫格入口，桌面「更多」里加了二手/社区/钱包入口。

## 架构
- `src/lib/useIsMobile.ts`：视口 ≤820 判手机，resize 实时切换。
- `src/lib/nav.ts`：统一导航配置。
- `App.tsx`：
  - `ResponsiveShell` 按设备选 `MobileLayout` / `Layout`（都用 `<Outlet/>`）。
  - `DeviceHome` 按设备选编辑式首页 / H5 首页。
  - 全部功能扁平路由（`/`、`/goods`、`/community`、`/wallet`、`/ai-search`…）；`/admin/*` 独立但同平台。
- `AdminLayout` 响应式：`hidden md:flex` 侧栏 + `md:hidden` 横向菜单。

## 修复的坑
- **Zustand v5 selector 返回新数组导致无限重渲染**：`GoodsList/PublishGoods/Notifications/Wallet` 的 `useStore(s => s.x.filter(...))` 改为先取原始数组再在组件体内 filter。
- 新增 `ErrorBoundary` 兜底，渲染异常时显示错误文本而非整页白屏。

## 验证
- `npm run build` 通过。
- 无头浏览器渲染 23 条路由全部正常，0 循环、0 报错；手机视口自动走 H5 壳，桌面视口走桌面壳，后台响应式生效。

## 预览
- 开发地址：`http://localhost:5173/zexiaotong/`（同一地址；手机/DevTools 设备模拟即见手机版）
- 尚未部署 GitHub Pages；数据为前端 mock。
