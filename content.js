// Content Script - 重构版本
// 使用新的模块化架构，避免 GitHub API 403 错误

// 防止重复初始化
if (typeof window.GitHubChatAssistant !== 'undefined') {
  console.log('GitHubChatAssistant already exists, skipping initialization');
} else {

class GitHubChatAssistant {
  constructor() {
    this.isInitialized = false;
    this.chatWindow = null;
    this.config = null;
    
    // 延迟初始化，避免立即调用 GitHub API
    setTimeout(() => {
      this.init();
    }, 1000);
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      console.log('Initializing GitHub Chat Assistant...');
      
      // 检查是否在GitHub页面
      if (!this.isGitHubPage()) {
        console.log('Not on GitHub page, skipping initialization');
        return;
      }
      
      // 加载配置
      await this.loadConfig();
      
      // 创建聊天窗口（不依赖 GitHub API）
      await this.createChatWindow();
      
      // 绑定页面事件
      this.bindPageEvents();
      
      this.isInitialized = true;
      console.log('GitHub Chat Assistant initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize GitHub Chat Assistant:', error);
    }
  }

  // 检查是否在GitHub页面
  isGitHubPage() {
    return window.location.hostname === 'github.com';
  }

  // 加载配置
  async loadConfig() {
    try {
      // 从Chrome存储加载配置
      const result = await chrome.storage.sync.get(['config']);
      this.config = result.config || this.getDefaultConfig();
      console.log('Config loaded:', this.config);
    } catch (error) {
      console.error('Failed to load config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  // 获取默认配置
  getDefaultConfig() {
    return {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: '',
      baseUrl: '',
      uiSettings: {
        windowWidth: 400,
        windowPosition: 'right',
        rememberPosition: true,
        theme: 'auto'
      },
      conversationSettings: {
        maxTokens: 4000,
        temperature: 0.7,
        contextWindow: 10
      }
    };
  }

  // 创建聊天窗口
  async createChatWindow() {
    try {
      // 检查必要的类是否已加载
      if (!window.ChatWindow) {
        console.error('ChatWindow class not found');
        return;
      }

      if (!window.ChatWindowCore) {
        console.error('ChatWindowCore class not found');
        return;
      }

      if (!window.ImageUploadManager) {
        console.error('ImageUploadManager class not found');
        return;
      }

      if (!window.SimpleFileReference) {
        console.error('SimpleFileReference class not found');
        return;
      }

      // 创建聊天窗口实例
      this.chatWindow = new ChatWindow();
      await this.chatWindow.initialize(this.config);
      
      console.log('Chat window created successfully');
      
    } catch (error) {
      console.error('Failed to create chat window:', error);
      throw error;
    }
  }

  // 绑定页面事件
  bindPageEvents() {
    // 监听页面变化
    this.observePageChanges();
    
    // 监听来自background script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
    
    // 监听键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + G 切换聊天窗口
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        this.toggleChatWindow();
      }
    });
  }

  // 监听页面变化
  observePageChanges() {
    // 使用 MutationObserver 监听页面变化
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // 检查是否有重要的页面结构变化
          const addedNodes = Array.from(mutation.addedNodes);
          if (addedNodes.some(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            (node.classList?.contains('repository-content') || 
             node.classList?.contains('js-repo-nav'))
          )) {
            shouldUpdate = true;
          }
        }
      });
      
      if (shouldUpdate) {
        console.log('Page structure changed, updating context');
        // 这里可以更新文件列表等信息
        this.updatePageContext();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 更新页面上下文
  updatePageContext() {
    if (this.chatWindow && this.chatWindow.fileReference) {
      // 尝试从页面提取文件信息
      const files = this.extractFilesFromPage();
      if (files.length > 0) {
        this.chatWindow.fileReference.updateFileList(files);
        console.log('Updated file list with', files.length, 'files from page');
      }
    }
  }

  // 从页面提取文件信息
  extractFilesFromPage() {
    const files = [];
    
    try {
      // 从文件浏览器提取文件
      const fileLinks = document.querySelectorAll('.js-navigation-item .Link--primary');
      fileLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('/blob/')) {
          const pathMatch = href.match(/\/blob\/[^\/]+\/(.+)$/);
          if (pathMatch) {
            files.push(pathMatch[1]);
          }
        }
      });
      
      // 从面包屑导航提取当前路径
      const breadcrumbs = document.querySelectorAll('.breadcrumb a');
      breadcrumbs.forEach(crumb => {
        const href = crumb.getAttribute('href');
        if (href && href.includes('/tree/')) {
          const pathMatch = href.match(/\/tree\/[^\/]+\/(.+)$/);
          if (pathMatch) {
            files.push(pathMatch[1] + '/');
          }
        }
      });
      
    } catch (error) {
      console.error('Error extracting files from page:', error);
    }
    
    return [...new Set(files)]; // 去重
  }

  // 处理消息
  handleMessage(message, sender, sendResponse) {
    console.log('Received message:', message);
    
    switch (message.action) {
      case 'toggleChat':
        this.toggleChatWindow();
        sendResponse({ success: true });
        break;
        
      case 'updateConfig':
        this.updateConfig(message.config);
        sendResponse({ success: true });
        break;
        
      case 'getStatus':
        sendResponse({
          success: true,
          status: {
            initialized: this.isInitialized,
            chatVisible: this.chatWindow ? this.chatWindow.isVisible() : false,
            currentPage: window.location.href
          }
        });
        break;
        
      case 'readFile':
        this.readFileFromPage(message.filePath)
          .then(content => {
            sendResponse({ success: true, content: content });
          })
          .catch(error => {
            console.error('Failed to read file:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 保持消息通道开放以支持异步响应
        
      default:
        console.warn('Unknown message action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  // 从页面读取文件内容
  async readFileFromPage(filePath) {
    try {
      console.log(`尝试读取文件: ${filePath}`);
      
      // 方法1: 如果当前页面就是该文件，直接读取
      if (this.isCurrentFile(filePath)) {
        console.log('当前页面就是目标文件，直接读取');
        return this.getCurrentFileContent();
      }
      
      // 方法2: 尝试从GitHub页面的文件内容区域读取
      const fileContent = this.extractFileContentFromPage(filePath);
      if (fileContent) {
        console.log('从页面提取到文件内容');
        return fileContent;
      }
      
      // 方法3: 尝试通过GitHub的raw URL获取
      console.log('尝试通过GitHub raw URL获取文件');
      const rawContent = await this.fetchFileFromGitHub(filePath);
      console.log('通过raw URL成功获取文件内容');
      return rawContent;
      
    } catch (error) {
      console.error('Error reading file from page:', error);
      throw error;
    }
  }

  // 从页面提取文件内容
  extractFileContentFromPage(filePath) {
    try {
      // 检查是否在文件查看页面
      const codeContainer = document.querySelector('.blob-wrapper .highlight pre') || 
                           document.querySelector('.blob-code-content') ||
                           document.querySelector('[data-target="react-app.embeddedData"]');
      
      if (codeContainer) {
        const currentPath = this.getCurrentFilePath();
        if (currentPath && currentPath.endsWith(filePath)) {
          return codeContainer.textContent || codeContainer.innerText;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting file content from page:', error);
      return null;
    }
  }

  // 检查当前页面是否是指定文件
  isCurrentFile(filePath) {
    const currentPath = this.getCurrentFilePath();
    if (!currentPath) return false;
    
    // 精确匹配或路径结尾匹配
    const isMatch = currentPath === filePath || currentPath.endsWith('/' + filePath) || currentPath.endsWith(filePath);
    console.log(`文件匹配检查: 当前路径="${currentPath}", 目标文件="${filePath}", 匹配=${isMatch}`);
    return isMatch;
  }

  // 获取当前文件路径
  getCurrentFilePath() {
    try {
      // 从URL中提取路径（最可靠）
      const urlMatch = window.location.pathname.match(/\/blob\/[^\/]+\/(.+)$/);
      if (urlMatch) {
        const path = decodeURIComponent(urlMatch[1]);
        console.log(`从URL提取文件路径: ${path}`);
        return path;
      }
      
      // 从页面元素中获取
      const pathSelectors = [
        '[data-testid="breadcrumbs"]',
        '.js-path-segment',
        '.final-path',
        '.breadcrumb'
      ];
      
      for (const selector of pathSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const path = element.textContent.trim();
          console.log(`从页面元素提取文件路径: ${path}`);
          return path;
        }
      }
      
      console.log('无法获取当前文件路径');
      return null;
    } catch (error) {
      console.error('Error getting current file path:', error);
      return null;
    }
  }

  // 获取当前文件内容
  getCurrentFileContent() {
    try {
      const codeElement = document.querySelector('.blob-wrapper .highlight pre') ||
                         document.querySelector('.blob-code-content') ||
                         document.querySelector('pre code');
      
      if (codeElement) {
        return codeElement.textContent || codeElement.innerText;
      }
      
      throw new Error('无法找到文件内容元素');
    } catch (error) {
      console.error('Error getting current file content:', error);
      throw error;
    }
  }

  // 通过GitHub API获取文件内容
  async fetchFileFromGitHub(filePath) {
    // 从当前URL提取仓库信息
    const urlMatch = window.location.pathname.match(/\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) {
      throw new Error('无法从URL提取仓库信息');
    }
    
    const [, owner, repo] = urlMatch;
    const branch = this.getCurrentBranch() || 'main';
    
    console.log(`构建URL: owner=${owner}, repo=${repo}, branch=${branch}, filePath=${filePath}`);
    
    // 尝试多个分支
    const branches = [branch];
    if (branch === 'main' && !branches.includes('master')) {
      branches.push('master');
    } else if (branch === 'master' && !branches.includes('main')) {
      branches.push('main');
    }
    
    for (const currentBranch of branches) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${currentBranch}/${filePath}`;
        console.log(`尝试URL: ${rawUrl}`);
        
        const response = await fetch(rawUrl);
        if (response.ok) {
          const content = await response.text();
          console.log(`成功从分支 ${currentBranch} 获取文件内容`);
          return content;
        } else {
          console.log(`分支 ${currentBranch} 返回 ${response.status}`);
        }
      } catch (error) {
        console.log(`分支 ${currentBranch} 请求失败:`, error.message);
      }
    }
    
    throw new Error(`无法从任何分支获取文件 ${filePath}`);
  }

  // 获取当前分支
  getCurrentBranch() {
    try {
      // 方法1: 从URL中提取分支（最可靠）
      const urlMatch = window.location.pathname.match(/\/(?:blob|tree)\/([^\/]+)\//);
      if (urlMatch) {
        console.log(`从URL提取分支: ${urlMatch[1]}`);
        return urlMatch[1];
      }
      
      // 方法2: 从页面元素中获取
      const branchSelectors = [
        '[data-hotkey="w"] span',
        '.js-branch-select-menu span',
        '[data-testid="anchor-content"]',
        '.octicon-git-branch + span'
      ];
      
      for (const selector of branchSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const branch = element.textContent.trim();
          console.log(`从页面元素提取分支: ${branch}`);
          return branch;
        }
      }
      
      console.log('无法获取分支，使用默认值: main');
      return 'main';
    } catch (error) {
      console.error('Error getting current branch:', error);
      return 'main';
    }
  }

  // 切换聊天窗口
  toggleChatWindow() {
    if (this.chatWindow) {
      this.chatWindow.toggle();
      console.log('Chat window toggled');
    } else {
      console.warn('Chat window not initialized');
    }
  }

  // 更新配置
  async updateConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      await chrome.storage.sync.set({ config: this.config });
      console.log('Config updated:', this.config);
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  }

  // 显示聊天窗口
  showChatWindow() {
    if (this.chatWindow) {
      this.chatWindow.show();
    }
  }

  // 隐藏聊天窗口
  hideChatWindow() {
    if (this.chatWindow) {
      this.chatWindow.hide();
    }
  }

  // 获取状态
  getStatus() {
    return {
      initialized: this.isInitialized,
      chatVisible: this.chatWindow ? this.chatWindow.isVisible() : false,
      currentPage: window.location.href,
      config: this.config
    };
  }

  // 销毁实例
  destroy() {
    if (this.chatWindow) {
      this.chatWindow.destroy();
      this.chatWindow = null;
    }
    
    this.isInitialized = false;
    console.log('GitHub Chat Assistant destroyed');
  }
}

// 创建全局实例
window.GitHubChatAssistant = new GitHubChatAssistant();

} // 结束防重复声明的 else 块

// 导出到全局作用域
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubChatAssistant;
}