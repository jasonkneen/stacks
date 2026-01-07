import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { X, Loader2, Upload, Mic } from 'lucide-react';

type Mode = 'image' | 'video' | 'audio';

interface QuickGenerateProps {
  initialMode: Mode;
  onClose: () => void;
  onGenerate: (type: 'image' | 'video' | 'note', content: string, metadata?: any) => void;
}

// Get Gemini API key from localStorage
const getGeminiApiKey = (): string => {
  const stored = localStorage.getItem('gemini-api-key');
  if (stored) return stored;
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

export const QuickGenerate: React.FC<QuickGenerateProps> = ({ initialMode, onClose, onGenerate }) => {
  const [mode, setMode] = useState<Mode>(initialMode);
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
      throw new Error('Gemini API key not configured. Go to Settings → Providers.');
    }
    return new GoogleGenAI({ apiKey });
  };

  const generate = async () => {
    if (!prompt && mode !== 'audio' && (mode !== 'video' || !uploadedImage)) return;
    setLoading(true);
    setStatus('Initializing...');

    try {
      if (mode === 'image') {
        setStatus('Generating image...');
        const ai = await getClient();
        const model = localStorage.getItem('image-generation-model') || 'gemini-2.5-flash-image';

        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            responseModalities: ['Text', 'Image'],
          } as any
        });

        // Find image part
        let imageUrl = null;
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if ((part as any).inlineData) {
              const inlineData = (part as any).inlineData;
              imageUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
              break;
            }
          }
        }

        if (imageUrl) {
          onGenerate('image', imageUrl, { resolution: imageSize, prompt });
          onClose();
        } else {
          throw new Error("No image returned from API");
        }

      } else if (mode === 'video') {
        setStatus('Initializing video generation...');
        const ai = await getClient();

        let modelParams: any = {
          model: 'veo-2.0-generate-001',
          config: {
            numberOfVideos: 1,
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
            onGenerate('video', reader.result as string, { prompt });
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
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        setLoading(true);
        setStatus("Transcribing audio...");

        try {
          const ai = await getClient();
          const model = localStorage.getItem('text-model') || 'gemini-2.0-flash-exp';
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

  const getModeDescription = () => {
    switch (mode) {
      case 'image': return 'Generate high-fidelity images with AI.';
      case 'video': return 'Generate videos with Veo. Upload an image to animate it.';
      case 'audio': return 'Record audio and transcribe it with AI.';
    }
  };

  return (
    <div className="absolute bottom-16 right-0 bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden min-w-[340px] z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Body */}
      <div className="p-4">
        <p className="text-xs text-gray-700 font-medium mb-3">{getModeDescription()}</p>

        {status && (
          <div className="mb-3 p-2.5 bg-blue-50 text-blue-700 text-xs rounded-lg flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {status}
          </div>
        )}

        {mode === 'image' && (
          <div className="space-y-3">
            <textarea
              className="w-full h-24 p-3 bg-white/60 rounded-xl border border-white/40 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none resize-none transition-all text-sm text-gray-900 placeholder-gray-500"
              placeholder="Describe the image..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <div>
              <label className="text-[10px] font-bold text-gray-800 uppercase tracking-wider mb-1.5 block">Resolution</label>
              <div className="flex gap-1.5">
                {['1K', '2K', '4K'].map((size) => (
                  <button
                    key={size}
                    onClick={() => setImageSize(size as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      imageSize === size
                      ? 'bg-blue-100/80 border-blue-300 text-blue-800'
                      : 'bg-white/60 border-white/40 text-gray-800 hover:bg-white/80'
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
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="relative group w-16 h-16 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors flex-shrink-0">
                {uploadedImage ? (
                  <img src={uploadedImage} className="w-full h-full object-cover" alt="upload" />
                ) : (
                  <div className="flex flex-col items-center gap-0.5 text-gray-400">
                    <Upload size={16} />
                    <span className="text-[9px]">Image</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                {uploadedImage && (
                  <button onClick={(e) => {e.stopPropagation(); setUploadedImage(null);}} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70">
                    <X size={10} />
                  </button>
                )}
              </div>
              <textarea
                className="flex-1 h-16 p-2.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none transition-all text-xs"
                placeholder={uploadedImage ? "How to animate..." : "Describe the video..."}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Aspect Ratio</label>
              <div className="flex gap-1.5">
                {[
                  { val: '16:9', label: 'Landscape' },
                  { val: '9:16', label: 'Portrait' }
                ].map((ar) => (
                  <button
                    key={ar.val}
                    onClick={() => setVideoAspectRatio(ar.val as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
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
          <div className="flex flex-col items-center py-4 space-y-4">
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-20" />
              )}
              <Mic size={28} />
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                {isRecording ? 'Recording... Tap stop when done.' : 'Tap to start recording.'}
              </p>
            </div>

            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-5 py-2 bg-gray-900 text-white rounded-full text-xs font-medium hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecordingAndTranscribe}
                className="px-5 py-2 bg-red-500 text-white rounded-full text-xs font-medium hover:bg-red-600 active:scale-95 transition-all shadow-lg flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-white rounded-sm" />
                Stop & Transcribe
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {mode !== 'audio' && (
        <div className="px-4 pb-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-700 font-medium hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={loading || (!prompt && (mode !== 'video' || !uploadedImage))}
            className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-1.5"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Generate
          </button>
        </div>
      )}
    </div>
  );
};
