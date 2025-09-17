// 新的聊天窗口管理器 - 重构版本
// 采用模块化架构，解决代码膨胀和功能冲突问题

class ChatWindow {
  constructor() {
    this.core = null;
    this.imageManager = null;
    this.fileReference = null;
    this.conversationManager = null;
    this.apiManager = null;
    this.isInitialized = false;
    this.config = null;
    this.messageHistory = [];
    this.isResponding = false; // 添加响应状态标志
    this.currentAbortController = null; // 用于取消AI响应
  }

  // 初始化聊天窗口
  async initialize(config) {
    try {
      this.config = config;
      
      // 初始化核心窗口
      this.core = new ChatWindowCore();
      await this.core.initialize(config);
      
      // 初始化API管理器
      this.apiManager = new ApiManager();
      await this.apiManager.initialize();
      
      // 初始化对话管理器
      this.conversationManager = new ConversationManager();
      this.conversationManager.initialize();
      
      // 初始化图片管理器
      this.imageManager = new ImageUploadManager();
      this.imageManager.initialize(this.core);
      
      // 初始化文件引用管理器（简化版本）
      this.fileReference = new SimpleFileReference();
      this.fileReference.initialize(this.core);
      
      // 初始化流式处理器
      this.streamHandler = new StreamHandler(this);
      
      // 初始化流式处理器
      this.streamHandler = new StreamHandler(this);
      
      // 延迟初始化模型选择器，确保API配置已加载
      setTimeout(async () => {
        await this.initializeModelSelector();
      }, 500);
      
      // 绑定额外事件
      this.bindAdditionalEvents();
      
      // 加载当前对话
      this.loadCurrentConversation();
      
      this.isInitialized = true;
      console.log('Chat window initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize chat window:', error);
      throw error;
    }
  }

