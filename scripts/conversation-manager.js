// 对话管理器 - 处理多对话会话管理
// 支持新建对话、历史对话、对话切换、删除等功能

class ConversationManager {
  constructor() {
    this.currentConversationId = null;
    this.conversations = new Map();
    this.storageKey = 'github-chat-conversations';
    this.currentIdKey = 'github-chat-current-id';
    
    this.loadConversations();
  }

  // 初始化对话管理器
  initialize() {
    // 如果没有当前对话，创建一个新对话
    if (!this.currentConversationId || !this.conversations.has(this.currentConversationId)) {
      this.createNewConversation();
    }
    
    console.log('Conversation manager initialized');
  }

  // 创建新对话
  createNewConversation(title = null) {
    const conversationId = this.generateConversationId();
    const conversation = {
      id: conversationId,
      title: title || `新对话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.conversations.set(conversationId, conversation);
    this.currentConversationId = conversationId;
    
    this.saveConversations();
    this.saveCurrentId();
    
    console.log('Created new conversation:', conversationId);
    return conversationId;
  }

  // 获取当前对话
  getCurrentConversation() {
    if (!this.currentConversationId) {
      return null;
    }
    return this.conversations.get(this.currentConversationId);
  }

  // 切换到指定对话
  switchToConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      console.error('Conversation not found:', conversationId);
      return false;
    }

    this.currentConversationId = conversationId;
    this.saveCurrentId();
    
    console.log('Switched to conversation:', conversationId);
    return true;
  }

  // 添加消息到当前对话
  addMessage(role, content, options = {}) {
    const conversation = this.getCurrentConversation();
    if (!conversation) {
      console.error('No current conversation');
      return;
    }

    const message = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: Date.now(),
      images: options.images || []
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();
    
    // 自动更新对话标题（使用第一条用户消息的前20个字符）
    if (role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1) {
      conversation.title = content.substring(0, 20) + (content.length > 20 ? '...' : '');
    }

    this.saveConversations();
    return message;
  }

  // 获取当前对话的消息历史
  getCurrentMessages() {
    const conversation = this.getCurrentConversation();
    return conversation ? conversation.messages : [];
  }

  // 获取所有对话列表
  getAllConversations() {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // 删除对话
  deleteConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      console.error('Conversation not found:', conversationId);
      return false;
    }

    this.conversations.delete(conversationId);
    
    // 如果删除的是当前对话，切换到最新的对话或创建新对话
    if (this.currentConversationId === conversationId) {
      const remaining = this.getAllConversations();
      if (remaining.length > 0) {
        this.currentConversationId = remaining[0].id;
      } else {
        this.createNewConversation();
      }
    }

    this.saveConversations();
    this.saveCurrentId();
    
    console.log('Deleted conversation:', conversationId);
    return true;
  }

  // 清空所有对话
  clearAllConversations() {
    this.conversations.clear();
    this.currentConversationId = null;
    
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.currentIdKey);
    
    // 创建新对话
    this.createNewConversation();
    
    console.log('Cleared all conversations');
  }



  // 生成对话ID
  generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 生成消息ID
  generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 保存对话数据到localStorage
  saveConversations() {
    try {
      const data = {};
      this.conversations.forEach((conversation, id) => {
        data[id] = conversation;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save conversations:', error);
    }
  }

  // 保存当前对话ID
  saveCurrentId() {
    try {
      localStorage.setItem(this.currentIdKey, this.currentConversationId || '');
    } catch (error) {
      console.error('Failed to save current conversation ID:', error);
    }
  }

  // 从localStorage加载对话数据
  loadConversations() {
    try {
      // 加载对话数据
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const conversations = JSON.parse(data);
        this.conversations.clear();
        
        Object.entries(conversations).forEach(([id, conversation]) => {
          this.conversations.set(id, conversation);
        });
      }

      // 加载当前对话ID
      const currentId = localStorage.getItem(this.currentIdKey);
      if (currentId && this.conversations.has(currentId)) {
        this.currentConversationId = currentId;
      }

      console.log('Loaded conversations:', this.conversations.size);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      this.conversations.clear();
      this.currentConversationId = null;
    }
  }

  // 获取对话统计信息
  getStats() {
    const conversations = this.getAllConversations();
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    
    return {
      totalConversations: conversations.length,
      totalMessages,
      currentConversationId: this.currentConversationId,
      oldestConversation: conversations.length > 0 ? conversations[conversations.length - 1].createdAt : null,
      newestConversation: conversations.length > 0 ? conversations[0].createdAt : null
    };
  }
}

// 导出
window.ConversationManager = ConversationManager;