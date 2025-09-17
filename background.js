// Chrome Extension Background Script
// 处理插件的后台逻辑和API调用

class BackgroundService {
  constructor() {
    this.initializeExtension();
  }

  initializeExtension() {
    // 监听插件安装事件
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      }
    });

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放以支持异步响应
    });

    // 监听标签页更新事件
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && tab.url.includes('github.com')) {
        this.handleGitHubPageLoad(tabId, tab);
      }
    });
  }

  async handleFirstInstall() {
    // 设置默认配置
    const defaultConfig = {
      apiConfigs: {
        openai: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4',
          enabled: false
        },
        gemini: {
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: '',
          model: 'gemini-pro',
          enabled: false
        },
        anthropic: {
          baseUrl: 'https://api.anthropic.com/v1',
          apiKey: '',
          model: 'claude-3-sonnet-20240229',
          enabled: false
        }
      },
      currentProvider: 'openai',
      uiSettings: {
        theme: 'auto',
        fontSize: 14,
        windowWidth: 400,
        windowPosition: 'right'
      },
      conversationSettings: {
        maxContextLength: 8000,
        temperature: 0.7,
        maxTokens: 2000
      }
    };

    await chrome.storage.sync.set({ config: defaultConfig });
    console.log('GitHub代码分析助手已安装，默认配置已设置');
  }

  handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'openOptions':
          // 打开设置页面
          try {
            if (chrome.runtime.openOptionsPage) {
              chrome.runtime.openOptionsPage();
            } else {
              chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
            }
            sendResponse({ success: true });
          } catch (error) {
            console.error('Failed to open options page:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
          
        case 'getConfig':
          this.getConfig().then(config => {
            sendResponse({ success: true, data: config });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // 异步响应
          
        case 'updateConfig':
          this.updateConfig(request.config).then(() => {
            sendResponse({ success: true });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // 异步响应

        case 'analyzeRepository':
          this.analyzeRepository(request.repoUrl).then(repoData => {
            sendResponse({ success: true, data: repoData });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // 异步响应

        case 'sendMessage':
          this.handleLLMRequest(request, sendResponse);
          return true; // 异步响应

        case 'getFileContent':
          this.getGitHubFileContent(request.url).then(fileContent => {
            sendResponse({ success: true, data: fileContent });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // 异步响应

        case 'readFile':
          // 转发文件读取请求到当前活动的标签页
          this.forwardReadFileRequest(request, sendResponse);
          return true; // 保持消息通道开放以支持异步响应

        case 'getPageInfo':
          // 获取页面信息
          this.getPageInfo(sendResponse);
          return true; // 异步响应

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getConfig() {
    const result = await chrome.storage.sync.get('config');
    return result.config || {};
  }

  async updateConfig(newConfig) {
    await chrome.storage.sync.set({ config: newConfig });
  }

  async analyzeRepository(repoUrl) {
    // 解析GitHub仓库URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;
    
    // 获取仓库基本信息
    const repoInfo = await this.fetchGitHubAPI(`/repos/${owner}/${repo}`);
    
    // 获取文件树
    const tree = await this.fetchGitHubAPI(`/repos/${owner}/${repo}/git/trees/${repoInfo.default_branch}?recursive=1`);
    
    // 获取README内容
    let readmeContent = '';
    try {
      const readme = await this.fetchGitHubAPI(`/repos/${owner}/${repo}/readme`);
      readmeContent = atob(readme.content);
    } catch (e) {
      console.log('No README found');
    }

    return {
      owner,
      repo,
      info: repoInfo,
      tree: tree.tree,
      readme: readmeContent
    };
  }

  async fetchGitHubAPI(endpoint) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Code-Analyzer-Extension'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  async getGitHubFileContent(fileUrl) {
    // 从GitHub文件URL获取原始内容
    const rawUrl = fileUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    
    const response = await fetch(rawUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    return response.text();
  }

  async handleLLMRequest(request, sendResponse) {
    const config = await this.getConfig();
    const provider = config.apiConfigs[config.currentProvider];

    if (!provider || !provider.enabled || !provider.apiKey) {
      sendResponse({ success: false, error: 'LLM provider not configured' });
      return;
    }

    try {
      // 根据不同的API提供商调用相应的接口
      let response;
      switch (config.currentProvider) {
        case 'openai':
          response = await this.callOpenAI(provider, request.messages);
          break;
        case 'gemini':
          response = await this.callGemini(provider, request.messages);
          break;
        case 'anthropic':
          response = await this.callAnthropic(provider, request.messages);
          break;
        default:
          throw new Error('Unsupported provider');
      }

      sendResponse({ success: true, data: response });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async callOpenAI(config, messages) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return response;
  }

  async callGemini(config, messages) {
    // Gemini API调用实现
    const response = await fetch(`${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: messages.map(msg => ({
          parts: [{ text: msg.content }],
          role: msg.role === 'assistant' ? 'model' : 'user'
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    return response;
  }

  async callAnthropic(config, messages) {
    // Anthropic API调用实现
    const response = await fetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    return response;
  }

  async handleGitHubPageLoad(tabId, tab) {
    // 当GitHub页面加载完成时，注入必要的脚本
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }

  // 转发文件读取请求到content script
  forwardReadFileRequest(request, sendResponse) {
    // 获取当前活动标签页
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: '无法找到活动标签页' });
        return;
      }

      const tabId = tabs[0].id;
      
      // 转发请求到content script
      chrome.tabs.sendMessage(tabId, {
        action: 'readFile',
        filePath: request.filePath
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Content script communication error:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: `Content script通信失败: ${chrome.runtime.lastError.message}` 
          });
        } else if (response) {
          sendResponse(response);
        } else {
          sendResponse({ success: false, error: '未收到content script响应' });
        }
      });
    });
  }

  // 获取页面信息
  getPageInfo(sendResponse) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: '无法找到活动标签页' });
        return;
      }

      const tab = tabs[0];
      const url = tab.url;
      
      // 解析GitHub仓库信息
      const urlMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (urlMatch) {
        const [, owner, repo] = urlMatch;
        // 提取分支信息
        const branchMatch = url.match(/\/(?:blob|tree)\/([^\/]+)\//);
        const branch = branchMatch ? branchMatch[1] : 'main';
        
        sendResponse({
          success: true,
          repoInfo: { owner, repo, branch },
          url: url
        });
      } else {
        sendResponse({ 
          success: false, 
          error: '当前页面不是GitHub仓库页面' 
        });
      }
    });
  }
}

// 初始化后台服务
new BackgroundService();