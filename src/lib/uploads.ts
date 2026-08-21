import { supabase } from "@/integrations/supabase/client";
import { isCloudinaryConfigured, uploadFileToCloudinary } from "@/lib/cloudinary";
import { compressImage } from "@/lib/image-compression";

const randomId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Sanitize filename to remove special characters that cause issues with storage
const sanitizeFilename = (filename: string): string => {
  // Get extension
  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot > 0 ? filename.slice(lastDot) : '';
  const name = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  
  // Replace special characters with underscores, keep only alphanumeric, dash, underscore
  const sanitized = name
    .replace(/[^a-zA-Z0-9\-_]/g, '_')  // Replace special chars with underscore
    .replace(/_+/g, '_')               // Collapse multiple underscores
    .replace(/^_|_$/g, '')             // Trim leading/trailing underscores
    .slice(0, 50);                     // Limit length
  
  return (sanitized || 'file') + ext.toLowerCase();
};

export async function uploadFile(
  file: File,
  opts: { folder: string; onProgress?: (percent: number) => void }
): Promise<{ url: string }> {
  try {
    // Only compress images, skip SVGs
    let fileToUpload = file;
    try {
      if (file.type.startsWith('image/') && !file.type.includes('svg')) {
        const startSize = file.size;
        fileToUpload = await compressImage(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1920, quality: 0.82 });
        const savedKB = Math.round((startSize - fileToUpload.size) / 1024);
        if (savedKB > 0) {
          console.log(`[uploads] Compressed ${file.name}: saved ${savedKB}KB`);
        }
      }
    } catch (compressError) {
      console.warn("[uploads] Image compression failed, using original:", compressError);
      fileToUpload = file;
    }
    
    // Try Cloudinary first if configured
    if (isCloudinaryConfigured()) {
      try {
        const res = await uploadFileToCloudinary(fileToUpload, {
          folder: opts.folder,
          onProgress: (progress) => {
            opts.onProgress?.(progress.percent);
          },
        });
        return { url: res.secureUrl };
      } catch (cloudinaryError) {
        console.warn("[uploads] Cloudinary upload failed, falling back to Supabase Storage:", cloudinaryError);
        // Fall back to Supabase Storage below
      }
    }

    // Fallback to Supabase Storage (public bucket).
    const safeName = sanitizeFilename(fileToUpload.name);
    const path = `${opts.folder}/${randomId()}-${safeName}`.replace(/\/{2,}/g, "/");
    
    // Determine content type for storage
    let contentType = fileToUpload.type;
    if (!contentType || contentType === "application/octet-stream") {
      const ext = safeName.split('.').pop()?.toLowerCase();
      if (ext === 'mp4') contentType = 'video/mp4';
      else if (ext === 'webm') contentType = 'video/webm';
      else if (ext === 'mov') contentType = 'video/quicktime';
      else if (ext === 'm4v') contentType = 'video/x-m4v';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'webp') contentType = 'image/webp';
    }

    const { error } = await supabase.storage.from("uploads").upload(path, fileToUpload, {
      cacheControl: "3600",
      upsert: false,
      contentType: contentType || undefined,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not get public URL for uploaded file.");
    return { url: data.publicUrl };
  } catch (error) {
    console.error("[uploads] Upload failed:", error);
    throw error;
  }
}

