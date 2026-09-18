"use client";

import Image from "next/image";
import { useState } from "react";

export type ImageContext = "booklet-card" | "booklet-detail" | "movement-hero" | "mobile" | "full";

interface CropData {
  square?: string;
  portrait?: string;
  mobile?: string;
  hero?: string;
}

interface VallruImageProps {
  id: string;
  title: string;
  originalImage: string;
  crops: CropData;
  context: ImageContext;
  alt: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  objectFit?: "cover" | "contain" | "fill";
}

// Context → crop type mapping
const contextToCrop: Record<ImageContext, keyof CropData | "original"> = {
  "booklet-card": "square",
  "booklet-detail": "portrait",
  "movement-hero": "hero",
  "mobile": "mobile",
  "full": "original"
};

// Default aspect ratios
const aspectRatios: Record<ImageContext, number> = {
  "booklet-card": 1, // 1:1 square
  "booklet-detail": 1.25, // 4:5 portrait
  "movement-hero": 1.6, // 16:10
  "mobile": 0.5625, // 9:16
  "full": 1 // original
};

export function VallruImage({
  id,
  title,
  originalImage,
  crops,
  context,
  alt,
  className = "",
  priority = false,
  fill = false,
  width,
  height,
  objectFit = "cover"
}: VallruImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Select the appropriate crop URL
  const cropType = contextToCrop[context];
  let imageUrl = originalImage;

  if (cropType !== "original") {
    const croppedUrl = crops[cropType as keyof CropData];
    imageUrl = croppedUrl || originalImage;
  }

  // Calculate dimensions based on context
  const aspectRatio = aspectRatios[context];
  const imageWidth = width || 800;
  const imageHeight = height || Math.round(imageWidth / aspectRatio);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  // Blur placeholder (subtle gradient matching site colors)
  const blurDataUrl =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Crect fill='%231a1815' width='800' height='600'/%3E%3C/svg%3E";

  return (
    <div
      className={`relative overflow-hidden bg-ink ${className}`}
      style={{
        aspectRatio: `${aspectRatio}`
      }}
    >
      {!error ? (
        <Image
          key={imageUrl}
          src={imageUrl}
          alt={alt || title}
          fill={fill}
          width={fill ? undefined : imageWidth}
          height={fill ? undefined : imageHeight}
          priority={priority}
          quality={85}
          placeholder="blur"
          blurDataURL={blurDataUrl}
          onLoadingComplete={handleLoadingComplete}
          onError={handleError}
          className={`transition-opacity duration-300 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          style={
            !fill
              ? {
                  objectFit,
                  width: "100%",
                  height: "auto"
                }
              : {
                  objectFit
                }
          }
        />
      ) : (
        <div
          className="flex items-center justify-center w-full h-full bg-gradient-to-br from-surface to-ink text-muted text-sm"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          Image unavailable
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface to-ink animate-pulse" />
      )}
    </div>
  );
}

// Helper hook to determine context based on viewport
export function useImageContext(): ImageContext {
  const [context, setContext] = useState<ImageContext>("booklet-card");

  // This would typically use a media query or context provider
  // For now, returns a default that can be overridden
  return context;
}

// Preload image for better performance
export function preloadVallruImage(imageUrl: string) {
  if (typeof window !== "undefined") {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = imageUrl;
    document.head.appendChild(link);
  }
}
