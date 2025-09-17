// 文件引用管理器
// 负责处理@文件名引用功能，包括自动补全、文件搜索、内容预览等

class FileReferenceManager {
  constructor() {
    this.githubAPI = null;
    this.fileCache = new Map();
    this.fileTree = null;
    this.flatFileList = [];
    this.autocompleteContainer = null;
    this.currentInput = null;
    this.currentQuery = '';
    this.currentPosition = 0;
    this.selectedIndex = -1;
    this.isVisible = false;
    
    // 绑定方法
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  // 初始化
  async initialize(githubAPI) {
    this.githubAPI = githubAPI;
    await this.loadFileTree();
    this.createAutocompleteContainer();
    this.bindGlobalEvents();
    console.log('File reference manager initialized');
  }

  // 加载文件树
  async loadFileTree() {
    try {
      this.fileTree = await this.githubAPI.getRepositoryTree();
      this.flatFileList = this.flattenFileTree(this.fileTree);
      console.log(`Loaded ${this.flatFileList.length} files`);
    } catch (error) {
      console.error('Failed to load file tree:', error);
      this.flatFileList = [];
    }
  }

  // 扁平化文件树
  flattenFileTree(tree, currentPath = '') {
    let files = [];
    
    // 处理文件
    if (tree.files) {
      tree.files.forEach(file => {
        const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        files.push({
          name: file.name,
          path: fullPath,
          type: 'file',
          size: file.size,
          language: this.getFileLanguage(file.name),
          icon: this.getFileIcon(file.name)
        });
      });
    }
    
    // 处理目录
    if (tree.directories) {
      tree.directories.forEach(dir => {
        const fullPath = currentPath ? `${currentPath}/${dir.name}` : dir.name;
        
        // 添加目录本身
        files.push({
          name: dir.name,
          path: fullPath,
          type: 'directory',
          icon: '📁'
        });
        
        // 递归处理子目录
        if (dir.children) {
          files = files.concat(this.flattenFileTree(dir.children, fullPath));
        }
      });
    }
    
    return files;
  }

  // 创建自动补全容器
  createAutocompleteContainer() {
    if (document.getElementById('file-autocomplete')) {
      return;
    }

    this.autocompleteContainer = document.createElement('div');
    this.autocompleteContainer.id = 'file-autocomplete';
    this.autocompleteContainer.className = 'file-autocomplete';
    this.autocompleteContainer.innerHTML = `
      <div class="autocomplete-header">
        <span class="autocomplete-title">选择文件</span>
        <span class="autocomplete-count"></span>
      </div>
      <div class="autocomplete-list"></div>
      <div class="autocomplete-footer">
        <span class="autocomplete-hint">↑↓ 选择 • Enter 确认 • Esc 取消</span>
      </div>
    `;
    
    document.body.appendChild(this.autocompleteContainer);
  }

  // 绑定全局事件
  bindGlobalEvents() {
    document.addEventListener('click', this.handleDocumentClick);
  }

  // 处理输入框的@引用
  handleAtMention(input, cursorPosition) {
    this.currentInput = input;
    const value = input.value;
    
    // 查找当前光标位置的@符号
    const beforeCursor = value.substring(0, cursorPosition);
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);
    
    if (atMatch) {
      this.currentQuery = atMatch[1];
      this.currentPosition = cursorPosition - atMatch[0].length;
      this.showAutocomplete();
    } else {
      this.hideAutocomplete();
    }
  }

  // 显示自动补全
  showAutocomplete() {
    if (!this.autocompleteContainer) {
      console.log('Autocomplete container not found');
      return;
    }
    
    if (this.flatFileList.length === 0) {
      console.log('No files loaded, trying to load file tree...');
      // 尝试重新加载文件树
      this.loadFileTree().then(() => {
        if (this.flatFileList.length > 0) {
          this.showAutocomplete();
        }
      });
      return;
    }

    const suggestions = this.getSuggestions(this.currentQuery);
    
    if (suggestions.length === 0) {
      console.log('No suggestions found');
      this.hideAutocomplete();
      return;
    }

    console.log(`Showing ${suggestions.length} suggestions`);
    this.renderSuggestions(suggestions);
    this.positionAutocomplete();
    this.autocompleteContainer.classList.add('visible');
    this.isVisible = true;
    this.selectedIndex = 0;
    this.updateSelection();
    
    // 绑定键盘事件
    this.currentInput.addEventListener('keydown', this.handleKeyDown);
  }

