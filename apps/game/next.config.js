const isLocalDev =
  !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

const CDNPath = process.env.STATIC_CDN_PATH;
const path = require('path');
const playRuntimeHost =
  process.env.BOX_PLAY_RUNTIME_HOST ||
  process.env.BOX_SERVER_HOST ||
  '127.0.0.1';
const editRuntimeHost =
  process.env.BOX_EDIT_RUNTIME_HOST ||
  process.env.BOX_EDIT_SERVER_HOST ||
  '127.0.0.1';
const playRuntimePort =
  process.env.BOX_PLAY_RUNTIME_PORT ||
  process.env.BOX_SERVER_PORT ||
  '9966';
const editRuntimePort =
  process.env.BOX_EDIT_RUNTIME_PORT ||
  process.env.BOX_EDIT_SERVER_PORT ||
  '9967';
const localPlayRuntime =
  process.env.BOX_INTERNAL_PLAY_RUNTIME ||
  `http://${playRuntimeHost}:${playRuntimePort}`;
const localEditRuntime =
  process.env.BOX_INTERNAL_EDIT_RUNTIME ||
  `http://${editRuntimeHost}:${editRuntimePort}`;

// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const config = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  output: 'standalone',
  // The source dev stack runs Creator, Play, and Player Service concurrently.
  // Keep their Next build outputs separate so hot reloads cannot overwrite one
  // another. Production keeps the normal `.next` directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Next may add its generated types/include entries to this file on first
  // start. The dev orchestrator gives each concurrent app instance its own
  // copy so Player Service, Creator, and Play cannot race on one tsconfig.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Runtime-owned content must never be captured in the standalone server or
  // Docker image. These directories are mounted by the host after deployment.
  outputFileTracingExcludes: {
    '*': [
      '../local-engine/projects/**/*',
      '../local-engine/data/**/*',
      '../local-engine/dist/**/*',
      '../local-engine/play-worlds/**/*',
      '../voxa/data/**/*',
    ],
  },
  assetPrefix: (!isLocalDev && CDNPath) || '',
  experimental: {
    // Local map requests can wait for the runtime's 30-minute startup window
    // before the first health check succeeds.
    proxyTimeout: 31 * 60 * 1000,
  },
  async rewrites() {
    const playerAdminAtRoot = process.env.BOX_DEPLOYMENT_MODE === 'player-service';
    return {
      beforeFiles: [
        {
          source: '/api/realtime/socket',
          has: [{ type: 'header', key: 'upgrade', value: 'websocket' }],
          destination: `http://127.0.0.1:${process.env.BOX_CREATOR_SCENE_SOCKET_PORT || 9968}/api/realtime/socket`,
        },
        {
          source: '/api/creator/v1/scene/socket',
          has: [{ type: 'header', key: 'upgrade', value: 'websocket' }],
          destination: `http://127.0.0.1:${process.env.BOX_CREATOR_SCENE_SOCKET_PORT || 9968}/api/creator/v1/scene/socket`,
        },
        // Player Service is a standalone administration site. Serve its Umi
        // entry at the origin without changing the address bar. Umi publishes
        // its HTML and static assets together under public/player-admin.
        ...(playerAdminAtRoot
          ? [{ source: '/', destination: '/player-admin/index.html' }]
          : []),
        // The play landing page is rendered by Next.js, while lifecycle
        // control for an installed world belongs to the play-library server.
        // Keep this narrow so ordinary /p/:world pages still render normally.
        {
          source: '/p/:world/__local_runtime/:path*',
          destination: `${localPlayRuntime}/:world/__local_runtime/:path*`,
        },
        // Private-room lifecycle routes sit one segment deeper than the main
        // world. Route them through the same Play Library handler so the
        // desktop container manager can show and destroy individual rooms.
        {
          source: '/p/:world/__room/:room/__local_runtime/:path*',
          destination: `${localPlayRuntime}/:world/__room/:room/__local_runtime/:path*`,
        },
        {
          source: '/runtime/play',
          has: [{ type: 'header', key: 'upgrade', value: 'websocket' }],
          destination: localPlayRuntime,
        },
        {
          source: '/runtime/play/:path*',
          has: [{ type: 'header', key: 'upgrade', value: 'websocket' }],
          destination: `${localPlayRuntime}/:path*`,
        },
        {
          source: '/runtime/edit',
          has: [{ type: 'header', key: 'upgrade', value: 'websocket' }],
          destination: localEditRuntime,
        },
        {
          source: '/runtime/edit/:path*',
          has: [{ type: 'header', key: 'upgrade', value: 'websocket' }],
          destination: `${localEditRuntime}/:path*`,
        },
        {
          source: '/runtime/play/:path*',
          destination: `${localPlayRuntime}/:path*`,
        },
        {
          source: '/runtime/edit/:path*',
          destination: `${localEditRuntime}/:path*`,
        },
        {
          source: '/',
          has: [{ type: 'header', key: 'upgrade', value: 'websocket' }],
          destination: localPlayRuntime,
        },
        {
          source: '/api/session',
          destination: `${localPlayRuntime}/api/session`,
        },
        {
          source: '/api/server-info',
          destination: `${localPlayRuntime}/api/server-info`,
        },
        {
          source: '/block/:path*',
          destination: `${localPlayRuntime}/block/:path*`,
        },
        {
          source: '/engine/:path*',
          destination: `${localPlayRuntime}/engine/:path*`,
        },
        {
          source: '/avatar/:path*',
          destination: `${localPlayRuntime}/avatar/:path*`,
        },
        {
          source: '/tmp/:path*',
          destination: `${localPlayRuntime}/tmp/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  headers() {
    return [
      {
        source: '/:path*',
        // 添加安全性 header 启用内存监控相关的 API
        headers: [
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "base-uri 'self'; frame-ancestors 'self' http://tauri.localhost tauri://localhost; object-src 'none'",
          },
        ],
      },
      {
        source: '/api/config/play/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
      {
        source: '/api/getMapInfo',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
      {
        source: '/api/createSession',
        headers: [
          {
            key: "Access-Control-Allow-Credentials",
            value: "true"
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "POST,OPTIONS"
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, Auth"
          },
        ],
      }
    ]
  },
  images: {
    //https://stackoverflow.com/questions/65487914/error-image-optimization-using-next-js-default-loader-is-not-compatible-with-n
    ...(process.env.NEXT_PUBLIC_EXPORT_MODE === 'true' && {
      loader: 'akamai',
      path: '',
    })
  },

  transpilePackages: [
    '@box/build-system',
    '@box/env',
    '@box/apis',
    'webgpu-utils',
  ],

  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: process.env.NEXT_TSCONFIG_PATH || 'tsconfig.json',
  },

  // TODO GameClient 通过 useEffect 初始化但没有提供 unmount，这里不能打开
  reactStrictMode: false,

  webpack: (...args) => {
    const getWebpackConfig = require('./webpack');
    return require('@box/deployment-routing/next-webpack')(getWebpackConfig(...args), {...args[1], dir:__dirname});
  },

};

module.exports = config;
