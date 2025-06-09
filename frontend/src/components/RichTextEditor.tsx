import React, { useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
// @ts-ignore - No type definitions available for quill-better-table
import QuillBetterTable from 'quill-better-table';
import 'react-quill/dist/quill.snow.css';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';

// Register the better table module
Quill.register({
  'modules/better-table': QuillBetterTable,
}, true);

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  height?: string;
  includeQATools?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Start typing...",
  readOnly = false,
  height = "300px",
  includeQATools = false
}) => {
  const modules = useMemo(() => {
    const baseModules = {
      toolbar: {
        container: [
          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'indent': '-1'}, { 'indent': '+1' }],
          [{ 'align': [] }],
          ['blockquote', 'code-block'],
          ['link', 'image', 'video'],
          [{ 'script': 'sub'}, { 'script': 'super' }],
          ['clean'],
          ...(includeQATools ? [
            ['better-table'],
            [{ 'qa-templates': ['test-case', 'bug-report', 'checklist'] }]
          ] : [])
        ],
        handlers: includeQATools ? {
          'better-table': function(this: any) {
            this.quill.getModule('better-table').insertTable(3, 3);
          },
          'qa-templates': function(this: any, value: string) {
            const cursorPosition = this.quill.getSelection()?.index || 0;
            let template = '';
            
            switch(value) {
              case 'test-case':
                template = `
<h3>Test Case: [Test Case Title]</h3>
<p><strong>Objective:</strong> [What this test case aims to verify]</p>
<p><strong>Preconditions:</strong></p>
<ul>
  <li>[List any setup requirements]</li>
</ul>
<p><strong>Test Steps:</strong></p>
<ol>
  <li>[Step 1 description]</li>
  <li>[Step 2 description]</li>
  <li>[Step 3 description]</li>
</ol>
<p><strong>Expected Results:</strong></p>
<ul>
  <li>[What should happen]</li>
</ul>
<p><strong>Priority:</strong> [High/Medium/Low]</p>
<p><strong>Test Data:</strong> [Any specific data needed]</p>
                `;
                break;
              case 'bug-report':
                template = `
<h3>Bug Report: [Brief Description]</h3>
<p><strong>Environment:</strong> [Browser/OS/Device information]</p>
<p><strong>Steps to Reproduce:</strong></p>
<ol>
  <li>[Step 1]</li>
  <li>[Step 2]</li>
  <li>[Step 3]</li>
</ol>
<p><strong>Expected Behavior:</strong></p>
<p>[What should happen]</p>
<p><strong>Actual Behavior:</strong></p>
<p>[What actually happened]</p>
<p><strong>Severity:</strong> [Critical/High/Medium/Low]</p>
<p><strong>Screenshots/Logs:</strong></p>
<p>[Attach relevant files]</p>
                `;
                break;
              case 'checklist':
                template = `
<h3>QA Checklist: [Feature/Area Name]</h3>
<p><strong>Testing Scope:</strong> [What is being tested]</p>
<p><strong>Checklist Items:</strong></p>
<ul>
  <li>☐ [Functional requirement 1]</li>
  <li>☐ [Functional requirement 2]</li>
  <li>☐ [UI/UX validation]</li>
  <li>☐ [Cross-browser compatibility]</li>
  <li>☐ [Mobile responsiveness]</li>
  <li>☐ [Performance testing]</li>
  <li>☐ [Security validation]</li>
  <li>☐ [Error handling]</li>
</ul>
<p><strong>Notes:</strong></p>
<p>[Additional observations or comments]</p>
                `;
                break;
            }
            
            this.quill.clipboard.dangerouslyPasteHTML(cursorPosition, template);
          }
        } : {}
      },
      'better-table': {
        operationMenu: {
          items: {
            unmergeCells: {
              text: 'Another unmerge cells name'
            }
          }
        }
      },
      syntax: {
        highlight: (text: string) => {
          // Simple syntax highlighting for code blocks
          try {
            return Prism.highlight(text, Prism.languages.javascript, 'javascript');
          } catch (error) {
            console.warn('Prism highlighting failed:', error);
            return text;
          }
        }
      }
    };
    
    return baseModules;
  }, [includeQATools]);

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'video',
    'color', 'background',
    'align', 'script',
    'code-block', 'code',
    'better-table'
  ];

  return (
    <div className="rich-text-editor">
      <style>{`
        .rich-text-editor .ql-editor {
          min-height: ${height};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          font-size: 14px;
          line-height: 1.6;
        }
        .rich-text-editor .ql-toolbar {
          border-top: 1px solid #e5e7eb;
          border-left: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          background-color: #f9fafb;
        }
        .rich-text-editor .ql-container {
          border-bottom: 1px solid #e5e7eb;
          border-left: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          font-size: 14px;
        }
        .rich-text-editor .ql-editor pre.ql-syntax {
          background-color: #f4f4f5;
          border: 1px solid #e4e4e7;
          border-radius: 6px;
          padding: 12px;
          margin: 8px 0;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          overflow-x: auto;
        }
        .rich-text-editor .ql-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        .rich-text-editor .ql-editor table th,
        .rich-text-editor .ql-editor table td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          text-align: left;
        }
        .rich-text-editor .ql-editor table th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        .rich-text-editor .ql-editor blockquote {
          border-left: 4px solid #3b82f6;
          margin: 16px 0;
          padding-left: 16px;
          color: #6b7280;
          font-style: italic;
        }
        .rich-text-editor .ql-editor .ql-code-block-container {
          position: relative;
        }
        .rich-text-editor .ql-editor .ql-code-block-container::before {
          content: attr(data-language);
          position: absolute;
          top: 8px;
          right: 12px;
          font-size: 12px;
          color: #6b7280;
          background: #f9fafb;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
      `}</style>
      <ReactQuill
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        theme="snow"
      />
    </div>
  );
};

export default RichTextEditor; 