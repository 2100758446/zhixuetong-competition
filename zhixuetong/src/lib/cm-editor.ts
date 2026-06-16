import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView, Decoration, ViewPlugin, WidgetType,
  keymap, lineNumbers, highlightActiveLine, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection,
  type DecorationSet, type ViewUpdate,
} from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
import { tags } from '@lezer/highlight'

// ── 自定义高亮样式 ──
import { HighlightStyle } from '@codemirror/language'

const zhixuetongHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.4em', fontWeight: '700', color: '#111827' },
  { tag: tags.heading2, fontSize: '1.2em', fontWeight: '600', color: '#1f2937', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' },
  { tag: tags.heading3, fontSize: '1.05em', fontWeight: '600', color: '#374151' },
  { tag: tags.strong, fontWeight: '700', color: '#111827' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#4b5563' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#9ca3af' },
  { tag: tags.link, color: '#4f46e5', textDecoration: 'underline', textUnderlineOffset: '2px' },
  { tag: tags.monospace, fontFamily: "'SF Mono', 'Fira Code', monospace", background: '#f3f4f6', borderRadius: '3px', padding: '1px 4px' },
  { tag: tags.quote, color: '#6b7280', borderLeft: '3px solid #e5e7eb', paddingLeft: '12px' },
  { tag: tags.meta, color: '#9ca3af' },
  { tag: tags.comment, color: '#9ca3af' },
])

// ── [[链接]] 装饰组件 ──
class NoteLinkWidget extends WidgetType {
  constructor(readonly noteId: string, readonly noteTitle: string, readonly from: number, readonly to: number) {
    super()
  }
  eq(other: NoteLinkWidget) {
    return this.noteId === other.noteId && this.noteTitle === other.noteTitle
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-note-link'
    span.textContent = this.noteTitle
    span.setAttribute('data-note-id', this.noteId)
    span.style.cssText = 'color:#4f46e5;cursor:pointer;text-decoration:underline;text-underline-offset:2px;font-weight:500;'
    return span
  }
  ignoreEvent() { return false }
}

// ── 装饰插件：[[链接]] + 标题 + 粗体 ──
const noteLinkRegex = /\[\[id:([^|]+)\|([^\]]*)\]\]/g
const headingRegex = /^(#{1,3})\s(.+)$/gm

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: any[] = []
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // [[链接]] → 蓝色可点击文字
    for (const m of text.matchAll(noteLinkRegex)) {
      const start = from + m.index!
      const end = start + m[0].length
      const lineNum = view.state.doc.lineAt(start).number

      if (lineNum === cursorLine) {
        // 光标所在行：显示原始语法，只加颜色
        decorations.push(Decoration.mark({ class: 'cm-note-link-raw' }).range(start, end))
      } else {
        // 其他行：替换为渲染后的链接
        decorations.push(Decoration.replace({
          widget: new NoteLinkWidget(m[1], m[2], start, end),
        }).range(start, end))
      }
    }
  }

  return Decoration.set(decorations, true)
}

const noteLinkDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

// ── [[链接]] 点击处理 ──
function noteLinkClickHandler(onNavigate: (id: string) => void) {
  return EditorView.domEventHandlers({
    click: (e, view) => {
      const target = e.target as HTMLElement
      const link = target.closest('.cm-note-link') as HTMLElement
      if (link) {
        const noteId = link.getAttribute('data-note-id')
        if (noteId) {
          e.preventDefault()
          onNavigate(noteId)
        }
        return true
      }
      return false
    },
  })
}

// ── 基础扩展 ──
const baseExtensions: Extension[] = [
  lineNumbers(),
  highlightActiveLine(),
  highlightSpecialChars(),
  drawSelection(),
  dropCursor(),
  rectangularSelection(),
  bracketMatching(),
  closeBrackets(),
  history(),
  foldGutter(),
  highlightSelectionMatches(),
  EditorState.allowMultipleSelections.of(true),
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  syntaxHighlighting(zhixuetongHighlight),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  autocompletion(),
  EditorView.lineWrapping,
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap,
    ...closeBracketsKeymap,
    ...searchKeymap,
    ...lintKeymap,
    indentWithTab,
  ]),
  EditorView.theme({
    '&': { fontSize: '14px', fontFamily: "'Inter', 'Noto Sans SC', sans-serif" },
    '.cm-content': { padding: '16px 24px', lineHeight: '1.8' },
    '.cm-line': { padding: '1px 0' },
    '.cm-gutters': { background: '#fafafa', border: 'none', color: '#d1d5db' },
    '.cm-activeLineGutter': { background: '#f3f4f6', color: '#6b7280' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground': { background: '#e0e7ff !important' },
    '.cm-cursor': { borderLeftColor: '#6366f1' },
    '.cm-foldGutter': { color: '#d1d5db' },
  }),
]

// ── 创建编辑器 ──
export function createEditor(
  parent: HTMLElement,
  doc: string,
  onUpdate: (content: string) => void,
  onNavigate: (noteId: string) => void,
): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [
      ...baseExtensions,
      noteLinkDecorationPlugin,
      noteLinkClickHandler(onNavigate),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate(update.state.doc.toString())
        }
      }),
    ],
  })

  return new EditorView({ state, parent })
}

// ── 更新编辑器内容 ──
export function setEditorDoc(view: EditorView, doc: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
  })
}
