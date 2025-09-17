// 图片处理器
// 负责图片上传、压缩、缩略图生成、格式转换等功能

class ImageHandler {
  constructor() {
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.compressionQuality = 0.8;
    this.maxDimensions = { width: 1920, height: 1080 };
    this.thumbnailSize = { width: 200, height: 150 };
    this.storageManager = null;
  }

  // 初始化
  initialize(config, storageManager) {
    this.maxFileSize = config.uploadSettings.maxFileSize;
    this.allowedTypes = config.uploadSettings.allowedTypes;
    this.compressionQuality = config.uploadSettings.compressionQuality;
    this.maxDimensions = config.uploadSettings.maxDimensions;
    this.storageManager = storageManager;
    
    console.log('Image handler initialized');
  }

  // 处理文件上传
  async handleFileUpload(file, conversationId) {
    try {
      // 验证文件
      this.validateFile(file);
      
      // 读取文件
      const imageData = await this.readFile(file);
      
      // 处理图片
      const processedImage = await this.processImage(imageData, file.type);
      
      // 生成缩略图
      const thumbnail = await this.generateThumbnail(processedImage.dataUrl);
      
      // 保存到存储
      const uploadId = await this.storageManager.saveUploadedImage(
        processedImage.dataUrl,
        conversationId,
        {
          originalName: file.name,
          originalSize: file.size,
          processedSize: processedImage.size,
          type: file.type,
          dimensions: processedImage.dimensions,
          thumbnail: thumbnail,
          compressed: processedImage.compressed
        }
      );
      
      return {
        uploadId,
        thumbnail,
        metadata: {
          name: file.name,
          size: processedImage.size,
          dimensions: processedImage.dimensions,
          type: file.type
        }
      };
    } catch (error) {
      console.error('Failed to handle file upload:', error);
      throw error;
    }
  }

  // 验证文件
  validateFile(file) {
    // 检查文件类型
    if (!this.allowedTypes.includes(file.type)) {
      throw new Error(`不支持的文件类型: ${file.type}`);
    }
    
    // 检查文件大小
    if (file.size > this.maxFileSize) {
      throw new Error(`文件太大: ${this.formatFileSize(file.size)}，最大允许 ${this.formatFileSize(this.maxFileSize)}`);
    }
    
    // 检查文件名
    if (!file.name || file.name.length > 255) {
      throw new Error('文件名无效');
    }
  }

