import React, { useState } from "react";
import { isVideoUrl } from "@/lib/media";
import { Trash2, Star, ArrowLeft, ArrowRight, GripVertical, Plus, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DraggableMediaGridProps {
  images: string[];
  onImagesChange: (newImages: string[]) => void;
  onUploadClick?: () => void;
  title?: string;
  description?: string;
  allowCoverBadge?: boolean;
  maxFiles?: number;
  columnsClass?: string;
  disabled?: boolean;
}

export default function DraggableMediaGrid({
  images = [],
  onImagesChange,
  onUploadClick,
  title,
  description,
  allowCoverBadge = true,
  maxFiles,
  columnsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  disabled = false,
}: DraggableMediaGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", index.toString());
    } catch {}
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (disabled) return;
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...images];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setDraggedIndex(null);
    setDragOverIndex(null);
    onImagesChange(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (disabled || toIndex < 0 || toIndex >= images.length) return;
    const updated = [...images];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    onImagesChange(updated);
  };

  const makeCover = (index: number) => {
    if (disabled || index === 0) return;
    moveItem(index, 0);
  };

  const removeItem = (index: number) => {
    if (disabled) return;
    const updated = images.filter((_, i) => i !== index);
    onImagesChange(updated);
  };

  return (
    <div className="space-y-3">
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}

      {images.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <GripVertical className="w-3.5 h-3.5 text-primary" />
              Drag photos to rearrange order (first photo is Cover)
            </span>
            <span>{images.length} {images.length === 1 ? "photo" : "photos"} {maxFiles ? `/ max ${maxFiles}` : ""}</span>
          </div>

          <div className={`grid ${columnsClass} gap-3`}>
            {images.map((url, idx) => {
              const isDragging = draggedIndex === idx;
              const isOver = dragOverIndex === idx;
              const isCover = allowCoverBadge && idx === 0;

              return (
                <div
                  key={`${url}-${idx}`}
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`group relative aspect-square rounded-xl overflow-hidden border transition-all duration-200 select-none bg-muted/40 cursor-grab active:cursor-grabbing ${
                    isCover ? "ring-2 ring-primary/80 border-primary shadow-sm" : "border-border hover:border-primary/50"
                  } ${isDragging ? "opacity-30 scale-95 border-dashed border-primary" : ""} ${
                    isOver ? "ring-2 ring-primary scale-[1.03] shadow-md border-primary" : ""
                  }`}
                >
                  {isVideoUrl(url) ? (
                    <video src={url} className="w-full h-full object-cover pointer-events-none" muted playsInline />
                  ) : (
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
                  )}

                  {/* Badge & Order indicator */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 z-10 pointer-events-none">
                    {isCover ? (
                      <span className="flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                        <Star className="w-2.5 h-2.5 fill-current" /> Cover
                      </span>
                    ) : (
                      <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow">
                        #{idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Hover action bar */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 z-20">
                    <div className="flex items-center justify-between">
                      <div className="p-1 text-white/90 bg-black/40 rounded-full cursor-grab">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(idx);
                        }}
                        className="p-1.5 bg-destructive text-white rounded-full hover:bg-destructive/90 transition-transform active:scale-95 shadow"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-auto">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItem(idx, idx - 1);
                          }}
                          className={`p-1 rounded-md text-white bg-black/60 hover:bg-black/90 transition ${
                            idx === 0 ? "opacity-30 cursor-not-allowed" : "hover:scale-105"
                          }`}
                          title="Move left"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === images.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItem(idx, idx + 1);
                          }}
                          className={`p-1 rounded-md text-white bg-black/60 hover:bg-black/90 transition ${
                            idx === images.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:scale-105"
                          }`}
                          title="Move right"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      {allowCoverBadge && idx !== 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            makeCover(idx);
                          }}
                          className="flex items-center gap-1 text-[10px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground px-2 py-1 rounded-md shadow transition active:scale-95"
                          title="Make cover photo"
                        >
                          <Star className="w-2.5 h-2.5 fill-current" /> Cover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add more tile */}
            {onUploadClick && (!maxFiles || images.length < maxFiles) && (
              <button
                type="button"
                onClick={onUploadClick}
                disabled={disabled}
                className="aspect-square border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all p-3 text-center group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-1.5 transition-colors">
                  <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="text-xs font-medium">Add Photo</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        onUploadClick && (
          <div
            onClick={onUploadClick}
            className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">Click to upload photos</p>
            <p className="text-xs text-muted-foreground mt-1">or select from Cloudinary</p>
          </div>
        )
      )}
    </div>
  );
}
