// 聊天窗口核心管理器 - 只负责窗口的基本创建和管理
// 遵循单一职责原则，专注于窗口生命周期管理

class ChatWindowCore {
  constructor() {
    this.isVisible = false;
    this.windowElement = null;
    this.config = null;
  }

  // 初始化聊天窗口
  async initialize(config) {
    this.config = config;
    await this.createWindow();
    this.bindBasicEvents();
    console.log('Chat window core initialized');
  }

  // 创建窗口DOM结构
  async createWindow() {
    if (this.windowElement) {
      this.windowElement.remove();
    }

    this.windowElement = document.createElement('div');
    this.windowElement.className = 'github-chat-window';
    this.windowElement.innerHTML = `
      <div class="chat-header">
        <div class="header-left">
          <span class="chat-title" id="conversation-title">GitHub Chat Assistant</span>
        </div>
        <div class="header-center">
          <button class="new-conversation-btn" title="新建对话">💬</button>
          <button class="conversation-history-btn" title="对话历史">📋</button>
        </div>
        <div class="header-right">
          <button class="minimize-btn" title="最小化">−</button>
          <button class="settings-btn" title="设置">⚙</button>
          <button class="close-btn" title="关闭">×</button>
        </div>
      </div>
      
      <div class="chat-content">
        <!-- 对话历史面板 -->
        <div class="conversation-history-panel" id="conversation-history-panel" style="display: none;">
          <div class="history-header">
            <h3>对话历史</h3>
            <div class="history-actions">
              <button class="clear-all-btn" title="清空所有对话">🗑️</button>
              <button class="close-history-btn" title="关闭">×</button>
            </div>
          </div>
          <div class="conversation-list" id="conversation-list">
            <!-- 对话列表将在这里动态生成 -->
          </div>
        </div>

        <!-- 主聊天区域 -->
        <div class="chat-messages" id="messages-container">
          <!-- 消息将在这里显示 -->
        </div>
        
        <!-- 输入区域 -->
        <div class="chat-input-area">
          <div class="uploaded-images" id="uploaded-images"></div>
          <!-- 小巧的模型选择器 -->
          <div class="model-selector-container">
            <select id="model-selector" class="model-selector">
              <option value="">选择模型</option>
            </select>
            <button class="refresh-models-btn" title="刷新模型列表">🔄</button>
          </div>
          <div class="input-container">
            <textarea id="chat-input" placeholder="输入消息... (试试输入 @)" rows="1"></textarea>
            <div class="input-actions">
              <button class="upload-btn" title="上传图片">📎</button>
              <button class="send-btn" title="发送">➤</button>
              <button class="cancel-btn" title="取消响应" style="display: none;">✕</button>
            </div>
          </div>
        </div>
        
        <!-- 边缘调整手柄 -->
        <div class="resize-handle resize-top" data-direction="top"></div>
        <div class="resize-handle resize-right" data-direction="right"></div>
        <div class="resize-handle resize-bottom" data-direction="bottom"></div>
        <div class="resize-handle resize-left" data-direction="left"></div>
        
        <!-- 角落调整手柄 -->
        <div class="resize-handle resize-top-left" data-direction="top-left"></div>
        <div class="resize-handle resize-top-right" data-direction="top-right"></div>
        <div class="resize-handle resize-bottom-left" data-direction="bottom-left"></div>
        <div class="resize-handle resize-bottom-right" data-direction="bottom-right"></div>
      </div>
    `;

    document.body.appendChild(this.windowElement);
    this.setInitialPosition();
  }

