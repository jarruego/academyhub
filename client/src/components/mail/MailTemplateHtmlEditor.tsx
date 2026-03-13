import { useEffect, useRef, type ChangeEvent } from 'react';
import { Button, Space, message } from 'antd';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

interface MailTemplateHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<string>;
  onReady?: (editor: Editor | null) => void;
}

export default function MailTemplateHtmlEditor({ value, onChange, onUploadImage, onReady }: MailTemplateHtmlEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image,
    ],
    content: value || '',
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    onReady?.(editor ?? null);
    return () => onReady?.(null);
  }, [editor, onReady]);

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Introduce la URL', previousUrl || 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url.trim() }).run();
  };

  const triggerUpload = () => {
    inputRef.current?.click();
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) return;

    try {
      const imageUrl = await onUploadImage(file);
      editor.chain().focus().setImage({ src: imageUrl }).run();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'No se pudo subir la imagen');
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <Button size="small" onClick={() => editor?.chain().focus().toggleBold().run()} type={editor?.isActive('bold') ? 'primary' : 'default'}>
          Negrita
        </Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleItalic().run()} type={editor?.isActive('italic') ? 'primary' : 'default'}>
          Cursiva
        </Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleBulletList().run()} type={editor?.isActive('bulletList') ? 'primary' : 'default'}>
          Lista
        </Button>
        <Button size="small" onClick={() => editor?.chain().focus().toggleOrderedList().run()} type={editor?.isActive('orderedList') ? 'primary' : 'default'}>
          Numerada
        </Button>
        <Button size="small" onClick={setLink} type={editor?.isActive('link') ? 'primary' : 'default'}>
          Enlace
        </Button>
        <Button size="small" onClick={triggerUpload}>
          Imagen
        </Button>
      </Space>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      <div className="mail-template-editor-shell">
        <EditorContent editor={editor} className="mail-template-editor-content" />
      </div>
    </div>
  );
}
