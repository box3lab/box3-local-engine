<div align="center">
<img src="apps/deployment-manager/src-tauri/icons/icon.png" alt="BOX3 本地引擎图标" width="128" />

# BOX3 本地引擎

**在自己的电脑或服务器上创作、发布和运行网页多人 3D 游戏。**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![Node.js](https://img.shields.io/badge/Node.js-22.23.4-339933.svg)](https://nodejs.org/)
[![Rust](https://img.shields.io/badge/Rust-1.93.0-000000.svg)](https://www.rust-lang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED.svg)](https://www.docker.com/)

[下载安装](https://github.com/box3lab/box3-local-engine/releases) · [使用指南](https://docs.box3lab.com/local-engine/getting-started/first-start.html) · [开发文档](docs/README.md) · [问题反馈](https://github.com/box3lab/box3-local-engine/issues)

</div>
BOX3 本地引擎提供地图编辑、模型制作、地图脚本、多人游玩和服务管理。创作者通过浏览器制作作品，服主将作品部署到自己的服务器，玩家通过浏览器或玩家启动器进入游戏。

<table align="center" cellspacing="12" cellpadding="0">
  <tr>
    <td><img src="assets/readme/riverside-street.png" alt="BOX3 作品：水岸街区" width="560" /></td>
    <td><img src="assets/readme/arena.png" alt="BOX3 作品：竞技场" width="560" /></td>
  </tr>
  <tr>
    <td><img src="assets/readme/ancient-town.png" alt="BOX3 作品：古镇与楼塔" width="560" /></td>
    <td><img src="assets/readme/voxel-city.png" alt="BOX3 作品：体素城市" width="560" /></td>
  </tr>
</table>

## 项目能力

| 功能     | 说明                                                                   |
| -------- | ---------------------------------------------------------------------- |
| 地图创作 | 使用创作端 Creator（ARENA 编辑器）编辑场景、体素与脚本，预览并发布作品 |
| 模型制作 | 使用 VOXA 编辑模型、皮肤和动画，并将资源用于地图                       |
| 多人游玩 | 使用游玩端 Play 运行已发布地图，支持地图组与地图间传送                 |
| 玩家管理 | 通过 Player Service 和玩家管理后台管理账号、权限及游玩地图             |
| 自主部署 | 通过桌面部署管理器或 Linux Web 管理器配置、启动和维护服务              |
| 作品迁移 | 导出可编辑工程 `.boxproject`，或交付游玩包 `.boxplay`              |

部署管理器负责安装和管理服务器；**玩家启动器只负责连接已有服务器并游玩**。两者用途不同，创作和开服请选择部署管理器。

服务使用 Docker 运行，玩家身份与地图脚本持久数据使用 PostgreSQL，Redis 为可选组件。首次安装和镜像下载需要联网；完全离线的地图应选择“仅本地资源”，引用对象存储的地图仍需访问相应资源地址。

## 选择使用方式

| 你的目标                  | 推荐入口                                        | 需要准备                   |
| ------------------------- | ----------------------------------------------- | -------------------------- |
| 在自己的电脑上创作或开服  | [桌面安装](#桌面安装)                            | Docker 和桌面部署管理器    |
| 在 Linux 服务器上长期运行 | [服务器安装](#服务器安装)                        | Linux AMD64 / ARM64 服务器 |
| 修改引擎、编辑器或管理器  | [源码开发](#源码开发)                            | Git、Node.js 和开发环境    |
| 连接已有服务器游玩        | [玩家启动器说明](apps/player-launcher/README.md) | 服主提供的服务器地址与账号 |

### 桌面安装

1. 安装并启动 Docker：Windows、macOS 使用 [Docker Desktop](https://www.docker.com/products/docker-desktop/)；Linux 使用 Docker Engine 和 Compose v2。Windows 还需启用硬件虚拟化并安装 WSL 2。
2. 前往 [GitHub Releases](https://github.com/box3lab/box3-local-engine/releases)，选择桌面部署管理器对应的 ZIP，完整解压后打开 **BOX3 Engine Launcher**。
3. 按界面提示配置数据库和服务，等待所需镜像下载并启动，再按[首次启动指南](https://docs.box3lab.com/local-engine/getting-started/first-start.html)创建账号和配置创作权限。

桌面包支持 Windows x64 / ARM64、macOS Apple 芯片（ARM64）、Linux x64 / ARM64，具体文件以 Releases 为准。小规模游玩建议至少 4 核 CPU、8 GB 内存和 30 GB 可用磁盘；同时运行创作、模型和游玩服务，建议 8 核、16 GB 内存及 50 GB 可用磁盘起。

### 服务器安装

适用于无桌面的 Linux AMD64 / ARM64 服务器。推荐使用 Ubuntu、Debian 或 Alibaba Cloud Linux 3 / 4。联网安装器会准备 Docker Engine 和 Compose v2，下载并校验发行包，然后启动 Web 管理器。

```sh
curl -fsSL https://assets.box3.fun/local-engine/install.sh | sudo bash
```

安装后保存终端显示的管理地址和密钥：`BOX_SERVER_MANAGER_TOKEN` 用于 Web 管理器，`BOX_PLAY_ADMIN_TOKEN` 用于玩家后台。安装器默认开放 TCP `3130`；仅本机访问、SSH 隧道、数据库与防火墙配置见 [Linux 服务器指南](distribution/server/README.md)。

## 从创作到游玩

1. **准备账号**：服主配置玩家登录门户，创建玩家账号并授予创作权限。普通注册账号不会自动获得管理或创作权限。
2. **制作作品**：在 Creator 创建地图，通过 ARENA 编辑场景和脚本，使用 VOXA 制作模型，再进入预览。
3. **备份工程**：导出 `.boxproject`，用于继续编辑、迁移和协作。
4. **发布游玩**：发布并导出 `.boxplay`，由服主在玩家管理后台导入 Play；玩家登录后即可进入。

Play 展示已导入的发布地图，Creator 中正在编辑的工程不会自动出现在游玩列表。源码环境的完整操作示例见[首个作品教程](docs/first-project.md)。

玩家登录门户提供登录、注册、退出和账号设置页面，需要连接 Player Service。可以使用仓库中的[参考实现](apps/player-auth-portal/README.md)，或基于 [BOX3 玩家登录门户模板](https://github.com/box3lab/box3-engine-player-auth-template)定制，并在部署管理器中配置。

## 源码开发

使用 Node.js `22.23.4`，并提前启动 Docker。工作区由 Rush 管理，仓库脚本会准备锁定版本的 Rush 和 pnpm。原生管理器开发与 Rust 专项测试还需要 Rust stable 及平台工具链，详见[开发入门](docs/developer-guide.md)。

在终端执行：

```sh
git clone https://github.com/box3lab/box3-local-engine.git
cd box3-local-engine
npm run install:all
cp .env.docker.example .env
npm run check:workspace
npm run dev:infra
```

Windows PowerShell 使用 `Copy-Item .env.docker.example .env`；已有 `.env` 时跳过复制。`dev:infra` 会启动开发用 PostgreSQL、Redis 和源码服务，首次启动需要构建依赖。已有 PostgreSQL 时可配置 `BOX_DATABASE_URL`，改用 `npm run dev`。

服务就绪后，常用开发入口为：

| 入口            | 默认地址                   |
| --------------- | -------------------------- |
| 玩家登录门户    | `http://127.0.0.1:3125/` |
| 创作端 Creator  | `http://127.0.0.1:3127/` |
| 模型编辑器 VOXA | `http://127.0.0.1:3123/` |
| 游玩端 Play     | `http://127.0.0.1:3121/` |
| 玩家管理后台    | `http://127.0.0.1:8000/` |

源码开发产生的地图、模型、导入包、备份、导出和缓存统一放在仓库根目录 `.local-data/`，Git 与镜像构建均忽略该目录。可通过 `BOX_DEV_DATA_DIRECTORY` 更换开发数据根目录。账号和脚本持久数据仍在 PostgreSQL 中，备份作品目录不能代替数据库备份。

常用命令均在仓库根目录执行：

| 命令                                    | 用途                                   |
| --------------------------------------- | -------------------------------------- |
| `npm run dev:creator:infra`           | 启动创作栈与开发基础服务，缩小调试范围 |
| `npm run dev:manager`                 | 调试部署管理器网页界面                 |
| `npm run verify`                      | 检查格式、语法和代码风格               |
| `node scripts/check-documentation.js` | 检查本地文档链接与基础入口             |

目录职责见[架构指南](docs/architecture.md)，局部验证、数据库测试和平台验收见[测试指南](docs/testing.md)。镜像与安装包构建见[发布与版本说明](docs/release-and-version.md)。

## 文档

| 文档                                                                                  | 内容                               |
| ------------------------------------------------------------------------------------- | ---------------------------------- |
| [首次启动指南](https://docs.box3lab.com/local-engine/getting-started/first-start.html) | 安装后的配置、服务启动与使用       |
| [Linux 服务器指南](distribution/server/README.md)                                      | 无桌面服务器的安装、运维与备份     |
| [首个作品教程](docs/first-project.md)                                                  | 从账号准备到编辑、预览、导出和游玩 |
| [开发入门](docs/developer-guide.md)                                                    | 开发环境、数据目录、常用命令与排障 |
| [架构指南](docs/architecture.md)                                                       | 应用职责、服务连接与作品数据流     |
| [测试指南](docs/testing.md)                                                            | 自动检查范围和实际运行验收         |
| [全部文档](docs/README.md)                                                             | 模块说明、代码规范与发布流程       |

## 贡献与交流

欢迎提交问题反馈、文档修正、测试和代码改进。开始前请阅读[贡献指南](CONTRIBUTING.md)与[代码规范](docs/code-style.md)；社区贡献统一向 `dev` 分支提交 Pull Request。

- 问题与功能建议：[GitHub Issues](https://github.com/box3lab/box3-local-engine/issues)。报告时附上系统、版本、复现步骤和脱敏日志。
- 社区交流：QQ群「Box3Local秘密基地」，群号 [1107448537](https://qm.qq.com/q/yV2NR8skec)。

## 许可证

本项目基于 BOX3 UGC 平台的引擎研发基础拆分整理。平台（内部称为 `boxes`）不是本仓库的开源依赖，也不属于本仓库的发行内容；本项目聚焦本地创作、游玩、部署和服务管理。

本仓库采用 [MIT License](LICENSE.md)。第三方组件、字体、图片、模型和其他资源可能受各自许可约束，不会仅因存放在本仓库中就自动获得 MIT 授权。BOX3 名称、品牌、图标及相关商标也不包含在 MIT 授权内。

## 致谢

感谢曾经在深圳奇梦岛科技有限公司参与 BOX3 引擎研发、设计、测试、运营和基础设施建设的每一位伙伴，让今天这个 BOX3 本地引擎成为可能。