  // 设置初始位置和尺寸
  setInitialPosition() {
    const savedSettings = localStorage.getItem('github-chat-window-settings');
    
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      
      // 恢复位置
      if (settings.position) {
        const { top, left, right } = settings.position;
        if (left) {
          this.windowElement.style.setProperty('left', left, 'important');
          this.windowElement.style.setProperty('right', 'auto', 'important');
        } else if (right) {
          this.windowElement.style.setProperty('right', right, 'important');
          this.windowElement.style.setProperty('left', 'auto', 'important');
        }
        if (top) {
          this.windowElement.style.setProperty('top', top, 'important');
        }
      }
      
      // 恢复尺寸
      if (settings.size) {
        const { width, height } = settings.size;
        if (width) {
          this.windowElement.style.setProperty('width', width, 'important');
        }
        if (height) {
          this.windowElement.style.setProperty('height', height, 'important');
        }
      }
    } else {
      // 设置默认位置和尺寸
      this.setDefaultSettings();
    }
  }

  // 设置默认位置和尺寸
  setDefaultSettings() {
    // 默认位置：startLeft: 685, startTop: 215
    this.windowElement.style.setProperty('left', '685px', 'important');
    this.windowElement.style.setProperty('top', '215px', 'important');
    this.windowElement.style.setProperty('right', 'auto', 'important');
    
    // 默认尺寸
    this.windowElement.style.setProperty('width', '400px', 'important');
    this.windowElement.style.setProperty('height', '600px', 'important');
    
    // 保存默认设置
    this.saveWindowSettings();
  }

  // 保存窗口设置（位置和尺寸）
  saveWindowSettings() {
    if (!this.windowElement) return;
    
    const rect = this.windowElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(this.windowElement);
    
    const settings = {
      position: {
        top: this.windowElement.style.top || computedStyle.top,
        left: this.windowElement.style.left || (rect.left + 'px'),
        right: this.windowElement.style.right
      },
      size: {
        width: this.windowElement.style.width || (rect.width + 'px'),
        height: this.windowElement.style.height || (rect.height + 'px')
      },
      timestamp: Date.now()
    };
    
    localStorage.setItem('github-chat-window-settings', JSON.stringify(settings));
    console.log('Window settings saved:', settings);
  }

  // 绑定基础事件
  bindBasicEvents() {
    // 窗口拖拽 - 使用更直接的方法
    const header = this.windowElement.querySelector('.chat-header');
    this.setupDragging(header);
    
    // 调整大小
    this.windowElement.querySelectorAll('.resize-handle').forEach(handle => {
      this.setupResizing(handle);
    });

    // 关闭按钮
    this.windowElement.querySelector('.close-btn').addEventListener('click', () => {
      this.hide();
    });

    // 取消按钮 - 需要从外部设置处理器
    const cancelBtn = this.windowElement.querySelector('.cancel-btn');
    if (cancelBtn) {
      this.cancelBtn = cancelBtn;
    }
  }

  // 设置拖拽功能
  setupDragging(element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    element.addEventListener('mousedown', (e) => {
      // 检查是否点击了按钮区域
      if (e.target.closest('.header-right')) {
        return;
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.windowElement.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      this.windowElement.classList.add('dragging');
      
      console.log('开始拖拽:', { startX, startY, startLeft, startTop });
      
      e.preventDefault();
      e.stopPropagation();

      // 临时事件监听器
      const handleMouseMove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newLeft = startLeft + deltaX;
        const newTop = startTop + deltaY;

        // 边界限制
        const minX = -50;
        const minY = 0;
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 50;

        const constrainedX = Math.max(minX, Math.min(newLeft, maxX));
        const constrainedY = Math.max(minY, Math.min(newTop, maxY));

        this.windowElement.style.setProperty('left', `${constrainedX}px`, 'important');
        this.windowElement.style.setProperty('top', `${constrainedY}px`, 'important');
        this.windowElement.style.setProperty('right', 'auto', 'important');
        this.windowElement.style.setProperty('bottom', 'auto', 'important');

      };

      const handleMouseUp = () => {
        isDragging = false;
        this.windowElement.classList.remove('dragging');
        
        // 移除临时事件监听器
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        this.saveWindowSettings();
        console.log('结束拖拽');
      };

      // 添加临时事件监听器
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }

  // 设置调整大小功能
  setupResizing(handle) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let direction;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      direction = handle.dataset.direction;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.windowElement.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left;
      startTop = rect.top;

      this.windowElement.classList.add('resizing');
      
      e.preventDefault();
      e.stopPropagation();

      const handleMouseMove = (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        this.handleResizeMovement(direction, deltaX, deltaY, startWidth, startHeight, startLeft, startTop);
      };

      const handleMouseUp = () => {
        isResizing = false;
        this.windowElement.classList.remove('resizing');
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // 保存窗口设置
        this.saveWindowSettings();
        console.log('结束调整大小');
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }

  // 处理调整大小移动
  handleResizeMovement(direction, deltaX, deltaY, startWidth, startHeight, startLeft, startTop) {
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    const minWidth = 300;
    const minHeight = 400;

    switch (direction) {
      case 'top':
        newHeight = Math.max(minHeight, startHeight - deltaY);
        newTop = startTop + (startHeight - newHeight);
        break;
      case 'right':
        newWidth = Math.max(minWidth, startWidth + deltaX);
        break;
      case 'bottom':
        newHeight = Math.max(minHeight, startHeight + deltaY);
        break;
      case 'left':
        newWidth = Math.max(minWidth, startWidth - deltaX);
        newLeft = startLeft + (startWidth - newWidth);
        break;
      case 'top-left':
        newWidth = Math.max(minWidth, startWidth - deltaX);
        newHeight = Math.max(minHeight, startHeight - deltaY);
        newLeft = startLeft + (startWidth - newWidth);
        newTop = startTop + (startHeight - newHeight);
        break;
      case 'top-right':
        newWidth = Math.max(minWidth, startWidth + deltaX);
        newHeight = Math.max(minHeight, startHeight - deltaY);
        newTop = startTop + (startHeight - newHeight);
        break;
      case 'bottom-left':
        newWidth = Math.max(minWidth, startWidth - deltaX);
        newHeight = Math.max(minHeight, startHeight + deltaY);
        newLeft = startLeft + (startWidth - newWidth);
        break;
      case 'bottom-right':
        newWidth = Math.max(minWidth, startWidth + deltaX);
        newHeight = Math.max(minHeight, startHeight + deltaY);
        break;
    }

    // 应用新的尺寸和位置
    this.windowElement.style.setProperty('width', `${newWidth}px`, 'important');
    this.windowElement.style.setProperty('height', `${newHeight}px`, 'important');
    this.windowElement.style.setProperty('left', `${newLeft}px`, 'important');
    this.windowElement.style.setProperty('top', `${newTop}px`, 'important');
  }

  // 显示窗口
  show() {
    if (this.windowElement) {
      this.windowElement.style.display = 'block';
      this.windowElement.classList.remove('minimized');
      this.isVisible = true;
    }
  }

  // 隐藏窗口
  hide() {
    if (this.windowElement) {
      this.windowElement.style.display = 'none';
      this.isVisible = false;
    }
  }

  // 切换显示状态
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // 销毁窗口
  destroy() {
    if (this.windowElement) {
      this.windowElement.remove();
      this.windowElement = null;
    }
    
    this.isVisible = false;
  }

  // 获取窗口元素
  getElement() {
    return this.windowElement;
  }

  // 获取消息容器
  getMessagesContainer() {
    return this.windowElement?.querySelector('#messages-container');
  }

  // 获取输入框
  getInputElement() {
    return this.windowElement?.querySelector('#chat-input');
  }

  // 获取上传图片容器
  getUploadedImagesContainer() {
    return this.windowElement?.querySelector('#uploaded-images');
  }
}

// 导出
window.ChatWindowCore = ChatWindowCore;