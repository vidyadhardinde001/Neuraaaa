import { useState, useRef, useEffect } from 'react';
import { Mic, X, Check, ChevronDown, Volume2, Sparkles, Edit2 } from 'lucide-react';
import { VOICE_PATTERNS } from '../utils/voicePatterns';

interface VoiceInputProps {
  onCommandReceived: (text: string) => void;
}

export default function VoiceInput({ onCommandReceived }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [showCommandsList, setShowCommandsList] = useState(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech Recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setIsPulsing(true);
      setTranscript('');
      setError('');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript || '';
        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }
      const combined = (finalTranscript + interimTranscript).trim();

      let display = combined
        .replace(/\s+(?:dot|period|full stop)\s+/gi, '.')
        .replace(/\s+(?:dot|period|full stop)$/gi, '.')
        .replace(/^(?:dot|period|full stop)\s+/gi, '.')
        .replace(/\s*\.\s*/g, '.')
        .trim();

      setTranscript(display);
    };

    recognition.onerror = (event: any) => {
      setError(`Error: ${event.error}`);
      setIsListening(false);
      setIsPulsing(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsPulsing(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsPulsing(false);
    } else {
      recognitionRef.current.start();
    }
  };

  const submitCommand = () => {
    const commandToSubmit = isEditMode ? editedTranscript : transcript;
    if (commandToSubmit.trim()) {
      onCommandReceived(commandToSubmit.trim());
      setTranscript('');
      setEditedTranscript('');
      setIsEditMode(false);
      setIsListening(false);
      setIsPulsing(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const cancelCommand = () => {
    setTranscript('');
    setEditedTranscript('');
    setIsEditMode(false);
    setError('');
    setIsListening(false);
    setIsPulsing(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  return (
    <div className="relative">
      {/* Mic button */}
      <button
        onClick={toggleListening}
        title={isListening ? 'Stop listening' : 'Start voice command'}
        className={`
          relative p-4 rounded-full transition-all duration-300
          shadow-lg hover:shadow-xl active:scale-95
          bg-gradient-to-br from-blue-500 to-purple-600
          text-white
          ${isPulsing ? 'animate-glow' : ''}
          group
        `}
      >
        {isPulsing && (
          <>
            <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" style={{ animationDelay: '0.5s' }} />
          </>
        )}

        <div className="relative z-10">
          {isListening ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1 h-4 bg-white rounded animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1 h-4 bg-white rounded animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 h-4 bg-white rounded animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              <Volume2 className="w-5 h-5" />
            </div>
          ) : (
            <>
              <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
              <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-300" />
            </>
          )}
        </div>
      </button>

      {/* Voice input modal */}
      {(isListening || transcript || error) && (
        <div className="fixed top-[370px] inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-white to-gray-50 rounded-2xl shadow-2xl p-6 w-[90%] max-w-md border border-gray-200/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100">
                  <Mic className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Voice Command
                  </h3>
                  <p className="text-xs text-gray-500">Speak your command clearly</p>
                </div>
              </div>
              <button
                onClick={cancelCommand}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main content area */}
            <div className="space-y-6">
              {/* Visualizer for listening state */}
              {isListening && (
                <div className="relative h-[100px] bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200/50 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-end gap-1 h-12">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full"
                          style={{
                            height: `${Math.random() * 80 + 20}%`,
                            animation: `pulse 1.5s ease-in-out infinite`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-1 left-0 right-0 text-center">
                    <span className="text-sm font-medium text-blue-600 animate-pulse">
                      Listening...
                    </span>
                  </div>
                </div>
              )}

              {/* Transcript display */}
              <div
                className={`
                  rounded-xl p-4 min-h-20 transition-all duration-300
                  ${
                    transcript
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200'
                      : 'bg-gray-50 border border-gray-200'
                  }
                `}
              >
                {isEditMode ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Edit Command
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editedTranscript}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your command..."
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    {transcript ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Command Detected
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setIsEditMode(true);
                              setEditedTranscript(transcript);
                            }}
                            className="p-1 rounded hover:bg-white/50 transition-colors"
                            title="Edit command"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-600 hover:text-blue-700" />
                          </button>
                        </div>
                        <p className="text-base font-medium text-gray-800 leading-relaxed">
                          "{transcript}"
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-16">
                        <p className="text-gray-400 text-center">
                          {isListening ? 'Start speaking...' : error || 'Waiting for command'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="animate-shake bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-red-100">
                      <X className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-sm font-medium text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelCommand}
                  className="flex-1 bg-gradient-to-b from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300
                           px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                           shadow-sm hover:shadow border border-gray-300/50 text-gray-700"
                >
                  Cancel
                </button>
                {isEditMode && editedTranscript && (
                  <button
                    onClick={() => {
                      setTranscript(editedTranscript);
                      setIsEditMode(false);
                    }}
                    className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700
                             px-4 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2
                             transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Done Editing
                  </button>
                )}
                {(transcript || editedTranscript) && !isEditMode && (
                  <button
                    onClick={submitCommand}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700
                             px-4 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2
                             transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Execute Command
                  </button>
                )}
              </div>

              {/* Supported commands section */}
              <div className="mt-6 pt-6 border-t border-gray-200/50">
                <button
                  onClick={() => setShowCommandsList(!showCommandsList)}
                  className="w-full flex items-center justify-between mb-4 p-3 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-200/50 hover:border-blue-200 hover:bg-white/50 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-100 to-purple-100">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Available Commands</p>
                    <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      {VOICE_PATTERNS.length} commands
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      showCommandsList ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>

                {showCommandsList && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 mb-4">
                    {VOICE_PATTERNS.map((pattern) => (
                      <div
                        key={pattern.action}
                        className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200/50 hover:border-blue-200 transition-all duration-200 overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedCommand(expandedCommand === pattern.action ? null : pattern.action)
                          }
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/50 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-50 to-purple-50">
                              <span className="text-xs font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                {pattern.action.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-gray-800 capitalize">
                              {pattern.action.replace('_', ' ')}
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                              expandedCommand === pattern.action ? 'rotate-180 text-blue-600' : ''
                            }`}
                          />
                        </button>

                        {/* Expanded examples */}
                        {expandedCommand === pattern.action && (
                          <div className="bg-gradient-to-b from-white to-gray-50 px-4 py-3 border-t border-gray-200/50">
                            <p className="text-xs font-medium text-gray-600 mb-2">Try saying:</p>
                            <div className="space-y-2">
                              {pattern.examples.map((example, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white border border-gray-200/75 rounded-lg px-3 py-2 hover:bg-blue-50/50 transition-colors cursor-default"
                                >
                                  <p className="text-sm text-gray-700 font-mono">"{example}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tips */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-purple-50/50 border border-blue-200/50">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-blue-100">
                      <span className="text-xs font-bold text-blue-600">💡</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-blue-900 mb-1">Voice Command Tips</p>
                      <p className="text-xs text-blue-700">
                        Say "dot" for file extensions • Speak clearly and naturally • Click the edit icon to fix commands
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add custom animations to global styles */}
      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 40px rgba(139, 92, 246, 0.4); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
