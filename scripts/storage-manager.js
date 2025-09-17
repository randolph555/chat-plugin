// 存储管理器
// 负责处理Chrome存储、IndexedDB、Cookie等本地存储功能

class StorageManager {
  constructor() {
    this.dbName = 'GitHubChatAssistant';
    this.dbVersion = 1;
    this.db = null;
    this.storageQuota = 100 * 1024 * 1024; // 100MB
    this.compressionEnabled = true;
    
    // 存储键名常量
    this.KEYS = {
      CONFIG: 'assistant_config',
      CONVERSATIONS: 'conversations',
      FILE_CACHE: 'file_cache',
      USER_PREFERENCES: 'user_preferences',
      REPOSITORY_DATA: 'repository_data',
      UPLOAD_HISTORY: 'upload_history'
    };
  }

  // 初始化存储
  async initialize() {
    try {
      await this.initIndexedDB();
      await this.migrateOldData();
      await this.cleanupExpiredData();
      console.log('Storage manager initialized');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  // 初始化IndexedDB
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 创建对象存储
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
          conversationStore.createIndex('repository', 'repository.fullName', { unique: false });
          conversationStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('fileCache')) {
          const fileCacheStore = db.createObjectStore('fileCache', { keyPath: 'path' });
          fileCacheStore.createIndex('repository', 'repository', { unique: false });
          fileCacheStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('uploads')) {
          const uploadStore = db.createObjectStore('uploads', { keyPath: 'id' });
          uploadStore.createIndex('timestamp', 'timestamp', { unique: false });
          uploadStore.createIndex('conversationId', 'conversationId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('repositories')) {
          const repoStore = db.createObjectStore('repositories', { keyPath: 'fullName' });
          repoStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
  }

  // Chrome存储操作
  async getChromeStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  async setChromeStorage(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async removeChromeStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve);
    });
  }

  // 配置管理
  async getConfig() {
    try {
      const config = await this.getChromeStorage(this.KEYS.CONFIG);
      return config || this.getDefaultConfig();
    } catch (error) {
      console.error('Failed to get config:', error);
      return this.getDefaultConfig();
    }
  }

  async saveConfig(config) {
    try {
      // 验证配置
      const validatedConfig = this.validateConfig(config);
      await this.setChromeStorage(this.KEYS.CONFIG, validatedConfig);
      return validatedConfig;
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  getDefaultConfig() {
    return {
      llmProviders: {
        openai: {
          enabled: true,
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          defaultModel: 'gpt-4'
        },
        anthropic: {
          enabled: false,
          baseUrl: 'https://api.anthropic.com/v1',
          apiKey: '',
          models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
          defaultModel: 'claude-3-sonnet'
        },
        gemini: {
          enabled: false,
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: '',
          models: ['gemini-pro', 'gemini-pro-vision'],
          defaultModel: 'gemini-pro'
        }
      },
      conversationSettings: {
        maxContextLength: 8000,
        summaryTrigger: 75,
        preserveCodeContext: true,
        autoSummarize: true,
        streamResponse: true
      },
      uiSettings: {
        theme: 'auto',
        windowPosition: 'right',
        windowWidth: 400,
        fontSize: 14,
        showLineNumbers: true,
        enableAnimations: true
      },
      githubSettings: {
        cacheTimeout: 3600000, // 1小时
        maxFileSize: 1048576, // 1MB
        excludePatterns: ['node_modules', '.git', 'dist', 'build'],
        includeBinaryFiles: false
      },
      uploadSettings: {
        maxFileSize: 10485760, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        compressionQuality: 0.8,
        maxDimensions: { width: 1920, height: 1080 }
      }
    };
  }

  validateConfig(config) {
    const defaultConfig = this.getDefaultConfig();
    
    // 深度合并配置，确保所有必需字段存在
    return this.deepMerge(defaultConfig, config);
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // 对话存储
  async saveConversation(conversation) {
    try {
      const transaction = this.db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      
      // 压缩对话数据
      const compressedConversation = this.compressionEnabled 
        ? await this.compressData(conversation)
        : conversation;
      
      await store.put(compressedConversation);
      return conversation.id;
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  }

  async getConversation(conversationId) {
    try {
      const transaction = this.db.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.get(conversationId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const conversation = request.result;
          if (conversation) {
            // 解压缩数据
            const decompressed = this.compressionEnabled 
              ? await this.decompressData(conversation)
              : conversation;
            resolve(decompressed);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  }

  async getConversationsByRepository(repositoryName) {
    try {
      const transaction = this.db.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('repository');
      const request = index.getAll(repositoryName);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const conversations = request.result || [];
          // 解压缩所有对话
          const decompressed = await Promise.all(
            conversations.map(conv => 
              this.compressionEnabled ? this.decompressData(conv) : conv
            )
          );
          resolve(decompressed);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get conversations by repository:', error);
      return [];
    }
  }

  async deleteConversation(conversationId) {
    try {
      const transaction = this.db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      await store.delete(conversationId);
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
  }

  // 文件缓存
  async cacheFile(filePath, fileContent, repository) {
    try {
      const cacheEntry = {
        path: filePath,
        content: fileContent,
        repository: repository,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        size: JSON.stringify(fileContent).length
      };
      
      const transaction = this.db.transaction(['fileCache'], 'readwrite');
      const store = transaction.objectStore('fileCache');
      await store.put(cacheEntry);
      
      // 检查缓存大小
      await this.cleanupFileCache();
      
      return true;
    } catch (error) {
      console.error('Failed to cache file:', error);
      return false;
    }
  }

  async getCachedFile(filePath) {
    try {
      const transaction = this.db.transaction(['fileCache'], 'readwrite');
      const store = transaction.objectStore('fileCache');
      const request = store.get(filePath);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const cacheEntry = request.result;
          if (cacheEntry) {
            // 更新访问时间
            cacheEntry.lastAccessed = Date.now();
            await store.put(cacheEntry);
            resolve(cacheEntry.content);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get cached file:', error);
      return null;
    }
  }

  async cleanupFileCache() {
    try {
      const transaction = this.db.transaction(['fileCache'], 'readwrite');
      const store = transaction.objectStore('fileCache');
      const index = store.index('lastAccessed');
      
      // 获取所有缓存条目
      const allEntries = await this.getAllFromStore(store);
      
      // 计算总大小
      const totalSize = allEntries.reduce((sum, entry) => sum + entry.size, 0);
      
      // 如果超过配额，删除最旧的条目
      if (totalSize > this.storageQuota * 0.8) { // 80%阈值
        const sortedEntries = allEntries.sort((a, b) => a.lastAccessed - b.lastAccessed);
        const toDelete = sortedEntries.slice(0, Math.floor(sortedEntries.length * 0.3));
        
        for (const entry of toDelete) {
          await store.delete(entry.path);
        }
        
        console.log(`Cleaned up ${toDelete.length} cached files`);
      }
    } catch (error) {
      console.error('Failed to cleanup file cache:', error);
    }
  }

  // 图片上传和存储
  async saveUploadedImage(imageData, conversationId, metadata = {}) {
    try {
      const uploadId = this.generateUploadId();
      const uploadEntry = {
        id: uploadId,
        conversationId: conversationId,
        data: imageData,
        metadata: {
          ...metadata,
          originalSize: imageData.length,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      };
      
      const transaction = this.db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      await store.put(uploadEntry);
      
      return uploadId;
    } catch (error) {
      console.error('Failed to save uploaded image:', error);
      throw error;
    }
  }

  async getUploadedImage(uploadId) {
    try {
      const transaction = this.db.transaction(['uploads'], 'readonly');
      const store = transaction.objectStore('uploads');
      const request = store.get(uploadId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get uploaded image:', error);
      return null;
    }
  }

  async getUploadsByConversation(conversationId) {
    try {
      const transaction = this.db.transaction(['uploads'], 'readonly');
      const store = transaction.objectStore('uploads');
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get uploads by conversation:', error);
      return [];
    }
  }

  async deleteUpload(uploadId) {
    try {
      const transaction = this.db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      await store.delete(uploadId);
      return true;
    } catch (error) {
      console.error('Failed to delete upload:', error);
      return false;
    }
  }

  // 仓库数据存储
  async saveRepositoryData(repositoryInfo) {
    try {
      const repoData = {
        ...repositoryInfo,
        lastAccessed: Date.now(),
        cachedAt: Date.now()
      };
      
      const transaction = this.db.transaction(['repositories'], 'readwrite');
      const store = transaction.objectStore('repositories');
      await store.put(repoData);
      
      return true;
    } catch (error) {
      console.error('Failed to save repository data:', error);
      return false;
    }
  }

  async getRepositoryData(fullName) {
    try {
      const transaction = this.db.transaction(['repositories'], 'readwrite');
      const store = transaction.objectStore('repositories');
      const request = store.get(fullName);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const repoData = request.result;
          if (repoData) {
            // 更新访问时间
            repoData.lastAccessed = Date.now();
            await store.put(repoData);
            resolve(repoData);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get repository data:', error);
      return null;
    }
  }

  // 用户偏好设置
  async getUserPreferences() {
    try {
      const preferences = await this.getChromeStorage(this.KEYS.USER_PREFERENCES);
      return preferences || this.getDefaultPreferences();
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  async saveUserPreferences(preferences) {
    try {
      await this.setChromeStorage(this.KEYS.USER_PREFERENCES, preferences);
      return true;
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      return false;
    }
  }

  getDefaultPreferences() {
    return {
      language: 'zh-CN',
      notifications: true,
      autoSave: true,
      keyboardShortcuts: true,
      debugMode: false,
      telemetry: false
    };
  }

  // 数据压缩和解压缩
  async compressData(data) {
    try {
      const jsonString = JSON.stringify(data);
      
      // 使用简单的压缩算法（实际项目中可以使用更好的压缩库）
      const compressed = this.simpleCompress(jsonString);
      
      return {
        ...data,
        _compressed: true,
        _originalSize: jsonString.length,
        _compressedData: compressed
      };
    } catch (error) {
      console.error('Failed to compress data:', error);
      return data;
    }
  }

  async decompressData(data) {
    try {
      if (!data._compressed) {
        return data;
      }
      
      const decompressed = this.simpleDecompress(data._compressedData);
      const originalData = JSON.parse(decompressed);
      
      return originalData;
    } catch (error) {
      console.error('Failed to decompress data:', error);
      return data;
    }
  }

  simpleCompress(str) {
    // 简单的RLE压缩
    return str.replace(/(.)\1+/g, (match, char) => {
      return char + match.length;
    });
  }

  simpleDecompress(str) {
    // 简单的RLE解压缩
    return str.replace(/(.)\d+/g, (match, char) => {
      const count = parseInt(match.slice(1));
      return char.repeat(count);
    });
  }

  // 数据迁移
  async migrateOldData() {
    try {
      // 检查是否有旧版本的数据需要迁移
      const oldConversations = await this.getChromeStorage('old_conversations');
      if (oldConversations) {
        // 迁移旧对话数据
        for (const conversation of oldConversations) {
          await this.saveConversation(conversation);
        }
        
        // 删除旧数据
        await this.removeChromeStorage('old_conversations');
        console.log('Migrated old conversation data');
      }
    } catch (error) {
      console.error('Failed to migrate old data:', error);
    }
  }

  // 清理过期数据
  async cleanupExpiredData() {
    try {
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
      const now = Date.now();
      
      // 清理过期的对话
      const conversations = await this.getAllFromStore(
        this.db.transaction(['conversations'], 'readwrite').objectStore('conversations')
      );
      
      for (const conversation of conversations) {
        if (now - conversation.updatedAt > maxAge) {
          await this.deleteConversation(conversation.id);
        }
      }
      
      // 清理过期的上传文件
      const uploads = await this.getAllFromStore(
        this.db.transaction(['uploads'], 'readwrite').objectStore('uploads')
      );
      
      for (const upload of uploads) {
        if (now - upload.timestamp > maxAge) {
          await this.deleteUpload(upload.id);
        }
      }
      
      console.log('Cleaned up expired data');
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
    }
  }

  // 工具方法
  async getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 存储统计
  async getStorageStats() {
    try {
      const stats = {
        chrome: await this.getChromeStorageUsage(),
        indexedDB: await this.getIndexedDBUsage(),
        total: 0
      };
      
      stats.total = stats.chrome + stats.indexedDB;
      
      return stats;
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { chrome: 0, indexedDB: 0, total: 0 };
    }
  }

  async getChromeStorageUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        resolve(bytesInUse || 0);
      });
    });
  }

  async getIndexedDBUsage() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return 0;
      }
      
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    } catch (error) {
      return 0;
    }
  }

  // 数据导出和导入
  async exportAllData() {
    try {
      const data = {
        config: await this.getConfig(),
        preferences: await this.getUserPreferences(),
        conversations: await this.getAllFromStore(
          this.db.transaction(['conversations'], 'readonly').objectStore('conversations')
        ),
        repositories: await this.getAllFromStore(
          this.db.transaction(['repositories'], 'readonly').objectStore('repositories')
        ),
        exportedAt: Date.now(),
        version: this.dbVersion
      };
      
      return data;
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async importData(data) {
    try {
      // 验证数据格式
      if (!data || !data.version) {
        throw new Error('Invalid data format');
      }
      
      // 导入配置
      if (data.config) {
        await this.saveConfig(data.config);
      }
      
      // 导入偏好设置
      if (data.preferences) {
        await this.saveUserPreferences(data.preferences);
      }
      
      // 导入对话
      if (data.conversations) {
        for (const conversation of data.conversations) {
          await this.saveConversation(conversation);
        }
      }
      
      // 导入仓库数据
      if (data.repositories) {
        for (const repo of data.repositories) {
          await this.saveRepositoryData(repo);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  // 清除所有数据
  async clearAllData() {
    try {
      // 清除Chrome存储
      await new Promise((resolve) => {
        chrome.storage.local.clear(resolve);
      });
      
      // 清除IndexedDB
      if (this.db) {
        this.db.close();
      }
      
      await new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(this.dbName);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
      
      // 重新初始化
      await this.initialize();
      
      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }

  // 销毁
  destroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// 导出
window.StorageManager = StorageManager;