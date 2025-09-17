// 主入口文件
// 负责初始化所有模块并协调它们之间的交互

class GitHubChatAssistant {
  constructor() {
    this.initialized = false;
    this.currentRepository = null;
    this.modules = {};
    
    // 绑定方法
    this.handleMessage = this.handleMessage.bind(this);
    this.handleRepositoryChange = this.handleRepositoryChange.bind(this);
  }

  // 初始化助手
  async initialize() {
    try {
      console.log('Initializing GitHub Chat Assistant...');
      
      // 检查是否在GitHub页面
      if (!this.isGitHubPage()) {
        console.log('Not on GitHub page, skipping initialization');
        return;
      }
      
      // 初始化存储管理器
      this.modules.storage = new StorageManager();
      await this.modules.storage.initialize();
      
      // 获取配置
      const config = await this.modules.storage.getConfig();
      
      // 初始化其他模块
      await this.initializeModules(config);
      
      // 获取当前仓库信息
      this.currentRepository = await this.getCurrentRepository();
      
      if (this.currentRepository) {
        // 初始化GitHub API
        await this.modules.githubAPI.initialize(this.currentRepository);
        
        // 初始化文件引用管理器
        await this.modules.fileReference.initialize(this.modules.githubAPI);
        
        // 创建对话
        const conversationId = this.modules.contextManager.createConversation(this.currentRepository);
        
        // 创建聊天窗口
        await this.modules.chatWindow.initialize(this.currentRepository, conversationId);
        
        // 绑定事件
        this.bindEvents();
        
        console.log('GitHub Chat Assistant initialized successfully');
        this.initialized = true;
      } else {
        console.log('Could not detect repository information');
      }
    } catch (error) {
      console.error('Failed to initialize GitHub Chat Assistant:', error);
    }
  }

  // 初始化所有模块
  async initializeModules(config) {
    // GitHub API
    this.modules.githubAPI = new GitHubAPI();
    
    // LLM管理器
    this.modules.llmManager = new LLMManager();
    this.modules.llmManager.initialize(config);
    
    // 上下文管理器
    this.modules.contextManager = new ContextManager();
    
    // 文件引用管理器
    this.modules.fileReference = new FileReferenceManager();
    
    // 图片处理器
    this.modules.imageHandler = new ImageHandler();
    this.modules.imageHandler.initialize(config, this.modules.storage);
    
    // 消息渲染器
    this.modules.messageRenderer = new MessageRenderer();
    this.modules.messageRenderer.initialize(config);
    
    // 聊天窗口
    this.modules.chatWindow = new ChatWindow();
    
    // 初始化上下文管理器（需要其他模块）
    this.modules.contextManager.initialize(
      config,
      this.modules.fileReference,
      this.modules.llmManager
    );
  }

  // 检查是否在GitHub页面
  isGitHubPage() {
    return window.location.hostname === 'github.com' && 
           window.location.pathname.includes('/');
  }

  // 获取当前仓库信息
  async getCurrentRepository() {
    try {
      const pathParts = window.location.pathname.split('/').filter(part => part);
      
      if (pathParts.length < 2) {
        return null;
      }
      
      const owner = pathParts[0];
      const repo = pathParts[1];
      const fullName = `${owner}/${repo}`;
      
      // 尝试从存储中获取缓存的仓库信息
      let repositoryInfo = await this.modules.storage.getRepositoryData(fullName);
      
      if (!repositoryInfo || this.isRepositoryDataStale(repositoryInfo)) {
        // 从页面获取仓库信息
        repositoryInfo = this.extractRepositoryInfoFromPage();
        repositoryInfo.fullName = fullName;
        repositoryInfo.owner = owner;
        repositoryInfo.name = repo;
        
        // 保存到存储
        await this.modules.storage.saveRepositoryData(repositoryInfo);
      }
      
      return repositoryInfo;
    } catch (error) {
      console.error('Failed to get repository information:', error);
      return null;
    }
  }

  // 从页面提取仓库信息
  extractRepositoryInfoFromPage() {
    const info = {
      branch: 'main',
      language: null,
      description: null,
      isPrivate: false,
      stars: 0,
      forks: 0
    };
    
    // 获取分支信息
    const branchButton = document.querySelector('[data-hotkey="w"]');
    if (branchButton) {
      const branchText = branchButton.textContent.trim();
      if (branchText) {
        info.branch = branchText;
      }
    }
    
    // 获取语言信息
    const languageElement = document.querySelector('[itemprop="programmingLanguage"]');
    if (languageElement) {
      info.language = languageElement.textContent.trim();
    }
    
    // 获取描述
    const descriptionElement = document.querySelector('[itemprop="about"]');
    if (descriptionElement) {
      info.description = descriptionElement.textContent.trim();
    }
    
    // 检查是否为私有仓库
    const privateLabel = document.querySelector('.Label--secondary');
    if (privateLabel && privateLabel.textContent.includes('Private')) {
      info.isPrivate = true;
    }
    
    // 获取星标数
    const starElement = document.querySelector('#repo-stars-counter-star');
    if (starElement) {
      info.stars = parseInt(starElement.textContent.replace(/,/g, '')) || 0;
    }
    
    // 获取fork数
    const forkElement = document.querySelector('#repo-network-counter');
    if (forkElement) {
      info.forks = parseInt(forkElement.textContent.replace(/,/g, '')) || 0;
    }
    
    return info;
  }

  // 检查仓库数据是否过期
  isRepositoryDataStale(repositoryInfo) {
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    return Date.now() - repositoryInfo.cachedAt > maxAge;
  }

