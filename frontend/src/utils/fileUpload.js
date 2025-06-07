/**
 * Validates a file before upload
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @param {number} options.maxSize - Maximum file size in MB
 * @param {string[]} options.allowedTypes - Allowed MIME types
 * @returns {{isValid: boolean, error: string|null}} Validation result
 */
export const validateFile = (file, { maxSize = 5, allowedTypes = ['image/jpeg', 'image/png', 'image/gif'] } = {}) => {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  // Check file size (convert MB to bytes)
  const maxSizeInBytes = maxSize * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return {
      isValid: false,
      error: `File is too large. Maximum size is ${maxSize}MB`
    };
  }
  
  return { isValid: true, error: null };
};

/**
 * Converts a file to base64 string
 * @param {File} file - The file to convert
 * @returns {Promise<string>} Base64 string representation of the file
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Creates a thumbnail for an image file
 * @param {File} file - The image file
 * @param {number} maxWidth - Maximum width of the thumbnail
 * @param {number} maxHeight - Maximum height of the thumbnail
 * @returns {Promise<Blob>} Thumbnail as a Blob
 */
export const createThumbnail = (file, maxWidth = 200, maxHeight = 200) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      
      // Set canvas dimensions and draw the image
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        },
        file.type,
        0.9 // quality
      );
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // Start loading the image
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Handles file selection and validation
 * @param {Event} event - The file input change event
 * @param {Object} options - Validation options
 * @returns {Promise<{file: File, preview: string, error: string|null}>}
 */
export const handleFileSelect = async (event, options = {}) => {
  const file = event.target.files?.[0];
  
  if (!file) {
    return { file: null, preview: null, error: 'No file selected' };
  }
  
  // Validate the file
  const { isValid, error } = validateFile(file, options);
  if (!isValid) {
    return { file: null, preview: null, error };
  }
  
  // Create a preview URL
  const preview = URL.createObjectURL(file);
  
  return { file, preview, error: null };
};
