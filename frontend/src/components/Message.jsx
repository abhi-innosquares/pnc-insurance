import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Message.css';

function Message({ message }) {
  const { type, content, isStreaming, isError, progress } = message;

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
            {content}
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
