// LLM API适配器模块
// 统一接口适配OpenAI、Gemini、Anthropic等不同的API协议

class LLMAdapterBase {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  // 抽象方法，子类必须实现
  async sendMessage(messages, options = {}) {
    throw new Error('sendMessage method must be implemented');
  }

  // 抽象方法，子类必须实现
  async sendStreamMessage(messages, options = {}, onChunk) {
    throw new Error('sendStreamMessage method must be implemented');
  }

  // 测试连接
  async testConnection() {
    try {
      const testMessages = [{
        role: 'user',
        content: 'Hello, this is a connection test.'
      }];
      
      await this.sendMessage(testMessages, { maxTokens: 10 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 构建请求头
  buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  // 处理错误响应
  handleError(response, data) {
    if (!response.ok) {
      const errorMessage = data?.error?.message || data?.message || `HTTP ${response.status}`;
      throw new Error(`API Error: ${errorMessage}`);
    }
  }
}

// OpenAI API适配器
class OpenAIAdapter extends LLMAdapterBase {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async sendMessage(messages, options = {}) {
    const url = `${this.baseUrl}/chat/completions`;
    
    const requestBody = {
      model: this.model,
      messages: this.formatMessages(messages),
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      stream: false
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    this.handleError(response, data);

    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model
    };
  }

  async sendStreamMessage(messages, options = {}, onChunk) {
    const url = `${this.baseUrl}/chat/completions`;
    
    const requestBody = {
      model: this.model,
      messages: this.formatMessages(messages),
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      stream: true
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      this.handleError(response, errorData);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                onChunk({
                  content,
                  usage: parsed.usage,
                  model: parsed.model
                });
              }
            } catch (error) {
              console.warn('Failed to parse SSE data:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }
}

// Gemini API适配器
class GeminiAdapter extends LLMAdapterBase {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  buildHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  async sendMessage(messages, options = {}) {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: this.formatMessages(messages),
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 2000,
        topP: 0.8,
        topK: 10
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    this.handleError(response, data);

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No content in Gemini response');
    }

    return {
      content,
      usage: data.usageMetadata,
      model: this.model
    };
  }

  async sendStreamMessage(messages, options = {}, onChunk) {
    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: this.formatMessages(messages),
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 2000,
        topP: 0.8,
        topK: 10
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      this.handleError(response, errorData);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              
              if (content) {
                onChunk({
                  content,
                  usage: parsed.usageMetadata,
                  model: this.model
                });
              }
            } catch (error) {
              console.warn('Failed to parse Gemini SSE data:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }
}

// Anthropic Claude API适配器
class AnthropicAdapter extends LLMAdapterBase {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };
  }

  async sendMessage(messages, options = {}) {
    const url = `${this.baseUrl}/messages`;
    
    const { system, messages: formattedMessages } = this.formatMessages(messages);
    
    const requestBody = {
      model: this.model,
      messages: formattedMessages,
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      stream: false
    };

    if (system) {
      requestBody.system = system;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    this.handleError(response, data);

    return {
      content: data.content[0].text,
      usage: data.usage,
      model: data.model
    };
  }

  async sendStreamMessage(messages, options = {}, onChunk) {
    const url = `${this.baseUrl}/messages`;
    
    const { system, messages: formattedMessages } = this.formatMessages(messages);
    
    const requestBody = {
      model: this.model,
      messages: formattedMessages,
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      stream: true
    };

    if (system) {
      requestBody.system = system;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      this.handleError(response, errorData);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text;
                if (content) {
                  onChunk({
                    content,
                    usage: parsed.usage,
                    model: this.model
                  });
                }
              }
            } catch (error) {
              console.warn('Failed to parse Anthropic SSE data:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  formatMessages(messages) {
    let system = '';
    const formattedMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        formattedMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    return { system, messages: formattedMessages };
  }
}

// LLM管理器
class LLMManager {
  constructor() {
    this.adapters = new Map();
    this.currentProvider = null;
    this.config = null;
  }

  // 初始化
  async initialize(config) {
    this.config = config;
    this.currentProvider = config.currentProvider;

    // 创建适配器实例
    if (config.apiConfigs.openai.enabled) {
      this.adapters.set('openai', new OpenAIAdapter(config.apiConfigs.openai));
    }

    if (config.apiConfigs.gemini.enabled) {
      this.adapters.set('gemini', new GeminiAdapter(config.apiConfigs.gemini));
    }

    if (config.apiConfigs.anthropic.enabled) {
      this.adapters.set('anthropic', new AnthropicAdapter(config.apiConfigs.anthropic));
    }

    console.log('LLM Manager initialized with providers:', Array.from(this.adapters.keys()));
  }

  // 获取当前适配器
  getCurrentAdapter() {
    const adapter = this.adapters.get(this.currentProvider);
    if (!adapter) {
      throw new Error(`Provider ${this.currentProvider} not available`);
    }
    return adapter;
  }

  // 切换提供商
  switchProvider(provider) {
    if (!this.adapters.has(provider)) {
      throw new Error(`Provider ${provider} not available`);
    }
    this.currentProvider = provider;
  }

  // 获取可用的提供商列表
  getAvailableProviders() {
    return Array.from(this.adapters.keys());
  }

  // 发送消息
  async sendMessage(messages, options = {}) {
    const adapter = this.getCurrentAdapter();
    return await adapter.sendMessage(messages, {
      ...this.config.conversationSettings,
      ...options
    });
  }

  // 发送流式消息
  async sendStreamMessage(messages, onChunk, options = {}) {
    const adapter = this.getCurrentAdapter();
    return await adapter.sendStreamMessage(messages, {
      ...this.config.conversationSettings,
      ...options
    }, onChunk);
  }

  // 测试连接
  async testConnection(provider) {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not available`);
    }
    return await adapter.testConnection();
  }

  // 测试所有连接
  async testAllConnections() {
    const results = {};
    
    for (const [provider, adapter] of this.adapters) {
      try {
        results[provider] = await adapter.testConnection();
      } catch (error) {
        results[provider] = { success: false, error: error.message };
      }
    }
    
    return results;
  }

  // 获取当前提供商信息
  getCurrentProviderInfo() {
    if (!this.currentProvider || !this.adapters.has(this.currentProvider)) {
      return null;
    }

    const adapter = this.adapters.get(this.currentProvider);
    return {
      provider: this.currentProvider,
      model: adapter.model,
      baseUrl: adapter.baseUrl
    };
  }

  // 更新配置
  async updateConfig(newConfig) {
    this.config = newConfig;
    this.adapters.clear();
    await this.initialize(newConfig);
  }
}

// 导出
window.LLMManager = LLMManager;
window.OpenAIAdapter = OpenAIAdapter;
window.GeminiAdapter = GeminiAdapter;
window.AnthropicAdapter = AnthropicAdapter;