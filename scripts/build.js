// 构建脚本
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ExtensionBuilder {
  constructor() {
    this.sourceDir = process.cwd();
    this.buildDir = path.join(this.sourceDir, 'dist');
    this.errors = [];
    this.warnings = [];
  }

  async build() {
    console.log('🚀 开始构建 GitHub Chat Assistant 扩展...\n');
    
    try {
      // 1. 清理构建目录
      await this.cleanBuildDir();
      
      // 2. 运行代码检查
      await this.runLinting();
      
      // 3. 运行测试
      await this.runTests();
      
      // 4. 验证文件
      await this.validateFiles();
      
      // 5. 创建构建目录
      await this.createBuildDir();
      
      // 6. 复制文件
      await this.copyFiles();
      
      // 7. 优化文件
      await this.optimizeFiles();
      
      // 8. 生成构建报告
      await this.generateBuildReport();
      
      console.log('\n✅ 构建完成！');
      console.log(`📦 构建文件位于: ${this.buildDir}`);
      
      if (this.warnings.length > 0) {
        console.log(`\n⚠️  ${this.warnings.length} 个警告:`);
        this.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
      
    } catch (error) {
      console.error('\n❌ 构建失败:', error.message);
      process.exit(1);
    }
  }

  async cleanBuildDir() {
    console.log('🧹 清理构建目录...');
    
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true });
    }
  }

  async runLinting() {
    console.log('🔍 运行代码检查...');
    
    try {
      execSync('npm run lint', { 
        stdio: 'pipe',
        cwd: this.sourceDir 
      });
      console.log('   ✅ ESLint 检查通过');
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString();
      if (output.includes('warning')) {
        this.warnings.push('ESLint 发现代码警告');
        console.log('   ⚠️  ESLint 发现警告，但继续构建');
      } else {
        throw new Error(`ESLint 检查失败:\n${output}`);
      }
    }
  }

  async runTests() {
    console.log('🧪 运行测试...');
    
    try {
      execSync('npm test', { 
        stdio: 'pipe',
        cwd: this.sourceDir 
      });
      console.log('   ✅ 所有测试通过');
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString();
      throw new Error(`测试失败:\n${output}`);
    }
  }

  async validateFiles() {
    console.log('📋 验证必需文件...');
    
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'content.js',
      'popup.html',
      'options.html'
    ];
    
    const requiredDirs = [
      'scripts',
      'styles',
      'assets'
    ];
    
    // 检查必需文件
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(this.sourceDir, file))) {
        throw new Error(`缺少必需文件: ${file}`);
      }
    }
    
    // 检查必需目录
    for (const dir of requiredDirs) {
      if (!fs.existsSync(path.join(this.sourceDir, dir))) {
        throw new Error(`缺少必需目录: ${dir}`);
      }
    }
    
    // 验证 manifest.json
    await this.validateManifest();
    
    console.log('   ✅ 文件验证通过');
  }

  async validateManifest() {
    const manifestPath = path.join(this.sourceDir, 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    
    try {
      const manifest = JSON.parse(manifestContent);
      
      // 检查必需字段
      const requiredFields = ['manifest_version', 'name', 'version', 'description'];
      for (const field of requiredFields) {
        if (!manifest[field]) {
          throw new Error(`manifest.json 缺少必需字段: ${field}`);
        }
      }
      
      // 检查版本格式
      if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        throw new Error('manifest.json 版本格式无效，应为 x.y.z');
      }
      
      // 检查权限
      if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
        this.warnings.push('manifest.json 没有定义权限');
      }
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('manifest.json 格式无效');
      }
      throw error;
    }
  }

  async createBuildDir() {
    console.log('📁 创建构建目录...');
    
    fs.mkdirSync(this.buildDir, { recursive: true });
    
    // 创建子目录
    const subDirs = ['scripts', 'styles', 'assets'];
    for (const dir of subDirs) {
      fs.mkdirSync(path.join(this.buildDir, dir), { recursive: true });
    }
  }

  async copyFiles() {
    console.log('📄 复制文件...');
    
    // 复制根目录文件
    const rootFiles = [
      'manifest.json',
      'background.js',
      'content.js',
      'popup.html',
      'options.html'
    ];
    
    for (const file of rootFiles) {
      const srcPath = path.join(this.sourceDir, file);
      const destPath = path.join(this.buildDir, file);
      
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    // 复制目录
    await this.copyDirectory('scripts');
    await this.copyDirectory('styles');
    await this.copyDirectory('assets');
    
    console.log('   ✅ 文件复制完成');
  }

  async copyDirectory(dirName) {
    const srcDir = path.join(this.sourceDir, dirName);
    const destDir = path.join(this.buildDir, dirName);
    
    if (!fs.existsSync(srcDir)) {
      return;
    }
    
    const files = fs.readdirSync(srcDir);
    
    for (const file of files) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(destDir, file);
      
      const stat = fs.statSync(srcPath);
      
      if (stat.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        await this.copyDirectory(path.join(dirName, file));
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async optimizeFiles() {
    console.log('⚡ 优化文件...');
    
    // 移除开发相关的文件
    const devFiles = [
      'build.js',
      'dev.js'
    ];
    
    for (const file of devFiles) {
      const filePath = path.join(this.buildDir, 'scripts', file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // 压缩 JSON 文件
    await this.minifyJsonFiles();
    
    // 移除注释和调试代码
    await this.removeDebugCode();
    
    console.log('   ✅ 文件优化完成');
  }

  async minifyJsonFiles() {
    const jsonFiles = ['manifest.json'];
    
    for (const file of jsonFiles) {
      const filePath = path.join(this.buildDir, file);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const minified = JSON.stringify(JSON.parse(content));
        fs.writeFileSync(filePath, minified);
      }
    }
  }

  async removeDebugCode() {
    const jsFiles = this.getAllJsFiles(this.buildDir);
    
    for (const file of jsFiles) {
      let content = fs.readFileSync(file, 'utf8');
      
      // 移除 console.log (保留 console.error 和 console.warn)
      content = content.replace(/console\.log\([^)]*\);?\s*/g, '');
      
      // 移除调试注释
      content = content.replace(/\/\/ DEBUG:.*$/gm, '');
      content = content.replace(/\/\* DEBUG[\s\S]*?\*\//g, '');
      
      fs.writeFileSync(file, content);
    }
  }

  getAllJsFiles(dir) {
    const files = [];
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllJsFiles(fullPath));
      } else if (item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async generateBuildReport() {
    console.log('📊 生成构建报告...');
    
    const report = {
      buildTime: new Date().toISOString(),
      version: this.getVersion(),
      files: await this.getFileStats(),
      size: await this.getTotalSize(),
      warnings: this.warnings,
      errors: this.errors
    };
    
    const reportPath = path.join(this.buildDir, 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('   ✅ 构建报告已生成');
    console.log(`   📊 总大小: ${this.formatSize(report.size)}`);
    console.log(`   📁 文件数量: ${report.files.count}`);
  }

  getVersion() {
    const manifestPath = path.join(this.sourceDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.version;
  }

  async getFileStats() {
    const stats = {
      count: 0,
      byType: {}
    };
    
    const files = this.getAllFiles(this.buildDir);
    
    for (const file of files) {
      stats.count++;
      
      const ext = path.extname(file).toLowerCase();
      if (!stats.byType[ext]) {
        stats.byType[ext] = 0;
      }
      stats.byType[ext]++;
    }
    
    return stats;
  }

  getAllFiles(dir) {
    const files = [];
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async getTotalSize() {
    let totalSize = 0;
    
    const files = this.getAllFiles(this.buildDir);
    
    for (const file of files) {
      const stat = fs.statSync(file);
      totalSize += stat.size;
    }
    
    return totalSize;
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// 运行构建
if (require.main === module) {
  const builder = new ExtensionBuilder();
  builder.build().catch(error => {
    console.error('构建失败:', error);
    process.exit(1);
  });
}

module.exports = ExtensionBuilder;