  // 隐藏自动补全
  hideAutocomplete() {
    if (this.autocompleteContainer) {
      this.autocompleteContainer.classList.remove('visible');
      this.isVisible = false;
      this.selectedIndex = -1;
      
      // 移除键盘事件
      if (this.currentInput) {
        this.currentInput.removeEventListener('keydown', this.handleKeyDown);
      }
    }
  }

  // 获取建议列表
  getSuggestions(query) {
    if (!query) {
      // 如果没有查询，返回最常用的文件
      return this.getPopularFiles().slice(0, 20);
    }

    const lowerQuery = query.toLowerCase();
    const suggestions = [];
    
    // 精确匹配文件名
    const exactMatches = this.flatFileList.filter(file => 
      file.name.toLowerCase() === lowerQuery
    );
    
    // 文件名开头匹配
    const nameStartMatches = this.flatFileList.filter(file => 
      file.name.toLowerCase().startsWith(lowerQuery) && 
      !exactMatches.includes(file)
    );
    
    // 路径开头匹配
    const pathStartMatches = this.flatFileList.filter(file => 
      file.path.toLowerCase().startsWith(lowerQuery) && 
      !exactMatches.includes(file) && 
      !nameStartMatches.includes(file)
    );
    
    // 文件名包含匹配
    const nameContainsMatches = this.flatFileList.filter(file => 
      file.name.toLowerCase().includes(lowerQuery) && 
      !exactMatches.includes(file) && 
      !nameStartMatches.includes(file) && 
      !pathStartMatches.includes(file)
    );
    
    // 路径包含匹配
    const pathContainsMatches = this.flatFileList.filter(file => 
      file.path.toLowerCase().includes(lowerQuery) && 
      !exactMatches.includes(file) && 
      !nameStartMatches.includes(file) && 
      !pathStartMatches.includes(file) && 
      !nameContainsMatches.includes(file)
    );
    
    // 按优先级合并结果
    suggestions.push(...exactMatches);
    suggestions.push(...nameStartMatches);
    suggestions.push(...pathStartMatches);
    suggestions.push(...nameContainsMatches.slice(0, 5));
    suggestions.push(...pathContainsMatches.slice(0, 5));
    
    // 限制结果数量
    return suggestions.slice(0, 25);
  }

  // 获取热门文件
  getPopularFiles() {
    const popularExtensions = [
      'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs',
      'php', 'rb', 'go', 'rs', 'swift', 'kt', 'html', 'css', 'scss',
      'json', 'yaml', 'yml', 'xml', 'txt', 'vue', 'svelte', 'dart'
    ];
    
    const popularNames = [
      'README.md', 'package.json', 'index.js', 'main.py', 'app.js',
      'index.html', 'style.css', 'config.json', 'Dockerfile', 'Makefile',
      'tsconfig.json', 'webpack.config.js', 'babel.config.js', '.gitignore',
      'LICENSE', 'CHANGELOG.md', 'src/index.js', 'src/main.js', 'src/App.js'
    ];
    
    const popular = [];
    
    // 优先推荐热门文件名
    popularNames.forEach(name => {
      const file = this.flatFileList.find(f => f.name === name || f.path === name);
      if (file) {
        popular.push(file);
      }
    });
    
    // 然后推荐热门扩展名的文件
    popularExtensions.forEach(ext => {
      const files = this.flatFileList.filter(f => 
        f.name.endsWith(`.${ext}`) && 
        !popular.includes(f)
      );
      popular.push(...files.slice(0, 3));
    });
    
    // 如果还不够，添加更多文件
    if (popular.length < 20) {
      const remaining = this.flatFileList.filter(f => 
        !popular.includes(f) && f.type === 'file'
      );
      popular.push(...remaining.slice(0, 20 - popular.length));
    }
    
    return popular;
  }

  // 渲染建议列表
  renderSuggestions(suggestions) {
    const listContainer = this.autocompleteContainer.querySelector('.autocomplete-list');
    const countElement = this.autocompleteContainer.querySelector('.autocomplete-count');
    
    countElement.textContent = `${suggestions.length} 个文件`;
    
    listContainer.innerHTML = suggestions.map((file, index) => `
      <div class="autocomplete-item" data-index="${index}" data-path="${file.path}">
        <div class="item-icon">${file.icon}</div>
        <div class="item-content">
          <div class="item-name">${this.highlightMatch(file.name, this.currentQuery)}</div>
          <div class="item-path">${this.highlightMatch(file.path, this.currentQuery)}</div>
        </div>
        <div class="item-meta">
          ${file.type === 'file' ? `
            <span class="item-language">${file.language || ''}</span>
            <span class="item-size">${this.formatFileSize(file.size || 0)}</span>
          ` : '<span class="item-type">目录</span>'}
        </div>
      </div>
    `).join('');
    
    // 绑定点击事件
    this.bindSuggestionEvents();
  }

