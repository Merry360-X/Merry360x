import React from "react";

interface RichTextRendererProps {
  content?: string | null;
  className?: string;
}

const isHtml = (str: string): boolean => {
  return /<[a-z][\s\S]*>/i.test(str);
};

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({ content, className = "" }) => {
  if (!content) return null;

  if (isHtml(content)) {
    return (
      <div
        className={`rich-text-content prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${className}`}>
      {content}
    </p>
  );
};

export default RichTextRenderer;
