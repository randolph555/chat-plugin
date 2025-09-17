// 消息渲染器
// 负责渲染不同类型的消息内容，包括代码高亮、文件引用、图片等

class MessageRenderer {
  constructor() {
    this.codeLanguages = new Set([
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'bash',
      'sql', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'markdown'
    ]);
  }

  // 渲染消息
  renderMessage(message, options = {}) {
    const { role, content, timestamp, attachments = [] } = message;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}-message`;
    
    if (options.isStreaming) {
      messageElement.classList.add('streaming');
    }
    
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '';
    
    messageElement.innerHTML = `
      <div class="message-avatar">
        ${this.getAvatarIcon(role)}
      </div>
      <div class="message-content">
        ${attachments.length > 0 ? this.renderAttachments(attachments) : ''}
        <div class="message-text" data-role="${role}">
          ${this.renderContent(content, role)}
        </div>
        ${timeStr ? `<div class="message-time">${timeStr}</div>` : ''}
        <div class="message-actions">
          ${this.renderMessageActions(message)}
        </div>
      </div>
    `;
    
    // 绑定事件
    this.bindMessageEvents(messageElement, message);
    
    return messageElement;
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

  // 渲染消息内容
  renderContent(content, role) {
    if (!content) return '';
    
    let processedContent = content;
    
    // 处理代码块
    processedContent = this.renderCodeBlocks(processedContent);
    
    // 处理行内代码
    processedContent = this.renderInlineCode(processedContent);
    
    // 处理文件引用
    processedContent = this.renderFileReferences(processedContent);
    
    // 处理链接
    processedContent = this.renderLinks(processedContent);
    
    // 处理列表
    processedContent = this.renderLists(processedContent);
    
    // 处理表格
    processedContent = this.renderTables(processedContent);
    
    // 处理换行
    processedContent = this.renderLineBreaks(processedContent);
    
    return processedContent;
  }

  // 渲染代码块
  renderCodeBlocks(content) {
    return content.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
      const lang = language || 'text';
      const highlightedCode = this.highlightCode(code.trim(), lang);
      
      return `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-language">${lang}</span>
            <button class="copy-code-btn" data-code="${this.escapeHtml(code.trim())}" title="复制代码">
              <svg width="14" height="14" viewBox="0 0 16 16">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 16h-7.5A1.75 1.75 0 015 14.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
              </svg>
            </button>
          </div>
          <pre class="code-block language-${lang}"><code>${highlightedCode}</code></pre>
        </div>
      `;
    });
  }

  // 代码高亮
  highlightCode(code, language) {
    // 简单的语法高亮实现
    if (!this.codeLanguages.has(language)) {
      return this.escapeHtml(code);
    }
    
    let highlighted = this.escapeHtml(code);
    
    // JavaScript/TypeScript 高亮
    if (['javascript', 'typescript', 'js', 'ts'].includes(language)) {
      highlighted = this.highlightJavaScript(highlighted);
    }
    // Python 高亮
    else if (language === 'python') {
      highlighted = this.highlightPython(highlighted);
    }
    // HTML 高亮
    else if (language === 'html') {
      highlighted = this.highlightHTML(highlighted);
    }
    // CSS 高亮
    else if (['css', 'scss'].includes(language)) {
      highlighted = this.highlightCSS(highlighted);
    }
    // JSON 高亮
    else if (language === 'json') {
      highlighted = this.highlightJSON(highlighted);
    }
    
    return highlighted;
  }

  // JavaScript 语法高亮
  highlightJavaScript(code) {
    // 关键字
    const keywords = [
      'const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'try',
      'catch', 'finally', 'throw', 'new', 'this', 'super', 'extends', 'import',
      'export', 'from', 'async', 'await', 'typeof', 'instanceof'
    ];
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      code = code.replace(regex, `<span class="keyword">${keyword}</span>`);
    });
    
    // 字符串
    code = code.replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, 
      '<span class="string">$1$2$1</span>');
    
    // 注释
    code = code.replace(/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>');
    code = code.replace(/\/\/.*$/gm, '<span class="comment">$&</span>');
    
    // 数字
    code = code.replace(/\b\d+\.?\d*\b/g, '<span class="number">$&</span>');
    
    return code;
  }

  // Python 语法高亮
  highlightPython(code) {
    const keywords = [
      'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except',
      'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'lambda',
      'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None'
    ];
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      code = code.replace(regex, `<span class="keyword">${keyword}</span>`);
    });
    
    // 字符串
    code = code.replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, 
      '<span class="string">$1$2$1</span>');
    
    // 注释
    code = code.replace(/#.*$/gm, '<span class="comment">$&</span>');
    
    // 数字
    code = code.replace(/\b\d+\.?\d*\b/g, '<span class="number">$&</span>');
    
    return code;
  }

  // HTML 语法高亮
  highlightHTML(code) {
    // 标签
    code = code.replace(/&lt;(\/?[\w-]+)([^&]*?)&gt;/g, (match, tagName, attrs) => {
      let highlighted = `<span class="tag">&lt;${tagName}`;
      
      // 属性高亮
      if (attrs) {
        attrs = attrs.replace(/([\w-]+)=("[^"]*"|'[^']*')/g, 
          '<span class="attr-name">$1</span>=<span class="attr-value">$2</span>');
        highlighted += attrs;
      }
      
      highlighted += '&gt;</span>';
      return highlighted;
    });
    
    return code;
  }

  // CSS 语法高亮
  highlightCSS(code) {
    // 选择器
    code = code.replace(/^([^{]+){/gm, '<span class="selector">$1</span>{');
    
    // 属性
    code = code.replace(/([\w-]+)(\s*:\s*)([^;]+);/g, 
      '<span class="property">$1</span>$2<span class="value">$3</span>;');
    
    return code;
  }

  // JSON 语法高亮
  highlightJSON(code) {
    // 字符串键
    code = code.replace(/"([^"]+)"(\s*:)/g, '<span class="json-key">"$1"</span>$2');
    
    // 字符串值
    code = code.replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>');
    
    // 数字
    code = code.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>');
    
    // 布尔值和null
    code = code.replace(/:\s*(true|false|null)/g, ': <span class="json-literal">$1</span>');
    
    return code;
  }

  // 渲染行内代码
  renderInlineCode(content) {
    return content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  }

  // 渲染文件引用
  renderFileReferences(content) {
    return content.replace(/@([^\s]+)/g, (match, filePath) => {
      return `<span class="file-reference" data-file-path="${filePath}" title="点击查看文件内容">${match}</span>`;
    });
  }

  // 渲染链接
  renderLinks(content) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  // 渲染列表
  renderLists(content) {
    // 无序列表
    content = content.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="unordered-list-item">$1</li>');
    
    // 有序列表
    content = content.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="ordered-list-item">$1</li>');
    
    // 包装列表项
    content = content.replace(/(<li class="unordered-list-item">.*?<\/li>)/gs, '<ul class="message-list">$1</ul>');
    content = content.replace(/(<li class="ordered-list-item">.*?<\/li>)/gs, '<ol class="message-list">$1</ol>');
    
    return content;
  }

  // 渲染表格
  renderTables(content) {
    const tableRegex = /^\|(.+)\|\s*\n\|[-\s|:]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm;
    
    return content.replace(tableRegex, (match, header, rows) => {
      const headerCells = header.split('|').map(cell => cell.trim()).filter(cell => cell);
      const rowsArray = rows.trim().split('\n').map(row => 
        row.split('|').map(cell => cell.trim()).filter(cell => cell)
      );
      
      let tableHtml = '<table class="message-table"><thead><tr>';
      headerCells.forEach(cell => {
        tableHtml += `<th>${cell}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';
      