  // 绑定事件
  bindEvents() {
    // 监听页面变化
    this.observePageChanges();
    
    // 监听消息
    document.addEventListener('chatMessage', this.handleMessage);
    
    // 监听仓库变化
    document.addEventListener('repositoryChanged', this.handleRepositoryChange);
    
    // 监听配置变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.assistant_config) {
        this.handleConfigChange(changes.assistant_config.newValue);
      }
    });
    
    // 监听快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + G 打开/关闭聊天窗口
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        this.toggleChatWindow();
      }
    });
  }

  // 观察页面变化
  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        // 检查URL变化
        if (mutation.type === 'childList' && mutation.target === document.body) {
          const currentPath = window.location.pathname;
          if (this.lastPath !== currentPath) {
            this.lastPath = currentPath;
            shouldUpdate = true;
          }
        }
      });
      
      if (shouldUpdate) {
        this.handlePageChange();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.lastPath = window.location.pathname;
  }

  // 处理页面变化
  async handlePageChange() {
    const newRepository = await this.getCurrentRepository();
    
    if (newRepository && 
        (!this.currentRepository || 
         newRepository.fullName !== this.currentRepository.fullName ||
         newRepository.branch !== this.currentRepository.branch)) {
      
      this.currentRepository = newRepository;
      
      // 触发仓库变化事件
      document.dispatchEvent(new CustomEvent('repositoryChanged', {
        detail: { repository: newRepository }
      }));
    }
  }

  // 处理消息
  async handleMessage(event) {
    try {
      const { message, conversationId } = event.detail;
      
      // 添加用户消息到上下文
      await this.modules.contextManager.addMessage('user', message);
      
      // 获取完整上下文
      const context = this.modules.contextManager.getFullContext(conversationId);
      
      // 发送到LLM并获取流式响应
      const response = await this.modules.llmManager.sendMessageStream(context, {
        onChunk: (chunk) => {
          // 实时更新聊天窗口
          this.modules.chatWindow.updateStreamingResponse(chunk);
        },
        onComplete: async (fullResponse) => {
          // 添加助手回复到上下文
          await this.modules.contextManager.addMessage('assistant', fullResponse);
          
          // 完成响应
          this.modules.chatWindow.completeStreamingResponse(fullResponse);
        },
        onError: (error) => {
          console.error('LLM response error:', error);
          this.modules.chatWindow.showError('抱歉，发生了错误。请稍后重试。');
        }
      });
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.modules.chatWindow.showError('消息处理失败，请稍后重试。');
    }
  }

  // 处理仓库变化
  async handleRepositoryChange(event) {
    try {
      const { repository } = event.detail;
      
      // 重新初始化GitHub API
      await this.modules.githubAPI.initialize(repository);
      
      // 刷新文件引用管理器
      await this.modules.fileReference.refreshFileTree();
      
      // 创建新对话或切换到现有对话
      const existingConversations = await this.modules.storage.getConversationsByRepository(repository.fullName);
      
      let conversationId;
      if (existingConversations.length > 0) {
        // 使用最近的对话
        const latestConversation = existingConversations.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        conversationId = latestConversation.id;
        this.modules.contextManager.switchConversation(conversationId);
      } else {
        // 创建新对话
        conversationId = this.modules.contextManager.createConversation(repository);
      }
      
      // 更新聊天窗口
      this.modules.chatWindow.updateRepository(repository, conversationId);
      
      console.log(`Switched to repository: ${repository.fullName}`);
    } catch (error) {
      console.error('Failed to handle repository change:', error);
    }
  }

  // 处理配置变化
  async handleConfigChange(newConfig) {
    try {
      // 更新LLM管理器配置
      this.modules.llmManager.updateConfig(newConfig);
      
      // 更新图片处理器配置
      this.modules.imageHandler.initialize(newConfig, this.modules.storage);
      
      // 更新上下文管理器配置
      this.modules.contextManager.initialize(
        newConfig,
        this.modules.fileReference,
        this.modules.llmManager
      );
      
      console.log('Configuration updated');
    } catch (error) {
      console.error('Failed to handle config change:', error);
    }
  }

  // 切换聊天窗口
  toggleChatWindow() {
    if (this.modules.chatWindow) {
      this.modules.chatWindow.toggle();
    }
  }

  // 获取助手状态
  getStatus() {
    return {
      initialized: this.initialized,
      repository: this.currentRepository,
      modules: Object.keys(this.modules),
      conversations: this.modules.contextManager ? 
        this.modules.contextManager.getConversationList() : []
    };
  }

  // 销毁助手
  destroy() {
    try {
      // 移除事件监听器
      document.removeEventListener('chatMessage', this.handleMessage);
      document.removeEventListener('repositoryChanged', this.handleRepositoryChange);
      
      // 销毁所有模块
      Object.values(this.modules).forEach(module => {
        if (module && typeof module.destroy === 'function') {
          module.destroy();
        }
      });
      
      this.modules = {};
      this.initialized = false;
      
      console.log('GitHub Chat Assistant destroyed');
    } catch (error) {
      console.error('Failed to destroy assistant:', error);
    }
  }
}

// 全局实例
let assistantInstance = null;

// 初始化函数
async function initializeAssistant() {
  if (assistantInstance) {
    assistantInstance.destroy();
  }
  
  assistantInstance = new GitHubChatAssistant();
  await assistantInstance.initialize();
  
  // 暴露到全局作用域以便调试
  window.gitHubChatAssistant = assistantInstance;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAssistant);
} else {
  initializeAssistant();
}

// 导出
window.GitHubChatAssistant = GitHubChatAssistant;