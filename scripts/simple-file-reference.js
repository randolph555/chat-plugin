// 简化的文件引用管理器 - 专门处理 @ 符号文件引用功能
// 不依赖 GitHub API，使用本地文件列表

class SimpleFileReference {
  constructor() {
    this.isVisible = false;
    this.currentInput = null;
    this.autocompleteContainer = null;
    this.selectedIndex = -1;
    this.suggestions = [];
    this.fileList = [];
    this.isLoadingFiles = false;
    
    // 绑定方法
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    
    // 初始化时获取当前仓库的文件列表
    this.loadRepositoryFiles();
  }

  // 初始化
  initialize(chatWindowCore) {
    this.chatWindowCore = chatWindowCore;
    this.createAutocompleteContainer();
    this.bindEvents();
    console.log('Simple file reference initialized with', this.fileList.length, 'files');
  }

  // 创建自动补全容器
  createAutocompleteContainer() {
    // 移除已存在的容器
    const existing = document.getElementById('file-autocomplete');
    if (existing) {
      existing.remove();
    }

    this.autocompleteContainer = document.createElement('div');
    this.autocompleteContainer.id = 'file-autocomplete';
    this.autocompleteContainer.className = 'file-autocomplete-dropdown';
    this.autocompleteContainer.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
      max-height: 400px;
      overflow-y: auto;
      z-index: 999999;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 350px;
      max-width: 500px;
    `;
    
    document.body.appendChild(this.autocompleteContainer);
  }

  // 绑定事件
  bindEvents() {
    const windowElement = this.chatWindowCore.getElement();
    if (!windowElement) return;

    const chatInput = windowElement.querySelector('#chat-input');
    if (!chatInput) return;

    // @ 按钮点击事件
    const atBtn = windowElement.querySelector('.at-btn');
    if (atBtn) {
      atBtn.addEventListener('click', () => {
        this.insertAtSymbol(chatInput);
      });
    }

    // 输入事件
    chatInput.addEventListener('input', (e) => {
      this.handleInput(e.target);
    });

    // 键盘事件
    chatInput.addEventListener('keydown', this.handleKeyDown);

    // 点击事件
    chatInput.addEventListener('click', (e) => {
      this.handleInput(e.target);
    });

    // 全局点击事件
    document.addEventListener('click', this.handleDocumentClick);
  }

  // 处理输入
  handleInput(input) {
    this.currentInput = input;
    const cursorPos = input.selectionStart;
    const value = input.value;
    const beforeCursor = value.substring(0, cursorPos);
    
    // 检查是否有 @ 符号
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);
    
    if (atMatch) {
      const query = atMatch[1];
      console.log('@ symbol detected, query:', query);
      this.showAutocomplete(query, input);
    } else {
      this.hideAutocomplete();
    }
  }

  // 显示自动补全
  showAutocomplete(query, input) {
    // 过滤文件列表
    this.suggestions = this.fileList.filter(file => 
      file.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 50); // 增加到50个结果

    console.log(`🔍 查询 "${query}" 匹配到 ${this.suggestions.length} 个文件`);
    console.log('📋 匹配的文件:', this.suggestions.slice(0, 10));

    if (this.suggestions.length === 0) {
      this.hideAutocomplete();
      return;
    }

    // 渲染建议列表
    this.renderSuggestions();
    
    // 定位到输入框下方
    this.positionAutocomplete(input);
    
    // 显示容器
    this.autocompleteContainer.style.display = 'block';
    this.isVisible = true;
    this.selectedIndex = -1;
    
    console.log('✅ 自动补全显示，共', this.suggestions.length, '个建议');
    
    // 调试：检查DOM渲染状态
    setTimeout(() => {
      const items = this.autocompleteContainer.querySelectorAll('.autocomplete-item');
      console.log(`🔍 DOM中实际渲染了 ${items.length} 个项目`);
      console.log(`📏 容器高度: ${this.autocompleteContainer.offsetHeight}px`);
      console.log(`📐 容器样式:`, this.autocompleteContainer.style.cssText);
    }, 100);
  }

  // 渲染建议列表
  renderSuggestions() {
    this.autocompleteContainer.innerHTML = this.suggestions.map((file, index) => `
      <div class="autocomplete-item" data-index="${index}" data-file="${file}" style="
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f6f8fa;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #24292f;
        ${index === this.selectedIndex ? 'background-color: #f6f8fa;' : ''}
      ">
        <span class="file-icon">${this.getFileIcon(file)}</span>
        <span class="file-name">${file}</span>
      </div>
    `).join('');

    // 绑定点击事件
    this.autocompleteContainer.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        this.selectedIndex = parseInt(item.dataset.index);
        this.updateSelection();
      });
      
      item.addEventListener('click', () => {
        const fileName = item.dataset.file;
        this.insertFileReference(fileName);
      });
    });
  }

  // 定位自动补全容器
  positionAutocomplete(input) {
    const rect = input.getBoundingClientRect();
    const containerHeight = this.autocompleteContainer.offsetHeight || 200;
    
    // 检查是否有足够空间显示在输入框上方
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    if (spaceAbove > containerHeight || spaceAbove > spaceBelow) {
      // 显示在输入框上方
      this.autocompleteContainer.style.top = (rect.top - containerHeight - 5) + 'px';
    } else {
      // 显示在输入框下方（备选方案）
      this.autocompleteContainer.style.top = (rect.bottom + 5) + 'px';
    }
    
    this.autocompleteContainer.style.left = rect.left + 'px';
    this.autocompleteContainer.style.width = Math.max(rect.width, 300) + 'px';
  }

  // 隐藏自动补全
  hideAutocomplete() {
    if (this.autocompleteContainer) {
      this.autocompleteContainer.style.display = 'none';
      this.isVisible = false;
      this.selectedIndex = -1;
    }
  }

  // 处理键盘事件
  handleKeyDown(e) {
    if (!this.isVisible) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
        this.updateSelection();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
          this.insertFileReference(this.suggestions[this.selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.hideAutocomplete();
        break;
        
      case 'Tab':
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
          this.insertFileReference(this.suggestions[this.selectedIndex]);
        } else if (this.suggestions.length > 0) {
          this.insertFileReference(this.suggestions[0]);
        }
        break;
    }
  }

  // 更新选择状态
  updateSelection() {
    const items = this.autocompleteContainer.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.style.backgroundColor = '#f6f8fa';
      } else {
        item.style.backgroundColor = 'white';
      }
    });
  }

  // 插入文件引用
  insertFileReference(fileName) {
    if (!this.currentInput) return;

    const cursorPos = this.currentInput.selectionStart;
    const value = this.currentInput.value;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    
    // 找到 @ 符号的位置
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const newValue = beforeCursor.substring(0, atIndex) + 
                      `@${fileName} ` + 
                      afterCursor;
      this.currentInput.value = newValue;
      
      // 设置光标位置
      const newPos = atIndex + fileName.length + 2;
      this.currentInput.setSelectionRange(newPos, newPos);
      this.currentInput.focus();
      
      console.log('File reference inserted:', fileName);
    }
    
    this.hideAutocomplete();
  }

  // 插入 @ 符号
  insertAtSymbol(input) {
    if (!input) return;

    const cursorPos = input.selectionStart;
    const value = input.value;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    
    // 在光标位置插入 @ 符号
    const newValue = beforeCursor + '@' + afterCursor;
    input.value = newValue;
    
    // 设置光标位置到 @ 符号后面
    const newPos = cursorPos + 1;
    input.setSelectionRange(newPos, newPos);
    input.focus();
    
    // 触发输入事件以显示自动补全
    setTimeout(() => {
      this.handleInput(input);
    }, 10);
  }

  // 处理文档点击
  handleDocumentClick(e) {
    if (!this.isVisible) return;
    
    // 如果点击的不是自动补全容器或输入框，则隐藏
    if (!this.autocompleteContainer.contains(e.target) && 
        e.target !== this.currentInput) {
      this.hideAutocomplete();
    }
  }

  // 获取文件图标
  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      'js': '📄',
      'json': '📋',
      'html': '🌐',
      'css': '🎨',
      'md': '📝',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'txt': '📄',
      'pdf': '📕',
      'zip': '📦'
    };
    
    return iconMap[ext] || '📄';
  }

  // 添加文件到列表
  addFile(filePath) {
    if (!this.fileList.includes(filePath)) {
      this.fileList.push(filePath);
      this.fileList.sort();
      console.log('File added to list:', filePath);
    }
  }

  // 移除文件从列表
  removeFile(filePath) {
    const index = this.fileList.indexOf(filePath);
    if (index > -1) {
      this.fileList.splice(index, 1);
      console.log('File removed from list:', filePath);
    }
  }

  // 更新文件列表
  updateFileList(newFileList) {
    this.fileList = [...newFileList].sort();
    console.log('File list updated with', this.fileList.length, 'files');
  }

  // 获取文件列表
  getFileList() {
    return [...this.fileList];
  }
  
  // 手动刷新文件列表
  async refreshFileList() {
    console.log('🔄 手动刷新文件列表...');
    this.isLoadingFiles = false; // 重置加载状态
    await this.loadRepositoryFiles();
  }

  // 获取当前GitHub仓库的文件列表
  async loadRepositoryFiles() {
    if (this.isLoadingFiles) return;
    this.isLoadingFiles = true;
    
    console.log('🚀 开始加载仓库文件列表...');
    
    try {
      // 获取页面信息
      console.log('📡 正在获取页面信息...');
      const pageInfo = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({action: 'getPageInfo'}, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      console.log('📄 页面信息:', pageInfo);
      
      // 处理background.js返回的数据结构
      if (!pageInfo.success || pageInfo.error) {
        console.log('❌ 不在GitHub仓库页面:', pageInfo.error || '获取页面信息失败');
        this.fileList = ['README.md', 'LICENSE', '.gitignore', 'package.json'];
        return;
      }
      
      // 提取仓库信息
      const repoInfo = pageInfo.repoInfo;
      if (!repoInfo || !repoInfo.owner || !repoInfo.repo) {
        console.log('❌ 仓库信息不完整:', repoInfo);
        this.fileList = ['README.md', 'LICENSE', '.gitignore', 'package.json'];
        return;
      }
      
      // 获取仓库文件列表
      console.log('🔍 开始获取仓库文件列表...');
      const files = await this.fetchRepositoryFileList(repoInfo);
      this.fileList = files;
      console.log(`✅ 成功加载 ${files.length} 个仓库文件`);
      console.log('📋 文件列表预览:', files.slice(0, 15));
      
    } catch (error) {
      console.log('❌ 加载仓库文件列表失败:', error);
      console.log('🔄 使用默认文件列表作为后备');
      // 使用默认文件列表作为后备
      this.fileList = ['README.md', 'LICENSE', '.gitignore', 'package.json'];
    } finally {
      this.isLoadingFiles = false;
    }
  }
  
  // 获取仓库文件列表
  async fetchRepositoryFileList(repoInfo) {
    const { owner, repo, branch } = repoInfo;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    
    console.log(`🔍 正在获取仓库文件: ${owner}/${repo}/${branch}`);
    
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`GitHub API 错误: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`📁 GitHub API 返回 ${data.tree.length} 个项目`);
      
