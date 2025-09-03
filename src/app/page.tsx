'use client'

import { useState, useCallback, useEffect } from 'react'
import { convertFile, getSupportedFormats } from '@/lib/format-converter'
import { convertFileWithWebCodecs, getWebCodecsSupportedFormats, isWebCodecsSupported } from '@/lib/webcodecs-converter'
import { ConversionResult } from '@/types/video'
import { log } from 'console'

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string>('')
  const [targetFormat, setTargetFormat] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const [useWebCodecs, setUseWebCodecs] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Client-side mount effect to avoid SSR hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setConversionResult(null)
    setError('')
    
    // Auto-detect file type and set default target format
    const fileType = file.type.split('/')[0] as 'video' | 'audio' | 'image'
    const supportedFormats = useWebCodecs ? getWebCodecsSupportedFormats(fileType) : getSupportedFormats(fileType)
    if (supportedFormats.length > 0) {
      setTargetFormat(supportedFormats[0])
    }
  }, [useWebCodecs])

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Convert file
  const handleConvert = useCallback(async () => {
    if (!selectedFile || !targetFormat) return
    
    setIsConverting(true)
    setError('')
    
    try {
      console.log(`[Converter] Using ${useWebCodecs ? 'WebCodecs' : 'FFmpeg'} for conversion`)
      console.log(`[Converter] Input:`, {
        name: selectedFile.name,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`,
        type: selectedFile.type,
        targetFormat
      })
      
      const result = useWebCodecs 
        ? await convertFileWithWebCodecs({
            inputFile: selectedFile,
            targetFormat,
            autoDetect: true
          })
        : await convertFile({
            inputFile: selectedFile,
            targetFormat,
            autoDetect: true
          })
      
      console.log(`[Converter] Conversion completed successfully using ${useWebCodecs ? 'WebCodecs' : 'FFmpeg'}`)
      setConversionResult(result)
    } catch (err) {
      console.error(`[Converter] Conversion failed with ${useWebCodecs ? 'WebCodecs' : 'FFmpeg'}:`, err)
      setError(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setIsConverting(false)
    }
  }, [selectedFile, targetFormat, useWebCodecs])

  // Download converted file
  const handleDownload = useCallback(() => {
    if (!conversionResult) return
    
    const url = URL.createObjectURL(conversionResult.file)
    const a = document.createElement('a')
    a.href = url
    a.download = conversionResult.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [conversionResult])

  // Get supported formats for current file
  const getSupportedFormatsForFile = () => {
    if (!selectedFile) return []
    const fileType = selectedFile.type.split('/')[0] as 'video' | 'audio' | 'image'
    return useWebCodecs ? getWebCodecsSupportedFormats(fileType) : getSupportedFormats(fileType)
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  // Only check WebCodecs support on client side to avoid SSR hydration mismatch
  const webCodecsSupported = isClient && isWebCodecsSupported()
  
  console.log("Debug - WebCodecs Support Details:", {
    isClient,
    supported: webCodecsSupported,
    VideoDecoder: typeof window !== 'undefined' && 'VideoDecoder' in window,
    VideoEncoder: typeof window !== 'undefined' && 'VideoEncoder' in window,
    AudioDecoder: typeof window !== 'undefined' && 'AudioDecoder' in window,
    AudioEncoder: typeof window !== 'undefined' && 'AudioEncoder' in window,
    useWebCodecs: useWebCodecs,
    buttonShouldBeDisabled: !webCodecsSupported
  })

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">File Format Converter</h1>
          <p className="text-gray-600">Convert your video, audio, and image files to different formats</p>
          
          {/* Converter Selection */}
          <div className="mt-6 flex justify-center">
            <div className="bg-white rounded-lg p-1 shadow-sm border">
              <button
                onClick={() => setUseWebCodecs(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !useWebCodecs
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                FFmpeg (Full Support)
              </button>
              <button
                onClick={() => setUseWebCodecs(true)}
                disabled={!webCodecsSupported}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !webCodecsSupported
                    ? 'text-gray-300 cursor-not-allowed bg-gray-100'
                    : useWebCodecs
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                WebCodecs (Native)
                {!webCodecsSupported && ' ❌'}
              </button>
            </div>
          </div>
          
          {/* Info about current converter */}
          <div className="mt-4 text-sm text-gray-500">
            {useWebCodecs ? (
              webCodecsSupported ? (
                <span className="text-green-600">✅ Using native browser WebCodecs API</span>
              ) : (
                <span className="text-red-600">❌ WebCodecs not supported in this browser</span>
              )
            ) : (
              <span className="text-blue-600">🔧 Using FFmpeg.wasm for maximum format support</span>
            )}
          </div>
        </div>

        {/* File Upload Area */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="text-6xl text-gray-400">📁</div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drop your file here or click to browse
                </p>
                <p className="text-gray-500">Supports video, audio, and image files</p>
              </div>
              <input
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
                id="file-input"
                accept="video/*,audio/*,image/*"
              />
              <label
                htmlFor="file-input"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                Choose File
              </label>
            </div>
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Selected File:</h3>
              <div className="text-sm text-gray-600">
                <p><strong>Name:</strong> {selectedFile.name}</p>
                <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>
                <p><strong>Type:</strong> {selectedFile.type}</p>
              </div>
            </div>
          )}
        </div>

        {/* Conversion Options */}
        {selectedFile && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Format
                </label>
                <select
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {getSupportedFormatsForFile().map(format => (
                    <option key={format} value={format}>
                      {format.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={handleConvert}
                  disabled={!selectedFile || !targetFormat || isConverting}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isConverting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Converting...
                    </span>
                  ) : (
                    'Convert File'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="text-red-400">⚠️</div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Conversion Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Conversion Result */}
        {conversionResult && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Conversion Complete! ✅ 
              <span className="text-sm font-normal text-gray-500 ml-2">
                (using {useWebCodecs ? 'WebCodecs API' : 'FFmpeg.wasm'})
              </span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">Original File</h4>
                <p className="text-sm text-gray-600">Size: {formatFileSize(conversionResult.originalSize)}</p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">Converted File</h4>
                <p className="text-sm text-gray-600">
                  Format: {conversionResult.format.toUpperCase()}<br/>
                  Size: {formatFileSize(conversionResult.convertedSize)}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDownload}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download {conversionResult.filename}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}