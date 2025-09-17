// 图片上传管理器 - 专门处理图片上传相关功能
// 解决双击问题和预览位置优化

class ImageUploadManager {
  constructor() {
    this.isProcessing = false;
    this.uploadedImages = new Map();
    this.hiddenFileInput = null;
  }

  // 初始化
  initialize(chatWindowCore) {
    this.chatWindowCore = chatWindowCore;
    this.createHiddenFileInput();
    this.bindEvents();
    console.log('Image upload manager initialized');
  }

  // 创建隐藏的文件输入框
  createHiddenFileInput() {
    // 移除已存在的输入框
    const existing = document.getElementById('hidden-file-input');
    if (existing) {
      existing.remove();
    }

    this.hiddenFileInput = document.createElement('input');
    this.hiddenFileInput.type = 'file';
    this.hiddenFileInput.id = 'hidden-file-input';
    this.hiddenFileInput.accept = 'image/*';
    this.hiddenFileInput.style.display = 'none';
    this.hiddenFileInput.multiple = false; // 一次只能选择一个文件
    
    document.body.appendChild(this.hiddenFileInput);
  }

  // 绑定事件
  bindEvents() {
    const windowElement = this.chatWindowCore.getElement();
    if (!windowElement) return;

    // 上传按钮点击事件
    const uploadBtn = windowElement.querySelector('.upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.openFileDialog();
      });
    }

    // 文件输入框变化事件
    if (this.hiddenFileInput) {
      this.hiddenFileInput.addEventListener('change', (e) => {
        this.handleFileSelection(e);
      });
    }

    // 拖拽上传
    this.setupDragAndDrop(windowElement);
  }

  // 打开文件选择对话框
  openFileDialog() {
    if (this.isProcessing) {
      console.log('Upload already in progress, ignoring click');
      return;
    }

    if (this.hiddenFileInput) {
      // 清空之前的值，确保可以重复选择同一文件
      this.hiddenFileInput.value = '';
      this.hiddenFileInput.click();
    }
  }

  // 处理文件选择
  async handleFileSelection(event) {
    if (this.isProcessing) {
      console.log('Already processing upload, ignoring');
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }

    this.isProcessing = true;
    
    try {
      const file = files[0];
      console.log('Processing file:', file.name, file.type, file.size);
      
      if (!this.validateFile(file)) {
        return;
      }

      await this.processImageFile(file);
    } catch (error) {
      console.error('Error processing file:', error);
      this.showError('图片处理失败: ' + error.message);
    } finally {
      // 清空输入框值
      event.target.value = '';
      this.isProcessing = false;
    }
  }

  // 验证文件
  validateFile(file) {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      this.showError('请选择图片文件');
      return false;
    }

    // 检查文件大小 (10MB限制)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showError('图片文件不能超过10MB');
      return false;
    }

    // 检查支持的格式
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      this.showError('不支持的图片格式，请使用 JPG、PNG、GIF 或 WebP');
      return false;
    }

    return true;
  }

  // 处理图片文件
  async processImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const imageData = e.target.result;
          const uploadId = this.generateUploadId();
          
          // 存储图片数据
          this.uploadedImages.set(uploadId, {
            id: uploadId,
            name: file.name,
            type: file.type,
            size: file.size,
            data: imageData,
            timestamp: Date.now()
          });

          // 添加到界面
          this.addImagePreview(uploadId);
          
          console.log('Image processed successfully:', file.name);
          resolve(uploadId);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.readAsDataURL(file);
    });
  }

  // 添加图片预览
  addImagePreview(uploadId) {
    const imageData = this.uploadedImages.get(uploadId);
    if (!imageData) return;

    const container = this.chatWindowCore.getUploadedImagesContainer();
    if (!container) return;

    const previewElement = document.createElement('div');
    previewElement.className = 'image-preview';
    previewElement.dataset.uploadId = uploadId;
    
    previewElement.innerHTML = `
      <img src="${imageData.data}" alt="${imageData.name}" />
      <div class="image-info">
        <span class="image-name">${imageData.name}</span>
        <button class="remove-image" title="移除图片">×</button>
      </div>
    `;

    // 绑定移除事件
    const removeBtn = previewElement.querySelector('.remove-image');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeImage(uploadId);
    });

    // 绑定点击预览事件
    const img = previewElement.querySelector('img');
    img.addEventListener('click', () => {
      this.showImageModal(imageData);
    });

    container.appendChild(previewElement);
    console.log('Image preview added:', imageData.name);
  }

  // 移除图片
  removeImage(uploadId) {
    // 从数据中移除
    this.uploadedImages.delete(uploadId);

    // 从界面中移除
    const container = this.chatWindowCore.getUploadedImagesContainer();
    if (container) {
      const previewElement = container.querySelector(`[data-upload-id="${uploadId}"]`);
      if (previewElement) {
        previewElement.remove();
      }
    }

    console.log('Image removed:', uploadId);
  }

  // 显示图片模态框
  showImageModal(imageData) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${imageData.name}</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <img src="${imageData.data}" alt="${imageData.name}" />
          </div>
          <div class="modal-footer">
            <span class="file-info">
              ${this.formatFileSize(imageData.size)} • ${imageData.type}
            </span>
          </div>
        </div>
      </div>
    `;

    // 绑定关闭事件
    const closeBtn = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    const closeModal = () => modal.remove();
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // ESC键关闭
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    document.body.appendChild(modal);
  }

  // 设置拖拽上传
  setupDragAndDrop(element) {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      element.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        element.classList.remove('drag-over');
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDrop = async (e) => {
      e.preventDefault();
      dragCounter = 0;
      element.classList.remove('drag-over');

      if (this.isProcessing) {
        console.log('Upload in progress, ignoring drop');
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        this.showError('请拖拽图片文件');
        return;
      }

      // 只处理第一个图片文件
      const file = imageFiles[0];
      if (imageFiles.length > 1) {
        this.showWarning(`检测到${imageFiles.length}个图片，只处理第一个: ${file.name}`);
      }

      this.isProcessing = true;
      try {
        if (this.validateFile(file)) {
          await this.processImageFile(file);
        }
      } catch (error) {
        console.error('Drop upload error:', error);
        this.showError('拖拽上传失败: ' + error.message);
      } finally {
        this.isProcessing = false;
      }
    };

    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
  }

  // 获取所有上传的图片
  getUploadedImages() {
    return Array.from(this.uploadedImages.values());
  }

  // 清空所有图片
  clearAllImages() {
    this.uploadedImages.clear();
    const container = this.chatWindowCore.getUploadedImagesContainer();
    if (container) {
      container.innerHTML = '';
    }
  }

  // 生成上传ID
  generateUploadId() {
    return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 显示错误消息
  showError(message) {
    console.error('Image upload error:', message);
    // 可以在这里添加用户友好的错误提示
    alert('错误: ' + message);
  }

  // 显示警告消息
  showWarning(message) {
    console.warn('Image upload warning:', message);
    // 可以在这里添加用户友好的警告提示
  }

  // 销毁
  destroy() {
    if (this.hiddenFileInput) {
      this.hiddenFileInput.remove();
      this.hiddenFileInput = null;
    }
    this.uploadedImages.clear();
    this.isProcessing = false;
  }
}

// 导出
window.ImageUploadManager = ImageUploadManager;