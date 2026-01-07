import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { X, Loader2, Image as ImageIcon, Video, Mic, Zap } from 'lucide-react';
import { ItemType } from '../types';

interface AIModalProps {
  onClose: () => void;
  onGenerate: (type: ItemType, content: string, metadata?: any) => void;
}

type Mode = 'text' | 'image' | 'video' | 'audio';

// Get Gemini API key from localStorage (same as aiProvider.ts)
const getGeminiApiKey = (): string => {
  const stored = localStorage.getItem('gemini-api-key');
  if (stored) return stored;
  // Fallback to env var
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

export const AIModal: React.FC<AIModalProps> = ({ onClose, onGenerate }) => {
  const [mode, setMode] = useState<Mode>('text');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Image Config
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

  // Video Config
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Audio Config
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getClient = async () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add your API key in Settings → Providers.');
    }
    return new GoogleGenAI({ apiKey });
  };

  const generate = async () => {
    if (!prompt && mode !== 'audio' && (mode !== 'video' || !uploadedImage)) return;
    setLoading(true);
    setStatus('Initializing...');

    try {
      if (mode === 'text') {
        const ai = await getClient();
        const model = localStorage.getItem('text-model') || 'gemini-2.5-flash-lite';
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        const text = response.text;
        if (text) {
          onGenerate('sticky', text);
          onClose();
        }

      } else if (mode === 'image') {
        setStatus('Generating image...');
        const ai = await getClient();
        const model = localStorage.getItem('image-generation-model') || 'gemini-3-pro-image-preview';

        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              imageSize: imageSize,
              aspectRatio: "1:1" // Default square for canvas items usually
            }
          }
        });

        // Find image part
        let imageUrl = null;
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
        }

        if (imageUrl) {
          onGenerate('image', imageUrl, { resolution: imageSize });
          onClose();
        } else {
            throw new Error("No image returned");
        }

      } else if (mode === 'video') {
        setStatus('Initializing Veo (this may take a moment)...');
        const ai = await getClient();
        
        // If image uploaded, use it for image-to-video
        let modelParams: any = {
            model: 'veo-3.1-fast-generate-preview',
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: videoAspectRatio
            }
        };

        if (uploadedImage) {
            const base64Data = uploadedImage.split(',')[1];
            const mimeType = uploadedImage.split(',')[0].split(':')[1].split(';')[0];
            
            modelParams = {
                ...modelParams,
                image: {
                    imageBytes: base64Data,
                    mimeType: mimeType
                },
                prompt: prompt || "Animate this image"
            };
        } else {
            modelParams = {
                ...modelParams,
                prompt: prompt
            };
        }

        setStatus('Generating video... please wait.');
        let operation = await ai.models.generateVideos(modelParams);

        while (!operation.done) {
            setStatus('Rendering video...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
             setStatus('Downloading video...');
             const vidResponse = await fetch(`${videoUri}&key=${getGeminiApiKey()}`);
             const blob = await vidResponse.blob();
             const reader = new FileReader();
             reader.onloadend = () => {
                 onGenerate('video', reader.result as string, { resolution: '720p' });
                 onClose();
             };
             reader.readAsDataURL(blob);
        } else {
            throw new Error("Video generation failed");
        }

      }
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setStatus("Could not access microphone");
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' }); // Generic container, usually webm/mp4
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            setLoading(true);
            setStatus("Transcribing audio...");
            
            try {
                const ai = await getClient();
                const model = localStorage.getItem('text-model') || 'gemini-3-flash-preview';
                const response = await ai.models.generateContent({
                    model,
                    contents: {
                        parts: [
                            { inlineData: { mimeType: 'audio/mp3', data: base64Audio } },
                            { text: "Transcribe this audio exactly as spoken." }
                        ]
                    }
                });
                
                const transcription = response.text;
                if (transcription) {
                    onGenerate('note', `<p>${transcription}</p>`, { title: 'Transcription', source: 'audio' });
                    onClose();
                }
            } catch (e: any) {
                setStatus(`Error: ${e.message}`);
                setLoading(false);
            }
        };
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-modal-enter p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Zap className="text-blue-500 fill-current" size={20} />
            AI Studio
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-100/50 gap-1 mx-6 mt-4 rounded-xl">
          {(['text', 'image', 'video', 'audio'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setStatus(''); setUploadedImage(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize flex items-center justify-center gap-2 ${
                mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'text' && <Zap size={16} />}
              {m === 'image' && <ImageIcon size={16} />}
              {m === 'video' && <Video size={16} />}
              {m === 'audio' && <Mic size={16} />}
              {m}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          
          {status && (
             <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-center gap-2 animate-pulse">
                <Loader2 size={16} className="animate-spin" />
                {status}
             </div>
          )}

          {mode === 'text' && (
            <div className="space-y-4">
               <p className="text-sm text-gray-500">Ask a question or generate a quick idea (Gemini 2.5 Flash Lite).</p>
               <textarea 
                  className="w-full h-32 p-4 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none transition-all"
                  placeholder="What's on your mind?"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
               />
            </div>
          )}

          {mode === 'image' && (
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Generate high-fidelity images with Nano Banana Pro.</p>
                <textarea 
                    className="w-full h-24 p-4 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none transition-all"
                    placeholder="Describe the image..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                />
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Resolution</label>
                    <div className="flex gap-2">
                        {['1K', '2K', '4K'].map((size) => (
                            <button
                                key={size}
                                onClick={() => setImageSize(size as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    imageSize === size 
                                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          )}

          {mode === 'video' && (
             <div className="space-y-4">
                <p className="text-sm text-gray-500">Generate videos with Veo 3. Upload an image to animate it, or just use a prompt.</p>
                
                {/* Image Upload for Image-to-Video */}
                <div className="flex items-center gap-4">
                    <div className="relative group w-24 h-24 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors">
                        {uploadedImage ? (
                            <img src={uploadedImage} className="w-full h-full object-cover" alt="upload" />
                        ) : (
                            <div className="flex flex-col items-center gap-1 text-gray-400">
                                <ImageIcon size={20} />
                                <span className="text-[10px]">Upload</span>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        {uploadedImage && (
                             <button onClick={(e) => {e.stopPropagation(); setUploadedImage(null);}} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                                 <X size={12} />
                             </button>
                        )}
                    </div>
                    <div className="flex-1">
                        <textarea 
                            className="w-full h-24 p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none transition-all text-sm"
                            placeholder={uploadedImage ? "Describe how to animate this image..." : "Describe the video you want to create..."}
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Aspect Ratio</label>
                    <div className="flex gap-2">
                        {[
                            { val: '16:9', label: 'Landscape (16:9)' },
                            { val: '9:16', label: 'Portrait (9:16)' }
                        ].map((ar) => (
                            <button
                                key={ar.val}
                                onClick={() => setVideoAspectRatio(ar.val as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    videoAspectRatio === ar.val 
                                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                {ar.label}
                            </button>
                        ))}
                    </div>
                </div>
             </div>
          )}

          {mode === 'audio' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                  <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                      {isRecording && (
                          <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-20" />
                      )}
                      <Mic size={40} />
                  </div>
                  
                  <div className="text-center">
                      <h3 className="font-semibold text-gray-900">{isRecording ? 'Recording...' : 'Transcribe Audio'}</h3>
                      <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">
                          {isRecording ? 'Speak clearly. Tap stop when finished.' : 'Tap the button below to start recording. We will transcribe it using Gemini 3 Flash.'}
                      </p>
                  </div>

                  {!isRecording ? (
                      <button 
                        onClick={startRecording}
                        className="px-8 py-3 bg-gray-900 text-white rounded-full font-medium hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2"
                      >
                          Start Recording
                      </button>
                  ) : (
                      <button 
                        onClick={stopRecordingAndTranscribe}
                        className="px-8 py-3 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 active:scale-95 transition-all shadow-lg flex items-center gap-2"
                      >
                          <div className="w-3 h-3 bg-white rounded-sm" />
                          Stop & Transcribe
                      </button>
                  )}
              </div>
          )}

        </div>

        {/* Footer */}
        {mode !== 'audio' && (
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button 
                onClick={generate}
                disabled={loading || (!prompt && mode !== 'video')}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                Generate
            </button>
            </div>
        )}
      </div>
    </div>
  );
};