  // 读取文件
  async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve({
          dataUrl: e.target.result,
          arrayBuffer: null
        });
      };
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  // 处理图片
  async processImage(imageData, mimeType) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 计算新尺寸
          const dimensions = this.calculateDimensions(img.width, img.height);
          
          canvas.width = dimensions.width;
          canvas.height = dimensions.height;
          
          // 绘制图片
          ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
          
          // 转换为数据URL
          const quality = this.shouldCompress(mimeType) ? this.compressionQuality : 1.0;
          const outputType = this.getOutputType(mimeType);
          const dataUrl = canvas.toDataURL(outputType, quality);
          
          resolve({
            dataUrl,
            dimensions,
            size: this.estimateDataUrlSize(dataUrl),
            compressed: quality < 1.0 || dimensions.width < img.width || dimensions.height < img.height
          });
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      img.src = imageData.dataUrl;
    });
  }

  // 计算新尺寸
  calculateDimensions(originalWidth, originalHeight) {
    const maxWidth = this.maxDimensions.width;
    const maxHeight = this.maxDimensions.height;
    
    // 如果图片尺寸已经在限制内，保持原尺寸
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }
    
    // 计算缩放比例
    const widthRatio = maxWidth / originalWidth;
    const heightRatio = maxHeight / originalHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    
    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    };
  }

  // 生成缩略图
  async generateThumbnail(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 计算缩略图尺寸
          const thumbnailDimensions = this.calculateThumbnailDimensions(img.width, img.height);
          
          canvas.width = thumbnailDimensions.width;
          canvas.height = thumbnailDimensions.height;
          
          // 绘制缩略图
          ctx.drawImage(img, 0, 0, thumbnailDimensions.width, thumbnailDimensions.height);
          
          // 转换为数据URL
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          resolve(thumbnailDataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('缩略图生成失败'));
      };
      
      img.src = dataUrl;
    });
  }

  // 计算缩略图尺寸
  calculateThumbnailDimensions(originalWidth, originalHeight) {
    const maxWidth = this.thumbnailSize.width;
    const maxHeight = this.thumbnailSize.height;
    
    const widthRatio = maxWidth / originalWidth;
    const heightRatio = maxHeight / originalHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    
    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    };
  }

  // 判断是否需要压缩
  shouldCompress(mimeType) {
    return mimeType === 'image/jpeg' || mimeType === 'image/webp';
  }

  // 获取输出类型
  getOutputType(mimeType) {
    // 将所有格式统一转换为JPEG以减小文件大小
    if (mimeType === 'image/png' && this.compressionQuality < 1.0) {
      return 'image/jpeg';
    }
    return mimeType;
  }

  // 估算数据URL大小
  estimateDataUrlSize(dataUrl) {
    // Base64编码大约增加33%的大小
    const base64Data = dataUrl.split(',')[1];
    return Math.round(base64Data.length * 0.75);
  }

  // 创建图片预览元素
  createImagePreview(uploadResult, options = {}) {
    const container = document.createElement('div');
    container.className = 'image-preview';
    container.dataset.uploadId = uploadResult.uploadId;
    
    const img = document.createElement('img');
    img.src = uploadResult.thumbnail;
    img.alt = uploadResult.metadata.name;
    img.className = 'preview-image';
    
    const overlay = document.createElement('div');
    overlay.className = 'preview-overlay';
    
    const info = document.createElement('div');
    info.className = 'preview-info';
    info.innerHTML = `
      <div class="preview-name">${uploadResult.metadata.name}</div>
      <div class="preview-details">
        ${uploadResult.metadata.dimensions.width}×${uploadResult.metadata.dimensions.height} • 
        ${this.formatFileSize(uploadResult.metadata.size)}
      </div>
    `;
    
    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    
    if (!options.readonly) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'preview-remove';
      removeBtn.innerHTML = '×';
      removeBtn.title = '删除图片';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this.removeImagePreview(container, uploadResult.uploadId);
      };
      actions.appendChild(removeBtn);
    }
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'preview-view';
    viewBtn.innerHTML = '👁';
    viewBtn.title = '查看原图';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      this.viewFullImage(uploadResult.uploadId);
    };
    actions.appendChild(viewBtn);
    
    overlay.appendChild(info);
    overlay.appendChild(actions);
    
    container.appendChild(img);
    container.appendChild(overlay);
    
    // 点击预览图查看原图
    container.onclick = () => {
      this.viewFullImage(uploadResult.uploadId);
    };
    
    return container;
  }

  // 移除图片预览
  async removeImagePreview(previewElement, uploadId) {
    try {
      // 从存储中删除
      await this.storageManager.deleteUpload(uploadId);
      
      // 从DOM中移除
      previewElement.remove();
      
      // 触发自定义事件
      document.dispatchEvent(new CustomEvent('imageRemoved', {
        detail: { uploadId }
      }));
    } catch (error) {
      console.error('Failed to remove image:', error);
    }
  }

  // 查看完整图片
  async viewFullImage(uploadId) {
    try {
      const uploadData = await this.storageManager.getUploadedImage(uploadId);
      if (!uploadData) {
        throw new Error('图片不存在');
      }
      
      this.showImageModal(uploadData);
    } catch (error) {
      console.error('Failed to view full image:', error);
      alert('无法加载图片');
    }
  }

  // 显示图片模态框
  showImageModal(uploadData) {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${uploadData.metadata.originalName}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <img src="${uploadData.data}" alt="${uploadData.metadata.originalName}" class="modal-image">
        </div>
        <div class="modal-footer">
          <div class="image-info">
            <span>尺寸: ${uploadData.metadata.dimensions.width}×${uploadData.metadata.dimensions.height}</span>
            <span>大小: ${this.formatFileSize(uploadData.metadata.processedSize)}</span>
            <span>类型: ${uploadData.metadata.type}</span>
          </div>
          <div class="modal-actions">
            <button class="btn-download">下载</button>
            <button class="btn-copy">复制链接</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 绑定事件
    const closeBtn = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    const downloadBtn = modal.querySelector('.btn-download');
    const copyBtn = modal.querySelector('.btn-copy');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.onclick = closeModal;
    backdrop.onclick = closeModal;
    
    downloadBtn.onclick = () => {
      this.downloadImage(uploadData.data, uploadData.metadata.originalName);
    };
    
    copyBtn.onclick = () => {
      this.copyImageToClipboard(uploadData.data);
    };
    
    // ESC键关闭
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }

  // 下载图片
  downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 复制图片到剪贴板
  async copyImageToClipboard(dataUrl) {
    try {
      // 将dataUrl转换为Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // 复制到剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      
      // 显示成功提示
      this.showToast('图片已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy image:', error);
      
      // 降级方案：复制dataUrl
      try {
        await navigator.clipboard.writeText(dataUrl);
        this.showToast('图片链接已复制到剪贴板');
      } catch (fallbackError) {
        this.showToast('复制失败', 'error');
      }
    }
  }

  // 处理拖拽上传
  setupDragAndDrop(dropZone, onFilesDropped) {
    let dragCounter = 0;
    
    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      dropZone.classList.add('drag-over');
    };
    
    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        dropZone.classList.remove('drag-over');
      }
    };
    
    const handleDragOver = (e) => {
      e.preventDefault();
    };
    
    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      dropZone.classList.remove('drag-over');
      
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(file => this.allowedTypes.includes(file.type));
      
      if (imageFiles.length > 0) {
        onFilesDropped(imageFiles);
      } else if (files.length > 0) {
        this.showToast('请选择有效的图片文件', 'error');
      }
    };
    
    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleDrop);
    
    return () => {
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }

  // 处理粘贴上传
  setupPasteUpload(element, onImagePasted) {
    const handlePaste = async (e) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length > 0) {
        e.preventDefault();
        
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file && this.allowedTypes.includes(file.type)) {
            onImagePasted(file);
          }
        }
      }
    };
    
    element.addEventListener('paste', handlePaste);
    
    return () => {
      element.removeEventListener('paste', handlePaste);
    };
  }

  // 批量处理图片
  async processBatchUpload(files, conversationId, onProgress) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.handleFileUpload(files[i], conversationId);
        results.push(result);
        
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: files.length,
            current: files[i].name,
            success: true
          });
        }
      } catch (error) {
        errors.push({
          file: files[i].name,
          error: error.message
        });
        
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: files.length,
            current: files[i].name,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    return { results, errors };
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 显示提示消息
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 动画显示
    setTimeout(() => toast.classList.add('show'), 100);
    
    // 自动隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // 获取支持的文件类型描述
  getSupportedTypesDescription() {
    const typeMap = {
      'image/jpeg': 'JPEG',
      'image/png': 'PNG',
      'image/gif': 'GIF',
      'image/webp': 'WebP'
    };
    
    return this.allowedTypes.map(type => typeMap[type] || type).join(', ');
  }

  // 检查浏览器支持
  checkBrowserSupport() {
    const support = {
      fileAPI: !!(window.File && window.FileReader && window.FileList && window.Blob),
      canvas: !!document.createElement('canvas').getContext,
      dragDrop: 'draggable' in document.createElement('div'),
      clipboard: !!navigator.clipboard
    };
    
    return support;
  }
}

// 导出
window.ImageHandler = ImageHandler;