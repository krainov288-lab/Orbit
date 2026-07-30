import React, { useState, useRef } from 'react';
import { Image, FileText, Upload, X, Check, Loader2 } from 'lucide-react';
import { compressImage } from '../../services/media';
import { api } from '../../services/api';

interface MediaUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (mediaUrl: string, mediaType: 'image' | 'file', filename: string) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ isOpen, onClose, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setCompressing(true);

    try {
      const processedFile = await compressImage(selectedFile);
      setFile(processedFile);

      if (processedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(processedFile);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    } catch (e: any) {
      setError('Ошибка обработки медиафайла');
    } finally {
      setCompressing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const res = await api.uploadMedia(file);
      onUploaded(res.url, res.mediaType, res.filename);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки медиа');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in text-primary">
      <div className="relative w-full max-w-sm rounded-3xl p-5 glass-card border border-white/20 dark:border-white/10 shadow-2xl text-primary">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full glass-button flex items-center justify-center text-secondary hover:text-primary transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-9 w-9 rounded-2xl glass-button text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Upload size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">Загрузка медиа</h3>
            <p className="text-[11px] text-muted">Фотографии, изображения и файлы</p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium">
            {error}
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
        />

        {!file ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="glass-card border-2 border-dashed border-white/20 dark:border-white/10 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-500/50 transition"
          >
            <div className="h-10 w-10 mx-auto mb-2 rounded-2xl glass-button text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Image size={20} />
            </div>
            <p className="text-xs font-bold text-primary">Нажмите для выбора файла</p>
            <p className="text-[10px] text-muted mt-1">
              Изображения автоматически оптимизируются перед отправкой
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {compressing ? (
              <div className="py-8 text-center text-xs text-muted flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-500" />
                <span>Оптимизация файла...</span>
              </div>
            ) : (
              <>
                {previewUrl ? (
                  <div className="relative rounded-2xl overflow-hidden max-h-48 glass-button p-2">
                    <img src={previewUrl} alt="Превью" className="w-full h-full object-contain max-h-44 rounded-xl" />
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl glass-button flex items-center gap-3">
                    <FileText size={24} className="text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-primary truncate">{file.name}</p>
                      <p className="text-[10px] text-muted">{(file.size / 1024).toFixed(1)} КБ</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                    className="flex-1 py-2.5 rounded-2xl glass-button text-xs font-semibold text-secondary hover:text-primary"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 py-2.5 rounded-2xl glass-button bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 size={14} className="animate-spin text-blue-500" />
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Отправить</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
