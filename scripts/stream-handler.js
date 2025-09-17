// 流式响应处理器
class StreamHandler {
  constructor(chatWindow) {
    this.chatWindow = chatWindow;
  }

  // 处理流式响应
  async handleStreamResponse(response, abortController = null) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    // 创建助手消息元素
    const messageId = 'msg-' + Date.now();
    this.createStreamingMessage(messageId);
    
    let fullContent = '';
    
    try {
      while (true) {
        // 检查是否被取消
        if (abortController && abortController.signal.aborted) {
          this.finalizeStreamingMessage(messageId, fullContent + '\n\n[响应已取消]');
          return;
        }
        
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // 流结束
              this.finalizeStreamingMessage(messageId, fullContent);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                fullContent += content;
                this.updateStreamingMessage(messageId, fullContent);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream reading error:', error);
      this.chatWindow.addMessage('system', '接收响应时出错: ' + error.message);
    }
  }

  // 创建流式消息元素
  createStreamingMessage(messageId) {
    const messagesContainer = this.chatWindow.core.getMessagesContainer();
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message assistant-message streaming';
    messageElement.id = messageId;
    
    messageElement.innerHTML = `
      <div class="message-wrapper">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-role">助手</span>
            <span class="message-time">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="message-text"></div>
          <div class="typing-cursor">▋</div>
        </div>
      </div>
    `;

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // 更新流式消息内容
  updateStreamingMessage(messageId, content) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    const textElement = messageElement.querySelector('.message-text');
    if (textElement) {
      textElement.innerHTML = this.chatWindow.formatMessageContent(content);
    }

    // 滚动到底部
    const messagesContainer = this.chatWindow.core.getMessagesContainer();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // 完成流式消息
  finalizeStreamingMessage(messageId, content) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    // 移除流式样式和光标
    messageElement.classList.remove('streaming');
    const cursor = messageElement.querySelector('.typing-cursor');
    if (cursor) {
      cursor.remove();
    }

    // 保存到对话历史
    if (this.chatWindow.conversationManager) {
      this.chatWindow.conversationManager.addMessage('assistant', content);
      this.chatWindow.updateConversationTitle();
    }

    // 保存到消息历史（向后兼容）
    this.chatWindow.messageHistory.push({
      role: 'assistant',
      content: content,
      timestamp: Date.now()
    });
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreamHandler;
} else if (typeof window !== 'undefined') {
  window.StreamHandler = StreamHandler;
}