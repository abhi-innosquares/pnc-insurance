import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Message.css';

function formatAssistantContent(content) {
  if (typeof content !== 'string') return content;

  const text = content.trim();
  if (!text) return text;

  const fencedJsonMatch = text.match(/```(?:json)?\s*\n[\s\S]*$/i);
  const braceStart = text.indexOf('\n{') >= 0 ? text.indexOf('\n{') + 1 : text.indexOf('{');

  let summaryRaw = '';
  let jsonRaw = '';

  if (fencedJsonMatch && typeof fencedJsonMatch.index === 'number') {
    summaryRaw = text.slice(0, fencedJsonMatch.index).trim();
    jsonRaw = fencedJsonMatch[0];
  } else {
    const hasJsonTail =
      braceStart >= 0 &&
      (text.slice(braceStart).trim().startsWith('{') || text.slice(braceStart).trim().startsWith('['));

    if (!hasJsonTail) {
      return text;
    }

    summaryRaw = text.slice(0, braceStart).trim();
    jsonRaw = text.slice(braceStart).trim();
  }

  // Normalize JSON tail if upstream output already includes fenced markdown.
  jsonRaw = jsonRaw
    .replace(/^\s*```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  const normalized = summaryRaw
    .replace(/\r/g, '')
    .replace(/^\s*```(?:json)?\s*$/gim, '')
    .replace(/^[\s\u2500\u2501\u2502\u2014\u2015\-_=]{4,}$/gm, '')
    .replace(/\bCOMPOSITE\s+RISK\s+ASSESSMENT\b/gi, '\nComposite Risk Assessment')
    .replace(/\s+(▶\s*DISPOSITION\s*:)/gi, '\n$1')
    .replace(/\s+(DISPOSITION\s*:)/gi, '\n$1')
    .replace(/\bComposite\s+Fraud\s+Risk\s+Score\s*\(CFRS\)\s*:/gi, '\nComposite Fraud Risk Score (CFRS):')
    .replace(/\s+(CFRS\s*=)/gi, '\n$1')
    .replace(/\s+(Override\s+check\s*:)/gi, '\n$1')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();

  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const markdownLines = [];
  let justAddedCompositeRiskAssessment = false;

  for (const line of lines) {
    const cleaned = line
      .replace(/^[\u2500\u2501\u2502\u2014\u2015\-_=]{4,}\s*/, '')
      .replace(/\s*[\u2500\u2501\u2502\u2014\u2015\-_=]{4,}$/g, '')
      .trim();

    if (!cleaned) continue;

    if (/^scoring breakdown\s*:/i.test(cleaned)) {
      markdownLines.push('### Scoring Breakdown');
      continue;
    }

    if (/^composite risk$/i.test(cleaned) || /^composite risk assessment$/i.test(cleaned)) {
      markdownLines.push('### Composite Risk Assessment');
      justAddedCompositeRiskAssessment = true;
      continue;
    }

    if (/^assessment\b/i.test(cleaned) || /^composite\s+risk\s+assessment\b/i.test(cleaned)) {
      if (justAddedCompositeRiskAssessment) {
        justAddedCompositeRiskAssessment = false;
        continue;
      }
      const ccrsMatch = cleaned.match(/ccrs\s*:\s*([0-9.]+)/i);
      if (ccrsMatch) {
        markdownLines.push(`### Assessment (CCRS: ${ccrsMatch[1]})`);
      } else {
        markdownLines.push('### Assessment');
      }
      continue;
    }

    if ((/^\|?\s*bars\s*:/i.test(cleaned) || /\|/.test(cleaned)) && /(ccrs|bars|fars|ecrs|cfrs)\s*:/i.test(cleaned)) {
      const metrics = cleaned
        .replace(/^\|\s*/, '')
        .split('|')
        .map(s => s.trim())
        .filter(Boolean);
      markdownLines.push('#### Metrics');
      for (const metric of metrics) {
        markdownLines.push(`- ${metric}`);
      }
      justAddedCompositeRiskAssessment = false;
      continue;
    }

    if (/^\s*[•\-]\s+/.test(cleaned)) {
      markdownLines.push(`- ${cleaned.replace(/^\s*[•\-]\s+/, '')}`);
      continue;
    }

    if (cleaned.includes('✓')) {
      const parts = cleaned
        .split('✓')
        .map(s => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        markdownLines.push(`- ${part}`);
      }
      continue;
    }

    if (/^▶\s*/.test(cleaned) || /^disposition\s*:/i.test(cleaned)) {
      markdownLines.push(`### ${cleaned.replace(/^▶\s*/, '')}`);
      justAddedCompositeRiskAssessment = false;
      continue;
    }

    markdownLines.push(cleaned);
    justAddedCompositeRiskAssessment = false;
  }

  const summary = markdownLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const summaryBlock = summary || summaryRaw;

  return `${summaryBlock}\n\n\`\`\`json\n${jsonRaw}\n\`\`\``;
}

function Message({ message }) {
  const { type, content, isStreaming, isError, progress } = message;
  const renderedContent = type === 'assistant' ? formatAssistantContent(content) : content;

  return (
    <div className={`message message-${type} ${isStreaming ? 'streaming' : ''} ${isError ? 'error' : ''}`}>
      <div className="message-content">
        {type === 'user' ? (
          <div className="text-content">{content}</div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ node, inline, className, children, ...props }) => {
                if (!inline && className && className.includes('language-')) {
                  return (
                    <pre className="code-block">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                }
                return <code className="inline-code" {...props}>{children}</code>;
              },
              table: ({ node, ...props }) => (
                <div className="table-wrapper">
                  <table {...props} />
                </div>
              ),
            }}
          >
            {renderedContent}
          </ReactMarkdown>
          </div>
        )}
        {isStreaming && progress && (
          <div className="progress-indicator">
            <span className="spinner"></span>
            <span>{progress}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Message;
