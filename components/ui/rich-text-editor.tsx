"use client"

import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  Heading1, Heading2, List, ListOrdered, Quote, Code, Undo, Redo 
} from 'lucide-react'

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[150px] max-h-[300px] w-full bg-transparent px-3 py-2 text-sm overflow-y-auto outline-none ProseMirror",
          className
        )
      }
    }
  });

  // Keep editor content in sync with value prop
  useEffect(() => {
    if (editor && value !== undefined && editor.getHTML() !== value) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const toggleHeading = (level: 1 | 2) => {
    editor.chain().focus().toggleHeading({ level }).run();
  };

  return (
    <div className="border border-input rounded-xl overflow-hidden bg-card/40 backdrop-blur-md shadow-sm focus-within:ring-1 focus-within:ring-purple-500/50 focus-within:border-purple-500/50 transition-all duration-200">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/40 border-b border-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('bold') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Grassetto"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('italic') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Corsivo"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('underline') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sottolineato"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('strike') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Barrato"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <span className="w-[1px] h-5 bg-muted-foreground/20 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('heading', { level: 1 }) && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => toggleHeading(1)}
          title="Titolo Grande"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('heading', { level: 2 }) && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => toggleHeading(2)}
          title="Titolo Medio"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <span className="w-[1px] h-5 bg-muted-foreground/20 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('bulletList') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Elenco Puntato"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('orderedList') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Elenco Numerato"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <span className="w-[1px] h-5 bg-muted-foreground/20 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('blockquote') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citazione"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10", 
            editor.isActive('code') && "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
          )}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Codice"
        >
          <Code className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10 disabled:opacity-30"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Annulla"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg transition-all duration-150 hover:bg-muted-foreground/10 disabled:opacity-30"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Ripristina"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Area with scoped class styling */}
      <EditorContent 
        editor={editor} 
        className="p-1 [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_h1]:text-lg [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-purple-500 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_code]:bg-purple-500/10 [&_.ProseMirror_code]:text-purple-500 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded"
      />
    </div>
  );
}
