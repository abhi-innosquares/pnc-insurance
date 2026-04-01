import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Message from './Message';
import InputBar from './InputBar';
import './ChatInterface.css';

// Use relative URL - Vite proxy will forward to backend
const API_BASE = '/api';
const EXECUTION_STATE_KEY = 'pnc_execution_state';

function buildDisplayOutput(output = [], fallback = 'Processing...') {
  if (!Array.isArray(output) || output.length === 0) {
    return fallback;
  }

  const text = output
    .filter(item => item && (item.type === 'stdout' || item.type === 'stderr') && typeof item.content === 'string')
    .map(item => item.content)
    .join('');

  return text.trim().length > 0 ? text : fallback;
}

function stripAnsi(value = '') {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function deriveLiveProgress(output = [], fallback = 'Processing...') {
  if (!Array.isArray(output) || output.length === 0) {
    return fallback;
  }

  for (let i = output.length - 1; i >= 0; i -= 1) {
    const item = output[i];
    if (!item || typeof item.content !== 'string') continue;

    const lines = item.content
      .split(/\r?\n/)
      .map(line => stripAnsi(line).trim())
      .filter(Boolean)
      .reverse();

    for (const line of lines) {
      if (/^[=+!#*\-]{4,}$/.test(line)) continue;
      if (/^```/.test(line)) continue;
      if (/^[\[{\]}",]/.test(line)) continue;

      if (line.includes('mcp__zaimler-ntt-ins-pc__agent_chat') || /Explorer query/i.test(line)) {
        return 'Running graph query...';
      }

      if (line.includes('mcp__zaimler-ntt-ins-pc__execute_template') || /Template:/i.test(line)) {
        return 'Running template query...';
      }

      if (/Response received|data rows/i.test(line)) {
        return 'Received data, preparing assessment...';
      }

      if (/EXECUTION_STATE|Finalizing/i.test(line)) {
        return 'Finalizing results...';
      }

      return line.length > 120 ? `${line.slice(0, 117)}...` : line;
    }
  }

  return fallback;
}

function ChatInterface({ onJourneyUpdate = () => {} }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('pnc_chat_messages');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load messages:', error);
    }
    return [
      {
        id: 'welcome',
        type: 'assistant',
        content: 'Ready for live fraud analysis. Enter a customer as "LastName, FirstName" to start.',
        timestamp: Date.now()
      }
    ];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    try {
      const saved = localStorage.getItem(EXECUTION_STATE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        return state.sessionId || null;
      }
    } catch (error) {
      console.warn('Failed to load session ID:', error);
    }
    return null;
  });
  const [sessionStatus, setSessionStatus] = useState(null);
  const [eventSource, setEventSource] = useState(null);
  const messagesEndRef = useRef(null);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pnc_chat_messages', JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save messages:', error);
    }
  }, [messages]);

  // Persist execution state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(EXECUTION_STATE_KEY, JSON.stringify({ isLoading, sessionId }));
    } catch (error) {
      console.warn('Failed to save execution state:', error);
    }
  }, [isLoading, sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const submitQuery = async (userInput) => {
    // Add user message
    const userMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: userInput,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);

    try {
      // Submit query to backend
      const response = await axios.post(`${API_BASE}/query`, { query: userInput });
      const newSessionId = response.data.sessionId;
      setSessionId(newSessionId);

      // Add assistant message indicating processing started
      const processingMessage = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: 'Request accepted. Starting analysis pipeline...',
        timestamp: Date.now(),
        isStreaming: true
      };
      setMessages(prev => [...prev, processingMessage]);

      // Connect to event stream for real-time updates
      connectToStream(newSessionId);
    } catch (error) {
      console.error('Error submitting query:', error);
      const errorMessage = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: `Error: ${error.response?.data?.error || error.message}`,
        timestamp: Date.now(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const connectToStream = (newSessionId) => {
    // Check if EventSource is available (for SSE streaming)
    if (typeof EventSource !== 'undefined') {
      const es = new EventSource(`${API_BASE}/session/${newSessionId}/stream`);

      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'init':
            console.log('Stream initialized:', data.session);
            setSessionStatus(data.session);
            break;
          case 'update':
            setSessionStatus(data.session);
            
            // Render aggregated output so the UI doesn't go blank on meta/empty chunks
            setMessages(prev => {
              if (prev.length === 0) return prev;

              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.type === 'assistant' && last.isStreaming) {
                const finished = data.session.status === 'completed' || data.session.status === 'error';
                const liveProgress = deriveLiveProgress(data.session.output, data.session.progress || 'Processing...');
                updated[updated.length - 1] = {
                  ...last,
                  content: buildDisplayOutput(data.session.output, data.session.progress),
                  progress: finished ? undefined : liveProgress,
                  isStreaming: !finished
                };
              }
              return updated;
            });
            
            if (data.session.status === 'completed') {
              setIsLoading(false);
              onJourneyUpdate();
            }
            
            if (data.session.status === 'error') {
              setIsLoading(false);
            }
            break;
          case 'complete':
            es.close();
            setEventSource(null);
            setIsLoading(false);
            setMessages(prev => {
              if (prev.length === 0) return prev;
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.type === 'assistant' && last.isStreaming) {
                updated[updated.length - 1] = {
                  ...last,
                  isStreaming: false,
                  progress: undefined
                };
              }
              return updated;
            });
            break;
          default:
            break;
        }
      };

      es.onerror = (error) => {
        console.error('Stream error:', error);
        es.close();
        setEventSource(null);
        setIsLoading(false);
      };

      setEventSource(es);
    } else {
      // Fallback: Use polling instead of SSE
      pollForUpdates(newSessionId);
    }
  };

  const pollForUpdates = (newSessionId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE}/session/${newSessionId}`);
        const session = response.data;
        
        setSessionStatus(session);

        setMessages(prev => {
          if (prev.length === 0) return prev;

          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.type === 'assistant' && last.isStreaming) {
            const finished = session.status === 'completed' || session.status === 'error';
            const liveProgress = deriveLiveProgress(session.output, session.progress || 'Processing...');
            updated[updated.length - 1] = {
              ...last,
              content: buildDisplayOutput(session.output, session.progress),
              progress: finished ? undefined : liveProgress,
              isStreaming: !finished
            };
          }
          return updated;
        });

        if (session.status === 'completed' || session.status === 'error') {
          clearInterval(pollInterval);
          setIsLoading(false);
          onJourneyUpdate();
        }
      } catch (error) {
        console.error('Poll error:', error);
        clearInterval(pollInterval);
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="chat-interface">
      <div className="chat-main">
        <div className="messages-container">
          {messages.map(message => (
            <Message key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <InputBar 
          onSubmit={submitQuery} 
          isLoading={isLoading}
          placeholder="Type customer name (for example: Smith, John)"
        />
      </div>
    </div>
  );
}

export default ChatInterface;
