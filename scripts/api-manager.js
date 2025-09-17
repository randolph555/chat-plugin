// API管理器 - 处理与各种LLM服务的通信
class ApiManager {
  constructor() {
    this.config = null;
    this.currentProvider = null;
    this.currentModel = null;
  }

  // 初始化API管理器
  async initialize() {
    await this.loadConfig();
  }

  // 加载配置
  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get('config');
      this.config = result.config;
      console.log('API Manager config loaded:', this.config);
      
      if (this.config && this.config.apiConfigs) {
        // 检查每个提供商的启用状态
        Object.keys(this.config.apiConfigs).forEach(provider => {
          const config = this.config.apiConfigs[provider];
          console.log(`Provider ${provider}: enabled=${config.enabled}, hasApiKey=${!!config.apiKey}, models=${config.models?.length || 0}`);
        });
      }
    } catch (error) {
      console.error('Failed to load API config:', error);
      this.config = null;
    }
  }

  // 获取可用的模型列表
  getAvailableModels() {
    console.log('Getting available models, config:', this.config);
    
    if (!this.config || !this.config.apiConfigs) {
      console.log('No config or apiConfigs found');
      return [];
    }

    const models = [];
    Object.keys(this.config.apiConfigs).forEach(provider => {
      const providerConfig = this.config.apiConfigs[provider];
      console.log(`Provider ${provider}:`, providerConfig);
      
      // 只要有API密钥和模型就认为可用
      if (providerConfig.apiKey && providerConfig.apiKey.trim() !== '' && providerConfig.models && providerConfig.models.length > 0) {
        providerConfig.models.forEach(model => {
          models.push({
            provider: provider,
            name: model.name,
            display: `${model.display || model.name} (${provider})`,
            fullName: `${provider}:${model.name}`
          });
        });
      }
    });

    console.log('Available models:', models);
    return models;
  }

  // 设置当前模型
  setCurrentModel(fullModelName) {
    if (!fullModelName) {
      this.currentProvider = null;
      this.currentModel = null;
      return;
    }

    const [provider, modelName] = fullModelName.split(':');
    this.currentProvider = provider;
    this.currentModel = modelName;
  }

  // 发送消息到LLM
  async sendMessage(messages, options = {}) {
    if (!this.currentProvider || !this.currentModel) {
      throw new Error('请先选择模型');
    }

    const providerConfig = this.config.apiConfigs[this.currentProvider];
    if (!providerConfig || !providerConfig.enabled) {
      throw new Error('当前模型提供商未配置或未启用');
    }

    switch (this.currentProvider) {
      case 'openai':
        return await this.sendOpenAIMessage(messages, providerConfig, options);
      case 'gemini':
        return await this.sendGeminiMessage(messages, providerConfig, options);
      case 'anthropic':
        return await this.sendAnthropicMessage(messages, providerConfig, options);
      default:
        throw new Error('不支持的模型提供商');
    }
  }

  // OpenAI API调用 - 支持流式输出和图片
  async sendOpenAIMessage(messages, config, options) {
    const url = `${config.baseUrl}/chat/completions`;
    
    // 处理图片消息格式
    const processedMessages = messages.map(msg => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...msg.images.map(img => ({
              type: 'image_url',
              image_url: { url: img.data }
            }))
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });
    
    const requestBody = {
      model: this.currentModel,
      messages: processedMessages,
      temperature: config.temperature,
      stream: true // 默认启用流式输出
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(config.timeout * 1000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        // 使用默认错误消息
      }
      
      throw new Error(errorMessage);
    }

    return response; // 返回流响应
  }

  // Gemini API调用
  async sendGeminiMessage(messages, config, options) {
    const url = `${config.baseUrl}/models/${this.currentModel}:generateContent?key=${config.apiKey}`;
    
    // 转换消息格式
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: config.temperature
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(config.timeout * 1000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        // 使用默认错误消息
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  // Anthropic API调用
  async sendAnthropicMessage(messages, config, options) {
    const url = `${config.baseUrl}/messages`;
    
    const requestBody = {
      model: this.currentModel,
      messages: messages,
      temperature: config.temperature,
      max_tokens: 4000
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(config.timeout * 1000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        // 使用默认错误消息
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // 获取当前模型信息
  getCurrentModelInfo() {
    if (!this.currentProvider || !this.currentModel) {
      return null;
    }

    const providerConfig = this.config.apiConfigs[this.currentProvider];
    if (!providerConfig) return null;

    const model = providerConfig.models.find(m => m.name === this.currentModel);
    return {
      provider: this.currentProvider,
      name: this.currentModel,
      display: model?.display || this.currentModel
    };
  }
}

// 导出
window.ApiManager = ApiManager;