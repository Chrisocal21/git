'use client'

import { useState, useRef, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Start typing...',
  className = '' 
}: RichTextEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState('16')
  const [fontFamily, setFontFamily] = useState('system-ui')

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    updateFormatState()
  }

  const updateFormatState = () => {
    setIsBold(document.queryCommandState('bold'))
    setIsItalic(document.queryCommandState('italic'))
    setIsUnderline(document.queryCommandState('underline'))
  }

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          execCommand('bold')
          break
        case 'i':
          e.preventDefault()
          execCommand('italic')
          break
        case 'u':
          e.preventDefault()
          execCommand('underline')
          break
      }
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const insertList = (type: 'ul' | 'ol') => {
    execCommand(type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList')
  }

  const changeFontSize = (size: string) => {
    setFontSize(size)
    execCommand('fontSize', '7')
    // Wrap selected text in span with custom size
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.fontSize = size + 'px'
      try {
        range.surroundContents(span)
      } catch (e) {
        // If selection spans multiple elements, wrap differently
        console.log('Complex selection')
      }
    }
    handleInput()
  }

  const changeFontFamily = (family: string) => {
    setFontFamily(family)
    execCommand('fontName', family)
  }

  const changeAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    const commands = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull'
    }
    execCommand(commands[align])
  }

  const clearFormatting = () => {
    execCommand('removeFormat')
  }

  return (
    <div 
      className={`${isFullscreen ? 'fixed inset-0 z-50 bg-[#0a0a0a]' : 'relative'} ${className}`}
    >
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-1 p-2 bg-[#1a1a1a] border border-[#2a2a2a] ${isFullscreen ? 'rounded-none' : 'rounded-t-lg'}`}>
        {/* Font controls */}
        <div className="flex items-center gap-1 border-r border-[#2a2a2a] pr-2">
          <select 
            value={fontFamily}
            onChange={(e) => changeFontFamily(e.target.value)}
            className="px-2 py-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
          >
            <option value="system-ui">System</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times</option>
            <option value="Courier New">Courier</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
          </select>
          
          <select 
            value={fontSize}
            onChange={(e) => changeFontSize(e.target.value)}
            className="px-2 py-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-xs w-16 focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
          >
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="24">24</option>
            <option value="28">28</option>
            <option value="32">32</option>
            <option value="36">36</option>
          </select>
        </div>

        {/* Text formatting */}
        <div className="flex items-center gap-1 border-r border-[#2a2a2a] pr-2">
          <button
            onClick={() => execCommand('bold')}
            className={`p-2 rounded hover:bg-[#2a2a2a] transition-colors ${isBold ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : ''}`}
            title="Bold (Ctrl+B)"
          >
            <span className="font-bold text-sm">B</span>
          </button>
          <button
            onClick={() => execCommand('italic')}
            className={`p-2 rounded hover:bg-[#2a2a2a] transition-colors ${isItalic ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : ''}`}
            title="Italic (Ctrl+I)"
          >
            <span className="italic text-sm">I</span>
          </button>
          <button
            onClick={() => execCommand('underline')}
            className={`p-2 rounded hover:bg-[#2a2a2a] transition-colors ${isUnderline ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : ''}`}
            title="Underline (Ctrl+U)"
          >
            <span className="underline text-sm">U</span>
          </button>
          <button
            onClick={() => execCommand('strikeThrough')}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors"
            title="Strikethrough"
          >
            <span className="line-through text-sm">S</span>
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1 border-r border-[#2a2a2a] pr-2">
          <button
            onClick={() => changeAlignment('left')}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors"
            title="Align Left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h12M3 12h18M3 16h12M3 20h18" />
            </svg>
          </button>
          <button
            onClick={() => changeAlignment('center')}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors"
            title="Align Center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M3 12h18M7 16h10M3 20h18" />
            </svg>
          </button>
          <button
            onClick={() => changeAlignment('right')}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors"
            title="Align Right"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M9 8h12M3 12h18M9 16h12M3 20h18" />
            </svg>
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r border-[#2a2a2a] pr-2">
          <button
            onClick={() => insertList('ul')}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors"
            title="Bullet List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="6" cy="6" r="1.5" fill="currentColor" />
              <circle cx="6" cy="12" r="1.5" fill="currentColor" />
              <circle cx="6" cy="18" r="1.5" fill="currentColor" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h10M10 12h10M10 18h10" />
            </svg>
          </button>
          <button
            onClick={() => insertList('ol')}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors"
            title="Numbered List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h1M10 6h10M4 12h1M10 12h10M4 18h1M10 18h10" />
            </svg>
          </button>
        </div>

        {/* Additional tools */}
        <div className="flex items-center gap-1 border-r border-[#2a2a2a] pr-2">
          <button
            onClick={clearFormatting}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors text-xs"
            title="Clear Formatting"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fullscreen toggle */}
        <div className="flex items-center ml-auto">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded hover:bg-[#2a2a2a] transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={updateFormatState}
        onKeyUp={updateFormatState}
        className={`
          bg-[#0a0a0a] border border-[#2a2a2a] border-t-0 p-4 
          focus:outline-none overflow-y-auto
          ${isFullscreen ? 'h-[calc(100vh-60px)] text-lg' : 'min-h-[400px] rounded-b-lg'}
        `}
        style={{
          fontFamily: fontFamily,
          fontSize: fontSize + 'px',
        }}
        data-placeholder={placeholder}
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #666;
          pointer-events: none;
          position: absolute;
        }
      `}</style>
    </div>
  )
}
