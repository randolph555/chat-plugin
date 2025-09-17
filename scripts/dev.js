// 开发服务器
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class DevServer {
  constructor() {
    this.projectRoot = process.cwd();
    this.watchedFiles = new Set();
    this.isReloading = false;
    this.reloadDelay = 1000; // 1秒延迟，避免频繁重载
    this.reloadTimer = null;
  }

  start() {
    console.log('🚀 启动开发服务器...\n');
    
    this.showWelcomeMessage();
    this.setupFileWatcher();
    this.setupProcessHandlers();
    
    console.log('✅ 开发服务器已启动');
    console.log('📁 监控目录:', this.projectRoot);
    console.log('⌨️  按 Ctrl+C 停止服务器\n');
  }

  showWelcomeMessage() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                GitHub Chat Assistant 开发模式                ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  文件监控: 自动检测代码变化                                   ║');
    console.log('║  热重载: 提醒重新加载Chrome扩展                               ║');
    console.log('║  代码检查: 实时ESLint检查                                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  setupFileWatcher() {
    // 监控的文件类型和目录
    const watchPatterns = [
      'manifest.json',
      'background.js',
      'content.js',
      'popup.html',
      'options.html',
      'scripts/**/*.js',
      'styles/**/*.css',
      'assets/**/*'
    ];

    // 忽略的文件和目录
    const ignored = [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'tests/**',
      '.git/**',
      '*.log',
      'package-lock.json'
    ];

    const watcher = chokidar.watch(watchPatterns, {
      ignored: ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    watcher
      .on('change', (filePath) => this.handleFileChange(filePath, 'changed'))
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'removed'))
      .on('error', (error) => this.handleWatchError(error));

    this.watcher = watcher;
  }

  handleFileChange(filePath, changeType) {
    const relativePath = path.relative(this.projectRoot, filePath);
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] 📝 ${changeType}: ${relativePath}`);
    
    // 根据文件类型执行不同的操作
    this.processFileChange(filePath, changeType);
    
    // 延迟重载，避免频繁操作
    this.scheduleReload();
  }

  processFileChange(filePath, changeType) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    switch (ext) {
      case '.js':
        this.handleJavaScriptChange(filePath);
        break;
      case '.css':
        this.handleStyleChange(filePath);
        break;
      case '.json':
        if (fileName === 'manifest.json') {
          this.handleManifestChange(filePath);
        }
        break;
      case '.html':
        this.handleHtmlChange(filePath);
        break;
    }
  }

  handleJavaScriptChange(filePath) {
    // 运行ESLint检查
    this.runLintCheck(filePath);
    
    // 检查语法错误
    this.checkSyntax(filePath);
  }

  handleStyleChange(filePath) {
    console.log('   🎨 CSS文件已更新');
  }

  handleManifestChange(filePath) {
    console.log('   📋 Manifest文件已更新');
    
    // 验证manifest.json格式
    this.validateManifest(filePath);
  }

  handleHtmlChange(filePath) {
    console.log('   🌐 HTML文件已更新');
  }

  runLintCheck(filePath) {
    try {
      const { execSync } = require('child_process');
      execSync(`npx eslint "${filePath}"`, { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      console.log('   ✅ ESLint检查通过');
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString();
      if (output) {
        console.log('   ⚠️  ESLint警告:');
        console.log(this.formatLintOutput(output));
      }
    }
  }

  formatLintOutput(output) {
    return output
      .split('\n')
      .filter(line => line.trim())
      .map(line => `      ${line}`)
      .join('\n');
  }

  checkSyntax(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 简单的语法检查
      if (content.includes('console.log') && !content.includes('// DEBUG')) {
        console.log('   💡 提示: 发现console.log，记得在生产环境中移除');
      }
      
      // 检查常见错误
      if (content.includes('chrome.') && !content.includes('global.chrome')) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('chrome.') && !line.includes('//')) {
            console.log(`   🔍 第${index + 1}行使用了Chrome API`);
          }
        });
      }
      
    } catch (error) {
      console.log('   ❌ 文件读取错误:', error.message);
    }
  }

  validateManifest(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const manifest = JSON.parse(content);
      
      // 基本验证
      const requiredFields = ['manifest_version', 'name', 'version'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      
      if (missingFields.length > 0) {
        console.log('   ❌ Manifest缺少必需字段:', missingFields.join(', '));
      } else {
        console.log('   ✅ Manifest格式正确');
      }
      
      // 版本检查
      if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        console.log('   ⚠️  版本格式建议使用 x.y.z 格式');
      }
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.log('   ❌ Manifest JSON格式错误');
      } else {
        console.log('   ❌ Manifest验证错误:', error.message);
      }
    }
  }

  scheduleReload() {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    
    this.reloadTimer = setTimeout(() => {
      this.notifyReload();
    }, this.reloadDelay);
  }

  notifyReload() {
    if (this.isReloading) return;
    
    this.isReloading = true;
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 检测到文件变化，请重新加载Chrome扩展:');
    console.log('   1. 打开 chrome://extensions/');
    console.log('   2. 找到 "GitHub代码分析助手"');
    console.log('   3. 点击刷新按钮 🔄');
    console.log('='.repeat(60) + '\n');
    
    setTimeout(() => {
      this.isReloading = false;
    }, 3000);
  }

  handleWatchError(error) {
    console.error('❌ 文件监控错误:', error);
  }

  setupProcessHandlers() {
    // 优雅关闭
    process.on('SIGINT', () => {
      this.stop();
    });
    
    process.on('SIGTERM', () => {
      this.stop();
    });
    
    // 未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('❌ 未捕获的异常:', error);
      this.stop();
    });
  }

  stop() {
    console.log('\n🛑 正在停止开发服务器...');
    
    if (this.watcher) {
      this.watcher.close();
    }
    
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    
    console.log('✅ 开发服务器已停止');
    process.exit(0);
  }

  // 实用工具方法
  showProjectStats() {
    const stats = this.getProjectStats();
    
    console.log('\n📊 项目统计:');
    console.log(`   JavaScript文件: ${stats.jsFiles}`);
    console.log(`   CSS文件: ${stats.cssFiles}`);
    console.log(`   HTML文件: ${stats.htmlFiles}`);
    console.log(`   总文件数: ${stats.totalFiles}`);
    console.log(`   项目大小: ${this.formatSize(stats.totalSize)}`);
  }

  getProjectStats() {
    const stats = {
      jsFiles: 0,
      cssFiles: 0,
      htmlFiles: 0,
      totalFiles: 0,
      totalSize: 0
    };
    
    const countFiles = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        // 跳过忽略的目录
        if (['node_modules', 'dist', '.git', 'coverage'].includes(item)) {
          continue;
        }
        
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          countFiles(fullPath);
        } else {
          stats.totalFiles++;
          stats.totalSize += stat.size;
          
          const ext = path.extname(item).toLowerCase();
          switch (ext) {
            case '.js':
              stats.jsFiles++;
              break;
            case '.css':
              stats.cssFiles++;
              break;
            case '.html':
              stats.htmlFiles++;
              break;
          }
        }
      }
    };
    
    countFiles(this.projectRoot);
    return stats;
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// 运行开发服务器
if (require.main === module) {
  const devServer = new DevServer();
  devServer.start();
  
  // 显示项目统计（延迟显示，避免与启动信息混合）
  setTimeout(() => {
    devServer.showProjectStats();
  }, 1000);
}

module.exports = DevServer;