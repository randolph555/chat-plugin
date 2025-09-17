# GitHub代码分析助手 Chrome插件

一个专为GitHub代码库设计的Chrome浏览器插件，集成多种LLM服务，提供智能代码分析和连续对话功能。

## 🚀 功能特性

### 核心功能
- **智能代码分析对话**：基于GitHub仓库的源码、README、文档等文件内容，提供精准的代码解释、功能分析和技术问答
- **多LLM服务集成**：支持OpenAI、Gemini、Anthropic等主流API协议，用户可自定义配置base_url、api_key和模型参数
- **实时流式响应**：采用SSE技术实现打字机效果的实时回复，提供流畅的对话体验
- **智能上下文管理**：结合LangChain思想，自动总结和压缩历史对话，保持对话连贯性的同时控制token消耗

### 高级功能
- **@文件名快速引用**：支持@文件名语法快速引用代码文件，提供智能提示和预加载功能
- **多媒体支持**：支持本地图片上传，自动生成缩略图，增强交互体验
- **自适应界面**：可拖拽调整的对话窗口，完美适配不同屏幕尺寸
- **配置管理**：完善的配置系统，支持多种个性化设置

## 🛠️ 技术架构

### 前端技术栈
- **Chrome Extension**: Manifest V3 架构
- **核心语言**: JavaScript/TypeScript
- **UI框架**: 原生HTML5 + CSS3
- **存储**: Chrome Storage API + IndexedDB

### 核心模块
- **多LLM API适配器**: 统一接口适配不同LLM服务商
- **上下文管理系统**: 基于LangChain思想的对话历史压缩和总结
- **文件系统交互**: GitHub API集成，代码库文件读取和索引
- **实时通信**: SSE流式响应处理
- **图片处理**: 本地图片上传、压缩、缩略图生成

## 📦 安装使用

### 开发环境安装
1. 克隆项目到本地
2. 打开Chrome浏览器，进入扩展程序管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"，选择项目文件夹
5. 插件安装完成

### 配置设置
1. 点击插件图标打开设置页面
2. 配置LLM服务商的API信息：
   - **OpenAI**: 设置API Key和Base URL
   - **Anthropic**: 配置Claude API访问信息
   - **Gemini**: 设置Google AI API密钥
3. 调整对话参数和界面设置
4. 保存配置

### 使用方法
1. 访问任意GitHub仓库页面
2. 插件会自动检测并注入聊天界面
3. 使用快捷键 `Ctrl+Shift+G` (Mac: `Cmd+Shift+G`) 打开/关闭聊天窗口
4. 开始与AI助手对话，分析代码库

## 🎯 使用场景

### 代码理解
- 询问特定函数或类的功能
- 理解复杂的代码逻辑和算法
- 分析项目架构和设计模式

### 文件引用
```
@src/components/Header.js 这个组件的作用是什么？
@package.json 项目使用了哪些主要依赖？
@README.md 如何运行这个项目？
```

### 技术问答
- 代码优化建议
- 潜在bug分析
- 最佳实践推荐
- 技术选型解释

## 🔧 配置选项

### LLM服务商配置
```json
{
  "openai": {
    "enabled": true,
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "your-api-key",
    "models": ["gpt-4", "gpt-3.5-turbo"],
    "defaultModel": "gpt-4"
  },
  "anthropic": {
    "enabled": false,
    "baseUrl": "https://api.anthropic.com/v1",
    "apiKey": "your-api-key",
    "models": ["claude-3-opus", "claude-3-sonnet"],
    "defaultModel": "claude-3-sonnet"
  }
}
```

### 对话设置
- **最大上下文长度**: 控制对话历史的token数量
- **自动总结阈值**: 触发上下文压缩的百分比
- **代码上下文保留**: 是否保留重要的代码片段
- **流式响应**: 启用实时打字机效果

### 界面设置
- **主题模式**: 自动/浅色/深色
- **窗口位置**: 左侧/右侧
- **字体大小**: 可调节的文字大小
- **动画效果**: 启用/禁用界面动画

## 📁 项目结构

```
chat-plugin/
├── manifest.json              # Chrome扩展配置文件
├── background.js              # 后台服务脚本
├── content.js                 # 内容脚本（页面注入）
├── popup.html                 # 插件弹窗页面
├── options.html               # 设置页面
├── scripts/                   # 核心脚本文件
│   ├── main.js               # 主入口文件
│   ├── chat-window.js        # 聊天窗口管理
│   ├── message-renderer.js   # 消息渲染器
│   ├── file-reference.js     # 文件引用管理
│   ├── context-manager.js    # 上下文管理
│   ├── github-api.js         # GitHub API集成
│   ├── llm-adapters.js       # LLM适配器
│   ├── storage-manager.js    # 存储管理
│   ├── image-handler.js      # 图片处理
│   ├── popup.js              # 弹窗脚本
│   └── options.js            # 设置页面脚本
├── styles/                    # 样式文件
│   ├── content.css           # 内容脚本样式
│   ├── popup.css             # 弹窗样式
│   └── options.css           # 设置页面样式
├── assets/                    # 资源文件
│   └── icon.svg              # 插件图标
└── README.md                  # 项目说明
```

## 🔒 隐私安全

- **本地存储**: 所有对话数据和配置信息均存储在本地
- **API安全**: API密钥加密存储，不会上传到任何服务器
- **权限最小化**: 仅请求必要的Chrome API权限
- **数据控制**: 用户完全控制数据的导出、导入和删除

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

### 开发环境设置
1. Fork项目仓库
2. 创建功能分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -am 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 创建Pull Request

### 代码规范
- 使用ES6+语法
- 遵循JSDoc注释规范
- 保持代码简洁和可读性
- 添加适当的错误处理

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 感谢 [Gitako](https://github.com/EnixCoda/Gitako) 项目提供的界面设计灵感
- 感谢所有LLM服务提供商的API支持
- 感谢开源社区的贡献和反馈

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [GitHub Issue](https://github.com/your-username/chat-plugin/issues)
- 发送邮件至: your-email@example.com

---

**让AI助手成为你的代码分析伙伴！** 🚀