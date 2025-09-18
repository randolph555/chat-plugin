# GitHub代码分析助手 Chrome插件

一个专为GitHub代码库设计的Chrome浏览器插件，集成多种LLM服务，提供智能代码分析和对话功能。

## 🚀 核心功能

### 基础功能
- **GitHub页面集成**：在GitHub仓库页面自动注入聊天窗口，无需跳转
- **多LLM服务支持**：支持OpenAI、Gemini、Anthropic等主流LLM API
- **实时流式对话**：采用SSE技术实现流式响应，提供流畅的对话体验
- **文件内容引用**：支持 `@文件路径` 语法直接引用仓库中的文件内容

### 高级功能
- **智能文件预加载**：输入 `@` 时自动加载当前仓库的文件列表
- **多对话管理**：支持创建、切换和管理多个对话会话
- **图片上传支持**：支持上传图片进行多模态对话
- **窗口位置记忆**：自动保存和恢复聊天窗口的位置和大小
- **响应控制**：支持取消正在进行的AI响应

## 🛠️ 技术实现

### 架构设计
- **Chrome Extension Manifest V3**：现代化的扩展架构
- **模块化设计**：核心功能分离，便于维护和扩展
- **事件驱动**：基于消息传递的组件通信

### 核心模块
```
scripts/
├── chat-window.js           # 主聊天窗口管理
├── chat-window-core.js      # 窗口核心UI组件
├── api-manager.js           # LLM API统一管理
├── conversation-manager.js  # 多对话会话管理
├── simple-file-reference.js # 文件引用和预加载
├── image-upload-manager.js  # 图片上传处理
├── stream-handler.js        # SSE流式响应处理
└── storage-manager.js       # 本地存储管理
```

## 📦 安装使用

### 开发环境安装
1. 克隆项目到本地
```bash
git clone <repository-url>
cd chat-plugin
```

2. 在Chrome中加载扩展
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目根目录

### 配置设置
1. 点击扩展图标或访问设置页面
2. 配置LLM API信息：
   - **API Base URL**：服务商的API端点
   - **API Key**：你的API密钥
   - **模型选择**：选择要使用的具体模型
3. 保存配置并测试连接

### 使用方法
1. 访问任意GitHub仓库页面
2. 聊天窗口会自动出现在页面右侧
3. 开始与AI助手对话分析代码

## 🎯 使用示例

### 文件内容引用
```
@README.md 这个项目是做什么的？
@src/main.js 这个文件的主要功能是什么？
@package.json 项目使用了哪些依赖？
```

### 代码分析对话
```
这个仓库的整体架构是怎样的？
如何运行这个项目？
有什么潜在的改进建议吗？
```

## ⚙️ 配置选项

### API配置
每个LLM服务商支持以下配置：
- **Base URL**：API服务端点
- **API Key**：访问密钥
- **自定义模型**：添加和管理模型列表
- **创造性参数**：控制回复的创造性（0.1-1.0）
- **超时设置**：请求超时时间（默认2分钟）

### 界面设置
- **窗口位置**：自动记忆上次的位置和大小
- **主题适配**：自动适应系统深色/浅色模式
- **响应控制**：可随时取消AI响应

## 📁 项目结构

```
chat-plugin/
├── manifest.json              # Chrome扩展配置
├── background.js              # 后台服务脚本
├── content.js                 # 内容脚本入口
├── popup.html/js              # 扩展弹窗
├── options.html/js            # 设置页面
├── scripts/                   # 核心功能模块
│   ├── chat-window.js        # 主聊天窗口
│   ├── api-manager.js        # API管理
│   ├── conversation-manager.js # 对话管理
│   ├── simple-file-reference.js # 文件引用
│   ├── image-upload-manager.js # 图片处理
│   ├── stream-handler.js     # 流式响应
│   └── storage-manager.js    # 存储管理
├── styles/                    # 样式文件
│   ├── content.css           # 主样式
│   ├── modular-chat.css      # 聊天窗口样式
│   └── options.css           # 设置页面样式
└── assets/                    # 图标资源
```

## 🔧 开发相关

### 开发工具
```bash
npm run dev          # 开发模式（文件监听）
npm run lint         # 代码检查
npm run lint:fix     # 自动修复代码问题
npm run test         # 运行测试
npm run build        # 构建生产版本
```

### 代码规范
- 使用ES2021语法标准
- 遵循ESLint配置规则
- 采用模块化设计原则
- 保持代码简洁和可读性

## 🔒 隐私安全

- **本地存储**：所有配置和对话数据存储在本地
- **API安全**：API密钥仅在本地存储，不上传到任何服务器
- **最小权限**：仅请求必要的Chrome API权限
- **数据控制**：用户完全控制自己的数据

## 🚧 当前限制

- 仅支持GitHub.com网站
- 需要用户自行配置LLM API密钥
- 文件引用功能依赖GitHub页面结构
- 图片上传大小有限制

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork项目仓库
2. 创建功能分支
3. 进行开发和测试
4. 提交Pull Request

### 代码贡献
- 遵循现有的代码风格
- 添加必要的注释和文档
- 确保通过lint和test检查
- 保持向后兼容性

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 感谢各大LLM服务提供商的API支持
- 感谢Chrome Extensions开发社区
- 感谢所有测试用户的反馈和建议

---

**让AI成为你的GitHub代码分析助手！** 🚀