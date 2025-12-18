'use client';

import React, { useEffect, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot, $getSelection, FORMAT_TEXT_COMMAND, TextFormatType, $isRangeSelection, FORMAT_ELEMENT_COMMAND, ElementFormatType, EditorState, $createParagraphNode } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';
import clsx from 'clsx';

// --- Load Initial State Plugin ---
function LoadInitialStatePlugin({ initialValue }: { initialValue?: string }) {
  const [editor] = useLexicalComposerContext();
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    if (initialValue && isFirstRender) {
      setIsFirstRender(false);
      try {
        const initialState = editor.parseEditorState(initialValue);
        editor.setEditorState(initialState);
      } catch (error) {
        console.error('Error loading initial state:', error);
      }
    }
  }, [editor, initialValue, isFirstRender]);

  return null;
}

// --- Toolbar Component ---
function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        setIsBold(selection.hasFormat('bold'));
        setIsItalic(selection.hasFormat('italic'));
        setIsUnderline(selection.hasFormat('underline'));
        setIsStrikethrough(selection.hasFormat('strikethrough'));
        setIsCode(selection.hasFormat('code'));
      });
    });
  }, [editor]);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatElement = (format: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
  };

  const insertHeading = (headingSize: 'h1' | 'h2' | 'h3') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
      }
    });
  };

  const insertList = (listType: 'bullet' | 'number') => {
    if (listType === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const ToolbarButton = ({ 
    active, 
    onClick, 
    children,
    title
  }: { 
    active?: boolean; 
    onClick: () => void; 
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={clsx(
        "p-2 rounded-lg transition-colors hover:bg-slate-700/50 text-slate-400 hover:text-white",
        active && "bg-slate-700/50 text-blue-400"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-800 bg-slate-900/50 rounded-t-xl">
      <ToolbarButton onClick={() => insertHeading('h1')} title="Heading 1">
        <Heading1 size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => insertHeading('h2')} title="Heading 2">
        <Heading2 size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => insertHeading('h3')} title="Heading 3">
        <Heading3 size={18} />
      </ToolbarButton>
      <div className="w-px h-6 bg-slate-800 mx-1" />
      <ToolbarButton onClick={() => formatText('bold')} active={isBold} title="Bold">
        <Bold size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatText('italic')} active={isItalic} title="Italic">
        <Italic size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatText('underline')} active={isUnderline} title="Underline">
        <Underline size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatText('strikethrough')} active={isStrikethrough} title="Strikethrough">
        <Strikethrough size={18} />
      </ToolbarButton>
      <div className="w-px h-6 bg-slate-800 mx-1" />
      <ToolbarButton onClick={() => formatText('code')} active={isCode} title="Inline Code">
        <Code size={18} />
      </ToolbarButton>
      <div className="w-px h-6 bg-slate-800 mx-1" />
      <ToolbarButton onClick={() => insertList('bullet')} title="Bullet List">
        <List size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => insertList('number')} title="Numbered List">
        <ListOrdered size={18} />
      </ToolbarButton>
      <div className="w-px h-6 bg-slate-800 mx-1" />
      <ToolbarButton onClick={() => formatElement('left')} title="Align Left">
        <AlignLeft size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatElement('center')} title="Align Center">
        <AlignCenter size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatElement('right')} title="Align Right">
        <AlignRight size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatElement('justify')} title="Justify">
        <AlignJustify size={18} />
      </ToolbarButton>
    </div>
  );
}

// --- Editor Theme ---
const theme = {
  paragraph: 'mb-2 text-slate-300',
  heading: {
    h1: 'text-3xl font-bold text-white mb-4 mt-6',
    h2: 'text-2xl font-bold text-white mb-3 mt-5',
    h3: 'text-xl font-bold text-white mb-2 mt-4',
  },
  text: {
    bold: 'font-bold text-white',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through opacity-70',
    underlineStrikethrough: 'underline line-through',
    code: 'font-mono text-sm bg-slate-800 px-1 py-0.5 rounded text-blue-300',
  },
  list: {
    ul: 'list-disc list-inside mb-4 ml-4 text-slate-300',
    ol: 'list-decimal list-inside mb-4 ml-4 text-slate-300',
    listitem: 'mb-1',
  },
  quote: 'border-l-4 border-blue-500 pl-4 italic my-4 text-slate-400 bg-slate-900/50 py-2 rounded-r',
  link: 'text-blue-400 hover:text-blue-300 underline cursor-pointer',
  code: 'bg-slate-900 block p-4 rounded-lg font-mono text-sm text-slate-200 my-4 overflow-x-auto border border-slate-800',
};

// --- Main Editor Component ---
export default function LexicalEditor({ 
  onChange, 
  initialValue 
}: { 
  onChange: (html: string) => void;
  initialValue?: string;
}) {
  const initialConfig = {
    namespace: 'CervenTechEditor',
    theme,
    onError: (error: Error) => console.error(error),
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode
    ]
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex flex-col h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950/50 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-transparent transition-all">
        <Toolbar />
        <div className="relative flex-1">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="h-full min-h-[500px] p-4 outline-none resize-none overflow-auto text-slate-300"
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-slate-600 pointer-events-none">
                Start writing your article...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <LoadInitialStatePlugin initialValue={initialValue} />
          <OnChangePlugin onChange={(editorState) => {
             // Serialize editor state to JSON
             const jsonString = JSON.stringify(editorState.toJSON());
             onChange(jsonString);
          }} />
        </div>
      </div>
    </LexicalComposer>
  );
}