  // 高亮匹配文本
  highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  // 转义正则表达式特殊字符
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 绑定建议项事件
  bindSuggestionEvents() {
    const items = this.autocompleteContainer.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectSuggestion(index);
      });
      
      item.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.updateSelection();
      });
    });
  }

  // 定位自动补全容器
  positionAutocomplete() {
    if (!this.currentInput) return;
    
    const inputRect = this.currentInput.getBoundingClientRect();
    const container = this.autocompleteContainer;
    
    // 计算位置
    let top = inputRect.bottom + window.scrollY + 5;
    let left = inputRect.left + window.scrollX;
    
    // 确保不超出视窗
    const containerHeight = 300; // 预估高度
    const containerWidth = 400;
    
    if (top + containerHeight > window.innerHeight + window.scrollY) {
      top = inputRect.top + window.scrollY - containerHeight - 5;
    }
    
    if (left + containerWidth > window.innerWidth + window.scrollX) {
      left = window.innerWidth + window.scrollX - containerWidth - 10;
    }
    
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
  }

  // 处理键盘事件
  handleKeyDown(e) {
    if (!this.isVisible) return;
    
    const items = this.autocompleteContainer.querySelectorAll('.autocomplete-item');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
        this.updateSelection();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectSuggestion(this.selectedIndex);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.hideAutocomplete();
        break;
        
      case 'Tab':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectSuggestion(this.selectedIndex);
        }
        break;
    }
  }

  // 更新选中状态
  updateSelection() {
    const items = this.autocompleteContainer.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
    
    // 滚动到选中项
    if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
      items[this.selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }

  // 选择建议
  selectSuggestion(index) {
    const items = this.autocompleteContainer.querySelectorAll('.autocomplete-item');
    if (index < 0 || index >= items.length) return;
    
    const selectedItem = items[index];
    const filePath = selectedItem.dataset.path;
    
    this.insertFileReference(filePath);
    this.hideAutocomplete();
  }

  // 插入文件引用
  insertFileReference(filePath) {
    if (!this.currentInput) return;
    
    const value = this.currentInput.value;
    const beforeAt = value.substring(0, this.currentPosition);
    const afterQuery = value.substring(this.currentPosition + 1 + this.currentQuery.length);
    
    // 构建新的值
    const newValue = beforeAt + '@' + filePath + ' ' + afterQuery;
    
    // 更新输入框
    this.currentInput.value = newValue;
    
    // 设置光标位置
    const newCursorPos = this.currentPosition + 1 + filePath.length + 1;
    this.currentInput.setSelectionRange(newCursorPos, newCursorPos);
    
    // 触发输入事件
    this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // 聚焦输入框
    this.currentInput.focus();
  }

  // 处理文档点击
  handleDocumentClick(e) {
    if (this.isVisible && 
        !this.autocompleteContainer.contains(e.target) && 
        e.target !== this.currentInput) {
      this.hideAutocomplete();
    }
  }

  // 解析消息中的文件引用
  parseFileReferences(message) {
    const references = [];
    const regex = /@([^\s]+)/g;
    let match;
    
    while ((match = regex.exec(message)) !== null) {
      const filePath = match[1];
      const file = this.flatFileList.find(f => f.path === filePath);
      
      if (file) {
        references.push({
          path: filePath,
          file: file,
          match: match[0],
          index: match.index
        });
      }
    }
    
    return references;
  }

  // 获取文件内容
  async getFileContent(filePath) {
    // 检查缓存
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath);
    }
    
    try {
      const content = await this.githubAPI.getFileContent(filePath);
      
      // 缓存内容
      this.fileCache.set(filePath, content);
      
      return content;
    } catch (error) {
      console.error(`Failed to get file content for ${filePath}:`, error);
      throw error;
    }
  }

  // 获取文件预览
  async getFilePreview(filePath, maxLines = 50) {
    try {
      const fileContent = await this.getFileContent(filePath);
      const lines = fileContent.content.split('\n');
      
      return {
        name: fileContent.name,
        path: fileContent.path,
        size: fileContent.size,
        language: this.getFileLanguage(fileContent.name),
        preview: lines.slice(0, maxLines).join('\n'),
        totalLines: lines.length,
        truncated: lines.length > maxLines
      };
    } catch (error) {
      return {
        name: filePath.split('/').pop(),
        path: filePath,
        error: error.message
      };
    }
  }

  // 批量获取文件内容
  async getMultipleFileContents(filePaths) {
    const results = {};
    
    // 并行获取文件内容
    const promises = filePaths.map(async (filePath) => {
      try {
        const content = await this.getFileContent(filePath);
        results[filePath] = content;
      } catch (error) {
        results[filePath] = { error: error.message };
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  // 搜索文件内容
  async searchInFiles(query, fileTypes = []) {
    try {
      const searchResults = await this.githubAPI.searchFiles(query, {
        extension: fileTypes.join(',')
      });
      
      return searchResults.items.map(item => ({
        name: item.name,
        path: item.path,
        score: item.score,
        url: item.url
      }));
    } catch (error) {
      console.error('Failed to search in files:', error);
      return [];
    }
  }

  // 获取相关文件推荐
  getRelatedFiles(currentFile) {
    if (!currentFile) return [];
    
    const related = [];
    const currentDir = currentFile.path.split('/').slice(0, -1).join('/');
    const currentExt = currentFile.name.split('.').pop();
    
    // 同目录文件
    const sameDir = this.flatFileList.filter(file => 
      file.path.startsWith(currentDir) && 
      file.path !== currentFile.path &&
      file.type === 'file'
    );
    
    // 同类型文件
    const sameType = this.flatFileList.filter(file => 
      file.name.endsWith(`.${currentExt}`) && 
      file.path !== currentFile.path &&
      !sameDir.includes(file)
    );
    
    related.push(...sameDir.slice(0, 5));
    related.push(...sameType.slice(0, 3));
    
    return related;
  }

  // 获取文件语言
  getFileLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const languageMap = {
      'js': 'JavaScript',
      'jsx': 'JavaScript',
      'ts': 'TypeScript',
      'tsx': 'TypeScript',
      'py': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'go': 'Go',
      'rs': 'Rust',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'scala': 'Scala',
      'sh': 'Shell',
      'bash': 'Shell',
      'zsh': 'Shell',
      'fish': 'Shell',
      'ps1': 'PowerShell',
      'sql': 'SQL',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'sass': 'Sass',
      'less': 'Less',
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'yml': 'YAML',
      'toml': 'TOML',
      'ini': 'INI',
      'cfg': 'Config',
      'conf': 'Config',
      'md': 'Markdown',
      'rst': 'reStructuredText',
      'txt': 'Text'
    };
    
    return languageMap[ext] || 'Text';
  }

  // 获取文件图标
  getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const iconMap = {
      'js': '📄',
      'jsx': '⚛️',
      'ts': '📘',
      'tsx': '⚛️',
      'py': '🐍',
      'java': '☕',
      'cpp': '⚙️',
      'c': '⚙️',
      'cs': '🔷',
      'php': '🐘',
      'rb': '💎',
      'go': '🐹',
      'rs': '🦀',
      'swift': '🦉',
      'kt': '🎯',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
      'json': '📋',
      'xml': '📄',
      'yaml': '📄',
      'yml': '📄',
      'md': '📖',
      'txt': '📄',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️'
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

  // 清除缓存
  clearCache() {
    this.fileCache.clear();
  }

  // 刷新文件树
  async refreshFileTree() {
    await this.loadFileTree();
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      fileCount: this.flatFileList.length,
      cachedFiles: this.fileCache.size,
      cacheSize: this.estimateCacheSize()
    };
  }

  // 估算缓存大小
  estimateCacheSize() {
    let size = 0;
    for (const [key, value] of this.fileCache) {
      size += key.length + (value.content?.length || 0);
    }
    return size;
  }

  // 销毁
  destroy() {
    this.hideAutocomplete();
    
    if (this.autocompleteContainer) {
      this.autocompleteContainer.remove();
      this.autocompleteContainer = null;
    }
    
    document.removeEventListener('click', this.handleDocumentClick);
    
    if (this.currentInput) {
      this.currentInput.removeEventListener('keydown', this.handleKeyDown);
    }
  }
}

// 导出
window.FileReferenceManager = FileReferenceManager;