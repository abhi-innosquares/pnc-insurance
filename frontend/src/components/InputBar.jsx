import React, { useState } from 'react';
import './InputBar.css';

function InputBar({ onSubmit, isLoading, placeholder = "Enter your query..." }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSubmit(input);
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="input-bar" onSubmit={handleSubmit}>
      <textarea
        className="input-field"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={isLoading}
        rows="1"
      />
      <button
        type="submit"
        className="send-button"
        disabled={isLoading || !input.trim()}
        title={isLoading ? 'Processing...' : 'Run analysis'}
        aria-label={isLoading ? 'Processing request' : 'Run analysis'}
      >
        {isLoading ? (
          <span className="spinner"></span>
        ) : (
          <svg className="send-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M4 20l17-8L4 4v6l10 2-10 2v6z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </form>
  );
}

export default InputBar;
