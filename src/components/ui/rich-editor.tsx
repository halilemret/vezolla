"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import {
  TextB,
  TextItalic,
  ListBullets,
  ListNumbers,
  TextHOne,
  TextHTwo,
  LinkSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichEditor({ value, onChange }: RichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "underline text-[#9a3412]" },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-40 w-full px-3 py-2.5 text-sm text-zinc-900 focus:outline-none prose prose-sm max-w-none",
      },
    },
    onUpdate({ editor: instance }) {
      onChange(instance.getHTML());
    },
  });

  if (!editor) {
    return (
      <div className="min-h-40 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-600">
        Metin düzenleyici yükleniyor...
      </div>
    );
  }

  const promptLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Bağlantı adresi (URL):", previousUrl ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="rounded-md border border-zinc-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="Başlık 2"
        >
          <TextHOne className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          label="Başlık 3"
        >
          <TextHTwo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Kalın"
        >
          <TextB className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="İtalik"
        >
          <TextItalic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Madde işaretli liste"
        >
          <ListBullets className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numaralı liste"
        >
          <ListNumbers className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={promptLink}
          label="Bağlantı ekle"
        >
          <LinkSimple className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded text-zinc-700 hover:bg-zinc-200",
        active && "bg-zinc-900 text-white hover:bg-zinc-800"
      )}
    >
      {children}
    </button>
  );
}