  // 绑定额外事件
  bindAdditionalEvents() {
    const windowElement = this.core.getElement();
    if (!windowElement) return;

    // 对话管理按钮事件
    const newConversationBtn = windowElement.querySelector('.new-conversation-btn');
    const conversationHistoryBtn = windowElement.querySelector('.conversation-history-btn');
    const refreshModelsBtn = windowElement.querySelector('.refresh-models-btn');
    
    if (newConversationBtn) {
      newConversationBtn.addEventListener('click', () => {
        this.createNewConversation();
      });
    }
    
    if (conversationHistoryBtn) {
      conversationHistoryBtn.addEventListener('click', () => {
        this.toggleConversationHistory();
      });
    }
    
    if (refreshModelsBtn) {
      refreshModelsBtn.addEventListener('click', () => {
        this.reloadModels();
      });
    }
    
    // 添加测试文件加载的快捷键 (Ctrl+Shift+F)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.testFileLoading();
      }
    });

    // 对话历史面板事件
    const closeHistoryBtn = windowElement.querySelector('.close-history-btn');
    const clearAllBtn = windowElement.querySelector('.clear-all-btn');
    
    if (closeHistoryBtn) {
      closeHistoryBtn.addEventListener('click', () => {
        this.hideConversationHistory();
      });
    }
    
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        this.clearAllConversations();
      });
    }

    // 设置按钮事件
    const settingsBtn = windowElement.querySelector('.settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettings();
      });
    }

    // 发送按钮事件
    const sendBtn = windowElement.querySelector('.send-btn');
    const cancelBtn = windowElement.querySelector('.cancel-btn');
    const chatInput = windowElement.querySelector('#chat-input');
    
    if (sendBtn && chatInput) {
      sendBtn.addEventListener('click', () => {
        this.sendMessage();
      });
      
      // 回车发送消息
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      
      // 自动调整输入框高度
      chatInput.addEventListener('input', () => {
        this.adjustInputHeight();
      });
    }

    // 取消按钮事件
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.cancelResponse();
      });
    }
  }

  // 调整输入框高度
  adjustInputHeight() {
    const chatInput = this.core.getInputElement();
    if (!chatInput) return;

    chatInput.style.height = 'auto';
    const maxHeight = 120; // 最大高度
    const newHeight = Math.min(chatInput.scrollHeight, maxHeight);
    chatInput.style.height = newHeight + 'px';
  }

  // 发送消息
  async sendMessage() {
    const chatInput = this.core.getInputElement();
    if (!chatInput) return;

    const message = chatInput.value.trim();
    if (!message) return;

    // 防止在AI响应时发送消息
    if (this.isResponding) {
      console.log('AI正在响应中，请稍后再发送消息');
      return;
    }

    // 检查是否选择了模型
    const modelSelector = this.core.getElement()?.querySelector('#model-selector');
    if (!modelSelector || !modelSelector.value) {
      this.addMessage('system', '请先选择一个模型');
      return;
    }

    // 获取上传的图片
    const uploadedImages = this.imageManager.getUploadedImages();

    // 清空输入框和图片
    chatInput.value = '';
    this.adjustInputHeight();
    this.imageManager.clearAllImages();

    // 添加用户消息到界面
    this.addMessage('user', message, { images: uploadedImages });

    // 设置响应状态
    this.isResponding = true;
    this.updateSendButtonState();

    // 显示正在输入状态
    this.showTypingIndicator();

    try {
      // 设置当前模型
      this.apiManager.setCurrentModel(modelSelector.value);
      
      // 构建消息历史（包含图片）
      const messages = await this.buildMessageHistory(message, uploadedImages);
      
      // 创建AbortController用于取消请求
      this.currentAbortController = new AbortController();
      
      // 发送到LLM并处理流式响应
      const response = await this.apiManager.sendMessage(messages, { 
        stream: true,
        signal: this.currentAbortController.signal
      });
      
      // 隐藏输入指示器
      this.hideTypingIndicator();
      
      // 处理流式响应
      await this.streamHandler.handleStreamResponse(response, this.currentAbortController);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      this.hideTypingIndicator();
      this.addMessage('system', '发送消息失败: ' + error.message);
    } finally {
      // 重置响应状态
      this.isResponding = false;
      this.currentAbortController = null;
      this.updateSendButtonState();
    }
  }

  // 添加消息到界面
  addMessage(role, content, options = {}) {
    const messagesContainer = this.core.getMessagesContainer();
    if (!messagesContainer) return;

    // 移除欢迎消息
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    // 保存到对话管理器
    if (this.conversationManager) {
      this.conversationManager.addMessage(role, content, options);
      this.updateConversationTitle();
    }

    // 显示消息
    this.displayMessage(role, content, options);
    
    // 保存到历史记录（向后兼容）
    this.messageHistory.push({
      role,
      content,
      timestamp: Date.now(),
      images: options.images || []
    });
  }

  // 获取头像图标
  getAvatarIcon(role) {
    const icons = {
      'user': '👤',
      'assistant': '🤖',
      'system': '⚙️'
    };
    return icons[role] || '❓';
  }

  // 获取角色名称
  getRoleName(role) {
    const names = {
      'user': '用户',
      'assistant': '助手',
      'system': '系统'
    };
    return names[role] || role;
  }

  // 格式化消息内容
  formatMessageContent(content) {
    // 简单的HTML转义和格式化
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  // 显示正在输入指示器
  showTypingIndicator() {
    const messagesContainer = this.core.getMessagesContainer();
    if (!messagesContainer) return;

    // 移除已存在的指示器
    const existing = messagesContainer.querySelector('.typing-indicator');
    if (existing) {
      existing.remove();
    }

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <div class="message-wrapper">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;

    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // 隐藏正在输入指示器
  hideTypingIndicator() {
    const messagesContainer = this.core.getMessagesContainer();
    if (!messagesContainer) return;

    const indicator = messagesContainer.querySelector('.typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  // 更新发送按钮状态
  updateSendButtonState() {
    const windowElement = this.core.getElement();
    if (!windowElement) return;

    const sendBtn = windowElement.querySelector('.send-btn');
    const cancelBtn = windowElement.querySelector('.cancel-btn');
    const chatInput = windowElement.querySelector('#chat-input');
    
    if (sendBtn) {
      if (this.isResponding) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
        sendBtn.style.cursor = 'not-allowed';
        sendBtn.style.display = 'none';
      } else {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        sendBtn.style.cursor = 'pointer';
        sendBtn.style.display = 'inline-block';
        sendBtn.textContent = '发送';
      }
    }

    // 显示/隐藏取消按钮
    if (cancelBtn) {
      if (this.isResponding) {
        cancelBtn.style.display = 'inline-block';
      } else {
        cancelBtn.style.display = 'none';
      }
    }

    // 输入框始终保持可用
    if (chatInput) {
      chatInput.disabled = false; // 输入框永远可用
      if (this.isResponding) {
        chatInput.placeholder = 'AI正在响应中...';
      } else {
        chatInput.placeholder = '输入消息... (支持 @ 引用文件)';
      }
    }
  }

  // 取消AI响应
  cancelResponse() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.hideTypingIndicator();
      this.isResponding = false;
      this.currentAbortController = null;
      this.updateSendButtonState();
    }
  }

  // 打开设置
  openSettings() {
    try {
      // 尝试打开Chrome扩展设置页面
      chrome.runtime.sendMessage({action: 'openOptions'}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to open settings:', chrome.runtime.lastError);
          this.showInlineSettings();
        }
      });
    } catch (error) {
      console.error('Failed to open settings:', error);
      this.showInlineSettings();
    }
  }

  // 显示内联设置面板
  showInlineSettings() {
    // 移除已存在的设置面板
    const existing = document.querySelector('.inline-settings-overlay');
    if (existing) {
      existing.remove();
    }

    const settingsHTML = `
      <div class="inline-settings-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div class="inline-settings-panel" style="
          background: white;
          border-radius: 8px;
          padding: 20px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        ">
          <div class="settings-header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          ">
            <h3 style="margin: 0;">快速设置</h3>
            <button class="close-settings-btn" style="
              background: none;
              border: none;
              font-size: 20px;
              cursor: pointer;
              color: #666;
            ">×</button>
          </div>
          <div class="settings-content">
            <div class="setting-group" style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">API提供商:</label>
              <select id="quick-provider-select" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
              ">
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div class="setting-group" style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">API Key:</label>
              <input type="password" id="quick-api-key" placeholder="输入API密钥" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
              ">
            </div>
            <div class="setting-group" style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Base URL:</label>
              <input type="url" id="quick-base-url" placeholder="API基础URL (可选)" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
              ">
            </div>
            <div class="settings-actions" style="
              display: flex;
              gap: 10px;
              justify-content: flex-end;
            ">
              <button class="cancel-settings-btn" style="
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 4px;
                cursor: pointer;
              ">取消</button>
              <button class="save-quick-settings-btn" style="
                padding: 8px 16px;
                border: none;
                background: #0969da;
                color: white;
                border-radius: 4px;
                cursor: pointer;
              ">保存</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', settingsHTML);
    
    // 绑定事件
    const overlay = document.querySelector('.inline-settings-overlay');
    const closeBtn = overlay.querySelector('.close-settings-btn');
    const cancelBtn = overlay.querySelector('.cancel-settings-btn');
    const saveBtn = overlay.querySelector('.save-quick-settings-btn');
    
    const closeSettings = () => overlay.remove();
    
    closeBtn.addEventListener('click', closeSettings);
    cancelBtn.addEventListener('click', closeSettings);
    
    saveBtn.addEventListener('click', () => {
      const provider = overlay.querySelector('#quick-provider-select').value;
      const apiKey = overlay.querySelector('#quick-api-key').value;
      const baseUrl = overlay.querySelector('#quick-base-url').value;
      
      if (apiKey) {
        // 保存设置到Chrome存储
        const config = {};
        config[`${provider}-api-key`] = apiKey;
        if (baseUrl) {
          config[`${provider}-base-url`] = baseUrl;
        }
        
        chrome.storage.sync.set(config, () => {
          console.log('Settings saved:', config);
          closeSettings();
          this.addMessage('system', '设置已保存');
        });
      } else {
        alert('请输入API密钥');
      }
    });
    
    // 点击背景关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeSettings();
      }
    });
  }

  // 显示窗口
  show() {
    if (this.core) {
      this.core.show();
    }
  }

  // 隐藏窗口
  hide() {
    if (this.core) {
      this.core.hide();
    }
  }

  // 切换显示状态
  toggle() {
    if (this.core) {
      this.core.toggle();
    }
  }

  // 获取可见状态
  isVisible() {
    return this.core ? this.core.isVisible : false;
  }

  // 获取消息历史
  getMessageHistory() {
    return [...this.messageHistory];
  }

  // 清空消息历史
  clearMessageHistory() {
    this.messageHistory = [];
    const messagesContainer = this.core.getMessagesContainer();
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <h3>👋 欢迎使用 GitHub Chat Assistant</h3>
          <p>我可以帮助您分析代码、解答问题、生成文档等。</p>
        </div>
      `;
    }
  }

  // 销毁窗口
  destroy() {
    if (this.imageManager) {
      this.imageManager.destroy();
      this.imageManager = null;
    }
    
    if (this.fileReference) {
      this.fileReference.destroy();
      this.fileReference = null;
    }
    
    if (this.core) {
      this.core.destroy();
      this.core = null;
    }
    
    this.isInitialized = false;
    this.messageHistory = [];
  }

  // ===== 对话管理相关方法 =====

  // 加载当前对话
  loadCurrentConversation() {
    if (!this.conversationManager) return;

    const messages = this.conversationManager.getCurrentMessages();
    const messagesContainer = this.core.getMessagesContainer();
    
    if (!messagesContainer) return;

    // 清空当前消息显示
    messagesContainer.innerHTML = '';
    
    // 如果没有消息，显示欢迎信息
    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <h3>👋 欢迎使用 GitHub Chat Assistant</h3>
          <p>我可以帮助您分析代码、解答问题、生成文档等。</p>
        </div>
      `;
    } else {
      // 显示历史消息
      messages.forEach(message => {
        this.displayMessage(message.role, message.content, { 
          images: message.images || [],
          timestamp: message.timestamp 
        });
      });
    }

    // 更新标题
    this.updateConversationTitle();
  }

  // 创建新对话
  createNewConversation() {
    if (!this.conversationManager) return;

    // 检查当前对话是否为空（没有消息）
    const currentConversation = this.conversationManager.getCurrentConversation();
    if (currentConversation && currentConversation.messages.length === 0) {
      console.log('Current conversation is empty, not creating new one');
      return;
    }

    const conversationId = this.conversationManager.createNewConversation();
    this.loadCurrentConversation();
    
    console.log('Created new conversation:', conversationId);
  }

  // 切换对话历史面板显示状态
  toggleConversationHistory() {
    const panel = this.core.getElement()?.querySelector('#conversation-history-panel');
    if (!panel) return;

    if (panel.style.display === 'none') {
      this.showConversationHistory();
    } else {
      this.hideConversationHistory();
    }
  }

  // 显示对话历史面板
  showConversationHistory() {
    const panel = this.core.getElement()?.querySelector('#conversation-history-panel');
    if (!panel) return;

    panel.style.display = 'flex';
    this.renderConversationList();
  }

  // 隐藏对话历史面板
  hideConversationHistory() {
    const panel = this.core.getElement()?.querySelector('#conversation-history-panel');
    if (!panel) return;

    panel.style.display = 'none';
  }

  // 渲染对话列表
  renderConversationList() {
    if (!this.conversationManager) return;

    const listContainer = this.core.getElement()?.querySelector('#conversation-list');
    if (!listContainer) return;

    const conversations = this.conversationManager.getAllConversations();
    const currentId = this.conversationManager.currentConversationId;

    if (conversations.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-conversations">
          <div class="empty-icon">💬</div>
          <div class="empty-text">还没有对话记录</div>
          <button class="empty-action" data-action="create-new">
            开始新对话
          </button>
        </div>
      `;
      
      // 绑定空状态按钮事件
      const emptyAction = listContainer.querySelector('.empty-action');
      if (emptyAction) {
        emptyAction.addEventListener('click', () => {
          this.createNewConversation();
        });
      }
      return;
    }

    listContainer.innerHTML = conversations.map(conv => {
      const isActive = conv.id === currentId;
      const messageCount = conv.messages.length;
      const lastUpdate = new Date(conv.updatedAt).toLocaleString();
      
      return `
        <div class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${conv.id}">
          <div class="conversation-info">
            <div class="conversation-title">${this.escapeHtml(conv.title)}</div>
            <div class="conversation-meta">
              <span>${messageCount} 条消息</span>
              <span>${lastUpdate}</span>
            </div>
          </div>
          <div class="conversation-actions">
            <button class="delete-conversation-btn" title="删除" data-conversation-id="${conv.id}">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    listContainer.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // 如果点击的是按钮，不触发切换
        if (e.target.closest('.conversation-actions')) return;
        
        const conversationId = item.dataset.conversationId;
        this.switchToConversation(conversationId);
      });
    });

    // 绑定删除按钮事件
    listContainer.querySelectorAll('.delete-conversation-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const conversationId = btn.dataset.conversationId;
        this.deleteConversation(conversationId);
      });
    });
  }

  // 切换到指定对话
  switchToConversation(conversationId) {
    if (!this.conversationManager) return;

    if (this.conversationManager.switchToConversation(conversationId)) {
      this.loadCurrentConversation();
      this.hideConversationHistory();
    }
  }



  // 删除对话
  deleteConversation(conversationId) {
    if (!this.conversationManager) return;

    const conversation = this.conversationManager.conversations.get(conversationId);
    if (!conversation) return;

    if (confirm(`确定要删除对话"${conversation.title}"吗？此操作不可撤销。`)) {
      this.conversationManager.deleteConversation(conversationId);
      this.loadCurrentConversation();
      this.renderConversationList();
    }
  }

  // 清空所有对话
  clearAllConversations() {
    if (!this.conversationManager) return;

    if (confirm('确定要清空所有对话记录吗？此操作不可撤销。')) {
      this.conversationManager.clearAllConversations();
      this.loadCurrentConversation();
      this.hideConversationHistory();
    }
  }

  // 更新对话标题显示
  updateConversationTitle() {
    if (!this.conversationManager) return;

    const titleElement = this.core.getElement()?.querySelector('#conversation-title');
    if (!titleElement) return;

    const conversation = this.conversationManager.getCurrentConversation();
    if (conversation) {
      titleElement.textContent = conversation.title;
    } else {
      titleElement.textContent = 'GitHub Chat Assistant';
    }
  }

  // 显示消息（用于历史消息加载）
  displayMessage(role, content, options = {}) {
    const messagesContainer = this.core.getMessagesContainer();
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}-message`;
    
    const timestamp = options.timestamp ? 
      new Date(options.timestamp).toLocaleTimeString() : 
      new Date().toLocaleTimeString();
    
    let imageHtml = '';
    if (options.images && options.images.length > 0) {
      imageHtml = `
        <div class="message-images">
          ${options.images.map(img => `
            <img src="${img.data}" alt="${img.name}" class="message-image" />
          `).join('')}
        </div>
      `;
    }
    
    messageElement.innerHTML = `
      <div class="message-wrapper">
        <div class="message-avatar">
          ${this.getAvatarIcon(role)}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-role">${this.getRoleName(role)}</span>
            <span class="message-time">${timestamp}</span>
          </div>
          ${imageHtml}
          <div class="message-text">${this.formatMessageContent(content)}</div>
        </div>
      </div>
    `;

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 初始化模型选择器
  async initializeModelSelector() {
    console.log('Initializing model selector...');
    
    const modelSelector = this.core.getElement()?.querySelector('#model-selector');
    const modelDisplay = this.core.getElement()?.querySelector('#current-model-display .model-name');
    
    if (!modelSelector) {
      console.error('Model selector element not found');
      return;
    }

    // 确保API管理器已初始化并加载配置
    if (!this.apiManager) {
      console.error('API manager not initialized');
      return;
    }

    // 强制重新加载配置
    await this.apiManager.loadConfig();
    
    // 获取可用模型
    const models = this.apiManager.getAvailableModels();
    console.log('Available models:', models);
    console.log('API Manager config:', this.apiManager.config);
    
    // 清空现有选项
    modelSelector.innerHTML = '';
    
    if (models.length === 0) {
      modelSelector.innerHTML = '<option value="">未配置模型</option>';
      modelSelector.disabled = true;
      if (modelDisplay) {
        modelDisplay.textContent = '请先配置API';
      }
      console.log('No models available - check API configuration');
    } else {
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.fullName;
        option.textContent = model.display;
        modelSelector.appendChild(option);
      });
      
      modelSelector.disabled = false;
      
      // 自动选择第一个模型
      if (models.length > 0) {
        modelSelector.value = models[0].fullName;
        this.apiManager.setCurrentModel(models[0].fullName);
        if (modelDisplay) {
          modelDisplay.textContent = models[0].display;
        }
      }
      
      console.log(`Added ${models.length} models to selector`);
    }

    // 移除之前的事件监听器
    const newSelector = modelSelector.cloneNode(true);
    modelSelector.parentNode.replaceChild(newSelector, modelSelector);

    // 绑定变化事件
    newSelector.addEventListener('change', (e) => {
      const selectedModel = e.target.value;
      console.log('Model selector changed:', selectedModel);
      
      if (selectedModel) {
        this.apiManager.setCurrentModel(selectedModel);
        const model = models.find(m => m.fullName === selectedModel);
        if (model && modelDisplay) {
          modelDisplay.textContent = model.display;
        }
        console.log('Selected model:', selectedModel);
      }
    });

    // 增强文件引用功能，支持@model
    this.enhanceFileReference();
  }

  // 更新模型显示
  updateModelDisplay(fullModelName) {
    const modelDisplay = this.core.getElement()?.querySelector('#current-model-display .model-name');
    if (!modelDisplay || !fullModelName) return;

    const models = this.apiManager.getAvailableModels();
    const selectedModel = models.find(m => m.fullName === fullModelName);
    
    if (selectedModel) {
      modelDisplay.textContent = `${selectedModel.display}`;
      modelDisplay.title = `${selectedModel.display} (${selectedModel.provider})`;
    }
  }

  // 增强文件引用功能，支持@model快速选择
  enhanceFileReference() {
    if (!this.fileReference) return;

    // 扩展文件引用的触发词
    const originalHandleAtSymbol = this.fileReference.handleAtSymbol;
    if (originalHandleAtSymbol) {
      this.fileReference.handleAtSymbol = (inputElement, cursorPosition) => {
        const textBeforeCursor = inputElement.value.substring(0, cursorPosition);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);
        
        if (atMatch) {
          const query = atMatch[1].toLowerCase();
          
          // 如果是@model，显示模型选择
          if (query === 'model' || 'model'.startsWith(query)) {
            this.showModelSelector(inputElement, cursorPosition, atMatch[0]);
            return;
          }
        }
        
        // 否则使用原始的文件引用功能
        originalHandleAtSymbol.call(this.fileReference, inputElement, cursorPosition);
      };
    }
  }

  // 显示模型选择下拉框
  showModelSelector(inputElement, cursorPosition, matchText) {
    const models = this.apiManager.getAvailableModels();
    if (models.length === 0) return;

    // 创建下拉框
    const dropdown = document.createElement('div');
    dropdown.className = 'file-autocomplete-dropdown';
    dropdown.style.display = 'block';

    // 添加模型选项
    models.forEach(model => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerHTML = `
        <span class="file-icon">🤖</span>
        <span class="file-name">${model.display}</span>
        <span class="file-path">${model.provider}</span>
      `;
      
      item.addEventListener('click', () => {
        // 替换@model为选中的模型
        const beforeMatch = inputElement.value.substring(0, cursorPosition - matchText.length);
        const afterCursor = inputElement.value.substring(cursorPosition);
        inputElement.value = beforeMatch + `@${model.display} ` + afterCursor;
        
        // 设置当前模型
        this.apiManager.setCurrentModel(model.fullName);
        this.updateModelDisplay(model.fullName);
        
        // 更新选择器
        const modelSelector = this.core.getElement()?.querySelector('#model-selector');
        if (modelSelector) {
          modelSelector.value = model.fullName;
        }
        
        // 移除下拉框
        dropdown.remove();
        
        // 聚焦输入框
        inputElement.focus();
        const newCursorPos = beforeMatch.length + model.display.length + 2;
        inputElement.setSelectionRange(newCursorPos, newCursorPos);
      });
      
      dropdown.appendChild(item);
    });

    // 定位下拉框
    const rect = inputElement.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = (rect.top - dropdown.offsetHeight - 5) + 'px';
    dropdown.style.zIndex = '999999';

    // 添加到页面
    document.body.appendChild(dropdown);

    // 点击外部关闭
    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target) && e.target !== inputElement) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 100);
  }

  // 构建消息历史（包含图片）
  async buildMessageHistory(currentMessage, images = []) {
    const messages = [];
    
    // 添加系统提示（可选）
    messages.push({
      role: 'system',
      content: 'You are a helpful AI assistant for GitHub code analysis. Please provide clear and concise responses.'
    });

    // 添加对话历史（最近10条消息）
    const conversation = this.conversationManager.getCurrentConversation();
    if (conversation && conversation.messages) {
      const recentMessages = conversation.messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.role !== 'system') {
          const processedContent = await this.processFileReferences(msg.content);
          messages.push({
            role: msg.role,
            content: processedContent
          });
        }
      }
    }

    // 处理当前消息中的文件引用
    const processedMessage = await this.processFileReferences(currentMessage);
    
    // 添加当前消息（包含图片）
    const currentMsg = {
      role: 'user',
      content: processedMessage
    };
    
    if (images && images.length > 0) {
      currentMsg.images = images;
    }
    
    messages.push(currentMsg);

    return messages;
  }

  // 处理文件引用，将 @文件路径 替换为实际文件内容
  async processFileReferences(message) {
    // 匹配 @文件路径 模式
    const fileRefPattern = /@([^\s]+)/g;
    let processedMessage = message;
    const matches = [...message.matchAll(fileRefPattern)];
    
    for (const match of matches) {
      const filePath = match[1];
      const fullMatch = match[0]; // @文件路径
      
      try {
        // 读取文件内容
        const fileContent = await this.readFileContent(filePath);
        
        // 替换 @文件路径 为文件内容
        const replacement = `\n\n**文件: ${filePath}**\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
        processedMessage = processedMessage.replace(fullMatch, replacement);
        
        console.log(`✅ 已处理文件引用: ${filePath}`);
      } catch (error) {
        console.log(`⚠️ 无法读取文件 ${filePath}, 保留原始输入:`, error.message);
        // 如果读取失败，保留原始的 @文件路径，不显示错误信息
        // processedMessage 保持不变，即保留原始的 @文件路径
      }
    }
    
    return processedMessage;
  }

  // 读取文件内容 - 优雅的解决方案
  async readFileContent(filePath) {
    try {
      console.log(`读取文件: ${filePath}`);
      
      // 直接通过消息请求页面信息，然后构建URL
      const pageInfo = await this.getPageInfoFromContentScript();
      if (pageInfo && pageInfo.repoInfo) {
        const content = await this.fetchFileDirectly(pageInfo.repoInfo, filePath);
        if (content) {
          console.log(`成功读取文件 ${filePath}`);
          return content;
        }
      }
      
      throw new Error(`无法读取文件: ${filePath}`);
    } catch (error) {
      console.log('读取文件失败:', error.message);
      throw error;
    }
  }

  // 从content script获取页面信息
  async getPageInfoFromContentScript() {
    return new Promise((resolve) => {
      // 发送简单的消息获取页面URL信息
      chrome.runtime.sendMessage({
        action: 'getPageInfo'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('获取页面信息失败:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  // 直接获取文件内容
  async fetchFileDirectly(repoInfo, filePath) {
    const { owner, repo, branch } = repoInfo;
    
    // 尝试多个分支
    const branches = [branch, 'main', 'master'].filter((b, i, arr) => arr.indexOf(b) === i);
    
    for (const currentBranch of branches) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${currentBranch}/${filePath}`;
        console.log(`尝试获取: ${rawUrl}`);
        
        const response = await fetch(rawUrl);
        if (response.ok) {
          const content = await response.text();
          console.log(`✅ 成功从 ${currentBranch} 分支获取文件: ${filePath}`);
          return content;
        } else if (response.status === 404) {
          console.log(`❌ 文件在 ${currentBranch} 分支中不存在: ${filePath}`);
        } else {
          console.log(`❌ 分支 ${currentBranch} 返回错误: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ 分支 ${currentBranch} 网络错误:`, error.message);
      }
    }
    
    throw new Error(`文件 "${filePath}" 在仓库 ${owner}/${repo} 的所有分支中都不存在`);
  }

  // 刷新模型选择器（当配置更新时调用）
  async refreshModelSelector() {
    console.log('Refreshing model selector...');
    if (this.apiManager) {
      await this.apiManager.loadConfig();
      this.initializeModelSelector();
    }
  }

  // 手动重新加载模型列表
  async reloadModels() {
    console.log('Manually reloading models...');
    try {
      // 重新加载API配置
      await this.apiManager.loadConfig();
      
      // 重新初始化模型选择器
      this.initializeModelSelector();
      
      // 显示提示信息
      this.addMessage('system', '模型列表已刷新');
    } catch (error) {
      console.error('Failed to reload models:', error);
      this.addMessage('system', '刷新模型列表失败: ' + error.message);
    }
  }
  
  // 测试文件加载功能 (Ctrl+Shift+F)
  async testFileLoading() {
    console.log('🧪 ===== 开始测试文件加载功能 =====');
    
    // 测试页面信息获取
    try {
      console.log('📡 测试页面信息获取...');
      const pageInfo = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({action: 'getPageInfo'}, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      console.log('✅ 页面信息:', pageInfo);
    } catch (error) {
      console.log('❌ 页面信息获取失败:', error);
    }
    
    // 测试文件列表
    if (this.fileReference) {
      console.log('📂 当前文件列表长度:', this.fileReference.getFileList().length);
      console.log('📋 当前文件列表:', this.fileReference.getFileList());
      
      console.log('🔄 强制刷新文件列表...');
      await this.fileReference.refreshFileList();
      
      console.log('📂 刷新后文件列表长度:', this.fileReference.getFileList().length);
      console.log('📋 刷新后文件列表:', this.fileReference.getFileList());
    } else {
      console.log('❌ 文件引用管理器未初始化');
    }
    
    console.log('🧪 ===== 文件加载测试完成 =====');
  }
}

// 导出
window.ChatWindow = ChatWindow;