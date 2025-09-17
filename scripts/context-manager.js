// 上下文管理器
// 负责管理对话历史、上下文压缩、智能总结等功能，基于LangChain思想

class ContextManager {
  constructor() {
    this.conversations = new Map();
    this.currentConversationId = null;
    this.maxContextLength = 8000;
    this.summaryTriggerPercentage = 75;
    this.preserveCodeContext = true;
    this.autoSummarize = true;
    this.fileReferenceManager = null;
    this.llmManager = null;
  }

  // 初始化
  initialize(config, fileReferenceManager, llmManager) {
    this.maxContextLength = config.conversationSettings.maxContextLength;
    this.summaryTriggerPercentage = config.conversationSettings.summaryTrigger;
    this.preserveCodeContext = config.conversationSettings.preserveCodeContext;
    this.autoSummarize = config.conversationSettings.autoSummarize;
    this.fileReferenceManager = fileReferenceManager;
    this.llmManager = llmManager;
    
    console.log('Context manager initialized');
  }

  // 创建新对话
  createConversation(repositoryInfo) {
    const conversationId = this.generateConversationId();
    
    const conversation = {
      id: conversationId,
      repository: repositoryInfo,
      messages: [],
      summary: '',
      fileReferences: new Set(),
      codeContext: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenCount: 0,
      metadata: {
        totalMessages: 0,
        summaryCount: 0,
        lastSummaryAt: null
      }
    };
    
    // 添加系统消息
    this.addSystemMessage(conversation, repositoryInfo);
    
    this.conversations.set(conversationId, conversation);
    this.currentConversationId = conversationId;
    
    return conversationId;
  }

  // 添加系统消息
  addSystemMessage(conversation, repositoryInfo) {
    const systemMessage = {
      role: 'system',
      content: this.buildSystemPrompt(repositoryInfo),
      timestamp: Date.now(),
      tokenCount: 0,
      metadata: {
        type: 'system_init',
        repository: repositoryInfo
      }
    };
    
    conversation.messages.push(systemMessage);
    conversation.tokenCount += this.estimateTokenCount(systemMessage.content);
  }

  // 构建系统提示
  buildSystemPrompt(repositoryInfo) {
    return `你是一个专业的GitHub代码分析助手，正在分析以下仓库：

仓库信息：
- 名称: ${repositoryInfo.fullName}
- 分支: ${repositoryInfo.branch}
- 语言: ${repositoryInfo.language || '未知'}
- 描述: ${repositoryInfo.description || '无描述'}

你的职责：
1. 基于仓库的实际代码内容回答问题
2. 提供准确的代码分析和解释
3. 帮助用户理解项目结构和功能
4. 当用户使用@文件名引用文件时，优先基于该文件内容回答
5. 保持回答的准确性，不要编造不存在的代码或功能

注意事项：
- 始终基于实际的代码库内容进行回答
- 如果不确定某个功能或代码，请明确说明
- 优先引用具体的文件和代码片段来支持你的回答
- 保持专业和友好的语调`;
  }

  // 添加消息
  async addMessage(role, content, options = {}) {
    const conversation = this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No active conversation');
    }

    // 解析文件引用
    const fileReferences = await this.parseFileReferences(content);
    
    // 获取引用文件的内容
    const referencedFiles = await this.loadReferencedFiles(fileReferences);
    
    // 构建增强的消息内容
    const enhancedContent = await this.enhanceMessageWithContext(
      content, 
      referencedFiles, 
      conversation
    );

    const message = {
      role,
      content: enhancedContent,
      originalContent: content,
      timestamp: Date.now(),
      tokenCount: this.estimateTokenCount(enhancedContent),
      fileReferences: fileReferences.map(ref => ref.path),
      referencedFiles,
      metadata: {
        ...options,
        hasFileReferences: fileReferences.length > 0,
        contextEnhanced: enhancedContent !== content
      }
    };

    // 更新文件引用集合
    fileReferences.forEach(ref => {
      conversation.fileReferences.add(ref.path);
    });

    // 更新代码上下文
    this.updateCodeContext(conversation, referencedFiles);

