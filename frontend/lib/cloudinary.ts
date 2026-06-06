
import { apiUrl } from "@/lib/api";

// Signed upload helper for large files (no size limit on free tier beyond Cloudinary's global limit!)
export async function uploadToCloudinary(
  file: File,
  folder: string,
  getSignature: (folder: string) => Promise<{ cloudName: string; apiKey: string; timestamp: number; signature: string }>
) {
  const { cloudName, apiKey, timestamp, signature } = await getSignature(folder);
  if (!cloudName) throw new Error("Missing Cloudinary cloud name");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  // Determine resource type based on file
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const resourceType = isPdf ? "raw" : "auto";
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Cloudinary upload failed");
  }

  return response.json();
}

// Helper function to get a signature from the backend
export async function getCloudinarySignature(adminHeaders: Record<string, string>, folder: string) {
  const response = await fetch(apiUrl(`/api/cloudinary/signature?folder=${encodeURIComponent(folder)}`), {
    credentials: "include",
    headers: adminHeaders
  });
  
  if (!response.ok) {
    throw new Error("Failed to get Cloudinary signature");
  }
  
  return response.json();
}
