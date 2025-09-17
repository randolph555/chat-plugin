// GitHub API 集成模块
// 负责获取仓库信息、文件内容、目录结构等

class GitHubAPI {
  constructor() {
    this.baseUrl = 'https://api.github.com';
    this.repoInfo = null;
    this.fileCache = new Map();
    this.treeCache = new Map();
  }

  // 从当前页面URL解析仓库信息
  parseRepoFromUrl(url = window.location.href) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      const [, owner, repo] = match;
      // 移除可能的.git后缀
      const cleanRepo = repo.replace(/\.git$/, '');
      return { owner, repo: cleanRepo };
    }
    return null;
  }

  // 获取当前分支
  getCurrentBranch() {
    // 尝试从页面元素获取分支信息
    const branchElement = document.querySelector('[data-hotkey="w"] strong, .js-branch-select-menu .js-select-button span');
    if (branchElement) {
      return branchElement.textContent.trim();
    }
    
    // 从URL路径解析分支（如果在特定分支页面）
    const pathMatch = window.location.pathname.match(/\/tree\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    return 'main'; // 默认分支
  }

  // 初始化仓库信息
  async initRepository() {
    const repoData = this.parseRepoFromUrl();
    if (!repoData) {
      throw new Error('无法解析GitHub仓库信息');
    }

    this.repoInfo = {
      ...repoData,
      branch: this.getCurrentBranch(),
      fullName: `${repoData.owner}/${repoData.repo}`
    };

    console.log('Repository initialized:', this.repoInfo);
    return this.repoInfo;
  }

  // 获取仓库基本信息
  async getRepositoryInfo() {
    if (!this.repoInfo) {
      await this.initRepository();
    }

    const { owner, repo } = this.repoInfo;
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        language: data.language,
        stars: data.stargazers_count,
        forks: data.forks_count,
        defaultBranch: data.default_branch,
        topics: data.topics || [],
        license: data.license?.name,
        size: data.size,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Failed to fetch repository info:', error);
      throw error;
    }
  }

  // 获取文件树结构
  async getRepositoryTree(path = '', recursive = true) {
    if (!this.repoInfo) {
      await this.initRepository();
    }

    const { owner, repo, branch } = this.repoInfo;
    const cacheKey = `${owner}/${repo}/${branch}/${path}`;
    
    // 检查缓存
    if (this.treeCache.has(cacheKey)) {
      return this.treeCache.get(cacheKey);
    }

    const url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${branch}${recursive ? '?recursive=1' : ''}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const data = await response.json();
      const tree = this.processTreeData(data.tree);
      
      // 缓存结果
      this.treeCache.set(cacheKey, tree);
      
      return tree;
    } catch (error) {
      console.error('Failed to fetch repository tree:', error);
      throw error;
    }
  }

  // 处理树形数据，构建层级结构
  processTreeData(treeArray) {
    const tree = {
      files: [],
      directories: []
    };

    const pathMap = new Map();
    
    // 首先创建所有路径的映射
    treeArray.forEach(item => {
      const pathParts = item.path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      
      const processedItem = {
        name: fileName,
        path: item.path,
        type: item.type,
        size: item.size,
        sha: item.sha,
        url: item.url
      };

      if (item.type === 'blob') {
        // 文件
        if (pathParts.length === 1) {
          tree.files.push(processedItem);
        }
      } else if (item.type === 'tree') {
        // 目录
        if (pathParts.length === 1) {
          tree.directories.push({
            ...processedItem,
            children: { files: [], directories: [] }
          });
        }
      }
      
      pathMap.set(item.path, processedItem);
    });

    // 构建嵌套结构
    treeArray.forEach(item => {
      const pathParts = item.path.split('/');
      if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join('/');
        const parent = this.findNodeByPath(tree, parentPath);
        
        if (parent && parent.children) {
          const processedItem = pathMap.get(item.path);
          if (item.type === 'blob') {
            parent.children.files.push(processedItem);
          } else if (item.type === 'tree') {
            parent.children.directories.push({
              ...processedItem,
              children: { files: [], directories: [] }
            });
          }
        }
      }
    });

    return tree;
  }

  // 在树结构中查找指定路径的节点
  findNodeByPath(tree, path) {
    const pathParts = path.split('/');
    let current = tree;
    
    for (const part of pathParts) {
      const found = current.directories?.find(dir => dir.name === part);
      if (found) {
        current = found;
      } else {
        return null;
      }
    }
    
    return current;
  }

  // 获取文件内容
  async getFileContent(filePath) {
    if (!this.repoInfo) {
      await this.initRepository();
    }

    const { owner, repo, branch } = this.repoInfo;
    const cacheKey = `${owner}/${repo}/${branch}/${filePath}`;
    
    // 检查缓存
    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey);
    }

    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      // 解码Base64内容
      const content = atob(data.content.replace(/\n/g, ''));
      
      const fileInfo = {
        name: data.name,
        path: data.path,
        content: content,
        size: data.size,
        sha: data.sha,
        encoding: data.encoding,
        downloadUrl: data.download_url
      };
      
      // 缓存结果（限制缓存大小）
      if (this.fileCache.size < 100) {
        this.fileCache.set(cacheKey, fileInfo);
      }
      
      return fileInfo;
    } catch (error) {
      console.error('Failed to fetch file content:', error);
      throw error;
    }
  }

  // 搜索文件
  async searchFiles(query, options = {}) {
    if (!this.repoInfo) {
      await this.initRepository();
    }

    const { owner, repo } = this.repoInfo;
    const {
      type = 'file', // file, path
      extension = '',
      size = '',
      language = ''
    } = options;

    let searchQuery = `${query} repo:${owner}/${repo}`;
    
    if (extension) {
      searchQuery += ` extension:${extension}`;
    }
    
    if (size) {
      searchQuery += ` size:${size}`;
    }
    
    if (language) {
      searchQuery += ` language:${language}`;
    }

    const url = `${this.baseUrl}/search/code?q=${encodeURIComponent(searchQuery)}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        totalCount: data.total_count,
        items: data.items.map(item => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          url: item.url,
          htmlUrl: item.html_url,
          repository: item.repository,
          score: item.score
        }))
      };
    } catch (error) {
      console.error('Failed to search files:', error);
      throw error;
    }
  }

  // 获取README文件
  async getReadme() {
    const readmeFiles = ['README.md', 'README.rst', 'README.txt', 'README'];
    
    for (const filename of readmeFiles) {
      try {
        const content = await this.getFileContent(filename);
        return content;
      } catch (error) {
        // 继续尝试下一个文件名
        continue;
      }
    }
    
    throw new Error('README file not found');
  }

  // 获取文档文件列表
  async getDocumentationFiles() {
    try {
      const tree = await this.getRepositoryTree();
      const docFiles = [];
      
      // 递归搜索文档文件
      const searchDocs = (node, currentPath = '') => {
        // 搜索文件
        if (node.files) {
          node.files.forEach(file => {
            const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
            const ext = file.name.split('.').pop()?.toLowerCase();
            
            // 文档文件扩展名
            const docExtensions = ['md', 'rst', 'txt', 'adoc', 'org'];
            
            // 文档相关的文件名模式
            const docPatterns = [
              /readme/i, /changelog/i, /license/i, /contributing/i,
              /install/i, /setup/i, /guide/i, /tutorial/i, /doc/i,
              /api/i, /usage/i, /example/i, /demo/i
            ];
            
            if (docExtensions.includes(ext) || 
                docPatterns.some(pattern => pattern.test(file.name))) {
              docFiles.push({
                ...file,
                path: filePath,
                category: this.categorizeDocFile(file.name)
              });
            }
          });
        }
        
        // 搜索目录
        if (node.directories) {
          node.directories.forEach(dir => {
            const dirPath = currentPath ? `${currentPath}/${dir.name}` : dir.name;
            
            // 文档目录名
            const docDirNames = ['docs', 'doc', 'documentation', 'guide', 'guides', 'examples', 'demo', 'demos'];
            
            if (docDirNames.includes(dir.name.toLowerCase()) || dir.children) {
              searchDocs(dir.children, dirPath);
            }
          });
        }
      };
      
      searchDocs(tree);
      
      return docFiles.sort((a, b) => {
        // 按类别和名称排序
        if (a.category !== b.category) {
          const categoryOrder = ['readme', 'guide', 'api', 'example', 'other'];
          return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Failed to get documentation files:', error);
      return [];
    }
  }

  // 分类文档文件
  categorizeDocFile(filename) {
    const name = filename.toLowerCase();
    
    if (/readme/i.test(name)) return 'readme';
    if (/guide|tutorial|setup|install/i.test(name)) return 'guide';
    if (/api|reference/i.test(name)) return 'api';
    if (/example|demo|sample/i.test(name)) return 'example';
    
    return 'other';
  }

  // 获取文件的语言类型
  getFileLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
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
      'kt': 'kotlin',
      'scala': 'scala',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'ps1': 'powershell',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini',
      'md': 'markdown',
      'rst': 'rst',
      'txt': 'text'
    };
    
    return languageMap[ext] || 'text';
  }

  // 清除缓存
  clearCache() {
    this.fileCache.clear();
    this.treeCache.clear();
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      fileCache: this.fileCache.size,
      treeCache: this.treeCache.size,
      totalMemory: this.estimateCacheSize()
    };
  }

  // 估算缓存大小
  estimateCacheSize() {
    let size = 0;
    
    for (const [key, value] of this.fileCache) {
      size += key.length + (value.content?.length || 0);
    }
    
    for (const [key, value] of this.treeCache) {
      size += key.length + JSON.stringify(value).length;
    }
    
    return size;
  }
}

// 导出单例实例
window.GitHubAPI = GitHubAPI;