      // 分析所有项目类型
      const allItems = data.tree;
      const blobs = allItems.filter(item => item.type === 'blob');
      const trees = allItems.filter(item => item.type === 'tree');
      
      console.log(`📄 文件数量: ${blobs.length}, 📂 目录数量: ${trees.length}`);
      
      // 只返回文件（不包括目录），并过滤掉一些不需要的文件
      const files = blobs
        .map(item => item.path)
        .filter(path => {
          // 过滤掉一些不需要的文件，但保留所有子目录中的代码文件
          const excludePatterns = [
            /\.git\//,
            /node_modules\//,
            /\.DS_Store$/,
            /\.log$/,
            /\.tmp$/,
            /\.cache$/,
            /\.lock$/,
            /\.swp$/,
            /\.bak$/
          ];
          return !excludePatterns.some(pattern => pattern.test(path));
        })
        .sort((a, b) => {
          // 优先显示根目录文件，然后按路径深度和字母顺序排序
          const aDepth = a.split('/').length;
          const bDepth = b.split('/').length;
          if (aDepth !== bDepth) {
            return aDepth - bDepth;
          }
          return a.localeCompare(b);
        });
      
      // 显示子目录文件统计
      const rootFiles = files.filter(f => !f.includes('/'));
      const subDirFiles = files.filter(f => f.includes('/'));
      console.log(`📋 根目录文件: ${rootFiles.length}, 子目录文件: ${subDirFiles.length}`);
      console.log(`📝 子目录文件示例:`, subDirFiles.slice(0, 5));
      