      rowsArray.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
          tableHtml += `<td>${cell}</td>`;
        });
        tableHtml += '</tr>';
      });
      
      tableHtml += '</tbody></table>';
      return tableHtml;
    });
  }

  // 渲染换行
  renderLineBreaks(content) {
    return content.replace(/\n/g, '<br>');
  }

  // 渲染附件
  renderAttachments(attachments) {
    let html = '<div class="message-attachments">';
    
    attachments.forEach(attachment => {
      if (attachment.type === 'image') {
        html += this.renderImageAttachment(attachment);
      } else if (attachment.type === 'file') {
        html += this.renderFileAttachment(attachment);
      }
    });
    
    html += '</div>';
    return html;
  }

  // 渲染图片附件
  renderImageAttachment(attachment) {
    return `
      <div class="image-attachment">
        <img src="${attachment.url}" alt="${attachment.name}" class="attachment-image" />
        <div class="attachment-info">
          <span class="attachment-name">${attachment.name}</span>
          <span class="attachment-size">${this.formatFileSize(attachment.size)}</span>
        </div>
      </div>
    `;
  }

  // 渲染文件附件
  renderFileAttachment(attachment) {
    return `
      <div class="file-attachment">
        <div class="attachment-icon">${this.getFileIcon(attachment.name)}</div>
        <div class="attachment-info">
          <span class="attachment-name">${attachment.name}</span>
          <span class="attachment-size">${this.formatFileSize(attachment.size)}</span>
        </div>
        <button class="download-btn" data-url="${attachment.url}" title="下载">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
          </svg>
        </button>
      </div>
    `;
  }

  // 渲染消息操作按钮
  renderMessageActions(message) {
    if (message.role === 'assistant') {
      return `
        <button class="message-action-btn copy-btn" title="复制消息">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 16h-7.5A1.75 1.75 0 015 14.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
          </svg>
        </button>
        <button class="message-action-btn regenerate-btn" title="重新生成">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
            <path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
          </svg>
        </button>
      `;
    }
    return '';
  }

  // 绑定消息事件
  bindMessageEvents(messageElement, message) {
    // 复制代码按钮
    const copyCodeBtns = messageElement.querySelectorAll('.copy-code-btn');
    copyCodeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        this.copyToClipboard(code);
        this.showCopyFeedback(btn);
      });
    });

    // 文件引用点击
    const fileRefs = messageElement.querySelectorAll('.file-reference');
    fileRefs.forEach(ref => {
      ref.addEventListener('click', () => {
        const filePath = ref.dataset.filePath;
        this.handleFileReferenceClick(filePath);
      });
    });

    // 复制消息按钮
    const copyBtn = messageElement.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.copyToClipboard(message.content);
        this.showCopyFeedback(copyBtn);
      });
    }

    // 重新生成按钮
    const regenerateBtn = messageElement.querySelector('.regenerate-btn');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => {
        this.handleRegenerateMessage(message);
      });
    }

    // 下载按钮
    const downloadBtns = messageElement.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        this.downloadFile(url);
      });
    });

    // 图片点击放大
    const images = messageElement.querySelectorAll('.attachment-image');
    images.forEach(img => {
      img.addEventListener('click', () => {
        this.showImageModal(img.src, img.alt);
      });
    });
  }

  // 复制到剪贴板
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  // 显示复制反馈
  showCopyFeedback(button) {
    const originalContent = button.innerHTML;
    button.innerHTML = '✓';
    button.style.color = '#28a745';
    
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.style.color = '';
    }, 1500);
  }

  // 处理文件引用点击
  handleFileReferenceClick(filePath) {
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('fileReferenceClick', {
      detail: { filePath }
    }));
  }

  // 处理重新生成消息
  handleRegenerateMessage(message) {
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('regenerateMessage', {
      detail: { message }
    }));
  }

  // 下载文件
  downloadFile(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // 显示图片模态框
  showImageModal(src, alt) {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-backdrop">
        <div class="image-modal-content">
          <img src="${src}" alt="${alt}" class="modal-image">
          <button class="close-modal-btn">×</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 绑定关闭事件
    const closeBtn = modal.querySelector('.close-modal-btn');
    const backdrop = modal.querySelector('.image-modal-backdrop');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });
    
    // ESC键关闭
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }

  // 获取文件图标
  getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const iconMap = {
      'js': '📄', 'jsx': '⚛️', 'ts': '📘', 'tsx': '⚛️',
      'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
      'cs': '🔷', 'php': '🐘', 'rb': '💎', 'go': '🐹',
      'rs': '🦀', 'swift': '🦉', 'kt': '🎯', 'html': '🌐',
      'css': '🎨', 'scss': '🎨', 'json': '📋', 'xml': '📄',
      'yaml': '📄', 'yml': '📄', 'md': '📖', 'txt': '📄',
      'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'svg': '🖼️'
    };
    
    return iconMap[ext] || '📄';
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 转义HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 流式更新消息内容
  updateStreamingMessage(messageElement, newContent) {
    const messageText = messageElement.querySelector('.message-text');
    if (messageText) {
      messageText.innerHTML = this.renderContent(newContent, 'assistant');
      
      // 重新绑定事件
      this.bindMessageEvents(messageElement, { content: newContent, role: 'assistant' });
    }
  }

  // 完成流式消息
  finishStreamingMessage(messageElement) {
    messageElement.classList.remove('streaming');
  }
}

// 导出
window.MessageRenderer = MessageRenderer;