    // 添加消息到对话
    conversation.messages.push(message);
    conversation.tokenCount += message.tokenCount;
    conversation.updatedAt = Date.now();
    conversation.metadata.totalMessages++;

    // 检查是否需要压缩上下文
    if (this.shouldCompressContext(conversation)) {
      await this.compressContext(conversation);
    }

    return message;
  }

  // 解析文件引用
  async parseFileReferences(content) {
    if (!this.fileReferenceManager) {
      return [];
    }
    
    return this.fileReferenceManager.parseFileReferences(content);
  }

  // 加载引用的文件
  async loadReferencedFiles(fileReferences) {
    if (!this.fileReferenceManager || fileReferences.length === 0) {
      return {};
    }

    const filePaths = fileReferences.map(ref => ref.path);
    return await this.fileReferenceManager.getMultipleFileContents(filePaths);
  }

  // 使用上下文增强消息
  async enhanceMessageWithContext(content, referencedFiles, conversation) {
    let enhancedContent = content;

    // 添加文件内容
    if (Object.keys(referencedFiles).length > 0) {
      enhancedContent += '\n\n--- 引用的文件内容 ---\n';
      
      for (const [filePath, fileContent] of Object.entries(referencedFiles)) {
        if (fileContent.error) {
          enhancedContent += `\n@${filePath}: 无法读取文件 - ${fileContent.error}\n`;
        } else {
          const preview = this.getFileContentPreview(fileContent, 100);
          enhancedContent += `\n@${filePath}:\n\`\`\`${this.getFileLanguage(filePath)}\n${preview}\n\`\`\`\n`;
        }
      }
    }

    // 添加相关代码上下文
    if (this.preserveCodeContext && conversation.codeContext.size > 0) {
      const relevantContext = this.getRelevantCodeContext(content, conversation);
      if (relevantContext.length > 0) {
        enhancedContent += '\n\n--- 相关代码上下文 ---\n';
        relevantContext.forEach(context => {
          enhancedContent += `\n相关文件 ${context.filePath}:\n\`\`\`${context.language}\n${context.snippet}\n\`\`\`\n`;
        });
      }
    }

    return enhancedContent;
  }

  // 获取文件内容预览
  getFileContentPreview(fileContent, maxLines = 50) {
    if (!fileContent.content) return '';
    
    const lines = fileContent.content.split('\n');
    if (lines.length <= maxLines) {
      return fileContent.content;
    }
    
    return lines.slice(0, maxLines).join('\n') + `\n\n... (文件还有 ${lines.length - maxLines} 行)`;
  }

  // 更新代码上下文
  updateCodeContext(conversation, referencedFiles) {
    for (const [filePath, fileContent] of Object.entries(referencedFiles)) {
      if (!fileContent.error && fileContent.content) {
        // 提取重要的代码片段
        const codeSnippets = this.extractCodeSnippets(fileContent);
        
        conversation.codeContext.set(filePath, {
          fileName: fileContent.name,
          language: this.getFileLanguage(filePath),
          size: fileContent.size,
          snippets: codeSnippets,
          lastAccessed: Date.now()
        });
      }
    }

    // 限制代码上下文的大小
    this.limitCodeContextSize(conversation);
  }

  // 提取代码片段
  extractCodeSnippets(fileContent) {
    const content = fileContent.content;
    const language = this.getFileLanguage(fileContent.name);
    const snippets = [];

    // 根据语言类型提取不同的代码片段
    if (['javascript', 'typescript'].includes(language.toLowerCase())) {
      snippets.push(...this.extractJSSnippets(content));
    } else if (language.toLowerCase() === 'python') {
      snippets.push(...this.extractPythonSnippets(content));
    } else if (language.toLowerCase() === 'java') {
      snippets.push(...this.extractJavaSnippets(content));
    } else {
      // 通用提取：函数、类、重要注释
      snippets.push(...this.extractGenericSnippets(content));
    }

    return snippets.slice(0, 10); // 限制片段数量
  }

  // 提取JavaScript/TypeScript代码片段
  extractJSSnippets(content) {
    const snippets = [];
    const lines = content.split('\n');
    
    // 提取函数定义
    const functionRegex = /^\s*(export\s+)?(async\s+)?function\s+(\w+)|^\s*(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(|^\s*(\w+)\s*:\s*(async\s+)?\(/;
    
    // 提取类定义
    const classRegex = /^\s*(export\s+)?(abstract\s+)?class\s+(\w+)/;
    
    // 提取接口定义
    const interfaceRegex = /^\s*(export\s+)?interface\s+(\w+)/;
    
    lines.forEach((line, index) => {
      if (functionRegex.test(line) || classRegex.test(line) || interfaceRegex.test(line)) {
        const snippet = this.extractBlockSnippet(lines, index, 20);
        snippets.push({
          type: this.getSnippetType(line),
          name: this.extractName(line),
          content: snippet,
          lineNumber: index + 1
        });
      }
    });
    
    return snippets;
  }

  // 提取Python代码片段
  extractPythonSnippets(content) {
    const snippets = [];
    const lines = content.split('\n');
    
    const defRegex = /^\s*def\s+(\w+)/;
    const classRegex = /^\s*class\s+(\w+)/;
    
    lines.forEach((line, index) => {
      if (defRegex.test(line) || classRegex.test(line)) {
        const snippet = this.extractBlockSnippet(lines, index, 15);
        snippets.push({
          type: this.getSnippetType(line),
          name: this.extractName(line),
          content: snippet,
          lineNumber: index + 1
        });
      }
    });
    
    return snippets;
  }

  // 提取Java代码片段
  extractJavaSnippets(content) {
    const snippets = [];
    const lines = content.split('\n');
    
    const methodRegex = /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+(\w+)\s*\(/;
    const classRegex = /^\s*(public\s+)?(abstract\s+)?class\s+(\w+)/;
    
    lines.forEach((line, index) => {
      if (methodRegex.test(line) || classRegex.test(line)) {
        const snippet = this.extractBlockSnippet(lines, index, 20);
        snippets.push({
          type: this.getSnippetType(line),
          name: this.extractName(line),
          content: snippet,
          lineNumber: index + 1
        });
      }
    });
    
    return snippets;
  }

  // 提取通用代码片段
  extractGenericSnippets(content) {
    const snippets = [];
    const lines = content.split('\n');
    
    // 提取重要注释
    const commentRegex = /^\s*(\/\/|#|\*)\s*(.{20,})/;
    
    lines.forEach((line, index) => {
      const match = commentRegex.exec(line);
      if (match && match[2].length > 20) {
        snippets.push({
          type: 'comment',
          name: match[2].substring(0, 50),
          content: line,
          lineNumber: index + 1
        });
      }
    });
    
    return snippets;
  }

  // 提取代码块片段
  extractBlockSnippet(lines, startIndex, maxLines) {
    const snippet = [];
    let braceCount = 0;
    let inBlock = false;
    
    for (let i = startIndex; i < Math.min(startIndex + maxLines, lines.length); i++) {
      const line = lines[i];
      snippet.push(line);
      
      // 简单的括号匹配
      const openBraces = (line.match(/[{(]/g) || []).length;
      const closeBraces = (line.match(/[})]/g) || []).length;
      
      if (openBraces > 0) inBlock = true;
      braceCount += openBraces - closeBraces;
      
      // 如果括号匹配完成且已经在块中，结束提取
      if (inBlock && braceCount <= 0) {
        break;
      }
    }
    
    return snippet.join('\n');
  }

  // 获取片段类型
  getSnippetType(line) {
    if (/class\s+/i.test(line)) return 'class';
    if (/interface\s+/i.test(line)) return 'interface';
    if (/function\s+|def\s+/i.test(line)) return 'function';
    if (/^\s*(\/\/|#|\*)/.test(line)) return 'comment';
    return 'other';
  }

  // 提取名称
  extractName(line) {
    const matches = line.match(/(?:class|function|def|interface)\s+(\w+)|const\s+(\w+)|(\w+)\s*:/);
    return matches ? (matches[1] || matches[2] || matches[3]) : 'unknown';
  }

  // 获取相关代码上下文
  getRelevantCodeContext(content, conversation) {
    const relevantContext = [];
    const keywords = this.extractKeywords(content);
    
    for (const [filePath, context] of conversation.codeContext) {
      const relevantSnippets = context.snippets.filter(snippet => 
        keywords.some(keyword => 
          snippet.name.toLowerCase().includes(keyword.toLowerCase()) ||
          snippet.content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (relevantSnippets.length > 0) {
        relevantContext.push({
          filePath,
          language: context.language,
          snippet: relevantSnippets[0].content // 取最相关的一个
        });
      }
    }
    
    return relevantContext.slice(0, 3); // 限制上下文数量
  }

  // 提取关键词
  extractKeywords(content) {
    // 简单的关键词提取
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // 去重并返回前10个
    return [...new Set(words)].slice(0, 10);
  }

  // 限制代码上下文大小
  limitCodeContextSize(conversation) {
    const maxContextFiles = 20;
    
    if (conversation.codeContext.size > maxContextFiles) {
      // 按最后访问时间排序，删除最旧的
      const sortedEntries = Array.from(conversation.codeContext.entries())
        .sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);
      
      // 保留最新的文件
      const toKeep = sortedEntries.slice(0, maxContextFiles);
      conversation.codeContext.clear();
      
      toKeep.forEach(([path, context]) => {
        conversation.codeContext.set(path, context);
      });
    }
  }

  // 检查是否需要压缩上下文
  shouldCompressContext(conversation) {
    if (!this.autoSummarize) return false;
    
    const currentTokens = conversation.tokenCount;
    const threshold = this.maxContextLength * (this.summaryTriggerPercentage / 100);
    
    return currentTokens > threshold;
  }

  // 压缩上下文
  async compressContext(conversation) {
    try {
      console.log('Starting context compression...');
      
      // 保留最近的几条消息
      const recentMessages = conversation.messages.slice(-5);
      const messagesToSummarize = conversation.messages.slice(1, -5); // 排除系统消息和最近消息
      
      if (messagesToSummarize.length === 0) {
        return;
      }
      
      // 生成摘要
      const summary = await this.generateSummary(messagesToSummarize, conversation);
      
      // 创建摘要消息
      const summaryMessage = {
        role: 'system',
        content: `--- 对话摘要 ---\n${summary}`,
        timestamp: Date.now(),
        tokenCount: this.estimateTokenCount(summary),
        metadata: {
          type: 'summary',
          originalMessageCount: messagesToSummarize.length,
          summaryIndex: conversation.metadata.summaryCount
        }
      };
      
      // 重构消息列表
      conversation.messages = [
        conversation.messages[0], // 系统消息
        summaryMessage,
        ...recentMessages
      ];
      
      // 更新摘要
      conversation.summary = summary;
      conversation.metadata.summaryCount++;
      conversation.metadata.lastSummaryAt = Date.now();
      
      // 重新计算token数量
      conversation.tokenCount = conversation.messages.reduce(
        (total, msg) => total + msg.tokenCount, 0
      );
      
      console.log(`Context compressed: ${messagesToSummarize.length} messages -> summary`);
    } catch (error) {
      console.error('Failed to compress context:', error);
    }
  }

  // 生成摘要
  async generateSummary(messages, conversation) {
    const summaryPrompt = this.buildSummaryPrompt(messages, conversation);
    
    try {
      const response = await this.llmManager.sendMessage([
        {
          role: 'user',
          content: summaryPrompt
        }
      ], {
        maxTokens: 500,
        temperature: 0.3
      });
      
      return response.content;
    } catch (error) {
      console.error('Failed to generate summary:', error);
      
      // 降级方案：简单的文本摘要
      return this.generateSimpleSummary(messages);
    }
  }

  // 构建摘要提示
  buildSummaryPrompt(messages, conversation) {
    const messageTexts = messages.map(msg => 
      `${msg.role}: ${msg.originalContent || msg.content}`
    ).join('\n\n');
    
    const fileReferences = Array.from(conversation.fileReferences).join(', ');
    
    return `请为以下对话生成一个简洁的摘要，保留关键信息和代码相关的讨论要点：

仓库: ${conversation.repository.fullName}
涉及文件: ${fileReferences}

对话内容:
${messageTexts}

请生成一个结构化的摘要，包括：
1. 主要讨论的技术问题
2. 涉及的代码文件和功能
3. 重要的结论或建议
4. 待解决的问题

摘要应该简洁明了，便于后续对话参考。`;
  }

  // 生成简单摘要
  generateSimpleSummary(messages) {
    const userMessages = messages.filter(msg => msg.role === 'user');
    const topics = [];
    const files = new Set();
    
    userMessages.forEach(msg => {
      // 提取主题
      const content = msg.originalContent || msg.content;
      if (content.length > 20) {
        topics.push(content.substring(0, 100));
      }
      
      // 提取文件引用
      if (msg.fileReferences) {
        msg.fileReferences.forEach(file => files.add(file));
      }
    });
    
    let summary = `讨论了 ${userMessages.length} 个问题：\n`;
    topics.forEach((topic, index) => {
      summary += `${index + 1}. ${topic}...\n`;
    });
    
    if (files.size > 0) {
      summary += `\n涉及文件: ${Array.from(files).join(', ')}`;
    }
    
    return summary;
  }

  // 获取当前对话
  getCurrentConversation() {
    return this.conversations.get(this.currentConversationId);
  }

  // 获取对话消息
  getConversationMessages(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(id);
    
    if (!conversation) return [];
    
    // 过滤掉系统摘要消息，只返回用户和助手的消息
    return conversation.messages.filter(msg => 
      msg.role !== 'system' || msg.metadata?.type !== 'summary'
    );
  }

  // 获取完整上下文（包括摘要）
  getFullContext(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(id);
    
    return conversation ? conversation.messages : [];
  }

  // 估算token数量
  estimateTokenCount(text) {
    // 简单的token估算：大约4个字符 = 1个token
    return Math.ceil(text.length / 4);
  }

  // 获取文件语言
  getFileLanguage(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin'
    };
    
    return languageMap[ext] || 'text';
  }

  // 生成对话ID
  generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 切换对话
  switchConversation(conversationId) {
    if (this.conversations.has(conversationId)) {
      this.currentConversationId = conversationId;
      return true;
    }
    return false;
  }

  // 删除对话
  deleteConversation(conversationId) {
    return this.conversations.delete(conversationId);
  }

  // 获取对话列表
  getConversationList() {
    return Array.from(this.conversations.values()).map(conv => ({
      id: conv.id,
      repository: conv.repository,
      messageCount: conv.metadata.totalMessages,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      summary: conv.summary || '新对话'
    }));
  }

  // 导出对话
  exportConversation(conversationId = null) {
    const id = conversationId || this.currentConversationId;
    const conversation = this.conversations.get(id);
    
    if (!conversation) return null;
    
    return {
      ...conversation,
      codeContext: Object.fromEntries(conversation.codeContext),
      fileReferences: Array.from(conversation.fileReferences)
    };
  }

  // 导入对话
  importConversation(conversationData) {
    const conversation = {
      ...conversationData,
      codeContext: new Map(Object.entries(conversationData.codeContext || {})),
      fileReferences: new Set(conversationData.fileReferences || [])
    };
    
    this.conversations.set(conversation.id, conversation);
    return conversation.id;
  }

  // 清理旧对话
  cleanupOldConversations(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7天
    const now = Date.now();
    const toDelete = [];
    
    for (const [id, conversation] of this.conversations) {
      if (now - conversation.updatedAt > maxAge) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.conversations.delete(id));
    
    return toDelete.length;
  }

  // 获取统计信息
  getStats() {
    const conversations = Array.from(this.conversations.values());
    
    return {
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((sum, conv) => sum + conv.metadata.totalMessages, 0),
      totalTokens: conversations.reduce((sum, conv) => sum + conv.tokenCount, 0),
      averageMessagesPerConversation: conversations.length > 0 
        ? conversations.reduce((sum, conv) => sum + conv.metadata.totalMessages, 0) / conversations.length 
        : 0,
      totalFileReferences: conversations.reduce((sum, conv) => sum + conv.fileReferences.size, 0),
      totalCodeContexts: conversations.reduce((sum, conv) => sum + conv.codeContext.size, 0)
    };
  }
}

// 导出
window.ContextManager = ContextManager;