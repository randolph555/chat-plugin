// Options页面脚本 - 处理设置页面的交互逻辑

class OptionsManager {
  constructor() {
    this.config = {};
    this.isDirty = false;
    this.init();
  }

  async init() {
    // 绑定事件监听器
    this.bindEvents();
    
    // 加载配置
    await this.loadConfig();
    
    // 初始化UI
    this.initializeUI();
    
    console.log('Options manager initialized');
  }

  bindEvents() {
    // 导航菜单
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const section = e.currentTarget.dataset.section;
        this.switchSection(section);
      });
    });

    // 保存按钮
    document.getElementById('save-btn').addEventListener('click', () => {
      this.saveConfig();
    });

    // 表单元素变化监听
    this.bindFormEvents();

    // 特殊按钮事件
    this.bindSpecialEvents();
  }

  bindFormEvents() {
    // API配置相关
    const apiInputs = [
      'openai-base-url', 'openai-api-key', 'openai-temperature', 'openai-timeout',
      'gemini-base-url', 'gemini-api-key', 'gemini-temperature', 'gemini-timeout',
      'anthropic-base-url', 'anthropic-api-key', 'anthropic-temperature', 'anthropic-timeout'
    ];

    // 界面设置相关
    const interfaceInputs = [
      'theme', 'font-size', 'window-width', 'window-position',
      'auto-open', 'remember-position', 'enable-animations'
    ];

    // 高级设置相关
    const advancedInputs = [
      'debug-mode', 'log-api-calls'
    ];

    // 绑定所有输入元素的变化事件
    [...apiInputs, ...interfaceInputs, ...advancedInputs].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => {
          this.markDirty();
          this.updateSliderValue(element);
        });
        
        element.addEventListener('input', () => {
          this.markDirty();
          this.updateSliderValue(element);
        });
      }
    });

    // 绑定模型管理事件
    this.bindModelManagementEvents();

    // 密码显示切换
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });
  }

  bindModelManagementEvents() {
    // 添加模型按钮
    document.querySelectorAll('.add-model-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const provider = e.currentTarget.dataset.provider;
        this.addModel(provider);
      });
    });

    // 绑定现有的删除按钮和输入框
    this.bindExistingModelEvents();
  }

  bindExistingModelEvents() {
    // 删除模型按钮
    document.querySelectorAll('.remove-model-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modelItem = e.currentTarget.closest('.model-item');
        if (modelItem) {
          modelItem.remove();
          this.markDirty();
        }
      });
    });

    // 模型输入框变化
    document.querySelectorAll('.model-name, .model-display').forEach(input => {
      input.addEventListener('input', () => {
        this.markDirty();
      });
    });
  }

  addModel(provider) {
    const container = document.getElementById(`${provider}-models-container`);
    if (!container) return;

    const modelItem = document.createElement('div');
    modelItem.className = 'model-item';
    modelItem.innerHTML = `
      <input type="text" class="model-name" placeholder="模型名称">
      <input type="text" class="model-display" placeholder="显示名称">
      <button type="button" class="remove-model-btn">×</button>
    `;

    container.appendChild(modelItem);

    // 绑定新添加元素的事件
    const removeBtn = modelItem.querySelector('.remove-model-btn');
    removeBtn.addEventListener('click', () => {
      modelItem.remove();
      this.markDirty();
    });

    const inputs = modelItem.querySelectorAll('.model-name, .model-display');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.markDirty();
      });
    });

    this.markDirty();
  }

  bindSpecialEvents() {
    // 测试连接按钮
    document.querySelectorAll('.test-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const provider = e.currentTarget.dataset.provider;
        this.testConnection(provider);
      });
    });

    // 导出设置
    document.getElementById('export-settings')?.addEventListener('click', () => {
      this.exportSettings();
    });

    // 导入设置
    document.getElementById('import-settings')?.addEventListener('click', () => {
      this.importSettings();
    });

    // 重置设置
    document.getElementById('reset-settings')?.addEventListener('click', () => {
      this.resetSettings();
    });
  }

  switchSection(sectionName) {
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // 显示对应内容区域
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`${sectionName}-section`).classList.add('active');
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get('config');
      this.config = result.config || this.getDefaultConfig();
      console.log('Config loaded:', this.config);
    } catch (error) {
      console.error('Failed to load config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      apiConfigs: {
        openai: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          models: [
            { name: 'gpt-4', display: 'GPT-4' },
            { name: 'gpt-4-turbo', display: 'GPT-4 Turbo' },
            { name: 'gpt-3.5-turbo', display: 'GPT-3.5 Turbo' }
          ],
          temperature: 0.7,
          timeout: 120,
          enabled: false
        },
        gemini: {
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: '',
          models: [
            { name: 'gemini-pro', display: 'Gemini Pro' },
            { name: 'gemini-pro-vision', display: 'Gemini Pro Vision' }
          ],
          temperature: 0.7,
          timeout: 120,
          enabled: false
        },
        anthropic: {
          baseUrl: 'https://api.anthropic.com/v1',
          apiKey: '',
          models: [
            { name: 'claude-3-sonnet-20240229', display: 'Claude-3 Sonnet' },
            { name: 'claude-3-haiku-20240307', display: 'Claude-3 Haiku' }
          ],
          temperature: 0.7,
          timeout: 120,
          enabled: false
        }
      },
      currentProvider: 'openai',
      uiSettings: {
        theme: 'auto',
        fontSize: 14,
        windowWidth: 400,
        windowPosition: 'right',
        autoOpen: true,
        rememberPosition: true,
        enableAnimations: true
      },
      advancedSettings: {
        debugMode: false,
        logApiCalls: false
      }
    };
  }

  initializeUI() {
    // 填充API配置
    this.populateApiConfig();
    
    // 填充界面设置
    this.populateInterfaceSettings();
    
    // 填充高级设置
    this.populateAdvancedSettings();
    
    // 初始化滑块值显示
    this.initializeSliders();
  }

  populateApiConfig() {
    const { apiConfigs } = this.config;
    
    // 填充每个提供商的配置
    Object.keys(apiConfigs).forEach(provider => {
      const config = apiConfigs[provider];
      
      // 基本配置
      document.getElementById(`${provider}-base-url`).value = config.baseUrl;
      document.getElementById(`${provider}-api-key`).value = config.apiKey;
      document.getElementById(`${provider}-temperature`).value = config.temperature;
      document.getElementById(`${provider}-timeout`).value = config.timeout;
      
      // 填充模型列表
      this.populateModels(provider, config.models);
    });
  }

  populateModels(provider, models) {
    const container = document.getElementById(`${provider}-models-container`);
    if (!container) return;

    // 清空现有模型
    container.innerHTML = '';

    // 添加每个模型
    models.forEach(model => {
      const modelItem = document.createElement('div');
      modelItem.className = 'model-item';
      modelItem.innerHTML = `
        <input type="text" class="model-name" value="${model.name}" placeholder="模型名称">
        <input type="text" class="model-display" value="${model.display}" placeholder="显示名称">
        <button type="button" class="remove-model-btn">×</button>
      `;
      container.appendChild(modelItem);
    });

    // 重新绑定事件
    this.bindExistingModelEvents();
  }



  populateInterfaceSettings() {
    const { uiSettings } = this.config;
    
    document.getElementById('theme').value = uiSettings.theme;
    document.getElementById('font-size').value = uiSettings.fontSize;
    document.getElementById('window-width').value = uiSettings.windowWidth;
    document.getElementById('window-position').value = uiSettings.windowPosition;
    document.getElementById('auto-open').checked = uiSettings.autoOpen;
    document.getElementById('remember-position').checked = uiSettings.rememberPosition;
    document.getElementById('enable-animations').checked = uiSettings.enableAnimations;
  }

  populateAdvancedSettings() {
    const { advancedSettings } = this.config;
    
    document.getElementById('debug-mode').checked = advancedSettings.debugMode;
    document.getElementById('log-api-calls').checked = advancedSettings.logApiCalls;
  }

  initializeSliders() {
    const sliders = [
      'openai-temperature', 'openai-timeout',
      'gemini-temperature', 'gemini-timeout',
      'anthropic-temperature', 'anthropic-timeout',
      'font-size', 'window-width'
    ];
    
    sliders.forEach(id => {
      const slider = document.getElementById(id);
      if (slider) {
        this.updateSliderValue(slider);
      }
    });
  }

  updateSliderValue(element) {
    if (element.type === 'range') {
      const valueSpan = element.parentNode.querySelector('.slider-value');
      if (valueSpan) {
        let value = element.value;
        
        // 根据不同的滑块添加单位
        if (element.id.includes('timeout')) {
          value += '秒';
        } else if (element.id === 'font-size' || element.id === 'window-width') {
          value += 'px';
        }
        
        valueSpan.textContent = value;
      }
    }
  }

  markDirty() {
    this.isDirty = true;
    document.getElementById('save-btn').disabled = false;
  }

  async saveConfig() {
    try {
      // 收集所有配置
      const newConfig = this.collectConfig();
      
      // 保存到存储
      await chrome.storage.sync.set({ config: newConfig });
      
      // 更新本地配置
      this.config = newConfig;
      this.isDirty = false;
      
      // 显示保存成功状态
      this.showSaveStatus(true);
      
      console.log('Config saved successfully:', newConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
      this.showSaveStatus(false, error.message);
    }
  }

  collectConfig() {
    const apiConfigs = {};
    
    // 收集每个提供商的配置
    ['openai', 'gemini', 'anthropic'].forEach(provider => {
      const models = this.collectModels(provider);
      const apiKey = document.getElementById(`${provider}-api-key`).value.trim();
      const hasApiKey = apiKey !== '';
      
      apiConfigs[provider] = {
        baseUrl: document.getElementById(`${provider}-base-url`).value.trim(),
        apiKey: apiKey,
        models: models,
        temperature: parseFloat(document.getElementById(`${provider}-temperature`).value),
        timeout: parseInt(document.getElementById(`${provider}-timeout`).value),
        enabled: hasApiKey && models.length > 0 // 自动启用：有API Key且有模型
      };
      
      console.log(`Provider ${provider} config:`, {
        hasApiKey: hasApiKey,
        modelsCount: models.length,
        enabled: apiConfigs[provider].enabled
      });
    });

    console.log('Collected API configs:', apiConfigs);

    return {
      apiConfigs,
      currentProvider: this.config.currentProvider || 'openai',
      uiSettings: {
        theme: document.getElementById('theme').value,
        fontSize: parseInt(document.getElementById('font-size').value),
        windowWidth: parseInt(document.getElementById('window-width').value),
        windowPosition: document.getElementById('window-position').value,
        autoOpen: document.getElementById('auto-open').checked,
        rememberPosition: document.getElementById('remember-position').checked,
        enableAnimations: document.getElementById('enable-animations').checked
      },
      advancedSettings: {
        debugMode: document.getElementById('debug-mode').checked,
        logApiCalls: document.getElementById('log-api-calls').checked
      }
    };
  }

  collectModels(provider) {
    const container = document.getElementById(`${provider}-models-container`);
    if (!container) return [];

    const models = [];
    const modelItems = container.querySelectorAll('.model-item');
    
    modelItems.forEach(item => {
      const nameInput = item.querySelector('.model-name');
      const displayInput = item.querySelector('.model-display');
      
      if (nameInput && displayInput && nameInput.value.trim()) {
        models.push({
          name: nameInput.value.trim(),
          display: displayInput.value.trim() || nameInput.value.trim()
        });
      }
    });

    return models;
  }

  showSaveStatus(success, message = '') {
    const statusElement = document.getElementById('save-status');
    const saveBtn = document.getElementById('save-btn');
    
    if (success) {
      statusElement.classList.add('show');
      saveBtn.disabled = true;
      
      setTimeout(() => {
        statusElement.classList.remove('show');
      }, 3000);
    } else {
      // 显示错误消息
      console.error('Save failed:', message);
    }
  }

  async testConnection(provider) {
    const btn = document.querySelector(`[data-provider="${provider}"]`);
    const originalText = btn.innerHTML;
    
    try {
      // 显示加载状态
      btn.disabled = true;
      btn.className = btn.className.replace(/\s*(success|error|testing)/g, '') + ' testing';
      btn.innerHTML = '<div class="loading"></div> 测试中...';
      
      // 获取当前配置
      const config = this.collectConfig();
      const providerConfig = config.apiConfigs[provider];
      
      if (!providerConfig.apiKey) {
        throw new Error('请先配置API Key');
      }

      if (!providerConfig.models || providerConfig.models.length === 0) {
        throw new Error('请先配置至少一个模型');
      }
      
      // 模拟API测试请求
      const testResult = await this.performApiTest(provider, providerConfig);
      
      if (testResult.success) {
        btn.className = btn.className.replace(/\s*(testing|error)/g, '') + ' success';
        btn.innerHTML = '✓ 连接成功';
      } else {
        throw new Error(testResult.error || '连接失败');
      }
    } catch (error) {
      btn.className = btn.className.replace(/\s*(testing|success)/g, '') + ' error';
      btn.innerHTML = '✗ ' + error.message;
    }
    
    // 3秒后恢复原状
    setTimeout(() => {
      btn.disabled = false;
      btn.className = btn.className.replace(/\s*(success|error|testing)/g, '');
      btn.innerHTML = originalText;
    }, 3000);
  }

  async performApiTest(provider, config) {
    try {
      // 构建测试请求
      let testUrl, testHeaders, testBody;
      
      switch (provider) {
        case 'openai':
          testUrl = `${config.baseUrl}/models`;
          testHeaders = {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          };
          break;
          
        case 'gemini':
          testUrl = `${config.baseUrl}/models?key=${config.apiKey}`;
          testHeaders = {
            'Content-Type': 'application/json'
          };
          break;
          
        case 'anthropic':
          testUrl = `${config.baseUrl}/messages`;
          testHeaders = {
            'x-api-key': config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          };
          testBody = JSON.stringify({
            model: config.models[0]?.name || 'claude-3-sonnet-20240229',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }]
          });
          break;
          
        default:
          throw new Error('不支持的提供商');
      }

      // 发起测试请求
      const response = await fetch(testUrl, {
        method: provider === 'anthropic' ? 'POST' : 'GET',
        headers: testHeaders,
        body: testBody,
        signal: AbortSignal.timeout(10000) // 10秒超时
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch (e) {
          // 使用默认错误消息
        }
        
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('API test failed:', error);
      
      if (error.name === 'AbortError') {
        return { success: false, error: '请求超时' };
      } else if (error.message.includes('Failed to fetch')) {
        return { success: false, error: '网络连接失败' };
      } else {
        return { success: false, error: error.message };
      }
    }
  }

  exportSettings() {
    const config = this.collectConfig();
    
    // 移除敏感信息
    const exportConfig = JSON.parse(JSON.stringify(config));
    Object.keys(exportConfig.apiConfigs).forEach(provider => {
      exportConfig.apiConfigs[provider].apiKey = '';
    });
    
    // 创建下载链接
    const blob = new Blob([JSON.stringify(exportConfig, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'github-code-analyzer-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedConfig = JSON.parse(e.target.result);
            
            // 验证配置格式
            if (this.validateConfig(importedConfig)) {
              // 合并配置（保留现有的API密钥）
              const mergedConfig = this.mergeConfigs(this.config, importedConfig);
              this.config = mergedConfig;
              
              // 更新UI
              this.initializeUI();
              this.markDirty();
              
              alert('设置导入成功！请检查配置并保存。');
            } else {
              throw new Error('配置文件格式不正确');
            }
          } catch (error) {
            alert('导入失败: ' + error.message);
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }

  validateConfig(config) {
    // 简单的配置验证
    return config && 
           config.apiConfigs && 
           config.conversationSettings && 
           config.uiSettings;
  }

  mergeConfigs(current, imported) {
    const merged = { ...imported };
    
    // 保留现有的API密钥
    Object.keys(current.apiConfigs).forEach(provider => {
      if (merged.apiConfigs[provider] && current.apiConfigs[provider].apiKey) {
        merged.apiConfigs[provider].apiKey = current.apiConfigs[provider].apiKey;
      }
    });
    
    return merged;
  }

  async resetSettings() {
    if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
      try {
        // 清除存储
        await chrome.storage.sync.clear();
        
        // 重置为默认配置
        this.config = this.getDefaultConfig();
        
        // 更新UI
        this.initializeUI();
        this.markDirty();
        
        alert('设置已重置为默认值');
      } catch (error) {
        alert('重置失败: ' + error.message);
      }
    }
  }

  sendMessageToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }
}

// 初始化选项管理器
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});