import { Send } from "lucide-react";



interface InputBarProps {
    input: string;
    isProcessing: boolean;
    userId: string;
    compact?: boolean;
    onChange: (value: string) => void;
    onSend: () => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
  }
  
export  function InputBar({ input, isProcessing, userId, compact = false, onChange, onSend, onKeyPress }: InputBarProps) {
    return (
      <div className={compact ? '' : 'w-full max-w-3xl'}>
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder={compact ? 'Ask away...' : 'Ask about your marketing data...'}
              disabled={isProcessing || !userId}
              rows={1}
              className={`w-full resize-none text-gray-800 transition-all duration-200 leading-relaxed
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:cursor-not-allowed placeholder-gray-400
                ${compact
                  ? 'py-3 pr-4 pl-[52px] border border-white/30 bg-white/20 backdrop-blur-sm rounded-2xl disabled:bg-gray-100/50 disabled:text-gray-500 placeholder-gray-500'
                  : 'py-4 pr-6 pl-[60px] border border-gray-300 bg-white rounded-3xl disabled:bg-gray-100 disabled:text-gray-500 shadow-lg hover:shadow-xl'
                }`}
              style={{
                minHeight: compact ? '50px' : '60px',
                maxHeight: compact ? '150px' : '200px',
                height: 'auto',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, compact ? 150 : 200) + 'px';
              }}
            />
          </div>
          <button
            onClick={onSend}
            disabled={!input.trim() || isProcessing || !userId}
            className={`bg-blue-600 text-white flex items-center gap-2 font-medium
              hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none
              transition-all duration-200 shadow-lg hover:shadow-xl
              ${compact ? 'px-6 py-3 rounded-2xl' : 'px-6 py-4 rounded-3xl'}`}
            title="Send Message"
          >
            <Send className="w-5 h-5" />
            <span>Send</span>
          </button>
        </div>
        <p className={`mt-2 text-center ${compact ? 'text-xs text-gray-600' : 'text-sm text-gray-500 mt-3'}`}>
          Press{' '}
          <kbd className={`font-mono ${compact ? 'px-1.5 py-0.5 bg-white/30 rounded border border-white/40' : 'px-2 py-1 bg-gray-100 rounded border border-gray-300 text-xs'}`}>
            Enter
          </kbd>{' '}
          to send,{' '}
          <kbd className={`font-mono ${compact ? 'px-1.5 py-0.5 bg-white/30 rounded border border-white/40' : 'px-2 py-1 bg-gray-100 rounded border border-gray-300 text-xs'}`}>
            Shift + Enter
          </kbd>{' '}
          for new line
        </p>
      </div>
    );
  }
  