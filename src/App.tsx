import React, { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, FileType, Download, Trash2, Info, Moon, Sun, ChevronDown } from 'lucide-react';

// Supported image formats
const IMAGE_FORMATS = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'image/bmp', label: 'BMP' },
  { value: 'image/tiff', label: 'TIFF' },
  { value: 'image/svg+xml', label: 'SVG' },
  { value: 'image/avif', label: 'AVIF' },
  { value: 'image/heic', label: 'HEIC' },
  { value: 'image/x-icon', label: 'ICO' }
];

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  convertedUrl: string | null;
  converting: boolean;
  error: string | null;
  targetFormat: string;
}

function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>('image/png');
  const [isConverting, setIsConverting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const newFiles = Array.from(e.target.files).map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      convertedUrl: null,
      converting: false,
      error: null,
      targetFormat: targetFormat // Use the global target format as default
    }));
    
    setImages(prev => [...prev, ...newFiles]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [targetFormat]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files?.length) {
      const imageFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
      );
      
      if (imageFiles.length) {
        const newFiles = imageFiles.map(file => ({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          convertedUrl: null,
          converting: false,
          error: null,
          targetFormat: targetFormat // Use the global target format as default
        }));
        
        setImages(prev => [...prev, ...newFiles]);
      }
    }
  }, [targetFormat]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const updatedImages = prev.filter(img => img.id !== id);
      // Clean up object URLs to prevent memory leaks
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
        if (imageToRemove.convertedUrl) {
          URL.revokeObjectURL(imageToRemove.convertedUrl);
        }
      }
      return updatedImages;
    });
  }, []);

  const convertImage = useCallback(async (image: ImageFile): Promise<ImageFile> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            ...image,
            converting: false,
            error: 'Failed to get canvas context'
          });
          return;
        }
        
        // Use a white background for formats that don't support transparency
        if (image.targetFormat === 'image/jpeg' || image.targetFormat === 'image/bmp') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw image with best quality
        ctx.drawImage(img, 0, 0);
        
        // Get the extension from the target format
        const formatParts = image.targetFormat.split('/');
        const extension = formatParts[formatParts.length - 1];
        
        // For JPEG, use high quality
        const quality = image.targetFormat === 'image/jpeg' ? 0.95 : undefined;
        
        try {
          // Convert to the target format
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve({
                ...image,
                converting: false,
                error: 'Conversion failed'
              });
              return;
            }
            
            // Create a new file with the target format
            const convertedFile = new File(
              [blob], 
              `${image.file.name.split('.')[0]}.${extension}`,
              { type: image.targetFormat }
            );
            
            // Create a URL for the converted file
            const convertedUrl = URL.createObjectURL(blob);
            
            resolve({
              ...image,
              file: convertedFile,
              convertedUrl,
              converting: false,
              error: null
            });
          }, image.targetFormat, quality);
        } catch (error) {
          resolve({
            ...image,
            converting: false,
            error: 'Conversion failed: ' + (error instanceof Error ? error.message : String(error))
          });
        }
      };
      
      img.onerror = () => {
        resolve({
          ...image,
          converting: false,
          error: 'Failed to load image'
        });
      };
      
      img.src = image.preview;
    });
  }, []);

  const convertAllImages = useCallback(async () => {
    if (!images.length) return;
    
    setIsConverting(true);
    
    // Mark all images as converting
    setImages(prev => prev.map(img => ({ ...img, converting: true, error: null })));
    
    // Convert each image sequentially to avoid overwhelming the browser
    const convertedImages = [];
    for (const image of images) {
      const convertedImage = await convertImage(image);
      convertedImages.push(convertedImage);
      
      // Update the state after each conversion
      setImages(prev => 
        prev.map(img => img.id === convertedImage.id ? convertedImage : img)
      );
    }
    
    setIsConverting(false);
  }, [images, convertImage]);

  const downloadImage = useCallback((image: ImageFile) => {
    if (!image.convertedUrl) return;
    
    const link = document.createElement('a');
    link.href = image.convertedUrl;
    link.download = image.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const downloadAllImages = useCallback(() => {
    images.forEach(image => {
      if (image.convertedUrl) {
        downloadImage(image);
      }
    });
  }, [images, downloadImage]);

  const clearAllImages = useCallback(() => {
    // Clean up object URLs
    images.forEach(image => {
      URL.revokeObjectURL(image.preview);
      if (image.convertedUrl) {
        URL.revokeObjectURL(image.convertedUrl);
      }
    });
    setImages([]);
  }, [images]);

  const getFormatExtension = useCallback((format: string) => {
    const formatObj = IMAGE_FORMATS.find(f => f.value === format);
    return formatObj ? formatObj.label.toLowerCase() : 'unknown';
  }, []);

  const toggleTheme = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  const updateImageTargetFormat = useCallback((id: string, format: string) => {
    setImages(prev => 
      prev.map(img => 
        img.id === id 
          ? { 
              ...img, 
              targetFormat: format,
              // Reset conversion results when changing format
              convertedUrl: null,
              error: null
            } 
          : img
      )
    );
  }, []);

  const applyGlobalFormatToAll = useCallback(() => {
    setImages(prev => 
      prev.map(img => ({
        ...img,
        targetFormat,
        // Reset conversion results when changing format
        convertedUrl: null,
        error: null
      }))
    );
  }, [targetFormat]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} p-4 md:p-8 transition-colors duration-300`}>
      <div className={`max-w-5xl mx-auto ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg overflow-hidden transition-colors duration-300`}>
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <ImageIcon className={`h-8 w-8 ${darkMode ? 'text-purple-400' : 'text-indigo-600'} mr-3 transition-colors duration-300`} />
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} transition-colors duration-300`}>Image Converter</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={toggleTheme}
                className={`p-2 ${darkMode ? 'text-purple-300 hover:text-purple-200' : 'text-gray-500 hover:text-indigo-600'} transition-colors duration-300`}
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2 ${darkMode ? 'text-purple-300 hover:text-purple-200' : 'text-gray-500 hover:text-indigo-600'} transition-colors duration-300`}
                aria-label="Show information"
              >
                <Info size={20} />
              </button>
            </div>
          </div>

          {showInfo && (
            <div className={`mb-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'} rounded-lg text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'} transition-colors duration-300`}>
              <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2 transition-colors duration-300`}>About this converter</h2>
              <p>This tool converts images while preserving quality using lossless methods when possible:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Converts between PNG, JPEG, WebP, GIF, BMP, TIFF, SVG, AVIF, HEIC, and ICO formats</li>
                <li>Maintains original dimensions and quality</li>
                <li>Processes everything locally in your browser (no uploads to servers)</li>
                <li>For formats that don't support transparency (JPEG, BMP), a white background is added</li>
                <li>Note: Some formats may have limited browser support</li>
              </ul>
            </div>
          )}

          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} transition-colors duration-300`}>
                Default Target Format
              </label>
              <button
                onClick={applyGlobalFormatToAll}
                className={`text-xs px-2 py-1 rounded ${
                  darkMode 
                    ? 'bg-purple-900/50 text-purple-300 hover:bg-purple-900/70' 
                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                } transition-colors`}
              >
                Apply to all images
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {IMAGE_FORMATS.map((format) => (
                <button
                  key={format.value}
                  onClick={() => setTargetFormat(format.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    targetFormat === format.value
                      ? darkMode 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-indigo-600 text-white'
                      : darkMode 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>

          <div 
            className={`border-2 border-dashed ${
              darkMode 
                ? 'border-gray-600 hover:border-purple-500' 
                : 'border-gray-300 hover:border-indigo-400'
            } rounded-lg p-8 text-center mb-6 transition-colors`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*"
              className="hidden"
              id="file-input"
            />
            <label 
              htmlFor="file-input"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              <Upload className={`h-12 w-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'} mb-3 transition-colors duration-300`} />
              <p className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-300`}>
                Drop images here or click to browse
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} transition-colors duration-300`}>
                Supports PNG, JPEG, WebP, GIF, BMP, TIFF, SVG, AVIF, HEIC, ICO and more
              </p>
            </label>
          </div>

          {images.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'} transition-colors duration-300`}>
                  {images.length} {images.length === 1 ? 'Image' : 'Images'}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={clearAllImages}
                    className={`px-3 py-1.5 text-sm ${
                      darkMode 
                        ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    } rounded transition-colors flex items-center`}
                    disabled={isConverting}
                  >
                    <Trash2 size={16} className="mr-1" />
                    Clear All
                  </button>
                  {images.some(img => img.convertedUrl) && (
                    <button
                      onClick={downloadAllImages}
                      className={`px-3 py-1.5 text-sm ${
                        darkMode 
                          ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' 
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      } rounded transition-colors flex items-center`}
                    >
                      <Download size={16} className="mr-1" />
                      Download All
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {images.map((image) => (
                  <div key={image.id} className={`border rounded-lg overflow-hidden ${
                    darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                  } transition-colors duration-300`}>
                    <div className={`relative h-40 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'} transition-colors duration-300`}>
                      <img
                        src={image.convertedUrl || image.preview}
                        alt={image.file.name}
                        className="w-full h-full object-contain"
                      />
                      <button
                        onClick={() => removeImage(image.id)}
                        className={`absolute top-2 right-2 p-1 ${
                          darkMode 
                            ? 'bg-gray-700 hover:bg-red-900/50' 
                            : 'bg-white hover:bg-red-50'
                        } rounded-full shadow transition-colors`}
                        aria-label="Remove image"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                    <div className="p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className={`truncate text-sm font-medium ${
                          darkMode ? 'text-gray-300' : 'text-gray-700'
                        } transition-colors duration-300`} title={image.file.name}>
                          {image.file.name}
                        </div>
                        <div className={`flex items-center text-xs ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        } transition-colors duration-300`}>
                          <FileType size={14} className="mr-1" />
                          {image.file.type.split('/')[1].toUpperCase()}
                        </div>
                      </div>
                      
                      {/* Individual format selector */}
                      <div className="mb-2">
                        <div className={`text-xs font-medium mb-1 ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Convert to:
                        </div>
                        <div className="relative">
                          <select
                            value={image.targetFormat}
                            onChange={(e) => updateImageTargetFormat(image.id, e.target.value)}
                            className={`w-full text-xs py-1 pl-2 pr-8 rounded appearance-none ${
                              darkMode 
                                ? 'bg-gray-600 text-gray-200 border-gray-500' 
                                : 'bg-white text-gray-800 border-gray-300'
                            } border focus:outline-none focus:ring-1 ${
                              darkMode ? 'focus:ring-purple-500' : 'focus:ring-indigo-500'
                            }`}
                            disabled={isConverting}
                          >
                            {IMAGE_FORMATS.map((format) => (
                              <option key={format.value} value={format.value}>
                                {format.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <ChevronDown size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                          </div>
                        </div>
                      </div>
                      
                      {image.error ? (
                        <div className="text-xs text-red-500 mb-2">{image.error}</div>
                      ) : image.converting ? (
                        <div className={`text-xs ${
                          darkMode ? 'text-purple-400' : 'text-indigo-500'
                        } mb-2 transition-colors duration-300`}>Converting...</div>
                      ) : image.convertedUrl ? (
                        <div className="flex justify-between items-center">
                          <div className={`text-xs ${
                            darkMode ? 'text-green-400' : 'text-green-600'
                          } transition-colors duration-300`}>
                            Converted to {getFormatExtension(image.targetFormat)}
                          </div>
                          <button
                            onClick={() => downloadImage(image)}
                            className={`p-1 ${
                              darkMode 
                                ? 'text-purple-400 hover:text-purple-300' 
                                : 'text-indigo-600 hover:text-indigo-800'
                            } transition-colors`}
                            aria-label="Download converted image"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={convertAllImages}
                  disabled={isConverting || images.length === 0}
                  className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                    isConverting || images.length === 0
                      ? 'bg-gray-500 cursor-not-allowed'
                      : darkMode 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isConverting ? 'Converting...' : 'Convert All Images'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      <footer className={`mt-8 text-center text-sm ${
        darkMode ? 'text-gray-400' : 'text-gray-500'
      } transition-colors duration-300`}>
        <p>All conversions happen locally in your browser. Your images are never uploaded to any server.</p>
      </footer>
    </div>
  );
}

export default App;