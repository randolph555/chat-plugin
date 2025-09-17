// Popup脚本 - 处理弹窗界面的交互逻辑

class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    // 绑定事件监听器
    this.bindEvents();
    
    // 检查扩展状态
    await this.checkExtensionStatus();
    
    // 检查当前页面
    await this.checkCurrentPage();
    
    // 检查模型配置状态
    await this.checkModelStatus();
  }

  bindEvents() {
    // 开启对话按钮
    const toggleChatBtn = document.getElementById('toggle-chat');
    toggleChatBtn.addEventListener('click', () => this.toggleChat());

    // 设置按钮
    const settingsBtn = document.getElementById('open-settings');
    settingsBtn.addEventListener('click', () => this.openSettings());

    // 帮助链接
    const helpLink = document.getElementById('help-link');
    helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });

    // 反馈链接
    const feedbackLink = document.getElementById('feedback-link');
    feedbackLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });
  }

  async checkExtensionStatus() {
    const statusElement = document.getElementById('extension-status');
    
    try {
      // 检查扩展是否正常工作
      const response = await this.sendMessageToBackground({ action: 'getConfig' });
      
      if (response && response.success) {
        statusElement.textContent = '正常运行';
        statusElement.className = 'status-value success';
      } else {
        statusElement.textContent = '配置错误';
        statusElement.className = 'status-value warning';
      }
    } catch (error) {
      statusElement.textContent = '连接失败';
      statusElement.className = 'status-value error';
      console.error('Extension status check failed:', error);
    }
  }

  async checkCurrentPage() {
    const pageElement = document.getElementById('current-page');
    const toggleBtn = document.getElementById('toggle-chat');
    
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url) {
        if (tab.url.includes('github.com')) {
          // 检查是否是仓库页面
          const isRepoPage = this.isGitHubRepoPage(tab.url);
          
          if (isRepoPage) {
            pageElement.textContent = 'GitHub仓库';
            pageElement.className = 'status-value success';
            toggleBtn.disabled = false;
            
            // 解析仓库信息
            const repoInfo = this.parseRepoFromUrl(tab.url);
            if (repoInfo) {
              pageElement.textContent = `${repoInfo.owner}/${repoInfo.repo}`;
            }
          } else {
            pageElement.textContent = 'GitHub (非仓库页面)';
            pageElement.className = 'status-value warning';
            toggleBtn.disabled = true;
            toggleBtn.textContent = '仅支持仓库页面';
          }
        } else {
          pageElement.textContent = '非GitHub页面';
          pageElement.className = 'status-value error';
          toggleBtn.disabled = true;
          toggleBtn.textContent = '请访问GitHub仓库';
        }
      } else {
        pageElement.textContent = '无法获取页面信息';
        pageElement.className = 'status-value error';
        toggleBtn.disabled = true;
      }
    } catch (error) {
      pageElement.textContent = '检查失败';
      pageElement.className = 'status-value error';
      toggleBtn.disabled = true;
      console.error('Current page check failed:', error);
    }
  }

  async checkModelStatus() {
    try {
      const response = await this.sendMessageToBackground({ action: 'getConfig' });
      
      if (response && response.success && response.data) {
        const config = response.data;
        const apiConfigs = config.apiConfigs || {};
        
        // 更新各个模型的状态
        this.updateModelStatus('OpenAI GPT-4', apiConfigs.openai);
        this.updateModelStatus('Google Gemini', apiConfigs.gemini);
        this.updateModelStatus('Anthropic Claude', apiConfigs.anthropic);
      }
    } catch (error) {
      console.error('Model status check failed:', error);
      // 如果检查失败，显示所有模型为未配置状态
      const indicators = document.querySelectorAll('.model-status-indicator');
      indicators.forEach(indicator => {
        indicator.textContent = '检查失败';
        indicator.setAttribute('data-status', 'error');
      });
    }
  }

  updateModelStatus(modelName, config) {
    const modelItems = document.querySelectorAll('.model-item');
    
    modelItems.forEach(item => {
      const nameElement = item.querySelector('.model-name');
      const statusElement = item.querySelector('.model-status-indicator');
      
      if (nameElement.textContent === modelName) {
        if (config && config.enabled && config.apiKey) {
          statusElement.textContent = '已配置';
          statusElement.setAttribute('data-status', 'configured');
        } else if (config && config.apiKey && !config.enabled) {
          statusElement.textContent = '已禁用';
          statusElement.setAttribute('data-status', 'warning');
        } else {
          statusElement.textContent = '未配置';
          statusElement.setAttribute('data-status', 'unconfigured');
        }
      }
    });
  }

  isGitHubRepoPage(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      // 匹配 /owner/repo 格式的路径
      const repoPattern = /^\/[^\/]+\/[^\/]+\/?/;
      return repoPattern.test(path) && 
             !path.includes('/settings') && 
             !path.includes('/notifications') &&
             !path.includes('/marketplace');
    } catch (error) {
      return false;
    }
  }

  parseRepoFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const match = path.match(/^\/([^\/]+)\/([^\/]+)/);
      
      if (match) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
    } catch (error) {
      console.error('Failed to parse repo from URL:', error);
    }
    
    return null;
  }

  async toggleChat() {
    const toggleBtn = document.getElementById('toggle-chat');
    const originalText = toggleBtn.textContent;
    
    try {
      // 显示加载状态
      toggleBtn.disabled = true;
      toggleBtn.innerHTML = '<div class="loading"></div> 启动中...';
      
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.id) {
        // 向content script发送消息以切换聊天窗口
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleChat',
          force: true 
        });
        
        // 关闭popup
        window.close();
      } else {
        throw new Error('无法获取当前标签页');
      }
    } catch (error) {
      console.error('Toggle chat failed:', error);
      
      // 恢复按钮状态
      toggleBtn.disabled = false;
      toggleBtn.textContent = originalText;
      
      // 显示错误提示
      this.showNotification('启动失败: ' + error.message, 'error');
    }
  }

  openSettings() {
    // 打开设置页面
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  }

  openHelp() {
    // 打开帮助页面
    chrome.tabs.create({
      url: 'https://github.com/your-repo/github-code-analyzer/wiki'
    });
    window.close();
  }

  openFeedback() {
    // 打开反馈页面
    chrome.tabs.create({
      url: 'https://github.com/your-repo/github-code-analyzer/issues'
    });
    window.close();
  }

  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;
    
    // 根据类型设置样式
    switch (type) {
      case 'success':
        notification.style.background = 'rgba(26, 127, 55, 0.1)';
        notification.style.color = 'var(--success-color)';
        notification.style.border = '1px solid rgba(26, 127, 55, 0.2)';
        break;
      case 'error':
        notification.style.background = 'rgba(209, 36, 47, 0.1)';
        notification.style.color = 'var(--danger-color)';
        notification.style.border = '1px solid rgba(209, 36, 47, 0.2)';
        break;
      case 'warning':
        notification.style.background = 'rgba(191, 135, 0, 0.1)';
        notification.style.color = 'var(--warning-color)';
        notification.style.border = '1px solid rgba(191, 135, 0, 0.2)';
        break;
      default:
        notification.style.background = 'rgba(9, 105, 218, 0.1)';
        notification.style.color = 'var(--primary-color)';
        notification.style.border = '1px solid rgba(9, 105, 218, 0.2)';
    }
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  sendMessageToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }
}

// 添加滑入动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// 初始化popup管理器
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});