      return files;
      
    } catch (error) {
      console.log('❌ GitHub API 调用失败:', error);
      console.log('🔗 请求URL:', apiUrl);
      
      // 如果是403错误或其他API错误，直接使用页面DOM解析
      if (error.message.includes('403') || error.message.includes('GitHub API')) {
        console.log('⚠️ GitHub API调用失败，使用页面DOM解析');
        return await this.fallbackToPageParsing();
      }
      
      // 对于其他错误，也尝试页面解析作为备用方案
      console.log('⚠️ API调用出现其他错误，尝试页面解析');
      return await this.fallbackToPageParsing();
    }
  }
  
  // 备用方案：从页面DOM解析文件列表
  async fallbackToPageParsing() {
    console.log('🔄 尝试从页面DOM解析文件列表...');
    
    try {
      const files = [];
      
      // 方法1: 查找文件浏览器中的文件链接
      const fileRows = document.querySelectorAll('[role="row"], .js-navigation-item');
      console.log(`🔍 找到 ${fileRows.length} 个导航项目`);
      
      fileRows.forEach(row => {
        // 查找文件链接
        const fileLink = row.querySelector('a[href*="/blob/"]');
        if (fileLink) {
          const href = fileLink.getAttribute('href');
          const pathMatch = href.match(/\/blob\/[^\/]+\/(.+)$/);
          if (pathMatch) {
            files.push(pathMatch[1]);
          }
        }
      });
      
      // 方法2: 如果方法1没找到文件，尝试其他选择器
      if (files.length === 0) {
        console.log('🔄 尝试其他选择器...');
        const allLinks = document.querySelectorAll('a[href*="/blob/"]');
        console.log(`🔗 找到 ${allLinks.length} 个blob链接`);
        
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          const pathMatch = href.match(/\/blob\/[^\/]+\/(.+)$/);
          if (pathMatch) {
            files.push(pathMatch[1]);
          }
        });
      }
      
      // 去重并排序
      const uniqueFiles = [...new Set(files)].sort();
      console.log(`📄 从页面解析到 ${uniqueFiles.length} 个文件:`, uniqueFiles.slice(0, 10));
      
      if (uniqueFiles.length === 0) {
        console.log('⚠️ 页面解析未找到文件，使用默认列表');
        return ['README.md', 'LICENSE', '.gitignore', 'package.json'];
      }
      
      return uniqueFiles;
      
    } catch (error) {
      console.log('❌ 页面解析失败:', error);
      return ['README.md', 'LICENSE', '.gitignore', 'package.json'];
    }
  }

  // 销毁
  destroy() {
    if (this.autocompleteContainer) {
      this.autocompleteContainer.remove();
      this.autocompleteContainer = null;
    }
    
    document.removeEventListener('click', this.handleDocumentClick);
    
    this.isVisible = false;
    this.currentInput = null;
    this.suggestions = [];
  }
}

// 导出
window.SimpleFileReference = SimpleFileReference;