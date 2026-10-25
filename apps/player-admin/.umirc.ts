import path from 'node:path';
import { defineConfig } from '@umijs/max';

export default defineConfig({
    antd: {},
    // Workspace dependencies are built locally; compile them directly in dev.
    mfsu: false,
    hash: true,
    // The Player Service rewrites its origin to this static entry point. Keep
    // assets under the same directory, otherwise root-relative Umi bundles are
    // handled by Next.js and return its 404 HTML page instead of CSS/JavaScript.
    base: '/',
    history: { type: 'hash' },
    publicPath: process.env.NODE_ENV === 'production' ? './player-admin/' : '/',
    proxy: {
        '/api': {
            target: process.env.PLAYER_ADMIN_DEV_API_URL || 'http://127.0.0.1:3124',
            changeOrigin: true,
            ws: true,
        },
    },
    // Build into a staging folder. The player-service image moves the generated
    // files to game/public so it never wipes the game's other public assets.
    outputPath: path.resolve(__dirname, '../game/public/player-admin'),
    npmClient: 'pnpm',
    // The static site is internally rewritten from / to /index.html by Next.
    routes: [
        { path: '/', component: '@/pages/index' },
        { path: '/index.html', component: '@/pages/index' },
    ],
    // 图标位于本应用的 public 目录；不要传构建机上的绝对文件路径，
    // 否则浏览器会把它当成无法访问的 HTTP 地址。
    favicons: ['./player-admin/favicon.png'],
    title: '后台管理',
});
